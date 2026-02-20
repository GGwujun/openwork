// app/hooks/use-automation.ts
// 自动化服务Hook - 在UI中使用自动化引擎

import { createSignal, createMemo, onCleanup } from 'solid-js';
import type { Accessor, Resource } from 'solid-js';
import {
  AutomationEngine,
  TFSClient,
  AIService,
  TFSConfigManager,
  PhaseAnalyzer,
  PhaseDesigner,
  PhasePlanner,
} from '../../automation';
import type {
  AutomationState,
  PhaseType,
  TFSWorkItem,
  AutomationContext,
} from '../../automation';

/**
 * 自动化服务配置
 */
export interface AutomationServiceConfig {
  tfsConfig?: {
    serverUrl: string;
    pat: string;
    username?: string;
  };
  aiConfig?: {
    provider: 'openai' | 'anthropic' | 'azure' | 'local';
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
}

/**
 * 自动化状态
 */
export interface UseAutomationState {
  state: Accessor<AutomationState>;
  currentPhase: Accessor<PhaseType | null>;
  workItem: Accessor<TFSWorkItem | null>;
  progress: Accessor<number>;
  logs: Accessor<Array<{ timestamp: Date; level: string; message: string }>>;
  isRunning: Accessor<boolean>;
  error: Accessor<Error | null>;
  context: Accessor<Partial<AutomationContext>>;
}

/**
 * 自动化操作
 */
export interface UseAutomationActions {
  start: (workItemId: number) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  cancel: () => void;
  configure: (config: AutomationServiceConfig) => void;
}

/**
 * 自动化服务Hook
 * 
 * 使用示例:
 * ```tsx
 * const { state, actions } = useAutomation();
 * 
 * // 启动自动化
 * await actions.start(12345);
 * 
 * // 监听状态
 * createEffect(() => {
 *   console.log('当前状态:', state.state());
 * });
 * ```
 */
export function useAutomation(): UseAutomationState & UseAutomationActions {
  // 信号状态
  const [automationState, setAutomationState] = createSignal<AutomationState>('idle');
  const [currentPhase, setCurrentPhase] = createSignal<PhaseType | null>(null);
  const [workItem, setWorkItem] = createSignal<TFSWorkItem | null>(null);
  const [logs, setLogs] = createSignal<Array<{ timestamp: Date; level: string; message: string }>>([]);
  const [error, setError] = createSignal<Error | null>(null);
  const [context, setContext] = createSignal<Partial<AutomationContext>>({});
  
  // 引擎实例（使用ref模式存储）
  let engine: AutomationEngine | null = null;
  let unsubscribeFns: Array<() => void> = [];

  // 计算属性
  const progress = createMemo(() => {
    const phase = currentPhase();
    if (!phase) return 0;
    
    const phases: PhaseType[] = ['analyze', 'design', 'plan', 'implement', 'commit', 'review', 'pr', 'archive'];
    const index = phases.indexOf(phase);
    return Math.round(((index + 1) / phases.length) * 100);
  });

  const isRunning = createMemo(() => automationState() === 'running');

  /**
   * 初始化引擎
   */
  const initializeEngine = (config: AutomationServiceConfig): boolean => {
    try {
      // 清理旧引擎
      if (engine) {
        unsubscribeFns.forEach(fn => fn());
        unsubscribeFns = [];
      }

      // 创建TFS客户端
      const tfsConfig = config.tfsConfig || TFSConfigManager.getConfig();
      if (!tfsConfig) {
        throw new Error('TFS未配置');
      }
      const tfsClient = new TFSClient(tfsConfig);

      // 创建AI服务
      if (!config.aiConfig) {
        throw new Error('AI服务未配置');
      }
      const aiService = new AIService(config.aiConfig);

      // 创建引擎
      engine = new AutomationEngine({
        tfsClient,
        aiService,
        gitClient: null as any, // 暂时不传入，使用时再初始化
        onStateChange: (state) => {
          setAutomationState(state);
        },
        onPhaseComplete: (phase, output) => {
          setContext((prev) => {
            switch (phase) {
              case 'analyze':
                return { ...prev, repositories: (output as any).repositories };
              case 'design':
                return { ...prev, designDocument: output as any };
              case 'plan':
                return { ...prev, planDocument: output as any };
              case 'implement':
                return { ...prev, implementationResult: output as any };
              case 'commit':
                return { ...prev, commitHash: output as string };
              case 'pr':
                return { ...prev, prUrl: output as string };
              case 'review':
                return { ...prev, reviewResult: output as any };
              default:
                return prev;
            }
          });
        },
        onError: (err) => {
          setError(err);
        },
        onLog: (log) => {
          setLogs((prev) => [...prev, {
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
          }]);
        },
      });

      // 注册Phase执行器
      engine.registerPhase('analyze', new PhaseAnalyzer({ tfsClient }));
      engine.registerPhase('design', new PhaseDesigner({ aiService }));
      engine.registerPhase('plan', new PhasePlanner({ aiService }));
      // Phase 4-8 后续实现

      // 订阅事件
      unsubscribeFns.push(
        engine.on('phaseStart', (data) => {
          const { phase } = data as { phase: PhaseType };
          setCurrentPhase(phase);
        }),
        engine.on('started', (data) => {
          const { workItemId } = data as { workItemId: number };
          console.log(`自动化已启动: Work Item #${workItemId}`);
        }),
        engine.on('completed', () => {
          console.log('自动化已完成');
        }),
        engine.on('cancelled', () => {
          console.log('自动化已取消');
        })
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  };

  /**
   * 配置服务
   */
  const configure = (config: AutomationServiceConfig): void => {
    initializeEngine(config);
  };

  /**
   * 启动自动化
   */
  const start = async (workItemId: number): Promise<void> => {
    if (!engine) {
      // 尝试从本地存储加载配置
      const tfsConfig = TFSConfigManager.getConfig();
      if (!tfsConfig) {
        throw new Error('请先配置TFS和AI服务');
      }
      // 注意：AI配置也需要从某处获取
      throw new Error('请先调用configure配置AI服务');
    }

    setError(null);
    setLogs([]);
    
    try {
      await engine.start(workItemId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  /**
   * 暂停自动化
   */
  const pause = (): void => {
    engine?.pause();
  };

  /**
   * 恢复自动化
   */
  const resume = async (): Promise<void> => {
    try {
      await engine?.resume();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  /**
   * 取消自动化
   */
  const cancel = (): void => {
    engine?.cancel();
  };

  // 清理
  onCleanup(() => {
    unsubscribeFns.forEach(fn => fn());
    unsubscribeFns = [];
    engine = null;
  });

  return {
    // 状态
    state: automationState,
    currentPhase,
    workItem,
    progress,
    logs,
    isRunning,
    error,
    context,
    // 操作
    configure,
    start,
    pause,
    resume,
    cancel,
  };
}

export default useAutomation;
