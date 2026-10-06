import { describe, expect, it } from 'vitest';
import { comparisonSummary, morningMinute, parseSharedScene, sharedSceneUrl, timeInputMinute } from '../../src/domain/observation';
import type { ObservationDay, ObservationScene, PlaybackSegment } from '../../src/domain/types';

const limits = {min:'2025-01-01',max:'2026-12-31'};
const day = (date: string, sunrise: number | null, sunset: number | null, daylightMinutes: number): ObservationDay => ({date,events:{sunrise,sunset,daylightMinutes}});
describe('精选场景与时间定位', () => {
  it('晨光只选上午慢速区间，裁到12点并取最长区间中点，同长取较早', () => {
    const segments: PlaybackSegment[] = [
      {startMinute:0,endMinute:300,speed:90},{startMinute:300,endMinute:420,speed:8},
      {startMinute:600,endMinute:780,speed:8},{startMinute:900,endMinute:1400,speed:8},
    ];
    expect(morningMinute(segments)).toBe(360);
    expect(morningMinute([{startMinute:400,endMinute:800,speed:8}])).toBe(560);
    expect(morningMinute([{startMinute:300.2,endMinute:399.2,speed:8}])).toBe(350);
    expect(morningMinute([{startMinute:0,endMinute:1440,speed:90}])).toBeNull();
    expect(morningMinute([])).toBeNull();
  });
  it.each([['00','00',0],['06','20',380],['23','59',1439],['24','00',1440]])('接受时间 %s:%s', (hour,minute,expected) => {
    expect(timeInputMinute(hour,minute)).toBe(expected);
  });
  it.each([['24','01'],['25','00'],['23','60'],['','00'],['12',''],['-1','00'],['1.5','00'],['x','00'],[' 1','00']])('拒绝非法时间 %s:%s', (hour,minute) => {
    expect(timeInputMinute(hour,minute)).toBeNull();
  });
});
describe('代表点两日摘要', () => {
  it('按明细显示的整数分钟比较，不使用原始小数的差值取整', () => {
    expect(comparisonSummary([day('2026-06-21',300.49,1100.51,800.49),day('2026-12-22',360.51,1000.49,640.51)]))
      .toEqual({dates:['2026-06-21','2026-12-22'],daylight:'减少2小时39分',sunrise:'推迟1小时1分',sunset:'提前1小时41分'});
  });
  it('交换日期反转差异，相同注明分钟口径，缺事件不伪造零点', () => {
    expect(comparisonSummary([day('a',400,1000,600),day('b',390,1020,630)]))
      .toMatchObject({daylight:'增加30分',sunrise:'提前10分',sunset:'推迟20分'});
    expect(comparisonSummary([day('a',400.1,1000.1,600.1),day('b',400.2,1000.2,600.2)]))
      .toMatchObject({daylight:'相同（按分钟比较）',sunrise:'相同（按分钟比较）'});
    expect(comparisonSummary([day('a',null,1000,600),day('b',400,null,600)]))
      .toMatchObject({sunrise:'无法比较：日期1当日无该事件',sunset:'无法比较：日期2当日无该事件'});
    expect(comparisonSummary([day('a',null,null,0),day('b',null,null,1440)]))
      .toMatchObject({sunrise:'无法比较：日期1、日期2当日无该事件'});
    expect(comparisonSummary([day('a',400,1000,600)])).toBeNull();
  });
});
describe('网页场景链接', () => {
  it.each<ObservationScene>([
    {dates:['2026-06-21'],minute:0},
    {dates:['2025-12-21','2026-06-21'],minute:1440,regionId:'156440000'},
  ])('子目录链接可往返还原场景：%j', scene => {
    const url = new URL(sharedSceneUrl('https://example.test/atlas/?from=demo#old',scene));
    expect(url.pathname).toBe('/atlas/');
    expect(parseSharedScene(url.hash,limits)).toEqual({kind:'valid',scene});
    expect(url.hash).not.toMatch(/playing|theme|music/);
  });
  it.each([
    '#scene=v2&d1=2026-06-21&m=420','#scene=v1&d1=2026-02-30&m=420',
    '#scene=v1&d1=2026-06-21','#scene=v1&d1=2026-06-21&m=1441',
    '#scene=v1&d1=2026-06-21&m=-1','#scene=v1&d1=2026-06-21&m=1.5',
    '#scene=v1&d1=2026-06-21&m=420&d2=','#scene=v1&d1=2026-06-21&m=420&m=0',
    '#scene=v1&d1=2026-06-21&m=420&playing=true',
  ])('非法分享链接不部分套用：%s', hash => {
    expect(parseSharedScene(hash,limits)).toEqual({kind:'invalid'});
  });
  it('过期双日场景整体拒绝，未知省份交由目录核验', () => {
    expect(parseSharedScene('#scene=v1&d1=2024-12-21&d2=2026-06-21&m=420',limits)).toEqual({kind:'expired'});
    expect(parseSharedScene('#scene=v1&d1=2026-06-21&m=420&r=unknown',limits)).toMatchObject({kind:'valid',scene:{regionId:'unknown'}});
    expect(parseSharedScene('#section',limits)).toEqual({kind:'none'});
  });
});
