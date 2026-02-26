// src/store/authStore.ts
// 认证状态管理

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/utils/storage';
import { DeviceInfo, ServerConfig, User } from '@/types';
import * as authApi from '@/api/auth';

interface AuthState {
  // 状态
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  deviceInfo: DeviceInfo | null;
  serverConfig: ServerConfig | null;
  error: string | null;

  // 动作
  setServerUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
  registerDevice: (deviceName: string, deviceType: 'ios' | 'android') => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      isLoading: false,
      user: null,
      deviceInfo: null,
      serverConfig: null,
      error: null,

      // 设置服务器地址并检查连接
      setServerUrl: async (url: string) => {
        set({ isLoading: true, error: null });

        try {
          // 检查服务器健康状态
          const response = await authApi.checkServerHealth(url);

          if (!response.success) {
            set({
              isLoading: false,
              error: response.error?.message || '无法连接到服务器',
            });
            return { success: false, error: response.error?.message };
          }

          // 保存服务器配置
          const serverConfig: ServerConfig = {
            url,
            isConnected: true,
            version: response.data?.version,
          };

          // 保存到存储
          storage.setObject('server_config', serverConfig);

          set({
            serverConfig,
            isLoading: false,
          });

          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : '连接失败';
          set({
            isLoading: false,
            error: message,
          });
          return { success: false, error: message };
        }
      },

      // 注册设备
      registerDevice: async (deviceName: string, deviceType: 'ios' | 'android') => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.registerDevice({
            deviceName,
            deviceType,
          });

          if (!response.success) {
            set({
              isLoading: false,
              error: response.error?.message || '注册失败',
            });
            return { success: false, error: response.error?.message };
          }

          const { deviceId, deviceToken, refreshToken } = response.data!;

          // 保存token
          await storage.set('auth_token', deviceToken);
          await storage.set('refresh_token', refreshToken);
          await storage.set('device_id', deviceId);

          // 创建设备信息
          const deviceInfo: DeviceInfo = {
            id: deviceId,
            name: deviceName,
            type: deviceType,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          };

          set({
            isAuthenticated: true,
            deviceInfo,
            isLoading: false,
          });

          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : '注册失败';
          set({
            isLoading: false,
            error: message,
          });
          return { success: false, error: message };
        }
      },

      // 登出
      logout: async () => {
        const { deviceInfo } = get();

        if (deviceInfo) {
          try {
            await authApi.logoutDevice(deviceInfo.id);
          } catch {
            // 忽略错误
          }
        }

        // 清除存储
        await storage.delete('auth_token');
        await storage.delete('refresh_token');
        await storage.delete('device_id');

        set({
          isAuthenticated: false,
          user: null,
          deviceInfo: null,
          error: null,
        });
      },

      // 清除错误
      clearError: () => set({ error: null }),

      // 设置用户信息
      setUser: (user: User | null) => set({ user }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const value = storage.getString(name);
          return value ?? null;
        },
        setItem: (name, value) => storage.set(name, value),
        removeItem: (name) => storage.delete(name),
      })),
      partialize: (state) => ({
        serverConfig: state.serverConfig,
        deviceInfo: state.deviceInfo,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
