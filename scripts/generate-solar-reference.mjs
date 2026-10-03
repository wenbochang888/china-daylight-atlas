// Test-only NOAA reference. This script has no network access or runtime app role.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const reference = require('../tests/fixtures/noaa-math.cjs');
const sites = [['北京',116.4074,39.9042],['上海',121.4737,31.2304],['乌鲁木齐',87.6168,43.8256],['拉萨',91.1322,29.6604],['漠河',122.5363,52.9721],['三亚',109.5119,18.2528],['香港',114.1694,22.3193],['澳门',113.5439,22.1987],['台北',121.5654,25.0330]];
const output = [];
for (const date of ['2026-10-01','2026-06-21','2025-12-21']) for (const [name,lng,lat] of sites) {
  const jd = reference.getJD(...date.split('-').map(Number));
  const result = { date,name,lng,lat };
  for (const [rise,key] of [[true,'sunrise'],[false,'sunset']]) {
    const first = reference.calcSunriseSetUTC(rise,jd,lat,lng);
    result[key] = reference.calcSunriseSetUTC(rise,jd+first/1440,lat,lng)+480;
  }
  output.push(result);
}
writeFileSync(new URL('../tests/fixtures/noaa-solar.json',import.meta.url),JSON.stringify(output,null,2));
console.log('27 independent NOAA site/date references generated.');
