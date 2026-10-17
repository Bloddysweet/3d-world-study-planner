"""Negative controls for the geometry/material-equivalence gate (stdlib only)."""
import json
from pathlib import Path
import struct
from tempfile import TemporaryDirectory
import unittest
from compare_geometry import compare


def glb(joined=False, edit=None, renamed=False):
    points=[(0,0,0),(1,0,0),(0,1,0),(1,0,0),(1,1,0),(0,1,0)]
    normals=[(0,0,1)]*6
    uv=[(p[0],p[1]) for p in points]
    if edit=='position': points[0]=(.0000001,0,0)
    if edit=='normal': normals[0]=(.02,0,1)
    if edit=='normal_tiny': normals[0]=(.0000001,0,1)
    if edit=='uv': uv[0]=(.02,0)
    if edit=='winding':
        for values in (points,normals,uv): values[1],values[2]=values[2],values[1]
    buffer=bytearray(); views=[]; accessors=[]; primitives=[]
    ranges=[range(6)] if joined else [range(3),range(3,6)]
    if edit=='duplicate': ranges.append(range(3))
    for indexes in ranges:
        attributes={}
        for name,data,width in [('POSITION',points,3),('NORMAL',normals,3),('TEXCOORD_0',uv,2)]:
            values=[v for i in indexes for v in data[i]]
            payload=struct.pack('<'+'f'*len(values),*values)
            offset=len(buffer); buffer.extend(payload)
            views.append({'buffer':0,'byteOffset':offset,'byteLength':len(payload)})
            accessors.append({'bufferView':len(views)-1,'componentType':5126,
                              'count':len(indexes),'type':'VEC'+str(width)})
            attributes[name]=len(accessors)-1
        primitives.append({'attributes':attributes,'material':0})
    document={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}],
              'nodes':[{'mesh':0}], 'meshes':[{'primitives':primitives}],
              'buffers':[{'byteLength':len(buffer)}],'bufferViews':views,'accessors':accessors,
              'materials':[{'name':'renamed' if renamed else 'surface',
                            'pbrMetallicRoughness':{'baseColorFactor':[.4,.6,.2,1],
                             'roughnessFactor':.2 if edit=='material' else .7,'metallicFactor':0}}]}
    encoded=json.dumps(document).encode(); encoded+=b' '*((-len(encoded))%4)
    return struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(buffer))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(buffer),b'BIN\0')+buffer


class EquivalenceTests(unittest.TestCase):
    def run_comparison(self,edit=None,renamed=False):
        with TemporaryDirectory() as folder:
            a,b=Path(folder)/'original.glb',Path(folder)/'candidate.glb'
            a.write_bytes(glb())
            b.write_bytes(glb(joined=True,edit=edit,renamed=renamed))
            return compare(a,b)

    def test_merging_mesh_boundaries_preserves_surface(self):
        self.assertEqual(self.run_comparison()['triangles'],2)

    def test_material_display_names_do_not_change_shading(self):
        self.assertTrue(self.run_comparison(renamed=True)['materialsExact'])

    def test_tiny_normal_roundoff_is_tolerated(self):
        self.assertLess(self.run_comparison(edit='normal_tiny')['maxNormalError'],.000001)

    def test_rejects_geometry_material_uv_winding_or_multiplicity_changes(self):
        for edit in ('position','normal','uv','winding','material','duplicate'):
            with self.subTest(edit=edit), self.assertRaises(ValueError):
                self.run_comparison(edit=edit)


if __name__=='__main__':
    unittest.main(verbosity=2)
