import { state } from "./state";
import { buildSimPlan, runSimulation } from "../engine/simulation";
import { lineConfigToSimParams, lineConfigToLayout } from "../builder/LineConfig";
import { calculateEconomics } from "../engine/economics";
import { renderFinancialDashboard } from "./dashboard";

export function recomputePlan(): void {
  if (!state.lineConfig) return;
  state.params = lineConfigToSimParams(state.lineConfig);
  state.layout = lineConfigToLayout(state.lineConfig);
  state.plan = buildSimPlan(state.layout, state.params);
  state.sim = runSimulation(state.layout, state.params);

  // Calculate economics from config + simulation result
  if (state.sim) {
    state.economics = calculateEconomics(state.lineConfig, state.sim);
  }
}

// ─── Rendering ────────────────────────────────────────────────

function updateResults(): void {
  if (!state.sim || !state.params) return;
  const container = document.getElementById("financialDashboard");
  if (!container || !state.economics || !state.lineConfig || !state.sim) return;
  renderFinancialDashboard(state.economics, state.lineConfig, state.sim.violations, container);
}

export function recomputeAndRender(): void {
  recomputePlan();
  updateResults();
}

export async function setupConfigPanel(): Promise<void> {
  // No tab or export setup needed
}
