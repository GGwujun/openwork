# Design: TFS需求开发计划执行器

## Overview

本文档描述如何通过**Prompt Engineering**让OpenCode使用Forge skills执行已生成的开发计划。

**核心原则**：
- OpenWork只负责：构建Prompt → 调用OpenCode → 监控进度
- Forge Skills负责：执行 → 验证 → 归档

---

## 文档获取（关键前提）

### 文档存储位置

Plan Docs 存储在 **BaseDirectory.AppLocalData** 的持久化目录中：

```
AppLocalData/
└── openwork/task-center/{scope}/artifacts/
    └── tfs-{workItemId}.json
        {
          "planDocs": {
            "intent": "...",    // intent.md 内容
            "design": "...",    // design.md 内容
            "tasks": "..."      // tasks.md 内容 ⭐执行时使用
          }
        }
```

### 文档读取方式

```typescript
// 1. 通过 Artifact Store 读取（推荐）
const artifact = await artifactStore.get(tfsId);
const planDocs = artifact?.planDocs;

// 2. 直接文件读取（备选）
const trackPath = `forge/tracks/tfs-${tfsId}`;
const tasksContent = await readTextFile(
  `${trackPath}/tasks.md`,
  { baseDir: BaseDirectory.AppLocalData }
);
```

### Track 路径规则

| 路径类型 | 格式 | 示例 |
|---------|------|------|
| **Track ID** | `tfs-{workItemId}` | `tfs-12345` |
| **Track 路径** | `forge/tracks/{trackId}` | `forge/tracks/tfs-12345` |
| **归档路径** | `forge/archives/{date}-{trackId}` | `forge/archives/2024-03-15-tfs-12345` |

---

## 工作空间准备流程（Send Prompt 之前）

> **原则**: 计划生成时已确定工作区，执行时直接使用；如果缺失则自动创建

### 完整流程

```
执行开发计划
    │
    ▼
┌────────────────────────┐
│ 1. 获取 Plan Docs      │
│    (intent/design/     │
│     tasks)             │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 2. 获取 Workspace      │
│    信息 ⭐关键步骤      │
└──────────┬─────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
有记录        无记录
    │             │
    │    ┌────────┴────────┐
    │    │ 尝试匹配现有    │
    │    │ 工作区          │
    │    └────────┬────────┘
    │             │
    │      ┌──────┴──────┐
    │      ▼             ▼
    │   匹配成功      匹配失败
    │      │             │
    │      │    ┌────────┴────────┐
    │      │    │ 自动创建工作区  │
    │      │    │ (createWorkspace│
    │      │    │  ForRepo)       │
    │      │    └────────┬────────┘
    │      │             │
    │      │    ┌────────┴────────┐
    │      │    │ 创建失败        │
    │      │    │ → 报错，提示    │
    │      │    │ 用户手动创建    │
    │      │    └─────────────────┘
    │      │
    └──────┴──────┐
           │
           ▼
┌────────────────────────┐
│ 3. 更新 workspaceMap   │ ⭐记录映射关系
│    (tfsId → workspace) │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 4. 构建 Execution      │
│    Prompt              │
│    (包含 workspaceRoot)│
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 5. 发送给 OpenCode     │
│    执行                │
└────────────────────────┘
```

### 数据流说明

#### 1. 读取 Workspace 信息
```typescript
// 从持久化的 workspaceMap 读取
const entry = workspaceMap[tfsId];

if (entry) {
  // 有记录，直接使用
  workspaceRoot = entry.workspaceRoot;
} else {
  // 无记录，进入创建流程
  workspace = await createWorkspaceForTfsItem(tfsId, repos);
}
```

#### 2. 自动创建工作区（无记录时）
```typescript
async function createWorkspaceForTfsItem(tfsId, repos) {
  // 1. 尝试匹配现有工作区（通过 repoUrl/repoPath）
  const match = await resolveWorkspaceForRepos(item, repos);
  
  if (match) {
    return match.workspace;
  }
  
  // 2. 匹配不到，自动创建
  const primaryRepo = pickPrimaryRepo(repos);
  const created = await createWorkspaceForRepo({
    repoUrl: primaryRepo.path,
    preset: "starter"
  });
  
  if (created) {
    // 激活工作区
    await activateWorkspace(created.id);
    return created;
  }
  
  throw new Error("无法创建工作区");
}
```

#### 3. 记录映射关系 ⭐关键
```typescript
// 无论是使用已有还是新创建，都要记录到 workspaceMap
setWorkspaceMapEntry(tfsId, {
  workspaceId: workspace.id,
  workspaceRoot: workspace.root,
  repoUrlKey: normalizeGitRemote(repoUrl),
  repoPathKey: normalizePathValue(repoPath),
  updatedAt: Date.now()
});

// 这样下次执行时就能直接找到
```

#### 4. 完整代码实现

完整实现：`packages/app/src/automation/plan-execution/workspace-manager.ts`

```typescript
// ============================================
// workspace-manager.ts - 完整实现
// ============================================

import type { RepositoryMatch } from '../../types/requirement-analyzer';
import type { WorkspaceInfo as TauriWorkspaceInfo } from '../../app/lib/tauri';

export interface WorkspaceMapEntry {
  workspaceId: string;
  workspaceRoot?: string;
  repoUrlKey?: string;
  repoPathKey?: string;
  updatedAt: number;
}

export interface ResolvedWorkspace {
  workspaceId: string;
  workspaceRoot: string;
  isNewlyCreated: boolean;
  isActivated: boolean;
}

export interface WorkspaceManagerOptions {
  getWorkspaces: () => TauriWorkspaceInfo[];
  createWorkspaceForRepo: (input: {
    repoUrl?: string | null;
    folderPath?: string | null;
    preset?: "starter" | "automation" | "minimal";
  }) => Promise<TauriWorkspaceInfo | null>;
  activateWorkspace: (workspaceId: string) => Promise<boolean>;
  getActiveWorkspaceRoot: () => string;
  getWorkspaceMap: () => Record<number, WorkspaceMapEntry>;
  setWorkspaceMapEntry: (tfsId: number, entry: WorkspaceMapEntry) => void;
}

/**
 * 获取或创建工作空间（核心函数）
 * 
 * 流程：
 * 1. 检查 workspaceMap 是否有记录
 * 2. 有记录 → 验证有效性 → 返回
 * 3. 无记录 → 尝试匹配现有工作区
 * 4. 匹配不到 → 自动创建
 * 5. 记录映射关系到 workspaceMap
 */
export async function getOrCreateWorkspace(
  tfsId: number,
  repos: RepositoryMatch[],
  options: WorkspaceManagerOptions
): Promise<{ success: boolean; workspace?: ResolvedWorkspace; error?: string }> {
  console.log(`[WorkspaceManager] 开始获取/创建工作空间:`, { tfsId, repoCount: repos.length });

  // Step 1: 检查 workspaceMap 是否有记录
  const workspaceMap = options.getWorkspaceMap();
  const existingEntry = workspaceMap[tfsId];

  if (existingEntry?.workspaceId) {
    console.log(`[WorkspaceManager] 找到已有记录:`, {
      workspaceId: existingEntry.workspaceId,
      workspaceRoot: existingEntry.workspaceRoot
    });

    // 验证工作空间是否仍然存在
    const allWorkspaces = options.getWorkspaces();
    const workspaceExists = allWorkspaces.some(ws => ws.id === existingEntry.workspaceId);

    if (workspaceExists && existingEntry.workspaceRoot) {
      // 确保工作区已激活
      const currentRoot = options.getActiveWorkspaceRoot();
      const isAlreadyActive = currentRoot === existingEntry.workspaceRoot;
      
      if (!isAlreadyActive) {
        console.log(`[WorkspaceManager] 激活工作空间:`, existingEntry.workspaceId);
        const activated = await options.activateWorkspace(existingEntry.workspaceId);
        if (!activated) {
          console.warn(`[WorkspaceManager] 激活失败，尝试重新匹配`);
          // 继续执行匹配流程
        } else {
          options.setWorkspaceMapEntry(tfsId, {
            ...existingEntry,
            updatedAt: Date.now()
          });
          
          return {
            success: true,
            workspace: {
              workspaceId: existingEntry.workspaceId,
              workspaceRoot: existingEntry.workspaceRoot,
              isNewlyCreated: false,
              isActivated: true
            }
          };
        }
      } else {
        return {
          success: true,
          workspace: {
            workspaceId: existingEntry.workspaceId,
            workspaceRoot: existingEntry.workspaceRoot,
            isNewlyCreated: false,
            isActivated: true
          }
        };
      }
    } else {
      console.warn(`[WorkspaceManager] 记录的工作空间已失效，清理记录`);
    }
  }

  // Step 2: 无记录或记录失效，尝试匹配现有工作区
  console.log(`[WorkspaceManager] 尝试匹配现有工作区`);
  
  const primaryRepo = repos.find(r => r.isPrimary) || repos[0];
  if (!primaryRepo) {
    return { success: false, error: "未识别到目标仓库，无法匹配工作区" };
  }

  const matchedWorkspace = await matchExistingWorkspace(primaryRepo, options);
  
  if (matchedWorkspace) {
    console.log(`[WorkspaceManager] 匹配到现有工作区:`, matchedWorkspace.id);
    
    const activated = await options.activateWorkspace(matchedWorkspace.id);
    if (!activated) {
      return { success: false, error: "工作区匹配成功但激活失败" };
    }

    // 记录映射关系
    const workspaceRoot = resolveWorkspaceRoot(matchedWorkspace);
    const entry: WorkspaceMapEntry = {
      workspaceId: matchedWorkspace.id,
      workspaceRoot,
      repoUrlKey: normalizeGitRemote(primaryRepo.path),
      repoPathKey: normalizePathValue(primaryRepo.path).toLowerCase(),
      updatedAt: Date.now()
    };
    options.setWorkspaceMapEntry(tfsId, entry);
    console.log(`[WorkspaceManager] 已记录映射关系:`, { tfsId, workspaceId: matchedWorkspace.id });

    return {
      success: true,
      workspace: {
        workspaceId: matchedWorkspace.id,
        workspaceRoot,
        isNewlyCreated: false,
        isActivated: true
      }
    };
  }

  // Step 3: 匹配不到，自动创建工作区
  console.log(`[WorkspaceManager] 未匹配到工作区，开始自动创建`);

  const createdWorkspace = await autoCreateWorkspace(primaryRepo, options);
  
  if (!createdWorkspace) {
    return {
      success: false,
      error: `无法为仓库 "${primaryRepo.name}" 创建工作区。请手动创建工作区后再试。`
    };
  }

  console.log(`[WorkspaceManager] 工作空间创建成功:`, createdWorkspace.id);

  const activated = await options.activateWorkspace(createdWorkspace.id);
  if (!activated) {
    return { success: false, error: "工作空间创建成功但激活失败" };
  }

  // 记录映射关系
  const workspaceRoot = resolveWorkspaceRoot(createdWorkspace);
  const entry: WorkspaceMapEntry = {
    workspaceId: createdWorkspace.id,
    workspaceRoot,
    repoUrlKey: normalizeGitRemote(primaryRepo.path),
    repoPathKey: normalizePathValue(primaryRepo.path).toLowerCase(),
    updatedAt: Date.now()
  };
  options.setWorkspaceMapEntry(tfsId, entry);
  console.log(`[WorkspaceManager] 已记录新映射关系:`, { tfsId, workspaceId: createdWorkspace.id });

  return {
    success: true,
    workspace: {
      workspaceId: createdWorkspace.id,
      workspaceRoot,
      isNewlyCreated: true,
      isActivated: true
    }
  };
}

/**
 * 匹配现有工作区（通过 Git URL 或路径）
 */
async function matchExistingWorkspace(
  repo: RepositoryMatch,
  options: WorkspaceManagerOptions
): Promise<TauriWorkspaceInfo | null> {
  const allWorkspaces = options.getWorkspaces();
  const localWorkspaces = allWorkspaces.filter(ws => ws.workspaceType !== "remote");

  if (localWorkspaces.length === 0) return null;

  const repoUrlKey = normalizeGitRemote(repo.path);
  const repoPathKey = normalizePathValue(repo.path).toLowerCase();

  // 方法1: 通过 Git URL 匹配
  if (repoUrlKey) {
    for (const workspace of localWorkspaces) {
      const root = resolveWorkspaceRoot(workspace);
      const originUrl = await readWorkspaceOriginUrl(root);
      if (normalizeGitRemote(originUrl) === repoUrlKey) {
        return workspace;
      }
    }
  }

  // 方法2: 通过路径匹配
  for (const workspace of localWorkspaces) {
    const root = resolveWorkspaceRoot(workspace);
    const rootKey = normalizePathValue(root).toLowerCase();
    if (rootKey === repoPathKey) {
      return workspace;
    }
  }

  return null;
}

/**
 * 自动创建工作区
 */
async function autoCreateWorkspace(
  repo: RepositoryMatch,
  options: WorkspaceManagerOptions
): Promise<TauriWorkspaceInfo | null> {
  const isUrl = isGitUrl(repo.path);
  
  const input = {
    repoUrl: isUrl ? repo.path : null,
    folderPath: isUrl ? null : repo.path,
    preset: "starter" as const
  };

  console.log(`[WorkspaceManager] 调用 createWorkspaceForRepo:`, input);
  
  try {
    return await options.createWorkspaceForRepo(input);
  } catch (error) {
    console.error(`[WorkspaceManager] 创建工作区失败:`, error);
    return null;
  }
}

// 工具函数
async function readWorkspaceOriginUrl(workspaceRoot: string): Promise<string | null> {
  try {
    const { fsReadFile } = await import('../../app/lib/tauri');
    const result = await fsReadFile(".git/config", workspaceRoot);
    return parseGitOriginUrl(result.content);
  } catch {
    return null;
  }
}

function parseGitOriginUrl(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  let inOrigin = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      inOrigin = /^remote\s+"origin"$/i.test(sectionMatch[1].trim());
      continue;
    }

    if (!inOrigin) continue;

    const urlMatch = trimmed.match(/^url\s*=\s*(.+)$/i);
    if (urlMatch) return urlMatch[1].trim();
  }

  return null;
}

function resolveWorkspaceRoot(workspace: TauriWorkspaceInfo): string {
  if (workspace.workspaceType === "remote") {
    return workspace.directory?.trim() ?? "";
  }
  return workspace.path?.trim() ?? "";
}

function isGitUrl(value: string): boolean {
  return /^(https?:\/\/|ssh:\/\/|git@)/i.test(value.trim());
}

function normalizeGitRemote(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  let hostPath = trimmed;
  const scpLike = trimmed.match(/^git@([^:]+):(.+)$/i);
  if (scpLike) {
    hostPath = `${scpLike[1]}/${scpLike[2]}`;
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      hostPath = `${parsed.host}${parsed.pathname}`;
    } catch {
      hostPath = trimmed;
    }
  }

  return hostPath
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function normalizePathValue(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}
```

**核心逻辑总结**：
1. **查**：`workspaceMap[tfsId]` 是否有记录
2. **验**：验证工作空间是否仍然有效
3. **匹**：`matchExistingWorkspace()` 通过 Git URL 或路径匹配
4. **创**：`autoCreateWorkspace()` 调用 `createWorkspaceForRepo()`
5. **记**：`setWorkspaceMapEntry()` 记录映射关系

---

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
│  │  5. Workspace Manager (工作空间管理) ⭐新增           │  │
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
│  │  - 工作空间 (workspaceRoot) ⭐新增                    │  │
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
│  │  • forge-verify → 三维验证                           │  │
│  │  • forge-archive → 归档track ⭐新增                  │  │
│  │  • forge-finish → 完成分支                           │  │
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
│  │  - 归档路径                                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. Workspace Manager (工作空间管理器) ⭐新增

**职责**: 获取/创建/记录工作空间

```typescript
// 在 Send Prompt 之前调用
const workspaceResult = await getOrCreateWorkspace(
  tfsId,
  repos,
  {
    getWorkspaces,
    createWorkspaceForRepo,
    activateWorkspace,
    getWorkspaceMap,
    setWorkspaceMapEntry
  }
);

// 使用 workspaceRoot 构建 prompt
const prompt = buildForgeExecutionPrompt({
  workItemId: tfsId,
  workspaceRoot: workspaceResult.workspace.workspaceRoot, // ⭐关键
  // ...
});
```

#### 2. Prompt Builder (Prompt构建器)

**职责**: 构建高质量的execution prompt

```typescript
class ExecutionPromptBuilder {
  build(workItemId: number, context: ExecutionContext): string {
    return `请使用 forge-execute skill 执行以下开发计划。

## 计划信息
- 工作项: TFS#${workItemId}
- 计划路径: forge/tracks/tfs-${workItemId}/
- 工作空间: ${context.workspaceRoot} ⭐告诉 AI 在哪执行
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

#### 3. Session Manager (Session管理器)

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

#### 4. Progress Monitor (进度监控器)

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
  
  isArchiveComplete(message: Message): boolean {
    // 检测归档是否完成
    const text = message.parts.find(p => p.type === 'text')?.text || '';
    return text.includes('forge-archive') && text.includes('完成');
  }
}
```

#### 5. TFS Sync (TFS同步)

**职责**: Forge执行完成后同步TFS状态

```typescript
class TFSSyncManager {
  async syncExecutionComplete(workItemId: number, result: ExecutionResult) {
    // 更新TFS工作项状态为"已解决"（归档成功后）
    await this.tfsClient.updateWorkItem(workItemId, {
      'System.State': '已解决',
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

### 归档路径
${result.archivePath}

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

---

## Forge 标准执行流程

> **遵循 Forge Workflow**: forge-execute → forge-verify → forge-archive

### 完整流程

```
用户点击"开始开发"
    │
    ▼
┌──────────────────────┐
│ 1. Load Plan Docs    │
│ 从 AppLocalData 读取 │
│ planDocs.tasks       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 2. Get Workspace     │ ← ⭐关键步骤
│ 获取/创建工作空间    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 3. Update workspaceMap│ ← ⭐记录映射
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 4. Build Prompt      │
│ 构建 execution       │
│ prompt（包含         │
│ workspaceRoot）      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 5. Create Session    │
│ 创建 OpenCode        │
│ session              │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 6. AI Auto Execute   │
│ OpenCode AI 自动     │
│ 调用 Forge skills:   │
│                      │
│ • using-git-worktrees│
│ • forge-execute      │
│ • verification-before│
│   -completion        │
│ • forge-verify       │
│ • forge-archive ⭐   │
│ • forge-finish       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 7. Monitor Progress  │
│ 轮询 session 消息    │
│ 解析执行进度         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 8. Archive Complete  │
│ forge-archive 自动   │
│ 归档 track           │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 9. Sync TFS          │
│ 更新工作项状态为     │
│ "已解决"             │
└──────┬───────────────┘
       │
       ▼
      End
```

### 归档流程（Forge 标准）

**由 `forge-archive` skill 自动完成**：

1. **验证检查**：确认 verification 证据存在
2. **契约合并**：将 delta contracts 合并到 main contracts
3. **Track 移动**：
   ```
   forge/tracks/tfs-{id}/ → forge/archives/YYYY-MM-DD-tfs-{id}/
   ```
4. **生成归档记录**：保留完整执行历史

**OpenWork 只需**：
- 在 execution prompt 中要求调用 `forge-archive`
- 监控归档完成消息
- 归档成功后更新 TFS 状态

---

## Data Flow

### 完整执行流程（更新版，含工作空间管理）

```
用户点击"开始开发"
    │
    ▼
┌────────────────────────┐
│ 1. Load Plan Docs      │ ← 从 AppLocalData 读取
│    (intent/design/     │    planDocs.tasks
│     tasks)             │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 2. Get Workspace       │ ← ⭐关键步骤
│    获取/创建工作空间   │
└──────────┬─────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
  有记录        无记录
    │             │
    │    ┌────────┴────────┐
    │    │ 尝试匹配现有    │
    │    │ 工作区          │
    │    │ (Git URL/路径)  │
    │    └────────┬────────┘
    │             │
    │      ┌──────┴──────┐
    │      ▼             ▼
    │   匹配成功      匹配失败
    │      │             │
    │      │    ┌────────┴────────┐
    │      │    │ 自动创建工作区  │
    │      │    │ createWorkspace │
    │      │    │ ForRepo()       │
    │      │    └────────┬────────┘
    │      │             │
    │      │    ┌────────┴────────┐
    │      │    │ 创建失败        │
    │      │    │ → 报错，提示    │
    │      │    │ 用户手动创建    │
    │      │    └─────────────────┘
    │      │
    └──────┴──────┐
           │
           ▼
┌────────────────────────┐
│ 3. Update workspaceMap │ ← ⭐记录映射关系
│    (tfsId → workspace) │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 4. Build Prompt        │
│    构建 execution      │
│    prompt（包含        │
│    workspaceRoot）     │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 5. Create Session      │
│    创建 OpenCode       │
│    session             │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 6. AI Auto Execute     │
│    OpenCode AI 自动    │
│    调用 Forge skills:  │
│                        │
│    • using-git-        │
│      worktrees         │
│    • forge-execute     │
│    • verification-     │
│      before-completion │
│    • forge-verify      │
│    • forge-archive ⭐  │
│    • forge-finish      │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 7. Monitor Progress    │
│    轮询 session 消息   │
│    解析执行进度        │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 8. Archive Complete    │
│    forge-archive 完成  │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 9. Sync TFS            │
│    更新工作项状态为    │
│    "已解决"            │
└──────────┬─────────────┘
           │
           ▼
      显示完成状态
```

---

## Data Models

### ExecutionContext
```typescript
interface ExecutionContext {
  workItemId: number;
  trackId: string;
  planPath: string;
  workspaceRoot: string;  // ⭐新增：工作空间路径
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
  type: 'progress' | 'question' | 'error' | 'completion' | 'archive';  // ⭐新增 archive 类型
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
  archivePath?: string;  // ⭐新增：归档路径
  commitInfo?: {
    hash: string;
    message: string;
    branch: string;
  };
  duration: number;  // 毫秒
  logs: string[];
}
```

### ExecutionPromptBuilder

完整实现：`packages/app/src/automation/plan-execution/prompt-builder.ts`

```typescript
export interface ExecutionContext {
  workItemId: number;
  trackPath: string;
  workspaceRoot: string;  // ⭐告诉 AI 在哪执行
  intent: string;
  design: string;
  tasks: string;
  options?: {
    autoConfirm: boolean;
    timeoutMinutes: number;
  };
}

export function buildForgeExecutionPrompt(context: ExecutionContext): string {
  return `请使用 Forge 标准工作流执行以下开发计划。

## 📋 计划信息
- **工作项**: TFS#${context.workItemId}
- **Track 路径**: ${context.trackPath}
- **工作空间**: ${context.workspaceRoot} ⭐告诉 AI 在哪里执行
- **执行模式**: 自动选择（根据任务依赖关系）

## 🎯 需求意图 (intent.md)
\`\`\`
${context.intent}
\`\`\`

## 🏗️ 技术设计 (design.md)
\`\`\`
${context.design}
\`\`\`

## ✅ 执行任务 (tasks.md)
\`\`\`
${context.tasks}
\`\`\`

---

## 🚀 Forge 执行流程（请按顺序执行）

### Step 0: 准备工作区 ⭐关键
**工作空间路径**: \`${context.workspaceRoot}\`

请在正确的位置执行代码：
- 如果当前不在该工作区，请先切换到该目录
- 或者使用 \`using-git-worktrees\` 基于该工作区创建隔离环境

### Step 1: 执行计划
使用 \`forge-execute\` skill 执行：
- 读取 ${context.trackPath}/tasks.md
- 在 \`${context.workspaceRoot}\` 工作区中执行
- 自动选择合适的执行模式

### Step 2-6: 验证、归档、完成
（Forge skills 自动处理）

...

开始执行！`;
}
```

**关键点**：
- **workspaceRoot** 必须传给 AI，让 Forge skills 知道在哪执行
- 使用 \`using-git-worktrees\` 可以基于现有工作区创建隔离环境
- 所有代码生成、测试、提交都必须在指定工作区内完成

---

## File Structure

```
packages/app/src/
├── automation/
│   └── plan-execution/
│       ├── index.ts                 # 主入口
│       ├── workspace-manager.ts     # ⭐工作空间管理器
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

---

## Error Handling

### 可恢复错误
- **AI提问**：暂停执行，显示提问对话框，等待用户回答后继续
- **网络超时**：自动重试（最多3次）
- **单个任务失败**：Forge自动重试或询问用户
- **forge-archive 失败**：提示用户手动归档，记录失败原因

### 终止条件
- 用户主动取消
- 连续失败超过阈值
- 超时（默认30分钟）
- 不可恢复的错误（如无法获取/创建工作空间）

### 状态恢复
- Session级别持久化
- 支持断点续传（基于OpenCode session）
- 可随时查看历史执行记录
- 工作空间映射持久化（workspaceMap）

---

## Testing Strategy

### 单元测试
- `workspace-manager.test.ts`
  - 测试 `getOrCreateWorkspace()`
  - 测试 `matchExistingWorkspace()`（Git URL 匹配、路径匹配）
  - 测试 `autoCreateWorkspace()`
  - 测试映射记录
- `prompt-builder.test.ts`（验证prompt格式）
- `progress-monitor.test.ts`（验证进度解析、归档检测）
- `session-manager.test.ts`（验证session生命周期）

### 集成测试
- 完整执行流程（使用mock OpenCode）
- 工作空间管理（测试自动创建、重新匹配）
- 进度监控和UI更新
- TFS同步（归档成功后更新状态）

### E2E测试
- 端到端执行流程
- 用户交互（提问和回答）
- 错误恢复场景
- 工作空间自动创建流程

---

## 依赖关系

```
Phase 0 (文档获取 + 工作空间)
    │
    ├──→ Phase 1 (Prompt + Session)
    │       │
    │       ├──→ Phase 2 (进度监控)
    │       │       │
    │       │       ├──→ Phase 3 (UI)
    │       │       │       │
    │       │       │       └──→ Phase 4 (归档 + TFS)
    │       │       │               │
    │       │       │               └──→ Phase 5 (测试)
```

## 关键里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M0 | Week 1初 | 文档获取可用；工作空间管理器可用，可获取/创建/记录工作空间 |
| M1 | Week 1中 | Prompt Builder 可用，可构建包含 workspaceRoot 的 execution prompt |
| M2 | Week 1末 | Session Manager 可用，可创建 session 并发送 prompt |
| M3 | Week 2中 | UI 监控面板可用，可实时查看执行进度 |
| M4 | Week 2末 | 归档监控完成，可检测 forge-archive 完成并更新 TFS 状态为"已解决" |
| M5 | Week 2末 | 测试通过，可端到端执行完整流程 |

## 风险与缓解

| 风险 | 可能性 | 缓解措施 |
|------|--------|----------|
| Plan Docs 读取失败 | 低 | 双重读取机制（Artifact Store + File System） |
| 工作空间匹配失败 | 中 | 自动创建工作区，或提示用户手动创建 |
| Forge skills 未触发 | 中 | 优化 prompt，提供详细的 skill 使用说明和示例 |
| forge-archive 失败 | 低 | 监控归档消息，失败时提示用户手动处理 |
| TFS 状态同步失败 | 低 | 重试机制，记录失败日志供后续手动同步 |
| OpenCode session 超时 | 中 | 实现断点续传，保存执行状态 |

## 成功标准

- [ ] 能从 AppLocalData 正确读取 planDocs（intent/design/tasks）
- [ ] 能正确获取/创建工作空间，并记录到 workspaceMap
- [ ] 文档不存在时正确提示用户
- [ ] 能正确构建包含 Forge skills 和 workspaceRoot 的 execution prompt
- [ ] OpenCode 能正确触发 forge-execute → forge-verify → forge-archive
- [ ] 能实时显示执行进度（包括归档进度）
- [ ] 能正确处理 AI 提问
- [ ] forge-archive 完成后正确更新 TFS 状态为"已解决"
- [ ] UI 可查看归档路径和结果
- [ ] 支持断点续传
- [ ] 错误处理完善
