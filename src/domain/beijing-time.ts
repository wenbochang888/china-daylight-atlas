const OFFSET_MS = 8 * 60 * 60 * 1000;
const MINUTE_MS = 60000;

export function beijingDate(now = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
export function beijingMinute(now = new Date()): number {
  const local = new Date(now.getTime() + OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}
export function dateLimits(now = new Date()): { min: string; max: string } {
  const year = Number(beijingDate(now).slice(0, 4));
  return { min: `${year - 1}-01-01`, max: `${year}-12-31` };
}
export function toInstant(date: string, minute: number): Date {
  if (!validDate(date)) throw new Error('无效日期');
  return new Date(Date.parse(`${date}T00:00:00+08:00`) + clampMinute(minute) * MINUTE_MS);
}
export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export function clampDate(date: string, limits: { min: string; max: string }): string {
  if (!validDate(date)) return limits.max;
  return date < limits.min ? limits.min : date > limits.max ? limits.max : date;
}
export function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
}
export function clampMinute(minute: number): number {
  return Math.max(0, Math.min(1440, Number.isFinite(minute) ? minute : 0));
}
export function formatMinute(minute: number): string {
  const value = Math.min(1440, Math.max(0, Math.round(minute)));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
