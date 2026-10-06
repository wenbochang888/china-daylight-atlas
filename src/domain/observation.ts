import { validDate } from './beijing-time';
import type { DayComparisonSummary, ObservationDay, ObservationScene, PlaybackSegment } from './types';

export function morningMinute(segments: readonly PlaybackSegment[]): number | null {
  const intervals = segments.filter(segment => segment.speed === 8).map(segment => ({
    start: Math.max(0, segment.startMinute), end: Math.min(720, segment.endMinute),
  })).filter(segment => segment.end > segment.start)
    .sort((a,b) => (b.end-b.start)-(a.end-a.start) || a.start-b.start);
  const interval = intervals[0];
  return interval ? Math.round((interval.start+interval.end)/2) : null;
}
export function minuteDuration(minutes: number): string {
  const value = Math.abs(Math.round(minutes));
  return value >= 60 ? `${Math.floor(value/60)}小时${value%60}分` : `${value}分`;
}
export function comparisonSummary(days: readonly ObservationDay[]): DayComparisonSummary | null {
  if (days.length !== 2) return null;
  const [first, second] = days;
  const daylight = Math.round(second.events.daylightMinutes)-Math.round(first.events.daylightMinutes);
  function eventDifference(kind: 'sunrise' | 'sunset') {
    const a = first.events[kind], b = second.events[kind];
    if (a === null || b === null) {
      const missing = [a === null ? '日期1' : '', b === null ? '日期2' : ''].filter(Boolean).join('、');
      return `无法比较：${missing}当日无该事件`;
    }
    const difference = Math.round(b)-Math.round(a);
    return difference === 0 ? '相同（按分钟比较）' : `${difference < 0 ? '提前' : '推迟'}${minuteDuration(difference)}`;
  }
  return { dates: [first.date, second.date], daylight: daylight === 0 ? '相同（按分钟比较）'
    : `${daylight > 0 ? '增加' : '减少'}${minuteDuration(daylight)}`, sunrise: eventDifference('sunrise'), sunset: eventDifference('sunset') };
}
export function timeInputMinute(hour: string, minute: string): number | null {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  const h = Number(hour), m = Number(minute);
  return h <= 24 && m <= 59 && (h !== 24 || m === 0) ? h*60+m : null;
}
export type SharedSceneResult = { kind: 'none' | 'invalid' | 'expired' } | { kind: 'valid'; scene: ObservationScene };
export function parseSharedScene(hash: string, limits: { min: string; max: string }): SharedSceneResult {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  if (!parameters.has('scene')) return { kind: 'none' };
  const allowed = ['scene','d1','d2','m','r'];
  if ([...parameters.keys()].some(key => !allowed.includes(key) || parameters.getAll(key).length !== 1)) return { kind: 'invalid' };
  const first = parameters.get('d1'), second = parameters.get('d2'), minute = parameters.get('m');
  if (parameters.get('scene') !== 'v1' || !first || !validDate(first) ||
    (second !== null && !validDate(second)) || minute === null || !/^\d+$/.test(minute) || Number(minute) > 1440) return { kind: 'invalid' };
  const dates: ObservationScene['dates'] = second === null ? [first] : [first, second];
  if (dates.some(date => date < limits.min || date > limits.max)) return { kind: 'expired' };
  return { kind: 'valid', scene: { dates, minute: Number(minute), regionId: parameters.get('r') ?? undefined } };
}
export function sharedSceneUrl(pageUrl: string, scene: ObservationScene): string {
  const url = new URL(pageUrl), parameters = new URLSearchParams({ scene: 'v1', d1: scene.dates[0], m: String(scene.minute) });
  if (scene.dates[1]) parameters.set('d2', scene.dates[1]);
  if (scene.regionId) parameters.set('r', scene.regionId);
  url.hash = parameters.toString();
  return url.toString();
}
