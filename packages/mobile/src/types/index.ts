// src/types/index.ts
// 全局类型定义

// 用户相关
export interface User {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

// 设备信息
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'ios' | 'android';
  pushToken?: string;
  createdAt: string;
  lastActiveAt: string;
}

// 服务器配置
export interface ServerConfig {
  url: string;
  name?: string;
  isConnected: boolean;
  version?: string;
}

// 会话相关
export interface Session {
  id: string;
  title: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  unreadCount: number;
  messageCount: number;
}

// 消息相关
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  updatedAt?: string;
  status: 'sending' | 'sent' | 'error';
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  toolCalls?: ToolCall[];
  error?: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  status: 'running' | 'completed' | 'error';
  input?: Record<string, unknown>;
  output?: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// 导航类型
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  ServerConnect: undefined;
  BiometricSetup: undefined;
};

export type MainTabParamList = {
  Workbench: undefined;
  Explorer: undefined;
  Settings: undefined;
};

export type WorkbenchStackParamList = {
  SessionList: undefined;
  Chat: { sessionId: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  Profile: undefined;
  Security: undefined;
  Notifications: undefined;
};

// 主题类型
export type ThemeMode = 'light' | 'dark' | 'system';

// 网络状态
export type NetworkStatus = 'online' | 'offline' | 'unknown';
