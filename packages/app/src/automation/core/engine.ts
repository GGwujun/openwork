// automation/core/engine.ts
// 自动化引擎核心 - 8阶段工作流编排

import { EventBus } from './event-bus';
import type {
  AutomationEngine as IAutomationEngine,
  AutomationState,
  PhaseType,
  Phase,
  PhaseState,
  AutomationContext,
  TFSWorkItem,
  PhaseLog,
  EngineConfig,
} from '../types/automation';
import type { PhaseExecutor, PhaseResult, PhaseLogger } from '../types/phase';
import { TFSClient } from '../tfs/client';

/**
 * 自动化引擎
 * 编排完整的8阶段自动化工作流
 */
export class AutomationEngine extends EventBus {
  private state: IAutomationEngine | null = null;
  private phases: Map<PhaseType, PhaseExecutor> = new Map();
  private config: EngineConfig;
  private abortController: AbortController | null = null;

  constructor(config: EngineConfig) {
    super();
    this.config = config;
  }

  /**
   * 注册Phase执行器
   * @param phaseType Phase类型
   * @param executor Phase执行器
   */
  registerPhase(phaseType: PhaseType, executor: PhaseExecutor): void {
    this.phases.set(phaseType, executor);
  }

  /**
   * 启动自动化工作流
   * @param workItemId TFS工作项ID
   */
  async start(workItemId: number): Promise<void> {
    if (this.state?.state === 'running') {
      throw new Error('自动化工作流已在运行中');
    }

    // 获取工作项
    const tfsClient = this.config.tfsClient as TFSClient;
    const workItem = await tfsClient.getWorkItem(workItemId);
    
    if (!workItem) {
      throw new Error(`工作项 ${workItemId} 不存在`);
    }

    // 初始化状态
    this.abortController = new AbortController();
    this.state = {
      id: `automation-${Date.now()}-${workItemId}`,
      workItemId,
      state: 'running',
      context: { workItem, repositories: [] },
      currentPhase: null,
      phases: this.createPhases(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.emit('started', { workItemId, automationId: this.state.id });
    this.notifyStateChange('running');

    try {
      // 执行各Phase
      await this.executePhases();
      
      // 标记完成
      if (this.state.state !== 'cancelled') {
        this.state.state = 'completed';
        this.state.updatedAt = new Date();
        this.notifyStateChange('completed');
        this.emit('completed', { 
          automationId: this.state.id,
          workItemId,
          context: this.state.context 
        });
      }
    } catch (error) {
      this.state.state = 'failed';
      this.state.updatedAt = new Date();
      this.notifyStateChange('failed');
      this.notifyError(error as Error, this.state.currentPhase);
      throw error;
    }
  }

  /**
   * 暂停工作流
   */
  pause(): void {
    if (this.state?.state === 'running') {
      this.state.state = 'paused';
      this.notifyStateChange('paused');
      this.emit('paused', { 
        automationId: this.state.id,
        phase: this.state.currentPhase 
      });
    }
  }

  /**
   * 恢复工作流
   */
  async resume(): Promise<void> {
    if (this.state?.state === 'paused') {
      this.state.state = 'running';
      this.notifyStateChange('running');
      this.emit('resumed', { automationId: this.state.id });
      
      try {
        await this.executePhases();
        
        if ((this.state.state as AutomationState) !== 'cancelled') {
          this.state.state = 'completed';
          this.state.updatedAt = new Date();
          this.notifyStateChange('completed');
          this.emit('completed', { 
            automationId: this.state.id,
            workItemId: this.state.workItemId,
            context: this.state.context 
          });
        }
      } catch (error) {
        this.state.state = 'failed';
        this.state.updatedAt = new Date();
        this.notifyStateChange('failed');
        this.notifyError(error as Error, this.state.currentPhase);
        throw error;
      }
    }
  }

  /**
   * 取消工作流
   */
  cancel(): void {
    if (this.state && ['running', 'paused'].includes(this.state.state)) {
      this.state.state = 'cancelled';
      this.abortController?.abort();
      this.notifyStateChange('cancelled');
      this.emit('cancelled', { automationId: this.state.id });
    }
  }

  /**
   * 获取当前状态
   */
  getState(): IAutomationEngine | null {
    return this.state ? { ...this.state } : null;
  }

  /**
   * 获取当前Phase
   */
  getCurrentPhase(): PhaseType | null {
    return this.state?.currentPhase || null;
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.state?.state === 'running';
  }

  /**
   * 创建Phase列表
   */
  private createPhases(): Phase[] {
    const phaseOrder: PhaseType[] = [
      'analyze',
      'design',
      'plan',
      'implement',
      'commit',
      'review',
      'pr',
      'archive',
    ];

    return phaseOrder.map((type) => ({
      type,
      state: 'pending' as PhaseState,
      input: null,
      output: null,
      logs: [],
    }));
  }

  /**
   * 执行各Phase
   */
  private async executePhases(): Promise<void> {
    if (!this.state) return;

    const phaseOrder: PhaseType[] = [
      'analyze',
      'design',
      'plan',
      'implement',
      'commit',
      'review',
      'pr',
      'archive',
    ];

    // 找到当前应该执行的Phase
    let startIndex = 0;
    if (this.state.currentPhase) {
      const currentIndex = phaseOrder.indexOf(this.state.currentPhase);
      if (currentIndex >= 0) {
        const currentPhase = this.state.phases[currentIndex];
        if (currentPhase.state === 'running') {
          startIndex = currentIndex;
        } else if (currentPhase.state === 'completed') {
          startIndex = currentIndex + 1;
        }
      }
    }

    for (let i = startIndex; i < phaseOrder.length; i++) {
      const phaseType = phaseOrder[i];

      // 检查是否被取消
      if (this.state.state === 'cancelled') {
        break;
      }

      // 检查是否暂停
      if (this.state.state === 'paused') {
        this.emit('paused', { phase: phaseType });
        return;
      }

      // 检查是否中止
      if (this.abortController?.signal.aborted) {
        this.state.state = 'cancelled';
        break;
      }

      await this.executePhase(phaseType);
    }
  }

  /**
   * 执行单个Phase
   */
  private async executePhase(phaseType: PhaseType): Promise<void> {
    if (!this.state) return;

    const phase = this.state.phases.find((p) => p.type === phaseType);
    if (!phase) return;

    // 跳过已完成的Phase
    if (phase.state === 'completed') return;

    const executor = this.phases.get(phaseType);
    if (!executor) {
      console.warn(`未找到Phase执行器: ${phaseType}`);
      phase.state = 'skipped';
      return;
    }

    // 更新状态
    this.state.currentPhase = phaseType;
    phase.state = 'running';
    phase.startedAt = new Date();
    this.state.updatedAt = new Date();

    this.emit('phaseStart', { phase: phaseType, automationId: this.state.id });

    // 创建日志记录器
    const logger = this.createPhaseLogger(phase);

    try {
      // 验证输入
      const validation = executor.validate(this.state.context);
      if (!validation.valid) {
        throw new Error(`Phase验证失败: ${validation.errors?.join(', ')}`);
      }

      // 执行Phase
      const result = await executor.execute(this.state.context, logger);

      // 处理结果
      if (result.success) {
        phase.state = 'completed';
        phase.output = result.data;
        phase.completedAt = new Date();
        
        // 更新上下文
        this.updateContext(phaseType, result.data);
        
        this.emit('phaseComplete', { 
          phase: phaseType, 
          result: result.data,
          automationId: this.state.id 
        });
        
        if (this.config.onPhaseComplete) {
          this.config.onPhaseComplete(phaseType, result.data);
        }
      } else {
        throw result.error || new Error(`Phase ${phaseType} 执行失败`);
      }
    } catch (error) {
      phase.state = 'failed';
      phase.error = error as Error;
      this.state.updatedAt = new Date();
      
      this.emit('phaseError', { 
        phase: phaseType, 
        error: error,
        automationId: this.state.id 
      });
      
      throw error;
    }
  }

  /**
   * 更新上下文
   */
  private updateContext(phaseType: PhaseType, data: unknown): void {
    if (!this.state) return;

    switch (phaseType) {
      case 'analyze':
        this.state.context.repositories = (data as { repositories: AutomationContext['repositories'] }).repositories;
        break;
      case 'design':
        this.state.context.designDocument = data as AutomationContext['designDocument'];
        break;
      case 'plan':
        this.state.context.planDocument = data as AutomationContext['planDocument'];
        break;
      case 'implement':
        this.state.context.implementationResult = data as AutomationContext['implementationResult'];
        break;
      case 'commit':
        this.state.context.commitHash = data as string;
        break;
      case 'pr':
        this.state.context.prUrl = data as string;
        break;
      case 'review':
        this.state.context.reviewResult = data as AutomationContext['reviewResult'];
        break;
    }

    this.state.updatedAt = new Date();
  }

  /**
   * 创建Phase日志记录器
   */
  private createPhaseLogger(phase: Phase): PhaseLogger {
    const addLog = (level: PhaseLog['level'], message: string, metadata?: Record<string, unknown>) => {
      const log: PhaseLog = {
        timestamp: new Date(),
        level,
        message,
        metadata,
      };
      phase.logs.push(log);
      
      // 通知外部
      if (this.config.onLog) {
        this.config.onLog(log);
      }
      
      this.emit('log', { phase: phase.type, log });
    };

    return {
      info: (message, metadata) => addLog('info', message, metadata),
      warn: (message, metadata) => addLog('warn', message, metadata),
      error: (message, error, metadata) => {
        const errorMetadata = error ? { ...metadata, error: error.message, stack: error.stack } : metadata;
        addLog('error', message, errorMetadata);
      },
      debug: (message, metadata) => addLog('info', `[DEBUG] ${message}`, metadata),
      getLogs: () => [...phase.logs],
    };
  }

  /**
   * 通知状态变更
   */
  private notifyStateChange(state: AutomationState): void {
    if (this.config.onStateChange) {
      this.config.onStateChange(state);
    }
    this.emit('stateChange', state);
  }

  /**
   * 通知错误
   */
  private notifyError(error: Error, phase: PhaseType | null): void {
    if (this.config.onError) {
      this.config.onError(error, phase);
    }
    this.emit('error', { error, phase });
  }
}

export default AutomationEngine;
