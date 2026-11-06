export const MINUTE = 60000;
export function timeMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function asTime(minutes: number) {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
export function dayNumber(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
}
export function dayString(day: number) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}
export function weekKey(day: number, weekStart: number) {
  const dow = new Date(day * 86400000).getUTCDay();
  return day - ((dow - weekStart + 7) % 7);
}
export function interval(start: string, end: string): [number, number] {
  const a = timeMinutes(start);
  let b = timeMinutes(end);
  if (b < a) b += 1440;
  return [a, b];
}
