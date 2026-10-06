import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as LibreMap, StyleSpecification } from 'maplibre-gl';
import { SolarLayer } from './solar-layer';
import { mapColors } from './colors';
import { boxInsidePolygon, boxOverlapsPolygon, insidePolygon, provinceLabelPolygons, segmentTouchesBox, type Box, type Point } from './label-geometry';

export const emptyCollection: FeatureCollection = { type: 'FeatureCollection', features: [] };
const nearbyOffsets: [number,number][]=[];
for (let x=-192;x<=192;x+=4) for (let y=-192;y<=192;y+=4) nearbyOffsets.push([x,y]);
nearbyOffsets.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
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
export function resizeProvinceLabels(map: LibreMap, labels: FeatureCollection, compactLabels = false, provinces: FeatureCollection = emptyCollection, islandLabels: FeatureCollection = emptyCollection) {
  const compact = compactLabels || map.getContainer().clientWidth < 600;
  map.setLayoutProperty('labels-province', 'text-size', 12);
  map.setLayoutProperty('labels-province', 'text-field', ['get', compact ? 'shortName' : 'name']);
  map.setLayoutProperty('key-province-labels', 'text-field', compact ? ['get','shortName'] : ['match',['get','id'],'156810000','香港','156820000','澳门',['get','name']]);
  map.setLayoutProperty('taiwan-label', 'text-field', compact ? ['get','shortName'] : '台湾省');
  for (const layer of ['key-province-labels','taiwan-label']) map.setLayoutProperty(layer, 'text-size', compact ? 12 : 11);
  for (const layer of ['labels-province','key-province-labels','taiwan-label']) {
    map.setLayoutProperty(layer, 'text-anchor', 'center');
  }
  const container = map.getContainer(), bounds = container.getBoundingClientRect();
  const occupied: Box[] = [];
  const overlays = [...container.parentElement?.querySelectorAll('.map-info,.south-sea') ?? [],
    ...container.closest('.maps')?.querySelectorAll('.map-view-controls') ?? []];
  for (const element of overlays) {
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height) occupied.push({ left:rect.left-bounds.left-4, top:rect.top-bounds.top-4, right:rect.right-bounds.left+4, bottom:rect.bottom-bounds.top+4 });
  }
  const shapes=provinceLabelPolygons(provinces);
  const projected=new Map([...shapes].map(([id,shape])=>[id,{
    rings:shape.rings.map(ring=>ring.map(p=>map.project(p.slice(0,2) as [number,number]))),
    candidates:shape.candidates.map(p=>map.project(p)),
  }]));
  const smallIds=new Set(['156110000','156120000','156310000','156500000','156810000','156820000','156460000','156710000']);
  const candidates = nearbyOffsets;
  const offsets = new Map<string,[number,number]>();
  const positions = new Map<string,{x:number;y:number;inside:boolean;box:Box}>();
  const guides: FeatureCollection = {type:'FeatureCollection',features:[]};
  const lines: {a:Point;b:Point}[]=[];
  const available=(box:Box)=>box.left>=6 && box.top>=6 && box.right<=container.clientWidth-6 && box.bottom<=container.clientHeight-6 &&
    !occupied.some(other=>box.left<other.right && box.right>other.left && box.top<other.bottom && box.bottom>other.top) &&
    !lines.some(line=>segmentTouchesBox(line.a,line.b,box));
  const items=labels.features.flatMap(feature=>{
    if (feature.geometry.type!=='Point') return [];
    const id=String(feature.properties?.id),size=compact?12:smallIds.has(id)?11:12;
    const name = compact ? String(feature.properties?.shortName) : id === '156810000' ? '香港' : id === '156820000' ? '澳门' : String(feature.properties?.name);
    const textLines=name.split('\n');
    return [{id,size,anchor:map.project(feature.geometry.coordinates.slice(0,2) as [number,number]),
      coordinates:feature.geometry.coordinates.slice(0,2),halfWidth:Math.max(...textLines.map(line=>line.length))*size/2+2,halfHeight:textLines.length*size*1.2/2+2}];
  }).sort((a,b)=>(projected.get(a.id)?.candidates.length??0)-(projected.get(b.id)?.candidates.length??0)||a.id.localeCompare(b.id));
  type Item=typeof items[number];
  const boxAt=(item:Item,p:Point):Box=>({left:p.x-item.halfWidth,top:p.y-item.halfHeight,right:p.x+item.halfWidth,bottom:p.y+item.halfHeight});
  function place(item:Item,p:Point,inside:boolean) {
    const box=boxAt(item,p); occupied.push(box);
    positions.set(item.id,{...p,inside,box}); offsets.set(item.id,[(p.x-item.anchor.x)/item.size,(p.y-item.anchor.y)/item.size]);
    if (!inside) {
      const dx=p.x-item.anchor.x,dy=p.y-item.anchor.y,edge=Math.min(item.halfWidth/Math.abs(dx),item.halfHeight/Math.abs(dy));
      if (edge<1) {
        const b={x:p.x-dx*edge,y:p.y-dy*edge}; lines.push({a:item.anchor,b});
        guides.features.push({type:'Feature',properties:{id:item.id},geometry:{type:'LineString',coordinates:[item.coordinates,map.unproject([b.x,b.y]).toArray()]}});
      }
    }
  }
  // Reserve internal placements for all provinces before small regions use external space.
  for (const item of items) {
    const shape=projected.get(item.id); if (!shape) continue;
    const choices=[item.anchor,...shape.candidates].sort((a,b)=>Math.hypot(a.x-item.anchor.x,a.y-item.anchor.y)-Math.hypot(b.x-item.anchor.x,b.y-item.anchor.y));
    const point=choices.find(p=>{
      const box=boxAt(item,p);
      // Collision padding is spacing, not printed ink. Do not force that empty margin inside land.
      const ink={left:box.left+1.8,right:box.right-1.8,top:p.y-item.size/2-1.2,bottom:p.y+item.size/2+1.2};
      return available(box)&&boxInsidePolygon(ink,shape.rings);
    });
    if (point) place(item,point,true);
  }
  // A narrow province may not fit the entire glyph or full name. Keep its text centre
  // in its own land before resorting to a callout, with text-to-text spacing intact.
  for (const item of items) {
    if (positions.has(item.id)) continue;
    const shape=projected.get(item.id); if (!shape) continue;
    const xs=shape.rings[0].map(p=>p.x),ys=shape.rings[0].map(p=>p.y);
    const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
    if (width*height<item.size*item.size || ((!compact || smallIds.has(item.id)) && (width<item.size || height<item.size))) continue;
    const choices=[item.anchor,...shape.candidates].sort((a,b)=>Math.hypot(a.x-item.anchor.x,a.y-item.anchor.y)-Math.hypot(b.x-item.anchor.x,b.y-item.anchor.y));
    const point=choices.find(p=>available(boxAt(item,p)) && insidePolygon(p,shape.rings));
    if (point) place(item,point,true);
  }
  for (const item of items) {
    if (positions.has(item.id)) continue;
    const point=candidates.map(([dx,dy])=>({x:item.anchor.x+dx,y:item.anchor.y+dy})).find(p=>{
      const box=boxAt(item,p);
      return available(box) && ![...projected.values()].some(shape=>boxOverlapsPolygon(box,shape.rings));
    }) ?? candidates.map(([dx,dy])=>({x:item.anchor.x+dx,y:item.anchor.y+dy})).find(p=>available(boxAt(item,p)) &&
      ![...projected].some(([id,shape])=>id!==item.id&&insidePolygon(p,shape.rings)));
    if (point) place(item,point,false);
  }
  // Place Diaoyu last so the annotation never pushes provincial text away from its land.
  // Use the bundled source: worker tiles can be unavailable during initial fitting.
  const diaoyu=islandLabels.features.find(f=>f.properties?.kind==='diaoyu-group'&&f.geometry.type==='Point');
  if (diaoyu?.geometry.type==='Point') {
    const size=11,name=compact?'钓鱼岛':'钓鱼岛及其\n附属岛屿',textLines=name.split('\n');
    map.setLayoutProperty('diaoyu-group','text-field',name);
    const coordinates=diaoyu.geometry.coordinates.slice(0,2),anchor=map.project(coordinates as [number,number]);
    const item={id:'diaoyu',size,anchor,coordinates,halfWidth:Math.max(...textLines.map(line=>line.length))*size/2+3,halfHeight:textLines.length*size*1.2/2+3};
    const choices=candidates.map(([dx,dy])=>({x:anchor.x+item.halfWidth+8+dx,y:anchor.y+dy}));
    const point=choices.find(p=>p.x>anchor.x && available(boxAt(item,p)) && ![...projected.values()].some(shape=>boxOverlapsPolygon(boxAt(item,p),shape.rings))) ?? choices.find(p=>available(boxAt(item,p)));
    if (point) {
      place(item,point,false);
      map.setLayoutProperty('diaoyu-group','text-field',name); map.setLayoutProperty('diaoyu-group','text-anchor','center');
      map.setLayoutProperty('diaoyu-group','text-offset',offsets.get('diaoyu')!);
    }
    positions.delete('diaoyu'); offsets.delete('diaoyu');
  }
  const expression: unknown[] = offsets.size ? ['match',['get','id']] : [];
  for (const [id,offset] of offsets) expression.push(id,['literal',offset]);
  if (offsets.size) expression.push(['literal',[0,0]]);
  else expression.push('literal',[0,0]);
  for (const layer of ['labels-province','key-province-labels','taiwan-label']) map.setLayoutProperty(layer, 'text-offset', expression);
  (map.getSource('province-label-guides') as GeoJSONSource).setData(guides);
  return positions;
}
export function highlight(map: LibreMap, id: string | null) {
  for (const layer of ['selected-outline', 'selected-provinces']) map.setFilter(layer, ['==', ['get', 'id'], id ?? '']);
}
