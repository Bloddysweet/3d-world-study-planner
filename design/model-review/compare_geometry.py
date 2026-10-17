"""Compare every triangle, normal, winding and shader parameters before publication.
Only identity-transform static triangle exports are accepted; fail closed otherwise.
"""
import argparse
from collections import defaultdict
import json
import struct
from pathlib import Path
from validate_models import parse_glb, require, ROOT


def material_key(material):
    require(not any(k.endswith('Texture') for k in material),'Unexpected texture property')
    pbr=material.get('pbrMetallicRoughness',{})
    require(not any(k.endswith('Texture') for k in pbr),'Unexpected PBR texture')
    values={
        'base':pbr.get('baseColorFactor',[1,1,1,1]),
        'metallic':pbr.get('metallicFactor',1),'roughness':pbr.get('roughnessFactor',1),
        'emissive':material.get('emissiveFactor',[0,0,0]),
        'alpha':material.get('alphaMode','OPAQUE'),'cutoff':material.get('alphaCutoff',.5),
        'doubleSided':material.get('doubleSided',False),'extensions':material.get('extensions',{}),
    }
    return json.dumps(values,sort_keys=True,separators=(',',':'))


def surfaces(path):
    parse_glb(path)  # Full binary/bounds sanity checks before examining attributes.
    data=path.read_bytes()
    size=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+size]); binary=data[28+size:]
    require(all(not any(k in n for k in ('matrix','rotation','scale','translation'))
                for n in doc['nodes']),'Nonidentity nodes need world-space comparison')
    references=[n['mesh'] for n in doc['nodes'] if 'mesh' in n]
    require(sorted(references)==list(range(len(doc['meshes']))),'Unexpected mesh instance references')
    formats={5126:('f',4),5121:('B',1),5123:('H',2),5125:('I',4)}
    def accessor(index):
        a=doc['accessors'][index]; view=doc['bufferViews'][a['bufferView']]
        code,size=formats[a['componentType']]
        width={'VEC2':2,'VEC3':3,'SCALAR':1}[a['type']]
        start=view.get('byteOffset',0)+a.get('byteOffset',0)
        stride=view.get('byteStride',size*width)
        return [struct.unpack_from('<'+code*width,binary,start+i*stride) for i in range(a['count'])]
    records=defaultdict(list)
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            require(set(primitive['attributes']) in ({'POSITION','NORMAL'},{'POSITION','NORMAL','TEXCOORD_0'}),
                    'Unknown vertex semantics; cannot compare safely')
            points=accessor(primitive['attributes']['POSITION'])
            normals=accessor(primitive['attributes']['NORMAL'])
            uv=accessor(primitive['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in primitive['attributes'] else None
            indices=[v[0] for v in accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(points)))
            shader=material_key(doc['materials'][primitive['material']])
            for offset in range(0,len(indices),3):
                corners=indices[offset:offset+3]
                # Canonicalise only CYCLIC rotations, never reverse winding.
                options=[corners[i:]+corners[:i] for i in range(3)]
                corners=min(options,key=lambda ids:tuple((points[i],uv[i] if uv else ()) for i in ids))
                position=tuple(value for i in corners for value in points[i])
                normal=tuple(value for i in corners for value in normals[i])
                coordinates=tuple(value for i in corners for value in uv[i]) if uv else ()
                records[(shader,position,coordinates)].append(normal)
    return records


def compare(original,candidate):
    before,after=surfaces(original),surfaces(candidate)
    # Position coordinates must match EXACTLY. No geometry simplification/quantization.
    require(before.keys()==after.keys(),original.name+': geometry, winding or shader changed')
    max_normal_error=0
    for key,normal_set in before.items():
        a,b=sorted(normal_set),sorted(after[key])
        require(len(a)==len(b),original.name+': triangle multiplicity changed')
        for left,right in zip(a,b):
            error=max(abs(x-y) for x,y in zip(left,right))
            require(error<=.000001,original.name+': normal changed beyond float tolerance')
            max_normal_error=max(max_normal_error,error)
    return {'file':original.name,'triangles':sum(map(len,before.values())),
            'positionsExact':True,'windingExact':True,'materialsExact':True,'uvsExact':True,
            'maxNormalError':max_normal_error}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--originals',type=Path,default=ROOT/'assets/blender/exports-original')
    parser.add_argument('--candidate',type=Path,default=ROOT/'.cache/model-optimization/staged')
    parser.add_argument('--output',type=Path,default=ROOT/'.cache/model-optimization/geometry-comparison.json')
    args=parser.parse_args()
    manifest=json.loads((args.originals/'manifest.json').read_text())
    checks=[]
    for item in manifest['assets']:
        check=compare(args.originals/item['file'],args.candidate/item['file'])
        checks.append(check)
        print('PASS',check['file'],'exact positions/winding/materials; max normal error',check['maxNormalError'])
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({'models':len(checks),'checks':checks},indent=2)+'\n')


if __name__=='__main__':
    main()
