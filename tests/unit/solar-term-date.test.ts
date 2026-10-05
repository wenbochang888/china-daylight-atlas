import { describe, expect, it } from 'vitest';
import { solarTermForDate, solarTermOptions } from '../../src/domain/solar-terms';

describe('所选北京时间日期的节气标签',()=>{
  it.each([2025,2026])('%s年的全部24节气可按日期独立查询',year=>{
    const terms=solarTermOptions({min:`${year}-01-01`,max:`${year}-12-31`});
    for (const term of terms) expect(solarTermForDate(term.date!)).toBe(term.name);
  });
  it('夏至冬至及普通日期不依赖当前年或设备时区',()=>{
    expect(solarTermForDate('2026-06-21')).toBe('夏至');
    expect(solarTermForDate('2025-12-21')).toBe('冬至');
    expect(solarTermForDate('2026-12-22')).toBe('冬至');
    expect(solarTermForDate('2026-10-05')).toBeNull();
  });
});
