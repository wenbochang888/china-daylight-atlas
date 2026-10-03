import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'data/source/official');
const output = path.join(root, 'public/maps');
const read = name => JSON.parse(readFileSync(path.join(source, name), 'utf8'));
const write = (name, data) => {
  mkdirSync(path.dirname(path.join(output, name)), { recursive: true });
  writeFileSync(path.join(output, name), JSON.stringify(data));
};
const collection = features => ({ type: 'FeatureCollection', features });
const nodes = new Map();
const auxiliaryIds = new Set(['156629700', '156629800', '156629900']);
const provinces = read('menu.json').data[0].children;
const snapshotInfo = read('snapshot.json');
function traverse(node, province, parent, depth) {
  if (!nodes.has(node.gb)) nodes.set(node.gb, {
    id: node.gb, name: node.name, provinceId: province.gb,
    parentId: parent, level: auxiliaryIds.has(node.gb) ? 'auxiliary' : depth === 1 ? 'province' :
      depth >= 3 || ['71','81'].includes(province.gb.slice(3,5)) || !node.gb.endsWith('00') ? 'county' : 'city',
  });
  for (const child of node.children) {
    traverse(child, province, child.gb === node.gb ? parent : node.gb,
      child.gb === node.gb ? depth : depth + 1);
  }
}
for (const p of provinces) traverse(p, p, null, 1);
const geometry = new Map();
const snapshots = [];
for (const name of readdirSync(source).filter(n => n.endsWith('.json') && !['menu.json','snapshot.json'].includes(n)).sort()) {
  const raw = read(name);
  snapshots.push({ file: name, sha256: createHash('sha256').update(readFileSync(path.join(source,name))).digest('hex') });
  for (const feature of raw.features) {
    if (feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'Polygon') {
      geometry.set(feature.properties.gb, feature);
    }
  }
}
// The country overview is the source of province shapes and sovereign context.
const overview = read('provinces.json');
for (const feature of overview.features) {
  if (nodes.get(feature.properties.gb)?.level === 'province') geometry.set(feature.properties.gb, feature);
}
function coordinates(value, target = []) {
  if (typeof value[0] === 'number') target.push(value);
  else for (const child of value) coordinates(child, target);
  return target;
}
function labelPosition(feature) {
  const p = feature.properties;
  if (Number.isFinite(p.lng) && Number.isFinite(p.lat) && p.lng > 70 && p.lat > 0) return [p.lng, p.lat];
  const points = coordinates(feature.geometry.coordinates);
  return points[Math.floor(points.length / 2)].slice(0, 2);
}
function inRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0]-a[0]) * (point[1]-a[1]) / (b[1]-a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function inPolygon(point, polygon) { return inRing(point, polygon[0]) && !polygon.slice(1).some(ring => inRing(point, ring)); }
function representative(feature, label) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  if (polygons.some(polygon => inPolygon(label, polygon))) return label;
  const ranked = polygons.map(polygon => {
    const ring = polygon[0];
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    return { polygon, box, area: (box[2]-box[0]) * (box[3]-box[1]) };
  }).sort((a,b) => b.area-a.area);
  for (const { polygon, box } of ranked) {
    for (let resolution = 10; resolution <= 80; resolution *= 2) {
      let best = null, distance = Infinity;
      for (let x = 1; x < resolution; x++) for (let y = 1; y < resolution; y++) {
        const point = [box[0] + (box[2]-box[0])*x/resolution, box[1] + (box[3]-box[1])*y/resolution];
        const d = Math.hypot(point[0]-label[0], point[1]-label[1]);
        if (d < distance && inPolygon(point, polygon)) { best = point; distance = d; }
      }
      if (best) return best;
    }
  }
  throw new Error('Unable to find internal representative point: '+feature.properties.gb);
}
const features = [];
for (const node of nodes.values()) {
  const feature = geometry.get(node.id);
  if (!feature) throw new Error(`Official menu has no geometry: ${node.id} ${node.name}`);
  const points = coordinates(feature.geometry.coordinates);
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng,lat] of points) {
    bounds[0] = Math.min(bounds[0],lng); bounds[1] = Math.min(bounds[1],lat);
    bounds[2] = Math.max(bounds[2],lng); bounds[3] = Math.max(bounds[3],lat);
  }
  node.bounds = bounds;
  node.labelCenter = labelPosition(feature);
  node.center = representative(feature, node.labelCenter);
  node.pointKind = node.center === node.labelCenter ? '官方地图标注点' : '区域内部代表点（由官方边界计算）';
  node.levelNote = node.id === '156632857' ? '对应管理层级' : null;
  node.children = [...nodes.values()].filter(n => n.parentId === node.id && n.level !== 'auxiliary').map(n => n.id);
  features.push({ type: 'Feature', id: node.id, properties: {
    id: node.id, name: node.name, level: node.level, provinceId: node.provinceId,
  }, geometry: feature.geometry });
}
const lines = overview.features.filter(f => f.geometry.type.includes('Line')).map((f,i) => ({ ...f, id: `boundary-${i}`, properties: { ...f.properties, name: f.properties.name || '境界线' } }));
write('provinces.json', collection(features.filter(f => f.properties.level === 'province')));
write('context/boundaries.json', collection(lines));
const labels = features.map(f => ({ type:'Feature', id:f.id, properties:f.properties,
  geometry:{type:'Point',coordinates:nodes.get(f.id).labelCenter} }));
write('labels.json', collection(labels));
const annotationSource=JSON.parse(readFileSync(path.join(root,'data/source/island-annotations.json'),'utf8'));
const annotations=annotationSource.points.map(point=>{
  let position=point.coordinates;
  if(point.regionAnchor)position=nodes.get(point.regionAnchor).labelCenter;
  if(point.geometryAnchor==='zhongsha'){
    const points=coordinates(geometry.get('156460321').geometry.coordinates)
      .filter(([lng,lat])=>lng>113&&lng<116&&lat>14&&lat<17);
    if(!points.length)throw new Error('Missing official Zhongsha geometry');
    position=[(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,
      (Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2];
  }
  return{type:'Feature',properties:{name:point.name,kind:point.kind},geometry:{type:'Point',coordinates:position}};
});
write('context/island-labels.json',collection(annotations));
for (const p of provinces) {
  for (const level of ['city','county']) write(`regions/${p.gb}-${level}.json`,
    collection(features.filter(f => f.properties.provinceId === p.gb && (f.properties.level === level || level === 'city' && f.properties.level === 'auxiliary'))));
}
write('index.json', [...nodes.values()]);
const coverage = provinces.map(p => ({ name:p.name,id:p.gb,
  city:features.filter(f=>f.properties.provinceId===p.gb&&f.properties.level==='city').length,
  county:features.filter(f=>f.properties.provinceId===p.gb&&f.properties.level==='county').length }));
write('manifest.json', {
  version:`tianditu-public-${snapshotInfo.fetchedAt.slice(0,10)}`, fetchedAt:snapshotInfo.fetchedAt,
  source:'国家地理信息公共服务平台·天地图',
  sourceUrl:'https://cloudcenter.tianditu.gov.cn/administrativeDivision',
  coordinateSystem:'Original geographic longitude/latitude; datum not explicitly declared by public response; no GCJ-02 offset applied',
  regions:nodes.size, administrativeAndCorrespondingRegions:nodes.size-auxiliaryIds.size, auxiliaryRegions:auxiliaryIds.size,
  sourceUpdate:snapshotInfo.sourceUpdate, provinces:34, boundaryFeatures:lines.length,
  coverage, snapshots: [{ file:'menu.json',sha256:createHash('sha256').update(readFileSync(path.join(source,'menu.json'))).digest('hex') }, ...snapshots],
});
mkdirSync(path.join(root,'docs/data'),{recursive:true});
writeFileSync(path.join(root,'docs/data/coverage.md'),
  '# 官方地图数据覆盖核验\n\n取得日期：2026-10-02。基准为天地图公开行政区目录；所有目录节点均取得官方几何，缺失为 0。保留官方的节点编码与实际层级，不冒称全部属于 GB/T 编码。\n\n'+
  '| 省级区域 | 市级节点 | 县级／对应层级节点 |\n|---|---:|---:|\n'+coverage.map(p=>`| ${p.name} | ${p.city} | ${p.county} |`).join('\n')+
  '\n\n官方目录共 3253 节点：3250 个行政／对应层级节点，3 个地图辅助区域（中农发山丹马场、莲花山风景林自然保护区、太子山天然林保护区）。辅助几何保留，排除省市县目录和正式计数。大柴旦行政委员会注明对应管理层级。台湾采用官方目录中 20 个县市对应层级，香港 18 区，澳门目录无下级节点，不虚构县区。南海诸岛与钓鱼岛及其附属岛屿保留在官方省级多部件几何中；境界线原始属性和几何保留。所有几何不做边界简化，不将内部区县并集替代国界。标注点在面外时，详情使用边界内计算代表点并明确注明，不冒称行政驻地。官方页面标示数据更新为2025年9月局部更新，取得日期不等于行政区生效日期。\n');
console.log(`Prepared ${nodes.size} official regions, 34 provinces, ${lines.length} boundary features.`);
