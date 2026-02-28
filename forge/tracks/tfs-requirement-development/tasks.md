# Tasks: TFS需求开发计划执行器

## Phase 0: 文档获取基础设施 (Week 1)

### 0.1 Track 路径和文档读取
- [ ] 实现 Track 路径生成器
  - [ ] `getTrackId(workItemId)` → `tfs-${workItemId}`
  - [ ] `getTrackPath(workItemId)` → `forge/tracks/tfs-${workItemId}`
  - [ ] `getArtifactPath(scope, workItemId)` → 持久化存储路径
  - [ ] 单元测试

### 0.2 Plan Docs 读取器
- [ ] 实现 `PlanDocsLoader`
  - [ ] `loadFromArtifactStore(tfsId)` 从 IndexedDB/localStorage 读取
  - [ ] `loadFromFileSystem(tfsId)` 从 AppLocalData 直接读取（备选）
  - [ ] 读取 `planDocs.intent`
  - [ ] 读取 `planDocs.design`
  - [ ] 读取 `planDocs.tasks` ⭐核心
  - [ ] 错误处理（文档不存在、格式错误）
  - [ ] 单元测试

### 0.3 文档验证器
- [ ] 实现 `PlanDocsValidator`
  - [ ] 验证 intent.md 存在且非空
  - [ ] 验证 design.md 存在且非空
  - [ ] 验证 tasks.md 存在且非空
  - [ ] 验证 tasks.md 格式（可解析的任务列表）
  - [ ] 验证失败时显示友好错误信息

### 0.4 工作空间管理器
- [ ] 实现 `workspace-manager.ts`
  - [ ] `getOrCreateWorkspace()` 获取或创建工作空间
  - [ ] `matchExistingWorkspace()` 匹配现有工作区（Git URL + 路径）
  - [ ] `autoCreateWorkspace()` 自动创建工作区
  - [ ] 记录映射关系到 workspaceMap
  - [ ] 验证工作空间有效性
  - [ ] 单元测试

### 0.5 工作空间集成到 Task Center
- [ ] 修改 `task-center.ts`
  - [ ] 在执行按钮点击时调用 `getOrCreateWorkspace()`
  - [ ] 获取 workspaceRoot 后传递给 Prompt Builder
  - [ ] 工作区不存在时自动创建
  - [ ] 创建成功后记录映射关系到 workspaceMap
  - [ ] 提供工作区选择器（如果匹配到多个）
  - [ ] 文档不存在时提示用户先生成计划
  - [ ] 文档验证通过后才允许启动执行

---

## Phase 1: Prompt工程 + Session管理 (Week 1)

### 1.1 核心类型定义
- [ ] 创建 `automation/plan-execution/types.ts`
  - [ ] 定义 `ExecutionContext` 接口
  - [ ] 定义 `ExecutionOptions` 接口
  - [ ] 定义 `ExecutionProgress` 接口
  - [ ] 定义 `ExecutionResult` 接口
  - [ ] 定义 `ExecutionMessage` 接口
  - [ ] 定义 `WorkspaceMapEntry` 接口（从 task-center.ts 复用）
  - [ ] 定义 `ResolvedWorkspace` 接口
  - [ ] 定义 `WorkspaceManagerOptions` 接口

### 1.2 Prompt构建器
- [ ] 实现 `ExecutionPromptBuilder`
  - [ ] `build()` 基础prompt模板
  - [ ] 支持自定义执行选项
  - [ ] 包含计划路径信息
  - [ ] 包含 workspaceRoot 路径 ⭐告诉 AI 在哪执行
  - [ ] 包含Forge skills使用说明
  - [ ] 测试不同参数组合

### 1.3 Session管理器
- [ ] 实现 `OpenCodeSessionManager`
  - [ ] `createExecutionSession()` 创建session
  - [ ] `sendExecutionPrompt()` 发送prompt
  - [ ] `getSessionMessages()` 获取消息
  - [ ] `closeSession()` 关闭session
  - [ ] 错误处理和重试机制

### 1.4 Prompt优化
- [ ] 测试并优化execution prompt
  - [ ] 确保能正确触发forge-execute skill
  - [ ] 测试不同复杂度计划的执行效果
  - [ ] 添加进度报告要求
  - [ ] 添加问题反馈机制

---

## Phase 2: 进度监控 + 用户交互 (Week 1-2)

### 2.1 进度监控器
- [ ] 实现 `ExecutionProgressMonitor`
  - [ ] `parseProgress()` 解析进度信息
  - [ ] `isQuestion()` 检测AI提问
  - [ ] `isExecutionComplete()` 检测完成
  - [ ] `isExecutionFailed()` 检测失败
  - [ ] `isArchiveComplete()` 检测归档完成 ⭐新增
  - [ ] 支持多种进度格式

### 2.2 Session轮询机制
- [ ] 实现 `SessionPoller`
  - [ ] 定时轮询session消息（2秒间隔）
  - [ ] 增量获取新消息
  - [ ] 检测消息类型（进度/提问/完成/失败/归档）
  - [ ] 支持暂停和恢复轮询

### 2.3 提问处理
- [ ] 实现提问检测和展示
  - [ ] 识别AI的确认请求
  - [ ] 暂停执行等待用户回答
  - [ ] 发送用户回答回OpenCode
  - [ ] 恢复执行流程

### 2.4 执行状态管理
- [ ] 实现 `PlanExecutionStore`
  - [ ] 存储当前执行状态
  - [ ] 存储执行历史
  - [ ] 支持断点续传
  - [ ] 状态持久化到本地存储

---

## Phase 3: UI监控界面 (Week 2)

### 3.1 执行监控面板
- [ ] 创建 `PlanExecutionMonitor`
  - [ ] 总体进度显示
  - [ ] 当前状态显示
  - [ ] 执行消息列表
  - [ ] 操作按钮（暂停/取消）

### 3.2 进度组件
- [ ] 创建 `ExecutionProgressBar`
  - [ ] 进度百分比
  - [ ] 当前任务名称
  - [ ] 估计剩余时间
  - [ ] 已用时间

### 3.3 消息列表
- [ ] 创建 `ExecutionMessageList`
  - [ ] 消息类型图标（AI/用户）
  - [ ] 时间戳
  - [ ] 滚动自动跟随
  - [ ] 搜索和过滤

### 3.4 提问对话框
- [ ] 创建 `QuestionModal`
  - [ ] 显示AI的问题
  - [ ] 输入框供用户回答
  - [ ] 快捷选项按钮
  - [ ] 提交和取消按钮

### 3.5 集成到Task Center
- [ ] 修改 `task-center.tsx`
  - [ ] 添加执行监控面板入口
  - [ ] 根据执行状态显示/隐藏
  - [ ] 添加启动执行按钮

---

## Phase 4: 归档监控 + TFS同步 (Week 2)

### 4.1 归档监控
- [ ] 实现 `ArchiveMonitor`
  - [ ] 监听 forge-archive 执行消息
  - [ ] 检测 "[forge-archive] 归档完成" 消息
  - [ ] 提取归档路径 `forge/archives/YYYY-MM-DD-tfs-{id}/`
  - [ ] 归档失败时记录错误
  - [ ] 超时检测（归档应在执行完成后 1 分钟内完成）

### 4.2 TFS同步管理器
- [ ] 实现 `TFSSyncManager`
  - [ ] `syncExecutionStart()` 可选：更新为"开发中"
  - [ ] `syncExecutionComplete()` 归档成功后更新为"已解决" ⭐关键
  - [ ] 生成执行摘要评论
  - [ ] 包含归档路径信息
  - [ ] 关联 commit hash（如果有）

### 4.3 执行结果解析
- [ ] 实现 `ExecutionResultParser`
  - [ ] 解析 forge-execute 完成消息
  - [ ] 解析 forge-verify 验证结果
  - [ ] 提取生成的文件列表
  - [ ] 提取提交信息（commit hash、message）
  - [ ] 提取执行统计（任务数、时长）

### 4.4 完成处理流程
- [ ] 实现 `onExecutionCompleted()`
  - [ ] 等待归档监控确认归档完成
  - [ ] 解析执行结果
  - [ ] 调用 `syncExecutionComplete()` 更新 TFS
  - [ ] 显示完成摘要（包含归档路径）
  - [ ] 提供"查看归档"按钮

### 4.5 错误处理
- [ ] 完善错误处理流程
  - [ ] forge-archive 失败：提示用户手动归档
  - [ ] TFS 同步失败：重试机制（最多3次）
  - [ ] 网络错误：可恢复，等待重连
  - [ ] 致命错误：记录日志，终止执行

---

## Phase 5: 测试与优化 (Week 2)

### 5.1 单元测试
- [ ] `workspace-manager.test.ts`
  - [ ] 测试 `getOrCreateWorkspace()`
  - [ ] 测试 `matchExistingWorkspace()`
  - [ ] 测试 `autoCreateWorkspace()`
  - [ ] 测试映射记录
- [ ] `prompt-builder.test.ts`
  - [ ] 测试prompt格式
  - [ ] 测试不同参数
- [ ] `progress-monitor.test.ts`
  - [ ] 测试进度解析
  - [ ] 测试提问检测
  - [ ] 测试归档完成检测
- [ ] `session-manager.test.ts`
  - [ ] 测试session生命周期

### 5.2 集成测试
- [ ] 完整执行流程测试
  - [ ] Mock OpenCode responses
  - [ ] 测试轮询机制
  - [ ] 测试TFS同步
- [ ] 工作空间管理测试
  - [ ] 测试自动创建
  - [ ] 测试重新匹配

### 5.3 Prompt调优
- [ ] 优化execution prompt
  - [ ] 提高Forge skills触发率
  - [ ] 优化进度报告格式
  - [ ] 减少不必要的提问

### 5.4 性能优化
- [ ] UI渲染优化
  - [ ] 消息列表虚拟滚动
  - [ ] 减少不必要的重渲染
- [ ] 轮询优化
  - [ ] 智能调整轮询间隔
  - [ ] 空闲时降低频率

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
| M0 | Week 1初 | 文档获取可用，可从 Artifact Store 读取 planDocs；工作空间管理器可用 |
| M1 | Week 1中 | Prompt Builder 可用，可构建 Forge 标准 execution prompt |
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

## 成功标准检查清单

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

## 开发原则

1. **Prompt Engineering优先**: 通过优化prompt让OpenCode完成主要工作
2. **监控而非控制**: OpenWork只监控进度，不干预执行逻辑
3. **用户友好**: 清晰的进度展示，及时的问题反馈
4. **容错设计**: 网络问题、AI异常都能优雅处理
5. **工作空间管理**: 自动获取/创建/记录工作空间，确保代码在正确位置执行
