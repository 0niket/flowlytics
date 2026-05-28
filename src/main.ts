import { initTheme } from "./ui/theme";
import { setupConfigPanel, recomputeAndRender } from "./ui/config";
import { initGlossary } from "./glossary/renderer";
import { initStartupModal } from "./ui/wizard";

function initUi(): void {
  setupConfigPanel();
  initGlossary();
  initTheme();
  recomputeAndRender();
  initStartupModal();
}

initUi();
