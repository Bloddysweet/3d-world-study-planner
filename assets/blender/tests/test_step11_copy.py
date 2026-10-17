"""Mocked regression check for live Collection.all_objects iterator invalidation.
Run: python3 assets/blender/tests/test_step11_copy.py
This simulates Blender cache invalidation, not actual bpy execution.
"""
import ast
from pathlib import Path
from types import SimpleNamespace as NS

SCRIPT = Path(__file__).resolve().parents[1]/'scripts'/'11_assemble_world_preview.py'
tree = ast.parse(SCRIPT.read_text())
function = next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='copy_asset')

class Matrix:
    def __init__(self,label): self.label=label
    def copy(self): return Matrix(self.label)
    @staticmethod
    def Identity(size): return Matrix('identity')

class Object:
    def __init__(self,name,kind='EMPTY',parent=None):
        self.name,self.type,self.parent=name,kind,parent
        self.properties={}
        self.data=object() if kind=='MESH' else None
        self.matrix_basis=Matrix(name+'_basis')
        self.matrix_parent_inverse=Matrix(name+'_parent_inverse')
    def __setitem__(self,key,value): self.properties[key]=value
    def __getitem__(self,key): return self.properties[key]
    def copy(self):
        duplicate=Object(self.name,self.type,self.parent)
        duplicate.data=self.data
        duplicate.properties=self.properties.copy()
        duplicate.matrix_basis=self.matrix_basis.copy()
        duplicate.matrix_parent_inverse=self.matrix_parent_inverse.copy()
        return duplicate

class LiveObjects:
    """Source contents stay stable, but iteration breaks after a scene mutation."""
    def __init__(self,items,epoch): self.items,self.epoch=items,epoch
    def __iter__(self):
        original_epoch=self.epoch[0]
        for item in self.items:
            yield item if self.epoch[0]==original_epoch else None


def exercise(function_node):
    epoch=[0]
    linked=[]
    source_root=Object('source_root')
    child=Object('source_mesh','MESH',source_root)
    nested_root=Object('nested_root','EMPTY',source_root)
    nested_mesh=Object('nested_mesh','MESH',nested_root)
    originals=[source_root,child,nested_root,nested_mesh]
    source=NS(name='source_asset',all_objects=LiveObjects(originals,epoch))
    def link(obj):
        epoch[0]+=1
        linked.append(obj)
    def new(name,data):
        epoch[0]+=1
        return Object(name)
    destination=NS(objects=NS(link=link))
    def attach(obj,name,coll):
        obj.name=name
        coll.objects.link(obj)
    namespace={'bpy':NS(data=NS(objects=NS(new=new))),
               'attach':attach,'OWNER':'test_owner','Matrix':Matrix}
    exec(compile(ast.Module(body=[function_node],type_ignores=[]),str(SCRIPT),'exec'),namespace)
    wrapper=namespace['copy_asset'](source,'copy',(1,2,3),.9,destination)
    copies={obj.name:obj for obj in linked}
    assert len(linked)==5
    root_copy=copies['copy__source_root']
    mesh_copy=copies['copy__source_mesh']
    nested_copy=copies['copy__nested_root']
    leaf_copy=copies['copy__nested_mesh']
    assert root_copy.parent is wrapper
    assert root_copy.matrix_basis.label=='identity'
    assert mesh_copy.parent is root_copy
    assert mesh_copy.data is child.data
    assert nested_copy.parent is root_copy
    assert nested_copy.matrix_basis.label=='nested_root_basis'
    assert leaf_copy.parent is nested_copy
    assert child.parent is source_root
    assert source_root.matrix_basis.label=='source_root_basis'
    assert wrapper.location==(1,2,3)
    assert wrapper.scale==(.9,.9,.9)

exercise(function)
print('PASS: snapshots source before mutation; copies all four objects despite live-iterator invalidation')
print('PASS: preserves nested parenting/transforms and shared mesh data; sources unchanged')

# Confirm this same test detects the old direct-iteration approach.
old_source=ast.unparse(function).replace('for original in originals:',
                                      'for original in source.all_objects:',1)
old_function=ast.parse(old_source).body[0]
try:
    exercise(old_function)
except AttributeError as err:
    assert "'NoneType' object has no attribute 'copy'" in str(err)
    print('PASS: reproduces the reported NoneType.copy failure without the fix')
else:
    raise AssertionError('Regression check failed to detect direct live iteration')
