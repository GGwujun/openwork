// src/api/client.ts
// API客户端封装

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { ApiError, ApiResponse } from '@/types';
import { API_CONFIG, ErrorCodes } from '@/constants';
import { storage } from '@/utils/storage';

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  async (config) => {
    // 获取token
    const token = await storage.getString('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 获取服务器地址
    const serverUrl = await storage.getString('server_url');
    if (serverUrl) {
      config.baseURL = `${serverUrl}/mobile/v1`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Token过期，尝试刷新
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await storage.getString('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const serverUrl = await storage.getString('server_url');
        const response = await axios.post(`${serverUrl}/mobile/v1/auth/refresh`, {
          refreshToken,
        });

        const { token, refreshToken: newRefreshToken } = response.data.data;
        await storage.set('auth_token', token);
        await storage.set('refresh_token', newRefreshToken);

        // 重试原请求
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 刷新失败，清除token并抛出错误
        await storage.delete('auth_token');
        await storage.delete('refresh_token');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// 错误处理
function handleError(error: AxiosError): ApiError {
  if (error.code === 'ECONNABORTED') {
    return {
      code: ErrorCodes.TIMEOUT_ERROR,
      message: '请求超时，请稍后重试',
    };
  }

  if (!error.response) {
    return {
      code: ErrorCodes.NETWORK_ERROR,
      message: '网络连接失败，请检查网络设置',
    };
  }

  const status = error.response.status;
  const data = error.response.data as { error?: ApiError };

  switch (status) {
    case 400:
      return {
        code: ErrorCodes.VALIDATION_ERROR,
        message: data.error?.message || '请求参数错误',
      };
    case 401:
      return {
        code: ErrorCodes.AUTH_ERROR,
        message: '登录已过期，请重新登录',
      };
    case 403:
      return {
        code: ErrorCodes.AUTH_ERROR,
        message: '没有权限执行此操作',
      };
    case 500:
    case 502:
    case 503:
      return {
        code: ErrorCodes.SERVER_ERROR,
        message: '服务器繁忙，请稍后重试',
      };
    default:
      return {
        code: ErrorCodes.UNKNOWN_ERROR,
        message: data.error?.message || '发生未知错误',
      };
  }
}

// 封装的API请求方法
export async function apiRequest<T>(
  config: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response = await apiClient.request(config);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    return {
      success: false,
      error: handleError(axiosError),
    };
  }
}

// HTTP方法封装
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'GET', url }),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'POST', url, data }),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'PUT', url, data }),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'PATCH', url, data }),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'DELETE', url }),
};

export default apiClient;
