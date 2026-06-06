import { state } from "./state";
import { buildSimPlan, runSimulation } from "../engine/simulation";
import { lineConfigToSimParams, lineConfigToLayout } from "../builder/LineConfig";
import { calculateEconomics } from "../engine/economics";
import { renderFinancialDashboard } from "./dashboard";

function switchTab(tab: "overview" | "violations"): void {
  const overviewPanel = document.getElementById("tabOverview");
  const violationsPanel = document.getElementById("tabViolations");
  if (overviewPanel) overviewPanel.hidden = tab !== "overview";
  if (violationsPanel) violationsPanel.hidden = tab !== "violations";

  const tabs = document.querySelectorAll(".dashboard-tab");
  for (const btn of tabs) {
    const btnTab = (btn as HTMLElement).dataset.tab;
    btn.classList.toggle("dashboard-tab--active", btnTab === tab);
  }
}

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

  const pinnedContainer = document.getElementById("dashboardPinned");
  const overviewContainer = document.getElementById("tabOverview");
  const violationsContainer = document.getElementById("tabViolations");

  if (!pinnedContainer || !overviewContainer || !violationsContainer) return;
  if (!state.economics || !state.lineConfig || !state.sim) return;

  renderFinancialDashboard(
    state.economics,
    state.lineConfig,
    state.sim.violations,
    pinnedContainer,
    overviewContainer,
    violationsContainer,
  );

  // Update violation badge count on tab button
  const badge = document.getElementById("violationBadge");
  if (badge) {
    const count = state.sim.violations.length;
    if (count > 0) {
      badge.textContent = String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
}

export function recomputeAndRender(): void {
  recomputePlan();
  updateResults();
}

export async function setupConfigPanel(): Promise<void> {
  // Tab navigation via event delegation
  const tabBar = document.querySelector(".dashboard-tabs");
  if (tabBar) {
    tabBar.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".dashboard-tab");
      if (!btn) return;
      const tab = btn.dataset.tab as "overview" | "violations" | undefined;
      if (tab) switchTab(tab);
    });
  }
}
