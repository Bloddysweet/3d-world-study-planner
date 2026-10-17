"""STUDY WORLD — STEP 07: DSA NODE-TREE LANDMARK

Run in Blender's Text Editor. Blender 4.2+; supports Blender 5.2 Eevee naming.
Creates a separate scene, preserving previous scenes. No automatic saves/exports.
No add-ons, downloads, fonts, or image textures required.
Save As: assets/blender/source/study_world_dsa_landmark.blend

A stylized upward-growing binary tree: seven green nodes and six branch edges.
The short support trunk is scenery, not an extra graph edge.
All asset geometry descends from SW07_DSA_ROOT; platform bottom is at Z=0.
Emission is included, but no bloom halo/compositor effect is added.
"""
import bpy
import math
from mathutils import Vector

SCENE_NAME = "Study World - Step 07"
OWNER = "study_world_step_07_v1"

# Graph root is at the bottom: the diagram grows like a real tree.
NODE_POSITIONS = [
    (0, 0, .65),
    (-.46, .02, 1.27), (.46, .02, 1.27),
    (-.91, .04, 1.94), (-.27, .06, 2.13),
    (.27, .06, 2.13), (.91, .04, 1.94),
]
EDGES = [(0,1), (0,2), (1,3), (1,4), (2,5), (2,6)]


def material(name, colour, emission=0):
    name = "SW07_" + name
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


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    asset = collection("SW07_Landmark_DSA_EXPORT", scene)
    stage = collection("SW07_Presentation_DO_NOT_EXPORT", scene)
    root = bpy.data.objects.new("SW07_DSA_ROOT", None)
    attach(root, root.name, asset)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .2
    root["asset_role"] = "subject_landmark"
    root["subject_theme"] = "dsa"
    stone = material("Warm_Stone", (.68,.65,.56))
    soil = material("Garden_Soil", (.36,.28,.18))
    wood = material("Branch_Wood", (.33,.23,.13))
    moss = material("Branch_Moss", (.30,.46,.20))
    nodes = material("Node_Green", (.22,.70,.35), .45)
    tips = material("Leaf_Node_Mint", (.39,.83,.50), .55)
    gold = material("Node_Core_Gold", (.91,.69,.20), .15)
    leaf = material("Leaves", (.29,.53,.22))
    cylinder("SW07_Platform", 1.18, .14, .07, stone, asset, root, 20)
    cylinder("SW07_Garden", 1.04, .035, .1575, soil, asset, root, 20)
    cylinder("SW07_Tree_Collar", .24, .10, .225, moss, asset, root, 12)
    connection("SW07_Support_Trunk", (0,0,.22), NODE_POSITIONS[0],
               .09, wood, asset, root)
    for i, (parent, child) in enumerate(EDGES):
        connection("SW07_Branch_%02d" % i, NODE_POSITIONS[parent],
                   NODE_POSITIONS[child], .052, wood, asset, root)
    for i, position in enumerate(NODE_POSITIONS):
        size = .19 if i == 0 else (.17 if i < 3 else .145)
        obj = ico("SW07_Node_%02d" % i, position, (size,size,size),
                  nodes if i < 3 else tips, asset, root)
        obj["graph_node_index"] = i
        # A small gold face marker on each non-leaf node, facing the camera side.
        if i < 3:
            ico("SW07_Node_Core_%02d" % i,
                (position[0], position[1]-size*.88, position[2]),
                (.045,.035,.045), gold, asset, root)

    # Small decorative leaves sit to the outside of the diagram.
    for i, (x, y, z) in enumerate(((-.78,.04,1.62),(.78,.04,1.62),
                                  (-.16,.05,1.78),(.16,.05,1.78))):
        obj = ico("SW07_Leaf_%02d" % i, (x,y,z), (.16,.055,.065), leaf, asset, root)
        obj.rotation_euler.y = -.45 if x < 0 else .45
    # Root-like supports are scenery, kept distinct from the graph branches.
    for i in range(5):
        angle = 2*math.pi*i/5
        connection("SW07_Root_Support_%02d" % i, (0,0,.30),
                   (.36*math.cos(angle),.36*math.sin(angle),.18),
                   .035, wood, asset, root)

    camera_data = bpy.data.cameras.new("SW07_Camera")
    camera = bpy.data.objects.new("SW07_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (2.8, -8, 3.6)
    aim(camera, (0, 0, 1.08))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 3.8
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -4, 6), 650, (1, .88, .73)),
        ("Fill", (-4, 1, 4), 450, (.76, .85, 1)),
        ("Rim", (2, 4, 5), 600, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW07_" + name, 'AREA')
        data.energy, data.size, data.color = power, 4, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW07_Sky") or bpy.data.worlds.new("SW07_Sky")
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
    print("STUDY WORLD: DSA landmark built successfully.")
    print("All previous scenes are unchanged.")
    print("Save As: assets/blender/source/study_world_dsa_landmark.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
