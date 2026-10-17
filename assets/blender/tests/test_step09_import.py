"""Run with python3 assets/blender/tests/test_step09_import.py.
Mocked library-loading regression checks; does not require or execute Blender.
"""
import ast
from pathlib import Path
from types import SimpleNamespace as NS
from tempfile import TemporaryDirectory

src=(Path(__file__).resolve().parents[1]/'scripts'/'09_assemble_maths_island.py').read_text()
tree=ast.parse(src)
functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'source_assets','import_missing_sources'}]
states=['strong','in_revision','weak','ready_for_test','not_started']
class Object(dict):
    type='MESH'
class Scene(dict):
    def __init__(self):
        self.linked=[]
        self.collection=NS(children=NS(link=self.linked.append))
class Scenes:
    def __init__(self): self.created=[]
    def new(self,name):
        s=Scene(); self.created.append(s); return s
class Loader:
    def __init__(self,path,data):
        self.path=Path(path); self.data=data
        self.requested=NS(collections=[])
    def __enter__(self):
        if self.path.name=='study_world_island_base.blend': names=['SW01_Island_Base_EXPORT']
        elif self.path.name=='study_world_maths_landmark.blend': names=['SW03_Landmark_Maths_EXPORT']
        else: names=['SW02_'+s+'_EXPORT' for s in states]
        return NS(collections=names),self.requested
    def __exit__(self,*args):
        if args[0]: return False
        loaded=[]
        for name in self.requested.collections:
            props={}
            if name.startswith('SW02_'):
                props={'asset_role':'topic_plot','progress_state':name[5:-7]}
            coll=NS(name=name,all_objects=[Object(props)])
            self.data.collections[name]=coll
            loaded.append(coll)
        # Match Blender: mutate the supplied list in place, not just rebind it.
        self.requested.collections[:]=loaded

def env(filepath):
    data=NS(filepath=filepath,collections={},scenes=Scenes())
    data.libraries=NS(load=lambda path,link=False:Loader(path,data))
    e={'bpy':NS(data=data,path=NS(abspath=lambda p:p)), 'Path':Path,
       'SOURCE_FOLDER_OVERRIDE':'','PLOT_STATES':states}
    exec(compile(ast.Module(body=functions,type_ignores=[]),'<step09-tests>','exec'),e)
    return data,e

data,e=env('')
try: e['source_assets']()
except RuntimeError as err: assert 'First open' in str(err)
else: raise AssertionError('Unsaved file not detected')
assert not data.scenes.created
print('PASS: unsaved-file guidance')
with TemporaryDirectory() as folder:
    data,e=env(str(Path(folder)/'study_world_software_landmark.blend'))
    try: e['source_assets']()
    except RuntimeError as err: assert 'Could not find saved source files' in str(err)
    else: raise AssertionError('Missing files not detected')
    assert not data.scenes.created
    print('PASS: missing-file preflight leaves scenes unchanged')
    for name in ('island_base','topic_plots','maths_landmark'):
        (Path(folder)/('study_world_'+name+'.blend')).touch()
    result=e['source_assets']()
    assert len(result)==7 and len(data.scenes.created)==1
    assert len(data.scenes.created[0].linked)==7
    print('PASS: mocked library append loads and retains all seven collections')
    e['source_assets']()
    assert len(data.scenes.created)==1
    print('PASS: rerun reuses loaded assets without duplicating imports')
