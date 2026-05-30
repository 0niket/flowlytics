import type { DistanceMode } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distanceMm(a: { x: number; y: number }, b: { x: number; y: number }, mode: DistanceMode): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return mode === "euclidean" ? Math.hypot(dx, dy) : dx + dy;
}

export function escapeHtml(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function mPerMinToMmPerSec(mPerMin: number): number {
  return (mPerMin * 1000) / 60;
}

export function minutesToSeconds(min: number): number {
  return min * 60;
}

export function secondsToMinutes(sec: number): number {
  return sec / 60;
}
