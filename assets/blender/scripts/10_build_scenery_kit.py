"""STUDY WORLD — STEP 10: BRIDGE AND SCENERY KIT

Run inside Blender's Text Editor. Blender 4.2+; supports 5.2 Eevee naming.
Creates a separate scene without changing earlier models. No source files needed.
No add-ons, downloads, textures, automatic saves or exports.
Save As: blender/source/study_world_scenery_kit.blend

Five export collections, each with its own placement root. Their showcase offsets
are NOT part of the intended reusable asset: reset the root before export.
Bridge spans 4 m along X. Its endpoints' deck surfaces are at local Z=0.
The deck sags 0.18 m; the two tree bases and rock cluster rest at local Z=0.
Cloud is deliberately floating. No text labels or baked sky are included.
"""
import bpy
import math
from mathutils import Vector

SCENE_NAME = "Study World - Step 10"
OWNER = "study_world_step_10_v1"
BRIDGE_SPAN = 4.0
BRIDGE_SAG = .18
BOARD_COUNT = 18


def material(name, colour, emission=0):
    name = "SW10_" + name
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


def bar(name, location, dimensions, mat, coll, root):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = attach(bpy.context.object, name, coll, mat, root)
    for vertex in obj.data.vertices:
        vertex.co.x *= dimensions[0]
        vertex.co.y *= dimensions[1]
        vertex.co.z *= dimensions[2]
    return obj


def connection(name, start, end, radius, mat, coll, root):
    start, end = Vector(start), Vector(end)
    direction = end-start
    if direction.length < .0001:
        raise ValueError("Branch endpoints must be different.")
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius,
        depth=direction.length, location=(start+end)/2)
    obj = attach(bpy.context.object, name, coll, mat, root)
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    return obj


def asset_root(scene, name, position):
    coll = collection("SW10_"+name+"_EXPORT",scene)
    root = bpy.data.objects.new("SW10_"+name+"_ROOT",None)
    attach(root,root.name,coll)
    root.location = position
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .14
    root["asset_role"] = "scenery"
    root["scenery_kind"] = name.lower()
    return coll,root


def deck_height(x):
    return -BRIDGE_SAG*(1-(2*x/BRIDGE_SPAN)**2)


def main():
    if bpy.app.version < (4,2,0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    wood = material("Bridge_Wood",(.48,.30,.17))
    wood_light = material("Bridge_Wood_Light",(.60,.39,.23))
    rope = material("Bridge_Rope",(.69,.56,.36))
    bark = material("Tree_Bark",(.35,.24,.14))
    green = material("Tree_Green",(.34,.56,.27))
    mint = material("Tree_Mint",(.48,.65,.35))
    cloud = material("Cloud_Cream",(.91,.91,.85))
    stone = material("Rock",(.57,.55,.49))

    coll,root = asset_root(scene,"Bridge",(0,-1.55,0))
    root["asset_role"] = "bridge"
    root["span_metres"] = BRIDGE_SPAN
    root["endpoint_surface_z"] = 0.0
    for i in range(BOARD_COUNT):
        x = -BRIDGE_SPAN/2+(i+.5)*BRIDGE_SPAN/BOARD_COUNT
        obj = bar("SW10_Plank_%02d"%i,(x,0,deck_height(x)-.03),
                  (BRIDGE_SPAN/BOARD_COUNT*.93,1.02,.06),
                  wood if i%2 else wood_light,coll,root)
        # Align each board to the slope of the sagging deck.
        derivative = 8*BRIDGE_SAG*x/(BRIDGE_SPAN**2)
        obj.rotation_euler.y = -math.atan(derivative)
    for x in (-BRIDGE_SPAN/2,BRIDGE_SPAN/2):
        for y in (-.55,.55):
            connection("SW10_End_Post_%s_%s"%(x,y),(x,y,-.06),(x,y,.66),
                       .055,wood,coll,root)
    # Two ropes per side, segmented cylinders instead of Blender-only curves.
    for side in (-1,1):
        y = side*.55
        for rail,height in enumerate((.29,.58)):
            for i in range(BOARD_COUNT):
                x0 = -BRIDGE_SPAN/2+i*BRIDGE_SPAN/BOARD_COUNT
                x1 = -BRIDGE_SPAN/2+(i+1)*BRIDGE_SPAN/BOARD_COUNT
                connection("SW10_Rope_%d_%d_%02d"%(side,rail,i),
                           (x0,y,deck_height(x0)+height),
                           (x1,y,deck_height(x1)+height),.018,rope,coll,root)
        for i in range(2,BOARD_COUNT,3):
            x = -BRIDGE_SPAN/2+(i+.5)*BRIDGE_SPAN/BOARD_COUNT
            z = deck_height(x)
            connection("SW10_Hanger_%d_%02d"%(side,i),
                       (x,y,z+.015),(x,y,z+.58),.012,rope,coll,root)

    coll,root = asset_root(scene,"Tree_Round",(-2.7,1.25,0))
    connection("SW10_Round_Trunk",(0,0,0),(0,0,1.10),.10,bark,coll,root)
    for i,(position,scale) in enumerate([
        ((0,0,1.24),(.54,.48,.55)),
        ((-.32,.04,1.12),(.34,.34,.36)),
        ((.30,.03,1.22),(.34,.32,.40)),
    ]):
        ico("SW10_Round_Canopy_%d"%i,position,scale,green if i%2 else mint,coll,root)

    coll,root = asset_root(scene,"Tree_Pine",(-.95,1.25,0))
    connection("SW10_Pine_Trunk",(0,0,0),(0,0,1.40),.08,bark,coll,root)
    for i,(z,radius,height) in enumerate(((.64,.52,.72),(1.00,.41,.70),(1.34,.29,.66))):
        bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=radius,radius2=0,
                                       depth=height,location=(0,0,z))
        attach(bpy.context.object,"SW10_Pine_Canopy_%d"%i,coll,
               green if i%2 else mint,root)

    coll,root = asset_root(scene,"Cloud",(1.0,1.25,.55))
    for i,(position,scale) in enumerate([
        ((0,0,0),(.55,.35,.27)),
        ((-.43,0,-.06),(.38,.29,.21)),
        ((.43,0,-.04),(.38,.28,.22)),
        ((-.12,.02,.18),(.32,.29,.30)),
    ]):
        ico("SW10_Cloud_Puff_%d"%i,position,scale,cloud,coll,root)

    coll,root = asset_root(scene,"Rock_Cluster",(2.8,1.25,0))
    for i,(x,y,sx,sy,sz) in enumerate(((-.20,.08,.36,.29,.32),
                                      (.24,.04,.24,.24,.21),(.02,-.22,.19,.16,.16))):
        # Normalize the ico's lowest vertex so each stone rests exactly on Z=0.
        obj = ico("SW10_Scenery_Rock_%d"%i,(x,y,0),(sx,sy,sz),stone,coll,root)
        obj.location.z = -min(vertex.co.z for vertex in obj.data.vertices)

    stage = collection("SW10_Presentation_DO_NOT_EXPORT",scene)
    camera_data = bpy.data.cameras.new("SW10_Camera")
    camera = bpy.data.objects.new("SW10_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (6, -10, 9)
    aim(camera, (0, 0, .45))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 9.0
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -4, 6), 650, (1, .88, .73)),
        ("Fill", (-4, 1, 4), 450, (.76, .85, 1)),
        ("Rim", (2, 4, 5), 600, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW10_" + name, 'AREA')
        data.energy, data.size, data.color = power, 4, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW10_Sky") or bpy.data.worlds.new("SW10_Sky")
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
    scene.render.resolution_x = 1500
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
    print("STUDY WORLD: Bridge and scenery kit built successfully.")
    print("All previous scenes are unchanged.")
    print("Save As: blender/source/study_world_scenery_kit.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
