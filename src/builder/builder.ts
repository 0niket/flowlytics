import { minutesToSeconds } from "../utils";
import {
  createDefaultLineConfig,
  type LineConfig,
  type StationConfig,
  type TankType,
  type ArticleMaterialType,
  type WagonConfig,
} from "./LineConfig";

export class Builder {
  private _config: LineConfig;

  constructor(existing?: LineConfig) {
    this._config = existing ? JSON.parse(JSON.stringify(existing)) : createDefaultLineConfig();
    if (!this._config.transport.wagons || this._config.transport.wagons.length === 0) {
      this._syncWagonConfigs();
    }
  }

  get config(): LineConfig {
    return this._config;
  }

  // ─── Station Operations ──────────────────────────────────

  addStation(afterIndex: number, kind: "tank" | "wdo", options?: { tankType?: TankType }): void {
    if (kind === "wdo") {
      this.addWdo(afterIndex);
      return;
    }
    const tankType = options?.tankType ?? "chemical";
    const newTank: StationConfig = {
      id: "",
      label: "",
      kind: "tank",
      tankType,
      dwellSec: tankType === "extra" ? 0 : minutesToSeconds(2.5),
      tolerancePct: tankType === "extra" ? undefined : tankType === "rinse" ? 0.5 : 0.1,
    };
    const unloadIdx = this._config.stations.findIndex((s) => s.kind === "unloading");
    const insertIdx = Math.min(afterIndex, unloadIdx);
    if (insertIdx <= 0) throw new Error("Cannot add tank before LOAD");
    this._config.stations.splice(insertIdx, 0, newTank);
    this._reindexTanks();
  }

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

  setWdoDryTime(drySec: number, index?: number): void {
    let wdo: StationConfig | undefined;
    if (index !== undefined) {
      const station = this._config.stations[index];
      if (station && station.kind === "wdo") wdo = station;
    } else {
      wdo = this._config.stations.find((s) => s.kind === "wdo");
    }
    if (!wdo) throw new Error("No WDO station in config");
    wdo.dwellSec = drySec;
  }

  addWdo(afterIndex: number): void {
    const unloadIdx = this._config.stations.findIndex((s) => s.kind === "unloading");
    const insertIdx = Math.min(Math.max(1, afterIndex), unloadIdx);
    this._config.stations.splice(insertIdx, 0, {
      id: "",
      label: "WDO",
      kind: "wdo",
      dwellSec: 600,
      maxDwellSec: 900,
    });
    this._reindexWdos();
  }

  enableWdo(): void {
    const unloadIdx = this._config.stations.findIndex((s) => s.kind === "unloading");
    this.addWdo(unloadIdx);
  }

  removeWdo(index: number): void {
    const station = this._config.stations[index];
    if (!station || station.kind !== "wdo") {
      throw new Error(`No WDO at index ${index}`);
    }
    this._config.stations.splice(index, 1);
    this._reindexWdos();
  }

  disableWdo(): void {
    const wdoIdx = this._config.stations.findIndex((s) => s.kind === "wdo");
    if (wdoIdx === -1) return;
    this._config.stations.splice(wdoIdx, 1);
    this._reindexWdos();
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

  // ─── Description Operations ────────────────────────────────

  setChemicalDescription(index: number, desc: string): void {
    const station = this._config.stations[index];
    if (!station || station.kind !== "tank") {
      throw new Error(`No tank at index ${index}`);
    }
    station.chemicalDescription = desc;
  }

  setLoadingDescription(desc: string): void {
    const load = this._config.stations.find((s) => s.kind === "loading");
    if (!load) throw new Error("No loading station in config");
    load.loadingDescription = desc;
  }

  setUnloadingDescription(desc: string): void {
    const unload = this._config.stations.find((s) => s.kind === "unloading");
    if (!unload) throw new Error("No unloading station in config");
    unload.unloadingDescription = desc;
  }

  // ─── Transport Operations ────────────────────────────────

  setWagonCount(n: number): void {
    this._config.transport.wagonCount = Math.max(1, n);
    this._syncWagonConfigs();
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

  setWagonHandlingTime(wagonIndex: number, field: "liftSec" | "dripSec" | "lowerSec" | "pickSec" | "dropSec", value: number): void {
    if (!this._config.transport.wagons) return;
    const wagon = this._config.transport.wagons[wagonIndex];
    if (!wagon) return;
    wagon[field] = Math.max(0, value);
  }

  setWagonSpeedMPerMin(wagonIndex: number, value: number): void {
    if (!this._config.transport.wagons) return;
    const wagon = this._config.transport.wagons[wagonIndex];
    if (!wagon) return;
    wagon.speedMPerMin = Math.max(1, value);
  }

  // ─── Basket Capacity Operations ─────────────────────────

  setMaxWeightKg(kg: number): void {
    this._config.transport.maxWeightKg = Math.max(0, kg);
    this._deriveMaxArticles();
  }

  setArticleWeightKg(kg: number): void {
    this._config.transport.articleWeightKg = Math.max(0, kg);
    this._deriveMaxArticles();
  }

  private _deriveMaxArticles(): void {
    const { maxWeightKg, articleWeightKg } = this._config.transport;
    if (maxWeightKg != null && articleWeightKg != null && articleWeightKg > 0) {
      this._config.transport.maxArticlesPerBasket = Math.floor(maxWeightKg / articleWeightKg);
    } else {
      this._config.transport.maxArticlesPerBasket = undefined;
    }
  }

  // ─── Economics Operations ──────────────────────────────────

  setRevenuePerArticle(rs: number): void {
    this._config.economics.revenuePerArticle = Math.max(0, rs);
  }

  setArticlesPerBasket(count: number): void {
    this._config.economics.articlesPerBasket = Math.max(0, Math.floor(count));
  }

  setOperatorCostPerHr(rs: number): void {
    this._config.economics.operatorCostPerHr = Math.max(0, rs);
  }

  setEnergyCostPerHr(rs: number): void {
    this._config.economics.energyCostPerHr = Math.max(0, rs);
  }

  setMaintenanceCostPerHr(rs: number): void {
    this._config.economics.maintenanceCostPerHr = Math.max(0, rs);
  }

  setWaterEffluentCostPerHr(rs: number): void {
    this._config.economics.waterAndEffluentCostPerHr = Math.max(0, rs);
  }

  setBasketCostRs(rs: number): void {
    this._config.economics.basketCostRs = Math.max(0, rs);
  }

  setBasketLifeYears(years: number): void {
    this._config.economics.basketLifeYears = Math.max(0, years);
  }

  setOperatingHoursPerYear(hours: number): void {
    this._config.economics.operatingHoursPerYear = Math.max(0, hours);
  }

  setTankFixedCostPerHr(stationIndex: number, rs: number): void {
    const station = this._config.stations[stationIndex];
    if (!station || station.kind !== "tank") {
      throw new Error(`No tank at index ${stationIndex}`);
    }
    station.tankFixedCostPerHr = Math.max(0, rs);
  }

  setWagonCostRs(wagonIndex: number, rs: number): void {
    if (!this._config.transport.wagons) return;
    const wagon = this._config.transport.wagons[wagonIndex];
    if (!wagon) return;
    wagon.costRs = Math.max(0, rs);
  }

  setWagonLifeYears(wagonIndex: number, years: number): void {
    if (!this._config.transport.wagons) return;
    const wagon = this._config.transport.wagons[wagonIndex];
    if (!wagon) return;
    wagon.lifeYears = Math.max(0, years);
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

  // ─── Wagon Config ────────────────────────────────────────

  setWagonRange(wagonIndex: number, fromStationId: string, toStationId: string): void {
    if (!this._config.transport.wagons) return;
    const wagon = this._config.transport.wagons[wagonIndex];
    if (!wagon) return;
    wagon.fromStationId = fromStationId;
    wagon.toStationId = toStationId;
  }

  _syncWagonConfigs(): void {
    const count = this._config.transport.wagonCount;
    const processStations = this._config.stations.filter(
      (s) => s.kind === "tank" || s.kind === "wdo"
    );
    if (processStations.length === 0) {
      this._config.transport.wagons = [];
      return;
    }
    const existing = this._config.transport.wagons ?? [];
    // Distribute stations across wagons with 1-station overlap between consecutive wagons.
    const n = processStations.length;
    const wagons: WagonConfig[] = [];
    for (let i = 0; i < count; i++) {
      const startIdx = Math.min(Math.round(i * (n - 1) / count), n - 1);
      const endIdx = Math.min(Math.round((i + 1) * (n - 1) / count), n - 1);
      // Preserve existing wagon config if available, otherwise use defaults
      const prev = existing[i];
      wagons.push({
        id: `W${i + 1}`,
        fromStationId: processStations[startIdx].id,
        toStationId: processStations[endIdx].id,
        speedMPerMin: prev?.speedMPerMin ?? 18,
        liftSec: prev?.liftSec ?? 10,
        dripSec: prev?.dripSec ?? 4,
        lowerSec: prev?.lowerSec ?? 6,
        pickSec: prev?.pickSec ?? 6,
        dropSec: prev?.dropSec ?? 4,
      });
    }
    this._config.transport.wagons = wagons;
  }

  // ─── Validation ──────────────────────────────────────────

  validate(): string[] {
    const errors: string[] = [];
    if (!this._config.settings.articleMaterialType) {
      errors.push("Article material is required");
    }
    const tanks = this._config.stations.filter((s) => s.kind === "tank");
    if (tanks.length < 1) errors.push("At least 1 tank is required");
    for (const t of tanks) {
      if (t.tankType !== "extra" && t.dwellSec < 0) {
        errors.push(`Tank ${t.id} has invalid dwell time`);
      }
    }
    errors.push(...this.validateWagons());
    return errors;
  }

  validateWagons(): string[] {
    const errors: string[] = [];
    const wagons = this._config.transport.wagons;
    if (!wagons || wagons.length === 0) return errors;

    const stationIds = this._config.stations.map((s) => s.id);
    const processStations = this._config.stations.filter(
      (s) => s.kind === "tank" || s.kind === "wdo"
    );

    for (const w of wagons) {
      const fromIdx = stationIds.indexOf(w.fromStationId);
      const toIdx = stationIds.indexOf(w.toStationId);
      if (fromIdx === -1 || toIdx === -1) {
        errors.push(`${w.id}: invalid station reference`);
        continue;
      }
      if (fromIdx > toIdx) {
        errors.push(`${w.id}: From station must come before To station`);
      }
      if (w.liftSec < 0 || w.dripSec < 0 || w.lowerSec < 0 || w.pickSec < 0 || w.dropSec < 0) {
        errors.push(`${w.id}: handling times must be >= 0`);
      }
    }

    // Check overlap: consecutive wagons must share a handoff station
    // (W[n].toStationId must equal W[n+1].fromStationId)
    for (let i = 0; i < wagons.length - 1; i++) {
      const curr = wagons[i];
      const next = wagons[i + 1];
      if (curr.toStationId !== next.fromStationId) {
        errors.push(
          `${curr.id} and ${next.id} must overlap: ${curr.id} To must equal ${next.id} From`
        );
      }
    }

    // Check coverage: every process station must be covered by at least one wagon
    for (const ps of processStations) {
      const psIdx = stationIds.indexOf(ps.id);
      const covered = wagons.some((w) => {
        const fromIdx = stationIds.indexOf(w.fromStationId);
        const toIdx = stationIds.indexOf(w.toStationId);
        return fromIdx <= psIdx && psIdx <= toIdx;
      });
      if (!covered) {
        errors.push(`Station ${ps.id} is not covered by any wagon`);
      }
    }

    return errors;
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

  private _reindexWdos(): void {
    const wdos = this._config.stations.filter((s) => s.kind === "wdo");
    for (let i = 0; i < wdos.length; i++) {
      wdos[i].id = wdos.length === 1 ? "WDO" : `WDO${i + 1}`;
      wdos[i].label = wdos.length === 1 ? "WDO" : `WDO ${i + 1}`;
    }
  }
}
