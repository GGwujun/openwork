# Design: TFS需求开发计划执行器

## Overview

本文档描述如何通过**Prompt Engineering**让OpenCode使用Forge skills执行已生成的开发计划。

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenWork Task Center                    │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Plan Execution Orchestrator               │  │
│  │                                                        │  │
│  │  1. Prompt Builder (构建execution prompt)             │  │
│  │  2. Session Manager (管理OpenCode session)            │  │
│  │  3. Progress Monitor (监控执行进度)                   │  │
│  │  4. TFS Sync (同步TFS状态)                            │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 1. 创建Session
                         │ 2. 发送Prompt
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenCode AI (with Forge Skills)                 │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Execution Prompt                          │  │
│  │                                                        │  │
│  │  "请使用 forge-execute skill 执行以下计划..."         │  │
│  │                                                        │  │
│  │  包含：                                                │  │
│  │  - 计划路径 (forge/tracks/tfs-{id}/)                  │  │
│  │  - 执行要求                                            │  │
│  │  - 进度报告方式                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Forge Skills Execution                    │  │
│  │                                                        │  │
│  │  自动读取并执行：                                      │  │
│  │  • using-git-worktrees → 准备工作区                   │  │
│  │  • forge-execute → 选择执行模式                       │  │
│  │  • executing-plans / subagent-driven-development     │  │
│  │    → 执行tasks.md中的每个任务                         │  │
│  │  • finishing-a-development-branch → 完成提交         │  │
│  │                                                        │  │
│  │  自动处理：                                            │  │
│  │  ✓ 代码生成                                            │  │
│  │  ✓ 代码审查 (subagents)                               │  │
│  │  ✓ 测试运行                                            │  │
│  │  ✓ Git提交                                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Execution Results                         │  │
│  │  - 完成状态                                            │  │
│  │  - 执行日志                                            │  │
│  │  - 生成的文件列表                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. Prompt Builder (Prompt构建器)

**职责**: 构建高质量的execution prompt

```typescript
class ExecutionPromptBuilder {
  build(workItemId: number, context: ExecutionContext): string {
    return `请使用 forge-execute skill 执行以下开发计划。

## 计划信息
- 工作项: TFS#${workItemId}
- 计划路径: forge/tracks/tfs-${workItemId}/
- 包含文件: intent.md, design.md, tasks.md

## 执行步骤
1. 使用 forge:using-git-worktrees 创建隔离工作区
2. 使用 forge:forge-execute 执行计划
3. 自动选择合适的执行模式（根据任务依赖关系）
4. 完成所有任务后，使用 forge:finishing-a-development-branch 提交代码

## 要求
- 实时报告执行进度（每完成一个任务）
- 更新 tasks.md 中的 checkbox 状态
- 如遇问题及时询问或反馈
- 完成后报告：完成摘要、生成的文件、提交信息

开始执行！`;
  }
}
```

#### 2. Session Manager (Session管理器)

**职责**: 管理OpenCode session的生命周期

```typescript
class OpenCodeSessionManager {
  async createExecutionSession(workItemId: number) {
    // 创建新的OpenCode session
    const session = await this.client.session.create({
      metadata: {
        type: 'plan-execution',
        workItemId: workItemId,
        trackId: `tfs-${workItemId}`
      }
    });
    
    return session.id;
  }
  
  async sendExecutionPrompt(sessionId: string, prompt: string) {
    // 发送execution prompt到OpenCode
    return await this.client.session.promptAsync({
      sessionID: sessionId,
      parts: [{ type: 'text', text: prompt }]
    });
  }
  
  async monitorSession(sessionId: string, onProgress: (msg: Message) => void) {
    // 轮询session消息，获取执行进度
    const pollInterval = 2000; // 2秒
    
    while (true) {
      const messages = await this.client.session.messages({ sessionID: sessionId });
      const latestMessages = this.getNewMessages(messages);
      
      for (const msg of latestMessages) {
        onProgress(msg);
        
        // 检测完成或错误
        if (this.isExecutionComplete(msg)) {
          return { status: 'completed', result: msg };
        }
        if (this.isExecutionFailed(msg)) {
          return { status: 'failed', error: msg };
        }
      }
      
      await sleep(pollInterval);
    }
  }
}
```

#### 3. Progress Monitor (进度监控)

**职责**: 解析AI返回的消息，提取进度信息

```typescript
class ExecutionProgressMonitor {
  parseProgress(message: Message): ExecutionProgress {
    const text = message.parts.find(p => p.type === 'text')?.text || '';
    
    // 解析进度信息
    // 例如："任务 3/10 完成: 生成用户登录API"
    const progressMatch = text.match(/任务\s+(\d+)\/(\d+)\s+完成/);
    const taskMatch = text.match(/完成:\s+(.+)/);
    
    return {
      current: parseInt(progressMatch?.[1] || '0'),
      total: parseInt(progressMatch?.[2] || '0'),
      currentTask: taskMatch?.[1] || '',
      rawMessage: text
    };
  }
  
  isQuestion(message: Message): boolean {
    // 检测AI是否在提问（需要用户确认）
    const text = message.parts.find(p => p.type === 'text')?.text || '';
    return text.includes('?') && 
           (text.includes('确认') || text.includes('请问') || text.includes('是否需要'));
  }
}
```

#### 4. TFS Sync (TFS同步)

**职责**: Forge执行完成后同步TFS状态

```typescript
class TFSSyncManager {
  async syncExecutionComplete(workItemId: number, result: ExecutionResult) {
    // 更新TFS工作项状态为"已完成"
    await this.tfsClient.updateWorkItem(workItemId, {
      'System.State': '已完成',
      'System.History': this.buildCompletionComment(result)
    });
    
    // 添加详细评论
    await this.tfsClient.addComment(workItemId, 
      `## 开发完成 ✅

${result.summary}

### 完成的文件
${result.files.map(f => `- ${f}`).join('\n')}

### 提交信息
${result.commitInfo}

### 执行统计
- 总任务数: ${result.totalTasks}
- 完成任务数: ${result.completedTasks}
- 执行时长: ${result.duration}

---
*由 OpenWork AI 自动执行完成*`
    );
  }
}
```

## Data Flow

### 完整执行流程

```
用户点击"开始开发"
    │
    ▼
┌──────────────────────┐
│ 1. Build Prompt      │
│ 读取计划文档路径    │
│ 构建execution prompt│
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 2. Create Session    │
│ 创建OpenCode session│
│ 关联workItemId      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 3. Send Prompt       │
│ 发送execution prompt│
│ 到OpenCode          │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 4. Monitor Progress  │◄───────┐
│ 轮询session消息     │        │
│ 解析进度信息        │        │
│ 更新UI进度条        │        │
│ 检测问题/提问       │────────┘
│ → 需要时用户介入    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 5. Execution Complete│
│ 解析执行结果        │
│ 生成摘要报告        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 6. Sync TFS          │
│ 更新工作项状态      │
│ 添加完成评论        │
└──────┬───────────────┘
       │
       ▼
显示完成状态给用户
```

## Data Models

### ExecutionContext
```typescript
interface ExecutionContext {
  workItemId: number;
  trackId: string;
  planPath: string;
  repositories: RepositoryConfig[];
  options: ExecutionOptions;
}

interface ExecutionOptions {
  mode: 'auto' | 'batch' | 'interactive';  // 执行模式
  autoConfirm: boolean;                     // 自动确认（无人工干预）
  timeoutMinutes: number;                   // 超时时间
  maxRetries: number;                       // 最大重试次数
}
```

### ExecutionProgress
```typescript
interface ExecutionProgress {
  sessionId: string;
  status: 'preparing' | 'executing' | 'reviewing' | 'committing' | 'completed' | 'failed';
  currentTask?: {
    index: number;
    total: number;
    title: string;
    description?: string;
  };
  messages: ExecutionMessage[];
  startTime: Date;
  estimatedEndTime?: Date;
}

interface ExecutionMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  type: 'progress' | 'question' | 'error' | 'completion';
}
```

### ExecutionResult
```typescript
interface ExecutionResult {
  status: 'completed' | 'failed' | 'cancelled';
  workItemId: number;
  summary: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  files: string[];
  commitInfo?: {
    hash: string;
    message: string;
    branch: string;
  };
  duration: number;  // 毫秒
  logs: string[];
}
```

## File Structure

```
packages/app/src/
├── automation/
│   └── plan-execution/
│       ├── index.ts                 # 主入口
│       ├── prompt-builder.ts        # Prompt构建器
│       ├── session-manager.ts       # Session管理器
│       ├── progress-monitor.ts      # 进度监控器
│       └── types.ts                 # 类型定义
├── app/components/
│   └── plan-execution-monitor/      # 执行监控UI
│       ├── index.tsx                # 主面板
│       ├── ProgressBar.tsx          # 进度条
│       ├── MessageList.tsx          # 消息列表
│       └── QuestionModal.tsx        # 提问对话框
└── app/context/
    └── plan-execution.ts            # 执行状态管理
```

## Error Handling

### 可恢复错误
- **AI提问**：暂停执行，显示提问对话框，等待用户回答后继续
- **网络超时**：自动重试（最多3次）
- **单个任务失败**：Forge自动重试或询问用户

### 终止条件
- 用户主动取消
- 连续失败超过阈值
- 超时（默认30分钟）
- 不可恢复的错误

### 状态恢复
- Session级别持久化
- 支持断点续传（基于OpenCode session）
- 可随时查看历史执行记录

## Integration Points

### 输入（从Task Center）
```typescript
// 获取计划路径
const planPath = `forge/tracks/tfs-${workItemId}/`;

// 获取关联的仓库配置
const repositories = await taskCenterStore.getRepositories(workItemId);
```

### 输出（到TFS）
```typescript
// 执行完成后同步
await tfsSyncManager.syncExecutionComplete(workItemId, result);
```

### 与UI集成
```typescript
// 实时更新UI
progressMonitor.onProgress((progress) => {
  planExecutionStore.setProgress(progress);
});

// 处理AI提问
progressMonitor.onQuestion((question) => {
  showQuestionModal(question);
});
```

## Performance

- **Prompt发送**: < 1秒
- **Session创建**: < 2秒
- **进度轮询**: 每2秒一次
- **UI更新**: 实时（SolidJS响应式）

## Testing Strategy

### 单元测试
- PromptBuilder（验证prompt格式）
- ProgressMonitor（验证进度解析）
- SessionManager（验证session生命周期）

### 集成测试
- 完整执行流程（使用mock OpenCode）
- 进度监控和UI更新
- TFS同步

### E2E测试
- 端到端执行流程
- 用户交互（提问和回答）
- 错误恢复场景

## Overview

本文档描述如何**执行已有的开发计划**，将 `tasks.md` 中的任务转化为实际的代码实现。

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Task Center UI                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Plan Execution Monitor                    │  │
│  │  [读取计划] [执行任务] [审查结果] [提交代码]          │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Plan Executor (OpenWork层)                      │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  1. Plan Parser                                        │ │
│  │     - 读取tasks.md                                    │ │
│  │     - 解析任务列表                                    │ │
│  │     - 依赖拓扑排序                                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  2. Task Executor                                      │ │
│  │     - 按顺序执行每个任务                              │ │
│  │     - 调用OpenCode agents                             │ │
│  │     - 处理执行结果                                    │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ OpenCode SDK
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           OpenCode Multi-Agent System                        │
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────────┐             │
│  │ @build  │───►│ @review │───►│@commit-helper│            │
│  │ 执行    │    │ 审查    │    │ 提交        │             │
│  └─────────┘    └─────────┘    └─────────────┘             │
│       │                               │                     │
│       └──────────────┬────────────────┘                     │
│                      │                                      │
│              使用session工具协作                           │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. Plan Parser (计划解析器)

**职责**: 读取并解析已生成的计划文档

```typescript
class PlanParser {
  async loadPlan(workItemId: number): Promise<DevelopmentPlan> {
    const trackPath = `forge/tracks/tfs-${workItemId}`;
    
    // 读取三个核心文档
    const [intent, design, tasks] = await Promise.all([
      this.readFile(`${trackPath}/intent.md`),
      this.readFile(`${trackPath}/design.md`),
      this.readFile(`${trackPath}/tasks.md`)
    ]);
    
    return {
      intent: this.parseIntent(intent),
      design: this.parseDesign(design),
      tasks: this.parseTasks(tasks) // 关键：解析任务列表
    };
  }
  
  private parseTasks(content: string): Task[] {
    // 解析Markdown任务列表
    // 识别任务依赖关系
    // 返回结构化任务数组
  }
}
```

#### 2. Task Executor (任务执行器)

**职责**: 协调OpenCode agents执行每个任务

```typescript
class TaskExecutor {
  async executeTask(task: Task, plan: DevelopmentPlan): Promise<TaskResult> {
    // 1. 调用@build生成代码
    const buildResult = await this.callBuildAgent(task, plan.design);
    
    // 2. 调用@review审查代码
    const reviewResult = await this.callReviewAgent(buildResult);
    
    // 3. 根据审查结果决策
    if (reviewResult.passed) {
      return { status: 'completed', files: buildResult.files };
    } else {
      // 修复并重新审查
      return await this.fixAndReview(task, reviewResult.issues);
    }
  }
  
  private async callBuildAgent(task: Task, design: string) {
    // 使用OpenCode SDK调用@build agent
    const prompt = this.buildPrompt(task, design);
    return await opencode.session.prompt({
      agent: 'build',
      text: prompt
    });
  }
}
```

#### 3. OpenCode Agent Coordinator

**职责**: 管理和协调OpenCode agents

**Agents分工**:

| Agent | 职责 | 输入 | 输出 |
|-------|------|------|------|
| **@build** | 执行代码生成任务 | 任务描述 + 设计文档 | 生成的代码文件 |
| **@review** | 审查代码质量 | 代码文件 | 审查报告 |
| **@commit-helper** | 提交代码 | 代码变更 | Git commit |

**调用方式**:
```typescript
// 通过OpenCode SDK调用
await opencode.session.prompt({
  agent: 'build',
  text: `执行任务: ${task.title}
        
设计文档: ${design}

要求：
1. 生成完整可运行的代码
2. 写入到指定位置
3. 运行测试验证`
});
```

## Data Flow

### 执行流程

```
Start
  │
  ▼
┌──────────────────────┐
│ 1. Load Plan         │
│ 读取tasks.md         │
│ 解析任务列表         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 2. Sort Tasks        │
│ 拓扑排序             │
│ 处理依赖关系         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 3. Execute Tasks     │◄───────┐
│ 对每个任务：          │        │
│ - @build生成         │        │
│ - @review审查        │        │
│ - 通过？下一个       │        │
│ - 失败？修复重来     │────────┘
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 4. Commit Code       │
│ @commit-helper       │
│ 提交所有变更         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 5. Update TFS        │
│ 更新工作项状态       │
└──────┬───────────────┘
       │
       ▼
      End
```

## Data Models

### DevelopmentPlan
```typescript
interface DevelopmentPlan {
  workItemId: number;
  intent: IntentDocument;
  design: DesignDocument;
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  targetRepo: string;
  dependencies: string[];  // 依赖的其他任务ID
  estimatedTime?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  generatedFiles?: GeneratedFile[];
  reviewResult?: ReviewResult;
}

interface GeneratedFile {
  filePath: string;
  content: string;
  language: string;
}

interface ReviewResult {
  passed: boolean;
  score: number;
  issues: ReviewIssue[];
  suggestions: string[];
}
```

## File Structure

```
packages/app/src/
├── automation/
│   ├── plan-executor/
│   │   ├── index.ts                 # PlanExecutor主类
│   │   ├── plan-parser.ts           # 计划解析器
│   │   ├── task-executor.ts         # 任务执行器
│   │   └── agent-coordinator.ts     # Agent协调器
│   └── phases/
│       └── phase-4-plan-executor.ts # Phase 4实现
├── app/components/
│   └── plan-execution-monitor/      # 执行监控UI
│       ├── index.tsx
│       ├── TaskProgress.tsx
│       └── AgentLog.tsx
└── types/
    └── plan-execution.ts            # 类型定义
```

## Error Handling

### 可恢复错误
- 单个任务失败 → 重试（最多3次）→ 仍失败则暂停
- 代码生成不完整 → 重新生成
- 审查未通过 → 自动修复 → 重新审查

### 终止条件
- 连续3次重试失败 → 暂停，等待人工处理
- 网络/API错误 → 暂停，可恢复
- 用户取消 → 立即终止，保存状态

### 状态持久化
- 每个任务完成后保存状态
- 支持断点续传
- 可查看历史执行记录

## Integration Points

### 输入（从Task Center）
```typescript
// 读取已生成的计划
const plan = await planParser.loadPlan(workItemId);
```

### 输出（到TFS）
```typescript
// 更新TFS状态
await tfsClient.updateWorkItem(workItemId, {
  'System.State': '已完成',
  'System.History': '代码已实现并提交'
});
```

## Performance

- **并行执行**: 无依赖的任务可并行
- **增量执行**: 只执行未完成的任务
- **超时控制**: 每个任务设置超时（默认10分钟）

## Testing Strategy

### 单元测试
- PlanParser解析逻辑
- TaskExecutor执行流程
- AgentCoordinator调用逻辑

### 集成测试
- 完整计划执行流程
- Agent协作流程
- 错误恢复流程
