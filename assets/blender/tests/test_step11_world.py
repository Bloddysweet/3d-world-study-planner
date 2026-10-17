"""Pure geometry and mocked Blender-library regression checks. No bpy required.
Run: python3 assets/blender/tests/test_step11_world.py
This does not verify actual Blender execution or rendered appearance.
"""
import ast
import math
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace as NS

SCRIPT = Path(__file__).resolve().parents[1]/'scripts'/'11_assemble_world_preview.py'
tree = ast.parse(SCRIPT.read_text())
constants = [node for node in tree.body if isinstance(node,ast.Assign)]
functions = [node for node in tree.body if isinstance(node,ast.FunctionDef)
             and node.name in {'load_sources','bridge_transform'}]
namespace = {'math':math,'Path':Path}
exec(compile(ast.Module(body=constants+functions,type_ignores=[]),str(SCRIPT),'exec'),namespace)

# Check all eight island footprints, their bridge endpoints, and asset scaling.
centres = [(0,0,1.0)]
for name,degrees,landmark in namespace['OUTER_LAYOUT']:
    angle = math.radians(degrees)
    x,y = namespace['OUTER_RADIUS']*math.cos(angle),namespace['OUTER_RADIUS']*math.sin(angle)
    centres.append((x,y,namespace['OUTER_SCALE']))
    midpoint,rotation,stretch = namespace['bridge_transform']((0,0),(x,y))
    assert stretch > 0
    direction = (math.cos(rotation),math.sin(rotation))
    start = (midpoint[0]-2*stretch*direction[0],midpoint[1]-2*stretch*direction[1])
    end = (midpoint[0]+2*stretch*direction[0],midpoint[1]+2*stretch*direction[1])
    assert abs(math.hypot(*start)-4.05)<1e-9
    assert abs(math.hypot(x-end[0],y-end[1])-3.65)<1e-9
    assert midpoint[2] == .24
for i,(x,y,s) in enumerate(centres):
    for xx,yy,ss in centres[i+1:]:
        assert math.hypot(x-xx,y-yy)>4.6*1.06*(s+ss)
assert 3.65 < 4.6*.93*.90
assert 4.05 < 4.6*.93
assert 2.52+.77*.72 < 4.6*.93*.90
assert len(centres)==8
print('PASS: eight non-overlapping islands, shore anchors, bridge transforms, plot footprints')

class Object:
    def __init__(self,kind,parent=None):
        self.type,self.parent=kind,parent
class Scene(dict):
    def __init__(self):
        self.linked=[]
        self.collection=NS(children=NS(link=self.linked.append))
class Scenes:
    def __init__(self): self.created=[]
    def new(self,name):
        result=Scene(); self.created.append(result); return result
class Loader:
    def __init__(self,path,data,source_files):
        self.names=source_files[Path(path).name]
        self.data=data
        self.requested=NS(collections=[])
    def __enter__(self): return NS(collections=self.names),self.requested
    def __exit__(self,*exc):
        if exc[0] is not None: return False
        loaded=[]
        for name in self.requested.collections:
            if name=='SW01_Island_Base_EXPORT':
                objects=[Object('MESH')]
            else:
                root=Object('EMPTY')
                objects=[root,Object('MESH',root)]
            coll=NS(name=name,all_objects=objects)
            self.data.collections[name]=coll
            loaded.append(coll)
        # Reproduce Blender's in-place conversion of string names to Collections.
        self.requested.collections[:]=loaded

with TemporaryDirectory() as folder:
    namespace['SOURCE_FOLDER']=folder
    data=NS(collections={},scenes=Scenes())
    data.libraries=NS(load=lambda path,link=False:Loader(path,data,namespace['SOURCE_FILES']))
    namespace['bpy']=NS(data=data,path=NS(abspath=lambda path:path))
    try:
        namespace['load_sources']()
    except RuntimeError as err:
        assert 'Missing saved checkpoints' in str(err)
    else:
        raise AssertionError('Did not detect missing files')
    assert not data.scenes.created
    print('PASS: missing checkpoint files detected before changing scenes')
    for filename in namespace['SOURCE_FILES']:
        (Path(folder)/filename).touch()
    assets=namespace['load_sources']()
    assert len(assets)==17
    assert len(data.scenes.created)==1
    assert len(data.scenes.created[0].linked)==17
    print('PASS: mocked in-place library append loads 17 collections with valid roots')
    again=namespace['load_sources']()
    assert all(again[name] is coll for name,coll in assets.items())
    assert len(data.scenes.created)==1
    print('PASS: rerun reuses collections without importing duplicates')
    assets['SW03_Landmark_Maths_EXPORT'].all_objects.append(Object('CAMERA'))
    try:
        namespace['load_sources']()
    except RuntimeError as err:
        assert 'unexpected camera/light' in str(err)
    else:
        raise AssertionError('Did not detect contaminated asset collection')
    print('PASS: asset hierarchy/type validation rejects a source camera')
