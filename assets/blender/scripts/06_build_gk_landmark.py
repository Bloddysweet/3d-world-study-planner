"""STUDY WORLD — STEP 06: GK & GS GLOBE LANDMARK

Run in Blender's Text Editor. Blender 4.2+; supports Blender 5.2 Eevee naming.
Creates a separate scene. Does not modify earlier scenes, save, or export.
No add-ons, image textures, fonts, or internet required.
Save As: assets/blender/source/study_world_gk_landmark.blend

A stylized globe with approximate continent silhouettes, not an accurate atlas.
All geometry descends from SW06_GK_ROOT, with the platform bottom at Z=0.
"""
import bpy
import math
from mathutils import Vector

SCENE_NAME = "Study World - Step 06"
OWNER = "study_world_step_06_v1"

# Rough art-direction polygons in longitude/latitude degrees, not geography data.
CONTINENTS = [
    [(-168,65),(-140,70),(-125,57),(-105,73),(-60,55),(-53,46),
     (-82,25),(-86,15),(-102,20),(-118,33),(-130,50),(-160,54)],
    [(-81,12),(-61,9),(-35,-6),(-43,-23),(-57,-54),(-72,-45),(-79,-9)],
    [(-54,60),(-25,67),(-30,82),(-57,82),(-65,72)],
    [(-17,34),(8,37),(34,31),(51,11),(42,-13),(31,-34),(18,-35),
     (9,-10),(-5,5),(-17,15)],
    [(-10,36),(-9,59),(15,71),(43,66),(60,72),(105,75),(155,60),
     (175,52),(145,37),(124,23),(109,3),(96,8),(81,7),(69,25),
     (50,30),(43,13),(34,30),(27,40),(8,43)],
    [(113,-22),(130,-11),(146,-14),(154,-27),(146,-39),(119,-35)],
    [(47,-13),(51,-17),(48,-26),(44,-24)],
]


def material(name, colour, emission=0):
    name = "SW06_" + name
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


def inside_polygon(x, y, polygon):
    inside = False
    j = len(polygon)-1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y):
            crossing = (xj-xi)*(y-yi)/(yj-yi)+xi
            if x < crossing:
                inside = not inside
        j = i
    return inside


def torus(name, radius, thickness, position, rotation, mat, coll, root, segments=48):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments, minor_segments=6,
        major_radius=radius, minor_radius=thickness,
        location=position, rotation=rotation)
    return attach(bpy.context.object, name, coll, mat, root)


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    scene = prepare_scene()
    asset = collection("SW06_Landmark_GK_EXPORT", scene)
    stage = collection("SW06_Presentation_DO_NOT_EXPORT", scene)
    root = bpy.data.objects.new("SW06_GK_ROOT", None)
    attach(root, root.name, asset)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .2
    root["asset_role"] = "subject_landmark"
    root["subject_theme"] = "gk"
    stone = material("Warm_Stone", (.68,.65,.56))
    brass = material("Stand_Brass", (.72,.49,.20))
    dark = material("Stand_Dark", (.26,.34,.31))
    ocean = material("Ocean_Teal", (.14,.48,.62))
    land = material("Land_Green", (.45,.65,.31))
    ice = material("Polar_Ice", (.87,.91,.85))
    grid = material("Globe_Grid", (.57,.74,.69))
    cylinder("SW06_Platform", 1.0, .14, .07, stone, asset, root, 20)
    cylinder("SW06_Stand_Foot", .47, .10, .19, brass, asset, root, 16)
    cylinder("SW06_Stand_Stem", .10, .39, .435, dark, asset, root, 12)
    cylinder("SW06_Stand_Collar", .17, .065, .61, brass, asset, root, 12)

    centre_z = 1.48
    torus("SW06_Meridian_Frame", .84, .032, (0,0,centre_z),
          (math.pi/2,0,0), brass, asset, root, 64)
    globe_root = bpy.data.objects.new("SW06_Tilted_Globe_ROOT", None)
    attach(globe_root, globe_root.name, asset, root=root)
    globe_root.location = (0,0,centre_z)
    globe_root.rotation_euler.y = math.radians(23)
    globe_root.empty_display_size = .10
    radius = .72
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24,
                                        radius=radius, location=(0,0,0))
    sphere = attach(bpy.context.object, "SW06_Globe", asset, ocean, globe_root)
    sphere.data.materials.append(land)
    sphere.data.materials.append(ice)
    sphere.data.update()
    for polygon in sphere.data.polygons:
        centre = polygon.center
        longitude = math.degrees(math.atan2(centre.y, centre.x))
        latitude = math.degrees(math.atan2(centre.z, math.hypot(centre.x,centre.y)))
        if latitude < -69 or latitude > 78:
            polygon.material_index = 2
        elif any(inside_polygon(longitude,latitude,shape) for shape in CONTINENTS):
            polygon.material_index = 1
        else:
            polygon.material_index = 0
        polygon.use_smooth = False

    # The axial pin follows the tilted globe axis and meets the meridian frame.
    cylinder("SW06_Axial_Pin", .026, 1.66, 0, brass, asset, globe_root, 10)
    for i, latitude in enumerate((-45,0,45)):
        angle = math.radians(latitude)
        torus("SW06_Latitude_%d" % i, (radius+.005)*math.cos(angle), .006,
              (0,0,(radius+.005)*math.sin(angle)), (0,0,0),
              grid, asset, globe_root)

    camera_data = bpy.data.cameras.new("SW06_Camera")
    camera = bpy.data.objects.new("SW06_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (4.5, -7, 4.0)
    aim(camera, (0, 0, 1.10))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 3.6
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -4, 6), 650, (1, .88, .73)),
        ("Fill", (-4, 1, 4), 450, (.76, .85, 1)),
        ("Rim", (2, 4, 5), 600, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW06_" + name, 'AREA')
        data.energy, data.size, data.color = power, 4, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW06_Sky") or bpy.data.worlds.new("SW06_Sky")
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
    print("STUDY WORLD: GK & GS landmark built successfully.")
    print("All previous scenes are unchanged.")
    print("Save As: assets/blender/source/study_world_gk_landmark.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
