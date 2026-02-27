# OpenWork 需求-工作区-仓库架构设计方案

> 创建时间: 2026-02-26
> 关联任务: task-auto-analysis Forge Track
> 状态: 设计文档

---

## 📋 文档目的

本文档详细描述 OpenWork 如何扩展 OpenCode 来实现：
1. 需求与工作区的绑定机制
2. 多仓库管理（一个需求可能涉及多个仓库）
3. 虚拟工作区 vs 复用现有工作区的策略
4. OpenCode AI 如何知道修改哪个仓库的代码

---

## 🎯 核心问题

### 场景示例
- **需求 #12345**: 实现挂号功能
- **识别仓库**: outpatient-web（前端）、outpatient-api（后端）
- **工作区**: /tmp/openwork/vw-12345/
- **仓库位置**: 
  - /tmp/openwork/vw-12345/repos/outpatient-web/
  - /tmp/openwork/vw-12345/repos/outpatient-api/

### 关键问题
1. OpenCode AI 怎么知道要修改 `repos/outpatient-web/src/xxx`？
2. 怎么告诉 AI "先改前端，再改后端"？
3. AI 修改后怎么同步回原始仓库？

---

## 🏗️ 架构设计

### 1. 三层映射关系

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TFS 需求                                   │
│                           WorkItem #12345                               │
│                           "实现挂号功能"                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           虚拟工作区                                     │
│                    /tmp/openwork/vw-12345/                              │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │   OpenCode 引擎 (baseUrl + directory)                           │   │
│   │   - baseUrl: http://localhost:3000                              │   │
│   │   - directory: /tmp/openwork/vw-12345/                          │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │   .opencode/opencode.db (会话和消息)                            │   │
│   │   sessions: [{                                                  │   │
│   │     id: "ses_xxx",                                              │   │
│   │     name: "Task #12345 - Phase 2",                              │   │
│   │     context: {                                                  │   │
│   │       requirementId: 12345,                                     │   │
│   │       repositories: ["outpatient-web", "outpatient-api"],       │   │
│   │       currentRepo: "outpatient-web"                             │   │
│   │     }                                                           │   │
│   │   }]                                                            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │   opencode.json (OpenWork 扩展配置)                              │   │
│   │   {                                                             │   │
│   │     "openwork": {                                               │   │
│   │       "requirement": {                                          │   │
│   │         "workItemId": 12345,                                    │   │
│   │         "title": "实现挂号功能"                                  │   │
│   │       },                                                        │   │
│   │       "repositories": [                                         │   │
│   │         {                                                       │   │
│   │           "id": "outpatient-web",                               │   │
│   │           "localPath": "repos/outpatient-web",                  │   │
│   │           "currentBranch": "feature/tfs-12345",                 │   │
│   │           "role": "frontend"                                    │   │
│   │         },                                                      │   │
│   │         {                                                       │   │
│   │           "id": "outpatient-api",                               │   │
│   │           "localPath": "repos/outpatient-api",                  │   │
│   │           "currentBranch": "feature/tfs-12345",                 │   │
│   │           "role": "backend"                                     │   │
│   │         }                                                       │   │
│   │       ]                                                         │   │
│   │     }                                                           │   │
│   │   }                                                             │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             代码仓库                                    │
│                                                                          │
│   repos/outpatient-web/ (前端)                                          │
│   ├── src/                                                              │
│   │   ├── components/RegistrationForm.tsx  ← AI 修改这里                 │
│   │   └── api/registration.ts              ← AI 修改这里                 │
│   └── package.json                                                      │
│                                                                          │
│   repos/outpatient-api/ (后端)                                          │
│   ├── src/                                                              │
│   │   ├── controllers/RegistrationController.java  ← AI 修改这里         │
│   │   └── services/RegistrationService.java        ← AI 修改这里         │
│   └── pom.xml                                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 核心模块设计

### 1. 扩展类型定义

```typescript
// types/workspace-extension.ts

export interface OpenworkWorkspaceConfig {
  version: number;
  repositories?: RepositoryConfig[];
  tfs?: TFSWorkspaceConfig;
  virtualWorkspace?: VirtualWorkspaceConfig;
  forge?: ForgeWorkspaceConfig;
  automation?: AutomationWorkspaceConfig;
  metadata?: WorkspaceMetadata;
}

export interface RepositoryConfig {
  id: string;
  name: string;
  description?: string;
  remoteUrl: string;
  localPath: string;  // 相对于工作区根目录
  defaultBranch: string;
  currentBranch?: string;
  isPrimary?: boolean;
  techStack?: string[];
  lastSyncedAt?: string;
}

export interface RequirementContext {
  workItemId: number;
  title: string;
  description: string;
  repositories: Array<{
    id: string;
    name: string;
    path: string;        // repos/outpatient-web
    fullPath: string;    // /tmp/openwork/vw-12345/repos/outpatient-web
    role: 'frontend' | 'backend' | 'database' | 'shared';
    techStack: string[];
    currentTask?: string;
  }>;
  currentPhase: string;
  designDocument?: string;
}
```

---

### 2. Repository Manager（仓库管理器）

```typescript
// lib/repository/manager.ts

export class RepositoryManager {
  private workspaceRoot: string;
  private gitClients: Map<string, GitClient> = new Map();
  
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async initialize(): Promise<void> {
    const config = await this.loadWorkspaceConfig();
    await this.ensureReposDirectory();
    
    for (const repo of config.repositories || []) {
      const status = await this.checkRepositoryStatus(repo);
      console.log(`[RepositoryManager] ${repo.id}: ${status.status}`);
    }
  }

  async checkRepositoryStatus(config: RepositoryConfig): Promise<RepositoryStatus> {
    const fullPath = path.join(this.workspaceRoot, config.localPath);
    
    try {
      await fs.access(fullPath);
      const isGitRepo = await GitClient.isGitRepo(fullPath);
      
      if (!isGitRepo) {
        return { id: config.id, exists: true, isGitRepo: false, status: 'error' };
      }
      
      const gitClient = this.getGitClient(config);
      const gitStatus = await gitClient.status();
      
      return {
        id: config.id,
        exists: true,
        isGitRepo: true,
        currentBranch: gitStatus.branch,
        hasUncommittedChanges: !gitStatus.isClean,
        status: gitStatus.isClean ? 'clean' : 'dirty'
      };
    } catch (error) {
      return { id: config.id, exists: false, isGitRepo: false, status: 'missing' };
    }
  }

  async cloneRepository(config: RepositoryConfig, options?: CloneOptions): Promise<void> {
    const fullPath = path.join(this.workspaceRoot, config.localPath);
    
    console.log(`[RepositoryManager] Cloning ${config.remoteUrl} to ${fullPath}`);
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await GitClient.clone(
      config.remoteUrl,
      fullPath,
      options?.branch || config.defaultBranch
    );
    
    const gitClient = new GitClient({
      repoPath: fullPath,
      userName: 'OpenWork',
      userEmail: 'openwork@example.com',
      defaultBranch: config.defaultBranch
    });
    
    this.gitClients.set(config.id, gitClient);
    console.log(`[RepositoryManager] Cloned ${config.id} successfully`);
  }

  async createFeatureBranch(repoId: string, workItemId: number, baseBranch?: string): Promise<string> {
    const config = await this.getRepositoryConfig(repoId);
    const gitClient = this.getGitClient(config);
    
    const branchName = `feature/tfs-${workItemId}`;
    
    await gitClient.pull('origin', baseBranch || config.defaultBranch);
    await gitClient.createBranch(branchName, baseBranch || config.defaultBranch);
    
    console.log(`[RepositoryManager] Created branch ${branchName} in ${repoId}`);
    return branchName;
  }
}
```

---

### 3. Virtual Workspace Manager（虚拟工作区管理器）

```typescript
// lib/workspace/virtual-manager.ts

export interface VirtualWorkspace {
  id: string;  // vw-{workItemId}-{timestamp}
  workItemId: number;
  workItemTitle: string;
  rootPath: string;
  repositories: Array<{
    id: string;
    config: RepositoryConfig;
    status: 'pending' | 'cloning' | 'ready' | 'error';
  }>;
  createdAt: Date;
  expiresAt?: Date;
  status: 'creating' | 'ready' | 'active' | 'archived' | 'cleaned';
}

export class VirtualWorkspaceManager {
  private basePath: string;
  private virtualWorkspaces: Map<string, VirtualWorkspace> = new Map();
  private activeVirtualWorkspace: string | null = null;
  
  constructor(basePath?: string) {
    this.basePath = basePath || path.join(os.tmpdir(), 'openwork-virtual-workspaces');
  }

  async createVirtualWorkspace(params: {
    workItemId: number;
    workItemTitle: string;
    repositories: RepositoryConfig[];
    parentWorkspaceRoot: string;
    activate?: boolean;
  }): Promise<VirtualWorkspace> {
    const id = `vw-${params.workItemId}-${Date.now()}`;
    const rootPath = path.join(this.basePath, id);
    
    console.log(`[VirtualWorkspaceManager] Creating virtual workspace: ${id}`);
    
    // 1. 创建目录结构
    await this.createDirectoryStructure(rootPath);
    
    // 2. 复制 OpenCode 基础配置
    await this.initializeOpencodeConfig(rootPath, params.parentWorkspaceRoot);
    
    // 3. 创建虚拟工作区实例
    const vw: VirtualWorkspace = {
      id,
      workItemId: params.workItemId,
      workItemTitle: params.workItemTitle,
      rootPath,
      repositories: params.repositories.map(repo => ({
        id: repo.id,
        config: { ...repo, localPath: `repos/${repo.id}` },
        status: 'pending'
      })),
      createdAt: new Date(),
      status: 'creating'
    };
    
    // 4. 克隆所有仓库
    const repoManager = new RepositoryManager(rootPath);
    for (const repo of vw.repositories) {
      repo.status = 'cloning';
      try {
        await repoManager.cloneRepository(repo.config);
        repo.status = 'ready';
      } catch (error) {
        repo.status = 'error';
        console.error(`[VirtualWorkspaceManager] Failed to clone ${repo.id}:`, error);
      }
    }
    
    vw.status = 'ready';
    this.virtualWorkspaces.set(id, vw);
    await this.saveMetadata(vw);
    
    if (params.activate) {
      await this.activateVirtualWorkspace(id);
    }
    
    return vw;
  }

  async activateVirtualWorkspace(id: string): Promise<void> {
    const vw = this.virtualWorkspaces.get(id);
    if (!vw) throw new Error(`Virtual workspace ${id} not found`);
    
    console.log(`[VirtualWorkspaceManager] Activating virtual workspace: ${id}`);
    
    // 1. 停止当前引擎
    await engineStop();
    
    // 2. 启动新引擎指向虚拟工作区
    await engineStart(vw.rootPath, {
      runtime: 'direct',
      preferSidecar: true
    });
    
    vw.status = 'active';
    this.activeVirtualWorkspace = id;
    
    console.log(`[VirtualWorkspaceManager] Virtual workspace ${id} activated`);
  }

  async archiveVirtualWorkspace(id: string): Promise<void> {
    const vw = this.virtualWorkspaces.get(id);
    if (!vw) throw new Error(`Virtual workspace ${id} not found`);
    
    if (this.activeVirtualWorkspace === id) {
      await this.switchToParentWorkspace(vw);
    }
    
    // 归档目录
    const archivePath = path.join(this.basePath, 'archived', `${id}.tar.gz`);
    await this.archiveDirectory(vw.rootPath, archivePath);
    
    vw.status = 'archived';
    await this.saveMetadata(vw);
  }

  async cleanupVirtualWorkspace(id: string, force: boolean = false): Promise<void> {
    const vw = this.virtualWorkspaces.get(id);
    if (!vw) return;
    
    if (!force && vw.status === 'active') {
      throw new Error(`Cannot cleanup active virtual workspace ${id}`);
    }
    
    await fs.rm(vw.rootPath, { recursive: true, force: true });
    
    vw.status = 'cleaned';
    this.virtualWorkspaces.delete(id);
    console.log(`[VirtualWorkspaceManager] Cleaned up ${id}`);
  }
}
```

---

### 4. System Prompt 注入

```typescript
// lib/session/requirement-context-builder.ts

export function buildSystemPrompt(context: RequirementContext): string {
  const repoList = context.repositories.map(repo => `
- **${repo.name}** (${repo.role})
  - 路径: ${repo.path}
  - 技术栈: ${repo.techStack.join(', ')}
  - 当前任务: ${repo.currentTask || '待定'}
`).join('\n');

  return `你是一个专业的全栈开发工程师，正在开发以下需求：

## 📋 需求信息
- **ID**: TFS#${context.workItemId}
- **标题**: ${context.title}
- **描述**: ${context.description}

## 📁 工作区结构
工作区根目录: \`./\`
代码仓库位置: \`./repos/\`

## 🗂️ 目标仓库
${repoList}

## 🎯 开发规范
1. **文件操作**: 所有代码文件都在 \`./repos/{repo-id}/\` 下
   - 前端代码: \`./repos/outpatient-web/src/\`
   - 后端代码: \`./repos/outpatient-api/src/\`

2. **工作流**:
   - 先理解需求，再查看现有代码
   - 修改前确认文件路径正确
   - 每次修改后运行测试
   - 提交代码时关联 TFS#${context.workItemId}

3. **当前阶段**: ${context.currentPhase}

${context.designDocument ? `
## 📄 技术设计
${context.designDocument}
` : ''}

请始终在工作区内操作，不要访问工作区外的文件。`;
}

export async function createRequirementSession(
  baseUrl: string,
  workspaceRoot: string,
  context: RequirementContext
) {
  const client = createClient(baseUrl, workspaceRoot);
  
  const sessionResult = await client.session.create({
    name: `TFS#${context.workItemId} - ${context.title}`,
    metadata: {
      requirementId: context.workItemId,
      repositories: context.repositories.map(r => r.id),
      currentPhase: context.currentPhase
    }
  });
  
  const session = unwrap(sessionResult) as { id: string };
  
  const systemPrompt = buildSystemPrompt(context);
  
  await client.session.promptAsync({
    sessionID: session.id,
    parts: [{ type: 'text', text: systemPrompt }],
    system: true
  });
  
  return { sessionId: session.id, client, context };
}
```

---

## 🔄 执行流程

### 需求执行完整流程

```typescript
// app/context/task-center-execution.ts

export async function executeRequirement(options: {
  workItemId: number;
  title: string;
  repositories: RepositoryMatch[];
  designDocument: string;
  planDocument: string;
  strategy: 'virtual' | 'reuse';
}): Promise<void> {
  
  // ===== Phase 1: 准备工作区 =====
  console.log(`[ExecuteRequirement] Preparing workspace for #${options.workItemId}`);
  
  let workspaceRoot: string;
  let isVirtual: boolean;
  
  if (options.strategy === 'virtual') {
    const vw = await virtualWorkspaceManager.createVirtualWorkspace({
      workItemId: options.workItemId,
      workItemTitle: options.title,
      repositories: options.repositories.map(r => ({
        id: r.id,
        name: r.name,
        remoteUrl: resolveRemoteUrl(r.id),
        localPath: `repos/${r.id}`,
        defaultBranch: 'main'
      })),
      parentWorkspaceRoot: activeWorkspaceRoot(),
      activate: true
    });
    
    workspaceRoot = vw.rootPath;
    isVirtual = true;
    
    for (const repo of vw.repositories) {
      if (repo.status === 'ready') {
        const repoManager = new RepositoryManager(workspaceRoot);
        await repoManager.createFeatureBranch(repo.id, options.workItemId);
      }
    }
  } else {
    workspaceRoot = activeWorkspaceRoot();
    isVirtual = false;
    
    const repoManager = new RepositoryManager(workspaceRoot);
    for (const repo of options.repositories) {
      await repoManager.createFeatureBranch(repo.id, options.workItemId);
    }
  }
  
  // ===== Phase 2: 构建执行上下文 =====
  const context: RequirementContext = {
    workItemId: options.workItemId,
    title: options.title,
    description: '',
    repositories: options.repositories.map(r => ({
      id: r.id,
      name: r.name,
      path: `repos/${r.id}`,
      fullPath: path.join(workspaceRoot, 'repos', r.id),
      role: r.techStack?.includes('frontend') ? 'frontend' : 'backend',
      techStack: r.techStack || []
    })),
    currentPhase: 'implementation',
    designDocument: options.designDocument
  };
  
  // ===== Phase 3: 创建 OpenCode Session =====
  const { sessionId, client } = await createRequirementSession(
    'http://localhost:3000',
    workspaceRoot,
    context
  );
  
  // ===== Phase 4: 按阶段执行开发任务 =====
  const tasks = parsePlanDocument(options.planDocument);
  
  for (const task of tasks) {
    console.log(`[ExecuteRequirement] Executing task: ${task.title}`);
    
    updateTaskInContext(context, task);
    
    const taskPrompt = buildTaskPrompt(task, context);
    
    const result = await client.session.promptAsync({
      sessionID: sessionId,
      parts: [{ type: 'text', text: taskPrompt }]
    });
    
    await waitForSessionCompletion(client, sessionId);
    
    const completed = await verifyTaskCompletion(workspaceRoot, task);
    if (!completed) {
      console.warn(`[ExecuteRequirement] Task ${task.id} may not be completed`);
    }
  }
  
  // ===== Phase 5: 提交代码 =====
  const repoManager = new RepositoryManager(workspaceRoot);
  for (const repo of context.repositories) {
    const status = await repoManager.commitChanges(repo.id, {
      message: `[TFS#${options.workItemId}] ${options.title}`,
      push: true
    });
    console.log(`[ExecuteRequirement] Committed to ${repo.id}: ${status}`);
  }
  
  // ===== Phase 6: 清理（如果是虚拟工作区）=====
  if (isVirtual) {
    await virtualWorkspaceManager.archiveVirtualWorkspace(
      `vw-${options.workItemId}`
    );
  }
}
```

---

## 📊 关键机制

### 1. 如何让 AI 知道工作区结构

```typescript
const explorePrompt = `
请先探索当前工作区的结构，了解：
1. 有哪些代码仓库在 repos/ 目录下
2. 每个仓库的技术栈和目录结构
3. 找到与需求相关的入口文件

使用 ls、cat 等工具探索，然后告诉我你的发现。
`;
```

### 2. 多仓库协同开发

```typescript
const crossRepoPrompt = `
这个任务需要同时修改前端和后端：

1. **前端** (repos/outpatient-web/):
   - 修改挂号页面组件
   - 添加 API 调用

2. **后端** (repos/outpatient-api/):
   - 创建挂号接口
   - 实现业务逻辑

请先完成后端接口，再修改前端调用。每完成一个仓库的修改，告诉我进度。
`;
```

### 3. 验证机制

```typescript
const verifyPrompt = `
请验证以下验收标准是否满足：

- [ ] 代码可以编译/构建成功
- [ ] 相关测试通过
- [ ] 代码符合项目规范

如果验证失败，请修复问题。验证通过后，告诉我：
1. 运行了哪些验证命令
2. 验证结果
3. 修改的文件列表
`;
```

---

## 🚀 实施路线图

### Phase 1: 基础架构（1-2周）
- [ ] 创建 `types/workspace-extension.ts`
- [ ] 实现 `WorkspaceConfigManager`
- [ ] 扩展 `opencode.json` 配置结构

### Phase 2: 仓库管理（2-3周）
- [ ] 实现 `RepositoryManager`
- [ ] 集成 GitClient
- [ ] 添加仓库状态检查
- [ ] 批量克隆功能

### Phase 3: 虚拟工作区（2-3周）
- [ ] 实现 `VirtualWorkspaceManager`
- [ ] 虚拟工作区生命周期管理
- [ ] 自动清理策略
- [ ] 归档功能

### Phase 4: Task Center 集成（1-2周）
- [ ] 创建 `TaskCenterWorkspaceIntegration`
- [ ] 修改生成计划流程
- [ ] 添加工作区准备步骤

### Phase 5: UI/UX（1-2周）
- [ ] 工作区配置面板
- [ ] 仓库状态显示
- [ ] 虚拟工作区管理界面

---

## 💡 架构决策记录

### 决策 1: 虚拟工作区 vs 复用现有

**选择**: 两种策略都支持，由用户或配置决定

**理由**:
- 虚拟工作区：干净、隔离、可重复，适合自动化
- 复用现有：快速、熟悉，适合人工开发

### 决策 2: 配置存储位置

**选择**: `opencode.json` 中的 `openwork` 字段

**理由**:
- 与 OpenCode 原生配置统一
- 易于读取和修改
- 可以通过版本控制共享

### 决策 3: 仓库路径约定

**选择**: `repos/{repo-id}/`

**理由**:
- 清晰、一致
- 易于在 System Prompt 中描述
- 支持任意数量的仓库

---

## 📚 相关文档

- OpenCode SDK: https://opencode.ai/docs/
- Task Center 设计: forge/tracks/task-auto-analysis/
- Git Client: packages/app/src/automation/git/client.ts

---

*文档版本: 1.0*
*最后更新: 2026-02-26*
