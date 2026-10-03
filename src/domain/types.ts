export type RegionLevel = 'province' | 'city' | 'county' | 'auxiliary';
export interface Region {
  id: string;
  name: string;
  provinceId: string;
  parentId: string | null;
  level: RegionLevel;
  center: [number, number];
  bounds: [number, number, number, number];
  pointKind: string;
  levelNote?: string | null;
  children: string[];
}
export interface Camera {
  center: [number, number];
  zoom: number;
  maxZoom: number;
}
export type SunVector = [number, number, number];
export type LightState = 'day' | 'night';
export interface SolarEvents {
  sunrise: number | null;
  sunset: number | null;
  daylightMinutes: number;
}
export interface SolarTermOption {
  name: string;
  date: string | null;
  instant: string | null;
  disabled: boolean;
}
export interface PlaybackSegment {
  startMinute: number;
  endMinute: number;
  speed: 8 | 90;
}

export type PlaybackMultiplier = 1 | 0.5;
