// automation/types/automation.ts
// 自动化工作流核心类型定义

import type { TFSWorkItemFields } from './tfs';

/**
 * 自动化引擎主接口
 */
export interface AutomationEngine {
  id: string;
  workItemId: number;
  state: AutomationState;
  context: AutomationContext;
  currentPhase: PhaseType | null;
  phases: Phase[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 自动化状态
 */
export type AutomationState = 
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * 阶段类型
 */
export type PhaseType = 
  | 'analyze'
  | 'design'
  | 'plan'
  | 'implement'
  | 'commit'
  | 'review'
  | 'pr'
  | 'archive';

/**
 * 阶段定义
 */
export interface Phase {
  type: PhaseType;
  state: PhaseState;
  input: unknown;
  output: unknown;
  error?: Error;
  startedAt?: Date;
  completedAt?: Date;
  logs: PhaseLog[];
}

/**
 * 阶段状态
 */
export type PhaseState = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * 阶段日志
 */
export interface PhaseLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * 自动化上下文
 */
export interface AutomationContext {
  workItem: TFSWorkItem;
  repositories: RepositoryMatch[];
  designDocument?: DesignDocument;
  planDocument?: PlanDocument;
  implementationResult?: ImplementationResult;
  commitHash?: string;
  prUrl?: string;
  reviewResult?: ReviewResult;
}

/**
 * TFS工作项
 */
export interface TFSWorkItem {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria?: string;
  demandAnalysis?: string;
  state: string;
  type: string;
  priority: number;
  assignedTo: string;
  areaPath: string;
  iterationPath?: string;
  tags: string[];
  url: string;
}

/**
 * 仓库匹配结果
 */
export interface RepositoryMatch {
  id: string;
  name: string;
  path: string;
  description: string;
  reason: string;
  confidence: number;
  isPrimary: boolean;
}

/**
 * 设计文档
 */
export interface DesignDocument {
  overview: string;
  architecture: Architecture;
  interfaces: Interface[];
  dataModels: DataModel[];
  implementation: ImplementationDetail[];
  risks: Risk[];
  timeline: Timeline;
}

/**
 * 架构定义
 */
export interface Architecture {
  diagram: string;
  components: string[];
  dependencies: string[];
}

/**
 * 接口定义
 */
export interface Interface {
  name: string;
  method: string;
  path: string;
  description: string;
  request: RequestDefinition;
  response: ResponseDefinition;
  errors: ErrorDefinition[];
}

/**
 * 请求定义
 */
export interface RequestDefinition {
  parameters: Parameter[];
  body?: Schema;
}

/**
 * 响应定义
 */
export interface ResponseDefinition {
  statusCode: number;
  description: string;
  body?: Schema;
}

/**
 * 错误定义
 */
export interface ErrorDefinition {
  code: string;
  message: string;
  httpStatus: number;
}

/**
 * 参数定义
 */
export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

/**
 * 数据模型
 */
export interface DataModel {
  name: string;
  description: string;
  fields: Field[];
  relationships?: Relationship[];
}

/**
 * 字段定义
 */
export interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
  constraints?: string[];
}

/**
 * 关系定义
 */
export interface Relationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
  description: string;
}

/**
 * Schema定义
 */
export interface Schema {
  type: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  example?: unknown;
}

/**
 * Schema属性
 */
export interface SchemaProperty {
  type: string;
  description?: string;
  format?: string;
  enum?: unknown[];
  items?: Schema;
  $ref?: string;
}

/**
 * 实现细节
 */
export interface ImplementationDetail {
  title: string;
  description: string;
  codeExample?: string;
  considerations: string[];
}

/**
 * 风险定义
 */
export interface Risk {
  type: 'technical' | 'timeline' | 'resource';
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

/**
 * 时间线
 */
export interface Timeline {
  phases: TimelinePhase[];
  totalEstimate: string;
  milestones: Milestone[];
}

/**
 * 时间线阶段
 */
export interface TimelinePhase {
  name: string;
  description: string;
  estimate: string;
  dependencies: string[];
}

/**
 * 里程碑
 */
export interface Milestone {
  name: string;
  description: string;
  targetDate?: Date;
}

/**
 * 计划文档
 */
export interface PlanDocument {
  phases: PlanPhase[];
  totalEstimate: string;
  dependencies: Dependency[];
  parallelTasks: ParallelTaskGroup[];
}

/**
 * 计划阶段
 */
export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  steps: PlanStep[];
  estimatedTime: string;
  dependencies: string[];
}

/**
 * 计划步骤
 */
export interface PlanStep {
  id: string;
  order: number;
  title: string;
  description: string;
  command?: string;
  tool?: string;
  artifacts?: string[];
  acceptanceCriteria: string[];
  estimatedTime: string;
  dependencies: string[];
}

/**
 * 依赖定义
 */
export interface Dependency {
  from: string;
  to: string;
  type: 'hard' | 'soft';
}

/**
 * 并行任务组
 */
export interface ParallelTaskGroup {
  tasks: string[];
  maxConcurrency: number;
}

/**
 * 实现结果
 */
export interface ImplementationResult {
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  totalLinesChanged: number;
  testResults?: TestResult[];
}

/**
 * 测试结果
 */
export interface TestResult {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

/**
 * 审查结果
 */
export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  metrics: ReviewMetrics;
  recommendation: 'approve' | 'request_changes' | 'comment';
}

/**
 * 审查问题
 */
export interface ReviewIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'code-quality' | 'security' | 'performance' | 'maintainability' | 'style';
  title: string;
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

/**
 * 审查指标
 */
export interface ReviewMetrics {
  codeCoverage?: number;
  complexity: 'low' | 'medium' | 'high';
  duplication: number;
  securityScore: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * 引擎配置
 */
export interface EngineConfig {
  tfsClient: TFSClientInterface;
  aiService: AIServiceInterface;
  gitClient: GitClientInterface;
  onStateChange?: (state: AutomationState) => void;
  onPhaseComplete?: (phase: PhaseType, output: unknown) => void;
  onError?: (error: Error, phase: PhaseType | null) => void;
  onLog?: (log: PhaseLog) => void;
}

/**
 * TFS客户端接口
 */
export interface TFSClientInterface {
  getWorkItem(id: number): Promise<TFSWorkItem | null>;
  getWorkItems(ids: number[]): Promise<TFSWorkItem[]>;
  queryWorkItems(query: unknown): Promise<TFSWorkItem[]>;
  updateWorkItemState(id: number, state: string, comment?: string): Promise<boolean>;
}

/**
 * AI服务接口
 */
export interface AIServiceInterface {
  complete(request: unknown): Promise<{ content: string; usage?: unknown }>;
}

/**
 * Git客户端接口
 */
export interface GitClientInterface {
  status(): Promise<unknown>;
  add(files: string | string[]): Promise<void>;
  commit(message: string, options?: unknown): Promise<string>;
  push(remote?: string, branch?: string): Promise<void>;
}

export default {};
