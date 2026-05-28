import type { Layout, SimParams, Resources, Basket, WagonZone, StationUtil, WagonUtil, InventoryAnalysis, SimulationResult, SimEvent, Violation, SimPlan, ViolationCause } from "../types";
import { clamp, distanceMm, mPerMinToMmPerSec, minutesToSeconds } from "../utils";
import { heapPush, heapPop, heapPeek } from "./heap";

// ─── Zone computation ─────────────────────────────────────────

export function computeZones(tankCount: number, wagonCount: number): WagonZone[] {
  const w = Math.max(1, Math.floor(wagonCount));
  const n = Math.max(1, Math.floor(tankCount));
  if (w === 1) return [{ idx: 0, startTank: 1, endTank: n, homePos: `T${Math.max(1, Math.round(n / 2))}`, label: `T1..T${n}` }];
  const boundaries: number[] = [];
  for (let i = 1; i < w; i++) boundaries.push(Math.round((i * n) / w));
  const clamped: number[] = [];
  for (const b of boundaries) { const v = clamp(b, 1, n - 1); if (!clamped.length || v > clamped[clamped.length - 1]) clamped.push(v); }
  const zones: WagonZone[] = [];
  for (let i = 0; i < w; i++) {
    const start = i === 0 ? 1 : clamped[i - 1];
    const end = i === w - 1 ? n : clamped[i];
    const home = `T${clamp(Math.round((start + end) / 2), 1, n)}`;
    zones.push({ idx: i, startTank: start, endTank: end, homePos: home, label: `T${start}..T${end}` });
  }
  return zones;
}

// ─── Resource creation ────────────────────────────────────────

export function makeResources(params: SimParams): Resources {
  const zones = computeZones(params.tankCount, params.wagonCount);
  const tankIds = params.recipeSteps.filter((s) => s.kind === "tank").map((s) => s.id);
  const tanks: Resources["tanks"] = {};
  for (const id of tankIds) tanks[id] = { id, cap: 1, occupants: new Set<string>(), reserved: 0 };
  const wdo = { id: "WDO", cap: 1, occupants: new Set<string>(), reserved: 0, busyUntil: 0, queue: [] as string[], processing: null as string | null };
  const load = { id: "LOAD", cap: 1, busyUntil: 0, queue: [] as string[], processing: null as string | null, occupants: new Set<string>(), reserved: 0 };
  const unload = { id: "UNLOAD", cap: 1, busyUntil: 0, queue: [] as string[], processing: null as string | null, occupants: new Set<string>(), reserved: 0 };
  const wagons = Array.from({ length: params.wagonCount }, (_, i) => ({
    id: `W${i + 1}`, pos: zones[i]?.homePos || "LOAD", availableAt: 0, busySec: 0,
    movingSec: 0, waitingSec: 0, blockedSec: 0, handlingSec: 0,
    zone: zones[i] || { idx: 0, startTank: 1, endTank: 12, homePos: "T6", label: "T1..T12" },
    state: { kind: "idle" as const },
  }));
  return { tanks, wdo, load, unload, wagons };
}

// ─── Main simulation ──────────────────────────────────────────

export function runSimulation(layout: Layout, params: SimParams): SimulationResult {
  const mmPerSec = mPerMinToMmPerSec(params.wagonSpeedMPerMin);
  const resources = makeResources(params);
  const simEnd = Math.max(60, params.simHours * 3600);
  const interarrival = 3600 / Math.max(0.001, params.targetBph);

  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  const tankIds = params.recipeSteps.filter((s) => s.kind === "tank").map((s) => s.id);
  const tankIdxMap = new Map(tankIds.map((id, i) => [id, i]));

  function nextDest(basket: Basket): string {
    if (basket.loc === "LOAD") return tankIds[0] || "WDO";
    const idx = tankIdxMap.get(basket.loc);
    if (idx != null && idx < tankIds.length - 1) return tankIds[idx + 1];
    if (idx === tankIds.length - 1) return "WDO";
    if (basket.loc === "WDO") return "UNLOAD";
    if (basket.loc === "UNLOAD") return "DONE";
    return "DONE";
  }

  function travelSecLocal(fromId: string, toId: string): number {
    const a = nodeMap.get(fromId);
    const b = nodeMap.get(toId);
    if (!a || !b) return 0;
    return distanceMm(a, b, layout.meta?.distanceMode || "manhattan") / Math.max(1e-6, mmPerSec);
  }

  const dwellTarget = new Map(params.recipeSteps.map((s) => [s.id, s.dwellSec]));
  const dwellMin = new Map<string, number>();
  const dwellMax = new Map<string, number>();
  const stepTol = new Map<string, number>();
  for (const step of params.recipeSteps) {
    const t = Math.max(0, step.dwellSec);
    const tol = clamp(step.tolerancePct ?? 0.1, 0, 0.5);
    stepTol.set(step.id, tol);
    dwellMin.set(step.id, t * (1 - tol));
    dwellMax.set(step.id, t * (1 + tol));
  }

  const baskets: Basket[] = [];
  const basketById = new Map<string, Basket>();
  const activeBasketIds = new Set<string>();
  let nextBasketId = 1;

  const events: SimEvent[] = [];
  const waits: Record<string, number> = { dest_full: 0, wagon_busy: 0, unload_busy: 0, load_busy: 0 };
  const violations: Violation[] = [];
  let inTransitCount = 0;
  let completedCount = 0;

  type StationOccEntry = { start: number; end: number | null };
  const stationOccupancy: Record<string, { entries: StationOccEntry[]; totalOccupied: number; dwellActuals: number[]; violationCount: number }> = {};
  for (const s of params.recipeSteps) {
    stationOccupancy[s.id] = { entries: [], totalOccupied: 0, dwellActuals: [], violationCount: 0 };
  }
  stationOccupancy["WDO"] = { entries: [], totalOccupied: 0, dwellActuals: [], violationCount: 0 };

  const loadingMetrics = {
    queueWaits: [] as number[],
    maxQueueDepth: 0,
    processingTime: 0,
    idleTime: 0,
  };
  const unloadingMetrics = { queueWaits: [] as number[], maxQueueDepth: 0 };

  const basketCreatedAt = new Map<string, number>();
  const basketLoadStartAt = new Map<string, number>();

  function pushEvent(ev: SimEvent): void { events.push(ev); }

  let t = 0;
  const eventQ: SimEvent[] = [];

  function scheduleNextArrival(at: number): void {
    if (at > simEnd) return;
    heapPush(eventQ, { t: at, kind: "basket_arrival" }, (a, b) => a.t < b.t);
  }

  function createBasket(at: number): void {
    const b: Basket = {
      id: `B${nextBasketId++}`, createdAt: at, currentState: "WAITING_LOAD", stateEnteredAt: at,
      loc: "LOAD", insertedAt: null, readyAt: null, doneAt: null,
      totalWaitSec: 0, totalTravelSec: 0, totalDwellSec: 0,
    };
    baskets.push(b);
    basketById.set(b.id, b);
    activeBasketIds.add(b.id);
    resources.load.queue.push(b.id);
    basketCreatedAt.set(b.id, at);
    const depth = resources.load.queue.length;
    if (depth > loadingMetrics.maxQueueDepth) loadingMetrics.maxQueueDepth = depth;
  }

  function startLoadIfPossible(now: number): void {
    if (resources.load.queue.length === 0) return;
    if (resources.load.busyUntil > now) return;
    const basketId = resources.load.queue.shift();
    if (!basketId) return;
    const b = basketById.get(basketId);
    if (!b) return;
    const s = now;
    const end = now + minutesToSeconds(params.loadTimeMin);
    resources.load.busyUntil = end;
    b.readyAt = end;
    b.currentState = "LOADING";
    b.stateEnteredAt = now;
    const createdAt = basketCreatedAt.get(basketId) ?? now;
    loadingMetrics.queueWaits.push(now - createdAt);
    basketLoadStartAt.set(basketId, now);
    const ev: SimEvent = { t: end, kind: "load_done", basketId, start: s, end };
    pushEvent(ev);
    heapPush(eventQ, ev, (a, b) => a.t < b.t);
  }

  function startUnloadIfPossible(now: number): void {
    if (resources.unload.queue.length === 0) return;
    if (resources.unload.busyUntil > now) return;
    const basketId = resources.unload.queue.shift();
    if (!basketId) return;
    const b = basketById.get(basketId);
    if (!b) return;
    const s = now;
    const end = now + minutesToSeconds(params.unloadTimeMin);
    resources.unload.busyUntil = end;
    b.doneAt = end;
    b.currentState = "UNLOADING";
    b.stateEnteredAt = now;
    const ev: SimEvent = { t: end, kind: "unload_done", basketId, start: s, end };
    pushEvent(ev);
    heapPush(eventQ, ev, (a, b) => a.t < b.t);
  }

  function basketReadyToMove(b: Basket, now: number): boolean {
    if (b.loc === "DONE") return false;
    if (b.loc === "LOAD") return b.readyAt != null && b.readyAt <= now;
    if (b.loc === "UNLOAD") return false;
    return b.readyAt != null && b.readyAt <= now;
  }

  function destHasSpace(destId: string): boolean {
    if (destId === "WDO") return resources.wdo.occupants.size + resources.wdo.reserved < resources.wdo.cap;
    if (destId === "UNLOAD") return true;
    if (destId === "DONE") return true;
    const tank = resources.tanks[destId];
    if (!tank) return true;
    return tank.occupants.size + tank.reserved < tank.cap;
  }

  function reserveDest(destId: string): void {
    if (destId === "WDO") resources.wdo.reserved += 1;
    else if (resources.tanks[destId]) resources.tanks[destId].reserved += 1;
  }
  function unreserveDest(destId: string): void {
    if (destId === "WDO") resources.wdo.reserved = Math.max(0, resources.wdo.reserved - 1);
    else if (resources.tanks[destId]) resources.tanks[destId].reserved = Math.max(0, resources.tanks[destId].reserved - 1);
  }
  function addOccupant(destId: string, basketId: string): void {
    if (destId === "WDO") resources.wdo.occupants.add(basketId);
    else if (resources.tanks[destId]) resources.tanks[destId].occupants.add(basketId);
  }
  function removeOccupant(srcId: string, basketId: string): void {
    if (srcId === "WDO") resources.wdo.occupants.delete(basketId);
    else if (resources.tanks[srcId]) resources.tanks[srcId].occupants.delete(basketId);
  }

  const schedulingDecisions: SimulationResult["schedulingDecisions"] = [];

  function dispatch(now: number): void {
    startLoadIfPossible(now);
    startUnloadIfPossible(now);
    const ready: Basket[] = [];
    for (const id of activeBasketIds) { const b = basketById.get(id); if (b && basketReadyToMove(b, now)) ready.push(b); }
    const candidates: { basketId: string; src: string; dest: string; deadline: number; insertedAt: number | null }[] = [];
    for (const b of ready) {
      const dest = nextDest(b);
      if (dest === "DONE") continue;
      const max = dwellMax.get(b.loc);
      const deadline = b.insertedAt != null && max != null ? b.insertedAt + max : Infinity;
      candidates.push({ basketId: b.id, src: b.loc, dest, deadline, insertedAt: b.insertedAt });
    }
    candidates.sort((a, b) => a.deadline - b.deadline || a.basketId.localeCompare(b.basketId));

    const availableWagons = resources.wagons.filter((w) => w.availableAt <= now);
    for (const c of candidates) {
      if (!destHasSpace(c.dest)) { waits.dest_full += 1; continue; }
      let wagon: (typeof resources.wagons)[number] | null = null;
      let best = Infinity;
      for (const w of availableWagons) { const d = travelSecLocal(w.pos, c.src); if (d < best) { best = d; wagon = w; } }
      if (!wagon) { waits.wagon_busy += 1; continue; }
      const wi = availableWagons.indexOf(wagon);
      if (wi >= 0) availableWagons.splice(wi, 1);

      const emptyTravel = travelSecLocal(wagon.pos, c.src);
      const loadedTravel = travelSecLocal(c.src, c.dest === "DONE" ? "UNLOAD" : c.dest);
      const handling = params.pickDropSec + params.liftLowerSec;
      const drip = params.dripTimeSec || 0;
      const start = now;
      const tPickupDone = now + emptyTravel + handling;
      const tDepartSrc = tPickupDone + drip;
      const tArriveDest = tDepartSrc + loadedTravel;
      const tDropDone = tArriveDest + handling;

      reserveDest(c.dest);
      wagon.availableAt = tDropDone;
      wagon.busySec += tDropDone - start;
      wagon.state = { kind: "transfer" as const, from: c.src, to: c.dest, basketId: c.basketId, start, end: tDropDone };
      const b = basketById.get(c.basketId);
      if (b) b.readyAt = null;

      schedulingDecisions.push({
        timestamp: now,
        wagonId: wagon.id,
        selectedBasketId: c.basketId,
        urgencyScore: 0,
        rejectedCandidates: [],
        travelTimeEstimate: emptyTravel + loadedTravel,
        reason: `deadline=${c.deadline.toFixed(1)}`,
      });

      heapPush(eventQ, { t: tPickupDone, kind: "pickup" as const, wagonId: wagon.id, basketId: c.basketId, from: c.src, to: c.dest, start, end: tDropDone }, (a, b) => a.t < b.t);
      heapPush(eventQ, { t: tDropDone, kind: "drop" as const, wagonId: wagon.id, basketId: c.basketId, from: c.src, to: c.dest, start, end: tDropDone }, (a, b) => a.t < b.t);
    }
  }

  scheduleNextArrival(0);

  const snapshotEvery = 10;
  const snapshots: SimulationResult["snapshots"] = [];
  let nextSnap = 0;

  function recordSnapshot(at: number): void {
    const locCounts: Record<string, number> = {};
    locCounts.LOADQ = resources.load.queue.length + (resources.load.processing ? 1 : 0);
    locCounts.UNLOADQ = resources.unload.queue.length + (resources.unload.processing ? 1 : 0);
    for (const [id, tank] of Object.entries(resources.tanks)) locCounts[id] = tank.occupants.size;
    locCounts.WDO = resources.wdo.occupants.size;
    locCounts.IN_TRANSIT = inTransitCount;
    const wagonStates = resources.wagons.map((w) => ({ id: w.id, pos: w.pos, availableAt: w.availableAt, state: w.state }));
    snapshots.push({ t: at, locCounts, completed: completedCount, wagonStates });
  }

  function fillSnapshots(untilT: number): void {
    while (nextSnap <= untilT && nextSnap <= simEnd) { recordSnapshot(nextSnap); nextSnap += snapshotEvery; }
  }
  fillSnapshots(0);

  while (t <= simEnd) {
    const ev = heapPop(eventQ, (a, b) => a.t < b.t);
    const nextEvT = ev ? ev.t : Infinity;
    if (!Number.isFinite(nextEvT) || nextEvT > simEnd) break;
    fillSnapshots(nextEvT);
    t = nextEvT;

    const batch: SimEvent[] = [ev!];
    while (heapPeek(eventQ) && Math.abs(heapPeek(eventQ)!.t - t) < 1e-9) batch.push(heapPop(eventQ, (a, b) => a.t < b.t)!);

    for (const e of batch) {
      if (e.kind === "basket_arrival") {
        createBasket(t);
        scheduleNextArrival(t + interarrival);
        startLoadIfPossible(t);
      } else if (e.kind === "load_done") {
        const b = basketById.get(e.basketId!);
        if (b) { b.loc = "LOAD"; b.insertedAt = e.end ?? t; b.readyAt = e.end ?? t; b.currentState = "READY_FOR_PICKUP"; b.stateEnteredAt = t; }
        startLoadIfPossible(t);
      } else if (e.kind === "unload_done") {
        const b = basketById.get(e.basketId!);
        if (b) { b.loc = "DONE"; b.currentState = "DONE"; b.stateEnteredAt = t; activeBasketIds.delete(b.id); completedCount += 1; }
        startUnloadIfPossible(t);
      } else if (e.kind === "pickup") {
        pushEvent({ t, kind: "pickup", wagonId: e.wagonId, basketId: e.basketId, from: e.from, to: e.to, start: e.start, end: e.end });
        const b = basketById.get(e.basketId!);
        if (b) {
          const target = dwellTarget.get(e.from!) ?? 0;
          const max = dwellMax.get(e.from!);
          if (target > 0 && b.insertedAt != null && max != null) {
            const over = t - (b.insertedAt + max);
            const min = dwellMin.get(e.from!);
            if (over > 0.001) {
              violations.push({
                basketId: e.basketId!, tankId: e.from!, type: "over_dwell",
                elapsed: t - b.insertedAt, dwellTime: target, tolerancePct: stepTol.get(e.from!)!,
                earliestExit: b.insertedAt + (target * (1 - (stepTol.get(e.from!) ?? 0.1))),
                latestExit: b.insertedAt + max,
                timestamp: t, cause: "wagon_unavailable" as ViolationCause,
              });
              if (stationOccupancy[e.from!]) stationOccupancy[e.from!].violationCount++;
            } else if (min != null) {
              const under = (b.insertedAt + min) - t;
              if (under > 0.001) {
                violations.push({
                  basketId: e.basketId!, tankId: e.from!, type: "under_dwell",
                  elapsed: t - b.insertedAt, dwellTime: target, tolerancePct: stepTol.get(e.from!)!,
                  earliestExit: b.insertedAt + min,
                  latestExit: b.insertedAt + max,
                  timestamp: t, cause: "wagon_unavailable" as ViolationCause,
                });
                if (stationOccupancy[e.from!]) stationOccupancy[e.from!].violationCount++;
              }
            }
          }
          if (b.insertedAt != null && stationOccupancy[e.from!]) {
            const actualDwell = t - b.insertedAt;
            stationOccupancy[e.from!].dwellActuals.push(actualDwell);
          }
          if (e.from !== "LOAD") {
            removeOccupant(e.from!, e.basketId!);
            if (stationOccupancy[e.from!]) {
              const entries = stationOccupancy[e.from!].entries;
              const last = entries[entries.length - 1];
              if (last && last.end == null) last.end = t;
            }
          }
          b.loc = "IN_TRANSIT";
          b.currentState = "IN_TRANSIT";
          b.stateEnteredAt = t;
          inTransitCount += 1;
        }
        const w = resources.wagons.find((x) => x.id === e.wagonId);
        if (w) w.state = { kind: "transfer", from: e.from!, to: e.to!, basketId: e.basketId!, start: e.start!, end: e.end! };
      } else if (e.kind === "drop") {
        pushEvent({ t, kind: "drop", wagonId: e.wagonId, basketId: e.basketId, from: e.from, to: e.to, start: e.start, end: e.end });
        unreserveDest(e.to!);
        const b = basketById.get(e.basketId!);
        if (b) {
          b.loc = e.to!;
          if (inTransitCount > 0) inTransitCount -= 1;
          const offset = params.dwellClockOffsetSec == null ? (params.pickDropSec + params.liftLowerSec) : params.dwellClockOffsetSec;
          b.insertedAt = t - Math.max(0, offset);
          if (e.to === "UNLOAD") {
            resources.unload.queue.push(e.basketId!);
            const depth = resources.unload.queue.length;
            if (depth > unloadingMetrics.maxQueueDepth) unloadingMetrics.maxQueueDepth = depth;
            startUnloadIfPossible(t);
            b.readyAt = null;
            b.currentState = "WAITING_UNLOAD";
            b.stateEnteredAt = t;
          } else {
            addOccupant(e.to!, e.basketId!);
            if (stationOccupancy[e.to!]) stationOccupancy[e.to!].entries.push({ start: t, end: null });
            const reqMin = dwellMin.get(e.to!) ?? 0;
            b.readyAt = Math.max(t, (b.insertedAt ?? t) + reqMin);
            b.currentState = "IN_TANK";
            b.stateEnteredAt = t;
            heapPush(eventQ, { t: b.readyAt, kind: "dwell_done", basketId: e.basketId, at: e.to }, (a, b) => a.t < b.t);
          }
        }
        const w = resources.wagons.find((x) => x.id === e.wagonId);
        if (w) { w.pos = e.to === "DONE" ? "UNLOAD" : e.to!; w.availableAt = t; w.state = { kind: "idle" }; }
        pushEvent({ t, kind: "transfer_done", wagonId: e.wagonId, basketId: e.basketId, from: e.from, to: e.to, start: e.start, end: e.end });
      } else if (e.kind === "dwell_done") {
        pushEvent({ t, kind: "dwell_done", basketId: e.basketId, at: e.at });
        const b = basketById.get(e.basketId!);
        if (b) { b.readyAt = t; b.currentState = "READY_FOR_PICKUP"; b.stateEnteredAt = t; }
      }
    }
    dispatch(t);
  }
  fillSnapshots(simEnd);

  const completed = baskets.filter((b) => b.doneAt != null && b.doneAt <= simEnd);
  const doneTimes = completed.map((b) => b.doneAt!).sort((a, b) => a - b);
  const throughputBph = (completed.length / simEnd) * 3600;
  let throughputSteadyBph = NaN, throughputTrimmedBph = NaN, throughputStatus: SimulationResult["throughputStatus"] = "ok";
  if (doneTimes.length >= 2) {
    const span = doneTimes[doneTimes.length - 1] - doneTimes[0];
    throughputSteadyBph = ((doneTimes.length - 1) / Math.max(1e-6, span)) * 3600;
    if (doneTimes.length >= 4) {
      const trimmed = doneTimes.slice(Math.floor(doneTimes.length / 2));
      const span2 = trimmed[trimmed.length - 1] - trimmed[0];
      throughputTrimmedBph = ((trimmed.length - 1) / Math.max(1e-6, span2)) * 3600;
      const firstHalf = doneTimes.slice(0, Math.floor(doneTimes.length / 2));
      const spanF = firstHalf[firstHalf.length - 1] - firstHalf[0];
      const bphF = ((firstHalf.length - 1) / Math.max(1e-6, spanF)) * 3600;
      if (Number.isFinite(bphF) && Number.isFinite(throughputTrimmedBph) && bphF > throughputTrimmedBph * 1.15) throughputStatus = "warm_up_bias";
    }
  } else {
    throughputStatus = "insufficient_data";
  }

  const leadTimes = completed.map((b) => b.doneAt! - b.createdAt);
  const avgLeadTime = leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : NaN;

  const stationUtilList: StationUtil[] = [];
  for (const [id, data] of Object.entries(stationOccupancy)) {
    let totalOcc = 0;
    for (const e of data.entries) { totalOcc += ((e.end ?? simEnd) - e.start); }
    const util01 = totalOcc / simEnd;
    const avgDwell = data.dwellActuals.length ? data.dwellActuals.reduce((a, b) => a + b, 0) / data.dwellActuals.length : NaN;
    const targetDwell = dwellTarget.get(id) ?? NaN;
    stationUtilList.push({ id, util01, avgDwellSec: avgDwell, targetDwellSec: targetDwell, violationCount: data.violationCount, dwellCount: data.dwellActuals.length });
  }

  const avgQueueWait = loadingMetrics.queueWaits.length
    ? loadingMetrics.queueWaits.reduce((a, b) => a + b, 0) / loadingMetrics.queueWaits.length : 0;
  const loadProcessingTime = completed.length * minutesToSeconds(params.loadTimeMin);
  const loadUtil = loadProcessingTime / simEnd;

  const wagonUtilList: WagonUtil[] = resources.wagons.map((w) => ({
    id: w.id, util01: w.busySec / simEnd, zone: w.zone, busySec: w.busySec,
    idleSec: simEnd - w.busySec, movingSec: w.movingSec, waitingSec: w.waitingSec,
    blockedSec: w.blockedSec, handlingSec: w.handlingSec,
  }));

  const bottleneck = Object.entries(waits).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";

  const wipSamples: number[] = [];
  let wipSum = 0;
  let wipMax = 0;
  for (const snap of snapshots) {
    const lc = snap.locCounts || {};
    const tankWip = Object.keys(lc).filter((k) => k.startsWith("T")).reduce((a, k) => a + (lc[k] || 0), 0);
    const wip = (lc.LOADQ || 0) + (lc.UNLOADQ || 0) + (lc.IN_TRANSIT || 0) + (lc.WDO || 0) + tankWip;
    wipSamples.push(wip);
    wipSum += wip;
    if (wip > wipMax) wipMax = wip;
  }
  const avgWip = wipSamples.length ? wipSum / wipSamples.length : 0;

  const achievedBph = Number.isFinite(throughputTrimmedBph) ? throughputTrimmedBph : Number.isFinite(throughputSteadyBph) ? throughputSteadyBph : throughputBph;

  const totalDwellSec = params.recipeSteps.reduce((s, st) => s + (st.dwellSec || 0), 0);
  const totalManualSec = minutesToSeconds(params.loadTimeMin) + minutesToSeconds(params.unloadTimeMin);
  const theoreticalMaxThroughput = totalDwellSec + totalManualSec > 0 ? 3600 / (totalDwellSec + totalManualSec) : 0;

  const optimalWip = Number.isFinite(achievedBph) && Number.isFinite(avgLeadTime)
    ? (achievedBph / 3600) * avgLeadTime : NaN;
  const recommendedBph = achievedBph;
  const recommendedBuffer = Number.isFinite(optimalWip) ? Math.ceil(optimalWip) : NaN;
  const excessWip = Number.isFinite(avgWip) && Number.isFinite(optimalWip)
    ? Math.max(0, avgWip - optimalWip) : 0;

  const inventory: InventoryAnalysis = {
    avgWip, maxWip: wipMax,
    optimalWip: Number.isFinite(optimalWip) ? optimalWip : NaN,
    recommendedBuffer, excessWip, recommendedBph,
    arrivalBph: params.targetBph,
    isOverfeeding: params.targetBph > achievedBph * 1.05,
    wipSamples,
  };

  return {
    simEnd, completedCount: completed.length,
    throughputBph, throughputSteadyBph, throughputTrimmedBph, throughputStatus,
    avgLeadTimeSec: avgLeadTime, waits, bottleneck, violations,
    util: { wagons: wagonUtilList, stations: stationUtilList },
    loading: {
      avgQueueWaitSec: avgQueueWait,
      maxQueueDepth: loadingMetrics.maxQueueDepth,
      processingUtil01: loadUtil,
      totalBasketsLoaded: loadingMetrics.queueWaits.length,
    },
    unloading: { maxQueueDepth: unloadingMetrics.maxQueueDepth },
    inventory,
    baskets, events, snapshots,
    schedulingDecisions,
    failures: [],
    lineStopped: false,
    targetThroughput: params.targetBph,
    simulatedThroughput: achievedBph,
    theoreticalMaxThroughput,
  };
}

// ─── Single-basket plan ───────────────────────────────────────

export function buildSimPlan(layout: Layout, params: SimParams): SimPlan {
  const mmPerSec = mPerMinToMmPerSec(params.wagonSpeedMPerMin);
  const liftLowerSec = params.liftLowerSec;
  const pickDropSec = params.pickDropSec;
  const steps: SimPlan["steps"] = [];
  const dwellById = new Map(params.recipeSteps.map((s) => [s.id, s.dwellSec]));
  function findNode(id: string) { return layout.nodes.find((n) => n.id === id); }
  const sequenceIds = ["LOAD", ...params.recipeSteps.filter((s) => s.kind === "tank").map((s) => s.id), "WDO", "UNLOAD"];
  let t = 0;
  const violations: string[] = [];
  const buckets: SimPlan["buckets"] = { travel: 0, handling: 0, dwell: 0, manual: 0, drip: 0 };
  t += minutesToSeconds(params.loadTimeMin);
  buckets.manual += minutesToSeconds(params.loadTimeMin);
  steps.push({ type: "manual", at: "LOAD", label: "Loading (manual)", start: 0, end: t });
  for (let i = 0; i < sequenceIds.length - 1; i++) {
    const fromId = sequenceIds[i]; const toId = sequenceIds[i + 1];
    const from = findNode(fromId); const to = findNode(toId) || findNode("WDO") || null;
    if (!from || !to) continue;
    if (fromId !== "LOAD") {
      const s = t; t += pickDropSec + liftLowerSec; buckets.handling += pickDropSec + liftLowerSec;
      steps.push({ type: "handling", at: fromId, label: `Pick/Lift @ ${fromId}`, start: s, end: t });
      const drip = params.dripTimeSec || 0;
      if (drip > 0) { const sDrip = t; t += drip; buckets.drip += drip; steps.push({ type: "drip", at: fromId, label: `Drip @ ${fromId}`, start: sDrip, end: t }); }
    }
    const d = distanceMm(from, to, params.distanceMode);
    const travelSec = d / Math.max(1e-6, mmPerSec);
    const sTravel = t; t += travelSec; buckets.travel += travelSec;
    steps.push({ type: "travel", from: fromId, to: toId, label: `Travel ${fromId} -> ${toId}`, start: sTravel, end: t, distanceMm: d });
    const sDrop = t; t += pickDropSec + liftLowerSec; buckets.handling += pickDropSec + liftLowerSec;
    steps.push({ type: "handling", at: toId, label: `Drop/Lower @ ${toId}`, start: sDrop, end: t });
    if (toId === "UNLOAD") {
      const sU = t; t += minutesToSeconds(params.unloadTimeMin); buckets.manual += minutesToSeconds(params.unloadTimeMin);
      steps.push({ type: "manual", at: "UNLOAD", label: "Unloading (manual)", start: sU, end: t });
    } else if (toId === "WDO") {
      const sW = t; const wdo = minutesToSeconds(params.wdoTimeMin); t += wdo; buckets.dwell += wdo;
      steps.push({ type: "dwell", at: "WDO", label: "WDO (drying)", start: sW, end: t });
    } else {
      const dwell = dwellById.get(toId) ?? 0; const sD = t; t += dwell; buckets.dwell += dwell;
      steps.push({ type: "dwell", at: toId, label: `Dwell @ ${toId}`, start: sD, end: t });
    }
  }
  for (const s of params.recipeSteps.filter((x) => x.kind === "tank")) {
    if (s.dwellSec < 0) violations.push(`Negative dwell on ${s.id}`);
    if (s.dwellSec < 10) violations.push(`Very low dwell on ${s.id} (${s.dwellSec}s)`);
  }
  return { steps, cycleSeconds: t, violations, buckets };
}
