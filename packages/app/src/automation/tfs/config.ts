// automation/tfs/config.ts
// TFS配置管理 - 使用localStorage持久化

import type { TFSConfig } from '../types/tfs';

const CONFIG_KEY = 'openwork:automation:tfs:config';
const DEFAULT_SERVER_URL = 'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0';

/**
 * TFS配置管理器
 * 管理TFS连接配置的存储和验证
 */
export class TFSConfigManager {
  /**
   * 获取当前配置
   * @returns TFS配置或null
   */
  static getConfig(): TFSConfig | null {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      return {
        serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
        pat: parsed.pat || '',
        username: parsed.username,
      };
    } catch (error) {
      console.error('读取TFS配置失败:', error);
      return null;
    }
  }

  /**
   * 保存配置
   * @param config TFS配置
   */
  static saveConfig(config: TFSConfig): void {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('保存TFS配置失败:', error);
      throw new Error('无法保存配置');
    }
  }

  /**
   * 清除配置
   */
  static clearConfig(): void {
    localStorage.removeItem(CONFIG_KEY);
  }

  /**
   * 验证配置有效性
   * @param config 配置对象
   * @returns 错误信息列表（空数组表示验证通过）
   */
  static validateConfig(config: Partial<TFSConfig>): string[] {
    const errors: string[] = [];
    
    if (!config.serverUrl) {
      errors.push('服务器URL不能为空');
    } else if (!this.isValidUrl(config.serverUrl)) {
      errors.push('服务器URL格式不正确');
    }
    
    if (!config.pat) {
      errors.push('个人访问令牌(PAT)不能为空');
    } else if (config.pat.length < 20) {
      errors.push('个人访问令牌(PAT)格式不正确');
    }
    
    return errors;
  }

  /**
   * 快速配置
   * @param pat 个人访问令牌
   * @param username 用户名（可选）
   * @param serverUrl 服务器URL（可选，使用默认值）
   */
  static quickSetup(
    pat: string,
    username?: string,
    serverUrl: string = DEFAULT_SERVER_URL
  ): void {
    const config: TFSConfig = {
      serverUrl,
      pat,
      username,
    };

    const errors = this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`配置验证失败: ${errors.join(', ')}`);
    }

    this.saveConfig(config);
  }

  /**
   * 检查是否已配置
   * @returns 是否已配置
   */
  static isConfigured(): boolean {
    const config = this.getConfig();
    return config !== null && config.pat.length > 0;
  }

  /**
   * 获取默认服务器URL
   * @returns 默认服务器URL
   */
  static getDefaultServerUrl(): string {
    return DEFAULT_SERVER_URL;
  }

  /**
   * 验证URL格式
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 导出配置（用于备份）
   * @returns 配置JSON字符串
   */
  static exportConfig(): string {
    const config = this.getConfig();
    if (!config) {
      throw new Error('没有可导出的配置');
    }
    
    // 导出时脱敏PAT
    const exportConfig = {
      ...config,
      pat: config.pat.substring(0, 4) + '****',
    };
    
    return JSON.stringify(exportConfig, null, 2);
  }

  /**
   * 获取配置状态摘要
   * @returns 配置状态信息
   */
  static getConfigStatus(): {
    configured: boolean;
    serverUrl: string;
    username?: string;
    patMasked: string;
  } {
    const config = this.getConfig();
    
    if (!config) {
      return {
        configured: false,
        serverUrl: '',
        patMasked: '',
      };
    }

    return {
      configured: true,
      serverUrl: config.serverUrl,
      username: config.username,
      patMasked: config.pat 
        ? `${config.pat.substring(0, 4)}****${config.pat.slice(-4)}`
        : '',
    };
  }
}

export default TFSConfigManager;
