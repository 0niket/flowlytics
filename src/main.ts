import { initTheme } from "./ui/theme";
import { setupConfigPanel, recomputeAndRender } from "./ui/config";
import { initGlossary } from "./glossary/renderer";

function initUi(): void {
  setupConfigPanel();
  initGlossary();
  initTheme();
  recomputeAndRender();
}

initUi();
