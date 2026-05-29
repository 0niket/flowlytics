import type { LineConfig } from "./LineConfig";

const STORAGE_KEY = "flowlytics_builder_draft";
const CURRENT_VERSION = 3;

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

    // v1->v2 migration was step shift; v2->v3 drops currentStep entirely
    // All old drafts are accepted as long as they have a config
    if (version < CURRENT_VERSION) {
      // Re-save as v3 (drops currentStep if present)
      const config = parsed.config as LineConfig;
      saveDraft(config);
      return { config, version: CURRENT_VERSION };
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
