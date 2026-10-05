import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FeatureCollection, MultiPolygon } from 'geojson';
import { mainMapPresentation, provinceLabelPresentation } from '../../src/map/presentation';

const provinces: FeatureCollection = JSON.parse(readFileSync('public/maps/provinces.json', 'utf8'));
const boundaries: FeatureCollection = JSON.parse(readFileSync('public/maps/context/boundaries.json', 'utf8'));
const labels: FeatureCollection = JSON.parse(readFileSync('public/maps/labels.json', 'utf8'));
describe('省名显示锚点', () => {
  it('34个单字展示简称按行政区ID对应，保留完整名称和原始输入', () => {
    const original = JSON.stringify(labels);
    const display = provinceLabelPresentation(labels, mainMapPresentation(provinces,boundaries).provinces);
    const expected = ['京','津','冀','晋','蒙','辽','吉','黑','沪','苏','浙','皖','闽','赣','鲁','豫','鄂','湘','粤','桂','琼','渝','川','贵','云','藏','陕','甘','青','宁','新','台','港','澳'];
    expect(display.features.map(feature=>feature.properties?.shortName)).toEqual(expected);
    expect(new Set(expected).size).toBe(34);
    for (const feature of display.features) {
      expect(feature.properties?.name).toBe(labels.features.find(source=>source.properties?.id===feature.properties?.id)!.properties?.name);
    }
    expect(JSON.stringify(labels)).toBe(original);
  });
  it('保留34名称和原始数据，青海使用省域质心、面外质心和特殊省份保留官方点', () => {
    const original = JSON.stringify(labels);
    const main = mainMapPresentation(provinces, boundaries);
    const display = provinceLabelPresentation(labels, main.provinces);
    expect(display.features).toHaveLength(34);
    for (const feature of display.features) {
      const source = labels.features.find(f => f.properties?.id === feature.properties?.id)!;
      expect(feature.properties?.name).toBe(source.properties?.name);
      expect(feature.properties?.displayLevel).toBe('province');
    }
    const point = (collection: FeatureCollection, id: string) => collection.features.find(f => f.properties?.id === id)!.geometry;
    expect(point(display,'156630000')).not.toEqual(point(labels,'156630000'));
    for (const id of ['156620000','156110000','156810000','156710000']) expect(point(display,id)).toEqual(point(labels,id));
    expect(JSON.stringify(labels)).toBe(original);
  });
});
describe('全国主图展示与完整计算输入分离', () => {
  it('保留34省、海南主体、港澳台和钓鱼岛，南海部件与境界线留给附图', () => {
    const original = JSON.stringify({ provinces, boundaries });
    const main = mainMapPresentation(provinces, boundaries);
    expect(main.provinces.features.map(f => f.properties?.id)).toEqual(provinces.features.map(f => f.properties?.id));
    expect(main.bounds).toEqual([[73.498962, 18.162997], [135.087387, 53.558498]]);
    const hainan = main.provinces.features.find(f => f.properties?.id === '156460000')!;
    const parts = (hainan.geometry as MultiPolygon).coordinates;
    expect(parts).toHaveLength(4);
    expect(parts.some(p => p[0].some(([lng, lat]) => lng === 108.614708 && lat > 18))).toBe(true);
    for (const f of main.provinces.features) {
      const source = provinces.features.find(s => s.properties?.id === f.properties?.id)!;
      const originalParts = (source.geometry as MultiPolygon).coordinates;
      for (const part of (f.geometry as MultiPolygon).coordinates) expect(originalParts).toContain(part);
    }
    const taiwan = main.provinces.features.find(f => f.properties?.id === '156710000')!;
    expect(taiwan.geometry).toEqual(provinces.features.find(f => f.properties?.id === '156710000')!.geometry);
    expect(main.boundaries.features).toHaveLength(7);
    expect(main.boundaries.features.some(f => f.properties?.gb === '156990000')).toBe(false);
    expect(boundaries.features.some(f => f.properties?.gb === '156990000')).toBe(true);
    expect(JSON.stringify({ provinces, boundaries })).toBe(original);
  });
  it('保留多边形的孔洞与完整属性，不切断边缘或修改输入', () => {
    const body = [[[108,18],[111,18],[111,20],[108,20],[108,18]], [[109,19],[109,19.5],[110,19.5],[110,19],[109,19]]];
    const island = [[[112,16],[113,16],[113,17],[112,17],[112,16]]];
    const input: FeatureCollection = { type:'FeatureCollection', features:[{ type:'Feature', properties:{id:'156460000',name:'海南省',note:'保留'},
      geometry:{type:'MultiPolygon',coordinates:[body,island]} }] };
    const main = mainMapPresentation(input, { type:'FeatureCollection',features:[] });
    expect((main.provinces.features[0].geometry as MultiPolygon).coordinates).toEqual([body]);
    expect(main.provinces.features[0].properties).toEqual(input.features[0].properties);
    expect((input.features[0].geometry as MultiPolygon).coordinates).toEqual([body,island]);
    expect(main.bounds).toEqual([[108,18],[111,20]]);
  });
});
