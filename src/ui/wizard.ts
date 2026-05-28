import { ui, state } from "./state";
import { extractLabelsFromDxfText } from "../dxf/parser";
import { detectStationsFromLabels } from "../dxf/detector";
import { clamp } from "../utils";
import { recomputeAndRender } from "./config";

const DWG_CONVERT_ENDPOINT = "/convert";

async function handleDxfFile(file: File): Promise<boolean> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const modalStatus = document.getElementById("modalStatus") as HTMLElement | null;
  const statusEl = modalStatus || ui.layoutStatus;

  if (ext === "dxf") {
    statusEl.textContent = "Parsing DXF file...";
    statusEl.className = "modal__status modal__status--loading";
    try {
      const text = await file.text();
      const labels = extractLabelsFromDxfText(text);
      if (labels.length === 0) {
        statusEl.textContent = "No text labels found in file. Check if the DXF contains TEXT/MTEXT entities.";
        statusEl.className = "modal__status modal__status--error";
        return false;
      }
      applyDxfLabels(labels);
      const detected = state.detectedStations;
      const stationMsg = detected && detected.length > 0
        ? detected.length + " stations detected — tank count set to " + Math.min(detected.length, 20)
        : "No station tags found — using default tank count";
      statusEl.textContent = "Parsed " + labels.length + " labels. " + stationMsg + ".";
      statusEl.className = "modal__status modal__status--success";
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      statusEl.textContent = "Parse error: " + msg;
      statusEl.className = "modal__status modal__status--error";
      return false;
    }
  } else if (ext === "dwg") {
    statusEl.textContent = "Sending to server for conversion...";
    statusEl.className = "modal__status modal__status--loading";
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
        statusEl.textContent = "Converted but no text labels found.";
        statusEl.className = "modal__status modal__status--error";
        return false;
      }
      applyDxfLabels(labels);
      const detectedDwg = state.detectedStations;
      const dwgStationMsg = detectedDwg && detectedDwg.length > 0
        ? detectedDwg.length + " stations detected — tank count set to " + Math.min(detectedDwg.length, 20)
        : "No station tags found — using default tank count";
      statusEl.textContent = "Converted " + labels.length + " labels. " + dwgStationMsg + ".";
      statusEl.className = "modal__status modal__status--success";
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Failed to fetch")) {
        statusEl.innerHTML = "Cannot reach conversion server. <strong>Alternative:</strong> export your drawing as .dxf from AutoCAD (File &gt; Save As &gt; DXF) and import the .dxf instead. Or start the server: <code>python3 scripts/serve_convert.py</code>";
      } else {
        statusEl.textContent = "Conversion error: " + msg;
      }
      statusEl.className = "modal__status modal__status--error";
      return false;
    }
  } else {
    statusEl.textContent = "Unsupported file type: ." + ext + ". Use .dxf or .dwg.";
    statusEl.className = "modal__status modal__status--error";
    return false;
  }
}

function applyDxfLabels(labels: import("../types").DxfLabel[]): void {
  state.dxfLabelsRows = labels;
  ui.layoutMode.value = "dxf_labels";

  const detectedStations = detectStationsFromLabels(labels);
  if (detectedStations.length > 0) {
    const count = clamp(detectedStations.length, 3, 20);
    ui.tankCount.value = String(count);
    state.detectedStations = detectedStations;
    ui.layoutStatus.textContent = "DXF layout: " + detectedStations.length + " stations detected (" + detectedStations.map((s) => s.id).join(", ") + ").";
  } else {
    state.detectedStations = null;
    ui.layoutStatus.textContent = "DXF layout (" + labels.length + " labels, no station tags found).";
  }

  recomputeAndRender();
}

function dismissModal(): void {
  const modal = document.getElementById("startupModal");
  if (modal) modal.hidden = true;
  document.querySelector(".app")?.classList.remove("app--behind-modal");
}

function wizardGoToStep(step: number): void {
  document.querySelectorAll(".wizard-step").forEach((el) => {
    const s = Number(el.getAttribute("data-step"));
    el.classList.toggle("wizard-step--active", s === step);
    el.classList.toggle("wizard-step--done", s < step);
  });
  const step1 = document.getElementById("wizardStep1");
  const step2 = document.getElementById("wizardStep2");
  if (step1) step1.hidden = step !== 1;
  if (step2) step2.hidden = step !== 2;
}

export function initStartupModal(): void {
  const modal = document.getElementById("startupModal");
  const dropZone = document.getElementById("dropZone");
  const filePicker = document.getElementById("dxfFilePicker") as HTMLInputElement | null;
  const skipBtn = document.getElementById("skipDxfBtn");
  const nextBtn1 = document.getElementById("wizardNext1");
  const backBtn2 = document.getElementById("wizardBack2");
  const finishBtn = document.getElementById("wizardFinish");
  const wizTargetBph = document.getElementById("wizTargetBph") as HTMLInputElement | null;
  const wizSimHours = document.getElementById("wizSimHours") as HTMLInputElement | null;

  if (!modal || !dropZone || !filePicker) return;

  let layoutReady = false;

  document.querySelector(".app")?.classList.add("app--behind-modal");

  function enableNext(): void {
    layoutReady = true;
    if (nextBtn1) (nextBtn1 as HTMLButtonElement).disabled = false;
  }

  dropZone.addEventListener("click", () => filePicker.click());

  filePicker.addEventListener("change", async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const ok = await handleDxfFile(file);
    if (ok) enableNext();
  });

  dropZone.addEventListener("dragover", (e: Event) => {
    e.preventDefault();
    dropZone.classList.add("drop-zone--dragover");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drop-zone--dragover");
  });
  dropZone.addEventListener("drop", async (e: Event) => {
    e.preventDefault();
    dropZone.classList.remove("drop-zone--dragover");
    const de = e as DragEvent;
    const file = de.dataTransfer?.files?.[0];
    if (!file) return;
    const ok = await handleDxfFile(file);
    if (ok) enableNext();
  });

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      enableNext();
      wizardGoToStep(2);
    });
  }

  if (nextBtn1) {
    nextBtn1.addEventListener("click", () => {
      if (!layoutReady) return;
      wizardGoToStep(2);
    });
  }

  if (backBtn2) {
    backBtn2.addEventListener("click", () => {
      wizardGoToStep(1);
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener("click", () => {
      const targetVal = Number(wizTargetBph?.value || 2);
      const hoursVal = Number(wizSimHours?.value || 2);
      const targetBphInput = document.getElementById("targetBph") as HTMLInputElement;
      const simHoursInput = document.getElementById("simHours") as HTMLInputElement;
      if (targetBphInput) targetBphInput.value = String(targetVal);
      if (simHoursInput) simHoursInput.value = String(hoursVal);
      dismissModal();
      recomputeAndRender();
    });
  }
}
