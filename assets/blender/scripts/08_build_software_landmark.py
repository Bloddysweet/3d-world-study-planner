"""STUDY WORLD — STEP 08: SOFTWARE DEVELOPMENT WORKSHOP

Run in Blender's Text Editor. Blender 4.2+; supports Blender 5.2 Eevee naming.
Creates a separate scene and leaves earlier scenes unchanged.
No add-ons, fonts, downloads, textures, automatic saving or exporting.
Save As: assets/blender/source/study_world_software_landmark.blend

A small open-front workshop with a computer, keyboard and decorative gears.
The screen markings are coloured geometry, not real text or an interactive UI.
All assets descend from SW08_Software_ROOT; platform bottom rests at Z=0.
"""
import bpy
import math
from mathutils import Vector

SCENE_NAME = "Study World - Step 08"
OWNER = "study_world_step_08_v1"


def material(name, colour, emission=0):
    name = "SW08_" + name
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


def cylinder(name, radius, depth, z, mat, coll, root, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                       depth=depth, location=(0, 0, z))
    return attach(bpy.context.object, name, coll, mat, root)


def mesh(name, vertices, faces, mat, coll, root):
    data = bpy.data.meshes.new(name + "_Mesh")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    return attach(obj, name, coll, mat, root)


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


def bar(name, location, dimensions, mat, coll, root):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = attach(bpy.context.object, name, coll, mat, root)
    for vertex in obj.data.vertices:
        vertex.co.x *= dimensions[0]
        vertex.co.y *= dimensions[1]
        vertex.co.z *= dimensions[2]
    return obj


def gear(name, centre, radius, mat, coll, root, teeth=12):
    # A solid toothed ring with a real central hole, no modifiers or booleans.
    n = teeth*4
    vertices = []
    for y in (-.035,.035):
        for inner in (False,True):
            for i in range(n):
                a = i*2*math.pi/n
                r = radius*.36 if inner else radius*(1 if i%4 in (1,2) else .82)
                vertices.append((centre[0]+r*math.cos(a),centre[1]+y,
                                 centre[2]+r*math.sin(a)))
    faces = []
    for i in range(n):
        j = (i+1)%n
        faces.extend([(i,j,n+j,n+i),
                      (2*n+i,3*n+i,3*n+j,2*n+j),
                      (i,2*n+i,2*n+j,j),
                      (n+i,n+j,3*n+j,3*n+i)])
    return mesh(name,vertices,faces,mat,coll,root)


def main():
    if bpy.app.version < (4,2,0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    asset = collection("SW08_Landmark_Software_EXPORT",scene)
    stage = collection("SW08_Presentation_DO_NOT_EXPORT",scene)
    root = bpy.data.objects.new("SW08_Software_ROOT",None)
    attach(root,root.name,asset)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .2
    root["asset_role"] = "subject_landmark"
    root["subject_theme"] = "software"
    stone = material("Warm_Stone",(.68,.65,.56))
    wood = material("Workshop_Wood",(.48,.30,.18))
    timber = material("Timber_Trim",(.67,.45,.27))
    wall = material("Wall_Cream",(.83,.75,.59))
    roof = material("Roof_Coral",(.74,.29,.22))
    dark = material("Computer_Case",(.19,.25,.29))
    screen = material("Screen",(.07,.18,.22))
    code = material("Code_Mint",(.35,.87,.67),.35)
    code_gold = material("Code_Gold",(.98,.71,.29),.2)
    keys = material("Keyboard_Keys",(.70,.74,.71))
    brass = material("Gear_Brass",(.88,.61,.24))
    steel = material("Gear_Steel",(.42,.57,.59))
    cylinder("SW08_Platform",1.20,.14,.07,stone,asset,root,20)
    bar("SW08_Back_Wall",(0,.48,.88),(1.44,.10,1.48),wall,asset,root)
    for i,x in enumerate((-.73,.73)):
        bar("SW08_Timber_Post_%d"%i,(x,.43,.90),(.12,.17,1.52),timber,asset,root)
    # Two pitched roof slabs meet at a central ridge.
    slope = .37
    half_width = .91
    length = math.hypot(half_width,slope)
    for side in (-1,1):
        obj = bar("SW08_Roof_%d"%side,(side*half_width/2,.35,1.64+slope/2),
                  (length,1.05,.085),roof,asset,root)
        obj.rotation_euler.y = side*math.atan2(slope,half_width)
    bar("SW08_Ridge_Cap",(0,.35,2.025),(.095,1.09,.085),timber,asset,root)
    bar("SW08_Workbench_Top",(0,-.32,.78),(1.45,.67,.10),wood,asset,root)
    for i,x in enumerate((-.59,.59)):
        bar("SW08_Workbench_Leg_%d"%i,(x,-.32,.45),(.12,.46,.62),timber,asset,root)
    bar("SW08_Monitor_Foot",(-.22,-.30,.85),(.36,.25,.04),dark,asset,root)
    bar("SW08_Monitor_Stem",(-.22,-.25,.96),(.075,.075,.20),dark,asset,root)
    bar("SW08_Monitor_Case",(-.22,-.25,1.23),(.74,.10,.48),dark,asset,root)
    bar("SW08_Monitor_Screen",(-.22,-.306,1.23),(.65,.014,.39),screen,asset,root)
    # Tiny code-like bars stay readable without fonts or image textures.
    for i,(width,indent) in enumerate(((.35,0),(.25,.05),(.40,.05),(.23,0))):
        x = -.49+indent+width/2
        bar("SW08_Code_Line_%d"%i,(x,-.316,1.35-i*.075),
            (width,.006,.018),code_gold if i==0 else code,asset,root)
    bar("SW08_Keyboard_Base",(-.20,-.51,.845),(.67,.18,.025),dark,asset,root)
    for row in range(3):
        for column in range(8):
            bar("SW08_Key_%d_%d"%(row,column),
                (-.47+column*.077,-.565+row*.052,.865),
                (.060,.035,.018),keys,asset,root)
    # Two decorative gears fixed to a short upright board at the bench's right.
    bar("SW08_Gear_Board",(.57,-.20,1.12),(.38,.09,.58),wood,asset,root)
    gear("SW08_Gear_Large",(.54,-.265,1.13),.21,brass,asset,root)
    gear("SW08_Gear_Small",(.73,-.267,1.38),.13,steel,asset,root,10)
    # Small workshop sign: a solid bracket symbol, not text.
    bar("SW08_Sign_Back",(0,.415,1.48),(.36,.025,.14),dark,asset,root)
    for i,x in enumerate((-.11,.11)):
        obj = bar("SW08_Sign_Mark_%d"%i,(x,.395,1.48),
                  (.025,.015,.09),code,asset,root)
        obj.rotation_euler.y = -.35 if i==0 else .35

    camera_data = bpy.data.cameras.new("SW08_Camera")
    camera = bpy.data.objects.new("SW08_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (3.3, -7, 3.6)
    aim(camera, (0, 0, 1.0))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 3.7
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -4, 6), 650, (1, .88, .73)),
        ("Fill", (-4, 1, 4), 450, (.76, .85, 1)),
        ("Rim", (2, 4, 5), 600, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW08_" + name, 'AREA')
        data.energy, data.size, data.color = power, 4, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW08_Sky") or bpy.data.worlds.new("SW08_Sky")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.70, .78, .86, 1)
    background.inputs["Strength"].default_value = .45
    scene.world = world
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    else:
        raise RuntimeError("No supported Eevee engine found.")
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.shading.type = 'SOLID'
                space.shading.color_type = 'MATERIAL'
                space.overlay.show_overlays = False
                space.region_3d.view_perspective = 'CAMERA'
    bpy.context.view_layer.update()
    print("STUDY WORLD: Software Development landmark built successfully.")
    print("All previous scenes are unchanged.")
    print("Save As: assets/blender/source/study_world_software_landmark.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
