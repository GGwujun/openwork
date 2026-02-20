# 全自动AI开发工作流 - 内嵌式核心开发计划

## 架构目标

**零Skill依赖，完全自包含**

所有核心逻辑内嵌到 `packages/app/src/automation/`，不依赖任何 `.opencode/skills/*`。

---

## 新架构概览

```
packages/app/src/
├── automation/                    # 🆕 自动化核心（新建）
│   ├── core/
│   │   ├── engine.ts             # 自动化引擎主控
│   │   ├── state-machine.ts      # 状态机管理
│   │   └── event-bus.ts          # 事件总线
│   ├── phases/                    # 8阶段实现
│   │   ├── phase-1-analyzer.ts   # 需求分析 ✅ 已存在
│   │   ├── phase-2-designer.ts   # 设计生成
│   │   ├── phase-3-planner.ts    # 计划生成
│   │   ├── phase-4-implementer.ts # 代码实现
│   │   ├── phase-5-committer.ts  # 代码提交
│   │   ├── phase-6-reviewer.ts   # 代码审查
│   │   ├── phase-7-pr-creator.ts # PR创建
│   │   └── phase-8-archiver.ts   # 归档完成
│   ├── tfs/                       # TFS客户端（迁移）
│   │   ├── client.ts
│   │   ├── types.ts
│   │   ├── queries.ts
│   │   └── config.ts
│   ├── ai/                        # AI服务封装
│   │   ├── service.ts
│   │   ├── prompts/
│   │   │   ├── design-prompt.ts
│   │   │   ├── plan-prompt.ts
│   │   │   └── implement-prompt.ts
│   │   └── parsers/
│   │       ├── design-parser.ts
│   │       └── plan-parser.ts
│   ├── git/                       # Git操作封装
│   │   ├── client.ts
│   │   └── operations.ts
│   ├── forge/                     # Forge文档管理
│   │   ├── document-manager.ts
│   │   ├── template-engine.ts
│   │   └── types.ts
│   └── types/
│       ├── automation.ts
│       ├── tfs.ts
│       └── phase.ts
│
├── config/
│   ├── repositories.json          # ✅ 已存在
│   └── automation.config.ts       # 🆕 自动化配置
│
├── api/                           
│   └── requirement-analyzer/      # ✅ 已存在
│       └── index.ts
│
└── app/
    └── components/
        └── requirement-wizard/    # ✅ 已存在
            ├── index.tsx
            ├── StepAnalysis.tsx
            ├── StepRepository.tsx
            └── StepGeneration.tsx
```

---

## Phase 0: 创建内嵌式核心架构基础

### Task 0.1: 创建目录结构
```bash
mkdir -p packages/app/src/automation/{core,phases,tfs,ai/{prompts,parsers},git,forge,types}
```

**验证标准**：目录结构创建完成 ✅

---

### Task 0.2: 创建核心类型定义
**文件**: `packages/app/src/automation/types/automation.ts`

```typescript
// 自动化工作流核心类型

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

export type AutomationState = 
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PhaseType = 
  | 'analyze'
  | 'design'
  | 'plan'
  | 'implement'
  | 'commit'
  | 'review'
  | 'pr'
  | 'archive';

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

export type PhaseState = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PhaseLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

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

export interface TFSWorkItem {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria?: string;
  state: string;
  type: string;
  priority: number;
  assignedTo: string;
  areaPath: string;
  iterationPath?: string;
  tags: string[];
  url: string;
}

export interface DesignDocument {
  overview: string;
  architecture: Architecture;
  interfaces: Interface[];
  dataModels: DataModel[];
  implementation: ImplementationDetail[];
  risks: Risk[];
  timeline: Timeline;
}

export interface PlanDocument {
  phases: PlanPhase[];
  totalEstimate: string;
  dependencies: Dependency[];
}

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  steps: PlanStep[];
  estimatedTime: string;
}

export interface PlanStep {
  id: string;
  order: number;
  title: string;
  description: string;
  command?: string;
  acceptanceCriteria: string[];
  estimatedTime: string;
}
```

**验证标准**: TypeScript编译通过 ✅

---

## Phase 1: 内嵌TFS客户端 (替代tfs2018-integration skill)

### Task 1.1: 创建TFS类型定义
**文件**: `packages/app/src/automation/types/tfs.ts`

```typescript
// TFS 2018 API 类型定义

export interface TFSConfig {
  serverUrl: string;
  pat: string;
  username?: string;
}

export interface TFSWorkItemQuery {
  id?: number;
  project?: string;
  states?: string[];
  assignedTo?: string;
  workItemTypes?: string[];
  top?: number;
  days?: number;
}

export interface TFSWorkItemFields {
  'System.Id': number;
  'System.Title': string;
  'System.Description': string;
  'System.State': string;
  'System.WorkItemType': string;
  'System.AssignedTo': string;
  'System.AreaPath': string;
  'System.IterationPath'?: string;
  'System.Tags'?: string;
  'Microsoft.VSTS.Common.Priority'?: number;
  'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
  'Winning.Demand.Analysis'?: string;
}

export interface TFSWorkItemResponse {
  id: number;
  rev: number;
  fields: Partial<TFSWorkItemFields>;
  url: string;
}

export interface TFSWiqlQueryResult {
  workItems: Array<{ id: number; url: string }>;
}
```

---

### Task 1.2: 实现TFS客户端
**文件**: `packages/app/src/automation/tfs/client.ts`

```typescript
import { TFSConfig, TFSWorkItemQuery, TFSWorkItemResponse } from '../types/tfs';
import { TFSWorkItem } from '../types/automation';

export class TFSClient {
  private config: TFSConfig;
  private baseUrl: string;

  constructor(config: TFSConfig) {
    this.config = config;
    this.baseUrl = `${config.serverUrl}/_apis/wit`;
  }

  /**
   * 获取单个工作项详情
   */
  async getWorkItem(id: number): Promise<TFSWorkItem | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/workitems/${id}?api-version=4.1`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`:${this.config.pat}`)}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`TFS API error: ${response.status}`);
      }

      const data: TFSWorkItemResponse = await response.json();
      return this.transformWorkItem(data);
    } catch (error) {
      console.error(`Failed to get work item ${id}:`, error);
      return null;
    }
  }

  /**
   * 查询工作项列表
   */
  async queryWorkItems(query: TFSWorkItemQuery): Promise<TFSWorkItem[]> {
    const wiql = this.buildWiqlQuery(query);
    
    try {
      const response = await fetch(
        `${this.baseUrl}/wiql?api-version=4.1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`:${this.config.pat}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: wiql }),
        }
      );

      if (!response.ok) {
        throw new Error(`TFS WIQL query error: ${response.status}`);
      }

      const result = await response.json();
      const ids = result.workItems?.map((wi: { id: number }) => wi.id) || [];
      
      if (ids.length === 0) return [];
      
      // 批量获取工作项详情
      return await this.getWorkItemsBatch(ids);
    } catch (error) {
      console.error('Failed to query work items:', error);
      return [];
    }
  }

  /**
   * 更新工作项状态
   */
  async updateWorkItemState(
    id: number, 
    newState: string, 
    comment?: string
  ): Promise<boolean> {
    try {
      const document: Array<{ op: string; path: string; value: unknown }> = [
        { op: 'replace', path: '/fields/System.State', value: newState }
      ];

      if (comment) {
        document.push({
          op: 'add',
          path: '/fields/System.History',
          value: comment
        });
      }

      const response = await fetch(
        `${this.baseUrl}/workitems/${id}?api-version=4.1`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Basic ${btoa(`:${this.config.pat}`)}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: JSON.stringify(document),
        }
      );

      return response.ok;
    } catch (error) {
      console.error(`Failed to update work item ${id}:`, error);
      return false;
    }
  }

  /**
   * 批量获取工作项
   */
  private async getWorkItemsBatch(ids: number[]): Promise<TFSWorkItem[]> {
    if (ids.length === 0) return [];
    
    try {
      const response = await fetch(
        `${this.baseUrl}/workitems?ids=${ids.join(',')}&api-version=4.1`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`:${this.config.pat}`)}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Batch fetch error: ${response.status}`);
      }

      const data = await response.json();
      return data.value?.map((item: TFSWorkItemResponse) => 
        this.transformWorkItem(item)
      ) || [];
    } catch (error) {
      console.error('Failed to batch fetch work items:', error);
      return [];
    }
  }

  /**
   * 构建WIQL查询
   */
  private buildWiqlQuery(query: TFSWorkItemQuery): string {
    const conditions: string[] = [];
    
    if (query.project) {
      conditions.push(`[System.TeamProject] = '${query.project}'`);
    }
    
    if (query.states && query.states.length > 0) {
      const stateConditions = query.states
        .map(s => `[System.State] = '${s}'`)
        .join(' OR ');
      conditions.push(`(${stateConditions})`);
    }
    
    if (query.assignedTo) {
      conditions.push(`[System.AssignedTo] = '${query.assignedTo}'`);
    }
    
    if (query.workItemTypes && query.workItemTypes.length > 0) {
      const typeConditions = query.workItemTypes
        .map(t => `[System.WorkItemType] = '${t}'`)
        .join(' OR ');
      conditions.push(`(${typeConditions})`);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    return `
      SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType]
      FROM workitems
      ${whereClause}
      ORDER BY [System.ChangedDate] DESC
    `;
  }

  /**
   * 转换工作项格式
   */
  private transformWorkItem(data: TFSWorkItemResponse): TFSWorkItem {
    const fields = data.fields || {};
    
    return {
      id: data.id,
      title: fields['System.Title'] || '',
      description: fields['System.Description'] || '',
      acceptanceCriteria: fields['Microsoft.VSTS.Common.AcceptanceCriteria'],
      state: fields['System.State'] || '',
      type: fields['System.WorkItemType'] || '',
      priority: fields['Microsoft.VSTS.Common.Priority'] || 2,
      assignedTo: fields['System.AssignedTo'] || '',
      areaPath: fields['System.AreaPath'] || '',
      iterationPath: fields['System.IterationPath'],
      tags: fields['System.Tags']?.split(';').map(t => t.trim()) || [],
      url: data.url,
    };
  }
}

export default TFSClient;
```

---

### Task 1.3: 创建TFS配置管理
**文件**: `packages/app/src/automation/tfs/config.ts`

```typescript
import { TFSConfig } from '../types/tfs';

const CONFIG_KEY = 'automation:tfs:config';

export class TFSConfigManager {
  /**
   * 获取配置
   */
  static getConfig(): TFSConfig | null {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * 保存配置
   */
  static saveConfig(config: TFSConfig): void {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  /**
   * 清除配置
   */
  static clearConfig(): void {
    localStorage.removeItem(CONFIG_KEY);
  }

  /**
   * 验证配置
   */
  static validateConfig(config: Partial<TFSConfig>): string[] {
    const errors: string[] = [];
    
    if (!config.serverUrl) {
      errors.push('Server URL is required');
    }
    
    if (!config.pat) {
      errors.push('Personal Access Token is required');
    }
    
    return errors;
  }
}

export default TFSConfigManager;
```

**验证标准**: TFS客户端可以成功调用API ✅

---

## Phase 2: 内嵌自动化引擎核心

### Task 2.1: 实现自动化引擎
**文件**: `packages/app/src/automation/core/engine.ts`

```typescript
import { 
  AutomationEngine as IAutomationEngine,
  AutomationState,
  PhaseType,
  Phase,
  AutomationContext,
  TFSWorkItem 
} from '../types/automation';
import { TFSClient } from '../tfs/client';
import { PhaseAnalyzer } from '../phases/phase-1-analyzer';
import { PhaseDesigner } from '../phases/phase-2-designer';
import { PhasePlanner } from '../phases/phase-3-planner';
import { PhaseImplementer } from '../phases/phase-4-implementer';
import { PhaseCommitter } from '../phases/phase-5-committer';
import { PhaseReviewer } from '../phases/phase-6-reviewer';
import { PhasePRCreator } from '../phases/phase-7-pr-creator';
import { PhaseArchiver } from '../phases/phase-8-archiver';
import { EventEmitter } from './event-bus';

export interface EngineConfig {
  tfsClient: TFSClient;
  aiService: AIService;
  gitClient: GitClient;
  onStateChange?: (state: AutomationState) => void;
  onPhaseComplete?: (phase: PhaseType, output: unknown) => void;
  onError?: (error: Error, phase: PhaseType) => void;
}

export class AutomationEngine extends EventEmitter {
  private config: EngineConfig;
  private state: IAutomationEngine | null = null;
  private phases: Map<PhaseType, PhaseExecutor> = new Map();

  constructor(config: EngineConfig) {
    super();
    this.config = config;
    this.initializePhases();
  }

  /**
   * 启动自动化工作流
   */
  async start(workItemId: number): Promise<void> {
    // 1. 获取工作项
    const workItem = await this.config.tfsClient.getWorkItem(workItemId);
    if (!workItem) {
      throw new Error(`Work item ${workItemId} not found`);
    }

    // 2. 初始化状态
    this.state = {
      id: `automation-${Date.now()}`,
      workItemId,
      state: 'running',
      context: { workItem, repositories: [] },
      currentPhase: null,
      phases: this.createPhases(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 3. 执行各阶段
    await this.executePhases();
  }

  /**
   * 暂停工作流
   */
  pause(): void {
    if (this.state) {
      this.state.state = 'paused';
      this.emit('stateChange', 'paused');
    }
  }

  /**
   * 恢复工作流
   */
  async resume(): Promise<void> {
    if (this.state && this.state.state === 'paused') {
      this.state.state = 'running';
      this.emit('stateChange', 'running');
      await this.executePhases();
    }
  }

  /**
   * 取消工作流
   */
  cancel(): void {
    if (this.state) {
      this.state.state = 'cancelled';
      this.emit('stateChange', 'cancelled');
    }
  }

  /**
   * 获取当前状态
   */
  getState(): IAutomationEngine | null {
    return this.state;
  }

  /**
   * 初始化各阶段执行器
   */
  private initializePhases(): void {
    this.phases.set('analyze', new PhaseAnalyzer(this.config));
    this.phases.set('design', new PhaseDesigner(this.config));
    this.phases.set('plan', new PhasePlanner(this.config));
    this.phases.set('implement', new PhaseImplementer(this.config));
    this.phases.set('commit', new PhaseCommitter(this.config));
    this.phases.set('review', new PhaseReviewer(this.config));
    this.phases.set('pr', new PhasePRCreator(this.config));
    this.phases.set('archive', new PhaseArchiver(this.config));
  }

  /**
   * 创建阶段列表
   */
  private createPhases(): Phase[] {
    const phaseTypes: PhaseType[] = [
      'analyze', 'design', 'plan', 'implement', 
      'commit', 'review', 'pr', 'archive'
    ];

    return phaseTypes.map(type => ({
      type,
      state: 'pending',
      input: null,
      output: null,
      logs: [],
    }));
  }

  /**
   * 顺序执行各阶段
   */
  private async executePhases(): Promise<void> {
    if (!this.state) return;

    const phaseOrder: PhaseType[] = [
      'analyze', 'design', 'plan', 'implement', 
      'commit', 'review', 'pr', 'archive'
    ];

    for (const phaseType of phaseOrder) {
      // 检查是否被取消
      if (this.state.state === 'cancelled') break;

      // 检查是否暂停
      if (this.state.state === 'paused') {
        this.emit('paused', phaseType);
        return;
      }

      await this.executePhase(phaseType);
    }

    // 标记完成
    if (this.state.state !== 'cancelled') {
      this.state.state = 'completed';
      this.emit('completed', this.state);
    }
  }

  /**
   * 执行单个阶段
   */
  private async executePhase(phaseType: PhaseType): Promise<void> {
    if (!this.state) return;

    const phase = this.state.phases.find(p => p.type === phaseType);
    if (!phase || phase.state === 'completed') return;

    const executor = this.phases.get(phaseType);
    if (!executor) return;

    // 更新状态
    this.state.currentPhase = phaseType;
    phase.state = 'running';
    phase.startedAt = new Date();
    this.emit('phaseStart', phaseType);

    try {
      // 执行阶段
      const result = await executor.execute(this.state.context);
      
      // 更新上下文
      this.updateContext(phaseType, result);
      
      // 标记完成
      phase.state = 'completed';
      phase.output = result;
      phase.completedAt = new Date();
      
      this.emit('phaseComplete', phaseType, result);
      
      if (this.config.onPhaseComplete) {
        this.config.onPhaseComplete(phaseType, result);
      }
    } catch (error) {
      phase.state = 'failed';
      phase.error = error as Error;
      
      this.state.state = 'failed';
      this.emit('error', error, phaseType);
      
      if (this.config.onError) {
        this.config.onError(error as Error, phaseType);
      }
      
      throw error;
    }
  }

  /**
   * 更新上下文
   */
  private updateContext(phaseType: PhaseType, result: unknown): void {
    if (!this.state) return;

    switch (phaseType) {
      case 'analyze':
        this.state.context.repositories = (result as any).repositories;
        break;
      case 'design':
        this.state.context.designDocument = result as any;
        break;
      case 'plan':
        this.state.context.planDocument = result as any;
        break;
      case 'implement':
        this.state.context.implementationResult = result as any;
        break;
      case 'commit':
        this.state.context.commitHash = result as string;
        break;
      case 'pr':
        this.state.context.prUrl = result as string;
        break;
      case 'review':
        this.state.context.reviewResult = result as any;
        break;
    }

    this.state.updatedAt = new Date();
  }
}

interface PhaseExecutor {
  execute(context: AutomationContext): Promise<unknown>;
}

export default AutomationEngine;
```

---

### Task 2.2: 实现事件总线
**文件**: `packages/app/src/automation/core/event-bus.ts`

```typescript
type EventHandler = (data?: unknown) => void;

export class EventEmitter {
  private events: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: unknown): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

export default EventEmitter;
```

**验证标准**: 引擎可以顺序执行各阶段 ✅

---

## Phase 3: 内嵌计划生成器 (替代task-automation)

### Task 3.1: 实现AI服务封装
**文件**: `packages/app/src/automation/ai/service.ts`

```typescript
export interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AICompletionRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AICompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
  }

  /**
   * 发送completion请求
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(request);
      case 'anthropic':
        return this.callAnthropic(request);
      case 'local':
        return this.callLocal(request);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async callOpenAI(request: AICompletionRequest): Promise<AICompletionResponse> {
    const response = await fetch(
      this.config.baseUrl || 'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
            { role: 'user', content: request.prompt }
          ],
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage,
    };
  }

  private async callAnthropic(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Anthropic API实现
    throw new Error('Anthropic implementation pending');
  }

  private async callLocal(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Local LLM实现
    throw new Error('Local LLM implementation pending');
  }
}

export default AIService;
```

---

### Task 3.2: 实现设计阶段
**文件**: `packages/app/src/automation/phases/phase-2-designer.ts`

```typescript
import { AutomationContext, DesignDocument } from '../types/automation';
import { AIService } from '../ai/service';
import { buildDesignPrompt } from '../ai/prompts/design-prompt';
import { parseDesignDocument } from '../ai/parsers/design-parser';

export class PhaseDesigner {
  private aiService: AIService;

  constructor(config: { aiService: AIService }) {
    this.aiService = config.aiService;
  }

  async execute(context: AutomationContext): Promise<DesignDocument> {
    const { workItem, repositories } = context;

    // 1. 构建prompt
    const prompt = buildDesignPrompt(workItem, repositories);

    // 2. 调用AI生成设计
    const response = await this.aiService.complete({
      prompt,
      temperature: 0.7,
      maxTokens: 4000,
      systemPrompt: 'You are a senior software architect. Generate detailed technical design documents.',
    });

    // 3. 解析设计文档
    const design = parseDesignDocument(response.content);

    // 4. 保存到Forge目录
    await this.saveDesignDocument(workItem.id, design);

    return design;
  }

  private async saveDesignDocument(workItemId: number, design: DesignDocument): Promise<void> {
    // 通过Forge Document Manager保存
    // 实现见Task 4.1
  }
}

export default PhaseDesigner;
```

---

### Task 3.3: 创建设计Prompt模板
**文件**: `packages/app/src/automation/ai/prompts/design-prompt.ts`

```typescript
import { TFSWorkItem } from '../../types/automation';
import { RepositoryMatch } from '../../../types/requirement-analyzer';

export function buildDesignPrompt(
  workItem: TFSWorkItem,
  repositories: RepositoryMatch[]
): string {
  return `
# 任务
为以下TFS工作项创建详细的技术设计文档。

## TFS工作项信息
- ID: ${workItem.id}
- 标题: ${workItem.title}
- 类型: ${workItem.type}
- 优先级: P${workItem.priority}
- 描述: ${workItem.description}
${workItem.acceptanceCriteria ? `- 验收标准: ${workItem.acceptanceCriteria}` : ''}

## 目标仓库
${repositories.map(r => `- ${r.name}: ${r.description} (${r.reason})`).join('\n')}

## 输出格式
请生成符合以下结构的设计文档：

\`\`\`markdown
# [标题] - 技术设计

## 概述
- 需求总结（1-2句话）
- 技术方案选择
- 实施范围

## 架构设计
- 系统架构图（使用mermaid语法）
- 组件划分
- 模块依赖关系

## 接口设计
对于每个新增/修改的接口：
- 接口名称
- HTTP方法和路径
- 请求参数（表格格式）
- 响应格式（JSON示例）
- 错误码定义

## 数据模型
- 新增/修改的数据结构
- 数据库表变更（SQL）
- 数据流说明

## 技术实现细节
- 核心算法或业务逻辑
- 关键代码片段（伪代码）
- 性能考虑
- 安全措施

## 测试策略
- 单元测试范围
- 集成测试场景
- 边界条件测试

## 风险评估
| 风险类型 | 描述 | 缓解措施 |
|---------|------|---------|
| 技术风险 | ... | ... |
| 时间风险 | ... | ... |

## 时间估算
- 各阶段工时估算
- 总工时
- 关键里程碑
\`\`\`

请生成完整、详细的技术设计文档，使用中文。
`;
}

export default buildDesignPrompt;
```

---

### Task 3.4: 实现计划阶段
**文件**: `packages/app/src/automation/phases/phase-3-planner.ts`

```typescript
import { AutomationContext, PlanDocument, PlanPhase, PlanStep } from '../types/automation';
import { AIService } from '../ai/service';
import { buildPlanPrompt } from '../ai/prompts/plan-prompt';
import { parsePlanDocument } from '../ai/parsers/plan-parser';

export class PhasePlanner {
  private aiService: AIService;

  constructor(config: { aiService: AIService }) {
    this.aiService = config.aiService;
  }

  async execute(context: AutomationContext): Promise<PlanDocument> {
    const { workItem, designDocument } = context;

    if (!designDocument) {
      throw new Error('Design document is required for planning');
    }

    // 1. 构建prompt
    const prompt = buildPlanPrompt(workItem, designDocument);

    // 2. 调用AI生成计划
    const response = await this.aiService.complete({
      prompt,
      temperature: 0.5,
      maxTokens: 4000,
      systemPrompt: 'You are a technical project manager. Create detailed implementation plans with specific, actionable steps.',
    });

    // 3. 解析计划文档
    const plan = parsePlanDocument(response.content);

    // 4. 保存到Forge目录
    await this.savePlanDocument(workItem.id, plan);

    return plan;
  }

  private async savePlanDocument(workItemId: number, plan: PlanDocument): Promise<void> {
    // 通过Forge Document Manager保存
  }
}

export default PhasePlanner;
```

**验证标准**: AI可以生成结构化的设计和计划文档 ✅

---

## Phase 4: 内嵌任务执行器

### Task 4.1: 实现Git客户端
**文件**: `packages/app/src/automation/git/client.ts`

```typescript
export interface GitConfig {
  repoPath: string;
  userName: string;
  userEmail: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
  files: string[];
}

export class GitClient {
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = config;
  }

  /**
   * 执行Git命令
   */
  private async execGit(args: string[]): Promise<string> {
    const command = new Command('git', args, { cwd: this.config.repoPath });
    const output = await command.execute();
    return output.stdout;
  }

  /**
   * 创建新分支
   */
  async createBranch(branchName: string, baseBranch: string = 'main'): Promise<void> {
    await this.execGit(['checkout', '-b', branchName, baseBranch]);
  }

  /**
   * 添加文件到暂存区
   */
  async add(files: string | string[]): Promise<void> {
    const fileList = Array.isArray(files) ? files : [files];
    await this.execGit(['add', ...fileList]);
  }

  /**
   * 提交更改
   */
  async commit(message: string, options?: { 
    body?: string;
    relatedWorkItem?: number;
  }): Promise<string> {
    let fullMessage = message;
    
    if (options?.body) {
      fullMessage += `\n\n${options.body}`;
    }
    
    if (options?.relatedWorkItem) {
      fullMessage += `\n\nRelated-TFS-Work-Item: #${options.relatedWorkItem}`;
    }

    await this.execGit(['commit', '-m', fullMessage]);
    
    // 获取提交的hash
    const hash = await this.execGit(['rev-parse', 'HEAD']);
    return hash.trim();
  }

  /**
   * 推送分支
   */
  async push(remote: string = 'origin', branch?: string): Promise<void> {
    const args = ['push', remote];
    if (branch) args.push(branch);
    await this.execGit(args);
  }

  /**
   * 获取状态
   */
  async status(): Promise<{ modified: string[]; added: string[]; deleted: string[] }> {
    const output = await this.execGit(['status', '--porcelain']);
    const lines = output.trim().split('\n').filter(Boolean);
    
    const result = { modified: [], added: [], deleted: [] };
    
    for (const line of lines) {
      const status = line.slice(0, 2);
      const file = line.slice(3);
      
      if (status.includes('M')) result.modified.push(file);
      if (status.includes('A')) result.added.push(file);
      if (status.includes('D')) result.deleted.push(file);
    }
    
    return result;
  }
}

export default GitClient;
```

---

### Task 4.2: 实现Forge文档管理器
**文件**: `packages/app/src/automation/forge/document-manager.ts`

```typescript
import { DesignDocument, PlanDocument } from '../types/automation';

export interface ForgeTrack {
  id: string;
  path: string;
  intent: IntentDocument;
  design: DesignDocument;
  tasks: TasksDocument;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntentDocument {
  why: string;
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
  successCriteria: string[];
  implementationApproach: string;
  risks: Array<{
    description: string;
    probability: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    mitigation: string;
  }>;
  timeEstimate: string;
}

export interface TasksDocument {
  phases: Array<{
    name: string;
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: 'pending' | 'in_progress' | 'completed';
      estimatedTime: string;
      dependencies: string[];
    }>;
  }>;
}

export class ForgeDocumentManager {
  private basePath: string;

  constructor(basePath: string = 'forge/tracks') {
    this.basePath = basePath;
  }

  /**
   * 创建新的Track
   */
  async createTrack(workItemId: number, title: string): Promise<string> {
    const trackId = `tfs-${workItemId}`;
    const trackPath = `${this.basePath}/${trackId}`;
    
    // 创建目录
    await this.ensureDir(trackPath);
    
    return trackPath;
  }

  /**
   * 保存Intent文档
   */
  async saveIntent(trackPath: string, intent: IntentDocument): Promise<void> {
    const content = this.renderIntentMarkdown(intent);
    await this.writeFile(`${trackPath}/intent.md`, content);
  }

  /**
   * 保存Design文档
   */
  async saveDesign(trackPath: string, design: DesignDocument): Promise<void> {
    const content = this.renderDesignMarkdown(design);
    await this.writeFile(`${trackPath}/design.md`, content);
  }

  /**
   * 保存Tasks文档
   */
  async saveTasks(trackPath: string, tasks: TasksDocument): Promise<void> {
    const content = this.renderTasksMarkdown(tasks);
    await this.writeFile(`${trackPath}/tasks.md`, content);
  }

  /**
   * 读取Track
   */
  async readTrack(trackId: string): Promise<ForgeTrack | null> {
    const trackPath = `${this.basePath}/${trackId}`;
    
    try {
      // 解析各文档
      const intent = await this.parseIntent(`${trackPath}/intent.md`);
      const design = await this.parseDesign(`${trackPath}/design.md`);
      const tasks = await this.parseTasks(`${trackPath}/tasks.md`);
      
      return {
        id: trackId,
        path: trackPath,
        intent,
        design,
        tasks,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      return null;
    }
  }

  private renderIntentMarkdown(intent: IntentDocument): string {
    return `# Intent

## Why
${intent.why}

## Scope

### In Scope
${intent.scope.inScope.map(item => `- ${item}`).join('\n')}

### Out of Scope
${intent.scope.outOfScope.map(item => `- ${item}`).join('\n')}

## Success Criteria
${intent.successCriteria.map(criteria => `- ${criteria}`).join('\n')}

## Implementation Approach
${intent.implementationApproach}

## Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
${intent.risks.map(r => `| ${r.description} | ${r.probability} | ${r.impact} | ${r.mitigation} |`).join('\n')}

## Time Estimate
${intent.timeEstimate}
`;
  }

  private async ensureDir(path: string): Promise<void> {
    // 使用Tauri fs API或Node.js fs
  }

  private async writeFile(path: string, content: string): Promise<void> {
    // 使用Tauri fs API或Node.js fs
  }

  private async parseIntent(path: string): Promise<IntentDocument> {
    // 解析Markdown为结构化数据
    throw new Error('Not implemented');
  }

  private async parseDesign(path: string): Promise<DesignDocument> {
    throw new Error('Not implemented');
  }

  private async parseTasks(path: string): Promise<TasksDocument> {
    throw new Error('Not implemented');
  }
}

export default ForgeDocumentManager;
```

**验证标准**: 可以创建和管理Forge文档结构 ✅

---

## Phase 5: 集成到Task Center

### Task 5.1: 更新Task Center Store
**修改文件**: `packages/app/src/app/context/task-center.ts`

添加自动化引擎集成：

```typescript
import { AutomationEngine } from '../../automation/core/engine';
import { TFSClient } from '../../automation/tfs/client';
import { AIService } from '../../automation/ai/service';
import { TFSConfigManager } from '../../automation/tfs/config';

// 在store中添加
interface TaskCenterState {
  // ... 现有状态
  automation: {
    engine: AutomationEngine | null;
    isRunning: boolean;
    currentPhase: string | null;
    progress: number;
    logs: string[];
  };
}

// 新增actions
automationActions: {
  initialize: () => void;
  startAutomation: (workItemId: number) => Promise<void>;
  pauseAutomation: () => void;
  resumeAutomation: () => Promise<void>;
  cancelAutomation: () => void;
}
```

---

### Task 5.2: 移除Skill依赖
**检查清单**:

- [ ] 删除 `task-automation` skill 调用
- [ ] 删除 `tfs2018-integration` skill 调用  
- [ ] 删除 `forge-orchestrator` skill 调用
- [ ] 更新所有import路径
- [ ] 验证功能等效性

---

## Phase 6: 端到端测试

### Task 6.1: 单元测试
```typescript
// 测试文件示例

// TFS Client测试
describe('TFSClient', () => {
  it('should fetch work item by id', async () => {
    // Mock TFS API响应
    // 验证转换逻辑
  });
});

// Automation Engine测试
describe('AutomationEngine', () => {
  it('should execute all phases sequentially', async () => {
    // Mock各phase
    // 验证执行顺序
  });
});
```

### Task 6.2: 集成测试
- [ ] 完整工作流：TFS → 分析 → 设计 → 计划 → 文档生成
- [ ] 错误恢复：各阶段失败后的状态管理
- [ ] 暂停/恢复：长时间任务的中断处理

### Task 6.3: E2E测试场景
1. **正常流程**：门诊系统需求 → 自动识别仓库 → 生成完整计划
2. **多仓库需求**：涉及前后端的需求 → 正确识别多个仓库
3. **错误处理**：TFS连接失败 → 显示错误 → 重试成功
4. **暂停恢复**：长时间计划生成 → 暂停 → 恢复 → 完成

---

## 技术选型总结

### 内嵌组件 vs Skill对比

| 功能 | 原Skill | 内嵌实现 | 状态 |
|------|---------|----------|------|
| TFS客户端 | tfs2018-integration | TFSClient类 | 🔄 Phase 1 |
| 需求分析 | task-automation Phase 1 | RequirementAnalyzer | ✅ 已存在 |
| 设计生成 | task-automation Phase 2 | PhaseDesigner | 🔄 Phase 3 |
| 计划生成 | task-automation Phase 3 | PhasePlanner | 🔄 Phase 3 |
| 代码实现 | task-automation Phase 4 | PhaseImplementer | 🔄 Phase 4 |
| Git操作 | task-automation Phase 5 | GitClient | 🔄 Phase 4 |
| 工作流编排 | forge-orchestrator | AutomationEngine | 🔄 Phase 2 |
| 文档管理 | forge contracts | ForgeDocumentManager | 🔄 Phase 4 |

### 新增依赖
- **无外部Skill依赖**
- 仅使用原生API：
  - `fetch` - TFS API调用
  - `localStorage` - 配置存储
  - Tauri API - 文件系统操作

---

## 时间估算

| Phase | 任务数 | 预估时间 | 关键产出 |
|-------|--------|----------|----------|
| Phase 0 | 2 | 2h | 架构基础 |
| Phase 1 | 3 | 6h | TFS客户端 |
| Phase 2 | 2 | 6h | 自动化引擎 |
| Phase 3 | 4 | 10h | AI生成器 |
| Phase 4 | 3 | 8h | 执行器 |
| Phase 5 | 2 | 4h | 集成 |
| Phase 6 | 3 | 6h | 测试验证 |
| **总计** | **19** | **~42h** | 完整系统 |

---

## 风险与缓解

| 风险 | 概率 | 缓解措施 |
|------|------|----------|
| AI生成质量不稳定 | 中 | 添加验证和回退机制 |
| TFS API限制 | 低 | 实现指数退避重试 |
| Git操作权限 | 中 | 前置权限检查和用户确认 |
| 长时间任务中断 | 中 | 状态持久化，支持恢复 |

---

**结论**：这个内嵌式核心方案将创建一个完全自包含、零外部依赖的全自动AI开发工作流系统，所有核心逻辑都在 `packages/app/src/automation/` 内，易于测试、维护和部署。
