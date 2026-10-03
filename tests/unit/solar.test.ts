import { describe, expect, it } from 'vitest';
import { Body, Equator, Horizon, Observer, SearchRiseSet } from 'astronomy-engine';
import { lightState, solarAltitude, solarEvents, solarVector } from '../../src/domain/solar';
import { toInstant } from '../../src/domain/beijing-time';
import noaaReference from '../fixtures/noaa-solar.json';

const sites: [string, number, number][] = [
  ['北京',116.4074,39.9042],['上海',121.4737,31.2304],['乌鲁木齐',87.6168,43.8256],
  ['拉萨',91.1322,29.6604],['漠河',122.5363,52.9721],['三亚',109.5119,18.2528],
  ['香港',114.1694,22.3193],['澳门',113.5439,22.1987],['台北',121.5654,25.0330],
];
describe('统一的太阳高度模型', () => {
  it('日出日落阈值只划分白天与黑夜', () => {
    expect(lightState(-0.8333)).toBe('day'); expect(lightState(-0.834)).toBe('night');
    expect(lightState(-6)).toBe('night'); expect(lightState(-6.001)).toBe('night');
  });
  it.each(['2026-06-21','2025-12-21','2026-10-01'])('在 %s 各代表点与观测者坐标变换交叉核验', date => {
    for (const [, lng, lat] of sites) for (const minute of [0,360,720,1080,1440]) {
      const time = toInstant(date,minute), observer = new Observer(lat,lng,0);
      const equator = Equator(Body.Sun,time,observer,true,true);
      const reference = Horizon(time,observer,equator.ra,equator.dec);
      // Solar parallax is omitted in the geocentric map model (< 0.003 degrees).
      expect(Math.abs(solarAltitude(solarVector(time),lng,lat)-reference.altitude)).toBeLessThan(0.02);
    }
  });
  it.each(sites)('%s 日出日落属于所选北京时间日，与独立求根接口相差小于2分钟', (_,lng,lat) => {
    const date = '2026-10-01', start = toInstant(date,0), events = solarEvents(date,lng,lat);
    for (const [direction,key] of [[1,'sunrise'],[-1,'sunset']] as const) {
      const result = SearchRiseSet(Body.Sun,new Observer(lat,lng,0),direction,start,1)!;
      const minute = (result.date.getTime()-start.getTime())/60000;
      expect(events[key]).not.toBeNull();
      expect(Math.abs(events[key]!-minute)).toBeLessThan(2);
    }
    expect(events.daylightMinutes).toBeCloseTo(events.sunset!-events.sunrise!,6);
  });
  it('极地无事件时保留明确空值和正确昼长', () => {
    const summer = solarEvents('2026-06-21',0,89);
    expect(summer.sunrise).toBeNull(); expect(summer.sunset).toBeNull(); expect(summer.daylightMinutes).toBe(1440);
    const winter = solarEvents('2025-12-21',0,89);
    expect(winter.daylightMinutes).toBe(0);
  });
  it('27组日期／地点与NOAA独立算法的日出日落相差不到2分钟', () => {
    let maximum = 0;
    for (const reference of noaaReference) {
      const actual = solarEvents(reference.date,reference.lng,reference.lat);
      maximum = Math.max(maximum, Math.abs(actual.sunrise!-reference.sunrise), Math.abs(actual.sunset!-reference.sunset));
    }
    expect(maximum).toBeLessThan(2);
    console.log(`NOAA comparison maximum difference: ${maximum.toFixed(3)} minutes (27 site/dates)`);
  });
});
