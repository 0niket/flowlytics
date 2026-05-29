import type { DistanceMode } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  const s = Math.max(0, seconds);
  const total = Math.round(s);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}m ${String(ss).padStart(2, "0")}s`;
}

export function formatPct01(x: number): string {
  if (!Number.isFinite(x)) return "-";
  return `${Math.round(clamp(x, 0, 1) * 100)}%`;
}

export function pctDelta(actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return ((actual - target) / target) * 100;
}

export function formatTimeShort(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(0)}s`;
  const mm = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${mm}m${String(ss).padStart(2, "0")}s`;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((s) => s.trim());
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (parts[i] ?? "").trim();
    rows.push(row);
  }
  return rows;
}

export function normText(s: string): string {
  return String(s || "").replace(/\\P/g, " ").replace(/\s+/g, " ").trim();
}

export function safeParseNumber(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function approxTextMatch(text: string, target: string): boolean {
  const t = normText(text).toUpperCase();
  const q = normText(target).toUpperCase();
  return t === q || t.includes(q);
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
