import type { FeatureCollection } from 'geojson';
import type { Region, RegionLevel } from '../domain/types';

const cache = new Map<string, Promise<unknown>>();
export async function resource<T>(path: string): Promise<T> {
  let request = cache.get(path);
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}maps/${path}`).then(response => {
      if (!response.ok) throw new Error(`地图文件加载失败 (${response.status})`);
      return response.json();
    }).catch(error => { cache.delete(path); throw error; });
    cache.set(path, request);
  }
  return request as Promise<T>;
}
export const loadIndex = () => resource<Region[]>('index.json');
export const loadGeometry = (provinceId: string, level: Extract<RegionLevel, 'city' | 'county'>) =>
  resource<FeatureCollection>(`regions/${provinceId}-${level}.json`);
export const MAX_BROWSE_ZOOM = 7;
export const CITY_BROWSE_ZOOM = 5;
export function browsable(region: Region) {
  return region.level === 'province' || region.level === 'city' ||
    (region.provinceId === '156710000' && region.level === 'county');
}
export function terminal(region: Region | null) { return !!region && region.level !== 'province'; }
export function showsCityLevel(zoom: number, region: Region | null) { return zoom >= CITY_BROWSE_ZOOM || terminal(region); }
export function browseLevel(region: Region) {
  return region.level === 'province' ? '省级' : region.level === 'county' ? '县市对应层级' : '市级';
}
export async function loadBrowseGeometry(provinceId: string): Promise<FeatureCollection> {
  const collection = await loadGeometry(provinceId, provinceId === '156710000' ? 'county' : 'city');
  return { type: 'FeatureCollection', features: collection.features.filter(feature =>
    feature.properties?.level === 'city' || provinceId === '156710000') };
}
export function regionPath(region: Region, index: Map<string, Region>): Region[] {
  const path: Region[] = [region];
  let parent = region.parentId;
  while (parent) {
    const item = index.get(parent);
    if (!item || path.some(p => p.id === item.id)) break;
    path.unshift(item); parent = item.parentId;
  }
  return path;
}
