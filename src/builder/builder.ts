import { minutesToSeconds } from "../utils";
import {
  createDefaultLineConfig,
  type LineConfig,
  type StationConfig,
  type TankType,
  type ArticleMaterialType,
} from "./LineConfig";

export const STEP_COUNT = 4;
export const STATION_STEP = 0;
export const TRANSPORT_STEP = 1;
export const SETTINGS_STEP = 2;
export const REVIEW_STEP = 3;

export class Builder {
  private _config: LineConfig;
  currentStep: number = 0;

  constructor(existing?: LineConfig) {
    this._config = existing ? JSON.parse(JSON.stringify(existing)) : createDefaultLineConfig();
  }

  get config(): LineConfig {
    return this._config;
  }

  // ─── Navigation ──────────────────────────────────────────

  canGoNext(): boolean {
    return this.validate().length === 0;
  }

  canGoBack(): boolean {
    return this.currentStep > 0;
  }

  next(): void {
    if (this.currentStep >= REVIEW_STEP) return;
    if (!this.canGoNext()) return;
    this.currentStep++;
  }

  back(): void {
    if (this.currentStep > 0) this.currentStep--;
  }

  // ─── Station Operations ──────────────────────────────────

  addTank(afterIndex: number): void {
    if (afterIndex <= 0) throw new Error("Cannot add tank before LOAD");
    const unloadIdx = this._config.stations.findIndex((s) => s.kind === "unloading");
    if (afterIndex >= unloadIdx) throw new Error("Cannot add tank after UNLOAD");
    const newTank: StationConfig = {
      id: "",
      label: "",
      kind: "tank",
      tankType: "chemical",
      dwellSec: minutesToSeconds(2.5),
      tolerancePct: 0.1,
    };
    this._config.stations.splice(afterIndex, 0, newTank);
    this._reindexTanks();
  }

  removeTank(index: number): void {
    const station = this._config.stations[index];
    if (!station || station.kind !== "tank") {
      throw new Error(`No tank at index ${index}`);
    }
    const tankCount = this._config.stations.filter((s) => s.kind === "tank").length;
    if (tankCount <= 1) {
      throw new Error("At least 1 tank is required");
    }
    this._config.stations.splice(index, 1);
    this._reindexTanks();
  }

  setTankType(index: number, tankType: TankType): void {
    const station = this._config.stations[index];
    if (!station || station.kind !== "tank") {
      throw new Error(`No tank at index ${index}`);
    }
    station.tankType = tankType;
    if (tankType === "extra") {
      station.dwellSec = 0;
      station.tolerancePct = undefined;
    } else if (tankType === "rinse") {
      station.tolerancePct = 0.5;
    } else {
      station.tolerancePct = 0.1;
    }
  }

  setDwell(index: number, dwellSec: number): void {
    const station = this._config.stations[index];
    if (!station || station.kind !== "tank") {
      throw new Error(`No tank at index ${index}`);
    }
    if (dwellSec < 0) throw new Error("Dwell time cannot be negative");
    station.dwellSec = dwellSec;
  }

  setTolerance(index: number, pct: number): void {
    const station = this._config.stations[index];
    if (!station || station.kind !== "tank") {
      throw new Error(`No tank at index ${index}`);
    }
    station.tolerancePct = Math.max(0, Math.min(0.5, pct));
  }

  setWdoDryTime(drySec: number): void {
    const wdo = this._config.stations.find((s) => s.kind === "wdo");
    if (!wdo) throw new Error("No WDO station in config");
    wdo.dwellSec = drySec;
  }

  enableWdo(): void {
    if (this._config.stations.some((s) => s.kind === "wdo")) return;
    const unloadIdx = this._config.stations.findIndex((s) => s.kind === "unloading");
    this._config.stations.splice(unloadIdx, 0, {
      id: "WDO",
      label: "WDO",
      kind: "wdo",
      dwellSec: 600,
      maxDwellSec: 900,
    });
  }

  disableWdo(): void {
    const wdoIdx = this._config.stations.findIndex((s) => s.kind === "wdo");
    if (wdoIdx === -1) return;
    this._config.stations.splice(wdoIdx, 1);
  }

  setLoadStationTime(dwellSec: number): void {
    const load = this._config.stations.find((s) => s.kind === "loading");
    if (!load) throw new Error("No loading station in config");
    if (dwellSec < 0) throw new Error("Load time cannot be negative");
    load.dwellSec = dwellSec;
  }

  setUnloadStationTime(dwellSec: number): void {
    const unload = this._config.stations.find((s) => s.kind === "unloading");
    if (!unload) throw new Error("No unloading station in config");
    if (dwellSec < 0) throw new Error("Unload time cannot be negative");
    unload.dwellSec = dwellSec;
  }

  // ─── Transport Operations ────────────────────────────────

  setWagonCount(n: number): void {
    this._config.transport.wagonCount = Math.max(1, n);
  }

  setWagonSpeed(speed: number): void {
    if (speed < 1) throw new Error("Speed must be at least 1");
    this._config.transport.wagonSpeedMPerMin = speed;
  }

  setLiftTime(sec: number): void {
    this._config.transport.liftSec = Math.max(0, sec);
  }

  setLowerTime(sec: number): void {
    this._config.transport.lowerSec = Math.max(0, sec);
  }

  setDripTime(sec: number): void {
    this._config.transport.dripSec = Math.max(0, sec);
  }

  setPickTime(sec: number): void {
    this._config.transport.pickSec = Math.max(0, sec);
  }

  setDropTime(sec: number): void {
    this._config.transport.dropSec = Math.max(0, sec);
  }

  // ─── Settings Operations ─────────────────────────────────

  setArticleMaterial(type: ArticleMaterialType): void {
    this._config.settings.articleMaterialType = type;
  }

  setTargetBph(bph: number): void {
    this._config.settings.targetBph = Math.max(0, bph);
  }

  setSimHours(hours: number): void {
    this._config.settings.simHours = Math.max(0.25, hours);
  }

  setBasketCount(n: number): void {
    this._config.settings.basketCount = Math.max(1, Math.floor(n));
  }

  // ─── Validation ──────────────────────────────────────────

  validate(): string[] {
    const errors: string[] = [];
    if (this.currentStep === STATION_STEP || this.currentStep === REVIEW_STEP) {
      const tanks = this._config.stations.filter((s) => s.kind === "tank");
      if (tanks.length < 1) errors.push("At least 1 tank is required");
      for (const t of tanks) {
        if (t.tankType !== "extra" && t.dwellSec < 0) {
          errors.push(`Tank ${t.id} has invalid dwell time`);
        }
      }
    }
    return errors;
  }

  // ─── Completion ──────────────────────────────────────────

  isComplete(): boolean {
    if (this.currentStep !== REVIEW_STEP) return false;
    return this.validate().length === 0;
  }

  // ─── Output ──────────────────────────────────────────────

  toLineConfig(): LineConfig {
    return JSON.parse(JSON.stringify(this._config));
  }

  // ─── Private ─────────────────────────────────────────────

  private _reindexTanks(): void {
    const tanks = this._config.stations.filter((s) => s.kind === "tank");
    for (let i = 0; i < tanks.length; i++) {
      tanks[i].id = `T${i + 1}`;
      tanks[i].label = `Tank ${i + 1}`;
    }
  }
}
