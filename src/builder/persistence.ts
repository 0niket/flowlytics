import type { LineConfig } from "./LineConfig";

const STORAGE_KEY = "flowlytics_builder_draft";

export interface PersistedDraft {
  config: LineConfig;
  currentStep: number;
}

export function saveDraft(config: LineConfig, currentStep: number): void {
  const data: PersistedDraft = { config, currentStep };
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
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (!parsed.config || typeof parsed.currentStep !== "number") return null;
    return parsed;
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
