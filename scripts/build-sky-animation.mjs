import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { createAnimatedSkyDrake } from "./art/sky-drake-rig.mjs";
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
const folder = "design/sky-creature";
await mkdir(folder + "/models", { recursive: true });
const { root, clips, recipe } = createAnimatedSkyDrake();
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations: clips,
  }),
);
const meta = {
  schemaVersion: 1,
  name: "Aurel animated sky drake",
  stage: "Rig and motion review — no app flight integration",
  asset: "models/aurel_sky_drake_rigged_v1.glb",
  generator: "scripts/build-sky-animation.mjs",
  bytes: bytes.length,
  triangles: recipe.positions.length / 9,
  meshes: 1,
  materials: 1,
  bones: recipe.bones.length,
  clips: clips.map((c) => ({ name: c.name, duration: c.duration })),
  textures: 0,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
await writeFile(folder + "/" + meta.asset, bytes);
await writeFile(
  folder + "/animation-manifest.json",
  JSON.stringify(meta, null, 2) + "\n",
);
const packed = deflateSync(Buffer.from(JSON.stringify(recipe)), {
  level: 9,
}).toString("base64");
const py = String.raw`r"""STUDY WORLD — SCRIPT 18: AUREL RIG + FLIGHT LOOPS
ONE complete OFFLINE Blender 5.2-targeted file. Script 17 is NOT required.
Rebuilds the approved model, now with a real 16-bone weighted armature and
Wingbeat (3.2s), Glide (6s), TailSway (4.8s) actions. Flight is IN PLACE;
website routes are a later step. No studying/progress data is involved.
Download: C:\Users\kashif\Desktop\3d-world-study-planner\blender\scripts\18_aurel_flight_animation.py
Manual Save As: C:\Users\kashif\Desktop\3d-world-study-planner\blender\source\study_world_aurel_animated_v1.blend
Scripting > Text > Open > Run Script. Layout > Spacebar plays Wingbeat.
In the 3D View press N > Aurel > Motion to switch loops (updates frame range).
Every run creates a NEW scene. Never deletes, saves, exports or overwrites work.
No add-ons, downloads, external files or path editing. Choose a fresh save name.
Python/data/WebGL checks are separate from actual Blender 5.2 runtime execution,
which is NOT verified in this environment. Script 17 remains untouched.
"""
import bpy, json, zlib, base64
from mathutils import Vector

PAYLOAD = """${packed.match(/.{1,100}/g).join(String.fromCharCode(10))}"""

def choose_motion(scene, context=None):
    if not scene.get('sw18_owner'): return
    arm = next((o for o in scene.objects if o.type == 'ARMATURE' and o.get('sw18_owner')),None)
    if arm is None: return
    name = scene.sw18_aurel_motion
    action = scene.get('sw18_action_'+name)
    if action is None: return
    arm.animation_data_create()
    arm.animation_data.action = action
    if hasattr(action,'slots') and len(action.slots):
        arm.animation_data.action_slot = action.slots[0]
    scene.frame_start = 1
    # Exclude the repeated endpoint key from playback to avoid a one-frame hold.
    scene.frame_end = max(1,round(scene['sw18_duration_'+name]*30))
    scene.frame_set(1)

class SW18_PT_Aurel(bpy.types.Panel):
    bl_label = 'Aurel Flight Study'
    bl_idname = 'SW18_PT_Aurel'
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Aurel'
    @classmethod
    def poll(cls,context):
        return bool(context.scene.get('sw18_owner'))
    def draw(self,context):
        self.layout.prop(context.scene,'sw18_aurel_motion',text='Motion')
        self.layout.label(text='Spacebar: play / pause')
        self.layout.label(text='In-place loops, no website routes yet')

# Register the optional session-only review UI once. Repeated runs do not remove
# an existing panel, scene, action or object. Animation survives saving/reopening;
# the panel itself is not an installed add-on (use Action Editor after reopening).
def register_review_ui():
    if not hasattr(bpy.types,'SW18_PT_Aurel'):
        bpy.utils.register_class(SW18_PT_Aurel)
    if not hasattr(bpy.types.Scene,'sw18_aurel_motion'):
        bpy.types.Scene.sw18_aurel_motion = bpy.props.EnumProperty(
            name='Aurel motion',items=[('Wingbeat','Wingbeat','Gentle wing cycle'),('Glide','Glide','Calm open-wing flight'),('TailSway','Tail sway','Inspect the tail chain')],
            default='Wingbeat',update=choose_motion)

def build():
    recipe = json.loads(zlib.decompress(base64.b64decode(PAYLOAD)))
    # Leave a pre-existing Edit/Pose mode safely before opening the new scene.
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    scene = bpy.data.scenes.new('Study World - Aurel Animated v1')
    if bpy.context.window: bpy.context.window.scene = scene
    scene['sw18_owner'] = True
    scene['stage'] = 'RIG + IN-PLACE MOTION REVIEW; no app flight paths yet'
    scene['asset_sha256'] = '${meta.sha256}'
    scene.unit_settings.system,scene.unit_settings.scale_length = 'METRIC',1.0
    scene.render.fps,scene.render.fps_base = 30,1.0
    engines = {e.identifier for e in scene.render.bl_rna.properties['engine'].enum_items}
    scene.render.engine = next((e for e in ('BLENDER_EEVEE','CYCLES','BLENDER_WORKBENCH') if e in engines),scene.render.engine)
    model = bpy.data.collections.new('SW18_Aurel_Rig_EXPORT')
    presentation = bpy.data.collections.new('SW18_Presentation_DO_NOT_EXPORT')
    scene.collection.children.link(model)
    scene.collection.children.link(presentation)
    data = bpy.data.armatures.new('SW18_Aurel_Skeleton')
    arm = bpy.data.objects.new('SW18_Aurel_Armature',data)
    model.objects.link(arm)
    arm['sw18_owner'] = True
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    world_positions = {}
    for entry in recipe['bones']:
        local = Vector(entry['position'])
        pos = world_positions[entry['parent']]+local if entry['parent'] else local
        world_positions[entry['name']] = pos
        bone = data.edit_bones.new(entry['name'])
        # All rest bases C=Rx(+90deg): X,Y,Z in Three become X,Z,-Y in Blender.
        # Uniform bases keep pose quaternion components in the source local axes.
        bone.head = (pos.x,-pos.z,pos.y)
        bone.tail = (pos.x,-pos.z,pos.y+0.24)
        bone.roll = 0
        if entry['parent']: bone.parent = data.edit_bones[entry['parent']]
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.show_in_front = False
    data.display_type = 'STICK'
    p,colors = recipe['positions'],recipe['colors']
    vertices = [(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
    mesh = bpy.data.meshes.new('SW18_Aurel_Weighted_Mesh')
    mesh.from_pydata(vertices,[],[(i,i+1,i+2) for i in range(0,len(vertices),3)])
    mesh.update()
    attribute = mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    attribute.data.foreach_set('color',[v for i in range(0,len(colors),3) for v in (*colors[i:i+3],1)])
    obj = bpy.data.objects.new('SW18_Aurel',mesh)
    model.objects.link(obj)
    obj.parent = arm
    for index,entry in enumerate(recipe['bones']):
        group = obj.vertex_groups.new(name=entry['name'])
        for vertex in range(len(vertices)):
            for channel in range(4):
                k=vertex*4+channel
                if recipe['skinIndices'][k] == index and recipe['skinWeights'][k] > 0:
                    group.add([vertex],recipe['skinWeights'][k],'REPLACE')
    modifier = obj.modifiers.new('Aurel smooth flight rig','ARMATURE')
    modifier.object = arm
    material = bpy.data.materials.new('SW18_Aurel_Colours')
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.81
    vertex = material.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Color'
    material.node_tree.links.new(vertex.outputs['Color'],bsdf.inputs['Base Color'])
    mesh.materials.append(material)
    # Preserve semantic part ranges as face-domain attributes for future editing.
    parts_attr = mesh.attributes.new(name='Aurel_Part',type='INT',domain='FACE')
    for part_index,part in enumerate(recipe['parts']):
        for face in range(part['start']//3,(part['start']+part['count'])//3):
            parts_attr.data[face].value = part_index
    obj['part_names'] = ', '.join(part['name'] for part in recipe['parts'])
    arm.animation_data_create()
    rest = {entry['name']:entry['position'] for entry in recipe['bones']}
    for clip in recipe['clips']:
        action = bpy.data.actions.new('SW18_Aurel_'+clip['name'])
        action.use_fake_user = True
        arm.animation_data.action = action
        for track in clip['tracks']:
            bone_name,prop = track['name'].rsplit('.',1)
            bone = arm.pose.bones[bone_name]
            bone.rotation_mode = 'QUATERNION'
            size = 4 if prop == 'quaternion' else 3
            for i,seconds in enumerate(track['times']):
                v = track['values'][i*size:(i+1)*size]
                if size == 4:
                    bone.rotation_quaternion = (v[3],v[0],v[1],v[2])
                    path = 'rotation_quaternion'
                else:
                    bone.location = tuple(v[j]-rest[bone_name][j] for j in range(3))
                    path = 'location'
                bone.keyframe_insert(data_path=path,frame=1+seconds*30,group=bone_name)
        # Blender's newer slotted actions, not the retired action.fcurves API.
        # Set LINEAR interpolation so intermediate quaternions match the sampled
        # browser loops closely, without Bezier overshoot at cycle seams.
        if hasattr(action,'layers'):
            for layer in action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for curve in bag.fcurves:
                            for point in curve.keyframe_points:
                                point.interpolation = 'LINEAR'
        scene['sw18_action_'+clip['name']] = action
        scene['sw18_duration_'+clip['name']] = clip['duration']
    register_review_ui()
    scene.sw18_aurel_motion = 'Wingbeat'
    choose_motion(scene)
    world = bpy.data.worlds.new('SW18_Warm_Studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.47,0.55,0.66,1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.65
    scene.world = world
    camera_data = bpy.data.cameras.new('SW18_Camera')
    camera = bpy.data.objects.new(camera_data.name,camera_data)
    presentation.objects.link(camera)
    camera.location = (8,-13,11)
    camera.rotation_euler = (Vector((0,0.5,0.1))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type,camera_data.ortho_scale = 'ORTHO',9.6
    scene.camera = camera
    for name,pos,power,size in [('Key',(-6,-8,12),1700,9),('Fill',(8,5,7),1100,8)]:
        light = bpy.data.lights.new('SW18_'+name,'AREA')
        light.energy,light.size = power,size
        light_obj = bpy.data.objects.new(light.name,light)
        presentation.objects.link(light_obj)
        light_obj.location = pos
        light_obj.rotation_euler = (Vector((0,0,0))-light_obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x,scene.render.resolution_y = 1500,1100
    scene.render.resolution_percentage = 100
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.region_3d.view_distance = 13
                area.spaces.active.region_3d.view_location = (0,0.5,0.1)
                area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
    print('Script 18 complete. NEW scene: '+scene.name)
    print('Layout > Spacebar to play. N > Aurel > Motion to switch loops.')
    print('No files saved/exported. Save As manually using a fresh filename.')
    return scene

if __name__ == '__main__':
    build()
`;
await writeFile("assets/blender/scripts/18_aurel_flight_animation.py", py);
await mkdir(".cache/sky-animation", { recursive: true });
await writeFile(
  ".cache/sky-animation/source-recipe.json",
  JSON.stringify(recipe),
);
console.log(JSON.stringify(meta, null, 2));
