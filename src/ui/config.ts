import { ui, state } from "./state";
import { buildSimPlan, runSimulation } from "../engine/simulation";
import { analyzeConstraints } from "../engine/constraints";
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

function escapeHtml(s: string): string {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function updateResults(): void {
  if (!state.sim || !state.params) return;
  renderFinancialDashboardSection();
  renderConstraintsTab();
}

function renderFinancialDashboardSection(): void {
  const container = document.getElementById("financialDashboard");
  if (!container || !state.economics || !state.lineConfig || !state.sim) return;
  renderFinancialDashboard(state.economics, state.lineConfig, state.sim.violations, container);
}

function renderConstraintsTab(): void {
  ui.constraintsBody.textContent = "";
  if (!state.sim || !state.lineConfig) return;
  const constraints = analyzeConstraints(state.lineConfig, state.sim);
  for (const c of constraints) {
    const card = document.createElement("div");
    card.className = `constraint-card constraint-card--${c.status}`;

    const header = document.createElement("div");
    header.className = "constraint-card__header";
    const statusLabel = c.status === "ok" ? "OK" : c.status === "warning" ? "WARN" : "FAIL";
    header.innerHTML = `<span class="constraint-card__id">${escapeHtml(c.componentId)}</span><span class="constraint-card__label">${escapeHtml(c.label)}</span><span class="badge badge--${c.status === "ok" ? "ok" : c.status === "warning" ? "neutral" : "bad"}">${statusLabel}</span>`;
    card.appendChild(header);

    const rule = document.createElement("div");
    rule.className = "constraint-card__rule";
    rule.textContent = c.rule;
    card.appendChild(rule);

    if (c.violations.length > 0) {
      const list = document.createElement("div");
      list.className = "constraint-card__violations";
      for (const v of c.violations) {
        const item = document.createElement("div");
        item.className = "constraint-violation";
        item.innerHTML = `<div class="constraint-violation__desc">${escapeHtml(v.description)}</div><div class="constraint-violation__cause">${escapeHtml(v.cause)}</div>`;
        list.appendChild(item);
      }
      if (c.totalViolationCount > c.violations.length) {
        const more = document.createElement("div");
        more.className = "constraint-card__more";
        more.textContent = `and ${c.totalViolationCount - c.violations.length} more`;
        list.appendChild(more);
      }
      card.appendChild(list);
    }

    if (c.queueAnalysis) {
      const qa = c.queueAnalysis;
      const analysis = document.createElement("div");
      analysis.className = "constraint-card__queue-analysis";

      const formulaDiv = document.createElement("div");
      formulaDiv.className = "queue-analysis__formula";
      formulaDiv.textContent = qa.formula;
      analysis.appendChild(formulaDiv);

      const explDiv = document.createElement("div");
      explDiv.className = "queue-analysis__explanation";
      const explColor = c.status === "violated" ? "var(--danger)" : c.status === "warning" ? "var(--warn)" : "var(--accent2)";
      explDiv.style.color = explColor;
      explDiv.textContent = qa.explanation;
      analysis.appendChild(explDiv);

      if (qa.timeline.length > 1) {
        const chartWrap = document.createElement("div");
        chartWrap.className = "queue-analysis__chart";
        const w = 480;
        const h = 60;
        const pad = 24;
        const maxDepth = Math.max(1, ...qa.timeline.map((p) => p.depth));
        const barW = Math.max(2, (w - pad) / qa.timeline.length - 1);
        const chartColor = c.status === "violated" ? "rgba(224,108,117,0.7)" : c.status === "warning" ? "rgba(255,191,105,0.7)" : "rgba(112,240,184,0.5)";

        let bars = "";
        let labels = "";
        for (let i = 0; i < qa.timeline.length; i++) {
          const p = qa.timeline[i];
          const x = pad + i * ((w - pad) / qa.timeline.length);
          const barH = maxDepth > 0 ? (p.depth / maxDepth) * (h - 14) : 0;
          const y = h - 12 - barH;
          bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="1" fill="${chartColor}"/>`;
          // Show labels every 15 min
          if (p.timeMin % 15 === 0) {
            labels += `<text x="${x + barW / 2}" y="${h}" text-anchor="middle" fill="rgba(146,162,187,0.6)" font-size="8" font-family="ui-monospace,Menlo,Monaco,Consolas,monospace">${p.timeMin}m</text>`;
          }
        }

        const yLabel = `<text x="2" y="10" fill="rgba(146,162,187,0.8)" font-size="8" font-family="ui-monospace,Menlo,Monaco,Consolas,monospace">${maxDepth}</text>`;
        chartWrap.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;">${yLabel}${bars}${labels}</svg>`;
        analysis.appendChild(chartWrap);
      }

      card.appendChild(analysis);
    }

    ui.constraintsBody.appendChild(card);
  }
}

export function recomputeAndRender(): void {
  recomputePlan();
  updateResults();
}

export async function setupConfigPanel(): Promise<void> {
  // No tab or export setup needed — constraints are always visible
}
