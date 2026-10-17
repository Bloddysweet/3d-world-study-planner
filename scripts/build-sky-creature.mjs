import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { Box3 } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { createSkyDrake } from "./art/sky-drake.mjs";
const folder = "design/sky-creature";
await mkdir(folder + "/models", { recursive: true });
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const { root, recipe } = createSkyDrake();
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(root, { binary: true }),
);
const bounds = new Box3().setFromObject(root);
const meta = {
  schemaVersion: 1,
  name: "Aurel sky drake",
  stage: "Static model approval; no rig, clips or app flight yet",
  asset: "models/aurel_sky_drake_v1.glb",
  generator: "scripts/build-sky-creature.mjs",
  bytes: bytes.length,
  triangles: recipe.meshes.reduce((sum, m) => sum + m.positions.length / 9, 0),
  meshes: root.children.length,
  materials: 1,
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
  sha256: createHash("sha256").update(bytes).digest("hex"),
  textures: 0,
  animations: 0,
};
await writeFile(folder + "/" + meta.asset, bytes);
await writeFile(
  folder + "/manifest.json",
  JSON.stringify(meta, null, 2) + "\n",
);
const packed = deflateSync(Buffer.from(JSON.stringify(recipe)), {
  level: 9,
}).toString("base64");
const py = String.raw`r"""STUDY WORLD — SCRIPT 17: AUREL SKY DRAKE (MODEL REVIEW)
ONE complete OFFLINE Blender 5.2-targeted script. No earlier scripts required.
Original gentle sky wyvern: broad scalloped wings, teal body, coral/gold membranes,
long curling tail, soft head fins and folded hind legs. Not a franchise model.
STATIC modeling stage only. No armature, wingbeat animation or app flight yet.
Download: C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\17_aurel_sky_drake.py
Manual Save As: C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_aurel_sky_drake_v1.blend
Scripting > Text > Open > Run Script. Then Layout or Render > Render Image.
Every run creates a NEW scene. Never deletes, saves, exports or overwrites work.
No add-ons, external models, images, fonts, downloads or local paths to edit.
Choose a fresh filename if your intended .blend already exists.
Python/data/safety checks passed; actual Blender 5.2 execution is NOT verified.
"""
import bpy, json, zlib, base64
from mathutils import Vector

PAYLOAD = """${packed.match(/.{1,100}/g).join(String.fromCharCode(10))}"""

def build():
    recipe = json.loads(zlib.decompress(base64.b64decode(PAYLOAD)))
    scene = bpy.data.scenes.new("Study World - Aurel Sky Drake v1")
    if bpy.context.window: bpy.context.window.scene = scene
    scene["study_world_owner"] = "SW17_Aurel"
    scene["stage"] = "STATIC MODEL REVIEW - no rig, animation or app flight yet"
    scene["asset_sha256"] = "${meta.sha256}"
    scene.unit_settings.system, scene.unit_settings.scale_length = 'METRIC',1.0
    engines = {e.identifier for e in scene.render.bl_rna.properties['engine'].enum_items}
    scene.render.engine = next((e for e in ('BLENDER_EEVEE','CYCLES','BLENDER_WORKBENCH') if e in engines),scene.render.engine)
    export = bpy.data.collections.new("SW17_Aurel_Model_EXPORT")
    presentation = bpy.data.collections.new("SW17_Presentation_DO_NOT_EXPORT")
    scene.collection.children.link(export)
    scene.collection.children.link(presentation)
    root = bpy.data.objects.new("SW17_Aurel_ROOT",None)
    export.objects.link(root)
    material = bpy.data.materials.new("SW17_Aurel_Vertex_Colours")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.81
    vertex = material.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    material.node_tree.links.new(vertex.outputs['Color'],bsdf.inputs['Base Color'])
    for entry in recipe['meshes']:
        p,colors = entry['positions'],entry['colors']
        vertices = [(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
        mesh = bpy.data.meshes.new('SW17_'+entry['name']+'_Mesh')
        mesh.from_pydata(vertices,[],[(i,i+1,i+2) for i in range(0,len(vertices),3)])
        mesh.update()
        attribute = mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        attribute.data.foreach_set('color',[v for i in range(0,len(colors),3) for v in (*colors[i:i+3],1)])
        obj = bpy.data.objects.new('SW17_'+entry['name'],mesh)
        export.objects.link(obj)
        obj.parent = root
        mesh.materials.append(material)
        obj['note'] = 'Separated anatomical part for the NEXT rigging stage; not rigged yet.'
    world = bpy.data.worlds.new('SW17_Warm_Studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.47,0.55,0.66,1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.65
    scene.world = world
    data = bpy.data.cameras.new('SW17_Camera')
    camera = bpy.data.objects.new(data.name,data)
    presentation.objects.link(camera)
    camera.location = (8,-13,11)
    camera.rotation_euler = (Vector((0,0.5,0.1))-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type,data.ortho_scale = 'ORTHO',8.6
    scene.camera = camera
    for name,pos,power,size in [('Key',(-6,-8,12),1700,9),('Fill',(8,5,7),1100,8)]:
        light = bpy.data.lights.new('SW17_'+name,'AREA')
        light.energy,light.size = power,size
        obj = bpy.data.objects.new(light.name,light)
        presentation.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x,scene.render.resolution_y = 1500,1100
    scene.render.resolution_percentage = 100
    choices = {i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items}
    if 'AgX' in choices: scene.view_settings.view_transform = 'AgX'
    if bpy.context.screen:
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.region_3d.view_distance = 12.5
                area.spaces.active.region_3d.view_location = (0,0.5,0.1)
                area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
    print('Script 17 complete. NEW scene: '+scene.name)
    print('Static modeling stage. Review silhouette/colours before rigging and app flight.')
    print('No files saved/exported. Save As manually, choosing a fresh filename.')
    return scene

if __name__ == '__main__':
    build()
`;
await writeFile("assets/blender/scripts/17_aurel_sky_drake.py", py);
console.log(JSON.stringify(meta, null, 2));
