// types/requirement-analyzer.ts
// Task Center 需求智能分析器类型定义

/**
 * 解析后的需求信息
 */
export interface ParsedRequirement {
  /** TFS 工作项 ID */
  workItemId: number;
  /** 标题 */
  title: string;
  /** 描述（AI分析用的清理后文本） */
  description: string;
  /** 验收标准（AI分析用的清理后文本） */
  acceptanceCriteria: string;
  /** 需求分析内容（AI分析用的清理后文本） */
  demandAnalysis: string;
  /** 原始HTML格式描述（用于富文本显示） */
  rawDescription?: string;
  /** 原始HTML格式验收标准（用于富文本显示） */
  rawAcceptanceCriteria?: string;
  /** 原始HTML格式需求分析（用于富文本显示） */
  rawDemandAnalysis?: string;
  /** 领域路径（可选） */
  area?: string;
  /** AI 生成的摘要 */
  summary: string;
  /** 提取的关键功能点 */
  keyFeatures: string[];
  /** 技术栈指示器 */
  techIndicators: {
    frontend: boolean;
    backend: boolean;
    database: boolean;
  };
  /** 识别到的领域关键词 */
  domainKeywords: string[];
  /** 检测到的领域 ID */
  detectedDomain?: string | null;
}

/**
 * 仓库匹配结果
 */
export interface RepositoryMatch {
  /** 仓库唯一 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 本地路径 */
  path: string;
  /** 描述 */
  description: string;
  /** 匹配原因描述 */
  reason: string;
  /** 匹配置信度 0-1 */
  confidence: number;
  /** 是否为主要修改仓库 */
  isPrimary: boolean;
  /** AI 生成的理由（仅 AI 分析时存在） */
  aiReason?: string;
  /** AI 置信度（仅 AI 分析时存在） */
  aiConfidence?: number;
}

/**
 * AI 需求分析结果
 */
export interface AIAnalysisResult {
  /** AI 生成的摘要 */
  summary: string;
  /** 识别到的功能点 */
  keyFeatures: string[];
  /** 技术栈判断 */
  techStack: {
    frontend: boolean;
    backend: boolean;
    database: boolean;
  };
  /** 业务领域 */
  domain: string;
  /** 关键词 */
  keywords: string[];
}

/**
 * AI 仓库识别结果
 */
export interface AIRepoDetectionResult {
  /** 主要仓库（置信度 >= 80%） */
  primaryRepos: RepositoryMatch[];
  /** 次要仓库（置信度 >= 60%） */
  secondaryRepos: RepositoryMatch[];
  /** AI 分析说明 */
  analysis: string;
}

/**
 * AI 分析进度（用于 UI 展示，0-100）
 */
export interface AnalysisProgress {
  stage: 'fetching' | 'analyzing' | 'detecting_repos' | 'completed' | 'error';
  message: string;
  progress: number;
}

/**
 * 仓库识别结果（置信度 0-1）
 */
export interface DetectionResult {
  /** 主要修改的仓库 */
  primary: RepositoryMatch[];
  /** 次要影响的仓库 */
  secondary: RepositoryMatch[];
  /** 整体置信度（0-1） */
  confidence: number;
}

/**
 * 计划生成向导状态
 */
export interface PlanWizardState {
  /** 向导是否打开 */
  isOpen: boolean;
  /** 当前步骤 1/2/3 */
  step: 1 | 2 | 3;
  /** 当前处理的工作项ID */
  currentWorkItemId?: number;
  /** 解析后的需求 */
  requirement: ParsedRequirement | null;
  /** 识别到的仓库 */
  detection: DetectionResult | null;
  /** 用户选中的仓库 */
  selectedRepos: RepositoryMatch[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 生成进度 0-100 */
  generationProgress: number;
  /** 当前阶段 */
  stage?: string;
  /** 进度消息 */
  message?: string;
  /** 生成的文档内容 */
  intent?: string;
  design?: string;
  tasks?: string;
  /** 单步自动流程状态 */
  autoPlanStep?: 'idle' | 'analysis' | 'repos' | 'plan' | 'completed';
  autoPlanProgress?: number;
  /** 是否自动生成计划中 */
  isAutoGenerating?: boolean;
}

/**
 * JSON 配置：仓库配置项
 */
export interface RepositoryConfig {
  /** 仓库唯一 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 本地路径 */
  path: string;
  /** 描述 */
  description: string;
  /** 用于匹配的关键词列表 */
  keywords: string[];
  /** 技术栈标签 */
  techStack: string[];
  /** 权重（用于分数调整） */
  weight: number;
}

/**
 * JSON 配置：检测规则
 */
export interface DetectionRules {
  keywordScore: number;
  techStackScore: number;
  primaryThreshold: number;
  secondaryThreshold: number;
}

/**
 * JSON 配置：根结构
 */
export interface RepositoryIndex {
  repositories: RepositoryConfig[];
  rules: DetectionRules;
}

/**
 * 自动分析优先级
 */
export type AnalysisPriority = "high" | "normal" | "low";

/**
 * 队列项
 */
export interface AnalysisQueueItem {
  workItemId: number;
  priority: AnalysisPriority;
  attempts: number;
  enqueuedAt: number;
  lastError?: string;
}

/**
 * 队列状态
 */
export interface AnalysisQueueStatus {
  queueLength: number;
  isProcessing: boolean;
  currentWorkItemId?: number;
  estimatedTimeRemaining?: number;
}

/**
 * 自动分析结果
 */
export interface AnalysisResult {
  workItemId: number;
  requirement: ParsedRequirement;
  detection: DetectionResult;
  duration: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * 自动分析状态
 */
export interface TaskAutoAnalysisState {
  status: "idle" | "queued" | "analyzing" | "completed" | "failed";
  progress?: number;
  message?: string;
  result?: AnalysisResult;
  error?: string;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}
