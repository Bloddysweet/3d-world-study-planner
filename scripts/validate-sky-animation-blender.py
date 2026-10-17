"""Offline audit of Script 18. Does NOT claim actual Blender execution."""
import ast
import base64
import hashlib
import json
from pathlib import Path
import zlib

path = Path('assets/blender/scripts/18_aurel_flight_animation.py')
source = path.read_text()
tree = ast.parse(source)
compile(tree, str(path), 'exec')
payload = next(n.value.value for n in tree.body if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id == 'PAYLOAD')
recipe = json.loads(zlib.decompress(base64.b64decode(payload)))
assert recipe == json.loads(Path('.cache/sky-animation/source-recipe.json').read_text())
assert len(recipe['bones']) == 16
assert len(recipe['positions']) // 9 == 10188
assert len(recipe['positions']) == len(recipe['colors'])
vertices = len(recipe['positions']) // 3
assert len(recipe['skinIndices']) == len(recipe['skinWeights']) == vertices * 4
assert [c['name'] for c in recipe['clips']] == ['Wingbeat', 'Glide', 'TailSway']
for i in range(vertices):
    assert abs(sum(recipe['skinWeights'][i*4:i*4+4]) - 1) < 1e-6
    assert all(0 <= w <= 1 for w in recipe['skinWeights'][i*4:i*4+4])
    assert all(isinstance(b, int) and 0 <= b < 16 for b in recipe['skinIndices'][i*4:i*4+4])
for node in ast.walk(tree):
    if isinstance(node, ast.Import):
        assert all(n.name in {'bpy', 'json', 'zlib', 'base64'} for n in node.names)
    if isinstance(node, ast.ImportFrom):
        assert node.module == 'mathutils'
    if isinstance(node, ast.Call):
        name = ast.unparse(node.func)
        assert name not in {'exec', 'eval', 'open', 'compile', '__import__'}
        assert not any(w in name.rsplit('.', 1)[-1].lower() for w in ('save', 'export', 'delete', 'remove', 'unlink', 'rmdir', 'system', 'request', 'urlopen'))
        if name.startswith('bpy.ops.'):
            assert name == 'bpy.ops.object.mode_set', name
assert 'bpy.data.scenes.new(' in source
assert 'BLENDER_EEVEE_NEXT' not in source
assert 'BLENDER_EEVEE' in source
assert not any(isinstance(n, ast.Attribute) and ast.unparse(n) == 'action.fcurves' for n in ast.walk(tree))  # no legacy API
assert "point.interpolation = 'LINEAR'" in source
assert '(p[i],-p[i+2],p[i+1])' in source
assert 'scene.render.filepath' not in source
assert 'modifier.object = arm' in source
assert 'bone.keyframe_insert(' in source
assert "scene.frame_end = max(1,round(scene['sw18_duration_'+name]*30))" in source
meta = json.loads(Path('design/sky-creature/animation-manifest.json').read_text())
assert meta['sha256'] in source
preserved = 0
prior = Path('.cache/sky-animation/protected-hashes.json')
if prior.exists():
    for name, sha in json.loads(prior.read_text()).items():
        assert hashlib.sha256(Path(name).read_bytes()).hexdigest() == sha, name
        preserved += 1
report = {'syntax': True, 'fullSourcePayloadMatches': True, 'normalizedWeights': True, 'onlyOperatorIsModeSet': True, 'newSceneAndNoSaveExportDeletionNetwork': True, 'slottedActionsAndLinearKeys': True, 'preservedFiles': preserved, 'blenderRuntimeExecuted': False}
Path('.cache/sky-animation/blender-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('PASS Script 18: syntax, complete offline rig/weights/actions, safe new scene; Blender runtime NOT verified')
