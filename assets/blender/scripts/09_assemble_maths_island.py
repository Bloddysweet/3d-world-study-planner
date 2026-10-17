"""STUDY WORLD — STEP 09: ASSEMBLED MATHS ISLAND PREVIEW

Run with a .blend saved inside your assets/blender/source folder open.
Loads missing Step 01/02/03 collections from sibling .blend files if needed.
Creates a new scene, duplicating meshes so originals are not edited.
Reads your saved .blend files if needed; no downloads, automatic saves or exports.
Blender 4.2+; includes Blender 5.2 Eevee engine-name compatibility.
Save As: assets/blender/source/study_world_maths_island_preview.blend

Seven plots are DEMO DATA, not a permanent topic limit. Topic names and task
information will be website overlays later; this script creates no text labels.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Matrix

SCENE_NAME = "Study World - Step 09"
OWNER = "study_world_step_09_v1"
# Your saved .blend files are in this folder (not the Python scripts folder).
# Keep the r before the quotes so Windows backslashes are handled correctly.
# Set to r"" to use the folder containing the currently open .blend instead.
SOURCE_FOLDER_OVERRIDE = r"C:\Users\kashif\Desktop\3d-world-study-planner\blender\source"
SURFACE_Z = .24
PLOT_RADIUS = 2.85
# Clockwise from back: Strong, In revision, Weak, Due/in revision,
# Ready for test, In revision, Not started. Due is an app label, not a sixth mesh.
PLOT_STATES = ["strong", "in_revision", "weak", "in_revision",
               "ready_for_test", "in_revision", "not_started"]


def material(name, colour, emission=0):
    name = "SW09_" + name
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


def import_missing_sources(missing):
    if SOURCE_FOLDER_OVERRIDE.strip():
        folder = Path(bpy.path.abspath(SOURCE_FOLDER_OVERRIDE)).expanduser()
    elif bpy.data.filepath:
        folder = Path(bpy.data.filepath).parent
    else:
        raise RuntimeError(
            "First open your saved study_world_software_landmark.blend from "
            "assets/blender/source, then run this updated script again. "
            "It needs that folder to find your earlier saved .blend files.")
    files = {
        "study_world_island_base.blend": ["SW01_Island_Base_EXPORT"],
        "study_world_topic_plots.blend": ["SW02_"+state+"_EXPORT"
                                         for state in sorted(set(PLOT_STATES))],
        "study_world_maths_landmark.blend": ["SW03_Landmark_Maths_EXPORT"],
    }
    plan = [(folder/filename, [name for name in names if name in missing])
            for filename,names in files.items()]
    plan = [(path,names) for path,names in plan if names]
    absent = [str(path) for path,names in plan if not path.is_file()]
    if absent:
        raise RuntimeError(
            "Could not find saved source files:\n" + "\n".join(absent)
            + "\nPut the Step 01, 02 and 03 .blend files beside your currently open "
              ".blend file, or set SOURCE_FOLDER_OVERRIDE at the top of this script. "
              "No existing models were deleted.")
    # Check all libraries before appending anything or rebuilding the preview.
    for path,names in plan:
        with bpy.data.libraries.load(str(path), link=False) as (library, requested):
            absent = [name for name in names if name not in library.collections]
            if absent:
                raise RuntimeError("Saved file " + str(path)
                    + " does not contain: " + ", ".join(absent)
                    + ". Check that this is the correct saved checkpoint.")
    imported_scene = bpy.data.scenes.new("Study World - Imported Sources")
    imported_scene["study_world_imported_sources"] = True
    for path,names in plan:
        with bpy.data.libraries.load(str(path), link=False) as (library, requested):
            # Blender replaces entries in this list with Collection objects on exit.
            # Give it a separate list so our names remain strings for logging.
            requested.collections = list(names)
        for coll in requested.collections:
            if coll is None:
                raise RuntimeError("Blender could not append a collection from " + str(path))
            imported_scene.collection.children.link(coll)
        print("STUDY WORLD: Appended", ", ".join(names), "from", path.name)


def source_assets():
    names = ["SW01_Island_Base_EXPORT", "SW03_Landmark_Maths_EXPORT"]
    names += ["SW02_"+state+"_EXPORT" for state in sorted(set(PLOT_STATES))]
    missing = [name for name in names if bpy.data.collections.get(name) is None]
    if missing:
        import_missing_sources(missing)
    missing = [name for name in names if bpy.data.collections.get(name) is None]
    if missing:
        raise RuntimeError("Could not load source collections: " + ", ".join(missing))
    assets = {name:bpy.data.collections[name] for name in names}
    for name,coll in assets.items():
        if not any(obj.type == 'MESH' for obj in coll.all_objects):
            raise RuntimeError("Source collection has no meshes: " + name)
    for state in set(PLOT_STATES):
        coll = assets["SW02_"+state+"_EXPORT"]
        if not any(obj.get("asset_role") == "topic_plot"
                   and obj.get("progress_state") == state for obj in coll.all_objects):
            raise RuntimeError("Missing original plot root for state: " + state)
    return assets

def copy_asset(source, name, position, scale, destination, source_root_name=None):
    # Copy mesh data as well as objects; scene edits will not alter source meshes.
    root = bpy.data.objects.new(name+"_PLACEMENT",None)
    attach(root,root.name,destination)
    root.location = position
    root.scale = (scale,scale,scale)
    root.empty_display_size = .12
    root["source_asset_collection"] = source.name
    originals = list(source.all_objects)
    copies = {}
    for original in originals:
        if original.type not in {'MESH','EMPTY'}:
            raise RuntimeError("Unexpected non-asset object in source: " + original.name)
        duplicate = original.copy()
        if original.data is not None:
            duplicate.data = original.data.copy()
        duplicate.name = name+"__"+original.name
        duplicate["study_world_owner"] = OWNER
        destination.objects.link(duplicate)
        duplicate.hide_viewport = False
        duplicate.hide_render = False
        copies[original] = duplicate
    for original,duplicate in copies.items():
        if original.parent in copies:
            duplicate.parent = copies[original.parent]
            duplicate.matrix_parent_inverse = original.matrix_parent_inverse.copy()
        else:
            duplicate.parent = root
            duplicate.matrix_parent_inverse = Matrix.Identity(4)
        duplicate.matrix_basis = original.matrix_basis.copy()
        if source_root_name is not None and original.get("asset_role") == "topic_plot":
            # Plot-library roots are spaced out only for the Step 02 showcase.
            # Reset that offset before placing one plot onto the island.
            duplicate.matrix_basis = Matrix.Identity(4)
    return root


def main():
    if bpy.app.version < (4,2,0):
        raise RuntimeError("Use Blender 4.2 or newer.")
    # Preflight before replacing a previous generated preview.
    sources = source_assets()
    scene = prepare_scene()
    island = collection("SW09_Maths_Island_PREVIEW",scene)
    stage = collection("SW09_Presentation_DO_NOT_EXPORT",scene)
    copy_asset(sources["SW01_Island_Base_EXPORT"],"SW09_Island",
               (0,0,0),1,island)
    copy_asset(sources["SW03_Landmark_Maths_EXPORT"],"SW09_Maths",
               (0,.10,SURFACE_Z),.94,island)
    for i,state in enumerate(PLOT_STATES):
        angle = math.pi/2-i*2*math.pi/len(PLOT_STATES)
        position = (PLOT_RADIUS*math.cos(angle),PLOT_RADIUS*math.sin(angle),SURFACE_Z)
        root = copy_asset(sources["SW02_"+state+"_EXPORT"],
                          "SW09_Plot_%02d"%(i+1),position,.82,island,
                          "SW02_"+state+"_ROOT")
        root["demo_topic_index"] = i+1
        root["demo_progress_state"] = state
    stone = material("Path_Stone",(.72,.68,.57))
    # An inner loop of stepping stones, with short branches towards each plot.
    for i in range(28):
        angle = i*2*math.pi/28
        obj = ico("SW09_Loop_Stone_%02d"%i,
                  (1.88*math.cos(angle),1.88*math.sin(angle),SURFACE_Z+.035),
                  (.19,.14,.055),stone,island,None)
        obj.rotation_euler.z = angle+math.pi/2
    for i in range(len(PLOT_STATES)):
        angle = math.pi/2-i*2*math.pi/len(PLOT_STATES)
        ico("SW09_Spoke_Stone_%02d"%i,
            (2.12*math.cos(angle),2.12*math.sin(angle),SURFACE_Z+.035),
            (.14,.14,.045),stone,island,None)

    camera_data = bpy.data.cameras.new("SW09_Camera")
    camera = bpy.data.objects.new("SW09_Camera", camera_data)
    attach(camera, camera.name, stage)
    camera.location = (11, -15, 12)
    aim(camera, (0, 0, -.35))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 13.6
    scene.camera = camera
    for name, pos, power, colour in [
        ("Key", (1, -6, 11), 1800, (1, .88, .73)),
        ("Fill", (-7, 1, 6), 1300, (.76, .85, 1)),
        ("Rim", (3, 7, 8), 1900, (1, .91, .77)),
    ]:
        data = bpy.data.lights.new("SW09_" + name, 'AREA')
        data.energy, data.size, data.color = power, 7, colour
        light = bpy.data.objects.new(data.name, data)
        attach(light, light.name, stage)
        light.location = pos
        aim(light, (0, 0, 1))
    world = bpy.data.worlds.get("SW09_Sky") or bpy.data.worlds.new("SW09_Sky")
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
    scene.render.resolution_y = 1300
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
    print("STUDY WORLD: Maths island preview assembled successfully.")
    print("All source scenes and source meshes are unchanged.")
    print("Save As: assets/blender/source/study_world_maths_island_preview.blend")
    print("Nothing has been saved or exported automatically.")


if __name__ == "__main__":
    main()
