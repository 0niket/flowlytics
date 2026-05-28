export function initTheme(): void {
  const themeBtn = document.getElementById("themeToggleBtn");
  if (!themeBtn) return;

  const saved = localStorage.getItem("flowlytics-theme");
  if (saved === "light") document.documentElement.classList.add("light");
  themeBtn.textContent = document.documentElement.classList.contains("light") ? "\u2600" : "\u263E";

  themeBtn.addEventListener("click", () => {
    const isLight = document.documentElement.classList.toggle("light");
    themeBtn.textContent = isLight ? "\u2600" : "\u263E";
    localStorage.setItem("flowlytics-theme", isLight ? "light" : "dark");
  });
}
