export const SYSTEM_SETTINGS_ACTIVE_MODULE_KEY = "system-settings-active-module";
export const DEFAULT_SYSTEM_SETTINGS_MODULE = "access-control-matrix";

export const readSystemSettingsModule = (
  fallback = DEFAULT_SYSTEM_SETTINGS_MODULE,
): string => {
  if (typeof window === "undefined") return fallback;
  const stored = window.sessionStorage.getItem(SYSTEM_SETTINGS_ACTIVE_MODULE_KEY);
  return stored?.trim() || fallback;
};

export const rememberSystemSettingsModule = (moduleId?: string | null) => {
  if (typeof window === "undefined") return;
  const normalized = String(moduleId ?? "").trim();
  if (!normalized) return;
  window.sessionStorage.setItem(SYSTEM_SETTINGS_ACTIVE_MODULE_KEY, normalized);
};
