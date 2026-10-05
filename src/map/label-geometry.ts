import type { FeatureCollection, Position } from 'geojson';

export type Point = { x: number; y: number };
export type Box = { left: number; top: number; right: number; bottom: number };
export type LabelPolygon = { rings: Position[][]; candidates: [number,number][] };
const cache = new WeakMap<FeatureCollection, Map<string,LabelPolygon>>();

function inRing(point: Point, ring: Point[]) {
  let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
export function insidePolygon(point: Point, rings: Point[][]) {
  return !!rings.length && inRing(point,rings[0]) && !rings.slice(1).some(ring=>inRing(point,ring));
}
export function segmentTouchesBox(a: Point, b: Point, box: Box) {
  if (Math.max(a.x,b.x)<box.left || Math.min(a.x,b.x)>box.right || Math.max(a.y,b.y)<box.top || Math.min(a.y,b.y)>box.bottom) return false;
  let start=0,end=1;
  const dx=b.x-a.x,dy=b.y-a.y;
  for (const [p,q] of [[-dx,a.x-box.left],[dx,box.right-a.x],[-dy,a.y-box.top],[dy,box.bottom-a.y]]) {
    if (!p) { if (q<0) return false; continue; }
    const t=q/p;
    if (p<0) start=Math.max(start,t); else end=Math.min(end,t);
    if (start>end) return false;
  }
  return true;
}
export function boxOverlapsPolygon(box: Box, rings: Point[][]) {
  return insidePolygon({x:(box.left+box.right)/2,y:(box.top+box.bottom)/2},rings) ||
    rings.some(ring=>ring.some((a,i)=>segmentTouchesBox(a,ring[(i+1)%ring.length],box)));
}
export function boxInsidePolygon(box: Box, rings: Point[][]) {
  if (!insidePolygon({x:(box.left+box.right)/2,y:(box.top+box.bottom)/2},rings)) return false;
  // Also reject a hole fully enclosed by the text rectangle, and concave edges crossing it.
  return !rings.some(ring=>ring.some((a,i)=>segmentTouchesBox(a,ring[(i+1)%ring.length],box)));
}
function area(ring: Position[]) {
  return Math.abs(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
}

// Candidate points belong only to the largest visible land component. Cache geographical
// work once; projecting and choosing text positions happen only on layout changes.
export function provinceLabelPolygons(provinces: FeatureCollection) {
  const existing=cache.get(provinces); if (existing) return existing;
  const result=new Map<string,LabelPolygon>();
  for (const feature of provinces.features) {
    if (feature.geometry.type!=='Polygon' && feature.geometry.type!=='MultiPolygon') continue;
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    const rings=[...polygons].sort((a,b)=>area(b[0])-area(a[0]))[0];
    if (!rings) continue;
    const points=rings.map(ring=>ring.map(([x,y])=>({x,y})));
    const xs=rings[0].map(p=>p[0]),ys=rings[0].map(p=>p[1]);
    const left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
    const candidates: [number,number][]=[];
    for (let x=0;x<24;x++) for (let y=0;y<24;y++) {
      const lng=left+(right-left)*(x+.5)/24,lat=bottom+(top-bottom)*(y+.5)/24;
      if (insidePolygon({x:lng,y:lat},points)) candidates.push([lng,lat]);
    }
    result.set(String(feature.properties?.id),{rings,candidates});
  }
  cache.set(provinces,result); return result;
}
