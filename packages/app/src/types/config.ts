export interface AutoAnalysisConfig {
  enabled: boolean;
  autoSyncToTfs: boolean;
  cacheExpiryHours: number;
  maxRetries: number;
  stuckMinutes: number;
}

/**
 * Default auto analysis configuration.
 */
export const DEFAULT_AUTO_ANALYSIS_CONFIG: AutoAnalysisConfig = {
  enabled: true,
  autoSyncToTfs: true,
  cacheExpiryHours: 24,
  maxRetries: 3,
  stuckMinutes: 30,
};

const AUTO_ANALYSIS_CONFIG_KEY = "openwork.autoAnalysisConfig";
const listeners = new Set<(config: AutoAnalysisConfig) => void>();

const normalizeNumber = (value: unknown, fallback: number, min: number, max?: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.max(min, parsed);
  if (max !== undefined) return Math.min(max, clamped);
  return clamped;
};

/**
 * Validate and normalize auto analysis config.
 */
export const validateAutoAnalysisConfig = (value: Partial<AutoAnalysisConfig>): AutoAnalysisConfig => {
  return {
    enabled: value.enabled ?? DEFAULT_AUTO_ANALYSIS_CONFIG.enabled,
    autoSyncToTfs: value.autoSyncToTfs ?? DEFAULT_AUTO_ANALYSIS_CONFIG.autoSyncToTfs,
    cacheExpiryHours: normalizeNumber(value.cacheExpiryHours, DEFAULT_AUTO_ANALYSIS_CONFIG.cacheExpiryHours, 1, 168),
    maxRetries: normalizeNumber(value.maxRetries, DEFAULT_AUTO_ANALYSIS_CONFIG.maxRetries, 1, 10),
    stuckMinutes: normalizeNumber(value.stuckMinutes, DEFAULT_AUTO_ANALYSIS_CONFIG.stuckMinutes, 5, 240),
  };
};

/**
 * Read auto analysis config from local storage.
 */
export const getAutoAnalysisConfig = (): AutoAnalysisConfig => {
  if (typeof window === "undefined") {
    return DEFAULT_AUTO_ANALYSIS_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(AUTO_ANALYSIS_CONFIG_KEY);
    if (!raw) return DEFAULT_AUTO_ANALYSIS_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AutoAnalysisConfig>;
    return validateAutoAnalysisConfig(parsed);
  } catch {
    return DEFAULT_AUTO_ANALYSIS_CONFIG;
  }
};

/**
 * Persist auto analysis config and notify listeners.
 */
export const setAutoAnalysisConfig = (patch: Partial<AutoAnalysisConfig>): AutoAnalysisConfig => {
  const current = getAutoAnalysisConfig();
  const next = validateAutoAnalysisConfig({ ...current, ...patch });

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUTO_ANALYSIS_CONFIG_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  listeners.forEach((listener) => listener(next));
  return next;
};

/**
 * Subscribe to auto analysis config changes.
 */
export const subscribeAutoAnalysisConfig = (listener: (config: AutoAnalysisConfig) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
