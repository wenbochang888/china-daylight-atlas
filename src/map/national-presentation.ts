import { nationalMap } from '../data/national-map';
import { mainMapPresentation, provinceLabelPresentation } from './presentation';

let cached: ReturnType<typeof prepare> | undefined;
function prepare() {
  const data = nationalMap();
  const main = mainMapPresentation(data.provinces, data.boundaries);
  return { ...data, main, provinceLabels: provinceLabelPresentation(data.labels, main.provinces) };
}
export function nationalPresentation() { return cached ??= prepare(); }
