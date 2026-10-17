"""Standard-library tests for export planning, GLB sanity checks and publication.
Run: python3 assets/blender/tests/test_step13_export.py
Does not run bpy or Blender's actual glTF exporter.
"""
import ast
import json
import math
import itertools
import os
import struct
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace as NS

SCRIPT = Path(__file__).resolve().parents[1]/'scripts'/'13_export_models.py'
TREE = ast.parse(SCRIPT.read_text())
NAMES = {'specifications','build_plan','check_glb','publish','freeze_meshes'}
NODES = [n for n in TREE.body if isinstance(n,ast.Assign)
         or isinstance(n,ast.FunctionDef) and n.name in NAMES]
ENV = {'Path':Path,'json':json,'struct':struct,'os':os,'math':math}
exec(compile(ast.Module(body=NODES,type_ignores=[]),str(SCRIPT),'exec'),ENV)

class Object:
    def __init__(self,name,kind='EMPTY',parent=None,**props):
        self.name,self.type,self.parent=name,kind,parent
        self.props=props
        self.users_collection=[NS(name='SW12_Polished_World_PREVIEW')]
    def get(self,key,default=None): return self.props.get(key,default)


def scene_objects():
    result=[]
    for index,spec in enumerate(ENV['specifications']()):
        if spec['kind']=='path_stone':
            result.append(Object('SW12__SW11_Maths_Path_00','MESH'))
            continue
        root=Object('root_%02d'%index,source_asset_collection=spec['source'],
                    demo_subject=spec.get('subject'))
        nested=Object('nested_%02d'%index,parent=root)
        mesh=Object('mesh_%02d'%index,'MESH',nested)
        result.extend((root,nested,mesh))
    sky=Object('SW12_Sky_Backdrop_PRESENTATION_ONLY','MESH',presentation_only=True)
    sky.users_collection=[NS(name='SW12_Presentation_DO_NOT_EXPORT')]
    result.append(sky)
    result.append(Object('source_camera','CAMERA'))
    return result


def triangle_glb(document_changes=None):
    payload=struct.pack('<9f',0,0,0,1,0,0,0,1,0)
    doc={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}],
         'nodes':[{'mesh':0}], 'meshes':[{'primitives':[{'attributes':{'POSITION':0}}]}],
         'buffers':[{'byteLength':len(payload)}],
         'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(payload)}],
         'accessors':[{'bufferView':0,'componentType':5126,'count':3,'type':'VEC3',
                       'min':[0,0,0],'max':[1,1,0]}]}
    if document_changes: doc.update(document_changes)
    encoded=json.dumps(doc).encode()
    encoded+=b' '*((-len(encoded))%4)
    length=12+8+len(encoded)+8+len(payload)
    return struct.pack('<4sII',b'glTF',2,length)+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(payload),b'BIN\x00')+payload


class Matrix4:
    """Small test-only affine matrix implementation; no numpy/mathutils dependency."""
    def __init__(self,rows): self.rows=[list(row) for row in rows]
    def copy(self): return Matrix4(self.rows)
    def __matmul__(self,other):
        if isinstance(other,Matrix4):
            return Matrix4([[sum(self.rows[r][k]*other.rows[k][c] for k in range(4))
                             for c in range(4)] for r in range(4)])
        point=list(other)+[1]
        return tuple(sum(self.rows[r][k]*point[k] for k in range(4)) for r in range(3))
    def determinant(self):
        value=0
        for perm in itertools.permutations(range(4)):
            inversions=sum(perm[i]>perm[j] for i in range(4) for j in range(i+1,4))
            value+=(-1)**inversions*math.prod(self.rows[i][perm[i]] for i in range(4))
        return value
    def inverted(self):
        rows=[row[:]+[float(i==j) for j in range(4)] for i,row in enumerate(self.rows)]
        for col in range(4):
            pivot=max(range(col,4),key=lambda r:abs(rows[r][col]))
            rows[col],rows[pivot]=rows[pivot],rows[col]
            divisor=rows[col][col]
            rows[col]=[v/divisor for v in rows[col]]
            for r in range(4):
                if r!=col:
                    multiple=rows[r][col]
                    rows[r]=[a-multiple*b for a,b in zip(rows[r],rows[col])]
        return Matrix4([row[4:] for row in rows])

class Point:
    def __init__(self,xyz): self.x,self.y,self.z=xyz
    def __iter__(self): return iter((self.x,self.y,self.z))
class Mesh:
    def __init__(self,points):
        self.vertices=[NS(co=Point(p)) for p in points]
        self.loop_triangles=[None]
    def transform(self,matrix):
        for vertex in self.vertices: vertex.co=Point(matrix@vertex.co)
    def update(self): pass
    def calc_loop_triangles(self): pass
class Evaluated:
    def __init__(self,matrix,points=None): self.matrix_world,self.points=matrix,points
    def evaluated_get(self,graph): return self


class ExportTests(unittest.TestCase):
    def test_twenty_distinct_specs(self):
        specs=ENV['specifications']()
        self.assertEqual(len(specs),20)
        self.assertEqual(len({s['file'] for s in specs}),20)
        self.assertEqual(sum(s['kind']=='island_base' for s in specs),3)
        self.assertEqual(sum(s['kind']=='landmark' for s in specs),6)
        self.assertEqual(sum(s['kind']=='topic_plot' for s in specs),5)

    def test_plan_native_asset_roots_and_descendants_only(self):
        objects=scene_objects()
        plan=ENV['build_plan'](objects)
        self.assertEqual(len(plan),20)
        self.assertEqual([p['root'].get('demo_subject') for p in plan[:3]],
                         ['Maths','Reasoning','English'])
        self.assertTrue(all(len(item['meshes'])==1 for item in plan))
        self.assertTrue(all('Sky' not in o.name for item in plan for o in item['meshes']))
        self.assertTrue(all(o.type=='MESH' for item in plan for o in item['meshes']))
        # No inputs were renamed/reparented by planning.
        self.assertEqual(objects[0].name,'root_00')
        self.assertIs(objects[1].parent,objects[0])

    def test_missing_landmark_stops_plan(self):
        objects=scene_objects()
        root=next(o for o in objects if o.get('source_asset_collection')=='SW06_Landmark_GK_EXPORT')
        objects.remove(root)
        with self.assertRaisesRegex(RuntimeError,'landmark_gk.glb'):
            ENV['build_plan'](objects)

    def test_empty_asset_stops_plan(self):
        objects=scene_objects()
        objects=[o for o in objects if o.name!='mesh_00']
        with self.assertRaisesRegex(RuntimeError,'No mesh geometry'):
            ENV['build_plan'](objects)

    def test_real_triangle_binary_sanity_check(self):
        with TemporaryDirectory() as folder:
            path=Path(folder)/'triangle.glb'
            data=triangle_glb()
            path.write_bytes(data)
            result=ENV['check_glb'](path)
            self.assertEqual(result['bytes'],len(data))
            self.assertEqual(result['meshCount'],1)

    def test_invalid_header_and_truncation(self):
        with TemporaryDirectory() as folder:
            path=Path(folder)/'broken.glb'
            for data in (b'bad',b'xxxx'+triangle_glb()[4:],triangle_glb()[:-4]):
                path.write_bytes(data)
                with self.assertRaises(RuntimeError): ENV['check_glb'](path)

    def test_rejects_cameras_animations_lights_and_external_dependencies(self):
        cases=[{'cameras':[{'type':'perspective'}]}, {'animations':[{}]},
               {'nodes':[{'extensions':{'KHR_lights_punctual':{'light':0}}}]},
               {'buffers':[{'uri':'other.bin','byteLength':36}]},
               {'images':[{'uri':'texture.png'}]}]
        with TemporaryDirectory() as folder:
            path=Path(folder)/'bad_content.glb'
            for changes in cases:
                path.write_bytes(triangle_glb(changes))
                with self.assertRaises(RuntimeError): ENV['check_glb'](path)

    def test_publication_replaces_only_managed_files(self):
        with TemporaryDirectory() as folder:
            output=Path(folder)/'models'; output.mkdir()
            staging=output/'.stage'; staging.mkdir()
            (output/'a.glb').write_bytes(b'old-a')
            (output/'unrelated.txt').write_bytes(b'keep')
            (staging/'a.glb').write_bytes(b'new-a')
            (staging/'manifest.json').write_bytes(b'new-manifest')
            ENV['publish'](staging,output,['a.glb','manifest.json'])
            self.assertEqual((output/'a.glb').read_bytes(),b'new-a')
            self.assertEqual((output/'manifest.json').read_bytes(),b'new-manifest')
            self.assertEqual((output/'unrelated.txt').read_bytes(),b'keep')
            self.assertEqual((staging/'previous'/'a.glb').read_bytes(),b'old-a')

    def test_failed_publication_restores_previous_outputs(self):
        with TemporaryDirectory() as folder:
            output=Path(folder)/'models'; output.mkdir()
            staging=output/'.stage'; staging.mkdir()
            for name in ('a.glb','b.glb'):
                (output/name).write_bytes(('old-'+name).encode())
                (staging/name).write_bytes(('new-'+name).encode())
            def fail_once(src,dst):
                if Path(src)==staging/'b.glb': raise OSError('simulated publication failure')
                os.replace(src,dst)
            ENV['os']=NS(replace=fail_once)
            try:
                with self.assertRaisesRegex(OSError,'simulated'):
                    ENV['publish'](staging,output,['a.glb','b.glb'])
            finally:
                ENV['os']=os
            for name in ('a.glb','b.glb'):
                self.assertEqual((output/name).read_bytes(),('old-'+name).encode())

    def test_unsafe_filenames_rejected(self):
        with TemporaryDirectory() as folder:
            base=Path(folder)
            for names in (['../outside'],['a','a'],['dir/file'],['dir\\file']):
                with self.assertRaises(ValueError): ENV['publish'](base,base,names)

    def test_freeze_bakes_native_pose_removing_demo_translation_rotation_and_scale(self):
        angle=.8
        c,s=math.cos(angle),math.sin(angle)
        placement=Matrix4([[.9*c,-.9*s,0,13.5],[.9*s,.9*c,0,-6],
                           [0,0,.72,.24],[0,0,0,1]])
        tilt=.4
        c,s=math.cos(tilt),math.sin(tilt)
        internal=Matrix4([[c,0,s,.7],[0,1,0,-.4],[-s,0,c,.3],[0,0,0,1]])
        native_points=[(.5,.2,.1),(-.5,.2,.1),(.5,-.2,.1)]
        root=Evaluated(placement)
        part=Evaluated(placement@internal,native_points)
        item={'root':root,'meshes':(part,),'file':'test.glb'}
        allocated=[]
        ENV['bpy']=NS(data=NS(meshes=NS(new_from_object=lambda obj,**kwargs:Mesh(obj.points))))
        ENV['freeze_meshes']([item],object(),allocated)
        self.assertEqual(len(allocated),1)
        self.assertEqual(item['triangles'],1)
        for point,actual in zip(native_points,allocated[0].vertices):
            expected=internal@point
            for a,b in zip(actual.co,expected): self.assertAlmostEqual(a,b,places=10)
        converted=[(p[0],p[2],-p[1]) for p in (internal@v for v in native_points)]
        for axis in range(3):
            self.assertAlmostEqual(item['bounds']['min'][axis],min(v[axis] for v in converted))
            self.assertAlmostEqual(item['bounds']['max'][axis],max(v[axis] for v in converted))

    def test_source_freeze_precedes_temporary_scene_switch(self):
        main=next(n for n in TREE.body if isinstance(n,ast.FunctionDef) and n.name=='main')
        code=ast.unparse(main)
        self.assertLess(code.index('freeze_meshes(plan, depsgraph, allocated)'),
                        code.index("bpy.data.scenes.new('Study World - Temporary Export')"))
        self.assertIn('bpy.context.window.scene = previous_scene',code)
        self.assertIn('root_world.inverted()',ast.unparse(next(n for n in TREE.body
                      if isinstance(n,ast.FunctionDef) and n.name=='freeze_meshes')))


if __name__=='__main__':
    unittest.main(verbosity=2)
