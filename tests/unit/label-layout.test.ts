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
  const islands: FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[120,25]},properties:{kind:'diaoyu-group'}}]};
  return {styles,positions:resizeProvinceLabels(map as unknown as LibreMap,labels,compact,undefined,islands)};
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
      expect(styles.get('diaoyu-group:text-field')).toBe('钓鱼岛');
      expect(styles.get('diaoyu-group:text-offset')).toBeDefined();
      const boxes=[...positions.values()].map(({box})=>box);
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        expect(boxes[i].left>=boxes[j].right || boxes[j].left>=boxes[i].right || boxes[i].top>=boxes[j].bottom || boxes[j].top>=boxes[i].bottom).toBe(true);
      }
    }
  });
  it('600px及以上的普通地图恢复完整名称和特殊地区名称',()=>{
    const {styles}=layout(600,false);
    expect(styles.get('labels-province:text-field')).toEqual(['get','name']);
    expect(styles.get('taiwan-label:text-field')).toBe('台湾省');
    expect(styles.get('key-province-labels:text-field')).toEqual(['match',['get','id'],'156810000','香港','156820000','澳门',['get','name']]);
    expect(styles.get('diaoyu-group:text-field')).toBe('钓鱼岛及其\n附属岛屿');
  });
  it('大省保留内部、小区域外置带引线，排布结果固定且不修改输入',()=>{
    const styles=new Map<string,unknown>(),guides:FeatureCollection[]=[];
    const container={clientWidth:400,clientHeight:400,parentElement:null,closest:()=>null,getBoundingClientRect:()=>({left:0,top:0})};
    const map={getContainer:()=>container,project:([x,y]:number[])=>({x,y}),unproject:([x,y]:number[])=>({toArray:()=>[x,y]}),
      setLayoutProperty:(id:string,name:string,value:unknown)=>styles.set(`${id}:${name}`,value),getSource:()=>({setData:(value:FeatureCollection)=>guides.push(value)})};
    const labels:FeatureCollection={type:'FeatureCollection',features:[['a','大省',100,100],['b','小省',210,210]].map(([id,name,x,y])=>({type:'Feature',geometry:{type:'Point',coordinates:[Number(x),Number(y)]},properties:{id,name,shortName:id}}))};
    const provinces:FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'a'},geometry:{type:'Polygon',coordinates:[[[20,20],[180,20],[180,180],[20,180],[20,20]]]}},{type:'Feature',properties:{id:'b'},geometry:{type:'Polygon',coordinates:[[[209,209],[211,209],[211,211],[209,211],[209,209]]]}}]};
    const islands:FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',properties:{kind:'diaoyu-group'},geometry:{type:'Point',coordinates:[300,250]}}]};
    const original=JSON.stringify({labels,provinces,islands});
    const first=resizeProvinceLabels(map as unknown as LibreMap,labels,true,provinces,islands);
    expect(first.get('a')).toMatchObject({x:100,y:100,inside:true});
    expect(first.get('b')?.inside).toBe(false);
    expect(guides[0].features.some(f=>f.properties?.id==='b')).toBe(true);
    expect(styles.get('diaoyu-group:text-field')).toBe('钓鱼岛');
    expect(resizeProvinceLabels(map as unknown as LibreMap,labels,true,provinces,islands)).toEqual(first);
    expect(JSON.stringify({labels,provinces,islands})).toBe(original);
  });
  it('狭长省份的单字简称保留省内中心，不因一个方向小于字号就外置',()=>{
    const container={clientWidth:400,clientHeight:400,parentElement:null,closest:()=>null,getBoundingClientRect:()=>({left:0,top:0})};
    const map={getContainer:()=>container,project:([x,y]:number[])=>({x,y}),unproject:([x,y]:number[])=>({toArray:()=>[x,y]}),setLayoutProperty:()=>{},getSource:()=>({setData:()=>{}})};
    const labels:FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'156640000',name:'宁夏回族自治区',shortName:'宁'},geometry:{type:'Point',coordinates:[100,100]}}]};
    const provinces:FeatureCollection={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'156640000'},geometry:{type:'Polygon',coordinates:[[[96,80],[104,80],[104,120],[96,120],[96,80]]]}}]};
    expect(resizeProvinceLabels(map as unknown as LibreMap,labels,true,provinces).get('156640000')).toMatchObject({x:100,y:100,inside:true});
  });
});
