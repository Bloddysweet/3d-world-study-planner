import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { createVillager, outfits } from "./art/villager-rig.mjs";
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
await mkdir("design/villagers", { recursive: true });
const recipes = [],
  assets = [];
for (const variant of Object.keys(outfits)) {
  const { root, clips, recipe } = createVillager(variant);
  const bytes = Buffer.from(
    await new GLTFExporter().parseAsync(root, {
      binary: true,
      animations: clips,
    }),
  );
  const asset = {
    variant,
    file: `villager_${variant}_v1.glb`,
    bytes: bytes.length,
    triangles: recipe.positions.length / 9,
    meshes: 1,
    materials: 1,
    bones: recipe.bones.length,
    clips: clips.map((c) => ({ name: c.name, duration: c.duration })),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  await writeFile("public/models/" + asset.file, bytes);
  assets.push(asset);
  recipes.push({ ...recipe, sha256: asset.sha256 });
  console.log(asset);
}
await writeFile(
  "public/models/villagers-v1.json",
  JSON.stringify(
    { schemaVersion: 1, generator: "scripts/build-villagers.mjs", assets },
    null,
    2,
  ) + "\n",
);
const packed = deflateSync(Buffer.from(JSON.stringify(recipes)), {
  level: 9,
}).toString("base64");
const python = String.raw`r"""STUDY WORLD — SCRIPT 16: THREE RIGGED, ANIMATED VILLAGERS
One complete OFFLINE Blender 5.2-targeted script. No earlier scripts/files required.
Creates a NEW scene; never deletes, saves, exports or overwrites earlier work.
Download: C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\16_animated_villagers.py
Manual Save As: C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_villagers_v1.blend
Scripting > Text > Open > Run Script, then Layout. Press Spacebar to play Walk.
Three original stylized 3D people, real armatures, four actions on each character:
Walk, Idle, LookAround, Study. Website route following is runtime presentation,
not baked into these walk-in-place character clips. No study progress is encoded.
Choose a new filename if your desired .blend already exists. No add-ons needed.
Python/data checks passed; actual Blender 5.2 execution is NOT verified here.
"""
import bpy, json, zlib, base64, math
from mathutils import Vector

PAYLOAD = """${packed.match(/.{1,100}/g).join("\n")}"""

def create_character(scene, recipe, offset):
    name = recipe["variant"]
    collection = bpy.data.collections.new("SW16_"+name+"_EXPORT")
    scene.collection.children.link(collection)
    arm_data = bpy.data.armatures.new("SW16_"+name+"_Rig")
    arm = bpy.data.objects.new("SW16_"+name+"_Armature",arm_data)
    collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    world_positions = {}
    for entry in recipe["bones"]:
        local = Vector(entry["position"])
        pos = world_positions[entry["parent"]] + local if entry["parent"] else local
        world_positions[entry["name"]] = pos
        bone = arm_data.edit_bones.new(entry["name"])
        # Uniform C = rotation X(+90deg) rest basis: Three Y-up -> Blender Z-up.
        bone.head = (pos.x,-pos.z,pos.y)
        bone.tail = (pos.x,-pos.z,pos.y+0.08)
        bone.roll = 0
        if entry["parent"]: bone.parent = arm_data.edit_bones[entry["parent"]]
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.show_in_front = True
    p, colors = recipe["positions"], recipe["colors"]
    verts = [(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
    mesh = bpy.data.meshes.new("SW16_"+name+"_Mesh")
    mesh.from_pydata(verts,[],[(i,i+1,i+2) for i in range(0,len(verts),3)])
    mesh.update()
    attr = mesh.color_attributes.new(name="Color",type="FLOAT_COLOR",domain="POINT")
    attr.data.foreach_set("color",[v for i in range(0,len(colors),3) for v in (*colors[i:i+3],1)])
    obj = bpy.data.objects.new("SW16_"+name,mesh)
    collection.objects.link(obj)
    obj.parent = arm
    for index,entry in enumerate(recipe["bones"]):
        group = obj.vertex_groups.new(name=entry["name"])
        indices = [i for i,b in enumerate(recipe["skinIndices"]) if b == index]
        if indices: group.add(indices,1.0,'REPLACE')
    modifier = obj.modifiers.new("Villager armature",'ARMATURE')
    modifier.object = arm
    mat = bpy.data.materials.new("SW16_"+name+"_Colours")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.86
    node = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    node.layer_name = "Color"
    mat.node_tree.links.new(node.outputs["Color"],bsdf.inputs["Base Color"])
    mesh.materials.append(mat)
    arm.location = (offset,0,0)
    arm["asset_sha256"] = recipe["sha256"]
    arm.animation_data_create()
    actions = {}
    rest = {entry["name"]:entry["position"] for entry in recipe["bones"]}
    for clip in recipe["clips"]:
        action = bpy.data.actions.new("SW16_"+name+"_"+clip["name"])
        arm.animation_data.action = action
        for track in clip["tracks"]:
            bone_name, prop = track["name"].rsplit('.',1)
            bone = arm.pose.bones[bone_name]
            bone.rotation_mode = 'QUATERNION'
            size = 4 if prop == 'quaternion' else 3
            for i,seconds in enumerate(track["times"]):
                values = track["values"][i*size:(i+1)*size]
                if size == 4:
                    # Pose rotations are in the uniform C rest-bone basis, NOT world axes.
                    bone.rotation_quaternion = (values[3],values[0],values[1],values[2])
                    path = 'rotation_quaternion'
                else:
                    bone.location = tuple(values[j]-rest[bone_name][j] for j in range(3))
                    path = 'location'
                bone.keyframe_insert(data_path=path,frame=1+seconds*30,group=bone_name)
        action.use_fake_user = True
        actions[clip["name"]] = action
    arm.animation_data.action = actions['Walk']
    # Do not run legacy action.fcurves APIs: Blender 5.x uses slotted actions.
    arm.select_set(False)
    return arm

def build():
    recipes = json.loads(zlib.decompress(base64.b64decode(PAYLOAD)))
    scene = bpy.data.scenes.new("Study World - Animated Villagers v1")
    if bpy.context.window: bpy.context.window.scene = scene
    scene.unit_settings.system, scene.unit_settings.scale_length = 'METRIC',1.0
    engines = {e.identifier for e in scene.render.bl_rna.properties['engine'].enum_items}
    scene.render.engine = next((e for e in ('BLENDER_EEVEE','CYCLES','BLENDER_WORKBENCH') if e in engines),scene.render.engine)
    for i,recipe in enumerate(recipes): create_character(scene,recipe,(i-1)*0.85)
    presentation = bpy.data.collections.new("SW16_Presentation_DO_NOT_EXPORT")
    scene.collection.children.link(presentation)
    world = bpy.data.worlds.new("SW16_Sky")
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.50,0.56,0.65,1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.65
    scene.world = world
    data = bpy.data.cameras.new('SW16_Camera')
    camera = bpy.data.objects.new(data.name,data)
    presentation.objects.link(camera)
    camera.location = (2,-5,2.25)
    camera.rotation_euler = (Vector((0,0,0.57))-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type, data.ortho_scale = 'ORTHO',3.6
    scene.camera = camera
    for name,pos,power,size in [('Key',(-3,-4,6),500,4),('Fill',(4,2,4),300,3)]:
        light = bpy.data.lights.new('SW16_'+name,'AREA')
        light.energy,light.size = power,size
        obj = bpy.data.objects.new(light.name,light)
        presentation.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (Vector((0,0,.6))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x,scene.render.resolution_y = 1400,900
    scene.render.resolution_percentage = 100
    scene.render.fps,scene.frame_start,scene.frame_end = 30,1,43
    scene.frame_set(1)
    if bpy.context.screen:
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.region_3d.view_distance = 3.6
                area.spaces.active.region_3d.view_location = (0,0,.57)
                area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
    print('Script 16 complete: NEW scene, three rigged villagers, four actions per rig.')
    print('Spacebar plays Walk. Nothing saved/exported. Save As manually with a fresh filename.')
    return scene

if __name__ == '__main__':
    build()
`;
await writeFile("assets/blender/scripts/16_animated_villagers.py", python);
