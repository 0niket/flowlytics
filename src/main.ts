import { initTheme } from "./ui/theme";
import { setupConfigPanel, recomputeAndRender } from "./ui/config";
import { initGlossary } from "./glossary/renderer";
import { initBuilder } from "./builder/renderer";

function initUi(): void {
  setupConfigPanel();
  initGlossary();
  initTheme();
  initBuilder();
  document.getElementById("editLineBtn")?.addEventListener("click", () => initBuilder());
  recomputeAndRender();
}

initUi();
