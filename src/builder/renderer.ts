import { Builder, STEP_COUNT, STATION_STEP, TRANSPORT_STEP, SETTINGS_STEP, REVIEW_STEP } from "./builder";
import { lineConfigToLayout } from "./LineConfig";
import type { ArticleMaterialType, TankType } from "./LineConfig";
import { MATERIALS } from "../materials/data";
import { saveDraft, loadDraft, clearDraft } from "./persistence";
import { recomputeAndRender } from "../ui/config";
import { state } from "../ui/state";
import { minutesToSeconds, secondsToMinutes } from "../utils";


const STEP_LABELS = ["Stations", "Transport", "Settings", "Review"];

let builder: Builder;
let abortController: AbortController | null = null;

export function initBuilder(): void {
  // Clean up previous listeners if re-initializing
  if (abortController) abortController.abort();
  abortController = new AbortController();

  const draft = loadDraft();
  builder = draft ? new Builder(draft.config) : new Builder();
  if (draft) builder.currentStep = draft.currentStep;

  showModal();
  renderStepIndicator();
  renderCurrentStep();
  wireNavButtons();
  wireListeners(abortController.signal);
}

function showModal(): void {
  const modal = document.getElementById("builderModal");
  if (modal) modal.removeAttribute("hidden");
}

function hideModal(): void {
  clearDraft();
  const modal = document.getElementById("builderModal");
  if (modal) modal.setAttribute("hidden", "");
}

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element: ${id}`);
  return e as unknown as T;
}

function renderStepIndicator(): void {
  const container = document.getElementById("stepIndicator");
  if (!container) return;
  container.innerHTML = "";
  container.className = "wizard-steps";
  for (let i = 0; i < STEP_COUNT; i++) {
    const step = document.createElement("div");
    step.className = "wizard-step" + (i === builder.currentStep ? " wizard-step--active" : i < builder.currentStep ? " wizard-step--done" : "");
    const num = document.createElement("span");
    num.className = "wizard-step__num";
    num.textContent = String(i + 1);
    step.appendChild(num);
    const label = document.createElement("span");
    label.className = "wizard-step__label";
    label.textContent = STEP_LABELS[i];
    step.appendChild(label);
    container.appendChild(step);
    if (i < STEP_COUNT - 1) {
      const conn = document.createElement("div");
      conn.className = "wizard-step__connector";
      container.appendChild(conn);
    }
  }
}

function renderCurrentStep(): void {
  for (let i = 0; i < STEP_COUNT; i++) {
    const el = document.getElementById(`builderStep${i + 1}`);
    if (el) el.hidden = i !== builder.currentStep;
  }
  const content = document.getElementById(`stepContent${builder.currentStep + 1}`);
  if (!content) return;
  content.innerHTML = "";

  switch (builder.currentStep) {
    case STATION_STEP:
      renderStationStep(content);
      break;
    case TRANSPORT_STEP:
      renderTransportStep(content);
      break;
    case SETTINGS_STEP:
      renderSettingsStep(content);
      break;
    case REVIEW_STEP:
      renderReviewStep(content);
      break;
  }
  updateNavButtons();
}

function updateNavButtons(): void {
  const nextBtn = document.getElementById(`builderNext${builder.currentStep + 1}`);
  if (nextBtn) {
    (nextBtn as HTMLButtonElement).disabled = !builder.canGoNext();
  }
}

// ─── Step 1: Stations ────────────────────────────────────────

function stationTypeOptions(selected?: TankType): string {
  const types: { value: string; label: string }[] = [
    { value: "chemical", label: "Chemical" },
    { value: "rinse", label: "Rinse" },
    { value: "extra", label: "Extra" },
  ];
  return types.map((t) => `<option value="${t.value}"${t.value === selected ? " selected" : ""}>${t.label}</option>`).join("");
}

function renderStationStep(container: HTMLElement): void {
  const stations = builder.config.stations;

  // Article material
  const matOptions = MATERIALS.map((m) => `<option value="${m.type}"${m.type === builder.config.settings.articleMaterialType ? " selected" : ""}>${m.label}</option>`).join("");
  container.innerHTML = `
    <div class="wizard-page__intro">
      <div class="wizard-page__title">Station Sequence</div>
      <div class="wizard-page__desc">Configure the type and parameters for each station in the line.</div>
    </div>
    <div class="wizard-field">
      <label class="wizard-field__label">Article Material</label>
      <input id="bldrMaterial" class="field__control wizard-field__input" list="bldrMaterialList" value="${builder.config.settings.articleMaterialType}" style="width:100%;font-size:13px" />
      <datalist id="bldrMaterialList">${matOptions}</datalist>
    </div>
    <div class="lane-builder" id="laneBuilder"></div>
  `;

  // Build the lane
  const lane = el("laneBuilder");
  lane.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px;";

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (s.kind === "tank") {
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid var(--border2);border-radius:8px;padding:10px;background:rgba(10,14,22,0.5);min-width:140px;";
      const isExtra = s.tankType === "extra";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="font-size:12px;">${s.id}</strong>
          <button class="btn-remove-tank" data-index="${i}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:2px 4px;" title="Remove tank">&times;</button>
        </div>
        <select class="bldr-type" data-index="${i}" style="width:100%;margin-bottom:4px;font-size:11px;padding:3px 4px;">
          ${stationTypeOptions(s.tankType)}
        </select>
        <div style="display:flex;gap:4px;align-items:center;" ${isExtra ? 'hidden' : ''}>
          <input class="bldr-dwell" data-index="${i}" type="number" min="0" step="0.5" value="${secondsToMinutes(s.dwellSec)}" style="width:60px;font-size:12px;padding:3px 4px;" />
          <span style="font-size:11px;color:var(--muted);">min</span>
        </div>
        <div class="bldr-tol-row" style="display:flex;gap:4px;align-items:center;margin-top:4px;" ${isExtra ? 'hidden' : ''}>
          <span style="font-size:11px;color:var(--muted);">&plusmn;</span>
          <input class="bldr-tol" data-index="${i}" type="number" min="0" max="50" step="1" value="${((s.tolerancePct ?? 0.1) * 100).toFixed(0)}" style="width:50px;font-size:12px;padding:3px 4px;" />
          <span style="font-size:11px;color:var(--muted);">%</span>
        </div>
      `;
      lane.appendChild(card);
    } else if (s.kind === "wdo") {
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid var(--border2);border-radius:8px;padding:10px;background:rgba(112,240,184,0.08);min-width:140px;";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="font-size:12px;color:var(--accent2);">WDO</strong>
          <button id="bldrRemoveWdo" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:2px 4px;" title="Remove WDO">&times;</button>
        </div>
        <div style="font-size:11px;color:var(--muted);">Drying Oven</div>
        <div style="display:flex;gap:4px;align-items:center;margin-top:4px;">
          <input id="bldrWdoDryTime" type="number" min="0" step="0.5" value="${secondsToMinutes(s.dwellSec)}" style="width:60px;font-size:12px;padding:3px 4px;" />
          <span style="font-size:11px;color:var(--muted);">drying min</span>
        </div>
      `;
      lane.appendChild(card);
    } else {
      // LOAD or UNLOAD — fixed endpoints
      const isLoad = s.kind === "loading";
      const card = document.createElement("div");
      card.style.cssText = `border:1px solid var(--border2);border-radius:8px;padding:10px;background:rgba(74,163,255,0.08);min-width:120px;`;
      card.innerHTML = `
        <strong style="font-size:12px;color:var(--accent);">${s.id}</strong>
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${isLoad ? "Loading" : "Unloading"}</div>
        <div style="display:flex;gap:4px;align-items:center;">
          <input class="bldr-station-time" data-kind="${s.kind}" type="number" min="0" step="0.5" value="${secondsToMinutes(s.dwellSec)}" style="width:60px;font-size:12px;padding:3px 4px;" />
          <span style="font-size:11px;color:var(--muted);">min</span>
        </div>
      `;
      lane.appendChild(card);
    }

    // Add button between stations (after LOAD, before UNLOAD)
    if (i < stations.length - 1 && s.kind !== "wdo" && stations[i + 1].kind !== "wdo") {
      const addBtn = document.createElement("button");
      addBtn.className = "btn-add-tank";
      addBtn.setAttribute("data-after", String(i));
      addBtn.textContent = "+";
      addBtn.style.cssText = "width:28px;height:28px;border-radius:50%;border:1.5px dashed var(--border2);background:transparent;color:var(--muted);cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
      lane.appendChild(addBtn);
    }
  }

  // Load/unload time fields
  const load = builder.config.stations.find((s) => s.kind === "loading");
  const unload = builder.config.stations.find((s) => s.kind === "unloading");
  const bottomRow = document.createElement("div");
  bottomRow.style.cssText = "display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;";
  bottomRow.innerHTML = `
    <div class="wizard-field" style="margin-bottom:0;">
      <label class="wizard-field__label">Load time (min)</label>
      <input id="bldrLoadTime" class="field__control wizard-field__input" type="number" min="0" step="0.5" value="${secondsToMinutes(load?.dwellSec ?? 0)}" style="width:100px;" />
    </div>
    <div class="wizard-field" style="margin-bottom:0;">
      <label class="wizard-field__label">Unload time (min)</label>
      <input id="bldrUnloadTime" class="field__control wizard-field__input" type="number" min="0" step="0.5" value="${secondsToMinutes(unload?.dwellSec ?? 0)}" style="width:100px;" />
    </div>
  `;
  container.appendChild(bottomRow);
}

// ─── Step 2: Transport ────────────────────────────────────────

function renderTransportStep(container: HTMLElement): void {
  const t = builder.config.transport;
  container.innerHTML = `
    <div class="wizard-page__intro">
      <div class="wizard-page__title">Transport Configuration</div>
      <div class="wizard-page__desc">Set the wagon parameters and motion timings.</div>
    </div>
    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label"># Wagons</label>
        <input id="bldrWagonCount" class="field__control wizard-field__input" type="number" min="1" step="1" value="${t.wagonCount}" style="width:80px;" />
      </div>
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Speed (m/min)</label>
        <input id="bldrWagonSpeed" class="field__control wizard-field__input" type="number" min="1" step="1" value="${t.wagonSpeedMPerMin}" style="width:80px;" />
      </div>
    </div>
    <div style="margin-top:16px;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:8px;">Handling Times (seconds)</div>
    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Lift</label>
        <input id="bldrLift" class="field__control" type="number" min="0" step="1" value="${t.liftSec}" style="width:70px;" />
      </div>
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Drip</label>
        <input id="bldrDrip" class="field__control" type="number" min="0" step="1" value="${t.dripSec}" style="width:70px;" />
      </div>
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Lower</label>
        <input id="bldrLower" class="field__control" type="number" min="0" step="1" value="${t.lowerSec}" style="width:70px;" />
      </div>
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Pick</label>
        <input id="bldrPick" class="field__control" type="number" min="0" step="1" value="${t.pickSec}" style="width:70px;" />
      </div>
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Drop</label>
        <input id="bldrDrop" class="field__control" type="number" min="0" step="1" value="${t.dropSec}" style="width:70px;" />
      </div>
    </div>
  `;
}

// ─── Step 3: Settings ─────────────────────────────────────────

function renderSettingsStep(container: HTMLElement): void {
  const s = builder.config.settings;
  const matOptions = MATERIALS.map((m) => `<option value="${m.type}"${m.type === s.articleMaterialType ? " selected" : ""}>${m.label}</option>`).join("");
  container.innerHTML = `
    <div class="wizard-page__intro">
      <div class="wizard-page__title">Run Settings</div>
      <div class="wizard-page__desc">Configure the simulation targets and parameters.</div>
    </div>
    <div class="wizard-field">
      <label class="wizard-field__label">Article Material</label>
      <select id="bldrSettingsMaterial" class="field__control" style="width:100%;">${matOptions}</select>
    </div>
    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Target throughput</label>
        <input id="bldrTargetBph" class="field__control wizard-field__input" type="number" min="0.1" step="0.1" value="${s.targetBph}" style="width:100px;" />
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">baskets / hour</div>
      </div>
      <div class="wizard-field" style="margin-bottom:0;">
        <label class="wizard-field__label">Baskets</label>
        <input id="bldrBasketCount" class="field__control" type="number" min="1" max="20" step="1" value="${s.basketCount}" style="width:70px;" />
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">in-flight baskets</div>
      </div>
    </div>
    <div class="wizard-field" style="margin-top:12px;">
      <label class="wizard-field__label">Simulation duration</label>
      <input id="bldrSimHours" class="field__control wizard-field__input" type="number" min="0.25" step="0.25" value="${s.simHours}" style="width:100px;" />
      <span style="font-size:12px;color:var(--muted);margin-left:8px;">hours</span>
    </div>
  `;
}

// ─── Step 4: Review ───────────────────────────────────────────

function renderReviewStep(container: HTMLElement): void {
  const cfg = builder.toLineConfig();
  const tanks = cfg.stations.filter((s) => s.kind === "tank");
  const hasWdo = cfg.stations.some((s) => s.kind === "wdo");
  const load = cfg.stations.find((s) => s.kind === "loading");
  const unload = cfg.stations.find((s) => s.kind === "unloading");
  const matLabel = MATERIALS.find((m) => m.type === cfg.settings.articleMaterialType)?.label ?? cfg.settings.articleMaterialType;

  container.innerHTML = `
    <div class="wizard-page__intro">
      <div class="wizard-page__title">Review & Run</div>
      <div class="wizard-page__desc">Verify the configuration before running the simulation.</div>
    </div>

    <div style="border:1px solid var(--border2);border-radius:8px;padding:12px;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Station Sequence</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:12px;">
        <span style="padding:3px 8px;border-radius:4px;background:rgba(74,163,255,0.15);color:var(--accent);font-weight:600;">LOAD</span>
        ${tanks.map((t) => `<span style="padding:3px 8px;border-radius:4px;background:rgba(255,191,105,0.15);color:var(--warn);font-weight:600;">${t.id}</span>`).join('<span style="color:var(--muted);font-size:10px;">→</span>')}
        ${hasWdo ? '<span style="color:var(--muted);font-size:10px;">→</span><span style="padding:3px 8px;border-radius:4px;background:rgba(112,240,184,0.15);color:var(--accent2);font-weight:600;">WDO</span>' : ''}
        <span style="color:var(--muted);font-size:10px;">→</span>
        <span style="padding:3px 8px;border-radius:4px;background:rgba(74,163,255,0.15);color:var(--accent);font-weight:600;">UNLOAD</span>
      </div>
      <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--muted);">
        <span>Material: <strong>${matLabel}</strong></span>
        <span>Load: <strong>${secondsToMinutes(load?.dwellSec ?? 0)} min</strong></span>
        <span>Unload: <strong>${secondsToMinutes(unload?.dwellSec ?? 0)} min</strong></span>
        <span>Tanks: <strong>${tanks.length}</strong></span>
      </div>
    </div>

    <div style="border:1px solid var(--border2);border-radius:8px;padding:12px;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Transport</div>
      <div style="font-size:11px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;">
        <span>Wagons: <strong>${cfg.transport.wagonCount}</strong></span>
        <span>Speed: <strong>${cfg.transport.wagonSpeedMPerMin} m/min</strong></span>
        <span>Lift/Drip/Lower: <strong>${cfg.transport.liftSec}/${cfg.transport.dripSec}/${cfg.transport.lowerSec}s</strong></span>
        <span>Pick/Drop: <strong>${cfg.transport.pickSec}/${cfg.transport.dropSec}s</strong></span>
      </div>
    </div>

    <div style="border:1px solid var(--border2);border-radius:8px;padding:12px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Run Settings</div>
      <div style="font-size:11px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;">
        <span>Target: <strong>${cfg.settings.targetBph} bph</strong></span>
        <span>Baskets: <strong>${cfg.settings.basketCount}</strong></span>
        <span>Duration: <strong>${cfg.settings.simHours} hr</strong></span>
      </div>
    </div>
  `;
}

// ─── Navigation ───────────────────────────────────────────────

function wireNavButtons(): void {
  for (let i = 0; i < STEP_COUNT; i++) {
    const nextBtn = document.getElementById(`builderNext${i + 1}`);
    if (nextBtn) {
      nextBtn.removeEventListener("click", handleNext);
      nextBtn.addEventListener("click", handleNext);
    }
    const backBtn = document.getElementById(`builderBack${i + 1}`);
    if (backBtn) {
      backBtn.removeEventListener("click", handleBack);
      backBtn.addEventListener("click", handleBack);
    }
  }
  const finishBtn = document.getElementById("builderFinish");
  if (finishBtn) {
    finishBtn.removeEventListener("click", handleFinish);
    finishBtn.addEventListener("click", handleFinish);
  }
}

function handleNext(): void {
  builder.next();
  renderStepIndicator();
  renderCurrentStep();
  saveDraft(builder.toLineConfig(), builder.currentStep);
}

function handleBack(): void {
  builder.back();
  renderStepIndicator();
  renderCurrentStep();
}

function handleFinish(): void {
  if (!builder.isComplete()) return;
  applyToSidebar();
  hideModal();
  // Clean up event listeners when modal hides
  if (abortController) abortController.abort();
}

function applyToSidebar(): void {
  const cfg = builder.toLineConfig();
  const layout = lineConfigToLayout(cfg);

  // Write to sidebar DOM elements so existing readParamsFromUi picks them up
  const setVal = (id: string, val: string | number) => {
    const e = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (e) e.value = String(val);
  };

  setVal("tankCount", cfg.stations.filter((s) => s.kind === "tank").length);
  setVal("wdoTimeMin", secondsToMinutes(cfg.stations.find((s) => s.kind === "wdo")?.dwellSec ?? 600));
  setVal("loadTimeMin", secondsToMinutes(cfg.stations.find((s) => s.kind === "loading")?.dwellSec ?? 0));
  setVal("unloadTimeMin", secondsToMinutes(cfg.stations.find((s) => s.kind === "unloading")?.dwellSec ?? 0));
  setVal("dripTimeSec", cfg.transport.dripSec);
  setVal("targetBph", cfg.settings.targetBph);
  setVal("simHours", cfg.settings.simHours);
  setVal("wagonSpeedMPerMin", cfg.transport.wagonSpeedMPerMin);
  setVal("liftLowerSec", cfg.transport.liftSec + cfg.transport.lowerSec);
  setVal("pickDropSec", cfg.transport.pickSec + cfg.transport.dropSec);
  setVal("wagonCount", cfg.transport.wagonCount);
  setVal("distanceMode", cfg.transport.distanceMode);
  setVal("basketCount", cfg.settings.basketCount);
  setVal("recipePreset", "custom");

  // Rebuild the per-tank table from builder config
  const tableBody = document.getElementById("tankTableBody");
  if (tableBody) {
    tableBody.innerHTML = "";
    const tanks = cfg.stations.filter((s) => s.kind === "tank");
    for (let i = 0; i < tanks.length; i++) {
      const t = tanks[i];
      const tr = document.createElement("tr");
      tr.setAttribute("data-id", t.id);
      tr.innerHTML = `
        <td>${t.id}</td>
        <td><select class="type-select"><option value="chemical"${t.tankType === "chemical" ? " selected" : ""}>Chemical</option><option value="rinse"${t.tankType === "rinse" ? " selected" : ""}>Rinse</option></select></td>
        <td><input class="dwell-input" type="number" min="0" step="0.5" value="${secondsToMinutes(t.dwellSec)}" /></td>
        <td><input class="tol-input" type="number" min="0" max="50" step="1" value="${((t.tolerancePct ?? 0.1) * 100).toFixed(0)}" /></td>
      `;
      tableBody.appendChild(tr);
    }
  }

  // Set state directly
  state.layout = layout;
  recomputeAndRender();
}

// ─── Live event handling ──────────────────────────────────────

function wireListeners(signal: AbortSignal): void {
  document.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Station step: type change
    if (target.classList.contains("bldr-type")) {
      const index = Number(target.getAttribute("data-index"));
      const value = (target as HTMLSelectElement).value as TankType;
      builder.setTankType(index, value);
      renderCurrentStep();
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }

    // Station step: dwell change
    if (target.classList.contains("bldr-dwell")) {
      const index = Number(target.getAttribute("data-index"));
      const val = Number((target as HTMLInputElement).value);
      if (!isNaN(val)) {
        builder.setDwell(index, minutesToSeconds(val));
        saveDraft(builder.toLineConfig(), builder.currentStep);
      }
      return;
    }

    // Station step: tolerance change
    if (target.classList.contains("bldr-tol")) {
      const index = Number(target.getAttribute("data-index"));
      const val = Number((target as HTMLInputElement).value);
      if (!isNaN(val)) {
        builder.setTolerance(index, val / 100);
        saveDraft(builder.toLineConfig(), builder.currentStep);
      }
      return;
    }

    // Station step: load/unload time
    if (target.id === "bldrLoadTime") {
      const val = Number((target as HTMLInputElement).value);
      if (!isNaN(val)) {
        builder.setLoadStationTime(minutesToSeconds(val));
        saveDraft(builder.toLineConfig(), builder.currentStep);
      }
      return;
    }
    if (target.id === "bldrUnloadTime") {
      const val = Number((target as HTMLInputElement).value);
      if (!isNaN(val)) {
        builder.setUnloadStationTime(minutesToSeconds(val));
        saveDraft(builder.toLineConfig(), builder.currentStep);
      }
      return;
    }

    // Station step: WDO drying time
    if (target.id === "bldrWdoDryTime") {
      builder.setWdoDryTime(minutesToSeconds(Number((target as HTMLInputElement).value) || 10));
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }

    // Station step: article material
    if (target.id === "bldrMaterial") {
      const val = (target as HTMLInputElement).value;
      builder.setArticleMaterial(val as ArticleMaterialType);
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }

    // Transport step
    if (target.id === "bldrWagonCount") {
      builder.setWagonCount(Number((target as HTMLInputElement).value) || 1);
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }
    if (target.id === "bldrWagonSpeed") {
      try { builder.setWagonSpeed(Number((target as HTMLInputElement).value) || 1); } catch { /* clamp silently */ }
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }
    if (target.id === "bldrLift") { builder.setLiftTime(Number((target as HTMLInputElement).value) || 0); saveDraft(builder.toLineConfig(), builder.currentStep); return; }
    if (target.id === "bldrDrip") { builder.setDripTime(Number((target as HTMLInputElement).value) || 0); saveDraft(builder.toLineConfig(), builder.currentStep); return; }
    if (target.id === "bldrLower") { builder.setLowerTime(Number((target as HTMLInputElement).value) || 0); saveDraft(builder.toLineConfig(), builder.currentStep); return; }
    if (target.id === "bldrPick") { builder.setPickTime(Number((target as HTMLInputElement).value) || 0); saveDraft(builder.toLineConfig(), builder.currentStep); return; }
    if (target.id === "bldrDrop") { builder.setDropTime(Number((target as HTMLInputElement).value) || 0); saveDraft(builder.toLineConfig(), builder.currentStep); return; }

    // Settings step
    if (target.id === "bldrSettingsMaterial") {
      builder.setArticleMaterial((target as HTMLSelectElement).value as ArticleMaterialType);
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }
    if (target.id === "bldrTargetBph") {
      builder.setTargetBph(Number((target as HTMLInputElement).value) || 0);
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }
    if (target.id === "bldrBasketCount") {
      builder.setBasketCount(Number((target as HTMLInputElement).value) || 1);
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }
    if (target.id === "bldrSimHours") {
      builder.setSimHours(Number((target as HTMLInputElement).value) || 0.25);
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }

    updateNavButtons();
  }, { signal });

  // Add tank button (delegated)
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("btn-add-tank")) {
      const afterIndex = Number(target.getAttribute("data-after"));
      try {
        builder.addTank(afterIndex + 1);
        renderCurrentStep();
        saveDraft(builder.toLineConfig(), builder.currentStep);
      } catch {
        // silently ignore invalid add
      }
      return;
    }

    if (target.classList.contains("btn-remove-tank")) {
      const index = Number(target.getAttribute("data-index"));
      try {
        builder.removeTank(index);
        renderCurrentStep();
        saveDraft(builder.toLineConfig(), builder.currentStep);
      } catch {
        // silently ignore invalid remove
      }
      return;
    }

    if (target.id === "bldrRemoveWdo") {
      builder.disableWdo();
      renderCurrentStep();
      saveDraft(builder.toLineConfig(), builder.currentStep);
      return;
    }
  }, { signal });
}
