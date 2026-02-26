// src/utils/storage.ts
// 存储工具封装

import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

// MMKV实例（普通存储）
export const mmkv = new MMKV({
  id: 'openwork-storage',
  encryptionKey: 'openwork-encryption-key', // 基础加密
});

// 安全存储（敏感数据）
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

// 统一存储接口
export const storage = {
  // 字符串操作
  set: (key: string, value: string) => mmkv.set(key, value),
  getString: (key: string) => mmkv.getString(key),
  delete: (key: string) => mmkv.delete(key),

  // 数字操作
  setNumber: (key: string, value: number) => mmkv.set(key, value),
  getNumber: (key: string) => mmkv.getNumber(key),

  // 布尔操作
  setBool: (key: string, value: boolean) => mmkv.set(key, value),
  getBool: (key: string) => mmkv.getBoolean(key),

  // JSON操作
  setObject: <T>(key: string, value: T) => {
    mmkv.set(key, JSON.stringify(value));
  },
  getObject: <T>(key: string): T | undefined => {
    const json = mmkv.getString(key);
    if (!json) return undefined;
    try {
      return JSON.parse(json) as T;
    } catch {
      return undefined;
    }
  },

  // 批量操作
  getAllKeys: () => mmkv.getAllKeys(),
  clearAll: () => mmkv.clearAll(),

  // 包含检查
  contains: (key: string) => mmkv.contains(key),
};
