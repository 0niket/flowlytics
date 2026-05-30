import type { UiElements, AppState } from "../types";
import { buildSyntheticLayout } from "../engine/layout";

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element: ${id}`);
  return e as unknown as T;
}

export const ui: UiElements = {
  autoRun: el("autoRun"),
  configPanel: el("configPanel"),
  constraintsBody: el("constraintsBody"),
};

export const state: AppState = {
  layout: buildSyntheticLayout(12),
  params: null,
  plan: null,
  sim: null,
  lineConfig: null,
};
