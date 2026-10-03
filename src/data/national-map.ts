import type { FeatureCollection } from 'geojson';
import type { Region } from '../domain/types';
import bundledMap from './generated/national-map.json?raw';

export interface NationalMapBundle {
  regions: Region[];
  provinces: FeatureCollection;
  boundaries: FeatureCollection;
  labels: FeatureCollection;
  islandLabels: FeatureCollection;
}
let data: NationalMapBundle | undefined;
export function nationalMap(): NationalMapBundle {
  return data ??= JSON.parse(bundledMap) as NationalMapBundle;
}
