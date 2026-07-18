export type Theme = "light" | "dark";

const KEY = "rngdle-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : systemTheme();
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Apply the persisted/system theme before first paint to avoid a flash. */
export function initTheme(): void {
  apply(getTheme());
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(KEY, next);
  apply(next);
  return next;
}
