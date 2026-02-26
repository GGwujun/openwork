// src/constants/index.ts
// 应用常量

export const APP_NAME = 'OpenWork';
export const APP_VERSION = '1.0.0';

// 存储键名
export const StorageKeys = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  DEVICE_ID: 'device_id',
  USER: 'user',
  SERVER_CONFIG: 'server_config',
  THEME_MODE: 'theme_mode',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  LAST_SYNC_TIME: 'last_sync_time',
} as const;

// API配置
export const API_CONFIG = {
  TIMEOUT: 30000,
  RETTRIES: 3,
  RETRY_DELAY: 1000,
} as const;

// 分页配置
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// 消息配置
export const MESSAGE_CONFIG = {
  MAX_LENGTH: 4000,
  MAX_HISTORY: 1000,
  CODE_CHUNK_SIZE: 100, // 代码分片大小（行数）
} as const;

// WebSocket配置
export const WS_CONFIG = {
  RECONNECT_ATTEMPTS: 10,
  RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 30000,
  HEARTBEAT_INTERVAL: 30000,
} as const;

// 错误代码
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// 主题颜色
export const Colors = {
  light: {
    primary: '#3b82f6',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    codeBackground: '#f1f5f9',
    codeText: '#0f172a',
  },
  dark: {
    primary: '#60a5fa',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155',
    error: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
    codeBackground: '#1e293b',
    codeText: '#f8fafc',
  },
} as const;

// 语言列表（代码高亮支持）
export const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'cpp',
  'c',
  'html',
  'css',
  'json',
  'yaml',
  'markdown',
  'bash',
  'sql',
] as const;
