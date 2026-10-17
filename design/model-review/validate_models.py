"""Validate uploaded static GLBs and compare their real geometry with manifest.json.
Standard-library only. Does not execute or trust code in the uploaded archive.
"""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT/'public'/'models'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def multiply(a,b):
    return [[sum(a[r][k]*b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def transform(node):
    if 'matrix' in node:
        values=node['matrix']
        require(len(values)==16,'Invalid node matrix')
        return [[values[c*4+r] for c in range(4)] for r in range(4)]
    x,y,z,w=node.get('rotation',(0,0,0,1))
    scale=node.get('scale',(1,1,1))
    translation=node.get('translation',(0,0,0))
    r=[[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
       [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
       [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]]
    return [[r[a][b]*scale[b] for b in range(3)]+[translation[a]] for a in range(3)]+[[0,0,0,1]]


def parse_glb(path):
    data=path.read_bytes()
    require(len(data)>=20,'Truncated header')
    magic,version,length=struct.unpack_from('<4sII',data)
    require(magic==b'glTF' and version==2 and length==len(data),'Invalid GLB header')
    chunks=[]
    offset=12
    while offset<len(data):
        require(offset+8<=len(data),'Truncated chunk header')
        size,kind=struct.unpack_from('<I4s',data,offset)
        offset+=8
        require(size%4==0 and offset+size<=len(data),'Invalid chunk size')
        chunks.append((kind,data[offset:offset+size]))
        offset+=size
    require(len(chunks)==2 and chunks[0][0]==b'JSON' and chunks[1][0]==b'BIN\x00',
            'Expected one JSON and one binary chunk')
    doc=json.loads(chunks[0][1].decode('utf-8'))
    binary=chunks[1][1]
    require(doc.get('asset',{}).get('version')=='2.0','Not glTF 2.0')
    require(len(doc.get('buffers',[]))==1,'Expected a single embedded buffer')
    require(not doc['buffers'][0].get('uri'),'External buffer dependency')
    require(doc['buffers'][0]['byteLength']<=len(binary),'Truncated binary data')
    require(not doc.get('cameras') and not doc.get('animations') and not doc.get('skins'),
            'Unexpected camera, animation or skin')
    require(not doc.get('images') and not doc.get('textures'),'Unexpected texture dependency')
    for view in doc.get('bufferViews',[]):
        require(view.get('buffer',0)==0,'Unexpected buffer index')
        require(view.get('byteOffset',0)+view['byteLength']<=len(binary),'Buffer view out of range')
    require(doc.get('meshes') and doc.get('nodes'),'Missing meshes/nodes')
    materials=doc.get('materials',[])
    require(materials,'Missing materials')
    for material in materials:
        require(material.get('alphaMode','OPAQUE')=='OPAQUE','Unexpected transparent material')
        for value in material.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1]):
            require(math.isfinite(value) and 0<=value<=1,'Invalid material colour')
    for node in doc['nodes']:
        require(not node.get('extras'),'Demo metadata leaked into export')
        require('KHR_lights_punctual' not in node.get('extensions',{}),'Unexpected light')
    accessors=doc.get('accessors',[])
    formats={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
    components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

    def read_accessor(index):
        accessor=accessors[index]
        require('sparse' not in accessor,'Sparse accessor needs additional validation')
        code,size=formats[accessor['componentType']]
        width=components[accessor['type']]
        view=doc['bufferViews'][accessor['bufferView']]
        stride=view.get('byteStride',size*width)
        start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        end=start+(accessor['count']-1)*stride+size*width
        require(accessor['count']>0 and end<=view.get('byteOffset',0)+view['byteLength'],
                'Accessor out of bounds')
        rows=[struct.unpack_from('<'+code*width,binary,start+i*stride) for i in range(accessor['count'])]
        require(all(math.isfinite(v) for row in rows for v in row),'Non-finite accessor data')
        return rows

    positions={}
    triangles=0
    primitive_count=0
    for mesh_index,mesh in enumerate(doc['meshes']):
        require(mesh.get('primitives'),'Empty mesh')
        mesh_points=[]
        for primitive in mesh['primitives']:
            primitive_count+=1
            require(primitive.get('mode',4)==4,'Non-triangle primitive')
            require('POSITION' in primitive['attributes'],'Missing vertex positions')
            points=read_accessor(primitive['attributes']['POSITION'])
            require(len(points[0])==3,'Positions are not VEC3')
            if 'indices' in primitive:
                indices=read_accessor(primitive['indices'])
                require(all(0<=row[0]<len(points) for row in indices),'Index exceeds vertex count')
                count=len(indices)
            else:
                count=len(points)
            require(count%3==0,'Incomplete triangle')
            triangles+=count//3
            require(0<=primitive.get('material',0)<len(materials),'Invalid material reference')
            mesh_points.extend(points)
        positions[mesh_index]=mesh_points
    identity=[[float(i==j) for j in range(4)] for i in range(4)]
    low,high=[float('inf')]*3,[float('-inf')]*3
    visited=set()

    def visit(index,parent):
        require(index not in visited,'Node graph contains a cycle or duplicate parent')
        visited.add(index)
        node=doc['nodes'][index]
        world=multiply(parent,transform(node))
        require(all(math.isfinite(v) for row in world for v in row),'Invalid node transform')
        if 'mesh' in node:
            for point in positions[node['mesh']]:
                p=list(point)+[1]
                result=[sum(world[r][k]*p[k] for k in range(4)) for r in range(3)]
                for axis in range(3):
                    low[axis],high[axis]=min(low[axis],result[axis]),max(high[axis],result[axis])
        for child in node.get('children',[]):
            visit(child,world)
    scenes=doc.get('scenes',[])
    require(len(scenes)==1,'Unexpected multiple scenes')
    for index in scenes[doc.get('scene',0)].get('nodes',[]):
        visit(index,identity)
    require(len(visited)==len(doc['nodes']),'Unreachable exported nodes')
    require(all(math.isfinite(v) for v in low+high),'Empty scene bounds')
    return {'bytes':len(data),'triangles':triangles,'meshCount':len(doc['meshes']),
            'primitiveCount':primitive_count,'materialCount':len(materials),
            'bounds':{'min':low,'max':high},'sha256':hashlib.sha256(data).hexdigest(),
            'extensions':doc.get('extensionsUsed',[])}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--models',type=Path,default=MODELS)
    parser.add_argument('--output',type=Path,default=Path(__file__).parent/'validation-results.json')
    args=parser.parse_args()
    manifest=json.loads((args.models/'manifest.json').read_text())
    require(manifest.get('generator')=='study-world-step-13-v1','Unexpected export manifest')
    assets=manifest['assets']
    require(len(assets)==20,'Expected 20 model exports')
    require(len({a['file'] for a in assets})==20,'Duplicate filenames')
    results=[]
    for asset in assets:
        filename=asset['file']
        require(Path(filename).name==filename and '\\' not in filename,'Unsafe filename')
        result=parse_glb(args.models/filename)
        for field in ('bytes','triangles','meshCount','materialCount'):
            require(result[field]==asset[field],filename+': manifest mismatch: '+field)
        for side in ('min','max'):
            error=max(abs(a-b) for a,b in zip(asset['bounds'][side],result['bounds'][side]))
            require(error<.0001,filename+': native bounds mismatch')
        require(max(abs(v) for side in result['bounds'].values() for v in side)<10,
                filename+': unexpected world-placement offset')
        results.append({'file':filename,'kind':asset['kind'],**result})
        print('PASS',filename,result['triangles'],'triangles;',result['bytes'],'bytes')
    require(abs(results[0]['bounds']['min'][1]-results[1]['bounds']['min'][1])>.1,
            'Island variants have identical depth')
    report={'models':len(results),'totalBytes':sum(a['bytes'] for a in results),
            'totalTriangles':sum(a['triangles'] for a in results),
            'totalPrimitives':sum(a['primitiveCount'] for a in results),'assets':results}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print('ALL PASS:',report['models'],'models;',report['totalBytes'],'bytes;',report['totalTriangles'],'triangles')


if __name__=='__main__':
    main()
