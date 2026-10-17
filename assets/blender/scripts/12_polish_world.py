"""STUDY WORLD — STEP 12: VISUAL POLISH (APPROVED LAYOUT UNCHANGED)

Run in Blender's Text Editor with your successful Step 11 preview open.
If needed, reads study_world_preview.blend from your configured source folder.
Creates a separate scene and independent meshes/materials; Step 11 stays intact.
Blender 4.2+ / 5.2-compatible Eevee naming. No add-ons or internet required.
No automatic saving or exporting. Save As: study_world_polished.blend

Richer colours, warm/cool lighting, three rock profiles, per-subject grass tints,
a camera-facing gradient backdrop and bounds-based camera framing.
Does NOT move islands, bridges, landmarks or plots, or change the grass geometry.
The sky backdrop and lights are presentation only, not website export assets.
"""
import bpy
import math
import colorsys
from pathlib import Path
from mathutils import Vector

SCENE_NAME = "Study World - Step 12"
OWNER = "study_world_step_12_v1"
SOURCE_SCENE = "Study World - Step 11"
SOURCE_FOLDER = r"C:\Users\kashif\Desktop\3d-world-study-planner\blender\source"
FRAME_PADDING = 1.16
# Rich but still pastel: hexadecimal colours are converted to shader-linear RGB.
GRASS_COLOURS = {
    "Maths":"83b965", "Reasoning":"83ae72", "English":"a0b976",
    "GK":"72b48f", "DSA":"76ac63", "Software":"9daf6c",
    "Unassigned_01":"70aa65", "Unassigned_02":"87b575",
}
# Three reusable profile types: shallow, balanced and deep. Top rim stays fixed.
ROCK_DEPTHS = (.88,1.10,1.30)
SUBJECT_ORDER = tuple(GRASS_COLOURS)


def collection(name, scene):
    coll = bpy.data.collections.new(name)
    coll["study_world_owner"] = OWNER
    scene.collection.children.link(coll)
    return coll


def attach(obj, name, coll, mat=None, root=None):
    obj.name = name
    obj["study_world_owner"] = OWNER
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    coll.objects.link(obj)
    if mat is not None:
        obj.data.materials.append(mat)
    if root is not None:
        obj.parent = root
    return obj


def prepare_scene():
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene is not None:
        if scene.get("study_world_owner") != OWNER:
            raise RuntimeError("Scene name already in use. Rename that scene before running this script.")
        foreign = [o.name for o in scene.objects if o.get("study_world_owner") != OWNER]
        if foreign:
            raise RuntimeError("Rebuild stopped to protect objects you added: " + ", ".join(foreign))
        for obj in list(scene.objects):
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data is not None and data.users == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
                elif isinstance(data, bpy.types.Camera):
                    bpy.data.cameras.remove(data)
                elif isinstance(data, bpy.types.Light):
                    bpy.data.lights.remove(data)
        for coll in list(scene.collection.children):
            if coll.get("study_world_owner") == OWNER:
                bpy.data.collections.remove(coll)
    else:
        scene = bpy.data.scenes.new(SCENE_NAME)
        scene["study_world_owner"] = OWNER
    if bpy.context.window is None:
        raise RuntimeError("Run this in Blender's Text Editor with a window available.")
    bpy.context.window.scene = scene
    return scene


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def srgb_to_linear(channel):
    channel = max(0.0,min(1.0,channel))
    return channel/12.92 if channel <= .04045 else ((channel+.055)/1.055)**2.4


def hex_colour(value):
    value = value.lstrip('#')
    return tuple(srgb_to_linear(int(value[i:i+2],16)/255) for i in (0,2,4))


def rock_position(x,y,z,index):
    # Only the underside changes. Keep the top rim and grass/bridge landings exact.
    if z >= -.05:
        return x,y,z
    blend = min(1.0,max(0.0,(-z-.05)/2.7))
    angle = math.atan2(y,x)
    radial = 1+blend*(.065*math.sin(2*angle+index*.8)
                      +.035*math.sin(3*angle-index*.45))
    depth = ROCK_DEPTHS[index%len(ROCK_DEPTHS)]
    return x*radial,y*radial,z*(1+(depth-1)*blend)


def frame_parameters(points,aspect,padding):
    if not points or aspect <= 0 or padding < 1:
        raise ValueError("Need nonempty bounds, positive aspect and padding >= 1.")
    xs,ys = [p[0] for p in points],[p[1] for p in points]
    cx,cy = (min(xs)+max(xs))/2,(min(ys)+max(ys))/2
    width,height = max(max(xs)-min(xs),.001),max(max(ys)-min(ys),.001)
    return cx,cy,max(width,height*aspect)*padding


def load_preview():
    source = bpy.data.scenes.get(SOURCE_SCENE)
    if source is None:
        path = Path(bpy.path.abspath(SOURCE_FOLDER))/"study_world_preview.blend"
        if not path.is_file():
            raise RuntimeError("First save/open your successful Step 11 preview, or put "
                               "study_world_preview.blend here: "+str(path.parent))
        with bpy.data.libraries.load(str(path),link=False) as (library,requested):
            if SOURCE_SCENE not in library.scenes:
                raise RuntimeError("The saved preview does not contain "+SOURCE_SCENE
                                   +". Save the successful Script 11 result first.")
            requested.scenes = [SOURCE_SCENE]
        source = requested.scenes[0]
    if source is None or source.get('study_world_owner') != 'study_world_step_11_v1':
        raise RuntimeError("Source scene is not the generated Step 11 preview.")
    # Evaluate the source scene BEFORE reading calculated world/camera matrices.
    # An inactive scene's cached matrix_world can be stale or identity.
    if bpy.context.window is None:
        raise RuntimeError('Run this from Blender with a window available.')
    bpy.context.window.scene = source
    bpy.context.view_layer.update()
    bpy.context.evaluated_depsgraph_get().update()
    # Snapshot before ANY scene mutation, including prepare_scene and new wrappers.
    objects = tuple(source.objects)
    geometry = tuple(obj for obj in objects if obj is not None and obj.type in {'MESH','EMPTY'})
    if not any(obj.type == 'MESH' for obj in geometry):
        raise RuntimeError("Step 11 preview has no meshes; run Script 11 successfully first.")
    if source.camera is None:
        raise RuntimeError("Step 11 preview camera is missing. Rerun Script 11 first.")
    return source,geometry


def capture_transforms(originals):
    # Call while the ORIGINAL scene is active and fully evaluated.
    originals = tuple(originals)
    members = set(originals)
    frozen = {}
    for original in originals:
        if original is None:
            raise RuntimeError('Invalid source object. Reopen your saved Step 11 preview.')
        if original.parent is not None and original.parent not in members:
            raise RuntimeError('Source geometry has an external parent: '+original.name
                               +'. Use the unmodified Step 11 preview.')
        frozen[original] = {
            'parent':original.parent,
            'basis':original.matrix_basis.copy(),
            'inverse':original.matrix_parent_inverse.copy(),
            'world':original.matrix_world.copy(),
        }
    return frozen


def copy_geometry(originals,destination,frozen=None):
    originals = tuple(originals)
    if any(obj is None for obj in originals):
        raise RuntimeError("Invalid source object. Reopen the saved Step 11 preview.")
    if frozen is None:
        frozen = capture_transforms(originals)
    mapping,meshes = {},{}
    for original in originals:
        duplicate = original.copy()
        duplicate.name = "SW12__"+original.name
        duplicate['study_world_owner'] = OWNER
        if original.type == 'MESH':
            # Grass and rocky undersides get independent per-island geometry.
            independent = ('SW01_Rock_Underside' in original.name
                           or 'SW01_Grass_Cap' in original.name)
            if independent:
                duplicate.data = original.data.copy()
            else:
                if original.data not in meshes:
                    meshes[original.data] = original.data.copy()
                duplicate.data = meshes[original.data]
        destination.objects.link(duplicate)
        duplicate.hide_viewport = False
        duplicate.hide_render = False
        mapping[original] = duplicate
    # First rebuild the entire parent graph. Then restore the FROZEN local
    # matrices, including unparented island-placement roots. Do not read inactive
    # originals' matrix_world here or reset any placement root to identity.
    for original,duplicate in mapping.items():
        parent = frozen[original]['parent']
        duplicate.parent = mapping[parent] if parent is not None else None
    for original,duplicate in mapping.items():
        duplicate.matrix_parent_inverse = frozen[original]['inverse'].copy()
        duplicate.matrix_basis = frozen[original]['basis'].copy()
    return mapping


def validate_layout(mapping,frozen):
    # Refuse to render a collapsed world: check every clone against the saved pose.
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    for original,duplicate in mapping.items():
        actual = duplicate.evaluated_get(depsgraph).matrix_world
        expected = frozen[original]['world']
        error = max(abs(actual[r][c]-expected[r][c]) for r in range(4) for c in range(4))
        if error > .0001:
            raise RuntimeError('Polish stopped: placement check failed for '+original.name
                               +' (matrix error '+str(round(error,6))+'). '
                               'The original Step 11 world is unchanged. Send this error.')
    print('STUDY WORLD: Verified every copied placement against Step 11.')


def subject_for(obj):
    while obj is not None:
        name = obj.get('demo_subject')
        if name in GRASS_COLOURS:
            return name
        obj = obj.parent
    return 'Maths'


def set_material_colour(mat,colour):
    mat.diffuse_color = (*colour,1)
    if mat.use_nodes:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'),None)
        if bsdf is not None:
            bsdf.inputs['Base Color'].default_value = (*colour,1)


def richer_material(original):
    mat = original.copy()
    mat.name = "SW12_"+original.name
    mat['study_world_owner'] = OWNER
    if not mat.use_nodes:
        colour = tuple(srgb_to_linear(c) for c in original.diffuse_color[:3])
        mat.diffuse_color = (*colour,1)
        return mat
    bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'),None)
    if bsdf is None:
        return mat
    # Earlier scripts entered the intended palette directly as shader values.
    # Interpreting it as sRGB here restores deeper mid-tones, not extra exposure.
    base = tuple(bsdf.inputs['Base Color'].default_value[:3])
    h,s,v = colorsys.rgb_to_hsv(*base)
    rgb = colorsys.hsv_to_rgb(h,min(1,s*1.08),v)
    colour = tuple(srgb_to_linear(c) for c in rgb)
    set_material_colour(mat,colour)
    emission = bsdf.inputs.get('Emission Color')
    if emission is None:
        emission = bsdf.inputs.get('Emission')
    if emission is not None:
        emission.default_value = (*colour,1)
    if 'Brass' in original.name or 'Gear_Steel' in original.name:
        bsdf.inputs['Metallic'].default_value = .25
        bsdf.inputs['Roughness'].default_value = .5
    return mat


def polish_materials_and_rocks(mapping):
    converted,grass_materials,done_meshes = {},{},set()
    for original,duplicate in mapping.items():
        if original.type != 'MESH':
            continue
        mesh = duplicate.data
        if mesh not in done_meshes:
            # Read source slots, not partially remapped duplicate slots.
            for i,mat in enumerate(tuple(original.data.materials)):
                if mat is None:
                    continue
                if mat not in converted:
                    converted[mat] = richer_material(mat)
                mesh.materials[i] = converted[mat]
            done_meshes.add(mesh)
        if 'SW01_Grass_Cap' in original.name:
            subject = subject_for(original)
            colour = hex_colour(GRASS_COLOURS[subject])
            for i in range(len(mesh.materials)):
                key = (subject,i)
                if key not in grass_materials:
                    mat = mesh.materials[i].copy()
                    mat.name = "SW12_Grass_"+subject+('_Top' if i == 0 else '_Edge')
                    mat['study_world_owner'] = OWNER
                    set_material_colour(mat,colour if i == 0 else tuple(c*.65 for c in colour))
                    grass_materials[key] = mat
                mesh.materials[i] = grass_materials[key]
        if 'SW01_Rock_Underside' in original.name:
            index = SUBJECT_ORDER.index(subject_for(original))
            for vertex in mesh.vertices:
                vertex.co = rock_position(*vertex.co,index)
            mesh.update()


def area_light(name,position,energy,size,colour,stage):
    data = bpy.data.lights.new(name,'AREA')
    data.energy,data.size,data.color = energy,size,colour
    obj = bpy.data.objects.new(name,data)
    attach(obj,name,stage)
    obj.location = position
    aim(obj,(0,0,0))


def make_lighting(scene,stage):
    world = bpy.data.worlds.get('SW12_Ambient') or bpy.data.worlds.new('SW12_Ambient')
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (*hex_colour('cfdef0'),1)
    bg.inputs['Strength'].default_value = .35
    scene.world = world
    data = bpy.data.lights.new('SW12_Warm_Sun','SUN')
    data.energy,data.angle,data.color = 1.7,math.radians(12),(1.0,.91,.80)
    sun = bpy.data.objects.new(data.name,data)
    attach(sun,sun.name,stage)
    sun.rotation_euler = (math.radians(28),math.radians(-25),math.radians(-30))
    area_light('SW12_Soft_Fill',(-16,-8,22),10000,25,(.73,.85,1),stage)
    area_light('SW12_Warm_Rim',(10,18,24),8500,20,(1,.87,.70),stage)


def frame_camera(scene,camera,geometry):
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    inverse = camera.matrix_world.inverted()
    points = []
    # Evaluated bounds include fresh rock edits and all clouds, not stale caches.
    for obj in tuple(geometry.objects):
        if obj.type == 'MESH':
            evaluated = obj.evaluated_get(depsgraph)
            for corner in evaluated.bound_box:
                p = inverse @ (evaluated.matrix_world @ Vector(corner))
                points.append((p.x,p.y))
    aspect = scene.render.resolution_x/scene.render.resolution_y
    cx,cy,width = frame_parameters(points,aspect,FRAME_PADDING)
    matrix = camera.matrix_world.copy()
    matrix.translation += matrix.to_3x3() @ Vector((cx,cy,0))
    camera.matrix_world = matrix
    camera.data.sensor_fit = 'HORIZONTAL'
    camera.data.ortho_scale = width
    return width,width/aspect


def sky_backdrop(camera,width,height,stage):
    # Orthographic world rays are parallel; a world-only direction gradient would
    # look flat. A camera-facing emissive plane gives a real vertical gradient.
    mesh = bpy.data.meshes.new('SW12_Sky_Backdrop_Mesh')
    mesh.from_pydata([(-width*.6,-height*.6,0),(width*.6,-height*.6,0),
                      (width*.6,height*.6,0),(-width*.6,height*.6,0)],[],[(0,1,2,3)])
    mesh.update()
    obj = bpy.data.objects.new('SW12_Sky_Backdrop_PRESENTATION_ONLY',mesh)
    attach(obj,obj.name,stage,root=camera)
    obj.location = (0,0,-160)
    obj['presentation_only'] = True
    mat = bpy.data.materials.new('SW12_Gradient_Sky')
    mat['study_world_owner'] = OWNER
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*hex_colour('f3e3ce'),1)
    ramp.color_ramp.elements[1].color = (*hex_colour('b4d9ed'),1)
    ramp.color_ramp.interpolation = 'EASE'
    coords = nodes.new('ShaderNodeTexCoord')
    separate = nodes.new('ShaderNodeSeparateXYZ')
    links = mat.node_tree.links
    links.new(coords.outputs['Generated'],separate.inputs['Vector'])
    links.new(separate.outputs['Y'],ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'],emission.inputs['Color'])
    links.new(emission.outputs[0],output.inputs['Surface'])
    mesh.materials.append(mat)


def main():
    if bpy.app.version < (4,2,0):
        raise RuntimeError('Use Blender 4.2 or newer.')
    source,originals = load_preview()
    # Freeze these while Step 11 is active, NOT after switching to Step 12.
    frozen = capture_transforms(originals)
    camera_pose = source.camera.matrix_world.copy()
    scene = prepare_scene()
    # Remove only unused material copies owned by this generator from older runs.
    for mat in tuple(bpy.data.materials):
        if mat.get('study_world_owner') == OWNER and mat.users == 0:
            bpy.data.materials.remove(mat)
    geometry = collection('SW12_Polished_World_PREVIEW',scene)
    stage = collection('SW12_Presentation_DO_NOT_EXPORT',scene)
    mapping = copy_geometry(originals,geometry,frozen)
    validate_layout(mapping,frozen)
    polish_materials_and_rocks(mapping)
    make_lighting(scene,stage)
    camera_data = source.camera.data.copy()
    camera_data.name = 'SW12_Camera'
    camera = bpy.data.objects.new('SW12_Camera',camera_data)
    attach(camera,camera.name,stage)
    camera.matrix_world = camera_pose
    camera_data.type,camera_data.clip_end = 'ORTHO',500
    camera_data.dof.use_dof = False
    scene.camera = camera
    for engine in ('BLENDER_EEVEE','BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    else:
        raise RuntimeError('No supported Eevee engine found.')
    scene.render.resolution_x,scene.render.resolution_y = 2000,1500
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    # Look identifiers vary by Blender release; default AgX remains valid fallback.
    for look in ('AgX - Medium High Contrast','Medium High Contrast'):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    width,height = frame_camera(scene,camera,geometry)
    sky_backdrop(camera,width,height,stage)
    bpy.context.view_layer.update()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.shading.type = 'SOLID'
                space.shading.color_type = 'MATERIAL'
                space.overlay.show_overlays = False
                space.region_3d.view_perspective = 'CAMERA'
    print('STUDY WORLD: Polish complete. Approved placement and bridge anchors unchanged.')
    print('Step 11 and source assets remain unchanged; sky/lights are presentation only.')
    print('Save As: blender/source/study_world_polished.blend')
    print('Nothing was saved or exported automatically.')


if __name__ == '__main__':
    main()
