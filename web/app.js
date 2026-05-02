// Flowlytics — Pretreatment Transporter Simulator
// Dashboard-first UX with progressive disclosure

const DEFAULT_DXF_BASE = "../assets/cad/oda_out";
const DEFAULT_INVENTORY_JSON = "Metafold layout PM-014-001-R1.inventory.json";
const DEFAULT_LABELS_CSV = "Metafold layout PM-014-001-R1.labels.csv";
const DWG_CONVERT_ENDPOINT = "http://localhost:8800/convert"; // backend for .dwg → .dxf

// ─── Utilities ───────────────────────────────────────────────
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return "-";
  const s = Math.max(0, seconds);
  const total = Math.round(s);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}m ${String(ss).padStart(2, "0")}s`;
}

function formatPct01(x) {
  if (!Number.isFinite(x)) return "-";
  return `${Math.round(clamp(x, 0, 1) * 100)}%`;
}

function pctDelta(actual, target) {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return ((actual - target) / target) * 100;
}

function formatTimeShort(seconds) {
  if (!Number.isFinite(seconds)) return "-";
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(0)}s`;
  const mm = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${mm}m${String(ss).padStart(2, "0")}s`;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((s) => s.trim());
  const rows = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (parts[i] ?? "").trim();
    rows.push(row);
  }
  return rows;
}

function normText(s) { return String(s || "").replace(/\\P/g, " ").replace(/\s+/g, " ").trim(); }
function safeParseNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function approxTextMatch(text, target) { const t = normText(text).toUpperCase(); const q = normText(target).toUpperCase(); return t === q || t.includes(q); }

function computeBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

function fitTransform(bounds, w, h, padding = 40) {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const sx = (w - 2 * padding) / bw;
  const sy = (h - 2 * padding) / bh;
  const scale = Math.max(0.00001, Math.min(sx, sy));
  return { scale, tx: padding - bounds.minX * scale, ty: padding - bounds.minY * scale };
}

function applyTransform(p, t) { return { x: p.x * t.scale + t.tx, y: p.y * t.scale + t.ty }; }
function distanceMm(a, b, mode) { const dx = Math.abs(a.x - b.x); const dy = Math.abs(a.y - b.y); return mode === "euclidean" ? Math.hypot(dx, dy) : dx + dy; }
function escapeHtml(s) { return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function mPerMinToMmPerSec(mPerMin) { return (mPerMin * 1000) / 60; }
function minutesToSeconds(min) { return min * 60; }
function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

// ─── Layout builders ─────────────────────────────────────────
function buildSyntheticLayout(tankCount) {
  const leftX = 0, baseY = 0, tankSpacing = 1400, tankStartX = leftX + 2400;
  const nodes = [];
  nodes.push({ id: "LOAD", label: "HANGER LOADING", type: "station", x: leftX, y: baseY });
  for (let i = 0; i < tankCount; i++) nodes.push({ id: `T${i + 1}`, label: `TANK ${i + 1}`, type: "tank", x: tankStartX + i * tankSpacing, y: baseY });
  nodes.push({ id: "WDO", label: "DRY-OFF OVEN", type: "oven", x: tankStartX + tankCount * tankSpacing + 2000, y: baseY - 1400 });
  nodes.push({ id: "UNLOAD", label: "HANGER UNLOADING", type: "station", x: tankStartX + tankCount * tankSpacing + 4200, y: baseY });
  nodes.push({ id: "PCO", label: "PCO", type: "marker", x: tankStartX + tankCount * tankSpacing + 6200, y: baseY - 1400 });
  return { nodes, meta: { source: "synthetic", distanceMode: "manhattan" } };
}

function buildLayoutFromDxfLabels(labelsRows, tankCount) {
  // Extract anchor positions
  const anchors = {};
  for (const r of labelsRows) {
    const text = normText(r.text); const x = safeParseNumber(r.x); const y = safeParseNumber(r.y);
    if (x == null || y == null) continue;
    if (!anchors.LOAD && approxTextMatch(text, "HANGER LOADING")) anchors.LOAD = { x, y };
    if (!anchors.UNLOAD && approxTextMatch(text, "HANGER UNLOADING")) anchors.UNLOAD = { x, y };
    if (!anchors.WDO && approxTextMatch(text, "WDO")) anchors.WDO = { x, y };
    if (!anchors.PCO && approxTextMatch(text, "PCO")) anchors.PCO = { x, y };
    if (!anchors.PROCESS && approxTextMatch(text, "PROCESS TANK ZONE")) anchors.PROCESS = { x, y };
    if (approxTextMatch(text, "BUFFER")) anchors.BUFFER = { x, y };
  }
  if (!anchors.LOAD || !anchors.UNLOAD) return buildSyntheticLayout(tankCount);

  // Try to use real AS-tag positions from detected stations
  const detected = state.detectedStations;
  const nodes = [];
  nodes.push({ id: "LOAD", label: "HANGER LOADING", type: "station", x: anchors.LOAD.x, y: anchors.LOAD.y });

  if (detected && detected.length > 0) {
    // Use actual station positions from AS-tags — real factory coordinates
    const stationsToUse = detected.slice(0, tankCount);
    for (let i = 0; i < stationsToUse.length; i++) {
      const s = stationsToUse[i];
      nodes.push({ id: `T${i + 1}`, label: s.id, type: "tank", x: s.x, y: s.y });
    }
  } else if (anchors.PROCESS) {
    // Fallback: synthesize tank positions along LOAD→UNLOAD direction
    const dir = { x: anchors.UNLOAD.x - anchors.LOAD.x, y: anchors.UNLOAD.y - anchors.LOAD.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const unit = { x: dir.x / len, y: dir.y / len };
    const minSpacing = 1400;
    const idealSpan = 0.70 * len;
    const idealSpacing = idealSpan / Math.max(1, tankCount - 1);
    const spacing = Math.max(minSpacing, idealSpacing);
    const totalTankSpan = spacing * Math.max(1, tankCount - 1);
    const start = { x: anchors.PROCESS.x - unit.x * (totalTankSpan / 2), y: anchors.PROCESS.y - unit.y * (totalTankSpan / 2) };
    for (let i = 0; i < tankCount; i++) {
      nodes.push({ id: `T${i + 1}`, label: `TANK ${i + 1}`, type: "tank", x: start.x + unit.x * spacing * i, y: start.y + unit.y * spacing * i });
    }
  } else {
    // No PROCESS label and no AS-tags — use synthetic positioning between LOAD and UNLOAD
    const dir = { x: anchors.UNLOAD.x - anchors.LOAD.x, y: anchors.UNLOAD.y - anchors.LOAD.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const unit = { x: dir.x / len, y: dir.y / len };
    const spacing = len / (tankCount + 2);
    for (let i = 0; i < tankCount; i++) {
      const offset = spacing * (i + 1);
      nodes.push({ id: `T${i + 1}`, label: `TANK ${i + 1}`, type: "tank", x: anchors.LOAD.x + unit.x * offset, y: anchors.LOAD.y + unit.y * offset });
    }
  }

  if (anchors.BUFFER) nodes.push({ id: "BUFFER", label: "BUFFER", type: "marker", x: anchors.BUFFER.x, y: anchors.BUFFER.y });
  if (anchors.WDO) nodes.push({ id: "WDO", label: "DRY-OFF OVEN", type: "oven", x: anchors.WDO.x, y: anchors.WDO.y });
  nodes.push({ id: "UNLOAD", label: "HANGER UNLOADING", type: "station", x: anchors.UNLOAD.x, y: anchors.UNLOAD.y });
  if (anchors.PCO) nodes.push({ id: "PCO", label: "PCO", type: "marker", x: anchors.PCO.x, y: anchors.PCO.y });
  return { nodes, meta: { source: "dxf_labels", anchors, detectedStations: detected?.length || 0, distanceMode: "manhattan" } };
}

function defaultRecipe(tankCount, preset) {
  let dwellMin = 2;
  if (preset === "ms") dwellMin = 2.5;
  if (preset === "al") dwellMin = 1.5;
  const steps = [];
  steps.push({ id: "LOAD", label: "Load", dwellSec: 0, kind: "station" });
  for (let i = 0; i < tankCount; i++) steps.push({ id: `T${i + 1}`, label: `Tank ${i + 1}`, dwellSec: minutesToSeconds(dwellMin), kind: "tank" });
  steps.push({ id: "WDO", label: "Dry-Off Oven", dwellSec: minutesToSeconds(10), kind: "oven" });
  steps.push({ id: "UNLOAD", label: "Unload", dwellSec: 0, kind: "station" });
  return steps;
}

// ─── Heap (priority queue) ───────────────────────────────────
function heapPush(heap, item, less) { heap.push(item); let i = heap.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (!less(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } }
function heapPop(heap, less) { if (!heap.length) return null; const top = heap[0]; const last = heap.pop(); if (heap.length > 0) heap[0] = last; let i = 0; while (true) { const l = i * 2 + 1, r = i * 2 + 2; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } return top; }
function heapPeek(heap) { return heap.length ? heap[0] : null; }

// ─── Simulation engine ───────────────────────────────────────
function computeZones(tankCount, wagonCount) {
  const w = Math.max(1, Math.floor(wagonCount));
  const n = Math.max(1, Math.floor(tankCount));
  if (w === 1) return [{ idx: 0, startTank: 1, endTank: n, homePos: `T${Math.max(1, Math.round(n / 2))}`, label: `T1..T${n}` }];
  const boundaries = [];
  for (let i = 1; i < w; i++) boundaries.push(Math.round((i * n) / w));
  const clamped = [];
  for (const b of boundaries) { const v = clamp(b, 1, n - 1); if (!clamped.length || v > clamped[clamped.length - 1]) clamped.push(v); }
  const zones = [];
  for (let i = 0; i < w; i++) {
    const start = i === 0 ? 1 : clamped[i - 1];
    const end = i === w - 1 ? n : clamped[i];
    const home = `T${clamp(Math.round((start + end) / 2), 1, n)}`;
    zones.push({ idx: i, startTank: start, endTank: end, homePos: home, label: `T${start}..T${end}` });
  }
  return zones;
}

function makeResources(params) {
  const zones = computeZones(params.tankCount, params.wagonCount);
  const tankIds = params.recipeSteps.filter((s) => s.kind === "tank").map((s) => s.id);
  const tanks = {};
  for (const id of tankIds) tanks[id] = { id, cap: 1, occupants: new Set(), reserved: 0 };
  const wdo = { id: "WDO", cap: 1, occupants: new Set(), reserved: 0 };
  const load = { id: "LOAD", cap: 1, busyUntil: 0, queue: [], processing: null };
  const unload = { id: "UNLOAD", cap: 1, busyUntil: 0, queue: [], processing: null };
  const wagons = Array.from({ length: params.wagonCount }, (_, i) => ({
    id: `W${i + 1}`, pos: zones[i]?.homePos || "LOAD", availableAt: 0, busySec: 0,
    zone: zones[i] || null, state: { kind: "idle" },
  }));
  return { tanks, wdo, load, unload, wagons };
}

function runSimulation(layout, params) {
  const mmPerSec = mPerMinToMmPerSec(params.wagonSpeedMPerMin);
  const resources = makeResources(params);
  const simEnd = Math.max(60, params.simHours * 3600);
  const interarrival = 3600 / Math.max(0.001, params.targetBph);

  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  const tankIds = params.recipeSteps.filter((s) => s.kind === "tank").map((s) => s.id);
  const tankIdxMap = new Map(tankIds.map((id, i) => [id, i]));

  function nextDest(basket) {
    if (basket.loc === "LOAD") return tankIds[0] || "WDO";
    const idx = tankIdxMap.get(basket.loc);
    if (idx != null && idx < tankIds.length - 1) return tankIds[idx + 1];
    if (idx === tankIds.length - 1) return "WDO";
    if (basket.loc === "WDO") return "UNLOAD";
    if (basket.loc === "UNLOAD") return "DONE";
    return "DONE";
  }

  function travelSecLocal(fromId, toId) {
    const a = nodeMap.get(fromId); const b = nodeMap.get(toId);
    if (!a || !b) return 0;
    return distanceMm(a, b, layout.meta?.distanceMode || "manhattan") / Math.max(1e-6, mmPerSec);
  }

  const dwellTarget = new Map(params.recipeSteps.map((s) => [s.id, s.dwellSec]));
  const tol = clamp(params.tolerancePct ?? 0.1, 0, 0.5);
  const dwellMin = new Map();
  const dwellMax = new Map();
  for (const [id, target] of dwellTarget.entries()) {
    const t = Math.max(0, target);
    dwellMin.set(id, t * (1 - tol));
    dwellMax.set(id, t * (1 + tol));
  }

  const baskets = [];
  const basketById = new Map();
  const activeBasketIds = new Set();
  let nextBasketId = 1;

  const events = [];
  const waits = { dest_full: 0, wagon_busy: 0, unload_busy: 0, load_busy: 0 };
  const violations = [];
  let inTransitCount = 0;
  let completedCount = 0;

  // ── Enhanced tracking for per-component metrics ──
  const stationOccupancy = {}; // {stationId: {entries: [{start, end}], totalOccupied: 0, dwellActuals: [], violationCount: 0}}
  for (const s of params.recipeSteps) {
    stationOccupancy[s.id] = { entries: [], totalOccupied: 0, dwellActuals: [], violationCount: 0 };
  }
  stationOccupancy["WDO"] = { entries: [], totalOccupied: 0, dwellActuals: [], violationCount: 0 };

  const loadingMetrics = {
    queueWaits: [],       // time each basket waited in queue before loading started
    maxQueueDepth: 0,
    processingTime: 0,
    idleTime: 0,
  };
  const unloadingMetrics = { queueWaits: [], maxQueueDepth: 0 };

  // Track when each basket was created (for queue wait calc)
  const basketCreatedAt = new Map();
  const basketLoadStartAt = new Map();

  function pushEvent(ev) { events.push(ev); }

  let t = 0;
  const eventQ = [];

  function scheduleNextArrival(at) {
    if (at > simEnd) return;
    heapPush(eventQ, { t: at, kind: "basket_arrival" }, (a, b) => a.t < b.t);
  }

  function createBasket(at) {
    const b = { id: `B${nextBasketId++}`, createdAt: at, loc: "LOAD", insertedAt: null, readyAt: null, doneAt: null };
    baskets.push(b);
    basketById.set(b.id, b);
    activeBasketIds.add(b.id);
    resources.load.queue.push(b.id);
    basketCreatedAt.set(b.id, at);
    // Track queue depth
    const depth = resources.load.queue.length;
    if (depth > loadingMetrics.maxQueueDepth) loadingMetrics.maxQueueDepth = depth;
  }

  function startLoadIfPossible(now) {
    if (resources.load.queue.length === 0) return;
    if (resources.load.busyUntil > now) return;
    const basketId = resources.load.queue.shift();
    const b = basketById.get(basketId);
    if (!b) return;
    const s = now;
    const end = now + minutesToSeconds(params.loadTimeMin);
    resources.load.busyUntil = end;
    b.readyAt = end;
    // Track queue wait
    const createdAt = basketCreatedAt.get(basketId) ?? now;
    loadingMetrics.queueWaits.push(now - createdAt);
    basketLoadStartAt.set(basketId, now);
    const ev = { t: end, kind: "load_done", basketId, start: s, end };
    pushEvent(ev);
    heapPush(eventQ, ev, (a, b) => a.t < b.t);
  }

  function startUnloadIfPossible(now) {
    if (resources.unload.queue.length === 0) return;
    if (resources.unload.busyUntil > now) return;
    const basketId = resources.unload.queue.shift();
    const b = basketById.get(basketId);
    if (!b) return;
    const s = now;
    const end = now + minutesToSeconds(params.unloadTimeMin);
    resources.unload.busyUntil = end;
    b.doneAt = end;
    const ev = { t: end, kind: "unload_done", basketId, start: s, end };
    pushEvent(ev);
    heapPush(eventQ, ev, (a, b) => a.t < b.t);
  }

  function basketReadyToMove(b, now) {
    if (b.loc === "DONE") return false;
    if (b.loc === "LOAD") return b.readyAt != null && b.readyAt <= now;
    if (b.loc === "UNLOAD") return false;
    return b.readyAt != null && b.readyAt <= now;
  }

  function destHasSpace(destId) {
    if (destId === "WDO") return resources.wdo.occupants.size + resources.wdo.reserved < resources.wdo.cap;
    if (destId === "UNLOAD") return true;
    if (destId === "DONE") return true;
    const tank = resources.tanks[destId];
    if (!tank) return true;
    return tank.occupants.size + tank.reserved < tank.cap;
  }

  function reserveDest(destId) {
    if (destId === "WDO") resources.wdo.reserved += 1;
    else if (resources.tanks[destId]) resources.tanks[destId].reserved += 1;
  }
  function unreserveDest(destId) {
    if (destId === "WDO") resources.wdo.reserved = Math.max(0, resources.wdo.reserved - 1);
    else if (resources.tanks[destId]) resources.tanks[destId].reserved = Math.max(0, resources.tanks[destId].reserved - 1);
  }
  function addOccupant(destId, basketId) {
    if (destId === "WDO") resources.wdo.occupants.add(basketId);
    else if (resources.tanks[destId]) resources.tanks[destId].occupants.add(basketId);
  }
  function removeOccupant(srcId, basketId) {
    if (srcId === "WDO") resources.wdo.occupants.delete(basketId);
    else if (resources.tanks[srcId]) resources.tanks[srcId].occupants.delete(basketId);
  }

  function dispatch(now) {
    startLoadIfPossible(now);
    startUnloadIfPossible(now);
    const ready = [];
    for (const id of activeBasketIds) { const b = basketById.get(id); if (b && basketReadyToMove(b, now)) ready.push(b); }
    const candidates = [];
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
      let wagon = null; let best = Infinity;
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
      wagon.state = { kind: "transfer", from: c.src, to: c.dest, basketId: c.basketId, start, end: tDropDone };
      const b = basketById.get(c.basketId);
      if (b) b.readyAt = null;

      heapPush(eventQ, { t: tPickupDone, kind: "pickup", wagonId: wagon.id, basketId: c.basketId, from: c.src, to: c.dest, start, end: tDropDone }, (a, b) => a.t < b.t);
      heapPush(eventQ, { t: tDropDone, kind: "drop", wagonId: wagon.id, basketId: c.basketId, from: c.src, to: c.dest, start, end: tDropDone, arriveDestAt: tArriveDest }, (a, b) => a.t < b.t);
    }
  }

  scheduleNextArrival(0);

  const snapshotEvery = 10;
  const snapshots = [];
  let nextSnap = 0;

  function recordSnapshot(at) {
    const locCounts = {};
    locCounts.LOADQ = resources.load.queue.length + (resources.load.processing ? 1 : 0);
    locCounts.UNLOADQ = resources.unload.queue.length + (resources.unload.processing ? 1 : 0);
    for (const [id, tank] of Object.entries(resources.tanks)) locCounts[id] = tank.occupants.size;
    locCounts.WDO = resources.wdo.occupants.size;
    locCounts.IN_TRANSIT = inTransitCount;
    const wagonStates = resources.wagons.map((w) => ({ id: w.id, pos: w.pos, availableAt: w.availableAt, state: w.state }));
    snapshots.push({ t: at, locCounts, completed: completedCount, wagonStates });
  }

  function fillSnapshots(untilT) {
    while (nextSnap <= untilT && nextSnap <= simEnd) { recordSnapshot(nextSnap); nextSnap += snapshotEvery; }
  }
  fillSnapshots(0);

  while (t <= simEnd) {
    const ev = heapPop(eventQ, (a, b) => a.t < b.t);
    const nextEvT = ev ? ev.t : Infinity;
    if (!Number.isFinite(nextEvT) || nextEvT > simEnd) break;
    fillSnapshots(nextEvT);
    t = nextEvT;

    const batch = [ev];
    while (heapPeek(eventQ) && Math.abs(heapPeek(eventQ).t - t) < 1e-9) batch.push(heapPop(eventQ, (a, b) => a.t < b.t));

    for (const e of batch) {
      if (e.kind === "basket_arrival") {
        createBasket(t);
        scheduleNextArrival(t + interarrival);
        startLoadIfPossible(t);
      } else if (e.kind === "load_done") {
        const b = basketById.get(e.basketId);
        if (b) { b.loc = "LOAD"; b.insertedAt = e.end; b.readyAt = e.end; }
        startLoadIfPossible(t);
      } else if (e.kind === "unload_done") {
        const b = basketById.get(e.basketId);
        if (b) { b.loc = "DONE"; activeBasketIds.delete(b.id); completedCount += 1; }
        startUnloadIfPossible(t);
      } else if (e.kind === "pickup") {
        pushEvent({ t, kind: "pickup", wagonId: e.wagonId, basketId: e.basketId, from: e.from, to: e.to, start: e.start, end: e.end });
        const b = basketById.get(e.basketId);
        if (b) {
          const target = dwellTarget.get(e.from) ?? 0;
          const max = dwellMax.get(e.from);
          // Only check over-dwell for stations with non-zero target dwell (skip LOAD/UNLOAD)
          if (target > 0 && b.insertedAt != null && max != null) {
            const over = t - (b.insertedAt + max);
            if (over > 0.001) {
              violations.push({ basketId: e.basketId, step: e.from, kind: "over_dwell", seconds: over });
              if (stationOccupancy[e.from]) stationOccupancy[e.from].violationCount++;
            }
          }
          // Track actual dwell
          if (b.insertedAt != null && stationOccupancy[e.from]) {
            const actualDwell = t - b.insertedAt;
            stationOccupancy[e.from].dwellActuals.push(actualDwell);
          }
          if (e.from !== "LOAD") {
            removeOccupant(e.from, e.basketId);
            // Track occupancy end
            if (stationOccupancy[e.from]) {
              const entries = stationOccupancy[e.from].entries;
              const last = entries[entries.length - 1];
              if (last && last.end == null) last.end = t;
            }
          }
          b.loc = "IN_TRANSIT";
          inTransitCount += 1;
        }
        const w = resources.wagons.find((x) => x.id === e.wagonId);
        if (w) w.state = { kind: "transfer", from: e.from, to: e.to, basketId: e.basketId, start: e.start, end: e.end };
      } else if (e.kind === "drop") {
        pushEvent({ t, kind: "drop", wagonId: e.wagonId, basketId: e.basketId, from: e.from, to: e.to, start: e.start, end: e.end });
        unreserveDest(e.to);
        const b = basketById.get(e.basketId);
        if (b) {
          b.loc = e.to;
          if (inTransitCount > 0) inTransitCount -= 1;
          const offset = params.dwellClockOffsetSec == null ? (params.pickDropSec + params.liftLowerSec) : params.dwellClockOffsetSec;
          b.insertedAt = t - Math.max(0, offset);
          if (e.to === "UNLOAD") {
            resources.unload.queue.push(e.basketId);
            const depth = resources.unload.queue.length;
            if (depth > unloadingMetrics.maxQueueDepth) unloadingMetrics.maxQueueDepth = depth;
            startUnloadIfPossible(t);
            b.readyAt = null;
          } else {
            addOccupant(e.to, e.basketId);
            // Track occupancy start
            if (stationOccupancy[e.to]) stationOccupancy[e.to].entries.push({ start: t, end: null });
            const reqMin = dwellMin.get(e.to) ?? 0;
            b.readyAt = Math.max(t, (b.insertedAt ?? t) + reqMin);
            heapPush(eventQ, { t: b.readyAt, kind: "dwell_done", basketId: e.basketId, at: e.to }, (a, b) => a.t < b.t);
          }
        }
        const w = resources.wagons.find((x) => x.id === e.wagonId);
        if (w) { w.pos = e.to === "DONE" ? "UNLOAD" : e.to; w.availableAt = t; w.state = { kind: "idle" }; }
        pushEvent({ t, kind: "transfer_done", wagonId: e.wagonId, basketId: e.basketId, from: e.from, to: e.to, start: e.start, end: e.end });
      } else if (e.kind === "dwell_done") {
        pushEvent({ t, kind: "dwell_done", basketId: e.basketId, at: e.at });
        const b = basketById.get(e.basketId);
        if (b) b.readyAt = t;
      }
    }
    dispatch(t);
  }
  fillSnapshots(simEnd);

  // ── Compute final metrics ──
  const completed = baskets.filter((b) => b.doneAt != null && b.doneAt <= simEnd);
  const doneTimes = completed.map((b) => b.doneAt).sort((a, b) => a - b);
  let throughputBph = (completed.length / simEnd) * 3600;
  let throughputSteadyBph = NaN, throughputTrimmedBph = NaN, throughputStatus = "ok";
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

  const leadTimes = completed.map((b) => b.doneAt - b.createdAt);
  const avgLeadTime = leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : NaN;

  // Per-station utilization
  const stationUtil = [];
  for (const [id, data] of Object.entries(stationOccupancy)) {
    let totalOcc = 0;
    for (const e of data.entries) { totalOcc += ((e.end ?? simEnd) - e.start); }
    const util01 = totalOcc / simEnd;
    const avgDwell = data.dwellActuals.length ? data.dwellActuals.reduce((a, b) => a + b, 0) / data.dwellActuals.length : NaN;
    const targetDwell = dwellTarget.get(id) ?? NaN;
    stationUtil.push({ id, util01, avgDwellSec: avgDwell, targetDwellSec: targetDwell, violationCount: data.violationCount, dwellCount: data.dwellActuals.length });
  }

  // Loading analysis
  const avgQueueWait = loadingMetrics.queueWaits.length
    ? loadingMetrics.queueWaits.reduce((a, b) => a + b, 0) / loadingMetrics.queueWaits.length : 0;
  const loadProcessingTime = completed.length * minutesToSeconds(params.loadTimeMin);
  const loadUtil = loadProcessingTime / simEnd;

  const util = {
    wagons: resources.wagons.map((w) => ({ id: w.id, util01: w.busySec / simEnd, zone: w.zone, busySec: w.busySec, idleSec: simEnd - w.busySec })),
    stations: stationUtil,
  };

  const bottleneck = Object.entries(waits).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";

  // ── DBR / Inventory analysis ──
  // WIP over time from snapshots
  const wipSamples = [];
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

  // Bottleneck capacity (actual achieved rate)
  const achievedBph = Number.isFinite(throughputTrimmedBph) ? throughputTrimmedBph : Number.isFinite(throughputSteadyBph) ? throughputSteadyBph : throughputBph;

  // Theoretical single-basket cycle time (no contention)
  const totalDwellSec = params.recipeSteps.reduce((s, st) => s + (st.dwellSec || 0), 0);
  const totalManualSec = minutesToSeconds(params.loadTimeMin) + minutesToSeconds(params.unloadTimeMin);
  const theoreticalCycleSec = totalDwellSec + totalManualSec; // simplified

  // Optimal WIP (Little's Law): WIP = Throughput * Lead Time
  // Using achieved throughput and avg lead time
  const optimalWip = Number.isFinite(achievedBph) && Number.isFinite(avgLeadTime)
    ? (achievedBph / 3600) * avgLeadTime : NaN;

  // Recommended release rate: match the bottleneck, don't overshoot
  const recommendedBph = achievedBph; // don't push faster than the system can process

  // Buffer recommendation: enough WIP to keep bottleneck fed for ~1 cycle
  const bottleneckCycleMin = achievedBph > 0 ? 60 / achievedBph : NaN; // minutes per basket at bottleneck rate
  const recommendedBuffer = Number.isFinite(optimalWip) ? Math.ceil(optimalWip) : NaN;

  // Excess WIP: how much inventory is waste
  const excessWip = Number.isFinite(avgWip) && Number.isFinite(optimalWip)
    ? Math.max(0, avgWip - optimalWip) : 0;

  const inventory = {
    avgWip,
    maxWip: wipMax,
    optimalWip: Number.isFinite(optimalWip) ? optimalWip : NaN,
    recommendedBuffer,
    excessWip,
    recommendedBph,
    arrivalBph: params.targetBph,
    isOverfeeding: params.targetBph > achievedBph * 1.05,
    wipSamples,
  };

  return {
    simEnd, completedCount: completed.length,
    throughputBph, throughputSteadyBph, throughputTrimmedBph, throughputStatus,
    avgLeadTimeSec: avgLeadTime, waits, bottleneck, violations, util,
    loading: {
      avgQueueWaitSec: avgQueueWait,
      maxQueueDepth: loadingMetrics.maxQueueDepth,
      processingUtil01: loadUtil,
      totalBasketsLoaded: loadingMetrics.queueWaits.length,
    },
    unloading: { maxQueueDepth: unloadingMetrics.maxQueueDepth },
    inventory,
    baskets, events, snapshots,
  };
}

// ─── Single-basket plan (for breakdown) ──────────────────────
function buildSimPlan(layout, params) {
  const mmPerSec = mPerMinToMmPerSec(params.wagonSpeedMPerMin);
  const liftLowerSec = params.liftLowerSec;
  const pickDropSec = params.pickDropSec;
  const steps = [];
  const dwellById = new Map(params.recipeSteps.map((s) => [s.id, s.dwellSec]));
  function findNode(id) { return layout.nodes.find((n) => n.id === id); }
  const sequenceIds = ["LOAD", ...params.recipeSteps.filter((s) => s.kind === "tank").map((s) => s.id), "WDO", "UNLOAD"];
  let t = 0;
  let violations = [];
  const buckets = { travel: 0, handling: 0, dwell: 0, manual: 0, drip: 0 };
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

function stepAtTime(plan, timeSec) {
  if (!plan) return null;
  const t = clamp(timeSec, 0, plan.cycleSeconds || 0);
  for (let i = 0; i < plan.steps.length; i++) {
    const s = plan.steps[i]; const isLast = i === plan.steps.length - 1;
    if (isLast) { if (t >= s.start && t <= s.end) return s; }
    else { if (t >= s.start && t < s.end) return s; }
  }
  return null;
}

// ─── Canvas rendering ────────────────────────────────────────
function drawScene(ctx, view, layout, plan, anim, snap) {
  const width = view.viewport.w || ctx.canvas.width;
  const height = view.viewport.h || ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);

  // Grid
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const step = 50;
  ctx.beginPath();
  for (let x = 0; x <= width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = 0; y <= height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  ctx.restore();

  const nodes = layout.nodes.map((n) => ({ ...n, p: applyTransform(n, view.transform) }));
  const pathIds = ["LOAD", ...nodes.filter((n) => n.type === "tank").map((n) => n.id), "WDO", "UNLOAD"];
  const pathPoints = [];
  for (const id of pathIds) { const n = nodes.find((x) => x.id === id); if (n) pathPoints.push(n.p); }

  const nowStep = plan ? stepAtTime(plan, clamp(anim.timeSec, 0, plan?.cycleSeconds ?? 0)) : null;
  const hotNodeId = nowStep?.type === "travel" ? null : nowStep?.at || null;
  const hotTravel = nowStep?.type === "travel" ? nowStep : null;

  if (pathPoints.length >= 2) {
    ctx.save(); ctx.strokeStyle = "rgba(74,163,255,0.20)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (const p of pathPoints.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke(); ctx.restore();
  }

  if (hotTravel) {
    const from = nodes.find((n) => n.id === hotTravel.from);
    const to = nodes.find((n) => n.id === hotTravel.to) || nodes.find((n) => n.id === "WDO");
    if (from && to) {
      ctx.save(); ctx.strokeStyle = "rgba(255,191,105,0.55)"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(from.p.x, from.p.y); ctx.lineTo(to.p.x, to.p.y); ctx.stroke(); ctx.restore();
    }
  }

  const violationSteps = new Set();
  if (state.sim?.violations?.length) { for (const v of state.sim.violations) if (v.kind === "over_dwell" && v.step) violationSteps.add(v.step); }

  for (const n of nodes) {
    const isTank = n.type === "tank";
    ctx.save();
    const isStation = n.id === "LOAD" || n.id === "UNLOAD";
    const isWdo = n.id === "WDO";
    let fill = isTank ? "rgba(112,240,184,0.14)" : "rgba(255,255,255,0.08)";
    let stroke = isTank ? "rgba(112,240,184,0.55)" : "rgba(255,255,255,0.22)";
    if (isStation) { fill = "rgba(255,191,105,0.12)"; stroke = "rgba(255,191,105,0.70)"; }
    if (isWdo) { fill = "rgba(74,163,255,0.12)"; stroke = "rgba(74,163,255,0.70)"; }
    if (hotNodeId && n.id === hotNodeId) { fill = "rgba(255,191,105,0.22)"; stroke = "rgba(255,191,105,0.85)"; }
    const isViolation = violationSteps.has(n.id);
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = hotNodeId && n.id === hotNodeId ? 3 : 2;
    if (isViolation) { ctx.strokeStyle = "rgba(255,107,107,0.85)"; ctx.setLineDash([8, 6]); ctx.lineWidth = 3; }
    if (isTank) {
      const w = 54, h = 26;
      ctx.roundRect(n.p.x - w / 2, n.p.y - h / 2, w, h, 6); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    } else {
      const r = isStation ? 16 : 14;
      ctx.beginPath(); ctx.arc(n.p.x, n.p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();

    if (view.showLabels) {
      ctx.save(); ctx.fillStyle = "rgba(217,226,241,0.85)"; ctx.font = "11px ui-monospace, Menlo, Monaco, Consolas, monospace";
      ctx.textBaseline = "top";
      const dx = isTank ? -26 : 18; const dy = isTank ? 18 : -8;
      ctx.fillText(isTank ? n.id : n.label, n.p.x + dx, n.p.y + dy); ctx.restore();
    }

    if (snap && snap.locCounts) {
      let count = 0;
      if (n.id === "LOAD") count = snap.locCounts.LOADQ || 0;
      else if (n.id === "UNLOAD") count = snap.locCounts.UNLOADQ || 0;
      else count = snap.locCounts[n.id] || 0;
      if (count > 0) {
        ctx.save(); const bx = n.p.x + 20; const by = n.p.y - 24;
        ctx.fillStyle = "rgba(10,14,22,0.88)"; ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, 26, 18, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(217,226,241,0.92)"; ctx.font = "11px ui-monospace, Menlo, Monaco, Consolas, monospace";
        ctx.textBaseline = "top"; ctx.fillText(String(count), bx + 8, by + 2); ctx.restore();
      }
    }
  }

  // Basket marker (baseline single basket, only when no DES snapshot)
  if (plan && !snap) {
    const tSim = clamp(anim.timeSec, 0, plan.cycleSeconds || 0);
    const travelSteps = plan.steps.filter((s) => s.type === "travel");
    let basketPos = null;
    for (const ts of travelSteps) {
      if (tSim >= ts.start && tSim <= ts.end) {
        const from = nodes.find((n) => n.id === ts.from);
        const to = nodes.find((n) => n.id === ts.to) || nodes.find((n) => n.id === "WDO");
        if (from && to) { const tt = (tSim - ts.start) / Math.max(1e-6, ts.end - ts.start); basketPos = { x: lerp(from.p.x, to.p.x, tt), y: lerp(from.p.y, to.p.y, tt) }; }
        break;
      }
    }
    if (!basketPos) {
      const s = stepAtTime(plan, tSim);
      let at = s?.at || null;
      if (!at) { let lastAt = "LOAD"; for (const st of plan.steps) if (tSim >= st.end && st.at) lastAt = st.at; at = lastAt; }
      const n = nodes.find((x) => x.id === at) || nodes.find((x) => x.id === "LOAD");
      basketPos = n ? { x: n.p.x, y: n.p.y } : { x: 40, y: 40 };
    }
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(basketPos.x - 10, basketPos.y - 10, 20, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(217,226,241,0.88)"; ctx.font = "11px ui-monospace, Menlo, Monaco, Consolas, monospace";
    ctx.textBaseline = "top"; ctx.fillText("BASKET", basketPos.x + 14, basketPos.y - 10); ctx.restore();
  }
}

// Polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
    this.beginPath(); this.moveTo(x + rr.tl, y); this.lineTo(x + w - rr.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + rr.tr); this.lineTo(x + w, y + h - rr.br);
    this.quadraticCurveTo(x + w, y + h, x + w - rr.br, y + h); this.lineTo(x + rr.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - rr.bl); this.lineTo(x, y + rr.tl);
    this.quadraticCurveTo(x, y, x + rr.tl, y); this.closePath(); return this;
  };
}

// ─── SVG chart helpers ───────────────────────────────────────
function svgClear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
function svgEl(name) { return document.createElementNS("http://www.w3.org/2000/svg", name); }
function updatePlayhead(svg, xNow) { const ph = svg.querySelector(".playhead-marker"); if (!ph) return false; ph.setAttribute("x1", xNow); ph.setAttribute("x2", xNow); return true; }

function renderLineChart(svg, series, opts) {
  const width = Number(svg.getAttribute("width")) || 600;
  const height = Number(svg.getAttribute("height")) || 130;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgClear(svg);
  const pad = 14; const w = width - pad * 2; const h = height - pad * 2;
  const xs = series.map((p) => p.x); const ys = series.map((p) => p.y);
  const xMin = Math.min(...xs); const xMax = Math.max(...xs);
  const yMin = 0; const yMax = Math.max(1e-6, Math.max(...ys, opts?.yMax ?? 0));
  const xFor = (x) => pad + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * w;
  const yFor = (y) => pad + (1 - (y - yMin) / Math.max(1e-6, yMax - yMin)) * h;

  for (let i = 0; i <= 4; i++) {
    const y = pad + (h * i) / 4; const line = svgEl("line");
    line.setAttribute("x1", pad); line.setAttribute("x2", pad + w); line.setAttribute("y1", y); line.setAttribute("y2", y);
    line.setAttribute("stroke", "rgba(255,255,255,0.06)"); line.setAttribute("stroke-width", "1"); svg.appendChild(line);
  }

  const tickInterval = 900;
  for (let tt = Math.ceil(xMin / tickInterval) * tickInterval; tt <= xMax; tt += tickInterval) {
    const x = xFor(tt); const lbl = svgEl("text");
    lbl.setAttribute("x", x); lbl.setAttribute("y", height - 2); lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("fill", "rgba(146,162,187,0.6)"); lbl.setAttribute("font-size", "9");
    lbl.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace");
    lbl.textContent = `${Math.floor(tt / 60)}m`; svg.appendChild(lbl);
  }

  let d = "";
  for (let i = 0; i < series.length; i++) { const p = series[i]; const x = xFor(p.x); const y = yFor(p.y); d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`; }
  if (opts?.fill) {
    const area = svgEl("path"); area.setAttribute("d", `${d} L ${xFor(xMax)} ${yFor(0)} L ${xFor(xMin)} ${yFor(0)} Z`);
    area.setAttribute("fill", opts.fill); area.setAttribute("stroke", "none"); svg.appendChild(area);
  }
  const path = svgEl("path"); path.setAttribute("d", d); path.setAttribute("fill", "none");
  path.setAttribute("stroke", opts?.stroke ?? "rgba(74,163,255,0.75)"); path.setAttribute("stroke-width", "1.5"); svg.appendChild(path);

  const yTop = svgEl("text"); yTop.setAttribute("x", pad); yTop.setAttribute("y", 10);
  yTop.setAttribute("fill", "rgba(146,162,187,0.8)"); yTop.setAttribute("font-size", "9");
  yTop.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace");
  yTop.textContent = `${Math.round(yMax)}${opts?.unit ? " " + opts.unit : ""}`; svg.appendChild(yTop);

  return { pad, width, height, xMin, xMax, xFor, yFor, yMax, h };
}

function renderGantt(svg) {
  const width = Number(svg.getAttribute("width")) || 600;
  const height = Number(svg.getAttribute("height")) || 200;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgClear(svg);
  if (!state.sim) return;
  const pad = 14; const w = width - pad * 2; const rowH = 16; const rowsMax = 12;
  const ordered = [...state.sim.baskets].sort((a, b) => a.createdAt - b.createdAt);
  const shown = ordered.slice(0, rowsMax);
  const ids = new Set(shown.map((b) => b.id));
  const evs = state.sim.events.filter((e) => e.basketId && ids.has(e.basketId)).sort((a, b) => a.t - b.t);
  const segsByBasket = new Map();
  for (const b of shown) segsByBasket.set(b.id, []);
  for (const e of evs) {
    if (e.kind === "load_done") segsByBasket.get(e.basketId)?.push({ kind: "load", at: "LOAD", start: e.start, end: e.end });
    if (e.kind === "unload_done") segsByBasket.get(e.basketId)?.push({ kind: "unload", at: "UNLOAD", start: e.start, end: e.end });
    if (e.kind === "transfer_done") segsByBasket.get(e.basketId)?.push({ kind: "transfer", at: `${e.from}->${e.to}`, start: e.start, end: e.end });
  }
  const lastDrop = new Map();
  for (const e of evs) {
    if (e.kind === "drop") lastDrop.set(e.basketId, { at: e.to, t: e.t });
    if (e.kind === "pickup") {
      const d = lastDrop.get(e.basketId);
      if (d && d.at === e.from && d.t < e.t && d.at !== "UNLOAD") segsByBasket.get(e.basketId)?.push({ kind: "dwell", at: d.at, start: d.t, end: e.t });
    }
  }
  const tMax = Math.max(1, state.sim.simEnd);
  const xFor = (t) => pad + (t / tMax) * w;

  // X-axis time labels at bottom
  const axisY = height - 4;
  const axisLineY = height - 14;
  // Axis line
  const axisLine = svgEl("line"); axisLine.setAttribute("x1", pad); axisLine.setAttribute("x2", pad + w);
  axisLine.setAttribute("y1", axisLineY); axisLine.setAttribute("y2", axisLineY);
  axisLine.setAttribute("stroke", "rgba(255,255,255,0.1)"); axisLine.setAttribute("stroke-width", "1"); svg.appendChild(axisLine);
  // Time ticks
  // Scale tick intervals to prevent label overlap (~55px min per tick)
  const maxTicks = Math.max(2, Math.floor(w / 55));
  const candidateIntervals = [300, 600, 900, 1800, 3600, 7200];
  const tickIntervalSec = candidateIntervals.find((iv) => tMax / iv <= maxTicks) || 7200;
  for (let tt = 0; tt <= tMax; tt += tickIntervalSec) {
    const x = xFor(tt);
    const tick = svgEl("line"); tick.setAttribute("x1", x); tick.setAttribute("x2", x);
    tick.setAttribute("y1", axisLineY); tick.setAttribute("y2", axisLineY + 4);
    tick.setAttribute("stroke", "rgba(146,162,187,0.4)"); svg.appendChild(tick);
    const lbl = svgEl("text"); lbl.setAttribute("x", x); lbl.setAttribute("y", axisY);
    lbl.setAttribute("text-anchor", "middle"); lbl.setAttribute("fill", "rgba(146,162,187,0.6)");
    lbl.setAttribute("font-size", "9"); lbl.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace");
    const mins = Math.round(tt / 60);
    lbl.textContent = mins >= 60 ? Math.floor(mins / 60) + "h" + (mins % 60 > 0 ? String(mins % 60).padStart(2, "0") + "m" : "") : mins + "m";
    svg.appendChild(lbl);
  }

  function color(seg) {
    if (seg.kind === "transfer") return "rgba(146,162,187,0.22)";
    if (seg.kind === "load" || seg.kind === "unload") return "rgba(255,191,105,0.22)";
    if (seg.at === "WDO") return "rgba(74,163,255,0.20)";
    return "rgba(112,240,184,0.18)";
  }
  let y = pad;
  for (const b of shown) {
    const segs = (segsByBasket.get(b.id) || []).filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start).sort((a, b) => a.start - b.start);
    const label = svgEl("text"); label.setAttribute("x", 3); label.setAttribute("y", y + rowH - 4);
    label.setAttribute("fill", "rgba(146,162,187,0.85)"); label.setAttribute("font-size", "9");
    label.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace"); label.textContent = b.id; svg.appendChild(label);
    for (const s of segs) {
      const x1 = xFor(s.start); const x2 = xFor(s.end);
      const rect = svgEl("rect"); rect.setAttribute("x", x1); rect.setAttribute("y", y);
      rect.setAttribute("width", Math.max(1, x2 - x1)); rect.setAttribute("height", rowH - 3);
      rect.setAttribute("rx", "2"); rect.setAttribute("fill", color(s)); rect.setAttribute("stroke", "rgba(255,255,255,0.06)");
      const title = svgEl("title"); title.textContent = `${s.kind}: ${s.at} (${(s.end - s.start).toFixed(0)}s)`;
      rect.appendChild(title); svg.appendChild(rect);
    }
    y += rowH;
  }
  const xNow = xFor(clamp(state.anim.timeSec, 0, tMax));
  const line = svgEl("line"); line.setAttribute("x1", xNow); line.setAttribute("x2", xNow);
  line.setAttribute("y1", 4); line.setAttribute("y2", height - 4);
  line.setAttribute("stroke", "rgba(255,191,105,0.45)"); line.setAttribute("stroke-width", "1.5");
  line.setAttribute("class", "playhead-marker"); svg.appendChild(line);
}

// ─── DOM helpers ─────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function elRequired(id) { const e = document.getElementById(id); if (!e) throw new Error(`Missing element: ${id}`); return e; }

const ui = {
  layoutMode: el("layoutMode"), fetchDxfBtn: el("fetchDxfBtn"), loadFilesBtn: el("loadFilesBtn"),
  filePicker: el("filePicker"), layoutStatus: el("layoutStatus"),
  recipePreset: el("recipePreset"), tankCount: el("tankCount"), wdoTimeMin: el("wdoTimeMin"),
  loadTimeMin: el("loadTimeMin"), unloadTimeMin: el("unloadTimeMin"), tolerancePct: el("tolerancePct"),
  dripTimeSec: el("dripTimeSec"), targetBph: el("targetBph"), simHours: el("simHours"),
  dwellPreset: el("dwellPreset"), applyDwellBtn: el("applyDwellBtn"),
  tankTableBody: el("tankTableBody"), tankOverridesDetails: el("tankOverridesDetails"),
  wagonSpeedMPerMin: el("wagonSpeedMPerMin"), liftLowerSec: el("liftLowerSec"),
  pickDropSec: el("pickDropSec"), wagonCount: el("wagonCount"), distanceMode: el("distanceMode"),
  simSpeed2: el("simSpeed2"), autoRun: el("autoRun"),
  // KPI
  kpiThroughput: el("kpiThroughput"), kpiThroughputSub: el("kpiThroughputSub"),
  kpiLeadTime: el("kpiLeadTime"), kpiLeadTimeSub: el("kpiLeadTimeSub"),
  kpiBottleneck: el("kpiBottleneck"), kpiBottleneckSub: el("kpiBottleneckSub"),
  kpiViolations: el("kpiViolations"), kpiViolationsSub: el("kpiViolationsSub"),
  kpiWagonUtil: el("kpiWagonUtil"), kpiWagonUtilSub: el("kpiWagonUtilSub"),
  kpiOptimalWip: el("kpiOptimalWip"), kpiOptimalWipSub: el("kpiOptimalWipSub"),
  // Viz
  canvas: el("simCanvas"), nowOut: el("nowOut"), hoverTip: el("hoverTip"),
  zoomToFitBtn: el("zoomToFitBtn"), toggleLabelsBtn: el("toggleLabelsBtn"),
  // Playback
  stepBackBtn: el("stepBackBtn"), playPauseBtn: el("playPauseBtn"),
  stepFwdBtn: el("stepFwdBtn"), resetPlayheadBtn: el("resetPlayheadBtn"), scrub: el("scrub"),
  // Metrics tabs
  stationMetricsBody: el("stationMetricsBody"), wagonMetricsBody: el("wagonMetricsBody"),
  loadingKvGrid: el("loadingKvGrid"), loadingQueueSvg: el("loadingQueueSvg"),
  throughputSvg: el("throughputSvg"), wipSvg: el("wipSvg"), ganttSvg: el("ganttSvg"),
  // Scenario
  saveScenarioABtn: el("saveScenarioABtn"), saveScenarioBBtn: el("saveScenarioBBtn"),
  clearScenariosBtn: el("clearScenariosBtn"),
  scenarioTableWrap: el("scenarioTableWrap"), scenarioTableBody: el("scenarioTableBody"),
  scenarioAHeader: el("scenarioAHeader"), scenarioBHeader: el("scenarioBHeader"),
  exportSummaryBtn: el("exportSummaryBtn"), // may be null
  summaryInline: el("summaryInline"), summaryText: el("summaryText"),
  summarySelectBtn: el("summarySelectBtn"), summaryHideBtn: el("summaryHideBtn"),
  // Config
  configPanel: el("configPanel"),
  recipeSummary: el("recipeSummary"), manualSummary: el("manualSummary"),
  transportSummary: el("transportSummary"), simSettingsSummary: el("simSettingsSummary"),
};

const state = {
  layout: buildSyntheticLayout(12), dxfLabelsRows: null,
  params: null, plan: null, sim: null,
  scenarioA: null, scenarioB: null,
  chartsStale: true, chartMeta: null, activeTab: "stations", detectedStations: null,
  view: { showLabels: true, transform: { scale: 1, tx: 0, ty: 0 }, viewport: { w: 0, h: 0, dpr: 1 } },
  anim: { running: false, timeSec: 0, lastTs: null },
};

function readParamsFromUi() {
  const tankCount = clamp(Number(ui.tankCount.value), 3, 20);
  const preset = ui.recipePreset.value;
  const recipeSteps = defaultRecipe(tankCount, preset).map((s) => ({ ...s }));
  const tableDwell = [];
  for (const tr of ui.tankTableBody.querySelectorAll("tr")) {
    const id = tr.getAttribute("data-id");
    const input = tr.querySelector("input");
    const v = input ? Number(input.value) : 0;
    if (id && id.startsWith("T")) tableDwell.push({ id, dwellMin: v });
  }
  for (const t of tableDwell) { const step = recipeSteps.find((x) => x.id === t.id); if (step) step.dwellSec = minutesToSeconds(Math.max(0, t.dwellMin)); }
  const wdoStep = recipeSteps.find((x) => x.id === "WDO");
  if (wdoStep) wdoStep.dwellSec = minutesToSeconds(Math.max(0, Number(ui.wdoTimeMin.value)));
  return {
    preset, tankCount, recipeSteps,
    wdoTimeMin: Math.max(0, Number(ui.wdoTimeMin.value)),
    loadTimeMin: Math.max(0, Number(ui.loadTimeMin.value)),
    unloadTimeMin: Math.max(0, Number(ui.unloadTimeMin.value)),
    tolerancePct: clamp(Number(ui.tolerancePct.value), 0, 50) / 100,
    dripTimeSec: Math.max(0, Number(ui.dripTimeSec.value)),
    targetBph: Math.max(0.1, Number(ui.targetBph.value)),
    simHours: Math.max(0.25, Number(ui.simHours.value)),
    wagonSpeedMPerMin: Math.max(1, Number(ui.wagonSpeedMPerMin.value)),
    liftLowerSec: Math.max(0, Number(ui.liftLowerSec.value)),
    pickDropSec: Math.max(0, Number(ui.pickDropSec.value)),
    wagonCount: Math.max(1, Math.floor(Number(ui.wagonCount.value))),
    distanceMode: ui.distanceMode?.value || "manhattan",
    dwellClockOffsetSec: null,
    simSpeed: Math.max(0.25, Number(ui.simSpeed2.value)),
  };
}

function rebuildTankTable(tankCount, dwellMinDefault) {
  ui.tankTableBody.textContent = "";
  for (let i = 0; i < tankCount; i++) {
    const id = `T${i + 1}`;
    const tr = document.createElement("tr"); tr.setAttribute("data-id", id);
    const td1 = document.createElement("td"); td1.textContent = id;
    const td2 = document.createElement("td");
    const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.step = "0.5"; input.value = String(dwellMinDefault);
    td2.appendChild(input); tr.appendChild(td1); tr.appendChild(td2); ui.tankTableBody.appendChild(tr);
    input.addEventListener("input", () => { if (ui.autoRun.checked) recomputeAndRender(); });
  }
}

function updateLayout() {
  const tankCount = clamp(Number(ui.tankCount.value), 3, 20);
  if (ui.layoutMode.value === "dxf_labels" && state.dxfLabelsRows) {
    state.layout = buildLayoutFromDxfLabels(state.dxfLabelsRows, tankCount);
    ui.layoutStatus.textContent = `DXF labels (${state.layout.meta.source}).`;
  } else {
    state.layout = buildSyntheticLayout(tankCount);
    ui.layoutStatus.textContent = "Synthetic layout.";
  }
  state.layout.meta.distanceMode = state.params?.distanceMode || "manhattan";
  zoomToFit();
}

function recomputePlan() {
  state.params = readParamsFromUi();
  updateLayout();
  state.plan = buildSimPlan(state.layout, state.params);
  state.sim = runSimulation(state.layout, state.params);
}

// ─── Update KPI cards ────────────────────────────────────────
function updateResults() {
  if (!state.sim || !state.params) return;
  const s = state.sim;
  const p = state.params;

  // Throughput
  const achieved = Number.isFinite(s.throughputTrimmedBph) ? s.throughputTrimmedBph : Number.isFinite(s.throughputSteadyBph) ? s.throughputSteadyBph : s.throughputBph;
  const delta = pctDelta(achieved, p.targetBph);
  ui.kpiThroughput.textContent = s.throughputStatus === "insufficient_data" ? "N/A" : `${achieved.toFixed(2)}`;
  ui.kpiThroughput.className = "kpi-card__value mono" + (delta != null ? (delta >= 0 ? " kpi-card__value--ok" : " kpi-card__value--bad") : "");
  const deltaStr = delta != null ? ` (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%)` : "";
  ui.kpiThroughputSub.textContent = `target: ${p.targetBph.toFixed(2)} bph${deltaStr}`;

  // Lead time
  ui.kpiLeadTime.textContent = formatSeconds(s.avgLeadTimeSec);
  const b = state.plan?.buckets;
  ui.kpiLeadTimeSub.textContent = b ? `manual ${formatTimeShort(b.manual)} | dwell ${formatTimeShort(b.dwell)} | travel ${formatTimeShort(b.travel)}` : "-";

  // Bottleneck
  const bottleneckLabels = { dest_full: "Tank occupied", wagon_busy: "Wagon busy", unload_busy: "Unload busy", load_busy: "Load busy", none: "None" };
  ui.kpiBottleneck.textContent = bottleneckLabels[s.bottleneck] || s.bottleneck;
  ui.kpiBottleneck.className = "kpi-card__value mono" + (s.bottleneck !== "none" ? " kpi-card__value--warn" : " kpi-card__value--ok");
  ui.kpiBottleneckSub.textContent = `tank-full: ${s.waits.dest_full} | wagon: ${s.waits.wagon_busy}`;

  // Violations
  ui.kpiViolations.textContent = String(s.violations.length);
  ui.kpiViolations.className = "kpi-card__value mono" + (s.violations.length > 0 ? " kpi-card__value--bad" : " kpi-card__value--ok");
  ui.kpiViolationsSub.textContent = s.violations.length === 0 ? "all within tolerance" : `${s.violations.length} over-dwell events`;

  // Wagon utilization (average)
  const avgWagonUtil = s.util.wagons.length ? s.util.wagons.reduce((a, w) => a + w.util01, 0) / s.util.wagons.length : 0;
  ui.kpiWagonUtil.textContent = formatPct01(avgWagonUtil);
  ui.kpiWagonUtil.className = "kpi-card__value mono" + (avgWagonUtil > 0.9 ? " kpi-card__value--bad" : avgWagonUtil > 0.7 ? " kpi-card__value--warn" : "");
  ui.kpiWagonUtilSub.textContent = s.util.wagons.map((w) => `${w.id}: ${formatPct01(w.util01)}`).join(" | ");

  // Optimal WIP (inventory)
  const inv = s.inventory;
  if (inv && ui.kpiOptimalWip) {
    const optWip = Number.isFinite(inv.optimalWip) ? inv.optimalWip : 0;
    ui.kpiOptimalWip.textContent = Number.isFinite(optWip) ? optWip.toFixed(1) : "-";
    if (inv.isOverfeeding) {
      ui.kpiOptimalWip.className = "kpi-card__value mono kpi-card__value--warn";
      ui.kpiOptimalWipSub.textContent = "actual avg " + inv.avgWip.toFixed(1) + " | overfeeding by " + ((p.targetBph - inv.recommendedBph) / inv.recommendedBph * 100).toFixed(0) + "%";
    } else {
      ui.kpiOptimalWip.className = "kpi-card__value mono kpi-card__value--ok";
      ui.kpiOptimalWipSub.textContent = "actual avg " + inv.avgWip.toFixed(1) + " | balanced";
    }
  }

  // Update config summaries
  ui.recipeSummary.textContent = `${p.tankCount} tanks, ${p.preset.toUpperCase()}`;
  ui.manualSummary.textContent = `Load ${p.loadTimeMin}m, Unload ${p.unloadTimeMin}m`;
  ui.transportSummary.textContent = `${p.wagonCount} wagon${p.wagonCount > 1 ? "s" : ""}, ${p.wagonSpeedMPerMin} m/min`;
  ui.simSettingsSummary.textContent = `${p.targetBph} bph, ${p.simHours}hr`;

  // Update component metrics
  renderStationMetrics();
  renderWagonMetrics();
  renderLoadingMetrics();
  renderScenarioCompare();
  // Update suggestions badge count
  const sgBadge = document.getElementById("suggestionsBadge");
  if (sgBadge) {
    const sgCount = generateSuggestions().length;
    sgBadge.textContent = String(sgCount);
    sgBadge.hidden = sgCount === 0;
  }
  // If drawer is open, refresh it
  const drawer = document.getElementById("suggestionsDrawer");
  if (drawer && !drawer.hidden) renderSuggestions();
  state.chartsStale = true;
}

// ─── Station Metrics Tab ─────────────────────────────────────
function renderStationMetrics() {
  ui.stationMetricsBody.textContent = "";
  if (!state.sim) return;
  const stations = state.sim.util.stations.filter((s) => s.id !== "LOAD" && s.id !== "UNLOAD");
  for (const s of stations) {
    const tr = document.createElement("tr");
    // Station name
    const td1 = document.createElement("td"); td1.textContent = s.id; td1.style.fontWeight = "600";
    // Utilization bar
    const td2 = document.createElement("td");
    const pct = Math.round(clamp(s.util01, 0, 1) * 100);
    const barColor = pct > 85 ? "util-high" : pct > 60 ? "util-med" : "util-low";
    td2.innerHTML = `<span class="station-util-bar ${barColor}" style="width:${Math.max(2, pct * 0.6)}px"></span><span class="mono small">${pct}%</span>`;
    // Avg dwell
    const td3 = document.createElement("td"); td3.className = "mono small";
    td3.textContent = Number.isFinite(s.avgDwellSec) ? formatTimeShort(s.avgDwellSec) : "-";
    // Target dwell
    const td4 = document.createElement("td"); td4.className = "mono small";
    td4.textContent = Number.isFinite(s.targetDwellSec) && s.targetDwellSec > 0 ? formatTimeShort(s.targetDwellSec) : "-";
    // Violations
    const td5 = document.createElement("td");
    if (s.violationCount > 0) td5.innerHTML = `<span class="badge badge--bad">${s.violationCount}</span>`;
    else td5.innerHTML = `<span class="badge badge--ok">0</span>`;

    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5);
    ui.stationMetricsBody.appendChild(tr);
  }
}

// ─── Wagon Metrics Tab ───────────────────────────────────────
function renderWagonMetrics() {
  ui.wagonMetricsBody.textContent = "";
  if (!state.sim) return;
  for (const w of state.sim.util.wagons) {
    const card = document.createElement("div"); card.className = "wagon-card";
    const pct = Math.round(clamp(w.util01, 0, 1) * 100);
    const barColor = pct > 85 ? "var(--danger)" : pct > 60 ? "var(--warn)" : "var(--accent2)";
    card.innerHTML = `
      <div class="wagon-card__header">
        <span class="wagon-card__name">${escapeHtml(w.id)}</span>
        <span class="wagon-card__util" style="color:${barColor}">${pct}%</span>
      </div>
      <div class="wagon-card__bar"><div class="wagon-card__bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="wagon-card__details">
        <div>Busy <span class="wagon-card__detail-value">${formatTimeShort(w.busySec)}</span></div>
        <div>Idle <span class="wagon-card__detail-value">${formatTimeShort(w.idleSec)}</span></div>
        <div>Zone <span class="wagon-card__detail-value">${w.zone ? w.zone.label : "-"}</span></div>
      </div>`;
    ui.wagonMetricsBody.appendChild(card);
  }
}

// ─── Loading Metrics Tab ─────────────────────────────────────
function renderLoadingMetrics() {
  if (!state.sim || !state.sim.loading) return;
  const ld = state.sim.loading;
  const p = state.params;

  // KV grid
  ui.loadingKvGrid.innerHTML = "";
  const kvs = [
    { label: "Avg Queue Wait", value: formatTimeShort(ld.avgQueueWaitSec) },
    { label: "Max Queue Depth", value: String(ld.maxQueueDepth) },
    { label: "Loading Util", value: formatPct01(ld.processingUtil01) },
    { label: "Baskets Loaded", value: String(ld.totalBasketsLoaded) },
    { label: "Load Time", value: `${p.loadTimeMin} min` },
    { label: "Unload Time", value: `${p.unloadTimeMin} min` },
  ];
  for (const kv of kvs) {
    const item = document.createElement("div"); item.className = "kv-item";
    item.innerHTML = `<div class="kv-item__label">${escapeHtml(kv.label)}</div><div class="kv-item__value">${escapeHtml(kv.value)}</div>`;
    ui.loadingKvGrid.appendChild(item);
  }

  // Inventory analysis (DBR)
  const inv = state.sim.inventory;
  const invGrid = document.getElementById("inventoryKvGrid");
  const invInsight = document.getElementById("inventoryInsight");
  if (inv && invGrid) {
    invGrid.innerHTML = "";
    const invKvs = [
      { label: "Optimal WIP", value: Number.isFinite(inv.optimalWip) ? inv.optimalWip.toFixed(1) + " baskets" : "-" },
      { label: "Actual Avg WIP", value: inv.avgWip.toFixed(1) + " baskets" },
      { label: "Max WIP", value: String(inv.maxWip) + " baskets" },
      { label: "Excess Inventory", value: inv.excessWip.toFixed(1) + " baskets" },
      { label: "Recommended Rate", value: inv.recommendedBph.toFixed(2) + " bph" },
      { label: "Current Arrival", value: inv.arrivalBph.toFixed(2) + " bph" },
    ];
    for (const kv of invKvs) {
      const item = document.createElement("div"); item.className = "kv-item";
      item.innerHTML = '<div class="kv-item__label">' + escapeHtml(kv.label) + '</div><div class="kv-item__value">' + escapeHtml(kv.value) + '</div>';
      invGrid.appendChild(item);
    }
  }
  if (inv && invInsight) {
    if (inv.isOverfeeding) {
      const overPct = ((inv.arrivalBph - inv.recommendedBph) / inv.recommendedBph * 100).toFixed(0);
      invInsight.className = "inventory-insight inventory-insight--warn";
      invInsight.innerHTML = '<strong>Overfeeding detected.</strong> You are pushing baskets ' + overPct + '% faster than the system can process. '
        + 'The bottleneck processes at ' + inv.recommendedBph.toFixed(2) + ' bph but baskets arrive at ' + inv.arrivalBph.toFixed(2) + ' bph. '
        + 'This creates excess WIP of ~' + inv.excessWip.toFixed(1) + ' baskets waiting in the system — wasted staging space and capital. '
        + '<br><br><strong>Recommendation:</strong> Reduce arrival rate to ~' + inv.recommendedBph.toFixed(1) + ' bph (match the bottleneck), '
        + 'or resolve the bottleneck (' + escapeHtml(state.sim.bottleneck) + ') to increase system capacity.';
    } else {
      invInsight.className = "inventory-insight";
      invInsight.innerHTML = '<strong>Inventory is balanced.</strong> The arrival rate (' + inv.arrivalBph.toFixed(2) + ' bph) is within the system capacity (' + inv.recommendedBph.toFixed(2) + ' bph). '
        + 'Optimal WIP is ~' + (Number.isFinite(inv.optimalWip) ? inv.optimalWip.toFixed(1) : "-") + ' baskets in the system at any time. '
        + 'Keep ' + (Number.isFinite(inv.recommendedBuffer) ? inv.recommendedBuffer : 1) + ' basket(s) prepared at loading to prevent bottleneck starvation.';
    }
  }

  // Loading activity chart — build from load events
  const loadEvents = (state.sim.events || []).filter((e) => e.kind === "load_done");
  if (loadEvents.length > 0) {
    const simEnd = state.sim.simEnd;
    const series = [{ x: 0, y: 0 }];
    for (const e of loadEvents) {
      series.push({ x: e.start, y: 0 }); // idle right before load starts
      series.push({ x: e.start, y: 1 }); // busy
      series.push({ x: e.end, y: 1 });   // busy until end
      series.push({ x: e.end, y: 0 });   // idle after load ends
    }
    series.push({ x: simEnd, y: 0 });
    renderLineChart(ui.loadingQueueSvg, series, {
      stroke: "rgba(74,222,128,0.80)", fill: "rgba(74,222,128,0.15)", yMax: 1, unit: "busy",
    });
  }
}

// ─── Charts Tab ──────────────────────────────────────────────
function renderCharts() {
  if (!state.sim?.snapshots?.length) return;
  if (!state.chartsStale && state.chartMeta) {
    const total = Math.max(1, state.sim.simEnd);
    const t = clamp(state.anim.timeSec, 0, total);
    updatePlayhead(ui.throughputSvg, state.chartMeta.throughput.xFor(t));
    updatePlayhead(ui.wipSvg, state.chartMeta.wip.xFor(t));
    const pad = 14; const w = 600 - pad * 2;
    updatePlayhead(ui.ganttSvg, pad + (t / total) * w);
    return;
  }

  const snaps = state.sim.snapshots;
  const windowSec = 600; const step = 10;
  const byIdx = new Map(snaps.map((s, i) => [Math.floor(s.t / step), i]));

  const throughputSeries = [];
  for (const s of snaps) {
    const t0 = Math.max(0, s.t - windowSec);
    const i0 = byIdx.get(Math.floor(t0 / step)) ?? 0;
    const s0 = snaps[i0];
    const dC = s.completed - s0.completed;
    throughputSeries.push({ x: s.t, y: (dC / Math.max(1, s.t - s0.t)) * 3600 });
  }

  const wipSeries = [];
  for (const s of snaps) {
    const lc = s.locCounts || {};
    const tanks = Object.keys(lc).filter((k) => k.startsWith("T")).reduce((a, k) => a + (lc[k] || 0), 0);
    wipSeries.push({ x: s.t, y: (lc.LOADQ || 0) + (lc.UNLOADQ || 0) + (lc.IN_TRANSIT || 0) + (lc.WDO || 0) + tanks });
  }

  const meta1 = renderLineChart(ui.throughputSvg, throughputSeries, { stroke: "rgba(74,163,255,0.80)", fill: "rgba(74,163,255,0.12)", yMax: state.params?.targetBph ?? 0, unit: "b/hr" });
  const meta2 = renderLineChart(ui.wipSvg, wipSeries, { stroke: "rgba(112,240,184,0.80)", fill: "rgba(112,240,184,0.10)", unit: "items" });
  state.chartMeta = { throughput: meta1, wip: meta2 };

  // Target line on throughput
  const targetBph = state.params?.targetBph ?? 0;
  if (targetBph > 0) {
    const yTarget = meta1.yFor(targetBph);
    const tLine = svgEl("line"); tLine.setAttribute("x1", meta1.pad); tLine.setAttribute("x2", meta1.width - meta1.pad);
    tLine.setAttribute("y1", yTarget); tLine.setAttribute("y2", yTarget);
    tLine.setAttribute("stroke", "rgba(255,191,105,0.5)"); tLine.setAttribute("stroke-dasharray", "4 3"); tLine.setAttribute("stroke-width", "1");
    ui.throughputSvg.appendChild(tLine);
  }

  // Playheads
  const total = Math.max(1, state.sim.simEnd);
  for (const [svg, meta] of [[ui.throughputSvg, meta1], [ui.wipSvg, meta2]]) {
    const xNow = meta.xFor(clamp(state.anim.timeSec, 0, total));
    const line = svgEl("line"); line.setAttribute("x1", xNow); line.setAttribute("x2", xNow);
    line.setAttribute("y1", 6); line.setAttribute("y2", meta.height - 6);
    line.setAttribute("stroke", "rgba(255,191,105,0.45)"); line.setAttribute("stroke-width", "1.5");
    line.setAttribute("class", "playhead-marker"); svg.appendChild(line);
  }

  renderGantt(ui.ganttSvg);
  state.chartsStale = false;
}

// ─── Scenario comparison ─────────────────────────────────────
function summarizeScenario(params, sim) {
  const achieved = Number.isFinite(sim.throughputTrimmedBph) ? sim.throughputTrimmedBph : Number.isFinite(sim.throughputSteadyBph) ? sim.throughputSteadyBph : sim.throughputBph;
  return {
    at: new Date().toISOString(), params: deepCopy(params),
    metrics: { throughputBph: achieved, avgLeadTimeSec: sim?.avgLeadTimeSec ?? NaN, violations: sim?.violations?.length ?? 0, bottleneck: sim?.bottleneck ?? "-" },
  };
}

function renderScenarioCompare() {
  const a = state.scenarioA; const b = state.scenarioB;
  if (!a && !b) { ui.scenarioTableWrap.hidden = true; ui.clearScenariosBtn.disabled = true; return; }
  ui.clearScenariosBtn.disabled = false;
  ui.scenarioTableWrap.hidden = false;
  ui.scenarioTableBody.textContent = "";
  ui.scenarioAHeader.textContent = a ? "Scenario A" : "-";
  ui.scenarioBHeader.textContent = b ? "Scenario B" : "-";

  const cur = state.sim && state.params ? summarizeScenario(state.params, state.sim) : null;
  const fmt = (n) => (Number.isFinite(n) ? n.toFixed(2) : "-");
  const rows = [
    ["Throughput (bph)", a ? fmt(a.metrics.throughputBph) : "-", b ? fmt(b.metrics.throughputBph) : "-", cur ? fmt(cur.metrics.throughputBph) : "-"],
    ["Lead Time", a ? formatSeconds(a.metrics.avgLeadTimeSec) : "-", b ? formatSeconds(b.metrics.avgLeadTimeSec) : "-", cur ? formatSeconds(cur.metrics.avgLeadTimeSec) : "-"],
    ["Violations", a ? String(a.metrics.violations) : "-", b ? String(b.metrics.violations) : "-", cur ? String(cur.metrics.violations) : "-"],
    ["Bottleneck", a ? a.metrics.bottleneck : "-", b ? b.metrics.bottleneck : "-", cur ? cur.metrics.bottleneck : "-"],
  ];
  for (const r of rows) {
    const tr = document.createElement("tr");
    for (const cell of r) { const td = document.createElement("td"); td.textContent = cell; tr.appendChild(td); }
    ui.scenarioTableBody.appendChild(tr);
  }
}

// ─── Export ──────────────────────────────────────────────────
function exportSummaryText() {
  if (!state.params || !state.sim) return "No simulation results yet.";
  const p = state.params; const s = state.sim;
  const tankDwells = p.recipeSteps.filter((x) => x.kind === "tank").map((x) => `${x.id}:${(x.dwellSec / 60).toFixed(1)}m`).join(", ");
  const lines = [
    "Pretreatment Transporter Simulation Summary",
    `Date: ${new Date().toLocaleString()}`, "",
    `Recipe: ${p.preset} | Tanks: ${p.tankCount} | WDO: ${p.wdoTimeMin}m`,
    `Tank dwells: ${tankDwells}`,
    `Load: ${p.loadTimeMin}m | Unload: ${p.unloadTimeMin}m | Drip: ${p.dripTimeSec}s`,
    `Tolerance: ±${Math.round(p.tolerancePct * 100)}%`, "",
    `Wagons: ${p.wagonCount} | Speed: ${p.wagonSpeedMPerMin} m/min`,
    `Lift+Lower: ${p.liftLowerSec}s | Pick+Drop: ${p.pickDropSec}s`, "",
    `Sim: ${p.simHours}hr | Target: ${p.targetBph} bph`,
    `Achieved: ${s.throughputBph.toFixed(2)} bph`,
    `Lead time: ${formatSeconds(s.avgLeadTimeSec)}`,
    `Violations: ${s.violations.length} | Bottleneck: ${s.bottleneck}`, "",
    "Wagon utilization:",
    ...s.util.wagons.map((w) => `  ${w.id}: ${formatPct01(w.util01)}`),
    "", "Station utilization:",
    ...s.util.stations.filter((st) => st.dwellCount > 0).map((st) => `  ${st.id}: ${formatPct01(st.util01)} (avg dwell ${formatTimeShort(st.avgDwellSec)}, violations ${st.violationCount})`),
  ];
  return lines.join("\n");
}

async function copyToClipboard(text) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.focus(); ta.select(); const ok = document.execCommand("copy");
    document.body.removeChild(ta); return ok;
  } catch { return false; }
}

// ─── Rendering loop ──────────────────────────────────────────
function snapshotAt(timeSec) {
  if (!state.sim?.snapshots?.length) return null;
  const idx = clamp(Math.floor(timeSec / 10), 0, state.sim.snapshots.length - 1);
  return state.sim.snapshots[idx];
}

function updateNow() {
  if (!state.sim) { ui.nowOut.textContent = "-"; return; }
  const total = state.sim.simEnd;
  const t = clamp(state.anim.timeSec, 0, total);
  const snap = snapshotAt(t);
  const completed = snap ? snap.completed : 0;
  const bphSoFar = t > 0 ? (completed / t) * 3600 : 0;
  ui.nowOut.textContent = `${formatTimeShort(t)} / ${formatTimeShort(total)} | ${completed} done (${bphSoFar.toFixed(1)} bph)`;
}

function dwellForNodeId(id) {
  if (!state.params) return null;
  if (id === "LOAD") return minutesToSeconds(state.params.loadTimeMin);
  if (id === "UNLOAD") return minutesToSeconds(state.params.unloadTimeMin);
  if (id === "WDO") return minutesToSeconds(state.params.wdoTimeMin);
  const step = state.params.recipeSteps.find((s) => s.id === id);
  return step ? step.dwellSec : null;
}

function nodeScreenGeometry(node, transform) {
  const p = applyTransform(node, transform);
  if (node.type === "tank") { const w = 54, h = 26; return { kind: "rect", x: p.x - w / 2, y: p.y - h / 2, w, h, cx: p.x, cy: p.y }; }
  const r = node.id === "LOAD" || node.id === "UNLOAD" ? 16 : 14;
  return { kind: "circle", cx: p.x, cy: p.y, r };
}

function hitTestNode(screenX, screenY) {
  const t = state.view.transform;
  for (let i = state.layout.nodes.length - 1; i >= 0; i--) {
    const n = state.layout.nodes[i]; const g = nodeScreenGeometry(n, t);
    if (g.kind === "circle") { if (Math.hypot(screenX - g.cx, screenY - g.cy) <= g.r + 6) return n; }
    else { if (screenX >= g.x - 6 && screenX <= g.x + g.w + 6 && screenY >= g.y - 6 && screenY <= g.y + g.h + 6) return n; }
  }
  return null;
}

function showHoverTip(clientX, clientY, html) {
  ui.hoverTip.innerHTML = html; ui.hoverTip.hidden = false;
  const wrap = ui.hoverTip.parentElement?.getBoundingClientRect(); if (!wrap) return;
  ui.hoverTip.style.left = `${clientX - wrap.left + 10}px`;
  ui.hoverTip.style.top = `${clientY - wrap.top + 10}px`;
}
function hideHoverTip() { ui.hoverTip.hidden = true; }

function zoomToFit() {
  const c = ui.canvas;
  const points = state.layout.nodes.map((n) => ({ x: n.x, y: n.y }));
  const b = computeBounds(points);
  state.view.transform = fitTransform(b, state.view.viewport.w || c.width, state.view.viewport.h || c.height, 50);
}

function renderFrame() {
  updateNow();
  // Only render canvas if the simulation preview is open
  const simPreview = document.getElementById("simPreview");
  if (simPreview && simPreview.open) {
    const c = ui.canvas;
    const ctx = c.getContext("2d");
    drawScene(ctx, state.view, state.layout, state.plan, state.anim, snapshotAt(state.anim.timeSec));
  }
  // Render charts if charts tab is active
  if (state.activeTab === "charts") renderCharts();
}

function recomputeAndRender() {
  recomputePlan();
  updateResults();
  state.chartsStale = true;
  renderFrame();
}

function resetAnim() {
  state.anim.running = false; state.anim.timeSec = 0; state.anim.lastTs = null;
  ui.scrub.value = "0"; updatePlayPauseLabel(); renderFrame();
}

function updatePlayPauseLabel() {
  if (state.anim.running) { ui.playPauseBtn.textContent = "Pause"; return; }
  const total = state.sim?.simEnd ?? state.plan?.cycleSeconds ?? 0;
  const t = state.anim.timeSec || 0;
  ui.playPauseBtn.textContent = (total > 0 && t > 0 && t < total) ? "Resume" : "Replay";
}

function startAnim() {
  state.anim.running = true; state.anim.lastTs = null; updatePlayPauseLabel();
  // playing indicator on the sim preview header
  requestAnimationFrame(tick);
}

function pauseAnim() {
  state.anim.running = false; updatePlayPauseLabel();
  // stopped indicator
}

function tick(ts) {
  if (!state.anim.running) return;
  if (state.anim.lastTs == null) state.anim.lastTs = ts;
  const dt = (ts - state.anim.lastTs) / 1000; state.anim.lastTs = ts;
  const speed = state.params?.simSpeed ?? 1;
  state.anim.timeSec += dt * speed;
  const total = state.sim?.simEnd ?? state.plan?.cycleSeconds ?? 0;
  if (total > 0 && state.anim.timeSec > total) state.anim.timeSec = total;
  if (state.plan) { ui.scrub.value = String(clamp(Math.round((1000 * state.anim.timeSec) / Math.max(1e-6, total)), 0, 1000)); }
  renderFrame();
  if (total > 0 && state.anim.timeSec >= total) { state.anim.running = false; updatePlayPauseLabel(); return; }
  requestAnimationFrame(tick);
}

// ─── Browser-based DXF parsing ───────────────────────────────
function extractLabelsFromDxfText(dxfText) {
  // Use the dxf-parser library loaded via CDN
  if (typeof DxfParser === "undefined") throw new Error("DXF parser library not loaded");
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfText);
  if (!dxf || !dxf.entities) throw new Error("Failed to parse DXF file");

  const labels = [];
  for (const entity of dxf.entities) {
    if (entity.type !== "TEXT" && entity.type !== "MTEXT") continue;
    const text = normText(entity.text || "");
    if (!text) continue;
    // TEXT uses startPoint, MTEXT uses position
    const pos = entity.startPoint || entity.position || null;
    if (!pos || pos.x == null || pos.y == null) continue;
    labels.push({
      type: entity.type,
      layer: entity.layer || "0",
      text: text,
      x: pos.x,
      y: pos.y,
      rotation: entity.rotation ?? null,
      height: entity.textHeight || entity.height || null,
    });
  }
  return labels;
}

function detectStationsFromLabels(labels) {
  // Find AS-tags (AS01, AS02, ..., AS22) or TANK labels
  const stationPattern = /^AS\s*(\d+)$/i;
  const tankPattern = /^TANK\s*(\d+)$/i;
  const stations = [];
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

function applyDxfLabels(labels) {
  state.dxfLabelsRows = labels;
  ui.layoutMode.value = "dxf_labels";

  // Auto-detect station count from AS-tags or TANK labels
  const detectedStations = detectStationsFromLabels(labels);
  if (detectedStations.length > 0) {
    const count = clamp(detectedStations.length, 3, 20);
    ui.tankCount.value = String(count);
    rebuildTankTable(count, Number(ui.dwellPreset.value));
    state.detectedStations = detectedStations;
    ui.layoutStatus.textContent = "DXF layout: " + detectedStations.length + " stations detected (" + detectedStations.map((s) => s.id).join(", ") + ").";
  } else {
    state.detectedStations = null;
    ui.layoutStatus.textContent = "DXF layout (" + labels.length + " labels, no station tags found).";
  }

  recomputeAndRender();
}

async function handleDxfFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const modalStatus = document.getElementById("modalStatus");

  if (ext === "dxf") {
    // Parse directly in browser
    modalStatus.textContent = "Parsing DXF file...";
    modalStatus.className = "modal__status modal__status--loading";
    try {
      const text = await file.text();
      const labels = extractLabelsFromDxfText(text);
      if (labels.length === 0) {
        modalStatus.textContent = "No text labels found in file. Check if the DXF contains TEXT/MTEXT entities.";
        modalStatus.className = "modal__status modal__status--error";
        return false;
      }
      // Detect stations and apply
      applyDxfLabels(labels);
      const detected = state.detectedStations;
      const stationMsg = detected && detected.length > 0
        ? detected.length + " stations detected — tank count set to " + Math.min(detected.length, 20)
        : "No station tags found — using default tank count";
      modalStatus.textContent = "Parsed " + labels.length + " labels. " + stationMsg + ".";
      modalStatus.className = "modal__status modal__status--success";
      return true;
    } catch (e) {
      modalStatus.textContent = "Parse error: " + (e.message || e);
      modalStatus.className = "modal__status modal__status--error";
      return false;
    }
  } else if (ext === "dwg") {
    // Send to backend for conversion
    modalStatus.textContent = "Sending to server for conversion...";
    modalStatus.className = "modal__status modal__status--loading";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(DWG_CONVERT_ENDPOINT, { method: "POST", body: formData });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error("Server returned " + resp.status + ": " + (errText || "conversion failed"));
      }
      const dxfText = await resp.text();
      const labels = extractLabelsFromDxfText(dxfText);
      if (labels.length === 0) {
        modalStatus.textContent = "Converted but no text labels found.";
        modalStatus.className = "modal__status modal__status--error";
        return false;
      }
      applyDxfLabels(labels);
      const detectedDwg = state.detectedStations;
      const dwgStationMsg = detectedDwg && detectedDwg.length > 0
        ? detectedDwg.length + " stations detected — tank count set to " + Math.min(detectedDwg.length, 20)
        : "No station tags found — using default tank count";
      modalStatus.textContent = "Converted " + labels.length + " labels. " + dwgStationMsg + ".";
      modalStatus.className = "modal__status modal__status--success";
      return true;
    } catch (e) {
      if (e.message && e.message.includes("Failed to fetch")) {
        modalStatus.innerHTML = "Cannot reach conversion server. <strong>Alternative:</strong> export your drawing as .dxf from AutoCAD (File &gt; Save As &gt; DXF) and import the .dxf instead. Or start the server: <code>python3 scripts/serve_convert.py</code>";
      } else {
        modalStatus.textContent = "Conversion error: " + (e.message || e);
      }
      modalStatus.className = "modal__status modal__status--error";
      return false;
    }
  } else {
    modalStatus.textContent = "Unsupported file type: ." + ext + ". Use .dxf or .dwg.";
    modalStatus.className = "modal__status modal__status--error";
    return false;
  }
}

function dismissModal() {
  const modal = document.getElementById("startupModal");
  if (modal) modal.hidden = true;
  document.querySelector(".app").classList.remove("app--behind-modal");
}

function wizardGoToStep(step) {
  // Update step indicators
  document.querySelectorAll(".wizard-step").forEach((el) => {
    const s = Number(el.getAttribute("data-step"));
    el.classList.toggle("wizard-step--active", s === step);
    el.classList.toggle("wizard-step--done", s < step);
  });
  // Show/hide pages
  document.getElementById("wizardStep1").hidden = step !== 1;
  document.getElementById("wizardStep2").hidden = step !== 2;
}

function initStartupModal() {
  const modal = document.getElementById("startupModal");
  const dropZone = document.getElementById("dropZone");
  const filePicker = document.getElementById("dxfFilePicker");
  const skipBtn = document.getElementById("skipDxfBtn");
  const nextBtn1 = document.getElementById("wizardNext1");
  const backBtn2 = document.getElementById("wizardBack2");
  const finishBtn = document.getElementById("wizardFinish");
  const wizTargetBph = document.getElementById("wizTargetBph");
  const wizSimHours = document.getElementById("wizSimHours");

  if (!modal || !dropZone || !filePicker) return;

  let layoutReady = false;

  // Show modal, blur app
  document.querySelector(".app").classList.add("app--behind-modal");

  function enableNext() {
    layoutReady = true;
    if (nextBtn1) nextBtn1.disabled = false;
  }

  // Click to browse
  dropZone.addEventListener("click", () => filePicker.click());

  // File picker change
  filePicker.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await handleDxfFile(file);
    if (ok) enableNext();
  });

  // Drag and drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drop-zone--dragover");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drop-zone--dragover");
  });
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("drop-zone--dragover");
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const ok = await handleDxfFile(file);
    if (ok) enableNext();
  });

  // Skip — use synthetic layout
  skipBtn.addEventListener("click", () => {
    enableNext();
    wizardGoToStep(2);
  });

  // Next → Step 2
  if (nextBtn1) {
    nextBtn1.addEventListener("click", () => {
      if (!layoutReady) return;
      wizardGoToStep(2);
    });
  }

  // Back → Step 1
  if (backBtn2) {
    backBtn2.addEventListener("click", () => {
      wizardGoToStep(1);
    });
  }

  // Finish → apply targets and dismiss
  if (finishBtn) {
    finishBtn.addEventListener("click", () => {
      // Apply wizard values to sidebar inputs
      const targetVal = Number(wizTargetBph?.value || 2);
      const hoursVal = Number(wizSimHours?.value || 2);
      if (ui.targetBph) ui.targetBph.value = String(targetVal);
      if (ui.simHours) ui.simHours.value = String(hoursVal);
      dismissModal();
      recomputeAndRender();
    });
  }
}

// ─── DXF loading (legacy CSV path) ──────────────────────────
async function fetchDxfFiles() {
  const status = ui.layoutStatus; status.textContent = "Fetching...";
  try {
    const [invRes, labelsRes] = await Promise.all([
      fetch(`${DEFAULT_DXF_BASE}/${encodeURIComponent(DEFAULT_INVENTORY_JSON)}`),
      fetch(`${DEFAULT_DXF_BASE}/${encodeURIComponent(DEFAULT_LABELS_CSV)}`),
    ]);
    if (!labelsRes.ok) throw new Error(`${labelsRes.status}`);
    const rows = parseCsv(await labelsRes.text());
    state.dxfLabelsRows = rows.map((r) => ({ type: r.type, layer: r.layer, text: r.text, x: Number(r.x), y: Number(r.y), rotation: r.rotation, height: r.height }));
    status.textContent = `DXF labels (${state.dxfLabelsRows.length} rows).`;
    ui.layoutMode.value = "dxf_labels";
    recomputeAndRender();
  } catch (e) { status.textContent = `Failed: ${e?.message || e}`; }
}

async function handlePickedFiles(files) {
  const csv = Array.from(files).find((f) => f.name.endsWith(".csv"));
  if (!csv) { ui.layoutStatus.textContent = "Pick a CSV file."; return; }
  const rows = parseCsv(await csv.text());
  state.dxfLabelsRows = rows.map((r) => ({ type: r.type, layer: r.layer, text: r.text, x: Number(r.x), y: Number(r.y), rotation: r.rotation, height: r.height }));
  ui.layoutStatus.textContent = `DXF labels (${state.dxfLabelsRows.length} rows).`;
  ui.layoutMode.value = "dxf_labels";
  recomputeAndRender();
}

// ─── Tab switching ───────────────────────────────────────────
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll(".metrics-tab").forEach((btn) => {
    const active = btn.getAttribute("data-tab") === tabId;
    btn.classList.toggle("metrics-tab--active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".metrics-content").forEach((el) => {
    el.hidden = el.getAttribute("data-tab-content") !== tabId;
  });
  if (tabId === "charts") { state.chartsStale = true; renderCharts(); }
}

// ─── Suggestions Engine (Theory of Constraints) ─────────────

function generateSuggestions() {
  const suggestions = [];
  if (!state.sim || !state.params) return suggestions;
  const s = state.sim;
  const p = state.params;
  const inv = s.inventory;
  const achieved = Number.isFinite(s.throughputTrimmedBph) ? s.throughputTrimmedBph : Number.isFinite(s.throughputSteadyBph) ? s.throughputSteadyBph : s.throughputBph;

  // ── PRIORITY 1: ZERO VIOLATIONS (quality first) ──

  if (s.violations.length > 0 && s.bottleneck === "wagon_busy") {
    suggestions.push({
      id: "violations-add-wagon",
      category: "violations",
      priority: "Quality — Zero Violations",
      title: "Add a wagon to eliminate over-dwell violations",
      problem: "The system has " + s.violations.length + " over-dwell violations. Baskets are stuck in chemical tanks because the single wagon can't pick them up fast enough. Every violation is a potential quality defect — surface damage from prolonged chemical exposure.",
      theory: "Goldratt's First Rule: \"A bottleneck hour lost is a system hour lost.\" But more critically here — every minute a basket over-dwells in acid or chromate is irreversible surface damage. Quality is non-negotiable. The wagon is the constraint, and it's causing quality failures.",
      steps: [
        "Current wagon count: <strong>" + p.wagonCount + "</strong>",
        "Add 1 wagon: <span class='suggestion-card__change'>" + p.wagonCount + " → " + (p.wagonCount + 1) + " wagons</span>",
        "The second wagon covers the other half of the tank line",
        "Baskets get picked up before they exceed the dwell tolerance window",
        "Violations drop to near zero; throughput improves as a side effect",
      ],
      impact: "Expected: violations → 0, throughput improvement from reduced wait times",
      apply: { wagonCount: p.wagonCount + 1 },
    });
  }

  if (s.violations.length > 0 && s.bottleneck === "wagon_busy" && p.wagonCount >= 2) {
    suggestions.push({
      id: "violations-speed",
      category: "violations",
      priority: "Quality — Zero Violations",
      title: "Increase wagon speed to reduce transfer time",
      problem: "With " + p.wagonCount + " wagons, there are still " + s.violations.length + " violations. The wagons are fast enough to reach baskets but the total transfer cycle (travel + lift + lower + drip) is too long.",
      theory: "Goldratt's Step 2 — \"Exploit the constraint.\" Before adding more resources (Step 4: Elevate), make existing resources more effective. Faster wagon speed reduces the travel component of every transfer, giving the wagon more time margin.",
      steps: [
        "Current speed: <strong>" + p.wagonSpeedMPerMin + " m/min</strong>",
        "Increase by 25%: <span class='suggestion-card__change'>" + p.wagonSpeedMPerMin + " → " + Math.round(p.wagonSpeedMPerMin * 1.25) + " m/min</span>",
        "Each transfer saves " + Math.round((1400 / mPerMinToMmPerSec(p.wagonSpeedMPerMin) - 1400 / mPerMinToMmPerSec(p.wagonSpeedMPerMin * 1.25))) + "s of travel per tank gap",
        "Over " + p.tankCount + " tanks, total savings compound significantly",
      ],
      impact: "Faster transfers → wagon picks up baskets before tolerance window closes",
      apply: { wagonSpeedMPerMin: Math.round(p.wagonSpeedMPerMin * 1.25) },
    });
  }

  if (s.violations.length > 0 && p.tolerancePct < 0.20) {
    const newTol = Math.min(25, Math.round(p.tolerancePct * 100) + 5);
    suggestions.push({
      id: "violations-tolerance",
      category: "violations",
      priority: "Quality — Zero Violations",
      title: "Widen dwell tolerance to reduce violations",
      problem: "Current tolerance is ±" + Math.round(p.tolerancePct * 100) + "%. This gives only a " + Math.round(p.tolerancePct * 2 * 120) + "-second window for a 2-minute dwell. If the chemistry allows flexibility, a wider window reduces violations without changing physical equipment.",
      theory: "Goldratt distinguishes physical constraints from policy constraints. A tight tolerance is a policy constraint — it may be stricter than the chemistry actually requires. Relaxing a policy constraint is free and immediate.",
      steps: [
        "Current tolerance: <strong>±" + Math.round(p.tolerancePct * 100) + "%</strong>",
        "Widen to: <span class='suggestion-card__change'>±" + Math.round(p.tolerancePct * 100) + "% → ±" + newTol + "%</span>",
        "Validate with your chemical supplier that the wider window is acceptable",
        "Note: water/rinse tanks are almost always safe with wider tolerance; chemical tanks need verification",
      ],
      impact: "Wider window → fewer violations without equipment changes",
      apply: { tolerancePct: newTol },
    });
  }

  // ── PRIORITY 2: RESOLVE THE BOTTLENECK ──

  if (s.bottleneck === "wagon_busy" && s.violations.length === 0 && achieved < p.targetBph * 0.95) {
    suggestions.push({
      id: "bottleneck-wagon-add",
      category: "bottleneck",
      priority: "Bottleneck — Wagon Constraint",
      title: "Elevate the wagon constraint: add a wagon",
      problem: "The wagon is the bottleneck (" + s.waits.wagon_busy + " wait events). Violations are zero, but throughput is " + achieved.toFixed(2) + " bph vs " + p.targetBph.toFixed(2) + " bph target. The wagon simply can't serve all baskets fast enough.",
      theory: "Goldratt's Step 4 — \"Elevate the constraint.\" You've already exploited it (no violations means timing is okay). The system needs more wagon capacity to increase throughput. Adding a wagon is the correct elevation.",
      steps: [
        "Current: <strong>" + p.wagonCount + " wagon(s)</strong> at " + Math.round(s.util.wagons[0]?.util01 * 100 || 0) + "% utilization",
        "Add 1 wagon: <span class='suggestion-card__change'>" + p.wagonCount + " → " + (p.wagonCount + 1) + " wagons</span>",
        "Each wagon covers a zone of the tank line — reduces travel distance per wagon",
        "Throughput increases because baskets move through the system faster",
      ],
      impact: "Throughput should approach " + Math.min(p.targetBph, achieved * 1.6).toFixed(1) + " bph with reduced wagon contention",
      apply: { wagonCount: p.wagonCount + 1 },
    });
  }

  if (s.bottleneck === "dest_full") {
    const newDwell = Math.max(0.5, Number(ui.dwellPreset.value) * 0.85);
    suggestions.push({
      id: "bottleneck-tank",
      category: "bottleneck",
      priority: "Bottleneck — Tank Capacity",
      title: "Tanks are the constraint: reduce dwell time",
      problem: "The bottleneck is 'tank occupied' (" + s.waits.dest_full + " wait events). Single-capacity tanks are full when the next basket needs to enter. The wagon has to wait, creating a cascade of delays.",
      theory: "Goldratt's Step 2 — \"Exploit the constraint.\" The tanks are the drum. To exploit them, minimize the time each basket occupies a tank. If chemistry allows a 15% dwell reduction, each tank becomes available sooner, breaking the occupancy deadlock.",
      steps: [
        "Current dwell: <strong>" + Number(ui.dwellPreset.value).toFixed(1) + " min/tank</strong>",
        "Reduce by 15%: <span class='suggestion-card__change'>" + Number(ui.dwellPreset.value).toFixed(1) + " → " + newDwell.toFixed(1) + " min/tank</span>",
        "Validate the reduced dwell with your chemical process specification",
        "Alternative: add a parallel tank at the most utilized station",
      ],
      impact: "Frees each tank ~" + Math.round((Number(ui.dwellPreset.value) - newDwell) * 60) + "s sooner → breaks occupancy deadlock",
      apply: { dwellPreset: newDwell },
    });
  }

  if (s.bottleneck === "load_busy" || (s.loading && s.loading.processingUtil01 > 0.90)) {
    const newLoad = Math.max(5, Math.round(p.loadTimeMin * 0.75));
    suggestions.push({
      id: "bottleneck-loading",
      category: "bottleneck",
      priority: "Bottleneck — Loading Station",
      title: "Loading is the hidden constraint",
      problem: "Loading utilization is " + Math.round((s.loading?.processingUtil01 || 0) * 100) + "%. At " + p.loadTimeMin + " min/basket, the loading station can handle at most " + (60 / p.loadTimeMin).toFixed(1) + " bph. Your target of " + p.targetBph.toFixed(1) + " bph exceeds this ceiling.",
      theory: "Goldratt warns about hidden constraints. Loading seems like a simple manual operation, but it sets the maximum throughput ceiling for the entire system. No amount of wagon speed or tank optimization can exceed what loading allows in. This is Step 1 — \"Identify the constraint.\"",
      steps: [
        "Current load time: <strong>" + p.loadTimeMin + " min</strong> (max " + (60 / p.loadTimeMin).toFixed(1) + " bph)",
        "Reduce by 25% via offline basket preparation: <span class='suggestion-card__change'>" + p.loadTimeMin + " → " + newLoad + " min</span>",
        "Offline prep: load parts onto baskets at a separate station while the line runs",
        "At the loading station, just hook the pre-loaded basket — much faster",
        "New ceiling: " + (60 / newLoad).toFixed(1) + " bph",
      ],
      impact: "Raises the loading ceiling from " + (60 / p.loadTimeMin).toFixed(1) + " to " + (60 / newLoad).toFixed(1) + " bph",
      apply: { loadTimeMin: newLoad },
    });
  }

  // ── PRIORITY 3: INVENTORY OPTIMIZATION (Drum-Buffer-Rope) ──

  if (inv && inv.isOverfeeding) {
    suggestions.push({
      id: "inventory-dbr",
      category: "inventory",
      priority: "Inventory — Drum-Buffer-Rope",
      title: "Match release rate to the bottleneck",
      problem: "You are releasing baskets at " + inv.arrivalBph.toFixed(1) + " bph but the system can only process " + inv.recommendedBph.toFixed(1) + " bph. Excess WIP of ~" + inv.excessWip.toFixed(1) + " baskets accumulates — wasted staging space, capital tied up in work-in-progress, and longer lead times for every basket.",
      theory: "Goldratt's Drum-Buffer-Rope: The bottleneck is the Drum — it sets the pace. The Rope ties the release of new work to the Drum's pace. Never push faster than the Drum can process. Excess inventory is not an asset — it's a liability that hides problems and inflates lead time.",
      steps: [
        "Current arrival rate: <strong>" + inv.arrivalBph.toFixed(1) + " bph</strong>",
        "Bottleneck capacity: <strong>" + inv.recommendedBph.toFixed(1) + " bph</strong>",
        "Reduce target to match: <span class='suggestion-card__change'>" + p.targetBph.toFixed(1) + " → " + inv.recommendedBph.toFixed(1) + " bph</span>",
        "Optimal WIP: " + (Number.isFinite(inv.optimalWip) ? inv.optimalWip.toFixed(1) : "~2") + " baskets in the system",
        "Keep " + (Number.isFinite(inv.recommendedBuffer) ? inv.recommendedBuffer : 1) + " basket(s) prepared at loading as buffer to prevent bottleneck starvation",
      ],
      impact: "Eliminates excess WIP, reduces lead time, makes bottleneck visible",
      apply: { targetBph: Math.round(inv.recommendedBph * 100) / 100 },
    });
  }

  // ── RELIABILITY ──

  if (p.simHours < 2 || s.completedCount < 4) {
    suggestions.push({
      id: "reliability-duration",
      category: "reliability",
      priority: "Reliability",
      title: "Extend simulation for reliable results",
      problem: "Only " + s.completedCount + " baskets completed in " + p.simHours + " hours. Throughput and violation statistics need more data points to be reliable. The first baskets always experience warm-up bias (empty line).",
      theory: "Sound decisions need sound data. With fewer than 4 completed baskets, the throughput estimate can swing ±30% from the true steady-state value. This isn't a TOC principle — it's statistical reliability.",
      steps: [
        "Current: <strong>" + p.simHours + " hours</strong> (" + s.completedCount + " baskets completed)",
        "Increase to: <span class='suggestion-card__change'>" + p.simHours + " → 4 hours</span>",
        "More baskets = more reliable throughput, violation, and utilization numbers",
        "The warm-up period (first 1-2 baskets) gets diluted by steady-state data",
      ],
      impact: "More accurate metrics for quotation confidence",
      apply: { simHours: 4 },
    });
  }

  return suggestions;
}

function renderSuggestions() {
  const body = document.getElementById("suggestionsBody");
  const subtitle = document.getElementById("suggestionsSubtitle");
  const badge = document.getElementById("suggestionsBadge");
  if (!body) return;

  const suggestions = generateSuggestions();

  // Update badge
  if (badge) {
    if (suggestions.length > 0) {
      badge.textContent = String(suggestions.length);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  body.innerHTML = "";
  if (subtitle) subtitle.textContent = suggestions.length + " suggestion" + (suggestions.length !== 1 ? "s" : "") + " based on current simulation";

  if (suggestions.length === 0) {
    body.innerHTML = '<div class="suggestions-empty"><div class="suggestions-empty__icon">&#10003;</div>System is well-optimized. No violations, throughput meets target, and inventory is balanced.<br><br>Try changing parameters in the sidebar to explore what-if scenarios.</div>';
    return;
  }

  for (const sg of suggestions) {
    const card = document.createElement("div");
    card.className = "suggestion-card suggestion-card--" + sg.category;

    let stepsHtml = "";
    for (const step of sg.steps) {
      stepsHtml += "<li>" + step + "</li>";
    }

    card.innerHTML =
      '<div class="suggestion-card__header">' +
        '<div class="suggestion-card__priority suggestion-card__priority--' + sg.category + '">' + escapeHtml(sg.priority) + '</div>' +
        '<div class="suggestion-card__title">' + escapeHtml(sg.title) + '</div>' +
      '</div>' +
      '<div class="suggestion-card__body">' +
        '<div class="suggestion-card__section">' +
          '<div class="suggestion-card__label">Problem</div>' +
          '<div class="suggestion-card__text">' + escapeHtml(sg.problem) + '</div>' +
        '</div>' +
        '<div class="suggestion-card__section">' +
          '<div class="suggestion-card__label">Theory (The Goal)</div>' +
          '<div class="suggestion-card__text">' + escapeHtml(sg.theory) + '</div>' +
        '</div>' +
        '<div class="suggestion-card__section">' +
          '<div class="suggestion-card__label">Solution</div>' +
          '<ol class="suggestion-card__steps">' + stepsHtml + '</ol>' +
        '</div>' +
      '</div>' +
      '<div class="suggestion-card__footer">' +
        '<div class="suggestion-card__impact">' + escapeHtml(sg.impact) + '</div>' +
        '<button class="suggestion-card__apply" data-suggestion-id="' + sg.id + '">Apply</button>' +
      '</div>';

    // Apply button handler
    const applyBtn = card.querySelector(".suggestion-card__apply");
    applyBtn.addEventListener("click", () => {
      // Apply changes → recompute simulation → updateResults() triggers:
      //   - KPI cards update
      //   - Station/Wagon/Loading metrics re-render
      //   - Suggestions badge recalculates
      //   - Drawer re-renders with fresh suggestions (since it's open)
      applySuggestion(sg);
    });

    body.appendChild(card);
  }
}

function applySuggestion(sg) {
  const changes = sg.apply;
  if (!changes) return;
  if (changes.wagonCount != null) ui.wagonCount.value = String(changes.wagonCount);
  if (changes.wagonSpeedMPerMin != null) ui.wagonSpeedMPerMin.value = String(changes.wagonSpeedMPerMin);
  if (changes.tolerancePct != null) ui.tolerancePct.value = String(changes.tolerancePct);
  if (changes.dwellPreset != null) {
    ui.dwellPreset.value = String(changes.dwellPreset);
    // Apply to all tanks
    for (const input of ui.tankTableBody.querySelectorAll("input")) input.value = String(changes.dwellPreset);
  }
  if (changes.loadTimeMin != null) ui.loadTimeMin.value = String(changes.loadTimeMin);
  if (changes.targetBph != null) ui.targetBph.value = String(changes.targetBph);
  if (changes.simHours != null) ui.simHours.value = String(changes.simHours);
  recomputeAndRender();
}

function initSuggestionsDrawer() {
  const btn = document.getElementById("suggestionsBtn");
  const drawer = document.getElementById("suggestionsDrawer");
  const overlay = document.getElementById("drawerOverlay");
  const closeBtn = document.getElementById("drawerCloseBtn");
  if (!btn || !drawer) return;

  function openDrawer() {
    renderSuggestions();
    drawer.hidden = false;
    if (overlay) overlay.hidden = false;
  }
  function closeDrawer() {
    drawer.hidden = true;
    if (overlay) overlay.hidden = true;
  }

  btn.addEventListener("click", () => {
    if (drawer.hidden) openDrawer(); else closeDrawer();
  });
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);
}

// ─── Glossary ────────────────────────────────────────────────
const GLOSSARY_DATA = [
  { section: "Key Metrics", term: "Throughput", tags: "baskets per hour bph production rate capacity output",
    def: "Number of baskets fully processed per hour (baskets/hr). This is the primary measure of line productivity.",
    cause: "Determined by the slowest step in the process — the bottleneck. Limited by tank dwell times, wagon speed, manual load/unload duration, and the number of wagons available.",
    effect: "Directly impacts production capacity and customer quotation. Higher throughput means more parts processed per shift, lower unit cost, and a stronger competitive position.",
    example: "A 12-tank line with 2-minute dwell, 1 wagon at 18 m/min achieves ~1.5 bph. Adding a second wagon might push it to 2.2 bph because the wagon was the bottleneck." },

  { section: "Key Metrics", term: "Avg Lead Time", tags: "cycle time total time duration processing time",
    def: "Average total time a basket spends inside the system — from the moment it enters the loading station to when it exits unloading.",
    cause: "Sum of all dwell times + travel times between tanks + manual loading/unloading + waiting time for busy wagons or occupied tanks. With contention, lead time grows beyond the theoretical minimum.",
    effect: "Longer lead times mean more work-in-progress (WIP) on the line, slower response to production changes, and more baskets simultaneously in chemical tanks.",
    example: "Theoretical minimum for 12 tanks at 2 min each + 10 min WDO + 20 min load + 10 min unload = ~64 minutes. Actual lead time of 82 minutes means ~18 minutes of waiting/contention." },

  { section: "Key Metrics", term: "Bottleneck", tags: "constraint limiting factor tank occupied wagon busy load unload",
    def: "The single constraint that most limits throughput. The simulator identifies it by counting how often each type of wait event occurs during the run.",
    cause: "Three bottleneck types: (1) Tank occupied — a basket is ready to move but the next tank already has a basket in it. Fix: reduce dwell time or add a parallel tank. (2) Wagon busy — no wagon is available to move a ready basket. Fix: add wagons or increase speed. (3) Load/Unload busy — the manual station is still processing another basket. Fix: reduce handling time or add a second station.",
    effect: "Resolving the bottleneck is the single most effective optimization. Improving any non-bottleneck step has little to no impact on throughput — the bottleneck still limits the system.",
    example: "If 'Wagon busy' has 425 wait events and 'Tank occupied' has 0, adding tanks won't help at all. Adding a second wagon or increasing wagon speed is the right lever." },

  { section: "Key Metrics", term: "Violations", tags: "over-dwell quality defect chemical tank timing window",
    def: "Over-dwell events — instances where a basket stayed in a chemical tank longer than the maximum allowed time (target dwell + tolerance).",
    cause: "The wagon couldn't pick up the basket in time because it was busy moving another basket. More common in early tanks (T1, T2) where baskets finish first while the wagon is serving later tanks. Also increases with fewer wagons and higher target throughput.",
    effect: "Chemical over-dwell causes surface quality defects: etching, discoloration, hydrogen embrittlement, or corrosion depending on the chemical. Water and rinse tanks are generally safe for over-dwell; acid, alkali, and chromating tanks are critical.",
    example: "T1 shows 8 violations with avg dwell of 3m26s vs target of 2m00s (±10% = max 2m12s). The worst basket stayed 1m14s over the limit — enough to cause visible surface marks on mild steel." },

  { section: "Key Metrics", term: "Wagon Utilization", tags: "busy idle percentage transport efficiency",
    def: "Percentage of total simulation time the wagon spends actively working (traveling to a basket, picking it up, moving it, dropping it) versus sitting idle waiting for a basket to become ready.",
    cause: "Driven by basket count, travel distances between tanks, lift/lower times, pick/drop times, and how many baskets overlap in the system.",
    effect: "High utilization (>85%) means the wagon is near saturation — any delay (e.g., a slow lift) will cascade into violations across the line. Low utilization (<40%) means the wagon has spare capacity and is not the bottleneck.",
    example: "W1 at 86% utilization with 'Wagon busy' as the bottleneck confirms the wagon is the constraint. At 61% utilization with 'Tank occupied' as bottleneck, adding wagons won't help." },

  { section: "Station Metrics", term: "Station Utilization", tags: "tank occupancy percentage busy time",
    def: "Percentage of simulation time a particular tank or station has a basket inside it (is occupied).",
    cause: "Depends on how long baskets dwell (target dwell time), how quickly the wagon delivers and removes baskets, and the overall throughput rate.",
    effect: "Near 100% utilization means the tank is always full — the next basket must wait, creating a 'tank occupied' bottleneck. Very low utilization (e.g., 4%) means the tank is rarely used and the process may not need that many tanks.",
    example: "T1 at 23% utilization and T3 at 29% suggests T3 has slightly longer effective dwell. If any tank hits >90%, it becomes a chokepoint and adding a duplicate tank would help." },

  { section: "Station Metrics", term: "Avg Dwell", tags: "actual dwell time measured immersion duration",
    def: "The actual average time baskets spent immersed in a tank during the simulation, measured from drop to pickup.",
    cause: "Should be close to the target dwell time. Exceeds target when the wagon is too busy to pick up on time (causing over-dwell). The gap between avg dwell and target dwell reveals how much contention exists at that station.",
    effect: "Avg dwell significantly above target indicates the wagon can't keep up — baskets are stuck waiting. This correlates directly with the violation count for that station.",
    example: "T1 with avg dwell 5m38s vs target 2m00s means baskets are sitting 3m38s longer than intended on average. Every one of those baskets likely has a violation." },

  { section: "Station Metrics", term: "Target Dwell", tags: "configured dwell recipe process time chemical",
    def: "The intended chemical process time for a tank — how long a basket should stay immersed, as configured in the recipe.",
    cause: "Set by the chemical process requirements. Different materials need different times: mild steel dismutting might need 2.5 min, aluminum chromating 1.5 min. The tolerance window (±%) defines the acceptable range around this target.",
    effect: "Longer target dwell times reduce throughput because each tank is occupied longer, giving the wagon more baskets to manage simultaneously. Reducing dwell (if the chemistry allows) is a powerful optimization lever.",
    example: "Changing all tanks from 2.5 min to 2.0 min dwell frees up 6 minutes per cycle (12 tanks x 0.5 min), which can increase throughput by 15-20%." },

  { section: "Configuration", term: "Load Time / Unload Time", tags: "manual handling loading unloading basket preparation",
    def: "Manual time required to load parts onto a basket at the loading station, or remove them at the unloading station. These are typically manual operations performed by operators.",
    cause: "Driven by part complexity (number of parts per basket, fixture difficulty), basket design (hooks, racks, fixtures), operator skill, and whether offline preparation is used.",
    effect: "Often a hidden bottleneck. If load time (e.g., 20 min) exceeds the total chemical cycle time (e.g., 12 tanks x 2 min = 24 min), the loading station sets the maximum throughput at 3 baskets/hr regardless of how fast wagons move.",
    example: "With 20 min load time, max throughput = 60/20 = 3 bph. Reducing load time to 15 min (via offline prep) raises the ceiling to 4 bph. If target is 2 bph, load time isn't the bottleneck yet." },

  { section: "Configuration", term: "Drip / Drag-out Time", tags: "chemical carry-over contamination pause lift",
    def: "Mandatory pause time after the wagon lifts a basket out of a tank, before it starts traveling to the next tank. This allows chemicals to drip off the parts back into the tank.",
    cause: "Required by the chemical process to minimize cross-contamination between tanks and reduce chemical loss. Duration depends on part geometry (flat vs complex shapes hold different amounts of liquid).",
    effect: "Adds to every single transfer operation. With 12 tanks, a 15-second drip time adds 12 x 15 = 180 seconds (3 minutes) to the total cycle. Reducing from 15s to 10s saves ~1 minute per basket.",
    example: "At 15s drip, total drip overhead per basket = 13 transfers x 15s = 195s (3m15s). Cutting to 10s saves 65 seconds per basket — about a 4% throughput improvement for free." },

  { section: "Configuration", term: "Wagon Speed", tags: "travel speed transport horizontal rail velocity",
    def: "Horizontal travel speed of the transporter wagon along the rail track, measured in meters per minute.",
    cause: "Limited by the mechanical design of the transporter: motor power, rail quality, load weight, and safety constraints. Typical range is 10–30 m/min for chemical processing lines.",
    effect: "Faster wagons reduce travel time between tanks. With a 12-tank line spanning ~20 meters, increasing from 10 to 18 m/min can cut total travel time per basket by nearly half, reducing lead time and preventing violations.",
    example: "At 10 m/min with 1.4m tank spacing, T1→T2 travel = 1400mm / (10000mm/60s) = 8.4s. At 18 m/min, same trip = 4.7s. Over 13 transfers, that saves ~48 seconds per basket." },

  { section: "Configuration", term: "Lift + Lower Time", tags: "vertical hoist raise lower immerse tank depth",
    def: "Combined time for the wagon to lift a basket out of one tank (raise) and lower it into the next tank (immerse). Includes the vertical travel in both directions.",
    cause: "Depends on tank depth, hoist motor speed, and basket weight. Deeper tanks and heavier baskets take longer. Typical range: 15–30 seconds combined.",
    effect: "Applied at every transfer — the wagon must lift at the source and lower at the destination. With 12 tanks, this operation happens ~26 times per basket (13 lift + 13 lower operations).",
    example: "At 20s lift+lower per transfer, total overhead = 13 transfers x 20s = 260s (4m20s). Reducing to 15s saves 65s per basket. This is often a mechanical constraint that's hard to change." },

  { section: "Configuration", term: "Pick + Drop Time", tags: "grab release clamp mechanism attachment",
    def: "Time for the wagon's grab mechanism to attach to a basket (pick) or release it (drop). Includes clamping, alignment, and safety confirmation.",
    cause: "Mechanical operation of the grab/clamp system. Automated grabs are faster (3–5s) than manual hook operations (10–15s).",
    effect: "Like lift+lower, this is multiplied across every transfer. Typically smaller than lift+lower but still compounds: 13 transfers x 10s = 130s (2m10s) per basket.",
    example: "Upgrading from manual hooks (12s) to automated grabs (5s) saves 7s per transfer x 13 = 91 seconds per basket — a meaningful improvement especially when the wagon is the bottleneck." },

  { section: "Configuration", term: "Tolerance (±%)", tags: "dwell window variation acceptable range chemical process",
    def: "The allowed variation around the target dwell time, expressed as a percentage. A 10% tolerance on a 2-minute target means 1m48s to 2m12s is acceptable.",
    cause: "Determined by the chemical process flexibility. Aggressive chemicals (strong acids) have tight tolerances (±5%). Mild processes (rinses, DM water) can tolerate ±20% or more.",
    effect: "Tighter tolerance = more violations, because the wagon has a smaller window to pick up each basket. Looser tolerance = fewer violations but potentially inconsistent surface treatment quality.",
    example: "At ±10%, a 2-min target gives a 24-second window (1m48s–2m12s). At ±20%, the window doubles to 48 seconds (1m36s–2m24s). Violations might drop from 39 to 5 with the wider window." },

  { section: "Configuration", term: "WDO (Water Dry-Off Oven)", tags: "drying oven heating moisture removal coating prep",
    def: "The Water Dry-Off Oven — a heated chamber at the end of the chemical process line. Baskets pass through to evaporate residual water before powder coating, painting, or assembly.",
    cause: "Required process step. Duration depends on part mass (heavier = more thermal mass), oven temperature, and moisture level. Typically 8–15 minutes.",
    effect: "The WDO is a single-slot resource — only one basket fits at a time. Long WDO times (10+ min) can become a bottleneck if throughput demand is high, since it blocks the station for the entire duration.",
    example: "WDO at 10 min with target 3 bph: the WDO can handle at most 6 baskets/hr (60/10), so it's not the bottleneck. But at target 7 bph, the WDO would need to be under 8.6 min or you need a second oven." },

  { section: "Configuration", term: "# Tanks", tags: "tank count stations process steps chemical baths",
    def: "Number of chemical process tanks in the line between loading and the WDO. Each tank represents one step in the pretreatment recipe (degreasing, rinsing, chromating, etc.).",
    cause: "Determined by the chemical process recipe. More complex surface treatments require more tanks. Typical range: 6–20 tanks.",
    effect: "More tanks = longer travel distance for the wagon, more transfers per basket, and longer lead time. But each individual tank has lower utilization, which reduces 'tank occupied' bottlenecks.",
    example: "12 tanks at 1.4m spacing = 16.8m line. The wagon travels this distance multiple times per basket. Adding a 13th tank adds ~2 min dwell + 2 transfers to each basket's cycle." },

  { section: "Configuration", term: "# Wagons", tags: "wagon count transporter multi-wagon zones",
    def: "Number of rail-mounted transporter wagons operating on the line. Multiple wagons divide the tank range into zones, each wagon serving its zone.",
    cause: "Added when a single wagon can't keep up with demand — i.e., when 'Wagon busy' is the identified bottleneck.",
    effect: "More wagons reduce wait times and violations because baskets get picked up sooner. But wagons cost money and add complexity (zone handover, collision avoidance).",
    example: "1 wagon at 86% utilization with 75 violations. Adding a 2nd wagon drops utilization to ~50% each and violations to near zero, while throughput increases from 1.3 to 2.4 bph." },

  { section: "Configuration", term: "Recipe Preset", tags: "mild steel aluminum custom material process",
    def: "Pre-configured dwell time profiles for common materials. Mild Steel (MS) uses 2.5 min/tank, Aluminum (AL) uses 1.5 min/tank. Custom allows per-tank overrides.",
    cause: "Different materials require different chemical processing times. Mild steel needs longer degreasing and phosphating. Aluminum needs shorter but more sensitive chromating.",
    effect: "Choosing the right preset ensures the simulation reflects realistic processing conditions. Using the wrong preset will produce misleading throughput and violation numbers.",
    example: "Switching from MS (2.5 min) to AL (1.5 min) reduces total dwell by 12 minutes for a 12-tank line, potentially increasing throughput by 30-40%." },

  { section: "Configuration", term: "Target Throughput", tags: "baskets per hour goal quotation demand",
    def: "The desired number of baskets processed per hour. This is the production rate you want to achieve or quote to the customer.",
    cause: "Set by customer demand, production planning, or competitive benchmarking. The simulation compares achieved throughput against this target.",
    effect: "The delta between target and achieved throughput (shown as %) indicates whether the proposed line design can meet demand. A negative delta means the design needs optimization.",
    example: "Target 3.0 bph, achieved 1.33 bph = -55.7% delta. The line design fundamentally cannot meet demand without changes (more wagons, faster speed, shorter dwell)." },

  { section: "Configuration", term: "Simulation Duration", tags: "sim hours run time steady state warm up",
    def: "How many hours of plant operation to simulate. Longer runs produce more accurate steady-state throughput numbers.",
    cause: "The first few baskets always take longer because the line starts empty (warm-up bias). Longer durations dilute this effect and reveal true steady-state performance.",
    effect: "At 1 hour with 2 bph target, only ~2 baskets complete — too few for reliable statistics. At 4 hours, ~8 baskets complete, giving better throughput and violation estimates.",
    example: "A 1-hour sim might show 2.5 bph (optimistic, warm-up bias). A 4-hour sim of the same config shows 1.8 bph (realistic steady-state). Always use 2+ hours for quotations." },

  { section: "Configuration", term: "Distance Model", tags: "manhattan euclidean rail straight line travel",
    def: "How travel distance between stations is calculated. Manhattan (rail) assumes right-angle movement along tracks. Euclidean (straight-line) assumes direct point-to-point travel.",
    cause: "Rail-based transporter systems move along tracks — they can't cut diagonally. Manhattan distance is more realistic for rail systems. Euclidean gives optimistic (shorter) distances.",
    effect: "Manhattan distances are typically 20-40% longer than Euclidean for the same layout, resulting in longer travel times and lower throughput estimates.",
    example: "Two tanks diagonally offset by 5m horizontal and 3m vertical: Euclidean = 5.8m, Manhattan = 8m. At 18 m/min, that's 19s vs 27s travel time — an 8-second difference per transfer." },

  { section: "Loading & Queue", term: "Avg Queue Wait", tags: "loading queue waiting time delay arrival",
    def: "Average time a basket waits in the loading queue before an operator begins loading it. Measured from basket arrival to the start of the loading operation.",
    cause: "Baskets arrive at the target rate (baskets/hr), but loading processes one basket at a time. If a basket arrives while another is being loaded, it queues. The wait grows when arrival rate approaches or exceeds loading capacity.",
    effect: "Long queue waits indicate loading is the bottleneck. Strategies to reduce it: offline basket preparation, faster loading fixtures, or adding a second loading station.",
    example: "At 3 bph target with 20 min load time: one basket every 20 min, load takes 20 min = 100% loading utilization, queue grows continuously. Reducing load to 15 min gives breathing room." },

  { section: "Loading & Queue", term: "Max Queue Depth", tags: "peak queue staging space baskets waiting",
    def: "The highest number of baskets waiting simultaneously at the loading station at any point during the simulation.",
    cause: "Spikes when the arrival rate temporarily exceeds loading capacity, or when loading takes longer than the inter-arrival time. In steady state, if loading is the bottleneck, queue depth grows continuously.",
    effect: "Determines how much physical staging space is needed at the loading area. Also indicates how many pre-prepared baskets you need available. High max depth = need more floor space.",
    example: "Max queue depth of 5 means at peak, 5 baskets were waiting. If each basket is 2m x 1m, you need at least 10 sq meters of staging area plus operator access paths." },

  { section: "Loading & Queue", term: "Loading Utilization", tags: "loading station busy percentage capacity",
    def: "Percentage of simulation time the loading station is actively processing a basket (operator is loading parts).",
    cause: "Function of load time and basket arrival rate. At target 3 bph with 20 min load time: loading is busy 60 min/hr = 100%.",
    effect: "Near 100% means the loading station is at capacity. Above ~85%, any variability (slow operator, difficult parts) causes queue buildup. This is the ceiling on throughput.",
    example: "Loading util at 95% with load time 20 min. The max throughput this station can sustain = 60/20 = 3 bph. To push beyond 3 bph, you must reduce load time or add a parallel station." },

  { section: "Loading & Queue", term: "Baskets Loaded", tags: "completed count processed total",
    def: "Total number of baskets that were loaded during the simulation. This is the count of baskets that entered the system (not necessarily completed).",
    cause: "Determined by the target arrival rate and simulation duration. At 2 bph for 2 hours, approximately 4 baskets are loaded.",
    effect: "Higher basket count gives more statistically reliable simulation results. Very low counts (1-2) make throughput estimates unreliable.",
    example: "4 baskets loaded in 2 hours at 2 bph target. If only 3 completed (1 still in system at simulation end), achieved throughput is calculated from the 3 completed baskets." },

  { section: "Simulation Concepts", term: "Scenario Compare", tags: "comparison baseline alternative what-if analysis",
    def: "Feature to save simulation results as named scenarios (A, B) and compare them side-by-side. Shows how parameter changes affect throughput, lead time, violations, and bottleneck.",
    cause: "Engineers need to evaluate alternatives: 'What if we add a wagon?', 'What if we reduce dwell?', 'What if we speed up loading?'. Scenario comparison quantifies the impact.",
    effect: "Enables data-driven design decisions. Instead of guessing which optimization is most impactful, compare actual simulation results across configurations.",
    example: "Scenario A: 1 wagon, 1.3 bph, 75 violations. Scenario B: 2 wagons, 2.4 bph, 0 violations. The second wagon nearly doubles throughput and eliminates all quality risk." },

  { section: "Simulation Concepts", term: "Basket", tags: "workpiece carrier load parts hanger fixture",
    def: "A carrier (rack, frame, or fixture) that holds parts during chemical processing. Baskets are loaded with parts, transported through tanks by the wagon, and unloaded at the end.",
    cause: "The fundamental unit of production. Each basket carries a payload of parts (typically 500 kg to 2 tons). The basket moves through the entire recipe sequence as a single unit.",
    effect: "Basket throughput (baskets/hr) multiplied by basket payload gives production throughput (kg/hr). Larger baskets = fewer cycles needed but longer load times.",
    example: "At 2 bph with 800 kg/basket = 1,600 kg/hr. Over an 8-hour shift = 12,800 kg/shift. Customer needs 10,000 kg/shift, so 2 bph with 800 kg baskets meets the requirement with 28% margin." },

  { section: "Simulation Concepts", term: "Cycle Time", tags: "single basket total time one cycle complete process",
    def: "Total time for a single basket to complete the entire process from start of loading to end of unloading. Related to but different from lead time — cycle time is for one specific basket, lead time is the average.",
    cause: "Sum of: load time + (travel + lift + lower + drip + dwell) for each tank + WDO time + unload time + any waiting.",
    effect: "The theoretical minimum cycle time (no contention) sets the upper bound on throughput: max_bph = 60 / cycle_time_minutes. Actual throughput is lower due to contention.",
    example: "Theoretical cycle = 20min load + 12x(2min dwell + 30s handling + 15s drip + 5s travel) + 10min WDO + 10min unload = ~72 min. Max theoretical = 60/72 = 0.83 bph per basket slot." },

  { section: "Simulation Concepts", term: "Discrete-Event Simulation (DES)", tags: "simulation engine event loop model",
    def: "The computational method used by Flowlytics. Instead of simulating every second, it jumps between significant events (basket arrives, dwell complete, wagon available) making it fast and accurate.",
    cause: "DES is the standard method for modeling manufacturing systems with shared resources (wagons, tanks) and queuing behavior.",
    effect: "Produces accurate throughput, utilization, and violation metrics that account for real contention between multiple baskets competing for the same wagon and tanks.",
    example: "A 2-hour simulation with 4 baskets generates ~200 events (arrivals, pickups, drops, dwell completions). The event loop processes these in <100ms, much faster than second-by-second simulation." },

  { section: "Layout", term: "DXF / DWG File", tags: "autocad drawing layout floor plan factory cad",
    def: "AutoCAD drawing files containing the factory floor plan with station positions. DXF is an open exchange format readable in the browser. DWG is the native AutoCAD format requiring server-side conversion.",
    cause: "Factory layouts are designed in AutoCAD. The drawing contains text labels (HANGER LOADING, WDO, PROCESS TANK ZONE, etc.) with x,y coordinates that define real station positions.",
    effect: "Loading a DXF/DWG file gives the simulator accurate real-world distances between stations, making travel time calculations and throughput estimates much more reliable than the synthetic layout.",
    example: "A synthetic layout assumes 1.4m spacing. The real factory DXF might show 2.1m spacing with the WDO offset 3m to the side — significantly changing travel times and wagon utilization." },

  { section: "Layout", term: "Synthetic Layout", tags: "generated auto default straight line demo",
    def: "An auto-generated straight-line layout used when no CAD file is available. Places stations in a row with 1.4m spacing: LOAD → T1..T12 → WDO → UNLOAD.",
    cause: "Used for early-stage estimates before the factory CAD drawing is ready, or for quick what-if analysis where exact distances don't matter.",
    effect: "Gives approximate but not accurate travel distances. Useful for comparing recipes and wagon configurations, but not for final quotation accuracy.",
    example: "Synthetic 12-tank layout total line length ≈ 25m. Real factory layout might be 35m with bends — leading to 40% longer travel times than the synthetic estimate." },

  { section: "Layout", term: "Anchor Labels", tags: "hanger loading unloading process tank zone wdo pco",
    def: "Specific text labels in the DXF file that the simulator recognizes as key station positions: HANGER LOADING, HANGER UNLOADING, WDO, PROCESS TANK ZONE, PCO.",
    cause: "These labels are placed by the CAD designer on the factory drawing. The simulator extracts their x,y coordinates to position stations in the simulation model.",
    effect: "If all 5 anchor labels are found, the layout uses real factory positions. If any are missing, the simulator falls back to synthetic positioning for the missing stations.",
    example: "DXF with HANGER LOADING at (733632, 78792) and HANGER UNLOADING at (754211, 80136) gives a real distance of ~20.6m between load and unload stations." },

  { section: "Materials", term: "Mild Steel (MS)", tags: "low carbon steel iron alloy AISI 1018 1020 material preset",
    def: "Low-carbon steel (typically AISI 1018/1020), the most common material processed through pretreatment lines. An alloy of iron with less than 0.25% carbon content. 'MS' is the standard industry abbreviation.",
    cause: "Mild steel requires a multi-step pretreatment to prevent corrosion and prepare the surface for coating: degreasing to remove oils, rinsing, phosphating to create a protective conversion layer, further rinsing, and drying. Each chemical step needs longer dwell times compared to aluminum because the oxide layer is thicker and harder to treat.",
    effect: "The MS preset uses 2.5 min/tank dwell time. With 12 tanks, total chemical dwell is 30 minutes per basket. This longer cycle reduces throughput compared to aluminum but produces a robust phosphate coating essential for paint adhesion and corrosion resistance on steel parts.",
    example: "A typical mild steel pretreatment recipe: T1=3min (alkaline degreasing), T2=2min (rinse), T3=3min (activation), T4=5min (zinc phosphating), T5=2min (rinse), T6=2min (DM water rinse), then WDO. Total chemical time ~17 min before drying." },

  { section: "Materials", term: "Aluminum (AL)", tags: "aluminium alloy chromating anodizing light metal material preset",
    def: "Aluminum alloys used in automotive, aerospace, and consumer goods. Lighter than steel, naturally forms a thin oxide layer, but requires chemical pretreatment (chromating or non-chrome alternatives) for coating adhesion and corrosion protection.",
    cause: "Aluminum is chemically sensitive — it reacts faster than steel in acid/alkali baths. Pretreatment steps are shorter because over-dwell in aggressive chemicals can dissolve the surface (etching), cause discoloration, or create hydrogen embrittlement. The process typically uses chromating or zirconium-based conversion coatings instead of phosphating.",
    effect: "The AL preset uses 1.5 min/tank dwell time. With 12 tanks, total chemical dwell is 18 minutes — 12 minutes less than mild steel. This means higher throughput potential, but the tighter process tolerance makes violations more critical. A 30-second over-dwell in a chromating tank can visibly damage the surface.",
    example: "A typical aluminum pretreatment recipe: T1=2min (mild alkaline clean), T2=1min (rinse), T3=1.5min (chromating), T4=1min (rinse), T5=1min (DM water). Total chemical time ~6.5 min. Faster cycle but zero tolerance for over-dwell in T3." },
];

function renderGlossary(query) {
  const body = document.getElementById("glossaryBody");
  const countEl = document.getElementById("glossaryCount");
  if (!body) return;
  body.innerHTML = "";

  const q = (query || "").trim().toLowerCase();
  let filtered = GLOSSARY_DATA;
  if (q) {
    filtered = GLOSSARY_DATA.filter((entry) => entry.term.toLowerCase().includes(q));
  }

  if (countEl) {
    countEl.textContent = q ? filtered.length + " of " + GLOSSARY_DATA.length + " terms" : GLOSSARY_DATA.length + " terms";
  }

  // Group by section
  const sections = new Map();
  for (const entry of filtered) {
    if (!sections.has(entry.section)) sections.set(entry.section, []);
    sections.get(entry.section).push(entry);
  }

  for (const [sectionName, entries] of sections) {
    const sec = document.createElement("div");
    sec.className = "glossary-section";
    const title = document.createElement("div");
    title.className = "glossary-section__title";
    title.textContent = sectionName;
    sec.appendChild(title);

    for (const e of entries) {
      const card = document.createElement("div");
      card.className = "glossary-entry";
      let html = '<div class="glossary-entry__term">' + escapeHtml(e.term) + '</div>';
      html += '<div class="glossary-entry__def">' + escapeHtml(e.def) + '</div>';
      html += '<div class="glossary-entry__section"><strong>Cause:</strong> ' + escapeHtml(e.cause) + '</div>';
      html += '<div class="glossary-entry__section"><strong>Effect:</strong> ' + escapeHtml(e.effect) + '</div>';
      html += '<div class="glossary-entry__section"><strong>Example:</strong> ' + escapeHtml(e.example) + '</div>';
      card.innerHTML = html;
      sec.appendChild(card);
    }
    body.appendChild(sec);
  }

  if (filtered.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No matching terms found for "' + escapeHtml(q) + '"</div>';
  }
}

function initGlossary() {
  const btn = document.getElementById("glossaryBtn");
  const overlay = document.getElementById("glossaryOverlay");
  const closeBtn = document.getElementById("glossaryCloseBtn");
  const searchInput = document.getElementById("glossarySearch");
  if (!btn || !overlay || !closeBtn) return;

  btn.addEventListener("click", () => {
    overlay.hidden = false;
    renderGlossary("");
    if (searchInput) { searchInput.value = ""; searchInput.focus(); }
  });
  closeBtn.addEventListener("click", () => { overlay.hidden = true; });

  // Search with debounce
  let searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderGlossary(searchInput.value), 150);
    });
  }

  // Close on Escape
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") overlay.hidden = true;
  });
}

// ─── Init ────────────────────────────────────────────────────
function initUi() {
  rebuildTankTable(Number(ui.tankCount.value), Number(ui.dwellPreset.value));

  // Tab switching
  document.querySelectorAll(".metrics-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });

  // Recipe inputs
  ui.tankCount.addEventListener("input", () => {
    rebuildTankTable(Number(ui.tankCount.value), Number(ui.dwellPreset.value));
    if (ui.autoRun.checked) recomputeAndRender();
  });
  ui.recipePreset.addEventListener("change", () => {
    const preset = ui.recipePreset.value;
    let dwell = Number(ui.dwellPreset.value);
    if (preset === "ms") dwell = 2.5;
    if (preset === "al") dwell = 1.5;
    ui.dwellPreset.value = String(dwell);
    if (preset !== "custom") rebuildTankTable(Number(ui.tankCount.value), dwell);
    if (ui.autoRun.checked) recomputeAndRender();
  });
  ui.applyDwellBtn.addEventListener("click", () => {
    const dwell = Number(ui.dwellPreset.value);
    for (const input of ui.tankTableBody.querySelectorAll("input")) input.value = String(dwell);
    if (ui.autoRun.checked) recomputeAndRender();
  });

  // All config inputs → auto-run
  for (const id of ["wdoTimeMin", "loadTimeMin", "unloadTimeMin", "tolerancePct", "dripTimeSec", "targetBph", "simHours", "wagonSpeedMPerMin", "liftLowerSec", "pickDropSec", "wagonCount", "distanceMode", "layoutMode"]) {
    el(id).addEventListener("input", () => { if (ui.autoRun.checked) recomputeAndRender(); });
  }
  ui.simSpeed2.addEventListener("input", () => {
    if (state.params) state.params.simSpeed = Math.max(0.25, Number(ui.simSpeed2.value));
  });

  // Playback
  ui.playPauseBtn.addEventListener("click", () => {
    if (!state.plan) recomputeAndRender();
    if (state.anim.running) pauseAnim(); else startAnim();
  });
  ui.resetPlayheadBtn.addEventListener("click", () => { pauseAnim(); state.anim.timeSec = 0; state.anim.lastTs = null; ui.scrub.value = "0"; renderFrame(); });
  ui.stepBackBtn.addEventListener("click", () => {
    pauseAnim(); const total = state.sim?.simEnd ?? state.plan?.cycleSeconds ?? 0;
    state.anim.timeSec = clamp(state.anim.timeSec - 10, 0, total);
    ui.scrub.value = String(Math.round((1000 * state.anim.timeSec) / Math.max(1, total))); renderFrame();
  });
  ui.stepFwdBtn.addEventListener("click", () => {
    pauseAnim(); const total = state.sim?.simEnd ?? state.plan?.cycleSeconds ?? 0;
    state.anim.timeSec = clamp(state.anim.timeSec + 10, 0, total);
    ui.scrub.value = String(Math.round((1000 * state.anim.timeSec) / Math.max(1, total))); renderFrame();
  });
  ui.scrub.addEventListener("input", () => {
    pauseAnim(); const total = state.sim?.simEnd ?? state.plan?.cycleSeconds ?? 0;
    state.anim.timeSec = clamp((Number(ui.scrub.value) / 1000) * total, 0, total); renderFrame();
  });

  // DXF
  ui.fetchDxfBtn.addEventListener("click", () => fetchDxfFiles());
  ui.loadFilesBtn.addEventListener("click", () => { ui.filePicker.value = ""; ui.filePicker.click(); });
  ui.filePicker.addEventListener("change", (e) => { if (e.target.files?.length) handlePickedFiles(e.target.files); });

  // Canvas controls
  function zoomByFactor(factor) {
    const t = state.view.transform;
    const cx = (state.view.viewport.w || 400) / 2;
    const cy = (state.view.viewport.h || 200) / 2;
    state.view.transform = {
      scale: t.scale * factor,
      tx: cx - (cx - t.tx) * factor,
      ty: cy - (cy - t.ty) * factor,
    };
    renderFrame();
  }

  ui.zoomToFitBtn.addEventListener("click", () => { zoomToFit(); renderFrame(); });
  document.getElementById("zoomInBtn")?.addEventListener("click", () => zoomByFactor(1.4));
  document.getElementById("zoomOutBtn")?.addEventListener("click", () => zoomByFactor(1 / 1.4));
  ui.toggleLabelsBtn.addEventListener("click", () => { state.view.showLabels = !state.view.showLabels; renderFrame(); });

  // Fullscreen
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const simPreviewEl = document.getElementById("simPreview");
  if (fullscreenBtn && simPreviewEl) {
    fullscreenBtn.addEventListener("click", () => {
      const body = simPreviewEl.querySelector(".sim-preview__body");
      const target = body || simPreviewEl;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        target.requestFullscreen().then(() => setTimeout(resizeCanvas, 100));
      }
    });
    document.addEventListener("fullscreenchange", () => {
      setTimeout(resizeCanvas, 100);
    });
  }

  // Zoom (mouse wheel) and Pan (mouse drag)
  ui.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = ui.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const t = state.view.transform;
    // Zoom around mouse position
    const newScale = t.scale * factor;
    state.view.transform = {
      scale: newScale,
      tx: mouseX - (mouseX - t.tx) * factor,
      ty: mouseY - (mouseY - t.ty) * factor,
    };
    renderFrame();
  }, { passive: false });

  let panState = null;
  ui.canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    panState = { startX: e.clientX, startY: e.clientY, tx: state.view.transform.tx, ty: state.view.transform.ty };
  });
  window.addEventListener("mousemove", (e) => {
    if (!panState) return;
    const dx = e.clientX - panState.startX;
    const dy = e.clientY - panState.startY;
    state.view.transform.tx = panState.tx + dx;
    state.view.transform.ty = panState.ty + dy;
    renderFrame();
  });
  window.addEventListener("mouseup", () => { panState = null; });

  // Hover
  ui.canvas.addEventListener("mouseleave", () => { hideHoverTip(); panState = null; });
  ui.canvas.addEventListener("mousemove", (e) => {
    if (panState) return; // don't show tooltips while panning
    const rect = ui.canvas.getBoundingClientRect();
    const node = hitTestNode(e.clientX - rect.left, e.clientY - rect.top);
    if (!node) return hideHoverTip();
    const dwell = dwellForNodeId(node.id);
    const kind = node.type === "tank" ? "Tank" : node.id === "WDO" ? "Drying Oven" : "Station";
    const dwellLine = dwell != null ? `<div class="muted">Time: <b>${escapeHtml(formatSeconds(dwell))}</b></div>` : "";
    let vio = "";
    if (state.sim?.violations?.length) {
      const byStep = state.sim.violations.filter((v) => v.step === node.id);
      if (byStep.length) {
        const worst = Math.max(...byStep.map((v) => v.seconds || 0));
        vio = `<div class="muted">Violations: <b>${byStep.length}</b> (worst +${escapeHtml(formatTimeShort(worst))})</div>`;
      }
    }
    // Station util
    let utilLine = "";
    const stUtil = state.sim?.util?.stations?.find((s) => s.id === node.id);
    if (stUtil) utilLine = `<div class="muted">Util: <b>${formatPct01(stUtil.util01)}</b></div>`;
    showHoverTip(e.clientX, e.clientY,
      `<div><b>${escapeHtml(node.id)}</b> <span class="muted">(${escapeHtml(kind)})</span></div>` +
      dwellLine + utilLine + vio
    );
  });

  // Scenarios
  ui.saveScenarioABtn.addEventListener("click", () => {
    if (!state.params || !state.sim) return;
    state.scenarioA = summarizeScenario(state.params, state.sim);
    renderScenarioCompare();
  });
  ui.saveScenarioBBtn.addEventListener("click", () => {
    if (!state.params || !state.sim) return;
    state.scenarioB = summarizeScenario(state.params, state.sim);
    renderScenarioCompare();
  });
  ui.clearScenariosBtn.addEventListener("click", () => {
    state.scenarioA = null; state.scenarioB = null; renderScenarioCompare();
  });

  // Export (button may not exist)
  if (ui.exportSummaryBtn) {
    ui.exportSummaryBtn.addEventListener("click", async () => {
      const text = exportSummaryText();
      const ok = await copyToClipboard(text);
      if (ok) { ui.exportSummaryBtn.textContent = "Copied!"; setTimeout(() => (ui.exportSummaryBtn.textContent = "Export"), 1500); }
      else { ui.summaryInline.hidden = false; ui.summaryText.value = text; }
    });
  }
  ui.summarySelectBtn.addEventListener("click", () => { ui.summaryText.focus(); ui.summaryText.select(); });
  ui.summaryHideBtn.addEventListener("click", () => { ui.summaryInline.hidden = true; });

  // Glossary
  initGlossary();
  initSuggestionsDrawer();

  // Theme toggle
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    // Restore saved preference
    const saved = localStorage.getItem("flowlytics-theme");
    if (saved === "light") document.documentElement.classList.add("light");
    themeBtn.textContent = document.documentElement.classList.contains("light") ? "\u2600" : "\u263E";

    themeBtn.addEventListener("click", () => {
      const isLight = document.documentElement.classList.toggle("light");
      themeBtn.textContent = isLight ? "\u2600" : "\u263E";
      localStorage.setItem("flowlytics-theme", isLight ? "light" : "dark");
    });
  }

  // Simulation preview toggle — resize canvas when opened
  const simPreview = document.getElementById("simPreview");
  if (simPreview) {
    simPreview.addEventListener("toggle", () => {
      if (simPreview.open) setTimeout(resizeCanvas, 50);
    });
  }

  // Canvas resize
  function resizeCanvas() {
    const rect = ui.canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return; // not visible yet
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(300, rect.width); const cssH = Math.max(120, rect.height);
    ui.canvas.width = Math.floor(cssW * dpr); ui.canvas.height = Math.floor(cssH * dpr);
    state.view.viewport = { w: cssW, h: cssH, dpr };
    const ctx = ui.canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    zoomToFit(); renderFrame();
  }
  state._resizeCanvas = resizeCanvas;
  let resizeTimer = null;
  window.addEventListener("resize", () => { if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(resizeCanvas, 150); });

  resizeCanvas();
}

initUi();
recomputeAndRender();
resetAnim();
updatePlayPauseLabel();
initStartupModal();
