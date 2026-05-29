import { initTheme } from "./ui/theme";
import { setupConfigPanel, recomputeAndRender } from "./ui/config";
import { initGlossary } from "./glossary/renderer";
import { initConfigView } from "./builder/renderer";

function initUi(): void {
  setupConfigPanel();
  initGlossary();
  initTheme();
  initConfigView();
  recomputeAndRender();
}

initUi();
