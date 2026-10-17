"""STUDY WORLD — STEP 02: FIVE TOPIC PLOT STATES

Open your saved island .blend, then run this script in Blender's Text Editor.
Creates a SEPARATE scene; never changes the island scene.
Blender 4.2+ including the Blender 5.2 Eevee identifier.
No add-ons, textures, downloads, automatic saving or exporting.
Save As: study_world_topic_plots.blend (keeps the island scene in this file too).

Five root empties are arranged for inspection. Each plot's geometry is in local
coordinates around its root, so a future exporter can export it at the origin.
Emission is included, but a visible bloom halo is not added here.
"""
import bpy
import math
import random
from mathutils import Vector

SCENE_NAME = "Study World - Step 02"
OWNER = "study_world_step_02_v1"
STATES = [
    ("not_started", (0.20, 0.23, 0.29), 0.0, 0),
    ("in_revision", (0.20, 0.48, 0.92), 0.35, 3),
    ("ready_for_test", (1.00, 0.65, 0.13), 0.65, 4),
    ("strong", (0.23, 0.77, 0.48), 0.55, 8),
    ("weak", (1.00, 0.32, 0.12), 0.30, 1),
]


def material(name, colour, emission=0):
    name = "SW02_" + name
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


def crystal(name, mat, coll, root):
    # Opaque faceted crystal: no transparent/glass materials needed in browser.
    vertices = []
    n = 6
    for radius, z in ((0.15, 0.29), (0.24, 0.48), (0.19, 0.93)):
        for i in range(n):
            a = i * 2 * math.pi / n
            vertices.append((radius * math.cos(a), radius * math.sin(a), z))
    tip = len(vertices)
    vertices.append((0.035, -0.025, 1.23))
    faces = [tuple(reversed(range(n)))]
    for layer in range(2):
        for i in range(n):
            j = (i + 1) % n
            faces.append((layer*n+i, layer*n+j, (layer+1)*n+j, (layer+1)*n+i))
    for i in range(n):
        faces.append((2*n+i, 2*n+(i+1)%n, tip))
    return mesh(name, vertices, faces, mat, coll, root)


def plant(name, x, y, flower, green, petal, gold, coll, root):
    z = 0.13
    # Crossed low-poly leaves and stem, no curves or external assets.
    mesh(name + "_Leaves", [
        (x-.09, y, z), (x+.09, y, z), (x, y, z+.23),
        (x, y-.08, z), (x, y+.08, z), (x, y, z+.20),
    ], [(0, 1, 2), (3, 4, 5)], green, coll, root)
    if flower:
        for i in range(5):
            a = i * 2 * math.pi / 5
            ico(name + "_Petal_%d" % i,
                (x+.065*math.cos(a), y+.065*math.sin(a), z+.24),
                (.065, .065, .035), petal, coll, root)
        ico(name + "_Centre", (x, y, z+.26), (.042, .042, .03), gold, coll, root)


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


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    stone = material("Stone", (.58, .55, .49))
    soil = material("Soil", (.30, .20, .15))
    pedestal = material("Pedestal", (.72, .69, .61))
    green = material("Leaves", (.26, .49, .20))
    petal = material("Petals", (1.0, .64, .73))
    gold = material("Flower_Centre", (1.0, .74, .19))
    for index, (state, colour, glow, plant_count) in enumerate(STATES):
        prefix = "SW02_" + state
        coll = collection(prefix + "_EXPORT", scene)
        root = bpy.data.objects.new(prefix + "_ROOT", None)
        attach(root, root.name, coll)
        root.empty_display_type = 'PLAIN_AXES'
        root.empty_display_size = .15
        root.location = ((index - 2) * 2.05, 0, 0)
        root["asset_role"] = "topic_plot"
        root["progress_state"] = state
        crystal_mat = material("Crystal_" + state, colour, glow)
        cylinder(prefix + "_Stone_Base", .77, .10, .05, stone, coll, root, 20)
        cylinder(prefix + "_Soil", .65, .055, .115, soil, coll, root, 20)
        cylinder(prefix + "_Pedestal", .29, .16, .21, pedestal, coll, root, 8)
        crystal(prefix + "_Crystal", crystal_mat, coll, root)
        # Status-coloured marker: visible even without rendered emission.
        ico(prefix + "_Marker", (0, -.66, .16), (.13, .07, .07), crystal_mat, coll, root)
        rng = random.Random(100 + index)
        for i in range(plant_count):
            a = 2 * math.pi * i / max(plant_count, 1) + .3
            r = rng.uniform(.43, .53)
            plant(prefix + "_Plant_%02d" % i, r*math.cos(a), r*math.sin(a),
                  state == "strong", green, petal, gold, coll, root)

    stage = collection("SW02_Presentation_DO_NOT_EXPORT", scene)
    camera_data = bpy.data.cameras.new("SW02_Camera")
    camera = bpy.data.objects.new("SW02_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (1.2, -12, 9)
    aim(camera, (0, 0, .35))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 11.4
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (0, -4, 7), 1300, (1, .88, .73)),
        ("Fill", (-5, 2, 5), 1000, (.76, .85, 1)),
    ]:
        data = bpy.data.lights.new("SW02_" + name, 'AREA')
        data.energy, data.size, data.color = power, 6, colour
        obj = bpy.data.objects.new(data.name, data)
        attach(obj, obj.name, stage)
        obj.location = pos
        aim(obj, (0, 0, .3))
    world = bpy.data.worlds.get("SW02_Sky") or bpy.data.worlds.new("SW02_Sky")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (.70, .78, .86, 1)
    bg.inputs["Strength"].default_value = .5
    scene.world = world
    for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    else:
        raise RuntimeError("No supported Eevee engine found.")
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 700
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
    print("STUDY WORLD: Five topic plot states built successfully.")
    print("Left to right: Not started / In revision / Ready for test / Strong / Weak")
    print("Save As: assets/blender/source/study_world_topic_plots.blend")
    print("The island scene is unchanged. Nothing has been saved automatically.")


if __name__ == "__main__":
    main()
