import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type { Map as LibreMap } from 'maplibre-gl';
import { resizeProvinceLabels } from '../../src/map/layers';

function layout(width: number, compact: boolean) {
  const styles = new Map<string,unknown>(), guides: FeatureCollection[] = [];
  const container = {clientWidth:width,clientHeight:400,parentElement:null,closest:()=>null,getBoundingClientRect:()=>({left:0,top:0})};
  const map = {getContainer:()=>container,querySourceFeatures:()=>[],project:()=>({x:100,y:150}),unproject:([x,y]:number[])=>({toArray:()=>[x,y]}),
    setLayoutProperty:(id:string,name:string,value:unknown)=>styles.set(`${id}:${name}`,value),getSource:()=>({setData:(value:FeatureCollection)=>guides.push(value)})};
  const labels: FeatureCollection = {type:'FeatureCollection',features:['156440000','156110000','156710000','156810000'].map((id,i)=>({
    type:'Feature',geometry:{type:'Point',coordinates:[100,30]},properties:{id,name:['广东省','北京市','台湾省','香港特别行政区'][i],shortName:['粤','京','台','港'][i]},
  }))};
  return {styles,positions:resizeProvinceLabels(map as unknown as LibreMap,labels,compact)};
}
describe('省名显示与避让使用相同文字',()=>{
  it('手机和小于600px的地图中三个图层均采用12px简称',()=>{
    for(const [width,compact] of [[900,true],[599,false]] as const){
      const {styles,positions}=layout(width,compact);
      for(const id of ['labels-province','key-province-labels','taiwan-label']){
        expect(styles.get(`${id}:text-field`)).toEqual(['get','shortName']);
        expect(styles.get(`${id}:text-size`)).toBe(12);
      }
      expect(positions.size).toBe(4);
      const boxes=[...positions.values()].map(({x,y})=>({x,y}));
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        expect(Math.abs(boxes[i].x-boxes[j].x)>=18 || Math.abs(boxes[i].y-boxes[j].y)>=20.4).toBe(true);
      }
    }
  });
  it('600px及以上的普通地图恢复完整名称和特殊地区名称',()=>{
    const {styles}=layout(600,false);
    expect(styles.get('labels-province:text-field')).toEqual(['get','name']);
    expect(styles.get('taiwan-label:text-field')).toBe('台湾省');
    expect(styles.get('key-province-labels:text-field')).toEqual(['match',['get','id'],'156810000','香港','156820000','澳门',['get','name']]);
  });
});
