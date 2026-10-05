import { SearchSunLongitude } from 'astronomy-engine';
import { beijingDate } from './beijing-time';
import type { SolarTermOption } from './types';

// Hong Kong Observatory: apparent solar longitude, every 15 degrees.
export const solarTermDefinitions = [
  ['立春',315,2],['雨水',330,2],['惊蛰',345,3],['春分',0,3],
  ['清明',15,4],['谷雨',30,4],['立夏',45,5],['小满',60,5],
  ['芒种',75,6],['夏至',90,6],['小暑',105,7],['大暑',120,7],
  ['立秋',135,8],['处暑',150,8],['白露',165,9],['秋分',180,9],
  ['寒露',195,10],['霜降',210,10],['立冬',225,11],['小雪',240,11],
  ['大雪',255,12],['冬至',270,12],['小寒',285,1],['大寒',300,1],
] as const;
const years = new Map<number, { name: string; date: string; instant: string }[]>();
function termsForYear(year: number) {
  let terms = years.get(year);
  if (!terms) {
    terms = solarTermDefinitions.map(([name, longitude, month]) => {
      const time = SearchSunLongitude(longitude, new Date(Date.UTC(year,month-1,1)-8*3600000),32);
      if (!time) throw new Error(`${year}年${name}计算失败，请重试。`);
      return { name, date: beijingDate(time.date), instant: time.date.toISOString() };
    });
    if(years.size>=4) years.delete(years.keys().next().value!);
    years.set(year,terms);
  }
  return terms;
}
export function solarTermOptions(limits: {min:string;max:string}): SolarTermOption[] {
  const candidates: {name:string;date:string;instant:string}[] = [];
  for(let year=Number(limits.min.slice(0,4));year<=Number(limits.max.slice(0,4));year++) candidates.push(...termsForYear(year));
  return solarTermDefinitions.map(([name]) => {
    const match=candidates.filter(term=>term.name===name&&term.date>=limits.min&&term.date<=limits.max)
      .sort((a,b)=>b.instant.localeCompare(a.instant))[0];
    return {name,date:match?.date??null,instant:match?.instant??null,disabled:!match};
  });
}

// Match the selected civil day, including 24:00, rather than the moving instant.
export function solarTermForDate(date: string): string | null {
  return termsForYear(Number(date.slice(0,4))).find(term => term.date === date)?.name ?? null;
}
