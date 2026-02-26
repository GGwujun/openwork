// src/api/auth.ts
// 认证相关API

import { api } from './client';
import { DeviceInfo, User } from '@/types';

interface RegisterDeviceRequest {
  deviceName: string;
  deviceType: 'ios' | 'android';
  pushToken?: string;
}

interface RegisterDeviceResponse {
  deviceId: string;
  deviceToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface LoginRequest {
  serverUrl: string;
  pairingCode?: string;
}

interface HealthCheckResponse {
  healthy: boolean;
  version: string;
  features: string[];
}

// 检查服务器健康状态
export async function checkServerHealth(serverUrl: string) {
  return api.get<HealthCheckResponse>('/health', {
    baseURL: `${serverUrl}/mobile/v1`,
  });
}

// 注册设备
export async function registerDevice(data: RegisterDeviceRequest) {
  return api.post<RegisterDeviceResponse>('/devices/register', data);
}

// 刷新Token
export async function refreshToken(refreshToken: string) {
  return api.post<{ token: string; refreshToken: string; expiresAt: number }>(
    '/auth/refresh',
    { refreshToken }
  );
}

// 注销设备
export async function logoutDevice(deviceId: string) {
  return api.delete<void>(`/devices/${deviceId}`);
}

// 获取当前用户信息
export async function getCurrentUser() {
  return api.get<User>('/auth/me');
}

// 获取设备列表
export async function getDevices() {
  return api.get<DeviceInfo[]>('/devices');
}
