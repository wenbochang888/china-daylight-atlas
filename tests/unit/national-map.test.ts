import { describe, expect, it } from 'vitest';
import { nationalMap } from '../../src/data/national-map';
import { nationalPresentation } from '../../src/map/national-presentation';

describe('内置全国地图', () => {
  it('只包含省级目录和标签，主附图共用同一份完整数据与展示计算', () => {
    const data = nationalMap(), before = JSON.stringify(data);
    expect(data.regions).toHaveLength(34); expect(data.labels.features).toHaveLength(34);
    expect(data.regions.every(region => region.level === 'province')).toBe(true);
    const presentation = nationalPresentation();
    expect(nationalMap()).toBe(data); expect(nationalPresentation()).toBe(presentation);
    expect(presentation.provinces).toBe(data.provinces);
    expect(presentation.provinceLabels.features).toHaveLength(34);
    expect(presentation.main.provinces).not.toBe(data.provinces);
    expect(JSON.stringify(data)).toBe(before);
  });
});
