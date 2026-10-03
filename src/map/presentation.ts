import type { FeatureCollection, Position } from 'geojson';

type Bounds = [number, number, number, number];
function polygonBounds(rings: Position[][]): Bounds {
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) for (const [lng, lat] of ring) {
    bounds[0] = Math.min(bounds[0], lng); bounds[1] = Math.min(bounds[1], lat);
    bounds[2] = Math.max(bounds[2], lng); bounds[3] = Math.max(bounds[3], lat);
  }
  return bounds;
}

function ringCenter(ring: Position[]) {
  let twiceArea = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i+1], cross = a[0]*b[1] - b[0]*a[1];
    twiceArea += cross; x += (a[0]+b[0])*cross; y += (a[1]+b[1])*cross;
  }
  if (!twiceArea) return null;
  return { area: Math.abs(twiceArea)/2, point: [x/(3*twiceArea), y/(3*twiceArea)] as [number,number] };
}
function polygonCenter(rings: Position[][]) {
  let area = 0, x = 0, y = 0;
  rings.forEach((ring, i) => {
    const center = ringCenter(ring); if (!center) return;
    const weight = center.area * (i === 0 ? 1 : -1);
    area += weight; x += center.point[0]*weight; y += center.point[1]*weight;
  });
  return area > 0 ? { area, point: [x/area, y/area] as [number,number] } : null;
}
function inRing([x,y]: [number,number], ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1]>y)!==(b[1]>y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
  }
  return inside;
}

// Display anchors are separate from official labels and astronomical representative points.
export function provinceLabelPresentation(labels: FeatureCollection, provinces: FeatureCollection): FeatureCollection {
  const fixed = new Set(['156110000','156120000','156310000','156500000','156810000','156820000','156460000','156710000']);
  const centers = new Map<string, [number,number]>();
  for (const feature of provinces.features) {
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') continue;
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const largest = polygons.map(rings => ({ rings, center: polygonCenter(rings) }))
      .filter(part => !!part.center).sort((a,b) => b.center!.area - a.center!.area)[0];
    if (largest?.center && inRing(largest.center.point, largest.rings[0]) && !largest.rings.slice(1).some(ring => inRing(largest.center!.point, ring)))
      centers.set(String(feature.properties?.id), largest.center.point);
  }
  return { type: 'FeatureCollection', features: labels.features.filter(feature => feature.properties?.level === 'province').map(feature => {
    const id = String(feature.properties?.id), name = String(feature.properties?.name);
    const center = fixed.has(id) ? undefined : centers.get(id);
    return { ...feature, properties: { ...feature.properties, displayLevel: 'province', narrowName: name.replace('自治区','\n自治区') },
      geometry: center ? { type: 'Point' as const, coordinates: center } : feature.geometry };
  }) };
}

// Presentation only: retain whole polygon parts and never modify the cached source.
// These ranges describe the current official snapshot, not administrative boundaries.
export function mainMapPresentation(provinces: FeatureCollection, boundaries: FeatureCollection) {
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const features = provinces.features.flatMap(feature => {
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return [];
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const coordinates = polygons.filter(polygon => {
      const b = polygonBounds(polygon);
      const offshore = ['156440000', '156460000'].includes(String(feature.properties?.id)) &&
        b[0] >= 111.5 && b[2] <= 118.5 && b[3] <= 21.5;
      if (b[3] < 18 || offshore) return false;
      bounds[0] = Math.min(bounds[0], b[0]); bounds[1] = Math.min(bounds[1], b[1]);
      bounds[2] = Math.max(bounds[2], b[2]); bounds[3] = Math.max(bounds[3], b[3]);
      return true;
    });
    if (!coordinates.length) return [];
    return [{ ...feature, geometry: { type: 'MultiPolygon' as const, coordinates } }];
  });
  return {
    provinces: { type: 'FeatureCollection', features } as FeatureCollection,
    boundaries: { type: 'FeatureCollection', features: boundaries.features.filter(f => f.properties?.gb !== '156990000') } as FeatureCollection,
    bounds: [[bounds[0], bounds[1]], [bounds[2], bounds[3]]] as [[number, number], [number, number]],
  };
}
