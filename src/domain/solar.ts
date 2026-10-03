import { Body, GeoVector, RotateVector, Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';
import { toInstant } from './beijing-time';
import type { LightState, SolarEvents, SunVector } from './types';

export const SUNRISE_ALTITUDE = -0.8333;
const RAD = Math.PI / 180;

// Geocentric equator-of-date -> Earth-fixed. No atmospheric refraction is applied here.
export function solarVector(date: Date): SunVector {
  const eq = RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body.Sun, date, true));
  const angle = SiderealTime(date) * 15 * RAD;
  const length = Math.hypot(eq.x, eq.y, eq.z);
  return [
    (eq.x * Math.cos(angle) + eq.y * Math.sin(angle)) / length,
    (-eq.x * Math.sin(angle) + eq.y * Math.cos(angle)) / length,
    eq.z / length,
  ];
}
export function solarAltitude(vector: SunVector, lng: number, lat: number): number {
  const longitude = lng * RAD, latitude = lat * RAD;
  const dot = Math.cos(latitude) * Math.cos(longitude) * vector[0] +
    Math.cos(latitude) * Math.sin(longitude) * vector[1] + Math.sin(latitude) * vector[2];
  return Math.asin(Math.max(-1, Math.min(1, dot))) / RAD;
}
export function lightState(altitude: number): LightState {
  return altitude >= SUNRISE_ALTITUDE ? 'day' : 'night';
}
export const lightLabels: Record<LightState, string> = { day: '白天', night: '黑夜' };

const daySamples = new Map<string, SunVector[]>();
function samples(date: string): SunVector[] {
  let result = daySamples.get(date);
  if (!result) {
    result = Array.from({ length: 145 }, (_, i) => solarVector(toInstant(date, i * 10)));
    if (daySamples.size >= 4) daySamples.delete(daySamples.keys().next().value!);
    daySamples.set(date, result);
  }
  return result;
}
export function solarEvents(date: string, lng: number, lat: number): SolarEvents {
  const heights = samples(date).map(vector => solarAltitude(vector, lng, lat));
  function crossings(threshold: number): { rising: number | null; falling: number | null; duration: number } {
    let rising: number | null = null, falling: number | null = null;
    let start = heights[0] >= threshold ? 0 : null;
    let duration = 0;
    for (let i = 1; i < heights.length; i++) {
      const before = heights[i - 1] >= threshold, after = heights[i] >= threshold;
      if (before === after) continue;
      let low = (i - 1) * 10, high = i * 10;
      while ((high - low) * 60 > 0.5) {
        const mid = (low + high) / 2;
        const above = solarAltitude(solarVector(toInstant(date, mid)), lng, lat) >= threshold;
        if (above === before) low = mid; else high = mid;
      }
      const time = (low + high) / 2;
      if (after) { rising = time; start = time; }
      else { falling = time; duration += time - (start ?? 0); start = null; }
    }
    if (start !== null) duration += 1440 - start;
    return { rising, falling, duration };
  }
  const sun = crossings(SUNRISE_ALTITUDE);
  return { sunrise: sun.rising, sunset: sun.falling, daylightMinutes: sun.duration };
}
