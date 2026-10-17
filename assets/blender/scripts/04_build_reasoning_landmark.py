"""STUDY WORLD — STEP 04: REASONING LANDMARK

Run in Blender's Text Editor. Requires Blender 4.2+; supports 5.2 Eevee naming.
Creates a separate scene and leaves all previous scenes unchanged.
No downloads, add-ons, automatic saving or exporting.
Save As: assets/blender/source/study_world_reasoning_landmark.blend

A decorative miniature hedge maze and three levitating purple puzzle cubes.
Not an interactive/solvable maze or functional Rubik's cube.
All export geometry is parented to SW04_Reasoning_ROOT at the origin.
Bottom rests at Z=0; later assembly will place the root on the island surface.
"""
import bpy
import math
from mathutils import Vector

SCENE_NAME = "Study World - Step 04"
OWNER = "study_world_step_04_v1"


def material(name, colour, emission=0):
    name = "SW04_" + name
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


def puzzle_cube(name, centre, angle, palette, coll, root):
    # Eight separated blocks create readable seams without texture maps.
    # Bake rotation into vertex positions so no modifier is needed for export.
    cosine, sine = math.cos(angle), math.sin(angle)
    for ix in (-1, 1):
        for iy in (-1, 1):
            for iz in (-1, 1):
                x, y, z = ix*.1225, iy*.1225, iz*.1225
                position = (centre[0]+x*cosine-y*sine,
                            centre[1]+x*sine+y*cosine, centre[2]+z)
                obj = bar(name + "_%d_%d_%d" % (ix, iy, iz), position,
                          (.225, .225, .225), palette[(ix+iy+iz+3)//2 % len(palette)],
                          coll, root)
                for vertex in obj.data.vertices:
                    vx, vy = vertex.co.x, vertex.co.y
                    vertex.co.x = vx*cosine-vy*sine
                    vertex.co.y = vx*sine+vy*cosine


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    asset = collection("SW04_Landmark_Reasoning_EXPORT", scene)
    stage = collection("SW04_Presentation_DO_NOT_EXPORT", scene)
    root = bpy.data.objects.new("SW04_Reasoning_ROOT", None)
    attach(root, root.name, asset)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .2
    root["asset_role"] = "subject_landmark"
    root["subject_theme"] = "reasoning"
    stone = material("Warm_Stone", (.68, .65, .56))
    sand = material("Maze_Paths", (.80, .72, .55))
    hedge = material("Hedge_Sides", (.22, .40, .19))
    leaves = material("Hedge_Tops", (.36, .56, .26))
    pedestal = material("Pedestal", (.73, .69, .61))
    purples = [material("Puzzle_Purple_%d" % i, colour, .10) for i, colour in enumerate([
        (.43, .25, .72), (.60, .39, .85), (.72, .54, .91), (.51, .31, .78)])]
    cylinder("SW04_Platform", 1.38, .12, .06, stone, asset, root, 20)
    cylinder("SW04_Path_Surface", 1.28, .025, .1325, sand, asset, root, 20)

    # Small open-front maze motif. Each tuple gives centre x/y and length x/y.
    walls = [
        (0, .92, 1.98, .15),
        (-.92, 0, .15, 1.84), (.92, 0, .15, 1.84),
        (-.64, -.92, .70, .15), (.64, -.92, .70, .15),
        (-.43, -.20, .15, 1.00),
        (-.15, -.63, .70, .15),
        (.44, -.25, .15, .65),
        (.66, .43, .38, .15),
        (-.57, .50, .40, .15),
    ]
    for i, (x, y, sx, sy) in enumerate(walls):
        bar("SW04_Hedge_%02d" % i, (x, y, .29), (sx, sy, .29), hedge, asset, root)
        bar("SW04_Hedge_Top_%02d" % i, (x, y, .4425),
            (sx+.025, sy+.025, .045), leaves, asset, root)

    podium = cylinder("SW04_Puzzle_Pedestal", .36, .18, .235,
                       pedestal, asset, root, 8)
    podium.location.y = .24
    for i, (z, angle) in enumerate(((.61, -.12), (1.14, .24), (1.67, -.26))):
        puzzle_cube("SW04_Puzzle_Cube_%d" % (i+1), (0, .24, z),
                    angle, purples, asset, root)

    camera_data = bpy.data.cameras.new("SW04_Camera")
    camera = bpy.data.objects.new("SW04_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (4.5, -7, 4.0)
    aim(camera, (0, 0, .90))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 4.2
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -4, 6), 650, (1, .88, .73)),
        ("Fill", (-4, 1, 4), 450, (.76, .85, 1)),
        ("Rim", (2, 4, 5), 600, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW04_" + name, 'AREA')
        data.energy, data.size, data.color = power, 4, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW04_Sky") or bpy.data.worlds.new("SW04_Sky")
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
    print("STUDY WORLD: Reasoning landmark built successfully.")
    print("All previous scenes are unchanged.")
    print("Save As: assets/blender/source/study_world_reasoning_landmark.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
