import type { StationLabel, DxfLabel, StationValidation } from "../types";

const stationPattern = /^AS\s*(\d+)$/i;
const tankPattern = /^TANK\s*(\d+)$/i;

export function detectStationsFromLabels(labels: DxfLabel[]): StationLabel[] {
  const stations: StationLabel[] = [];
  for (const l of labels) {
    const t = l.text.trim();
    const asMatch = t.match(stationPattern);
    const tankMatch = t.match(tankPattern);
    if (asMatch) {
      stations.push({ id: "AS" + asMatch[1].padStart(2, "0"), num: parseInt(asMatch[1], 10), x: l.x, y: l.y, label: t });
    } else if (tankMatch) {
      stations.push({ id: "T" + tankMatch[1], num: parseInt(tankMatch[1], 10), x: l.x, y: l.y, label: t });
    }
  }
  stations.sort((a, b) => a.num - b.num);
  return stations;
}

export function validateStationClarity(
  detected: StationLabel[],
  tankCount: number,
): StationValidation {
  const detectedNums = new Set(detected.map((s) => s.num));
  const missingStations: string[] = [];
  for (let i = 1; i <= tankCount; i++) {
    if (!detectedNums.has(i)) missingStations.push(`T${i}`);
  }
  const ambiguousStations: string[] = [];
  const numCounts = new Map<number, number>();
  for (const s of detected) {
    numCounts.set(s.num, (numCounts.get(s.num) ?? 0) + 1);
  }
  for (const [num, count] of numCounts) {
    if (count > 1) ambiguousStations.push(`T${num}`);
  }
  const missingPenalty = missingStations.length / tankCount;
  const ambiguousPenalty = ambiguousStations.length / Math.max(1, detected.length);
  const overlapPenalty = detected.length > tankCount ? (detected.length - tankCount) / detected.length : 0;
  const confidence = Math.max(0, 1 - missingPenalty - ambiguousPenalty - overlapPenalty);
  return { confidence, missingStations, ambiguousStations };
}
