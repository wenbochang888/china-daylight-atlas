export type ComparisonAlignment = 'center' | 'top' | 'bottom';

// Translate a complete scene without changing its scale or crossing its pane.
export function comparisonOffset(alignment: ComparisonAlignment, scene: { top: number; bottom: number }, available: { top: number; bottom: number }) {
  if (alignment === 'center') return 0;
  const minimum = available.top - scene.top, maximum = available.bottom - scene.bottom;
  if (minimum > maximum) return 0;
  return alignment === 'bottom' ? Math.max(0, maximum) : Math.min(0, minimum);
}
