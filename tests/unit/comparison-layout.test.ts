import { describe, expect, it } from 'vitest';
import { comparisonOffset } from '../../src/map/comparison-layout';

describe('竖屏全屏双图向分隔线靠拢', () => {
  const scene = { top: 90, bottom: 340 }, available = { top: 64, bottom: 410 };
  it('上图下移，下图上移，完整内容保留在可用范围', () => {
    expect(comparisonOffset('bottom', scene, available)).toBe(70);
    expect(comparisonOffset('top', scene, available)).toBe(-26);
    expect(comparisonOffset('center', scene, available)).toBe(0);
  });
  it('空间不足时停止移动，不能为了靠拢裁切内容', () => {
    expect(comparisonOffset('bottom', { top: 50, bottom: 450 }, available)).toBe(0);
    expect(comparisonOffset('top', { top: 50, bottom: 450 }, available)).toBe(0);
  });
  it('已经靠边时不反向移动', () => {
    expect(comparisonOffset('bottom', { top: 90, bottom: 420 }, available)).toBe(0);
    expect(comparisonOffset('top', { top: 60, bottom: 340 }, available)).toBe(0);
  });
});
