import type { StationLabel, DxfLabel } from "../types";

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
