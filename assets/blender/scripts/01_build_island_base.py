"""STUDY WORLD — STEP 01: FLOATING ISLAND BASE

Run inside Blender's Text Editor (Scripting > Text > Open > Run Script).
Requires Blender 4.2 or newer. Uses no downloads, add-ons or textures.
Creates a separate scene; leaves existing scenes and their objects untouched.
Run again to rebuild ONLY this script's scene. If you have added your own
objects to that scene, rebuilding stops rather than deleting your work.
Does NOT save or overwrite files. Save As: study_world_island_base.blend

The flat grass surface is Z = 0.24 metres. Island radius is about 4.6 m.
Keep the centre empty: later scripts will place landmarks and topic plots.
Camera/lights live outside the exportable asset collection.
"""
import bpy
import math
import random
from mathutils import Vector

SCENE_NAME = "Study World - Step 01"
OWNER = "study_world_step_01_v1"
SEED = 42
SURFACE_Z = 0.24
SEGMENTS = 20


def material(name, colour, roughness=0.85):
    # Namespaced materials are reused on repeated runs, never global materials.
    name = "SW01_" + name
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def own(obj, collection):
    obj["study_world_owner"] = OWNER
    # Explicitly link to our collection, not an arbitrary active collection.
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mesh_object(name, vertices, faces, materials, indices, collection):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["study_world_owner"] = OWNER
    for mat in materials:
        mesh.materials.append(mat)
    for polygon, index in zip(mesh.polygons, indices):
        polygon.material_index = index
        polygon.use_smooth = False
    return obj


def ring_mesh(name, rings, outline, materials, collection, rng, grass=False):
    # rings: (radius multiplier, Z), ordered bottom to top.
    vertices = []
    for radius, z in rings:
        for i, wobble in enumerate(outline):
            angle = 2 * math.pi * i / SEGMENTS
            vertices.append((4.6 * radius * wobble * math.cos(angle),
                             4.6 * radius * wobble * math.sin(angle), z))
    faces, indices = [], []
    faces.append(tuple(reversed(range(SEGMENTS))))
    indices.append(0)
    for layer in range(len(rings) - 1):
        for i in range(SEGMENTS):
            j = (i + 1) % SEGMENTS
            a, b = layer * SEGMENTS + i, layer * SEGMENTS + j
            c, d = (layer + 1) * SEGMENTS + j, (layer + 1) * SEGMENTS + i
            if grass:
                faces.append((a, b, c, d))
                indices.append(1)
            else:
                faces.extend(((a, b, d), (b, c, d)))
                indices.extend((rng.randrange(len(materials)), rng.randrange(len(materials))))
    # Triangular fan gives a perfectly flat, reliable top surface.
    centre = len(vertices)
    vertices.append((0, 0, rings[-1][1]))
    start = (len(rings) - 1) * SEGMENTS
    for i in range(SEGMENTS):
        faces.append((start + i, start + (i + 1) % SEGMENTS, centre))
        indices.append(0 if grass else rng.randrange(len(materials)))
    return mesh_object(name, vertices, faces, materials, indices, collection)


def ico(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=location)
    obj = own(bpy.context.object, collection)
    obj.name = name
    # Bake scale into the mesh to keep exported transforms simple.
    for vertex in obj.data.vertices:
        vertex.co.x *= scale[0]
        vertex.co.y *= scale[1]
        vertex.co.z *= scale[2]
    obj.data.materials.append(mat)
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area_light(name, position, energy, size, colour, collection):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    data.color = colour
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj["study_world_owner"] = OWNER
    obj.location = position
    aim(obj, (0, 0, -0.5))
    return obj


def prepare_scene():
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene:
        if scene.get("study_world_owner") != OWNER:
            raise RuntimeError("A scene already has our name but is not owned by this script. Rename it first.")
        foreign = [obj.name for obj in scene.objects if obj.get("study_world_owner") != OWNER]
        if foreign:
            raise RuntimeError("Rebuild stopped to protect objects you added: " + ", ".join(foreign)
                               + ". Move them to another scene, or rename this scene before rebuilding.")
        for obj in list(scene.objects):
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data and data.users == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
                elif isinstance(data, bpy.types.Light):
                    bpy.data.lights.remove(data)
                elif isinstance(data, bpy.types.Camera):
                    bpy.data.cameras.remove(data)
        # Only remove collections owned by this generator.
        for coll in list(scene.collection.children):
            if coll.get("study_world_owner") == OWNER:
                bpy.data.collections.remove(coll)
    else:
        scene = bpy.data.scenes.new(SCENE_NAME)
        scene["study_world_owner"] = OWNER
    if bpy.context.window is None:
        raise RuntimeError("Run this script with a Blender window/context available.")
    bpy.context.window.scene = scene
    return scene


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("This script requires Blender 4.2 or newer.")
    scene = prepare_scene()
    rng = random.Random(SEED)
    asset = bpy.data.collections.new("SW01_Island_Base_EXPORT")
    stage = bpy.data.collections.new("SW01_Presentation_DO_NOT_EXPORT")
    for coll in (asset, stage):
        coll["study_world_owner"] = OWNER
        scene.collection.children.link(coll)

    grass = material("Grass_Top", (0.43, 0.65, 0.31))
    grass_edge = material("Grass_Edge", (0.31, 0.49, 0.22))
    rocks = [material("Rock_" + str(i + 1), colour) for i, colour in enumerate([
        (0.37, 0.32, 0.35), (0.46, 0.39, 0.40), (0.53, 0.45, 0.43),
        (0.42, 0.36, 0.40), (0.61, 0.51, 0.45)])]
    pebble = material("Pebble", (0.65, 0.62, 0.53))
    sprout = material("Grass_Blade", (0.38, 0.57, 0.25))
    outline = [rng.uniform(0.93, 1.06) for _ in range(SEGMENTS)]

    rock = ring_mesh("SW01_Rock_Underside", [
        (0.10, -3.5), (0.39, -2.7), (0.70, -1.65), (0.94, -0.55), (0.98, 0.04)
    ], outline, rocks, asset, rng)
    rock["asset_role"] = "island_base"
    ring_mesh("SW01_Grass_Cap", [(0.98, 0.02), (1.0, SURFACE_Z)],
              outline, [grass, grass_edge], asset, rng, grass=True)

    # Small decorations stay at the rim; no fixed topic count or subject theme.
    for i in range(12):
        angle = 2 * math.pi * i / 12 + rng.uniform(-0.1, 0.1)
        radius = rng.uniform(3.75, 4.05)
        x, y = radius * math.cos(angle), radius * math.sin(angle)
        size = rng.uniform(0.13, 0.26)
        ico("SW01_Pebble_%02d" % (i + 1), (x, y, SURFACE_Z + size * 0.24),
            (size, size * 0.75, size * 0.65), pebble, asset)

    for i in range(18):
        angle = 2 * math.pi * (i + 0.35) / 18
        radius = rng.uniform(3.6, 4.02)
        x, y = radius * math.cos(angle), radius * math.sin(angle)
        vertices, faces = [], []
        for blade in range(3):
            a = angle + blade * math.pi / 3
            dx, dy = 0.06 * math.cos(a), 0.06 * math.sin(a)
            z = SURFACE_Z - 0.01
            start = len(vertices)
            vertices.extend([(x - dx, y - dy, z), (x + dx, y + dy, z),
                             (x + dx * 0.8, y + dy * 0.8, z + rng.uniform(0.16, 0.30))])
            faces.append((start, start + 1, start + 2))
        mesh_object("SW01_Grass_Tuft_%02d" % (i + 1), vertices, faces,
                    [sprout], [0] * len(faces), asset)

    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene["surface_z"] = SURFACE_Z
    scene["seed"] = SEED
    # Eevee's engine identifier differs between Blender releases.
    # Blender 5.2 uses BLENDER_EEVEE; older 4.x uses BLENDER_EEVEE_NEXT.
    for engine_id in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine_id
            break
        except TypeError:
            continue
    else:
        raise RuntimeError("No supported Eevee engine found in this Blender installation.")
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'

    world = bpy.data.worlds.get("SW01_Pastel_Sky") or bpy.data.worlds.new("SW01_Pastel_Sky")
    world.use_nodes = True
    world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.70, 0.78, 0.86, 1)
    world.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.45
    scene.world = world
    area_light("SW01_Sun_Key", (1, -6, 10), 1600, 7, (1.0, 0.85, 0.68), stage)
    area_light("SW01_Sky_Fill", (-7, -1, 4), 1000, 8, (0.73, 0.83, 1.0), stage)
    area_light("SW01_Rim", (3, 7, 6), 1800, 6, (1.0, 0.88, 0.73), stage)
    camera_data = bpy.data.cameras.new("SW01_Camera")
    camera = bpy.data.objects.new("SW01_Camera", camera_data)
    stage.objects.link(camera)
    camera["study_world_owner"] = OWNER
    camera.location = (11, -15, 10)
    aim(camera, (0, 0, -0.8))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 13.5
    camera_data.clip_end = 200
    scene.camera = camera

    # Show camera framing and material colours without requiring a render.
    if bpy.context.screen:
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type == 'VIEW_3D':
                    space = area.spaces.active
                    space.shading.type = 'SOLID'
                    space.shading.color_type = 'MATERIAL'
                    space.overlay.show_floor = False
                    space.overlay.show_axis_x = False
                    space.overlay.show_axis_y = False
                    space.region_3d.view_perspective = 'CAMERA'
    bpy.context.view_layer.update()
    triangles = sum(len(p.vertices) - 2 for obj in asset.objects if obj.type == 'MESH'
                    for p in obj.data.polygons)
    print("\nSTUDY WORLD: Island base built successfully.")
    print("Asset mesh triangles:", triangles)
    print("Switch to Layout. Render > Render Image for the lit preview.")
    print("Save As: assets/blender/source/study_world_island_base.blend")
    print("Nothing has been saved or exported automatically.\n")


if __name__ == "__main__":
    main()
