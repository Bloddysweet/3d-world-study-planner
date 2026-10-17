"""STUDY WORLD — STEP 05: ENGLISH & VOCABULARY LANDMARK

Run in Blender's Text Editor. Blender 4.2+; supports Blender 5.2 Eevee naming.
Builds a separate scene; leaves all previous scenes unchanged.
No add-ons, fonts, textures, downloads, automatic saves or exports.
Save As: assets/blender/source/study_world_english_landmark.blend

Five stacked books and an open book, built from lightweight opaque meshes.
All asset objects descend from SW05_English_ROOT, with base bottom at Z=0.
Later assembly places this root at the island surface, not individual pieces.
"""
import bpy
import math
from mathutils import Vector

SCENE_NAME = "Study World - Step 05"
OWNER = "study_world_step_05_v1"


def material(name, colour, emission=0):
    name = "SW05_" + name
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


def closed_book(name, z, angle, offset, cover, pages, gold, coll, root):
    book_root = bpy.data.objects.new(name + "_ROOT", None)
    attach(book_root, book_root.name, coll, root=root)
    book_root.location = (offset, 0, z)
    book_root.rotation_euler.z = angle
    book_root.empty_display_size = .08
    width, depth, height = 1.30, .88, .30
    for label, centre_z in (("Bottom_Cover", .025), ("Top_Cover", height-.025)):
        bar(name + "_" + label, (0, 0, centre_z),
            (width, depth, .05), cover, coll, book_root)
    bar(name + "_Pages", (.025, 0, height/2),
        (width-.12, depth-.09, height-.10), pages, coll, book_root)
    bar(name + "_Spine", (-width/2+.04, 0, height/2),
        (.08, depth, height), cover, coll, book_root)
    # Small page-edge grooves on the visible front edge.
    groove = material("Page_Edge_Shadow", (.63, .55, .40))
    for i, line_z in enumerate((.105, .15, .195)):
        bar(name + "_Page_Line_%d" % i, (.025, -depth/2+.043, line_z),
            (width-.15, .006, .006), groove, coll, book_root)
    # Gold decorative bands wrap the spine, no text or external fonts.
    for i, y in enumerate((-.28, .28)):
        bar(name + "_Spine_Band_%d" % i, (-width/2-.002, y, height/2),
            (.008, .045, height-.025), gold, coll, book_root)
    return book_root


def sloped_slab(name, x0, x1, z0, z1, y_half, thickness, mat, coll, root):
    # Solid wedge with correctly wound faces; bottom follows a sloped book leaf.
    vertices = [(x0,-y_half,z0), (x1,-y_half,z1),
                (x1,y_half,z1), (x0,y_half,z0),
                (x0,-y_half,z0+thickness), (x1,-y_half,z1+thickness),
                (x1,y_half,z1+thickness), (x0,y_half,z0+thickness)]
    faces = [(3,2,1,0), (0,1,5,4), (1,2,6,5),
             (2,3,7,6), (3,0,4,7), (4,5,6,7)]
    return mesh(name, vertices, faces, mat, coll, root)


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    asset = collection("SW05_Landmark_English_EXPORT", scene)
    stage = collection("SW05_Presentation_DO_NOT_EXPORT", scene)
    root = bpy.data.objects.new("SW05_English_ROOT", None)
    attach(root, root.name, asset)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .2
    root["asset_role"] = "subject_landmark"
    root["subject_theme"] = "english"
    stone = material("Warm_Stone", (.68, .65, .56))
    pages = material("Cream_Pages", (.91, .84, .66))
    gold = material("Gold_Detail", (.92, .61, .19))
    ink = material("Page_Marks", (.47, .35, .23))
    ribbon = material("Bookmark_Red", (.74, .24, .20))
    colours = [(.73,.37,.22), (.22,.48,.46), (.83,.57,.19),
               (.42,.33,.62), (.28,.47,.65)]
    covers = [material("Book_Cover_%d" % i, colour) for i, colour in enumerate(colours)]
    cylinder("SW05_Platform", 1.10, .14, .07, stone, asset, root, 16)
    for i, (angle, offset) in enumerate(((-.12,0), (.10,.05), (-.06,-.04), (.16,.02), (-.08,0))):
        closed_book("SW05_Book_%d" % (i+1), .14+i*.30,
                    angle, offset, covers[i], pages, gold, asset, root)

    # The open book's spine sits on the stack (top Z=1.64).
    # Outer leaf edges rise above the central valley.
    base_z = 1.64
    for side, x0, x1, rise0, rise1 in [
        ("Left", -.74, 0, .19, 0), ("Right", 0, .74, 0, .19)
    ]:
        sloped_slab("SW05_Open_Cover_" + side, x0, x1,
                    base_z+rise0, base_z+rise1, .51, .035, covers[2], asset, root)
        # Slightly inset page block follows the cover's slope.
        inner0 = x0+.035 if x0 < 0 else x0+.018
        inner1 = x1-.018 if x1 == 0 else x1-.035
        def leaf_height(x):
            return base_z + abs(x)/.74*.19
        sloped_slab("SW05_Open_Pages_" + side, inner0, inner1,
                    leaf_height(inner0)+.035, leaf_height(inner1)+.035,
                    .475, .045, pages, asset, root)
        # Four fine, decorative lines per page, not actual written text.
        a, b = (-.61, -.12) if x0 < 0 else (.12, .61)
        for j, y in enumerate((-.27,-.10,.07,.24)):
            z_a, z_b = leaf_height(a)+.082, leaf_height(b)+.082
            vertices = [(a,y-.004,z_a),(b,y-.004,z_b),
                        (b,y+.004,z_b),(a,y+.004,z_a)]
            mesh("SW05_Page_Mark_%s_%d" % (side,j), vertices,
                 [(0,1,2,3)], ink, asset, root)

    # Bookmark rests in the open book and hangs down the front of the stack.
    bar("SW05_Bookmark_Top", (0,-.22,base_z+.075),
        (.065,.50,.012), ribbon, asset, root)
    bar("SW05_Bookmark_Hanging", (0,-.522,base_z-.18),
        (.065,.012,.49), ribbon, asset, root)

    camera_data = bpy.data.cameras.new("SW05_Camera")
    camera = bpy.data.objects.new("SW05_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (4.5, -7, 4.0)
    aim(camera, (0, 0, .96))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 3.6
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -4, 6), 650, (1, .88, .73)),
        ("Fill", (-4, 1, 4), 450, (.76, .85, 1)),
        ("Rim", (2, 4, 5), 600, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW05_" + name, 'AREA')
        data.energy, data.size, data.color = power, 4, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW05_Sky") or bpy.data.worlds.new("SW05_Sky")
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
    print("STUDY WORLD: English landmark built successfully.")
    print("All previous scenes are unchanged.")
    print("Save As: assets/blender/source/study_world_english_landmark.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
