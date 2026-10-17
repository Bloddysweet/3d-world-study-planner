"""Pure math and mocked copy tests; no Blender runtime required.
Run: python3 assets/blender/tests/test_step12_polish.py
"""
import ast
import math
from pathlib import Path
from types import SimpleNamespace as NS

SCRIPT = Path(__file__).resolve().parents[1]/'scripts'/'12_polish_world.py'
tree = ast.parse(SCRIPT.read_text())
names = {'srgb_to_linear','hex_colour','rock_position','frame_parameters','copy_geometry','capture_transforms'}
functions = [n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
ns = {'math':math,'ROCK_DEPTHS':(.88,1.10,1.30),'OWNER':'test_polish_owner'}
exec(compile(ast.Module(body=functions,type_ignores=[]),str(SCRIPT),'exec'),ns)
assert ns['hex_colour']('000000') == (0,0,0)
assert ns['hex_colour']('#ffffff') == (1,1,1)
assert abs(ns['srgb_to_linear'](.5)-.21404114048223255)<1e-10
print('PASS: hexadecimal/sRGB-to-linear palette conversion')

for index in range(8):
    for x,y in ((4.6,0),(0,4.6),(-3,3),(1,-2)):
        for z in (-.05,0,.04,.24):
            assert ns['rock_position'](x,y,z,index) == (x,y,z)
        for z in (-.55,-1.65,-2.7,-3.5):
            point = ns['rock_position'](x,y,z,index)
            assert all(math.isfinite(v) for v in point)
            assert point[2] < 0
            assert abs(point[0]) <= abs(x)*1.101
            assert abs(point[1]) <= abs(y)*1.101
assert len({ns['rock_position'](1,0,-3.5,i) for i in range(3)}) == 3
print('PASS: three underside profiles; all grass/top-rim/landing vertices exactly unchanged')

points = [(-20,-10),(16,13),(-9,18),(3,-16)]
for aspect in (1,4/3,16/9):
    cx,cy,width = ns['frame_parameters'](points,aspect,1.16)
    height = width/aspect
    for x,y in points:
        assert abs(x-cx) <= width/2/1.16+1e-9
        assert abs(y-cy) <= height/2/1.16+1e-9
assert ns['frame_parameters']([(0,0)],1,1.16)[2] > 0
print('PASS: centred camera bounds with full padding at three render aspect ratios')

class Matrix:
    def __init__(self,label): self.label=label
    def copy(self): return Matrix(self.label)
class Mesh:
    def __init__(self,name): self.name,self.copy_calls=name,0
    def copy(self):
        self.copy_calls += 1
        return Mesh(self.name+'_copy')
class Object:
    def __init__(self,name,kind,parent=None,data=None):
        self.name,self.type,self.parent,self.data=name,kind,parent,data
        self.properties={}
        self.matrix_basis=Matrix(name+'_basis')
        self.matrix_world=Matrix(name+'_world')
        self.matrix_parent_inverse=Matrix(name+'_inverse')
    def __setitem__(self,key,value): self.properties[key]=value
    def copy(self):
        result=Object(self.name,self.type,self.parent,self.data)
        result.properties=self.properties.copy()
        return result
class LiveObjects:
    def __init__(self,items,epoch): self.items,self.epoch=items,epoch
    def __iter__(self):
        initial=self.epoch[0]
        for item in self.items:
            yield item if self.epoch[0]==initial else None

shared,rock,grass = Mesh('shared_scenery'),Mesh('rock'),Mesh('grass')
root = Object('island_root','EMPTY')
nested = Object('nested_root','EMPTY',root)
originals = [root,nested,
    Object('tree_a','MESH',root,shared),Object('tree_b','MESH',nested,shared),
    Object('SW11_Maths__SW01_Rock_Underside','MESH',root,rock),
    Object('SW11_GK__SW01_Rock_Underside','MESH',root,rock),
    Object('SW11_Maths__SW01_Grass_Cap','MESH',root,grass),
    Object('SW11_GK__SW01_Grass_Cap','MESH',root,grass)]
epoch,linked = [0],[]
def link(obj):
    epoch[0] += 1
    linked.append(obj)
# Freeze approved poses before simulating an inactive source scene's stale cache.
frozen = ns['capture_transforms'](originals)
for obj in originals:
    obj.matrix_world = Matrix('inactive_identity')
mapping = ns['copy_geometry'](LiveObjects(originals,epoch),NS(objects=NS(link=link)),frozen)
assert len(mapping)==len(originals)==len(linked)
assert mapping[root].parent is None
assert mapping[root].matrix_basis.label==frozen[root]['basis'].label
assert frozen[root]['world'].label=='island_root_world'
assert mapping[root].matrix_world.label!='inactive_identity'
assert mapping[nested].parent is mapping[root]
assert mapping[nested].matrix_basis.label==nested.matrix_basis.label
assert mapping[originals[2]].data is mapping[originals[3]].data
assert mapping[originals[2]].data is not shared
assert mapping[originals[4]].data is not mapping[originals[5]].data
assert mapping[originals[6]].data is not mapping[originals[7]].data
assert (shared.copy_calls,rock.copy_calls,grass.copy_calls)==(1,2,2)
for original,duplicate in mapping.items():
    assert duplicate.properties['study_world_owner']=='test_polish_owner'
    assert duplicate is not original
    if original.type=='MESH':
        assert original.data is not duplicate.data
assert nested.parent is root
print('PASS: safe live-iterator snapshot, all source meshes independent, cached internal instances')
print('PASS: per-island rock/grass mesh copies and nested transforms; source parenting unchanged')

print('PASS: frozen root placement survives inactive source-world cache reset')

# Reproduce the old bug: the old helper assigns the stale inactive matrix_world.
old_code=ast.unparse(next(n for n in tree.body if isinstance(n,ast.FunctionDef)
                         and n.name=='copy_geometry'))
start=old_code.index('    for original, duplicate in mapping.items():')
old_code=old_code[:start]+"""    for original, duplicate in mapping.items():
        if original.parent in mapping:
            duplicate.parent = mapping[original.parent]
            duplicate.matrix_parent_inverse = original.matrix_parent_inverse.copy()
            duplicate.matrix_basis = original.matrix_basis.copy()
        else:
            duplicate.parent = None
            duplicate.matrix_world = original.matrix_world.copy()
    return mapping
"""
old_ns=dict(ns)
exec(compile(old_code,'<old-polish-copy>','exec'),old_ns)
old_mapping=old_ns['copy_geometry'](originals,NS(objects=NS(link=lambda obj:None)),frozen)
assert old_mapping[root].matrix_world.label=='inactive_identity'
print('PASS: regression reproduces old stale-world assignment; fixed helper avoids it')

# The runtime safeguard must reject collapsed placement instead of rendering it.
validation=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='validate_layout')
ns['bpy']=NS(context=NS(view_layer=NS(update=lambda:None),
                        evaluated_depsgraph_get=lambda:NS(update=lambda:None)))
exec(compile(ast.Module(body=[validation],type_ignores=[]),str(SCRIPT),'exec'),ns)
class EvaluatedObject:
    def __init__(self,matrix): self.matrix=matrix
    def evaluated_get(self,graph): return NS(matrix_world=self.matrix)
expected=[[1,0,0,13.5],[0,1,0,-3],[0,0,1,0],[0,0,0,1]]
source=Object('example_root','EMPTY')
poses={source:{'world':expected}}
ns['validate_layout']({source:EvaluatedObject(expected)},poses)
collapsed=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
try:
    ns['validate_layout']({source:EvaluatedObject(collapsed)},poses)
except RuntimeError as err:
    assert 'placement check failed' in str(err)
else:
    raise AssertionError('Layout guard did not catch collapsed island root')
print('PASS: runtime placement guard accepts preserved pose and rejects a collapsed root')

main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
statements=[ast.unparse(n) for n in main.body]
assert statements.index('camera_pose = source.camera.matrix_world.copy()') < statements.index('scene = prepare_scene()')
assert any('camera.matrix_world = camera_pose' == n for n in statements)
print('PASS: camera pose is captured before switching scene and restored from that snapshot')
