"""Offline syntax, embedded geometry and safety audit. NOT a Blender runtime test."""
import ast
import base64
import hashlib
import json
from pathlib import Path
import zlib

script = Path('assets/blender/scripts/17_aurel_sky_drake.py')
tree = ast.parse(script.read_text())
compile(tree, str(script), 'exec')
payload = next(n.value.value for n in tree.body if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id == 'PAYLOAD')
recipe = json.loads(zlib.decompress(base64.b64decode(payload)))
assert len(recipe['meshes']) == 13
assert sum(len(m['positions']) // 9 for m in recipe['meshes']) == 10188
assert len({m['name'] for m in recipe['meshes']}) == 13
for mesh in recipe['meshes']:
    assert len(mesh['positions']) == len(mesh['colors'])
    assert len(mesh['positions']) % 9 == 0
    assert all(isinstance(x, (int, float)) and abs(x) < 100 for x in mesh['positions'])
    assert all(0 <= c <= 1 for c in mesh['colors'])
# Restrict all imports to the in-memory, offline construction API.
for n in ast.walk(tree):
    if isinstance(n, ast.Import):
        assert all(i.name in {'bpy', 'json', 'zlib', 'base64'} for i in n.names)
    if isinstance(n, ast.ImportFrom):
        assert n.module == 'mathutils'
    if isinstance(n, ast.Call):
        name = ast.unparse(n.func)
        assert name not in {'eval', 'exec', 'open', 'compile', '__import__'}
        assert not any(word in name.rsplit('.', 1)[-1].lower() for word in ('save', 'export', 'delete', 'remove', 'unlink', 'rmdir', 'system', 'request', 'urlopen'))
    if isinstance(n, ast.Call):
        assert not ast.unparse(n.func).startswith('bpy.ops.')
source_recipe = Path('.cache/sky-creature/source-recipe.json')
assert source_recipe.exists(), 'Run validate-sky-creature.mjs first'
assert recipe == json.loads(source_recipe.read_text()), 'Embedded mesh/colour payload differs from the GLB source'
source = script.read_text()
assert 'bpy.data.scenes.new(' in source
assert 'BLENDER_EEVEE_NEXT' not in source
assert 'BLENDER_EEVEE' in source
assert 'scene.render.filepath' not in source
assert '(p[i],-p[i+2],p[i+1])' in source  # determinant +1: preserves winding
meta = json.loads(Path('design/sky-creature/manifest.json').read_text())
assert meta['sha256'] in source
# Assert all previously supplied scripts and app model assets remain byte-identical.
prior = Path('.cache/sky-creature/existing-hashes.json')
preserved = 0
if prior.exists():
    for path, expected in json.loads(prior.read_text()).items():
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected, path
        preserved += 1
report = {'pythonSyntax': True, 'embeddedPayload': True, 'parts': 13, 'triangles': 10188, 'noDestructiveOrFileOrNetworkCalls': True, 'newSceneOnly': True, 'existingFilesHashPreserved': preserved, 'blenderRuntimeExecuted': False}
Path('.cache/sky-creature').mkdir(parents=True, exist_ok=True)
Path('.cache/sky-creature/blender-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('PASS Script 17: Python syntax, full offline payload, safe new scene, previous assets preserved; Blender runtime NOT verified')
