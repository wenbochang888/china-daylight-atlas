import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as LibreMap, StyleSpecification } from 'maplibre-gl';
import { SolarLayer } from './solar-layer';
import { mapColors } from './colors';

export const emptyCollection: FeatureCollection = { type: 'FeatureCollection', features: [] };
export const mapStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': mapColors.ocean } }],
};
export function installLayers(map: LibreMap, provinces: FeatureCollection, boundaries: FeatureCollection, labels: FeatureCollection, islandLabels: FeatureCollection, inset = false) {
  for (const [id, data] of Object.entries({ provinces, boundaries, labels, islandLabels })) {
    map.addSource(id, { type: 'geojson', data, tolerance: 0, buffer: 128 });
  }
  map.addLayer({ id: 'province-fill', type: 'fill', source: 'provinces', paint: { 'fill-color': mapColors.land, 'fill-opacity': 1 } });
  const solar = new SolarLayer(); map.addLayer(solar);
  map.addLayer({ id: 'province-edge', type: 'line', source: 'provinces', paint: { 'line-color': '#e7f3f8', 'line-opacity': 0.55, 'line-width': inset ? 1.3 : 2.2 } });
  map.addLayer({ id: 'province-line', type: 'line', source: 'provinces', paint: { 'line-color': mapColors.boundary, 'line-width': inset ? 0.7 : 1.2 } });
  map.addLayer({ id: 'sovereign-boundary', type: 'line', source: 'boundaries',
    filter: ['!', ['in', ['get', 'gb'], ['literal', ['156970000', '156980000']]]],
    paint: { 'line-color': mapColors.boundary, 'line-width': inset ? 1 : 1.4 } });
  map.addLayer({ id: 'sovereign-dashed', type: 'line', source: 'boundaries',
    filter: ['in', ['get', 'gb'], ['literal', ['156970000', '156980000']]],
    paint: { 'line-color': ['match', ['get', 'gb'], '156980000', '#3b82f6', '#fff'], 'line-width': inset ? 1 : 2, 'line-dasharray': [2.5, 2.5] } });
  for (const [id, color, width] of [['selected-outline', mapColors.night, 5], ['selected-provinces', mapColors.accent, 3]] as const) {
    map.addLayer({ id, type: 'line', source: 'provinces',
      filter: ['==', ['get', 'id'], ''], paint: { 'line-color': color, 'line-width': width } });
  }
  if (!inset) {
    map.addSource('province-label-guides', {type:'geojson',data:emptyCollection});
    map.addLayer({id:'province-label-guides',type:'line',source:'province-label-guides',paint:{'line-color':mapColors.boundary,'line-opacity':0.65,'line-width':0.8}});
  }
  const permanent=['156110000','156120000','156310000','156500000','156810000','156820000','156460000'];
  for (const level of (inset ? [] : ['province'])) map.addLayer({ id: `labels-${level}`, type: 'symbol', source: 'labels',
    filter: ['all', ['==', ['get', 'displayLevel'], level], ['!', ['in', ['get', 'id'], ['literal', [...permanent,'156710000']]]]],
    layout: { 'text-field': ['get', 'name'], 'text-font': ['sans-serif'],
      'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true,
      'text-padding': 2, 'text-max-width': 8 },
    paint: { 'text-color': mapColors.night, 'text-halo-color': '#fff', 'text-halo-width': 1.2 } });
  if(!inset)map.addLayer({id:'key-province-labels',type:'symbol',source:'labels',
    filter:['in',['get','id'],['literal',permanent]],
    layout:{'text-field':['match',['get','id'],'156810000','香港','156820000','澳门',['get','name']],
      'text-font':['sans-serif'],'text-size':11,'text-allow-overlap':true,'text-ignore-placement':true,
      'text-anchor':['match',['get','id'],'156810000','left','156820000','right','right'],
      'text-offset':['match',['get','id'],'156810000',['literal',[0.4,0.5]],'156820000',['literal',[-0.6,0]],['literal',[-0.4,1.0]]]},
    paint:{'text-color':mapColors.night,'text-halo-color':'#fff','text-halo-width':1.2}});
  if(!inset)map.addLayer({id:'taiwan-label',type:'symbol',source:'labels',
    filter:['==',['get','id'],'156710000'],
    layout:{'text-field':'台湾省','text-font':['sans-serif'],'text-size':11,'text-allow-overlap':true,'text-ignore-placement':true,'text-anchor':'right','text-offset':[-0.4,1]},
    paint:{'text-color':mapColors.night,'text-halo-color':'#fff','text-halo-width':1.2}});
  for(const [id,kind,min,max] of [
    ['island-groups','group',0,24],['island-names','island',0,24],
    ['diaoyu-group','diaoyu-group',0,6],['diaoyu-islands','diaoyu-island',6,24],
  ] as const) map.addLayer({ id, type:'symbol',source:'islandLabels',minzoom:min,maxzoom:max,
    filter:['==',['get','kind'],kind],
    layout:{'visibility':!inset&&(kind==='group'||kind==='island')?'none':'visible','text-field':kind==='diaoyu-group'?'钓鱼岛及其\n附属岛屿':['get','name'],'text-font':['sans-serif'],'text-size':inset?9:11,
      'text-anchor':kind==='diaoyu-group'?'bottom-right':inset?['match',['get','name'],'西沙群岛','right','中沙群岛','left','东沙群岛','bottom-right','南沙群岛','bottom','曾母暗沙','bottom','黄岩岛','top','left']:'left',
      'text-offset':kind==='diaoyu-group'?[-0.2,-0.8]:inset?['match',['get','name'],'黄岩岛',['literal',[0,0.5]],['literal',[0,0]]]:[0,0], 'text-padding':2, 'text-allow-overlap':inset||kind==='group'||kind==='diaoyu-group'},
    paint:{'text-color':mapColors.night,'text-halo-color':'#fff','text-halo-width':1.2} });
  return solar;
}
export function resizeProvinceLabels(map: LibreMap, labels: FeatureCollection) {
  const narrow = map.getContainer().clientWidth < 600;
  map.setLayoutProperty('labels-province', 'text-size', narrow ? 10 : 12);
  map.setLayoutProperty('labels-province', 'text-field', ['get', narrow ? 'narrowName' : 'name']);
  for (const layer of ['key-province-labels','taiwan-label']) map.setLayoutProperty(layer, 'text-size', narrow ? 10 : 11);
  for (const layer of ['labels-province','key-province-labels','taiwan-label']) {
    map.setLayoutProperty(layer, 'text-anchor', 'center');
  }
  // Choose nearby free text positions only when the fixed camera or layout changes.
  // All geographical anchors remain intact, and no province is hidden to make room.
  const container = map.getContainer(), bounds = container.getBoundingClientRect();
  type Box = { left: number; top: number; right: number; bottom: number };
  const occupied: Box[] = [];
  for (const element of container.parentElement?.querySelectorAll('.map-time,.south-sea') ?? []) {
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height) occupied.push({ left:rect.left-bounds.left-4, top:rect.top-bounds.top-4, right:rect.right-bounds.left+4, bottom:rect.bottom-bounds.top+4 });
  }
  for (const feature of map.querySourceFeatures('islandLabels')) {
    if (feature.properties.kind !== 'diaoyu-group' || feature.geometry.type !== 'Point') continue;
    const point = map.project(feature.geometry.coordinates.slice(0,2) as [number,number]);
    occupied.push({left:point.x-82,top:point.y-38,right:point.x+2,bottom:point.y-6});
  }
  const preferred: Record<string,[number,number]> = {
    '156110000':[-2,-1.4], '156120000':[2,0.8], '156310000':[2.2,0.7], '156500000':[-1.8,1],
    '156810000':[2,1.7], '156820000':[-2,0.4], '156460000':[-1.8,1], '156710000':[-2,1],
  };
  const candidates: [number,number][] = [];
  for (let x=-144;x<=144;x+=4) for (let y=-144;y<=144;y+=4) candidates.push([x,y]);
  candidates.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
  const offsets = new Map<string,[number,number]>();
  const positions = new Map<string,{x:number;y:number}>();
  const guides: FeatureCollection = {type:'FeatureCollection',features:[]};
  const features = [...labels.features].sort((a,b)=>Number(!!preferred[String(b.properties?.id)])-Number(!!preferred[String(a.properties?.id)]));
  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const id = String(feature.properties?.id), small = !!preferred[id], size = narrow ? 10 : small ? 11 : 12;
    const name = id === '156810000' ? '香港' : id === '156820000' ? '澳门' : String(feature.properties?.[narrow?'narrowName':'name']);
    const lines = name.split('\n'), halfWidth = Math.max(...lines.map(line=>line.length))*size/2+3, halfHeight = lines.length*size*1.2/2+3;
    const anchor = map.project(feature.geometry.coordinates.slice(0,2) as [number,number]), bias = preferred[id] ?? [0,0];
    let offset: [number,number] = bias;
    for (const [dx,dy] of candidates) {
      const x = anchor.x+bias[0]*size+dx, y = anchor.y+bias[1]*size+dy;
      const box = {left:x-halfWidth,top:y-halfHeight,right:x+halfWidth,bottom:y+halfHeight};
      if (box.left<6 || box.top<6 || box.right>container.clientWidth-6 || box.bottom>container.clientHeight-6) continue;
      if (occupied.some(other=>box.left<other.right && box.right>other.left && box.top<other.bottom && box.bottom>other.top)) continue;
      offset = [bias[0]+dx/size,bias[1]+dy/size]; occupied.push(box); break;
    }
    offsets.set(id,offset);
    const x = anchor.x+offset[0]*size, y = anchor.y+offset[1]*size;
    positions.set(id,{x,y});
    if (Math.hypot(x-anchor.x,y-anchor.y)>size*2) {
      const edge = Math.min(halfWidth/Math.abs(x-anchor.x),halfHeight/Math.abs(y-anchor.y));
      if (edge<1) guides.features.push({type:'Feature',properties:{id},geometry:{type:'LineString',
        coordinates:[feature.geometry.coordinates.slice(0,2),map.unproject([x-(x-anchor.x)*edge,y-(y-anchor.y)*edge]).toArray()]}});
    }
  }
  const expression: unknown[] = ['match',['get','id']];
  for (const [id,offset] of offsets) expression.push(id,['literal',offset]);
  expression.push(['literal',[0,0]]);
  for (const layer of ['labels-province','key-province-labels','taiwan-label']) map.setLayoutProperty(layer, 'text-offset', expression);
  (map.getSource('province-label-guides') as GeoJSONSource).setData(guides);
  return positions;
}
export function highlight(map: LibreMap, id: string | null) {
  for (const layer of ['selected-outline', 'selected-provinces']) map.setFilter(layer, ['==', ['get', 'id'], id ?? '']);
}
