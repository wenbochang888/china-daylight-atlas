import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = name => JSON.parse(readFileSync(new URL('../public/maps/'+name,import.meta.url),'utf8'));
const index=read('index.json');
const ids=new Set(index.map(n=>n.id));
assert.equal(ids.size,index.length,'duplicate region identifier');
assert.equal(index.filter(n=>n.level==='province').length,34);
assert.equal(index.filter(n=>n.level==='auxiliary').length,3);
assert.equal(index.filter(n=>n.provinceId==='156620000'&&n.level==='city').length,14);
const menu=JSON.parse(readFileSync(new URL('../data/source/official/menu.json',import.meta.url),'utf8'));
const expected=new Set();
function visit(n){if(n.gb!=='156000000')expected.add(n.gb);n.children.forEach(visit);}
menu.data.forEach(visit);
assert.deepEqual(ids,expected,'official menu coverage');
for(const node of index){
  assert(node.parentId===null||ids.has(node.parentId),`orphan ${node.name}`);
  assert(node.bounds.every(Number.isFinite),`invalid bounds ${node.name}`);
  assert(node.center.every(Number.isFinite),`invalid label ${node.name}`);
  assert(node.children.every(id=>index.find(n=>n.id===id)?.parentId===node.id));
}
const files=['provinces.json',...index.filter(n=>n.level==='province').flatMap(n=>[`regions/${n.id}-city.json`,`regions/${n.id}-county.json`])];
const shapes=new Set();
const rawPath=new URL('../data/source/official/',import.meta.url);
const originals=new Map();
for(const file of readdirSync(rawPath).filter(f=>f.endsWith('.json')&&!['menu.json','snapshot.json'].includes(f))){
  for(const feature of JSON.parse(readFileSync(new URL(file,rawPath),'utf8')).features){
    if(feature.geometry.type.includes('Polygon'))originals.set(feature.properties.gb,feature.geometry);
  }
}
for(const feature of JSON.parse(readFileSync(new URL('provinces.json',rawPath),'utf8')).features){
  if(index.find(n=>n.id===feature.properties.gb)?.level==='province')originals.set(feature.properties.gb,feature.geometry);
}
for(const file of files)for(const f of read(file).features){
  shapes.add(f.id);
  assert.deepEqual(f.geometry,originals.get(f.id),`geometry modified ${f.id}`);
  const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  for(const polygon of polygons)for(const ring of polygon){
    assert(ring.length>=4,`short ring ${f.id}`);
    assert.deepEqual(ring[0],ring.at(-1),`open ring ${f.id}`);
    assert(ring.every(p=>p.every(Number.isFinite)),`nonfinite ${f.id}`);
  }
}
assert.deepEqual(shapes,ids,'geometries are incomplete');
assert.equal(index.filter(n=>n.provinceId==='156810000'&&n.level!=='province').length,18);
assert.equal(index.filter(n=>n.provinceId==='156710000'&&n.level!=='province').length,20);
const hainan=read('provinces.json').features.find(f=>f.id==='156460000');
assert(hainan.geometry.coordinates.flat(2).some(p=>p[1]<5),'southern islands absent');
const taiwan=read('provinces.json').features.find(f=>f.id==='156710000');
assert(taiwan.geometry.coordinates.flat(2).some(p=>p[0]>123),'eastern islands absent');
assert(read('context/boundaries.json').features.length>0);
assert(read('context/boundaries.json').features.every(f=>f.properties.gb));
const sourceLines=JSON.parse(readFileSync(new URL('provinces.json',rawPath),'utf8')).features.filter(f=>f.geometry.type.includes('Line'));
read('context/boundaries.json').features.forEach((f,i)=>{
  assert.deepEqual(f.geometry,sourceLines[i].geometry,'boundary geometry modified');
  assert.equal(f.properties.gb,sourceLines[i].properties.gb,'boundary class modified');
});
for(const snapshot of read('manifest.json').snapshots){
  assert.equal(createHash('sha256').update(readFileSync(new URL(snapshot.file,rawPath))).digest('hex'),snapshot.sha256,`snapshot checksum ${snapshot.file}`);
}
console.log(`PASS: ${ids.size} official regions, 34 provinces; menu, hierarchy, rings, Hong Kong, Taiwan and island extents checked.`);
