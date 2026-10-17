"""STUDY WORLD — STEP 11: FULL-WORLD PREVIEW

Run in Blender's Text Editor after saving Step 10's scenery kit.
Blender 4.2+ / 5.2 Eevee-compatible. No add-ons or internet required.
Loads missing collections from your saved checkpoints, never modifies disk files.
Creates a separate preview scene. No automatic saving/exporting.
Save As: blender/source/study_world_preview.blend

Six demo subjects plus two optional unassigned forest islands. This is an art
preview, not a fixed subject/topic limit or the website's final data model.
Plots show example progress states only; there are no website text labels here.
Reusable sources are retained separately from the assembled preview.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Matrix

SCENE_NAME = "Study World - Step 11"
OWNER = "study_world_step_11_v1"
SOURCE_FOLDER = r"C:\Users\kashif\Desktop\3d-world-study-planner\blender\source"
SHOW_UNASSIGNED_ISLANDS = True
SURFACE_Z = .24
OUTER_RADIUS = 13.5
OUTER_SCALE = .90
PLOT_STATES = ("strong","in_revision","ready_for_test","weak","not_started")
# Seven surrounding positions leave a clear visual gap around each base.
# Maths is central. Unassigned entries are examples, not reserved slots/limits.
OUTER_LAYOUT = (
    ("Reasoning",45,"SW04_Landmark_Reasoning_EXPORT"),
    ("English",-5,"SW05_Landmark_English_EXPORT"),
    ("Software",-55,"SW08_Landmark_Software_EXPORT"),
    ("GK",-105,"SW06_Landmark_GK_EXPORT"),
    ("DSA",-155,"SW07_Landmark_DSA_EXPORT"),
    ("Unassigned_01",155,None),
    ("Unassigned_02",105,None),
)
SOURCE_FILES = {
    "study_world_island_base.blend": ("SW01_Island_Base_EXPORT",),
    "study_world_topic_plots.blend": tuple("SW02_"+s+"_EXPORT" for s in PLOT_STATES),
    "study_world_maths_landmark.blend": ("SW03_Landmark_Maths_EXPORT",),
    "study_world_reasoning_landmark.blend": ("SW04_Landmark_Reasoning_EXPORT",),
    "study_world_english_landmark.blend": ("SW05_Landmark_English_EXPORT",),
    "study_world_gk_landmark.blend": ("SW06_Landmark_GK_EXPORT",),
    "study_world_dsa_landmark.blend": ("SW07_Landmark_DSA_EXPORT",),
    "study_world_software_landmark.blend": ("SW08_Landmark_Software_EXPORT",),
    "study_world_scenery_kit.blend": tuple("SW10_"+s+"_EXPORT" for s in
        ("Bridge","Tree_Round","Tree_Pine","Cloud","Rock_Cluster")),
}


def material(name, colour, emission=0):
    name = "SW11_" + name
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*colour, 1)
    bsdf.inputs["Roughness"].default_value = 0.70
    socket = bsdf.inputs.get("Emission Color")
    if socket is None:
        socket = bsdf.inputs.get("Emission")
    if socket is not None:
        socket.default_value = (*colour, 1)
    strength = bsdf.inputs.get("Emission Strength")
    if strength is not None:
        strength.default_value = emission
    return mat


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


def ico(name, position, scale, mat, coll, root):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=position)
    obj = attach(bpy.context.object, name, coll, mat, root)
    for v in obj.data.vertices:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
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


def load_sources():
    required = [name for names in SOURCE_FILES.values() for name in names]
    missing = {name for name in required if bpy.data.collections.get(name) is None}
    if missing:
        folder = Path(bpy.path.abspath(SOURCE_FOLDER)).expanduser()
        plan = [(folder/filename, tuple(n for n in names if n in missing))
                for filename,names in SOURCE_FILES.items()]
        plan = [(path,names) for path,names in plan if names]
        absent = [str(path) for path,names in plan if not path.is_file()]
        if absent:
            raise RuntimeError("Missing saved checkpoints:\n"+"\n".join(absent)
                +"\nSave these files in your blender/source folder or update SOURCE_FOLDER. "
                 "No previous preview or source models were deleted.")
        # Check every required library before appending or rebuilding the preview.
        for path,names in plan:
            with bpy.data.libraries.load(str(path),link=False) as (library,requested):
                absent = [name for name in names if name not in library.collections]
                if absent:
                    raise RuntimeError(str(path)+" does not contain: "+", ".join(absent)
                        +". Check that you saved the corresponding build script's result.")
        imported = bpy.data.scenes.new("Study World - World Source Library")
        imported["study_world_imported_sources"] = True
        for path,names in plan:
            with bpy.data.libraries.load(str(path),link=False) as (library,requested):
                # Blender changes this supplied list into Collection objects on exit.
                requested.collections = list(names)
            for coll in requested.collections:
                if coll is None:
                    raise RuntimeError("Could not append an asset from "+str(path))
                imported.collection.children.link(coll)
            print("STUDY WORLD: Loaded",", ".join(names),"from",path.name)
    sources = {}
    for name in required:
        coll = bpy.data.collections.get(name)
        if coll is None:
            raise RuntimeError("Missing asset collection: "+name)
        objects = list(coll.all_objects)
        if not any(o.type == 'MESH' for o in objects):
            raise RuntimeError("Asset has no meshes: "+name)
        if any(o.type not in {'MESH','EMPTY'} for o in objects):
            raise RuntimeError("Source asset contains an unexpected camera/light: "+name)
        # Sources except the raw island base must have a single placement root.
        if name != "SW01_Island_Base_EXPORT":
            top = [o for o in objects if o.parent not in objects]
            if len(top) != 1 or top[0].type != 'EMPTY':
                raise RuntimeError("Unexpected asset hierarchy: "+name
                                   +". Keep the original asset root from its build script.")
        sources[name] = coll
    return sources


def copy_asset(source,name,position,scale,destination):
    # Snapshot BEFORE creating/linking objects. Blender can invalidate the live
    # Collection.all_objects iterator when its object/collection caches change.
    originals = tuple(source.all_objects)
    if not originals or any(obj is None for obj in originals):
        raise RuntimeError("Cannot copy an empty or invalid source asset: " + source.name
                           + ". Reopen your saved checkpoint and run this script again.")
    wrapper = bpy.data.objects.new(name+"_PLACEMENT",None)
    attach(wrapper,wrapper.name,destination)
    wrapper.location = position
    wrapper.scale = (scale,scale,scale)
    wrapper.empty_display_size = .1
    wrapper["source_asset_collection"] = source.name
    mapping = {}
    for original in originals:
        duplicate = original.copy()
        # Share the source mesh for efficient scene instances. No geometry/material
        # is edited below. Make Single User before manually editing an instance.
        duplicate.name = name+"__"+original.name
        duplicate["study_world_owner"] = OWNER
        destination.objects.link(duplicate)
        duplicate.hide_viewport = False
        duplicate.hide_render = False
        mapping[original] = duplicate
    for original,duplicate in mapping.items():
        duplicate.matrix_basis = original.matrix_basis.copy()
        if original.parent in mapping:
            duplicate.parent = mapping[original.parent]
            duplicate.matrix_parent_inverse = original.matrix_parent_inverse.copy()
        else:
            duplicate.parent = wrapper
            duplicate.matrix_parent_inverse = Matrix.Identity(4)
            if original.type == 'EMPTY':
                # Remove Step 02/10 showcase offsets, not nested globe/book tilts.
                duplicate.matrix_basis = Matrix.Identity(4)
    return wrapper


def bridge_transform(start_centre,end_centre):
    dx,dy = end_centre[0]-start_centre[0],end_centre[1]-start_centre[1]
    distance = math.hypot(dx,dy)
    # Both anchors sit inside the conservative minimum grassy rim radius.
    start_inset,end_inset = 4.05,3.65
    length = distance-start_inset-end_inset
    if length <= 0:
        raise ValueError("Islands are too close for this bridge layout.")
    ux,uy = dx/distance,dy/distance
    a = (start_centre[0]+ux*start_inset,start_centre[1]+uy*start_inset)
    b = (end_centre[0]-ux*end_inset,end_centre[1]-uy*end_inset)
    midpoint = ((a[0]+b[0])/2,(a[1]+b[1])/2,SURFACE_Z)
    return midpoint,math.atan2(dy,dx),length/4.0


def fit_camera(camera,asset_collections,scene):
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    max_x,max_y = 0.0,0.0
    for coll in asset_collections:
        for obj in coll.all_objects:
            if obj.type != 'MESH':
                continue
            for corner in obj.bound_box:
                local = inverse @ (obj.matrix_world @ Vector(corner))
                max_x,max_y = max(max_x,abs(local.x)),max(max_y,abs(local.y))
    aspect = scene.render.resolution_x/scene.render.resolution_y
    camera.data.sensor_fit = 'HORIZONTAL'
    camera.data.ortho_scale = max(2*max_x,2*max_y*aspect)*1.12


def main():
    if bpy.app.version < (4,2,0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    sources = load_sources()
    scene = prepare_scene()
    terrain = collection("SW11_Islands_PREVIEW",scene)
    structures = collection("SW11_Landmarks_And_Plots_PREVIEW",scene)
    bridges = collection("SW11_Bridges_PREVIEW",scene)
    scenery = collection("SW11_Scenery_PREVIEW",scene)
    stage = collection("SW11_Presentation_DO_NOT_EXPORT",scene)
    path_mat = material("Path_Stone",(.72,.68,.57))
    layouts = [("Maths",0.0,0.0,1.0,"SW03_Landmark_Maths_EXPORT")]
    for name,degrees,landmark in OUTER_LAYOUT:
        if landmark is None and not SHOW_UNASSIGNED_ISLANDS:
            continue
        angle = math.radians(degrees)
        layouts.append((name,OUTER_RADIUS*math.cos(angle),
                        OUTER_RADIUS*math.sin(angle),OUTER_SCALE,landmark))
    for subject_index,(name,cx,cy,scale,landmark) in enumerate(layouts):
        base = copy_asset(sources["SW01_Island_Base_EXPORT"],"SW11_"+name+"_Island",
                          (cx,cy,0),1,terrain)
        # Scale only XY: all islands retain the same surface Z for level bridges.
        base.scale = (scale,scale,1)
        base.rotation_euler.z = subject_index*.71
        base["demo_subject"] = name
        base["is_unassigned"] = landmark is None
        if landmark:
            copy_asset(sources[landmark],"SW11_"+name+"_Landmark",
                       (cx,cy+.08,SURFACE_Z),.94,structures)
            count = 7 if name == "Maths" else 5
            radius = 2.75 if name == "Maths" else 2.52
            for i in range(count):
                angle = math.pi/2-i*2*math.pi/count
                state = PLOT_STATES[(i+subject_index)%len(PLOT_STATES)]
                plot = copy_asset(sources["SW02_"+state+"_EXPORT"],
                    "SW11_"+name+"_Topic_%02d"%(i+1),
                    (cx+radius*math.cos(angle),cy+radius*math.sin(angle),SURFACE_Z),
                    .72,structures)
                plot["demo_progress_state"] = state
            for i in range(24):
                angle = i*2*math.pi/24
                ico("SW11_"+name+"_Path_%02d"%i,
                    (cx+1.75*math.cos(angle),cy+1.75*math.sin(angle),SURFACE_Z+.025),
                    (.16,.13,.04),path_mat,scenery,None)
            # Trees go between plots, not on top of them or on the bridge landing.
            inward = math.atan2(-cy,-cx) if subject_index else None
            for i in (0,2):
                angle = math.pi/2-(i+.5)*2*math.pi/count
                if inward is not None and math.cos(angle-inward) > .85:
                    continue
                kind = "Tree_Round" if i == 0 else "Tree_Pine"
                copy_asset(sources["SW10_"+kind+"_EXPORT"],"SW11_"+name+"_"+kind,
                    (cx+3.3*math.cos(angle),cy+3.3*math.sin(angle),SURFACE_Z),.62,scenery)
        else:
            # Generic forest scenery only: these islands are NOT fixed new-subject slots.
            for i,(x,y,kind,size) in enumerate((
                (-.8,.4,"Tree_Round",1.15),(.8,.5,"Tree_Pine",1.25),
                (0,-.7,"Tree_Round",.85),(-1.7,-.8,"Tree_Pine",.75))):
                copy_asset(sources["SW10_"+kind+"_EXPORT"],
                    "SW11_"+name+"_Forest_%d"%i,(cx+x,cy+y,SURFACE_Z),size,scenery)
            copy_asset(sources["SW10_Rock_Cluster_EXPORT"],"SW11_"+name+"_Rocks",
                       (cx+1.45,cy-1,SURFACE_Z),1,scenery)
        if subject_index:
            position,rotation,stretch = bridge_transform((0,0),(cx,cy))
            bridge = copy_asset(sources["SW10_Bridge_EXPORT"],"SW11_Bridge_To_"+name,
                                position,1,bridges)
            bridge.rotation_euler.z = rotation
            bridge.scale.x = stretch
    # Low-lying clouds frame the world, not the interactive plot surfaces.
    for i,(x,y,z,size) in enumerate(((-17,-7,-2.4,2.2),(16,7,-2.5,2.5),
                                    (-5,17,-3.0,2.3),(7,-17,-2.6,2.0),
                                    (0,5,-4.0,1.8))):
        copy_asset(sources["SW10_Cloud_EXPORT"],"SW11_Cloud_%d"%i,
                   (x,y,z),size,scenery)

    camera_data = bpy.data.cameras.new("SW11_Camera")
    camera = bpy.data.objects.new("SW11_Camera",camera_data)
    attach(camera,camera.name,stage)
    camera.location = (33,-46,42)
    aim(camera,(0,0,-.3))
    camera_data.type = 'ORTHO'
    camera_data.clip_end = 500
    scene.camera = camera
    sunlight = bpy.data.lights.new("SW11_Sun",'SUN')
    sunlight.energy = 2.0
    sunlight.angle = math.radians(20)
    sun = bpy.data.objects.new(sunlight.name,sunlight)
    attach(sun,sun.name,stage)
    sun.rotation_euler = (math.radians(25),math.radians(-20),math.radians(-25))
    fill_data = bpy.data.lights.new("SW11_Fill",'AREA')
    fill_data.energy,fill_data.size = 9000,30
    fill_data.color = (.79,.86,1)
    fill = bpy.data.objects.new(fill_data.name,fill_data)
    attach(fill,fill.name,stage)
    fill.location = (-12,-5,22)
    aim(fill,(0,0,0))
    world = bpy.data.worlds.get("SW11_Pastel_Sky") or bpy.data.worlds.new("SW11_Pastel_Sky")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (.73,.82,.89,1)
    bg.inputs["Strength"].default_value = .55
    scene.world = world
    for engine in ('BLENDER_EEVEE','BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    else:
        raise RuntimeError("No supported Eevee engine found.")
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1500
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    fit_camera(camera,[terrain,structures,bridges,scenery],scene)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.shading.type = 'SOLID'
                space.shading.color_type = 'MATERIAL'
                space.overlay.show_overlays = False
                space.region_3d.view_perspective = 'CAMERA'
    print("STUDY WORLD: Full-world preview assembled:",len(layouts),"islands.")
    print("Demo data only: subjects/topic counts remain dynamic in the future app.")
    print("Save As: blender/source/study_world_preview.blend")
    print("No disk files were saved or exported automatically.")


if __name__ == "__main__":
    main()
