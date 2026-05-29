import { Builder } from "./builder";
import { lineConfigToLayout, lineConfigToSimParams } from "./LineConfig";
import type { ArticleMaterialType, TankType } from "./LineConfig";
import { MATERIALS } from "../materials/data";
import { clearDraft } from "./persistence";
import { recomputeAndRender } from "../ui/config";
import { state } from "../ui/state";
import { minutesToSeconds, secondsToMinutes } from "../utils";
import { showToast } from "../ui/toast";

let builder: Builder;
let abortController: AbortController | null = null;
let customMaterialName = "";

export function initConfigView(): void {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  clearDraft();
  builder = new Builder();

  renderAllSections();
  wireListeners(abortController.signal);

  // Apply initial config and run
  applyConfigAndRun();
}

function getRoot(): HTMLElement | null {
  return document.getElementById("configViewRoot");
}

// ─── Render All Sections ────────────────────────────────────

function renderAllSections(): void {
  const root = getRoot();
  if (!root) return;
  root.innerHTML = "";

  renderMaterialSection(root);
  renderStationSection(root);
  renderTransportSection(root);
  renderSimSettingsSection(root);
  renderRunButton(root);
}

// ─── Material Section ───────────────────────────────────────

function renderMaterialSection(container: HTMLElement): void {
  const selectedType = builder.config.settings.articleMaterialType;
  const section = document.createElement("div");
  section.className = "config-view__section";
  section.id = "cvMaterialSection";

  const isOther = selectedType === "other";
  let optionsHtml = "";
  for (const mat of MATERIALS) {
    const sel = mat.type === selectedType ? " selected" : "";
    optionsHtml += `<option value="${mat.type}"${sel}>${mat.label}</option>`;
  }

  section.innerHTML = `
    <div class="config-view__section-title">Article Material</div>
    <select id="bldrMaterialSelect" class="field__control">${optionsHtml}</select>
    ${isOther ? `
      <div class="field" style="margin-top:8px;">
        <label class="field__label">Describe the material</label>
        <input class="field__control" id="bldrMaterialOtherText" type="text" placeholder="Enter material name..." value="${customMaterialName}" />
      </div>
    ` : ""}
  `;
  container.appendChild(section);
}

// ─── Station Section ────────────────────────────────────────

function stationTypeOptions(selected?: TankType): string {
  const types = [
    { value: "chemical", label: "Chemical" },
    { value: "rinse", label: "Rinse" },
    { value: "extra", label: "Extra" },
  ];
  return types
    .map((t) => `<option value="${t.value}"${t.value === selected ? " selected" : ""}>${t.label}</option>`)
    .join("");
}

function renderStationSection(container: HTMLElement): void {
  const stations = builder.config.stations;
  const section = document.createElement("div");
  section.className = "config-view__section";
  section.id = "cvStationSection";
  section.innerHTML = `<div class="config-view__section-title">Station Sequence</div>`;

  const lane = document.createElement("div");
  lane.className = "station-lane";
  lane.id = "cvStationLane";

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (s.kind === "tank") {
      const card = document.createElement("div");
      const typeClass = s.tankType === "chemical" ? "station-card--chemical"
        : s.tankType === "rinse" ? "station-card--rinse"
        : "station-card--extra";
      card.className = `station-card ${typeClass}`;
      const isExtra = s.tankType === "extra";
      const titleColor = s.tankType === "chemical" ? "var(--tank-chemical)"
        : s.tankType === "rinse" ? "var(--tank-rinse)"
        : "var(--tank-extra)";
      card.innerHTML = `
        <div class="station-card__header">
          <span class="station-card__title" style="color:${titleColor};">${s.id}</span>
          <button class="station-card__remove btn-remove-tank" data-index="${i}" title="Remove tank">&times;</button>
        </div>
        <div class="field" style="margin-bottom:8px;">
          <label class="field__label">Type</label>
          <select class="bldr-type station-card__select" data-index="${i}">
            ${stationTypeOptions(s.tankType)}
          </select>
        </div>
        <div class="grid2" ${isExtra ? "hidden" : ""} style="margin-bottom:8px;">
          <div class="field" style="margin:0;">
            <label class="field__label">Dwell time</label>
            <div class="station-card__field">
              <input class="bldr-dwell station-card__input" data-index="${i}" type="number" min="0" step="0.5" value="${secondsToMinutes(s.dwellSec)}" />
              <span class="station-card__unit">min</span>
            </div>
          </div>
          <div class="field" style="margin:0;">
            <label class="field__label">Tolerance</label>
            <div class="station-card__field">
              <span class="station-card__unit">&plusmn;</span>
              <input class="bldr-tol station-card__input" data-index="${i}" type="number" min="0" max="50" step="1" value="${((s.tolerancePct ?? 0.1) * 100).toFixed(0)}" />
              <span class="station-card__unit">%</span>
            </div>
          </div>
        </div>
        ${s.tankType === "chemical" ? `
          <textarea class="bldr-chem-desc station-card__textarea" data-index="${i}" placeholder="Chemical composition..." rows="2">${s.chemicalDescription ?? ""}</textarea>
        ` : ""}
        ${isExtra ? '<div class="station-card__subtitle" style="margin-top:4px;">Reserved for future use</div>' : ""}
      `;
      lane.appendChild(card);
    } else if (s.kind === "wdo") {
      const card = document.createElement("div");
      card.className = "station-card station-card--wdo";
      card.innerHTML = `
        <div class="station-card__header">
          <span class="station-card__title" style="color:var(--accent2);">${s.id}</span>
          <button class="station-card__remove btn-remove-wdo" data-index="${i}" title="Remove WDO">&times;</button>
        </div>
        <div class="station-card__subtitle">Drying Oven</div>
        <div class="field" style="margin:0;">
          <label class="field__label">Dry time</label>
          <div class="station-card__field">
            <input class="bldr-wdo-time station-card__input" data-index="${i}" type="number" min="0" step="0.5" value="${secondsToMinutes(s.dwellSec)}" />
            <span class="station-card__unit">min</span>
          </div>
        </div>
      `;
      lane.appendChild(card);
    } else if (s.kind === "loading") {
      const card = document.createElement("div");
      card.className = "station-card station-card--loading";
      card.innerHTML = `
        <div class="station-card__header">
          <span class="station-card__title" style="color:var(--accent);">LOAD</span>
        </div>
        <div class="station-card__subtitle">Hanger Loading</div>
        <div class="field" style="margin-bottom:8px;">
          <label class="field__label">Loading time</label>
          <div class="station-card__field">
            <input class="bldr-station-time station-card__input" data-kind="loading" type="number" min="0" step="0.5" value="${secondsToMinutes(s.dwellSec)}" />
            <span class="station-card__unit">min</span>
          </div>
        </div>
        <textarea class="bldr-load-desc station-card__textarea" placeholder="Describe the loading process..." rows="2">${s.loadingDescription ?? ""}</textarea>
      `;
      lane.appendChild(card);
    } else if (s.kind === "unloading") {
      const card = document.createElement("div");
      card.className = "station-card station-card--unloading";
      card.innerHTML = `
        <div class="station-card__header">
          <span class="station-card__title" style="color:var(--accent);">UNLOAD</span>
        </div>
        <div class="station-card__subtitle">Hanger Unloading</div>
        <div class="field" style="margin-bottom:8px;">
          <label class="field__label">Unloading time</label>
          <div class="station-card__field">
            <input class="bldr-station-time station-card__input" data-kind="unloading" type="number" min="0" step="0.5" value="${secondsToMinutes(s.dwellSec)}" />
            <span class="station-card__unit">min</span>
          </div>
        </div>
        <textarea class="bldr-unload-desc station-card__textarea" placeholder="Describe the unloading process..." rows="2">${s.unloadingDescription ?? ""}</textarea>
      `;
      lane.appendChild(card);
    }

    // Add button between stations
    if (i < stations.length - 1 && s.kind !== "unloading") {
      const wrapper = document.createElement("div");
      wrapper.className = "station-add-wrapper";
      const addBtn = document.createElement("button");
      addBtn.className = "station-add-btn";
      addBtn.setAttribute("data-after", String(i));
      addBtn.textContent = "+";
      wrapper.appendChild(addBtn);
      lane.appendChild(wrapper);
    }
  }

  section.appendChild(lane);
  container.appendChild(section);
}

// ─── Transport Section ──────────────────────────────────────

function renderTransportSection(container: HTMLElement): void {
  const t = builder.config.transport;
  const section = document.createElement("div");
  section.className = "config-view__section";
  section.id = "cvTransportSection";

  section.innerHTML = `
    <div class="config-view__section-title">Wagons</div>
    <div class="field" style="margin-bottom:10px;max-width:120px;">
      <label class="field__label"># Wagons</label>
      <input id="bldrWagonCount" class="field__control" type="number" min="1" step="1" value="${t.wagonCount}" />
    </div>
    <div id="cvWagonCards"></div>
  `;

  container.appendChild(section);
  renderWagonCards();
}

function renderWagonCards(): void {
  const container = document.getElementById("cvWagonCards");
  if (!container) return;

  const wagons = builder.config.transport.wagons ?? [];
  if (wagons.length === 0) {
    container.innerHTML = "";
    return;
  }

  const processStations = builder.config.stations.filter(
    (s) => s.kind === "tank" || s.kind === "wdo"
  );
  const showZones = wagons.length > 1;

  let cardsHtml = "";
  for (let i = 0; i < wagons.length; i++) {
    const w = wagons[i];
    const fromOptions = processStations
      .map((s) => `<option value="${s.id}"${s.id === w.fromStationId ? " selected" : ""}>${s.id}</option>`)
      .join("");
    const toOptions = processStations
      .map((s) => `<option value="${s.id}"${s.id === w.toStationId ? " selected" : ""}>${s.id}</option>`)
      .join("");

    cardsHtml += `
      <div class="wagon-config-card">
        <div class="wagon-config-card__title">${w.id}</div>
        <div class="grid2" style="margin-bottom:8px;">
          ${showZones ? `
            <div class="field" style="margin:0;">
              <label class="field__label">From</label>
              <select class="bldr-wagon-from field__control" data-wagon-index="${i}">${fromOptions}</select>
            </div>
            <div class="field" style="margin:0;">
              <label class="field__label">To</label>
              <select class="bldr-wagon-to field__control" data-wagon-index="${i}">${toOptions}</select>
            </div>
          ` : ""}
          <div class="field" style="margin:0;">
            <label class="field__label">Speed (m/min)</label>
            <input class="bldr-wagon-speed field__control" data-wagon-index="${i}" type="number" min="1" step="1" value="${w.speedMPerMin}" />
          </div>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">Handling (sec)</div>
        <div class="wagon-handling-grid">
          <div class="field" style="margin:0;">
            <label class="field__label" style="font-size:9px;">Lift</label>
            <input class="bldr-wagon-handling field__control" data-wagon-index="${i}" data-handling-field="liftSec" type="number" min="0" step="1" value="${w.liftSec}" style="width:100%;padding:4px 6px;font-size:11px;" />
          </div>
          <div class="field" style="margin:0;">
            <label class="field__label" style="font-size:9px;">Drip</label>
            <input class="bldr-wagon-handling field__control" data-wagon-index="${i}" data-handling-field="dripSec" type="number" min="0" step="1" value="${w.dripSec}" style="width:100%;padding:4px 6px;font-size:11px;" />
          </div>
          <div class="field" style="margin:0;">
            <label class="field__label" style="font-size:9px;">Lower</label>
            <input class="bldr-wagon-handling field__control" data-wagon-index="${i}" data-handling-field="lowerSec" type="number" min="0" step="1" value="${w.lowerSec}" style="width:100%;padding:4px 6px;font-size:11px;" />
          </div>
          <div class="field" style="margin:0;">
            <label class="field__label" style="font-size:9px;">Pick</label>
            <input class="bldr-wagon-handling field__control" data-wagon-index="${i}" data-handling-field="pickSec" type="number" min="0" step="1" value="${w.pickSec}" style="width:100%;padding:4px 6px;font-size:11px;" />
          </div>
          <div class="field" style="margin:0;">
            <label class="field__label" style="font-size:9px;">Drop</label>
            <input class="bldr-wagon-handling field__control" data-wagon-index="${i}" data-handling-field="dropSec" type="number" min="0" step="1" value="${w.dropSec}" style="width:100%;padding:4px 6px;font-size:11px;" />
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `<div class="wagon-config-grid">${cardsHtml}</div>`;
}

// ─── Sim Settings Section ───────────────────────────────────

function renderSimSettingsSection(container: HTMLElement): void {
  const s = builder.config.settings;
  const section = document.createElement("div");
  section.className = "config-view__section";
  section.id = "cvSimSettingsSection";

  section.innerHTML = `
    <div class="config-view__section-title">Simulation Settings</div>
    <div class="field">
      <label class="field__label">Duration (hr)</label>
      <input id="bldrSimHours" class="field__control" type="number" min="0.25" step="0.25" value="${s.simHours}" style="max-width:160px;" />
    </div>
  `;
  container.appendChild(section);
}

// ─── Run Button ─────────────────────────────────────────────

function renderRunButton(container: HTMLElement): void {
  const btn = document.createElement("button");
  btn.className = "config-view__run-btn";
  btn.id = "cvRunBtn";
  btn.textContent = "Run Simulation";
  container.appendChild(btn);
}

// ─── Apply Config & Run ─────────────────────────────────────

function applyConfigAndRun(): void {
  const errors = builder.validate();
  if (errors.length > 0) {
    for (const err of errors) showToast(err, "error");
    return;
  }

  const cfg = builder.toLineConfig();
  const layout = lineConfigToLayout(cfg);
  const simParams = lineConfigToSimParams(cfg);

  state.lineConfig = cfg;
  state.layout = layout;
  state.params = simParams;
  recomputeAndRender();
}

function autoRunIfEnabled(): void {
  const autoRun = document.getElementById("autoRun") as HTMLInputElement | null;
  if (autoRun?.checked) {
    applyConfigAndRun();
  }
}

// ─── Live Event Handling ────────────────────────────────────

function wireListeners(signal: AbortSignal): void {
  document.addEventListener(
    "input",
    (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Material select
      if (target.id === "bldrMaterialSelect") {
        const type = (target as HTMLSelectElement).value;
        if (type) {
          builder.setArticleMaterial(type as ArticleMaterialType);
          renderAllSections();
          autoRunIfEnabled();
        }
        return;
      }

      // Material "Other" custom text
      if (target.id === "bldrMaterialOtherText") {
        customMaterialName = (target as HTMLInputElement).value;
        return;
      }

      // Station step: type change
      if (target.classList.contains("bldr-type")) {
        const index = Number(target.getAttribute("data-index"));
        const value = (target as HTMLSelectElement).value as TankType;
        builder.setTankType(index, value);
        renderAllSections();
        autoRunIfEnabled();
        return;
      }

      // Station step: dwell change
      if (target.classList.contains("bldr-dwell")) {
        const index = Number(target.getAttribute("data-index"));
        const val = Number((target as HTMLInputElement).value);
        if (!isNaN(val)) {
          builder.setDwell(index, minutesToSeconds(val));
          autoRunIfEnabled();
        }
        return;
      }

      // Station step: tolerance change
      if (target.classList.contains("bldr-tol")) {
        const index = Number(target.getAttribute("data-index"));
        const val = Number((target as HTMLInputElement).value);
        if (!isNaN(val)) {
          builder.setTolerance(index, val / 100);
          autoRunIfEnabled();
        }
        return;
      }

      // Chemical description
      if (target.classList.contains("bldr-chem-desc")) {
        const index = Number(target.getAttribute("data-index"));
        builder.setChemicalDescription(index, (target as HTMLTextAreaElement).value);
        return;
      }

      // Loading description
      if (target.classList.contains("bldr-load-desc")) {
        builder.setLoadingDescription((target as HTMLTextAreaElement).value);
        return;
      }

      // Unloading description
      if (target.classList.contains("bldr-unload-desc")) {
        builder.setUnloadingDescription((target as HTMLTextAreaElement).value);
        return;
      }

      // Load/unload time
      if (target.classList.contains("bldr-station-time")) {
        const kind = target.getAttribute("data-kind");
        const val = Number((target as HTMLInputElement).value);
        if (!isNaN(val)) {
          if (kind === "loading") {
            builder.setLoadStationTime(minutesToSeconds(val));
          } else if (kind === "unloading") {
            builder.setUnloadStationTime(minutesToSeconds(val));
          }
          autoRunIfEnabled();
        }
        return;
      }

      // WDO drying time
      if (target.classList.contains("bldr-wdo-time")) {
        const index = Number(target.getAttribute("data-index"));
        builder.setWdoDryTime(
          minutesToSeconds(Number((target as HTMLInputElement).value) || 10),
          index
        );
        autoRunIfEnabled();
        return;
      }

      // Transport: wagon count
      if (target.id === "bldrWagonCount") {
        builder.setWagonCount(Number((target as HTMLInputElement).value) || 1);
        renderWagonCards();
        autoRunIfEnabled();
        return;
      }
      // Wagon range selects
      if (target.classList.contains("bldr-wagon-from")) {
        const idx = Number(target.getAttribute("data-wagon-index"));
        const toSelect = document.querySelector(
          `.bldr-wagon-to[data-wagon-index="${idx}"]`
        ) as HTMLSelectElement | null;
        const toVal = toSelect?.value ?? "";
        builder.setWagonRange(idx, (target as HTMLSelectElement).value, toVal);
        autoRunIfEnabled();
        return;
      }
      if (target.classList.contains("bldr-wagon-to")) {
        const idx = Number(target.getAttribute("data-wagon-index"));
        const fromSelect = document.querySelector(
          `.bldr-wagon-from[data-wagon-index="${idx}"]`
        ) as HTMLSelectElement | null;
        const fromVal = fromSelect?.value ?? "";
        builder.setWagonRange(idx, fromVal, (target as HTMLSelectElement).value);
        autoRunIfEnabled();
        return;
      }

      // Per-wagon speed
      if (target.classList.contains("bldr-wagon-speed")) {
        const idx = Number(target.getAttribute("data-wagon-index"));
        const val = Number((target as HTMLInputElement).value) || 1;
        builder.setWagonSpeedMPerMin(idx, val);
        autoRunIfEnabled();
        return;
      }

      // Per-wagon handling times
      if (target.classList.contains("bldr-wagon-handling")) {
        const idx = Number(target.getAttribute("data-wagon-index"));
        const field = target.getAttribute("data-handling-field") as "liftSec" | "dripSec" | "lowerSec" | "pickSec" | "dropSec";
        const val = Number((target as HTMLInputElement).value) || 0;
        builder.setWagonHandlingTime(idx, field, val);
        autoRunIfEnabled();
        return;
      }

      // Sim settings
      if (target.id === "bldrSimHours") {
        builder.setSimHours(Number((target as HTMLInputElement).value) || 0.25);
        autoRunIfEnabled();
        return;
      }
    },
    { signal }
  );

  // Click handlers (delegated)
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;

      // Station add button — show type picker
      if (target.classList.contains("station-add-btn")) {
        document.querySelectorAll(".station-type-picker").forEach((p) => p.remove());
        const afterIndex = Number(target.getAttribute("data-after"));
        const wrapper = target.closest(".station-add-wrapper") ?? target.parentElement;
        if (wrapper) {
          const picker = document.createElement("div");
          picker.className = "station-type-picker";
          picker.innerHTML = `
            <button class="station-type-option" data-add-kind="tank" data-add-tank-type="chemical" data-add-after="${afterIndex}">Chemical Tank</button>
            <button class="station-type-option" data-add-kind="tank" data-add-tank-type="rinse" data-add-after="${afterIndex}">Rinse Tank</button>
            <button class="station-type-option" data-add-kind="tank" data-add-tank-type="extra" data-add-after="${afterIndex}">Extra Tank</button>
            <button class="station-type-option" data-add-kind="wdo" data-add-after="${afterIndex}">Drying Oven (WDO)</button>
          `;
          wrapper.appendChild(picker);
        }
        return;
      }

      // Station type picker option click
      if (target.classList.contains("station-type-option")) {
        const kind = target.getAttribute("data-add-kind") as "tank" | "wdo";
        const afterIndex = Number(target.getAttribute("data-add-after"));
        const tankType = target.getAttribute("data-add-tank-type") as TankType | null;
        try {
          builder.addStation(afterIndex + 1, kind, tankType ? { tankType } : undefined);
          renderAllSections();
          autoRunIfEnabled();
        } catch {
          // silently ignore
        }
        return;
      }

      // Remove tank
      if (target.classList.contains("btn-remove-tank")) {
        const index = Number(target.getAttribute("data-index"));
        try {
          builder.removeTank(index);
          renderAllSections();
          autoRunIfEnabled();
        } catch (err) {
          if (err instanceof Error) showToast(err.message, "warning");
        }
        return;
      }

      // Remove WDO
      if (target.classList.contains("btn-remove-wdo")) {
        const index = Number(target.getAttribute("data-index"));
        try {
          builder.removeWdo(index);
          renderAllSections();
          autoRunIfEnabled();
        } catch {
          // silently ignore
        }
        return;
      }

      // Run simulation button
      if (target.id === "cvRunBtn") {
        applyConfigAndRun();
        return;
      }

      // Dismiss station type picker on outside click
      const picker = document.querySelector(".station-type-picker");
      if (picker && !picker.contains(target) && !target.classList.contains("station-add-btn")) {
        picker.remove();
      }

    },
    { signal }
  );
}
