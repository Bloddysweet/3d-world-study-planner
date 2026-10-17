// Regenerates all seven deployable assets and ONE complete offline Blender delivery.
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { profiles } from "./art/theme-profiles.mjs";
const islands = [];
for (const [theme, profile] of Object.entries(profiles)) {
  execFileSync(process.execPath, ["scripts/build-maths-island.mjs", theme], {
    stdio: "inherit",
  });
  islands.push({
    theme,
    label: profile.label,
    metadata: JSON.parse(
      await readFile(`public/models/${theme}-art-v2.json`, "utf8"),
    ),
    recipe: JSON.parse(
      await readFile(`.cache/island-art/${theme}-recipe.json`, "utf8"),
    ),
  });
}
await writeFile(
  "public/models/island-art-v2.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      generator: "scripts/build-all-islands.mjs",
      islands: islands.map(({ recipe, ...entry }) => entry),
    },
    null,
    2,
  ) + "\n",
);
const packed = deflateSync(Buffer.from(JSON.stringify(islands)), {
  level: 9,
}).toString("base64");
const python = String.raw`r"""STUDY WORLD — SCRIPT 15: ALL SEVEN ART ISLANDS V2
ONE complete offline Blender 5.2-compatible script. No previous scripts required.
Scripting > Text > Open > 15_all_subject_art_islands.py > Run Script. Then Layout.
Creates a NEW scene each run; it never deletes objects, saves or exports files.
Each island has a separate collection and root; presentation is kept separate.
Script folder: C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts
Manual Save As: C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_all_art_v2.blend
Choose a new filename if a file already exists. Script 14 and earlier work are untouched.

These are the SAME triangle positions and quantized linear vertex colours as the
website assets, with Three (X,Y,Z) converted to Blender (X,-Z,Y). The seven roots
are arranged for viewing, not merged. Flat plot surfaces are at Z=0.24 metres.
All landmarks/foliage are decoration; topic progress and villagers are NOT baked in.
No downloads, external data, fonts, images, add-ons, automatic file writes or dependencies.
Application execution in Blender 5.2 has not been tested in the authoring sandbox.
"""
import bpy, json, zlib, base64, math
from mathutils import Vector

PAYLOAD = """${packed.match(/.{1,100}/g).join("\n")}"""

def add_island(scene, entry, index):
    theme, recipe = entry["theme"], entry["recipe"]
    collection = bpy.data.collections.new("SW15_" + theme + "_EXPORT")
    scene.collection.children.link(collection)
    root = bpy.data.objects.new("SW15_" + theme + "_ROOT", None)
    collection.objects.link(root)
    angle = (index-1) * math.tau / 6
    root.location = (0,0,0) if index == 0 else (12*math.cos(angle), -12*math.sin(angle), 0)
    root["asset_file"] = entry["metadata"]["asset"]
    root["asset_sha256"] = entry["metadata"]["sha256"]
    root["surface_z"] = 0.24
    root["note"] = "Local mesh matches the website asset. Root offset is presentation only."
    mats = {}
    for name, settings in recipe["materials"].items():
        mat = bpy.data.materials.new("SW15_" + theme + "_" + name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = settings.get("roughness", 0.8)
        bsdf.inputs["Metallic"].default_value = settings.get("metalness", 0)
        vertex = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        vertex.layer_name = "Color"
        mat.node_tree.links.new(vertex.outputs["Color"], bsdf.inputs["Base Color"])
        emission = settings.get("emissive")
        if emission:
            srgb = [int(emission[i:i+2],16)/255 for i in (1,3,5)]
            linear = [c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4 for c in srgb]
            socket = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            if socket is not None: socket.default_value = (*linear,1)
            strength = bsdf.inputs.get("Emission Strength")
            if strength is not None: strength.default_value = settings.get("emissiveIntensity",0)
        mats[name] = mat
    for entry_mesh in recipe["meshes"]:
        p, colors = entry_mesh["positions"], entry_mesh["colors"]
        vertices = [(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
        faces = [(i,i+1,i+2) for i in range(0,len(vertices),3)]
        name = "SW15_" + theme + "_" + entry_mesh["name"]
        mesh = bpy.data.meshes.new(name + "_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        attr = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="POINT")
        rgba = [value for i in range(0,len(colors),3) for value in (*colors[i:i+3],1)]
        attr.data.foreach_set("color",rgba)
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.parent = root
        mesh.materials.append(mats[entry_mesh["name"]])
    return root

def build():
    entries = json.loads(zlib.decompress(base64.b64decode(PAYLOAD)))
    scene = bpy.data.scenes.new("Study World - All Art Islands v2")
    scene["study_world_owner"] = "study_world_all_art_v2"
    scene["note"] = "NEW scene. Seven standalone island collections; learning data stays in the website."
    scene.unit_settings.system, scene.unit_settings.scale_length = 'METRIC', 1.0
    if bpy.context.window: bpy.context.window.scene = scene
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = next((e for e in ("BLENDER_EEVEE", "CYCLES", "BLENDER_WORKBENCH") if e in engines), scene.render.engine)
    for index, entry in enumerate(entries): add_island(scene, entry, index)
    presentation = bpy.data.collections.new("SW15_Presentation_DO_NOT_EXPORT")
    scene.collection.children.link(presentation)
    world = bpy.data.worlds.new("SW15_Warm_Sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.46,0.53,0.64,1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.65
    scene.world = world
    camera_data = bpy.data.cameras.new("SW15_Camera")
    camera = bpy.data.objects.new("SW15_Camera",camera_data)
    presentation.objects.link(camera)
    camera.location = (28,-38,31)
    camera.rotation_euler = (Vector((0,0,-0.3))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type, camera_data.ortho_scale = 'ORTHO', 43
    scene.camera = camera
    for name,position,energy,size,tint in [("Key",(-14,-18,24),9000,18,(1,0.86,0.69)),("Fill",(20,12,19),6000,16,(0.68,0.78,1))]:
        data = bpy.data.lights.new("SW15_"+name,'AREA')
        data.energy, data.shape, data.size, data.color = energy,'DISK',size,tint
        obj = bpy.data.objects.new(data.name,data)
        presentation.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1200
    scene.render.resolution_percentage = 100
    choices = {i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items}
    if 'AgX' in choices: scene.view_settings.view_transform = 'AgX'
    if bpy.context.screen:
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.region_3d.view_distance = 43
                area.spaces.active.region_3d.view_location = (0,0,-0.3)
                area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
    print("Script 15 complete. NEW scene with all seven subject islands: " + scene.name)
    print("Nothing saved/exported. Use File > Save As manually, with a fresh filename.")
    return scene

if __name__ == "__main__":
    build()
`;
await writeFile("assets/blender/scripts/15_all_subject_art_islands.py", python);
console.log("Complete Script 15 and all seven assets written.");
