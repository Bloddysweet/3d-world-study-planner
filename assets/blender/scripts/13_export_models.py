"""STUDY WORLD — STEP 13: EXPORT THE POLISHED MODULAR KIT

Run in Blender's Text Editor with study_world_polished.blend open.
Blender 4.2+ / 5.2. Uses Blender's bundled glTF exporter; no downloads required.
Writes 20 .glb files and manifest.json into the configured OUTPUT_FOLDER.
Overwrites ONLY these named outputs on rerun; unrelated files are untouched.
Does not save/overwrite .blend files or alter the polished scene's objects.

Exports native-size assets at their own origins, not the fixed demo layout.
Camera, lights, sky backdrop, demo subject/topic names and progress data are NOT
exported. glTF is Y-up; Blender +Z becomes glTF +Y and Blender +Y becomes -Z.
Island ground surface is glTF Y=0.24. Landmark/plot/tree bases are at Y=0;
path stone and cloud use centred roots. Bridge spans 4 m along X with endpoint deck surfaces at Y=0.

Export files are staged and checked before publication. Managed existing files
are backed up during publication, with rollback on a publication error.
Actual Blender/glTF export still needs verification on the user's computer.
"""
import bpy
import json
import math
import os
import shutil
import struct
import tempfile
from pathlib import Path
from mathutils import Matrix

POLISHED_SCENE = 'Study World - Step 12'
POLISHED_OWNER = 'study_world_step_12_v1'
PROJECT_FOLDER = Path(r'C:\Users\kashif\Desktop\3d-world-study-planner')
SOURCE_FILE = PROJECT_FOLDER/'blender'/'source'/'study_world_polished.blend'
OUTPUT_FOLDER = PROJECT_FOLDER/'public'/'models'
ISLAND_CHOICES = (('Maths','island_base_01.glb','shallow'),
                  ('Reasoning','island_base_02.glb','balanced'),
                  ('English','island_base_03.glb','deep'))
LANDMARKS = (
    ('SW03_Landmark_Maths_EXPORT','landmark_maths.glb'),
    ('SW04_Landmark_Reasoning_EXPORT','landmark_reasoning.glb'),
    ('SW05_Landmark_English_EXPORT','landmark_english.glb'),
    ('SW06_Landmark_GK_EXPORT','landmark_gk.glb'),
    ('SW07_Landmark_DSA_EXPORT','landmark_dsa.glb'),
    ('SW08_Landmark_Software_EXPORT','landmark_software.glb'),
)
STATES = ('not_started','in_revision','ready_for_test','strong','weak')
SCENERY = (
    ('Bridge','bridge.glb','bridge'),
    ('Tree_Round','scenery_tree_round.glb','scenery'),
    ('Tree_Pine','scenery_tree_pine.glb','scenery'),
    ('Cloud','scenery_cloud.glb','scenery'),
    ('Rock_Cluster','scenery_rocks.glb','scenery'),
)


def load_polished_scene():
    scene = bpy.data.scenes.get(POLISHED_SCENE)
    if scene is None:
        path = Path(bpy.path.abspath(str(SOURCE_FILE)))
        if not path.is_file():
            raise RuntimeError('Save/open your successful study_world_polished.blend first. '
                               'Expected file: '+str(path))
        with bpy.data.libraries.load(str(path),link=False) as (library,requested):
            if POLISHED_SCENE not in library.scenes:
                raise RuntimeError('The saved file does not contain '+POLISHED_SCENE
                                   +'. Save the successful Script 12 result first.')
            requested.scenes = [POLISHED_SCENE]
        scene = requested.scenes[0]
    if scene is None or scene.get('study_world_owner') != POLISHED_OWNER:
        raise RuntimeError('Source scene is not the polished Step 12 scene.')
    return scene


def specifications():
    specs = []
    for subject,filename,profile in ISLAND_CHOICES:
        specs.append({'file':filename,'kind':'island_base','source':'SW01_Island_Base_EXPORT',
                      'subject':subject,'profile':profile,'surfaceY':.24})
    for source,filename in LANDMARKS:
        specs.append({'file':filename,'kind':'landmark','source':source})
    for state in STATES:
        specs.append({'file':'topic_plot_'+state+'.glb','kind':'topic_plot',
                      'source':'SW02_'+state+'_EXPORT','state':state})
    for kind,filename,role in SCENERY:
        specs.append({'file':filename,'kind':role,'source':'SW10_'+kind+'_EXPORT'})
    specs.append({'file':'path_stone.glb','kind':'path_stone','source':None})
    return specs


def build_plan(objects):
    # Collection membership alone is insufficient: the polished scene contains
    # many repeated instances. Placement-root metadata identifies each native asset.
    objects = tuple(objects)
    geometry = tuple(o for o in objects if o is not None and o.type in {'MESH','EMPTY'}
                     and not o.get('presentation_only')
                     and any(c.name.startswith('SW12_Polished_World_PREVIEW')
                             for c in o.users_collection))
    children = {}
    for obj in geometry:
        children.setdefault(obj.parent,[]).append(obj)
    plan = []
    for spec in specifications():
        item = dict(spec)
        if item['kind'] == 'path_stone':
            matches = [o for o in geometry if o.type == 'MESH'
                       and '_Maths_Path_' in o.name]
            if not matches:
                raise RuntimeError('Missing polished Maths stepping stone. Rerun Script 12.')
            root = sorted(matches,key=lambda o:o.name)[0]
            meshes = (root,)
        else:
            matches = [o for o in geometry if o.type == 'EMPTY'
                       and o.get('source_asset_collection') == item['source']
                       and ('subject' not in item or o.get('demo_subject') == item['subject'])]
            if not matches:
                raise RuntimeError('Missing polished export source for '+item['file']
                                   +'. Open the successful full-world Script 12 result.')
            root = sorted(matches,key=lambda o:o.name)[0]
            descendants,stack = [],list(children.get(root,()))
            seen = set()
            while stack:
                obj = stack.pop()
                if obj in seen:
                    raise RuntimeError('Unexpected cyclic asset hierarchy: '+root.name)
                seen.add(obj)
                descendants.append(obj)
                stack.extend(children.get(obj,()))
            meshes = tuple(sorted((o for o in descendants if o.type == 'MESH'),
                                  key=lambda o:o.name))
        if not meshes:
            raise RuntimeError('No mesh geometry for '+item['file'])
        item['root'],item['meshes'] = root,meshes
        plan.append(item)
    if len(plan) != 20 or len({i['file'] for i in plan}) != 20:
        raise RuntimeError('Export plan must contain 20 distinct model filenames.')
    return plan


def freeze_meshes(plan,depsgraph,allocated):
    # Called while the polished scene is ACTIVE and evaluated. Bake root-relative
    # poses before switching scenes: do not read inactive originals' world caches.
    for item in plan:
        root_world = item['root'].evaluated_get(depsgraph).matrix_world.copy()
        if abs(root_world.determinant()) < 1e-10:
            raise RuntimeError('Cannot invert the placement transform for '+item['file'])
        inverse = root_world.inverted()
        frozen = []
        triangles = 0
        low,high = [float('inf')]*3,[float('-inf')]*3
        for source in item['meshes']:
            evaluated = source.evaluated_get(depsgraph)
            local = inverse @ evaluated.matrix_world.copy()
            mesh = bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,
                                                  depsgraph=depsgraph)
            if mesh is None:
                raise RuntimeError('Could not copy evaluated mesh: '+source.name)
            allocated.append(mesh)
            mesh.transform(local)
            mesh.update()
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            if not mesh.vertices or not all(math.isfinite(v) for p in mesh.vertices for v in p.co):
                raise RuntimeError('Empty or non-finite mesh in '+item['file'])
            for vertex in mesh.vertices:
                # glTF's Y-up conversion from Blender's Z-up source coordinates.
                point = (vertex.co.x,vertex.co.z,-vertex.co.y)
                for axis in range(3):
                    low[axis],high[axis] = min(low[axis],point[axis]),max(high[axis],point[axis])
            frozen.append(mesh)
        if max(abs(v) for v in low+high) > 10:
            raise RuntimeError('Asset is not at expected native scale/origin: '+item['file'])
        item['bounds'] = {'min':low,'max':high}
        item['frozen'],item['triangles'] = frozen,triangles


def exporter_options():
    try:
        properties = bpy.ops.export_scene.gltf.get_rna_type().properties
    except (AttributeError,RuntimeError):
        # Enable Blender's bundled exporter only; do not install or download anything.
        try:
            bpy.ops.preferences.addon_enable(module='io_scene_gltf2')
            properties = bpy.ops.export_scene.gltf.get_rna_type().properties
        except Exception as exc:
            raise RuntimeError('Blender glTF 2.0 exporter is unavailable. Enable it in '
                               'Edit > Preferences > Add-ons, then rerun Script 13.') from exc
    supported = set(properties.keys())
    required = {'filepath','export_format','use_selection','use_active_scene','export_yup',
                'export_cameras','export_lights','export_animations','export_extras'}
    if not required.issubset(supported):
        raise RuntimeError('This glTF exporter lacks required options: '
                           +', '.join(sorted(required-supported)))
    candidates = {
        'export_format':'GLB','use_selection':True,'export_yup':True,
        'use_active_scene':True,'export_cameras':False,'export_lights':False,
        'export_animations':False,'export_extras':False,'export_materials':'EXPORT',
        'export_draco_mesh_compression_enable':False,
    }
    return {key:value for key,value in candidates.items() if key in supported}


def check_glb(path):
    # Inspect the actual generated binary, not just its filename or size.
    data = Path(path).read_bytes()
    if len(data) < 20:
        raise RuntimeError('Truncated GLB: '+str(path))
    magic,version,length = struct.unpack_from('<4sII',data)
    if magic != b'glTF' or version != 2 or length != len(data) or length%4:
        raise RuntimeError('Invalid GLB header: '+str(path))
    size,kind = struct.unpack_from('<I4s',data,12)
    if kind != b'JSON' or size%4 or size < 2 or 20+size > len(data):
        raise RuntimeError('Invalid GLB JSON chunk: '+str(path))
    document = json.loads(data[20:20+size].decode('utf-8').rstrip(' \x00'))
    if document.get('asset',{}).get('version') != '2.0' or not document.get('meshes'):
        raise RuntimeError('GLB has no glTF 2.0 mesh content: '+str(path))
    if document.get('cameras') or document.get('animations') or document.get('skins'):
        raise RuntimeError('Unexpected camera/animation/skin in static asset: '+str(path))
    for node in document.get('nodes',[]):
        if 'KHR_lights_punctual' in node.get('extensions',{}):
            raise RuntimeError('Unexpected light in model: '+str(path))
    if any(buffer.get('uri') for buffer in document.get('buffers',[])):
        raise RuntimeError('Model depends on an external buffer: '+str(path))
    if any(image.get('uri') and not image['uri'].startswith('data:')
           for image in document.get('images',[])):
        raise RuntimeError('Model depends on an external image: '+str(path))
    return {'bytes':len(data),'meshCount':len(document['meshes']),
            'materialCount':len(document.get('materials',[]))}


def publish(staging,output,filenames):
    # Roll back managed outputs if a file replacement fails. Never touch unrelated files.
    staging,output = Path(staging),Path(output)
    names = tuple(filenames)
    if len(set(names)) != len(names) or any(Path(n).name != n or n in ('.','..')
                                          or '/' in n or '\\' in n for n in names):
        raise ValueError('Output names must be distinct, plain filenames.')
    backup = staging/'previous'
    backup.mkdir()
    saved,published = [],[]
    try:
        for name in names:
            target = output/name
            if target.exists():
                if not target.is_file():
                    raise RuntimeError('Cannot replace a directory: '+str(target))
                os.replace(target,backup/name)
                saved.append(name)
            os.replace(staging/name,target)
            published.append(name)
    except Exception:
        # If rollback itself fails (e.g. permissions), caller retains the staging
        # directory and prints its location so previous files can be recovered.
        for name in reversed(published):
            (output/name).unlink()
        for name in reversed(saved):
            os.replace(backup/name,output/name)
        raise


def main():
    if bpy.app.version < (4,2,0) or bpy.context.window is None:
        raise RuntimeError("Run in Blender 4.2+ using its Scripting Text Editor.")
    if bpy.context.mode != 'OBJECT':
        raise RuntimeError('Switch to Object Mode before running Script 13.')
    previous_scene = bpy.context.window.scene
    scene = None
    allocated,temporary_objects = [],[]
    staging = None
    success = False
    try:
        options = exporter_options()
        source = load_polished_scene()
        bpy.context.window.scene = source
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        depsgraph.update()
        originals = tuple(source.objects)
        plan = build_plan(originals)
        freeze_meshes(plan,depsgraph,allocated)
        # All source geometry/transforms are now frozen. No source matrices below.
        output = Path(bpy.path.abspath(str(OUTPUT_FOLDER)))
        output.mkdir(parents=True,exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix='.study-world-export-',dir=str(output)))
        scene = bpy.data.scenes.new('Study World - Temporary Export')
        scene.unit_settings.system = 'METRIC'
        scene.unit_settings.scale_length = 1
        bpy.context.window.scene = scene
        entries = []
        for item in plan:
            stem = Path(item['file']).stem
            root = bpy.data.objects.new(stem,None)
            temporary_objects.append(root)
            scene.collection.objects.link(root)
            batch = [root]
            for index,mesh in enumerate(item['frozen']):
                obj = bpy.data.objects.new(stem+'__part_%03d'%index,mesh)
                temporary_objects.append(obj)
                scene.collection.objects.link(obj)
                obj.parent = root
                obj.matrix_basis = Matrix.Identity(4)
                batch.append(obj)
            bpy.context.view_layer.update()
            for obj in batch:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = root
            path = staging/item['file']
            result = bpy.ops.export_scene.gltf(filepath=str(path),**options)
            if 'FINISHED' not in result or not path.is_file():
                raise RuntimeError('Blender did not finish exporting '+item['file'])
            checked = check_glb(path)
            if checked['bytes'] > 8*1024*1024:
                raise RuntimeError('Asset unexpectedly exceeds 8 MiB: '+item['file'])
            entry = {k:v for k,v in item.items() if k in {'file','kind','profile','state','surfaceY','bounds'}}
            entry.update(checked)
            entry['triangles'] = item['triangles']
            entry['units'] = 'metres'
            entries.append(entry)
            print('STUDY WORLD: Exported',item['file'],checked['bytes'],'bytes')
            del temporary_objects[-len(batch):]
            for obj in batch:
                bpy.data.objects.remove(obj,do_unlink=True)
        manifest = {
            'schemaVersion':1,'generator':'study-world-step-13-v1',
            'coordinateSystem':'glTF Y-up (+X right, +Y up; Blender +Y maps to -Z)',
            'units':'metres','nativeIslandRadiusApprox':4.6,'islandSurfaceY':.24,
            'bridge':{'file':'bridge.glb','spanAlongX':4.0,'deckEndpointY':0.0,'width':1.02},
            'notes':[
                'Native root-local scale: demo placement, rotation and scale have been removed.',
                'Place landmarks and topic plots at islandSurfaceY; keep subject/topic data in the app.',
                'Sky, camera and lights are not exported; recreate browser presentation separately.',
                'Three island profiles retain sample grass tones; grass may be recoloured in code.',
                'Unassigned subjects can use the tree/rock kit; there is no fixed subject limit.',
            ],
            'assets':entries,
        }
        (staging/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
        publish(staging,output,[e['file'] for e in entries]+['manifest.json'])
        success = True
        total = sum(e['bytes'] for e in entries)
        print('\nSTUDY WORLD: SUCCESS —',len(entries),'GLB files;',round(total/1024/1024,2),'MiB total.')
        print('Output:',output)
        print('No .blend file was saved or overwritten. Browser checks are next.\n')
        def draw(self,context):
            self.layout.label(text='Exported 20 GLB models + manifest.json.')
            self.layout.label(text='Folder: Desktop project / public / models')
            self.layout.label(text='Send manifest.json and the GLBs for browser testing.')
        bpy.context.window_manager.popup_menu(draw,title='Study World export complete',icon='CHECKMARK')
    finally:
        # Always restore the user's scene, and remove only our temporary objects/data.
        bpy.context.window.scene = previous_scene
        for obj in tuple(temporary_objects):
            bpy.data.objects.remove(obj,do_unlink=True)
        if scene is not None:
            bpy.data.scenes.remove(scene)
        for mesh in allocated:
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        if staging is not None and staging.exists():
            if success:
                shutil.rmtree(staging)
            else:
                print('Export did not finish. Diagnostic/recovery files retained at:',staging)
                print('Do not delete that folder if you need to recover previous outputs.')


if __name__ == '__main__':
    main()
