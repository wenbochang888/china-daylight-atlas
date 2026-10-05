import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { boxInsidePolygon, boxOverlapsPolygon, provinceLabelPolygons } from '../../src/map/label-geometry';

const square=(x:number,y:number,size:number)=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const project=(rings:number[][][])=>rings.map(ring=>ring.map(([x,y])=>({x,y})));
describe('省内文字矩形与几何候选点',()=>{
  it('文字不能跨界、覆盖孔洞或跨过凹陷边界',()=>{
    const rings=project([square(0,0,100),square(45,45,10)]);
    expect(boxInsidePolygon({left:10,top:10,right:30,bottom:30},rings)).toBe(true);
    expect(boxInsidePolygon({left:-2,top:10,right:18,bottom:30},rings)).toBe(false);
    expect(boxInsidePolygon({left:40,top:40,right:60,bottom:60},rings)).toBe(false);
    const concave=project([[[0,0],[100,0],[100,100],[60,100],[60,30],[40,30],[40,100],[0,100],[0,0]]]);
    expect(boxInsidePolygon({left:20,top:40,right:70,bottom:60},concave)).toBe(false);
  });
  it('海面候选不能覆盖邻省，包含整个小区域也算重叠',()=>{
    const rings=project([square(20,20,10)]);
    expect(boxOverlapsPolygon({left:0,top:0,right:15,bottom:15},rings)).toBe(false);
    expect(boxOverlapsPolygon({left:0,top:0,right:40,bottom:40},rings)).toBe(true);
  });
  it('多部件只在最大主体生成候选，并复用同一缓存',()=>{
    const provinces:FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'a'},geometry:{type:'MultiPolygon',coordinates:[[square(0,0,10)],[square(100,100,2)]]}}]};
    const result=provinceLabelPolygons(provinces);
    expect(provinceLabelPolygons(provinces)).toBe(result);
    expect(result.get('a')!.candidates.length).toBeGreaterThan(0);
    expect(result.get('a')!.candidates.every(([x,y])=>x>0&&x<10&&y>0&&y<10)).toBe(true);
  });
});
