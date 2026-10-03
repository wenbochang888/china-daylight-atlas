import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FeatureCollection } from 'geojson';
import { solarTermOptions } from '../../src/domain/solar-terms';
import { prepareNationalGeometry, nationalPlaybackSpeed, nationalPlaybackSegments, combinePlaybackSegments } from '../../src/domain/national-playback';
import { solarVector } from '../../src/domain/solar';
import { toInstant } from '../../src/domain/beijing-time';
import { browsable, terminal, showsCityLevel } from '../../src/data/map-repository';
import type { Region } from '../../src/domain/types';
const directory:Region[]=JSON.parse(readFileSync('public/maps/index.json','utf8'));
const geometry:FeatureCollection=JSON.parse(readFileSync('public/maps/provinces.json','utf8'));
const shape=prepareNationalGeometry(geometry);
describe('保留的省市候选数据与历史终点工具',()=>{
  it('保留34省、333地级节点及台湾20对应节点，隐藏内地县区、港澳下属区和辅助节点',()=>{
    const regions=directory.filter(browsable);
    expect(regions.filter(r=>r.level==='province')).toHaveLength(34);
    expect(regions.filter(r=>r.level==='city')).toHaveLength(333);
    expect(regions.filter(r=>r.level==='county')).toHaveLength(20);
    expect(regions.some(r=>r.name==='海淀区')).toBe(false);
    expect(regions.some(r=>r.level==='auxiliary')).toBe(false);
    for(const region of regions) expect(terminal(region)).toBe(region.level!=='province');
    for(const id of ['156110000','156120000','156310000','156500000','156810000','156820000'])
      expect(regions.filter(r=>r.provinceId===id&&terminal(r))).toHaveLength(0);
  });
});
describe('历史市级倍率工具（固定省级页面不接入）',()=>{
  it('自由缩放过5减速，选中终点缩小仍减速，省级选择不强制减速',()=>{
    const province=directory.find(r=>r.id==='156430000')!, city=directory.find(r=>r.name==='长沙市')!;
    expect(showsCityLevel(4.99,null)).toBe(false);expect(showsCityLevel(5,null)).toBe(true);
    expect(showsCityLevel(3,province)).toBe(false);expect(showsCityLevel(3,city)).toBe(true);
    expect(showsCityLevel(3,directory.find(r=>r.provinceId==='156710000'&&r.level==='county')!)).toBe(true);
  });
});
describe('节气太阳黄经计算',()=>{
  it.each([2026,2027])('%s年24名称完整，包含当年尚未到来的节气',year=>{
    const options=solarTermOptions({min:`${year}-01-01`,max:`${year}-12-31`});
    expect(options).toHaveLength(24);expect(new Set(options.map(t=>t.name)).size).toBe(24);
    expect(options.every(t=>!t.disabled&&t.date?.startsWith(`${year}-`))).toBe(true);
    if(year===2026){
      expect(options.find(t=>t.name==='冬至')?.date).toBe('2026-12-22');
      expect(options.find(t=>t.name==='夏至')?.date).toBe('2026-06-21');
    }
  });
  it('与香港天文台2026中气官方时刻相差不到一分钟',()=>{
    // https://www.hko.gov.hk/tc/gts/astron2026/files/2026SolarTerms24.pdf (UTC+8)
    const official=[['大寒','01-20T09:45'],['雨水','02-18T23:52'],['春分','03-20T22:46'],['谷雨','04-20T09:39'],['小满','05-21T08:37'],['夏至','06-21T16:25'],['大暑','07-23T03:13'],['处暑','08-23T10:19'],['秋分','09-23T08:05'],['霜降','10-23T17:38'],['小雪','11-22T15:23'],['冬至','12-22T04:50']];
    const options=solarTermOptions({min:'2026-01-01',max:'2026-12-31'});
    for(const [name,time] of official){
      const calculated=new Date(options.find(t=>t.name===name)!.instant!).getTime();
      expect(Math.abs(calculated-new Date(`2026-${time}:00+08:00`).getTime())).toBeLessThan(60000);
    }
  });
  it('窗口内未出现的节气保留名称并禁用',()=>{
    const options=solarTermOptions({min:'2026-06-20',max:'2026-06-22'});
    expect(options.filter(t=>!t.disabled).map(t=>t.name)).toEqual(['夏至']);
    expect(options.find(t=>t.name==='冬至')).toMatchObject({date:null,instant:null,disabled:true});
  });
});
describe('全国真实几何自动变速',()=>{
  it('覆盖全部多部件，顶点之外长边加密',()=>{
    let vertices=0;
    for(const f of geometry.features){if(f.geometry.type==='MultiPolygon')for(const p of f.geometry.coordinates)for(const r of p)vertices+=r.length-1;}
    expect(shape.points.length/3).toBeGreaterThanOrEqual(vertices);
    expect(shape.polygons.length).toBeGreaterThan(34);
  });
  it.each(['2026-06-21','2025-12-21'])('%s 全国同态快、交界慢；日段连续覆盖全天',date=>{
    const segments=nationalPlaybackSegments(date,shape);
    expect(segments.map(s=>s.speed)).toEqual([90,8,90,8,90]);
    expect(segments[0].startMinute).toBe(0);expect(segments.at(-1)?.endMinute).toBe(1440);
    expect(nationalPlaybackSpeed(shape,solarVector(toInstant(date,0)))).toBe(90);
    expect(nationalPlaybackSpeed(shape,solarVector(toInstant(date,720)))).toBe(90);
    for(let i=0;i<segments.length;i++){
      const s=segments[i];if(i)expect(s.startMinute).toBe(segments[i-1].endMinute);
      expect(nationalPlaybackSpeed(shape,solarVector(toInstant(date,(s.startMinute+s.endMinute)/2)))).toBe(s.speed);
      if(i){expect(nationalPlaybackSpeed(shape,solarVector(toInstant(date,s.startMinute-.02)))).toBe(segments[i-1].speed);expect(nationalPlaybackSpeed(shape,solarVector(toInstant(date,s.startMinute+.02)))).toBe(s.speed);}
    }
  });
  it('双图任一天交界均慢放，最近8日期缓存复用',()=>{
    const a=nationalPlaybackSegments('2026-06-21',shape),b=nationalPlaybackSegments('2025-12-21',shape);
    expect(nationalPlaybackSegments('2026-06-21',shape)).toBe(a);
    const combined=combinePlaybackSegments([a,b]);
    for(let minute=0;minute<1440;minute+=5){
      const expected=[a,b].some(day=>day.some(s=>s.startMinute<=minute&&minute<s.endMinute&&s.speed===8))?8:90;
      expect(combined.find(s=>s.startMinute<=minute&&minute<s.endMinute)?.speed).toBe(expected);
    }
    for(let i=1;i<=9;i++)nationalPlaybackSegments(`2026-10-${String(i).padStart(2,'0')}`,shape);
    expect(shape.cache.size).toBe(8);expect(shape.cache.has('2026-06-21')).toBe(false);
  });
});
