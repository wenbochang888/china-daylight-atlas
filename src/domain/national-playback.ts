import type { FeatureCollection, Position } from 'geojson';
import { toInstant } from './beijing-time';
import { solarVector, SUNRISE_ALTITUDE } from './solar';
import type { PlaybackMultiplier, PlaybackSegment, SunVector } from './types';

const RAD=Math.PI/180;
const mercator=(lat:number)=>Math.log(Math.tan(Math.PI/4+lat*RAD/2));
const latitude=(y:number)=>(2*Math.atan(Math.exp(y))-Math.PI/2)/RAD;
export interface NationalGeometry {
  points: Float64Array;
  polygons: Position[][][];
  cache: Map<string, PlaybackSegment[]>;
}
export function prepareNationalGeometry(collection:FeatureCollection): NationalGeometry {
  const points:number[]=[],polygons:Position[][][]=[];
  const add=(lng:number,lat:number)=>{
    const a=lat*RAD,b=lng*RAD;
    points.push(Math.cos(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.sin(a));
  };
  for(const feature of collection.features){
    if(feature.geometry.type!=='Polygon'&&feature.geometry.type!=='MultiPolygon')continue;
    const source=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for(const polygon of source){
      polygons.push(polygon.map(ring=>ring.map(p=>[p[0],mercator(p[1])])));
      for(const ring of polygon) for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i],ya=mercator(a[1]),yb=mercator(b[1]);
        // Sample the same straight Mercator edges used by the renderer; no geometry is modified.
        const count=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))/0.05));
        for(let j=0;j<count;j++)add(a[0]+(b[0]-a[0])*j/count,latitude(ya+(yb-ya)*j/count));
      }
    }
  }
  if(!points.length)throw new Error('全国几何为空，无法准备播放。');
  return {points:new Float64Array(points),polygons,cache:new Map()};
}
function insideRing(point:Position,ring:Position[]){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function contains(shape:NationalGeometry,lng:number,lat:number){
  const point=[lng,mercator(lat)];
  return shape.polygons.some(p=>insideRing(point,p[0])&&!p.slice(1).some(ring=>insideRing(point,ring)));
}
export function nationalPlaybackSpeed(shape:NationalGeometry,vector:SunVector):8|90 {
  let min=1,max=-1;
  for(let i=0;i<shape.points.length;i+=3){
    const dot=shape.points[i]*vector[0]+shape.points[i+1]*vector[1]+shape.points[i+2]*vector[2];
    min=Math.min(min,dot);max=Math.max(max,dot);
  }
  // A 0.01-degree safety band keeps the animation slow at the exact transition edge.
  const day=Math.sin((SUNRISE_ALTITUDE+0.01)*RAD),night=Math.sin((SUNRISE_ALTITUDE-0.01)*RAD);
  const lng=Math.atan2(vector[1],vector[0])/RAD,lat=Math.asin(vector[2])/RAD;
  if(min>=day){
    const opposite=lng>0?lng-180:lng+180;
    return contains(shape,opposite,-lat)?8:90;
  }
  if(max<night)return contains(shape,lng,lat)?8:90;
  return 8;
}
export function nationalPlaybackSegments(date:string,shape:NationalGeometry):PlaybackSegment[]{
  const cached=shape.cache.get(date);if(cached)return cached;
  const speedAt=(minute:number)=>nationalPlaybackSpeed(shape,solarVector(toInstant(date,minute)));
  const segments:PlaybackSegment[]=[];
  let startMinute=0,previous=speedAt(0);
  for(let minute=10;minute<=1440;minute+=10){
    const next=speedAt(minute);if(next===previous)continue;
    let low=minute-10,high=minute;
    while((high-low)*60>0.5){
      const mid=(low+high)/2;
      if(speedAt(mid)===previous)low=mid;else high=mid;
    }
    const endMinute=(low+high)/2;
    segments.push({startMinute,endMinute,speed:previous});startMinute=endMinute;previous=next;
  }
  segments.push({startMinute,endMinute:1440,speed:previous});
  if(shape.cache.size>=8)shape.cache.delete(shape.cache.keys().next().value!);
  shape.cache.set(date,segments);return segments;
}
export function combinePlaybackSegments(days:PlaybackSegment[][]):PlaybackSegment[]{
  if(!days.length)return [];
  const boundaries=[...new Set([0,1440,...days.flatMap(day=>day.map(s=>s.endMinute))])].sort((a,b)=>a-b);
  const result:PlaybackSegment[]=[];
  for(let i=1;i<boundaries.length;i++){
    const startMinute=boundaries[i-1],endMinute=boundaries[i],middle=(startMinute+endMinute)/2;
    const speed=days.some(day=>day.some(s=>s.startMinute<=middle&&middle<s.endMinute&&s.speed===8))?8:90;
    if(result.at(-1)?.speed===speed)result[result.length-1].endMinute=endMinute;
    else result.push({startMinute,endMinute,speed});
  }
  return result;
}
// Integrate the same rates as advancePlayback, from midnight to the selected minute.
export function playbackElapsedSeconds(minute:number,segments:readonly PlaybackSegment[],multiplier:PlaybackMultiplier=1):number {
  const target=Math.max(0,Math.min(1440,minute));
  return segments.reduce((seconds,segment)=>
    seconds+Math.max(0,Math.min(target,segment.endMinute)-segment.startMinute)/(segment.speed*multiplier),0);
}
export function advancePlayback(minute:number,elapsedSeconds:number,segments:readonly PlaybackSegment[],multiplier:PlaybackMultiplier=1){
  let current=Math.max(0,Math.min(1440,minute)),remaining=Math.max(0,elapsedSeconds)*multiplier;
  for(const segment of segments){
    if(current>=segment.endMinute)continue;
    const available=(segment.endMinute-current)/segment.speed;
    if(remaining<available){current+=remaining*segment.speed;remaining=0;break;}
    current=segment.endMinute;remaining-=available;
    if(remaining<=0)break;
  }
  return {minute:current,stopped:current>=1440};
}
