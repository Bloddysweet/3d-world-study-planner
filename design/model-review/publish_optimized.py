"""Publish ONLY candidates that pass geometry, manifest and browser evidence gates.
Uses the existing exporter publication/rollback helper. Stdlib only.
"""
import ast
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
from compare_geometry import compare
from validate_models import parse_glb, require, ROOT

HERE=Path(__file__).resolve().parent
ORIGINALS=ROOT/'assets/blender/exports-original'
CANDIDATE=ROOT/'.cache/model-optimization/staged'
OUTPUT=ROOT/'public/models'


def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    original=json.loads((ORIGINALS/'manifest.json').read_text())
    manifest=json.loads((CANDIDATE/'manifest.json').read_text())
    browser=json.loads((HERE/'optimization-browser-results.json').read_text())
    require(browser['models']==20 and browser['viewsPerModel']==2 and not browser['errors'],
            'Missing successful browser comparison')
    require(browser['afterKitCalls']<browser['beforeKitCalls'],'Draw call reduction was not verified')
    checks={c['file']:c for c in browser['checks']}
    sources={a['file']:a for a in original['assets']}
    require(len(sources)==20 and {a['file'] for a in manifest['assets']}==set(sources),
            'Candidate file set differs from original exports')
    rows=[]
    for asset in manifest['assets']:
        name=asset['file']
        require(Path(name).name==name and '\\' not in name,'Unsafe filename')
        source,target=ORIGINALS/name,CANDIDATE/name
        require(digest(source)==asset['originalSha256']==checks[name]['originalSha256'],
                name+': original changed after browser comparison')
        require(digest(target)==asset['sha256']==checks[name]['candidateSha256'],
                name+': candidate changed after browser comparison')
        verified=parse_glb(target)
        for key in ('bytes','triangles','meshCount','materialCount'):
            require(verified[key]==asset[key],name+': stale candidate manifest '+key)
        for side in ('min','max'):
            require(max(abs(a-b) for a,b in zip(verified['bounds'][side],sources[name]['bounds'][side]))<.000001,
                    name+': native bounds changed')
        geometry=compare(source,target)
        for view in checks[name]['views']:
            require(view['changedFraction']<=.01,name+': visual comparison failed')
        rows.append({'file':name,'beforeBytes':sources[name]['bytes'],'afterBytes':verified['bytes'],
                     'beforeCalls':checks[name]['beforeCalls'],'afterCalls':checks[name]['afterCalls'],
                     'sha256':digest(target),'originalSha256':digest(source),
                     'triangles':verified['triangles'],**{k:v for k,v in geometry.items() if k!='file'}})
    before_bytes=sum(r['beforeBytes'] for r in rows)
    after_bytes=sum(r['afterBytes'] for r in rows)
    require(after_bytes<before_bytes,'Kit size did not improve')
    manifest['optimization']['verifiedDrawCalls']={'before':browser['beforeKitCalls'],'after':browser['afterKitCalls']}
    manifest['optimization']['verification']='Exact triangle positions, winding, UVs and shader parameters; normal error <=1e-6; two-view browser comparison.'
    manifest['optimization']['note']='Submesh/part names may change after merging. Equivalent materials may share a name; distinct grass and crystal shader parameters remain separate.'
    # The GLBs stay staged for repeatable checks; use a unique publication copy.
    staging=Path(tempfile.mkdtemp(prefix='.study-world-publish-',dir=OUTPUT))
    success=False
    try:
        for asset in manifest['assets']:
            shutil.copyfile(CANDIDATE/asset['file'],staging/asset['file'])
        (staging/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        exporter=ast.parse((ROOT/'assets/blender/scripts/13_export_models.py').read_text())
        helper=next(n for n in exporter.body if isinstance(n,ast.FunctionDef) and n.name=='publish')
        namespace={'Path':Path,'os':os}
        exec(compile(ast.Module(body=[helper],type_ignores=[]),'<publication-helper>','exec'),namespace)
        names=[a['file'] for a in manifest['assets']]+['manifest.json']
        namespace['publish'](staging,OUTPUT,names)
        success=True
    finally:
        if success: shutil.rmtree(staging)
        else: print('Publication recovery files retained:',staging)
    # Package the verified assets for the user's local project. Original backups
    # are not included: the downloaded kit should contain only deployment assets.
    deliverables=ROOT/'deliverables'; deliverables.mkdir(exist_ok=True)
    archive=deliverables/'study-world-optimized-models.zip'
    temporary=archive.with_suffix('.zip.tmp')
    with ZipFile(temporary,'w',compression=ZIP_DEFLATED,compresslevel=9) as zipped:
        for name in names:
            entry=ZipInfo('models/'+name)
            entry.compress_type=ZIP_DEFLATED
            zipped.writestr(entry,(OUTPUT/name).read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=9)
    os.replace(temporary,archive)
    result={'models':20,'beforeBytes':before_bytes,'afterBytes':after_bytes,
            'bytesSavedPercent':100*(1-after_bytes/before_bytes),
            'beforeDrawCalls':browser['beforeKitCalls'],'afterDrawCalls':browser['afterKitCalls'],
            'drawCallsSavedPercent':100*(1-browser['afterKitCalls']/browser['beforeKitCalls']),
            'triangles':sum(r['triangles'] for r in rows),
            'maximumObservedNormalError':max(r['maxNormalError'] for r in rows),
            'worstObservedVisualPixelFraction':max(v['changedFraction'] for c in browser['checks'] for v in c['views']),
            'archiveBytes':archive.stat().st_size,'archiveSha256':digest(archive),'assets':rows}
    (HERE/'optimization-results.json').write_text(json.dumps(result,indent=2)+'\n')
    print('Published',len(rows),'optimized models. Draw calls:',result['beforeDrawCalls'],'->',result['afterDrawCalls'])
    print('Model bytes:',before_bytes,'->',after_bytes)
    print('Download archive:',archive)


if __name__=='__main__': main()
