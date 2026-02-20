// automation/index.ts
// 自动化模块主导出

// 核心
export { AutomationEngine } from './core/engine';
export { EventBus, globalEventBus } from './core/event-bus';

// TFS
export { TFSClient, TFSConfigManager } from './tfs';

// AI
export { AIService } from './ai';

// Git
export { GitClient } from './git';

// Forge
export { ForgeDocumentManager } from './forge';

// Phases
export { PhaseAnalyzer, PhaseDesigner, PhasePlanner } from './phases';

// Types
export type {
  AutomationEngine as IAutomationEngine,
  AutomationState,
  PhaseType,
  Phase,
  AutomationContext,
  TFSWorkItem,
  DesignDocument,
  PlanDocument,
  EngineConfig,
} from './types/automation';

export type {
  TFSConfig,
  TFSWorkItemQuery,
  TFSQueryError,
  TFSAuthError,
  TFSConnectionError,
} from './types/tfs';

export type {
  PhaseExecutor,
  PhaseResult,
  PhaseLogger,
  PhaseConfig,
} from './types/phase';

export type {
  AIServiceConfig,
  AICompletionRequest,
  AICompletionResponse,
} from './ai';

export type {
  GitConfig,
  CommitInfo,
  BranchInfo,
  GitStatus,
} from './git';

export type {
  ForgeTrack,
  IntentDocument,
  TasksDocument,
  VerificationDocument,
} from './forge';
