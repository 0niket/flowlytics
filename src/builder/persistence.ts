import type { LineConfig } from "./LineConfig";
import { createDefaultEconomicsConfig } from "./LineConfig";

const STORAGE_KEY = "flowlytics_builder_draft";
const CURRENT_VERSION = 6;

export interface PersistedDraft {
  config: LineConfig;
  version?: number;
}

export function saveDraft(config: LineConfig): void {
  const data: PersistedDraft = { config, version: CURRENT_VERSION };
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadDraft(): PersistedDraft | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.config) return null;

    const version = typeof parsed.version === "number" ? parsed.version : 1;

    if (version < CURRENT_VERSION) {
      const config = parsed.config as LineConfig & Record<string, unknown>;

      // v3→v4: add economics if missing
      if (!config.economics) {
        config.economics = createDefaultEconomicsConfig();
      }

      // v4→v5: remove centralized cost fields from economics
      const econ = config.economics as unknown as Record<string, unknown>;
      delete econ.operatorCostPerHr;
      delete econ.waterAndEffluentCostPerHr;
      delete econ.basketCostRs;
      delete econ.basketLifeYears;
      delete econ.operatingHoursPerYear;

      // v4→v5: remove tankFixedCostPerHr from all stations
      for (const station of config.stations) {
        delete (station as unknown as Record<string, unknown>).tankFixedCostPerHr;
      }

      // v4→v5: remove lifeYears from all wagons
      if (config.transport?.wagons) {
        for (const wagon of config.transport.wagons) {
          delete (wagon as unknown as Record<string, unknown>).lifeYears;
        }
      }

      // v5→v6: WDO uses dryTimeSec instead of dwellSec
      for (const station of config.stations) {
        if (station.kind === "wdo" && !station.dryTimeSec) {
          station.dryTimeSec = station.dwellSec || 600;
          station.dwellSec = 0;
        }
      }

      saveDraft(config as LineConfig);
      return { config: config as LineConfig, version: CURRENT_VERSION };
    }

    return { config: parsed.config as LineConfig, version: CURRENT_VERSION };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
