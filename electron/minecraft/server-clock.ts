/** HTTPS server time advanced by a monotonic clock, independent of Windows time. */
let sample: {server: number; mono: number} | null = null;
export function observeServerClock(date: string | null, startedWall: number, startedMono: number, age: string | null = null): void {
  const mono = performance.now(), wall = Date.now(), rtt = mono - startedMono;
  const server = date ? Date.parse(date) : NaN;
  if (!Number.isFinite(server) || rtt < 0 || rtt > 5000 || (age && Number(age) > 5)
    || Math.abs((wall - startedWall) - rtt) > 2000) return;
  sample = {server: server + rtt / 2, mono};
}
export function serverClockNow(): number | null {
  const elapsed = sample ? performance.now() - sample.mono : Infinity;
  return sample && elapsed >= 0 && elapsed < 5 * 60 * 1000 ? (sample.server + elapsed) / 1000 : null;
}
export function serverClockStatus(): {checked: boolean; driftSeconds: number; warning: boolean} {
  const now = serverClockNow(), driftSeconds = now === null ? 0 : Math.round(now - Date.now() / 1000);
  return {checked: now !== null, driftSeconds, warning: now !== null && Math.abs(driftSeconds) >= 15};
}
