// automation/types/phase.ts
// Phase执行器类型定义

import type { AutomationContext, PhaseLog } from './automation';

/**
 * Phase执行器接口
 * 每个Phase必须实现此接口
 */
export interface PhaseExecutor {
  /**
   * Phase类型标识
   */
  readonly phaseType: string;

  /**
   * 执行Phase
   * @param context 自动化上下文
   * @param logger 日志记录器
   * @returns Phase执行结果
   */
  execute(context: AutomationContext, logger: PhaseLogger): Promise<PhaseResult>;

  /**
   * 验证输入
   * @param context 自动化上下文
   * @returns 验证结果
   */
  validate(context: AutomationContext): ValidationResult;

  /**
   * 获取Phase描述
   */
  getDescription(): string;
}

/**
 * Phase执行结果
 */
export interface PhaseResult {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 输出数据
   */
  data?: unknown;

  /**
   * 错误信息（失败时）
   */
  error?: Error;

  /**
   * 警告信息
   */
  warnings?: string[];

  /**
   * 元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /**
   * 是否有效
   */
  valid: boolean;

  /**
   * 错误信息
   */
  errors?: string[];
}

/**
 * Phase日志记录器
 */
export interface PhaseLogger {
  /**
   * 记录信息日志
   */
  info(message: string, metadata?: Record<string, unknown>): void;

  /**
   * 记录警告日志
   */
  warn(message: string, metadata?: Record<string, unknown>): void;

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;

  /**
   * 记录调试日志
   */
  debug(message: string, metadata?: Record<string, unknown>): void;

  /**
   * 获取所有日志
   */
  getLogs(): PhaseLog[];
}

/**
 * Phase配置
 */
export interface PhaseConfig {
  /**
   * Phase超时时间（毫秒）
   */
  timeout?: number;

  /**
   * 是否允许重试
   */
  retryable?: boolean;

  /**
   * 最大重试次数
   */
  maxRetries?: number;

  /**
   * 重试延迟（毫秒）
   */
  retryDelay?: number;

  /**
   * 跳过条件
   */
  skipCondition?: (context: AutomationContext) => boolean;
}

/**
 * Phase执行选项
 */
export interface PhaseExecutionOptions {
  /**
   * 是否跳过验证
   */
  skipValidation?: boolean;

  /**
   * 超时时间（毫秒）
   */
  timeout?: number;

  /**
   * 信号（用于取消）
   */
  signal?: AbortSignal;
}

/**
 * Phase执行错误
 */
export class PhaseExecutionError extends Error {
  constructor(
    message: string,
    public readonly phaseType: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PhaseExecutionError';
  }
}

/**
 * Phase超时错误
 */
export class PhaseTimeoutError extends Error {
  constructor(
    public readonly phaseType: string,
    public readonly timeoutMs: number
  ) {
    super(`Phase ${phaseType} 执行超时 (${timeoutMs}ms)`);
    this.name = 'PhaseTimeoutError';
  }
}

/**
 * Phase验证错误
 */
export class PhaseValidationError extends Error {
  constructor(
    public readonly phaseType: string,
    public readonly errors: string[]
  ) {
    super(`Phase ${phaseType} 验证失败: ${errors.join(', ')}`);
    this.name = 'PhaseValidationError';
  }
}

export default {};
