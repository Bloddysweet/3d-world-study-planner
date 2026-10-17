"""STUDY WORLD — STEP 03: MATHS LANDMARK

Run from Blender's Text Editor. Blender 4.2+ / 5.2-compatible Eevee selection.
No add-ons, textures, network access, automatic saving or exporting.
Creates a separate scene, leaving island and plot scenes unchanged.
Save As: assets/blender/source/study_world_maths_landmark.blend

One reusable Maths landmark: faceted crystal obelisk and decorative abacus.
All geometry is parented to SW03_Maths_ROOT at the origin. Bottom rests at Z=0.
The later world assembler will place this asset on the island surface (Z=0.24).
"""
import bpy
import math
from mathutils import Vector

SCENE_NAME = "Study World - Step 03"
OWNER = "study_world_step_03_v1"


def material(name, colour, emission=0):
    name = "SW03_" + name
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


def bead(name, position, mat, coll, root):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6,
                                        radius=1, location=position)
    obj = attach(bpy.context.object, name, coll, mat, root)
    for vertex in obj.data.vertices:
        vertex.co.x *= .063
        vertex.co.y *= .105
        vertex.co.z *= .105
    return obj


def obelisk(mat, coll, root):
    vertices = []
    n = 6
    for radius, z in ((.24, .29), (.38, .55), (.30, 1.99)):
        for i in range(n):
            a = i * 2 * math.pi / n + math.pi / 6
            vertices.append((radius*math.cos(a), .34 + radius*math.sin(a), z))
    vertices.append((.04, .31, 2.57))
    faces = [tuple(reversed(range(n)))]
    for layer in range(2):
        for i in range(n):
            j = (i + 1) % n
            faces.append((layer*n+i, layer*n+j, (layer+1)*n+j, (layer+1)*n+i))
    for i in range(n):
        faces.append((2*n+i, 2*n+(i+1)%n, 3*n))
    return mesh("SW03_Maths_Obelisk", vertices, faces, mat, coll, root)


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    asset = collection("SW03_Landmark_Maths_EXPORT", scene)
    stage = collection("SW03_Presentation_DO_NOT_EXPORT", scene)
    root = bpy.data.objects.new("SW03_Maths_ROOT", None)
    attach(root, root.name, asset)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .2
    root["asset_role"] = "subject_landmark"
    root["subject_theme"] = "maths"

    stone = material("Warm_Stone", (.68, .65, .56))
    pale = material("Pedestal", (.84, .81, .70))
    blue = material("Crystal_Blue", (.24, .52, .91), .25)
    wood = material("Abacus_Wood", (.36, .20, .12))
    brass = material("Abacus_Rods", (.68, .49, .22))
    coral = material("Bead_Coral", (.91, .37, .27))
    gold = material("Bead_Gold", (.95, .66, .20))
    mint = material("Bead_Mint", (.29, .64, .49))
    bead_blue = material("Bead_Blue", (.30, .52, .84))

    cylinder("SW03_Platform", 1.10, .12, .06, stone, asset, root, 16)
    base = cylinder("SW03_Obelisk_Pedestal", .49, .17, .205, pale, asset, root, 6)
    base.location.y = .34
    obelisk(blue, asset, root)

    # A decorative four-row abacus in front of the obelisk; not a live counter.
    front = -.62
    for side in (-1, 1):
        bar("SW03_Abacus_Post_" + str(side), (side*.70, front, .75),
            (.13, .17, 1.20), wood, asset, root)
        bar("SW03_Abacus_Foot_" + str(side), (side*.70, front, .18),
            (.27, .38, .12), wood, asset, root)
    for z in (.24, 1.31):
        bar("SW03_Abacus_Frame_" + str(z), (0, front, z),
            (1.50, .18, .12), wood, asset, root)
    for row, (count, mat) in enumerate(zip((3, 5, 2, 4), (coral, gold, mint, bead_blue))):
        z = .43 + row * .245
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=.022, depth=1.30,
                                           location=(0, front, z),
                                           rotation=(0, math.pi/2, 0))
        attach(bpy.context.object, "SW03_Abacus_Rod_%d" % row, asset, brass, root)
        for i in range(count):
            bead("SW03_Abacus_Bead_%d_%d" % (row, i),
                 (-.52 + i*.14, front, z), mat, asset, root)

    # Three small maths-blue stones add a little colour at the obelisk base.
    for i, (x, y, height) in enumerate(((-.59, .27, .32), (.56, .44, .24), (.28, .78, .22))):
        ico("SW03_Crystal_Shard_%d" % i, (x, y, .12 + height*.85),
            (.11, .12, height), blue, asset, root)

    camera_data = bpy.data.cameras.new("SW03_Camera")
    camera = bpy.data.objects.new("SW03_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (4.5, -7, 4.0)
    aim(camera, (0, 0, 1.12))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 4.5
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -4, 6), 650, (1, .88, .73)),
        ("Fill", (-4, 1, 4), 450, (.76, .85, 1)),
        ("Rim", (2, 4, 5), 600, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW03_" + name, 'AREA')
        data.energy, data.size, data.color = power, 4, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW03_Sky") or bpy.data.worlds.new("SW03_Sky")
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
    print("STUDY WORLD: Maths landmark built successfully.")
    print("Island and topic plot scenes are unchanged.")
    print("Save As: assets/blender/source/study_world_maths_landmark.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
