import { describe, expect, it } from 'vitest';
import { beijingDate, beijingMinute, clampDate, clampMinute, dateLimits, formatMinute, toInstant, validDate } from '../../src/domain/beijing-time';
import { advancePlayback } from '../../src/domain/national-playback';

describe('北京时间日期和时间轴', () => {
  it('开放上一年与当前年全年，包含未来日期、闰日与北京时间跨年', () => {
    expect(dateLimits(new Date('2026-10-01T16:00:00Z'))).toEqual({ min: '2025-01-01', max: '2026-12-31' });
    expect(dateLimits(new Date('2028-02-29T04:00:00Z'))).toEqual({ min: '2027-01-01', max: '2028-12-31' });
    expect(dateLimits(new Date('2026-12-31T15:59:59Z'))).toEqual({ min: '2025-01-01', max: '2026-12-31' });
    expect(dateLimits(new Date('2026-12-31T16:00:00Z'))).toEqual({ min: '2026-01-01', max: '2027-12-31' });
    expect(beijingDate(new Date('2026-10-01T15:59:59Z'))).toBe('2026-10-01');
    expect(beijingMinute(new Date('2026-10-01T16:00:00Z'))).toBe(0);
  });
  it('不受设备时区影响，24:00是同一天的日终', () => {
    expect(toInstant('2026-10-01', 0).toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(toInstant('2026-10-01', 1440).toISOString()).toBe('2026-10-01T16:00:00.000Z');
    expect(formatMinute(1440)).toBe('24:00');
    expect(clampMinute(-60)).toBe(0); expect(clampMinute(1500)).toBe(1440);
  });
  it('拒绝不存在的日期并限制日期范围', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('')).toBe(false);
    const limits = dateLimits(new Date('2026-10-03T04:00:00Z'));
    expect(clampDate('2026-12-31', limits)).toBe('2026-12-31');
    expect(clampDate('2024-12-31', limits)).toBe('2025-01-01');
    expect(clampDate('2027-01-01', limits)).toBe('2026-12-31');
  });
});
describe('依据经过时间自动变速', () => {
  const segments = [{startMinute:0,endMinute:300,speed:90 as const},{startMinute:300,endMinute:600,speed:8 as const},{startMinute:600,endMinute:1440,speed:90 as const}];
  it('相同经过时间的推进不取决于帧率', () => {
    let minute=0;
    for(let i=0;i<60;i++) minute=advancePlayback(minute,1/60,segments).minute;
    expect(minute).toBeCloseTo(90,8);
    expect(advancePlayback(0,1,segments).minute).toBe(90);
  });
  it('跨分段按耗时积分，不能高速跳过转场', () => {
    expect(advancePlayback(270,2,segments).minute).toBeCloseTo(300 + 8 * (2 - 30 / 90),8);
    expect(advancePlayback(590,2,segments).minute).toBeCloseTo(600 + 90 * (2 - 10 / 8),8);
    expect(advancePlayback(270,40,segments).minute).toBeCloseTo(795,8);
  });
  it('全国90／8、市级45／4，倍率不改变分段边界', () => {
    expect(advancePlayback(0,1,segments,0.5).minute).toBe(45);
    expect(advancePlayback(400,1,segments).minute).toBe(408);
    expect(advancePlayback(400,1,segments,0.5).minute).toBe(404);
    expect(advancePlayback(270,2,segments,0.5).minute).toBeCloseTo(advancePlayback(270,1,segments).minute,8);
  });
  it('到24:00停止，日期由调用方保留', () => {
    expect(advancePlayback(1430,2,segments)).toEqual({minute:1440,stopped:true});
    expect(advancePlayback(1440,1,segments)).toEqual({minute:1440,stopped:true});
  });
});
