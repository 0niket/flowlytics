import { GLOSSARY_DATA, type GlossaryEntry } from "./data";
import { escapeHtml } from "../utils";

export function renderGlossary(query: string): void {
  const body = document.getElementById("glossaryBody");
  const countEl = document.getElementById("glossaryCount");
  if (!body) return;
  body.innerHTML = "";

  const q = (query || "").trim().toLowerCase();
  let filtered: GlossaryEntry[] = GLOSSARY_DATA;
  if (q) {
    filtered = GLOSSARY_DATA.filter((entry) => entry.term.toLowerCase().includes(q));
  }

  if (countEl) {
    countEl.textContent = q ? filtered.length + " of " + GLOSSARY_DATA.length + " terms" : GLOSSARY_DATA.length + " terms";
  }

  const sections = new Map<string, GlossaryEntry[]>();
  for (const entry of filtered) {
    if (!sections.has(entry.section)) sections.set(entry.section, []);
    sections.get(entry.section)!.push(entry);
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

export function initGlossary(): void {
  const btn = document.getElementById("glossaryBtn");
  const overlay = document.getElementById("glossaryOverlay");
  const closeBtn = document.getElementById("glossaryCloseBtn");
  const searchInput = document.getElementById("glossarySearch") as HTMLInputElement | null;
  if (!btn || !overlay || !closeBtn) return;

  btn.addEventListener("click", () => {
    overlay.hidden = false;
    renderGlossary("");
    if (searchInput) { searchInput.value = ""; searchInput.focus(); }
  });
  closeBtn.addEventListener("click", () => { overlay.hidden = true; });

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderGlossary(searchInput.value), 150);
    });
  }

  overlay.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") overlay.hidden = true;
  });
}
