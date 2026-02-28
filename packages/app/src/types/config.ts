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


// ========== TFS Configuration ==========

export interface TFSUserConfig {
  serverUrl: string;
  pat: string;
  username: string | null;
}

export const DEFAULT_TFS_USER_CONFIG: TFSUserConfig = {
  serverUrl: "http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0",
  pat: "",
  username: null,
};

const TFS_CONFIG_KEY = "openwork.tfsConfig";
const tfsListeners = new Set<(config: TFSUserConfig) => void>();

export const validateTfsUserConfig = (value: Partial<TFSUserConfig>): TFSUserConfig => {
  return {
    serverUrl: value.serverUrl ?? DEFAULT_TFS_USER_CONFIG.serverUrl,
    pat: value.pat ?? DEFAULT_TFS_USER_CONFIG.pat,
    username: value.username ?? DEFAULT_TFS_USER_CONFIG.username,
  };
};

export const getTfsUserConfig = (): TFSUserConfig => {
  console.log('[Config] [DEBUG] getTfsUserConfig called');
  
  if (typeof window === "undefined") {
    console.log('[Config] [DEBUG] window undefined, returning default');
    return DEFAULT_TFS_USER_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(TFS_CONFIG_KEY);
    console.log('[Config] [DEBUG] raw from localStorage:', raw ? 'found' : 'not found');
    if (!raw) {
      console.log('[Config] [DEBUG] no config in localStorage, returning default');
      return DEFAULT_TFS_USER_CONFIG;
    }
    const parsed = JSON.parse(raw) as Partial<TFSUserConfig>;
    console.log('[Config] [DEBUG] parsed config:', {
      serverUrl: parsed.serverUrl,
      hasPat: !!parsed.pat,
      patLength: parsed.pat?.length,
      username: parsed.username
    });
    return validateTfsUserConfig(parsed);
  } catch (error) {
    console.error('[Config] [DEBUG] error parsing config:', error);
    return DEFAULT_TFS_USER_CONFIG;
  }
};

export const setTfsUserConfig = (patch: Partial<TFSUserConfig>): TFSUserConfig => {
  const current = getTfsUserConfig();
  const next = validateTfsUserConfig({ ...current, ...patch });
  
  console.log('[Config] [DEBUG] setTfsUserConfig: saving config:', {
    serverUrl: next.serverUrl,
    hasPat: !!next.pat,
    patLength: next.pat?.length,
    username: next.username
  });

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TFS_CONFIG_KEY, JSON.stringify(next));
      console.log('[Config] [DEBUG] setTfsUserConfig: saved to localStorage successfully');
    } catch (error) {
      console.error('[Config] [DEBUG] setTfsUserConfig: error saving to localStorage:', error);
    }
  }

  tfsListeners.forEach((listener) => listener(next));
  return next;
};

export const subscribeTfsUserConfig = (listener: (config: TFSUserConfig) => void) => {
  tfsListeners.add(listener);
  return () => tfsListeners.delete(listener);
};

export const hasValidTfsConfig = (): boolean => {
  const config = getTfsUserConfig();
  return !!config.pat && config.pat.length > 0;
};