# Tasks: TFS需求开发计划执行器

## Phase 1: Prompt工程 + Session管理 (Week 1)

### 1.1 核心类型定义
- [ ] 创建 `automation/plan-execution/types.ts`
  - [ ] 定义 `ExecutionContext` 接口
  - [ ] 定义 `ExecutionOptions` 接口
  - [ ] 定义 `ExecutionProgress` 接口
  - [ ] 定义 `ExecutionResult` 接口
  - [ ] 定义 `ExecutionMessage` 接口

### 1.2 Prompt构建器
- [ ] 实现 `ExecutionPromptBuilder`
  - [ ] `build()` 基础prompt模板
  - [ ] 支持自定义执行选项
  - [ ] 包含计划路径信息
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

## Phase 2: 进度监控 + 用户交互 (Week 1-2)

### 2.1 进度监控器
- [ ] 实现 `ExecutionProgressMonitor`
  - [ ] `parseProgress()` 解析进度信息
  - [ ] `isQuestion()` 检测AI提问
  - [ ] `isExecutionComplete()` 检测完成
  - [ ] `isExecutionFailed()` 检测失败
  - [ ] 支持多种进度格式

### 2.2 Session轮询机制
- [ ] 实现 `SessionPoller`
  - [ ] 定时轮询session消息（2秒间隔）
  - [ ] 增量获取新消息
  - [ ] 检测消息类型（进度/提问/完成/失败）
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

## Phase 4: TFS同步 + 完成处理 (Week 2)

### 4.1 TFS同步管理器
- [ ] 实现 `TFSSyncManager`
  - [ ] `syncExecutionStart()` 更新为"开发中"
  - [ ] `syncExecutionProgress()` 添加进度评论
  - [ ] `syncExecutionComplete()` 更新为"已完成"
  - [ ] 生成执行摘要报告

### 4.2 执行结果解析
- [ ] 实现 `ExecutionResultParser`
  - [ ] 解析完成消息
  - [ ] 提取生成的文件列表
  - [ ] 提取提交信息
  - [ ] 提取执行统计

### 4.3 完成处理
- [ ] 实现执行完成流程
  - [ ] 解析执行结果
  - [ ] 更新TFS状态
  - [ ] 显示完成摘要
  - [ ] 提供查看结果入口

### 4.4 错误处理
- [ ] 完善错误处理流程
  - [ ] 可重试错误自动重试
  - [ ] 需要人工介入的错误提示
  - [ ] 致命错误终止执行
  - [ ] 错误日志记录

## Phase 5: 测试与优化 (Week 2)

### 5.1 单元测试
- [ ] `prompt-builder.test.ts`
  - [ ] 测试prompt格式
  - [ ] 测试不同参数
- [ ] `progress-monitor.test.ts`
  - [ ] 测试进度解析
  - [ ] 测试提问检测
- [ ] `session-manager.test.ts`
  - [ ] 测试session生命周期

### 5.2 集成测试
- [ ] 完整执行流程测试
  - [ ] Mock OpenCode responses
  - [ ] 测试轮询机制
  - [ ] 测试TFS同步

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
Phase 1 (Prompt + Session)
    │
    ├──→ Phase 2 (Progress Monitor)
    │       │
    │       ├──→ Phase 3 (UI)
    │       │       │
    │       │       └──→ Phase 4 (TFS Sync)
    │       │               │
    │       │               └──→ Phase 5 (Test)
```

## 关键里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1 | Week 1中 | Prompt Builder可用，可发送execution prompt |
| M2 | Week 1末 | Session Manager可用，可监控执行进度 |
| M3 | Week 2中 | UI监控面板可用，可实时查看进度 |
| M4 | Week 2末 | TFS同步完成，可端到端执行 |
| M5 | Week 2末 | 测试通过，可投入使用 |

## 风险与缓解

| 风险 | 可能性 | 缓解措施 |
|------|--------|----------|
| Forge skills触发失败 | 中 | 优化prompt，提供详细的skill使用说明 |
| OpenCode session不稳定 | 低 | 实现session恢复机制 |
| 进度信息解析不准确 | 中 | 支持多种进度格式，容错处理 |
| AI提问过于频繁 | 中 | 优化prompt添加auto-confirm选项 |

## 成功标准检查清单

- [ ] 能正确构建并发送execution prompt
- [ ] OpenCode能正确理解和使用Forge skills
- [ ] 能实时显示执行进度
- [ ] 能正确处理AI提问
- [ ] 执行完成后能正确更新TFS状态
- [ ] UI响应流畅，用户体验良好
- [ ] 支持断点续传
- [ ] 错误处理完善

## 开发原则

1. **Prompt Engineering优先**: 通过优化prompt让OpenCode完成主要工作
2. **监控而非控制**: OpenWork只监控进度，不干预执行逻辑
3. **用户友好**: 清晰的进度展示，及时的问题反馈
4. **容错设计**: 网络问题、AI异常都能优雅处理

## Phase 1: 计划解析器 (Week 1)

### 1.1 核心类型定义
- [ ] 创建 `automation/plan-executor/types.ts`
  - [ ] 定义 `DevelopmentPlan` 接口
  - [ ] 定义 `Task` 接口（含依赖关系）
  - [ ] 定义 `GeneratedFile` 接口
  - [ ] 定义 `ReviewResult` 接口
  - [ ] 定义 `PlanExecutionState` 接口

### 1.2 计划读取器
- [ ] 实现 `PlanLoader`
  - [ ] `loadPlan(workItemId)` 读取三个文档
  - [ ] `readIntentMd()` 读取意图文档
  - [ ] `readDesignMd()` 读取设计文档
  - [ ] `readTasksMd()` 读取任务文档
  - [ ] 错误处理（文件不存在、格式错误）

### 1.3 任务解析器
- [ ] 实现 `TaskParser`
  - [ ] `parseTasks()` 解析Markdown任务列表
  - [ ] 识别任务ID、标题、描述
  - [ ] 提取任务依赖关系
  - [ ] 识别目标仓库
  - [ ] 支持嵌套任务（子任务）

### 1.4 依赖排序
- [ ] 实现 `DependencyResolver`
  - [ ] `topologicalSort()` 拓扑排序
  - [ ] 检测循环依赖
  - [ ] 并行任务分组
  - [ ] 执行顺序优化

## Phase 2: 任务执行器 (Week 1-2)

### 2.1 OpenCode Agent协调器
- [ ] 实现 `AgentCoordinator`
  - [ ] `initialize()` 初始化OpenCode连接
  - [ ] `callBuildAgent()` 调用@build
  - [ ] `callReviewAgent()` 调用@review
  - [ ] `callCommitAgent()` 调用@commit-helper
  - [ ] 结果解析和错误处理

### 2.2 Build Agent集成
- [ ] 实现 `BuildAgentClient`
  - [ ] 构建prompt（任务+设计文档）
  - [ ] 调用@build生成代码
  - [ ] 解析生成结果
  - [ ] 保存生成的文件
  - [ ] 支持重试机制

### 2.3 Review Agent集成
- [ ] 实现 `ReviewAgentClient`
  - [ ] 构建审查prompt
  - [ ] 调用@review审查代码
  - [ ] 解析审查报告（JSON）
  - [ ] 评分和issue提取
  - [ ] 生成审查报告文件

### 2.4 任务执行循环
- [ ] 实现 `TaskExecutor`
  - [ ] `executeTask()` 单任务执行
  - [ ] `executeWithRetry()` 带重试执行
  - [ ] `handleReviewResult()` 处理审查结果
  - [ ] `fixAndReview()` 修复并重新审查
  - [ ] 状态更新和持久化

### 2.5 工作区管理
- [ ] 实现 `WorkspaceManager`
  - [ ] `prepareWorkspace()` 准备工作区
  - [ ] `checkoutRepository()` 检出仓库
  - [ ] `writeFiles()` 写入生成文件
  - [ ] `resetWorkspace()` 重置工作区
  - [ ] 工作区隔离和清理

## Phase 3: 代码提交与验证 (Week 2)

### 3.1 Commit Agent集成
- [ ] 实现 `CommitAgentClient`
  - [ ] `generateCommitMessage()` 生成commit信息
  - [ ] `executeGitCommit()` 执行提交
  - [ ] `pushToRemote()` 推送到远程
  - [ ] 处理提交冲突

### 3.2 测试执行器
- [ ] 实现 `TestRunner`
  - [ ] `detectTestFramework()` 检测测试框架
  - [ ] `runTests()` 运行测试
  - [ ] `parseTestResults()` 解析测试结果
  - [ ] 失败处理和报告

### 3.3 TFS状态同步
- [ ] 实现 `TFSSyncManager`
  - [ ] `updateWorkItemState()` 更新工作项状态
  - [ ] `addProgressComment()` 添加进度评论
  - [ ] `createChildTasks()` 创建子任务（可选）
  - [ ] `linkCommitToWorkItem()` 关联commit

### 3.4 执行状态持久化
- [ ] 实现 `ExecutionStateManager`
  - [ ] `saveState()` 保存执行状态
  - [ ] `loadState()` 加载执行状态
  - [ ] `clearState()` 清除状态
  - [ ] 支持断点续传

## Phase 4: UI监控界面 (Week 2-3)

### 4.1 执行监控面板
- [ ] 创建 `PlanExecutionMonitor`
  - [ ] 总体进度显示
  - [ ] 任务列表（状态、进度）
  - [ ] 当前执行任务详情
  - [ ] Agent执行日志
  - [ ] 操作按钮（暂停/恢复/取消）

### 4.2 任务进度组件
- [ ] 创建 `TaskProgressCard`
  - [ ] 任务名称和描述
  - [ ] 当前状态（等待/执行/审查/完成/失败）
  - [ ] 进度条
  - [ ] 展开查看详情

### 4.3 Agent日志组件
- [ ] 创建 `AgentLogViewer`
  - [ ] 实时日志流
  - [ ] Agent标识（@build/@review）
  - [ ] 日志级别（info/warn/error）
  - [ ] 搜索和过滤

### 4.4 代码查看器
- [ ] 创建 `GeneratedCodeViewer`
  - [ ] 代码语法高亮
  - [ ] 文件树导航
  - [ ] 代码差异对比
  - [ ] 复制/下载代码

### 4.5 审查报告组件
- [ ] 创建 `ReviewReportViewer`
  - [ ] 质量评分显示
  - [ ] Issue列表（严重程度）
  - [ ] 代码位置定位
  - [ ] 修复建议

## Phase 5: Phase集成与测试 (Week 3)

### 5.1 Phase 4实现
- [ ] 创建 `PhasePlanExecutor`
  - [ ] 实现 `PhaseExecutor` 接口
  - [ ] 集成 PlanParser
  - [ ] 集成 TaskExecutor
  - [ ] 集成 AgentCoordinator
  - [ ] 集成 TFS Sync

### 5.2 与AutomationEngine集成
- [ ] 修改 `AutomationEngine`
  - [ ] 注册 Phase 4
  - [ ] 配置 AgentCoordinator
  - [ ] 错误处理和状态同步

### 5.3 与Task Center集成
- [ ] 修改 `TaskCenterStore`
  - [ ] 添加执行相关状态
  - [ ] 添加启动执行方法
  - [ ] 添加监控UI控制

### 5.4 单元测试
- [ ] `plan-parser.test.ts`
  - [ ] 测试任务解析
  - [ ] 测试依赖排序
- [ ] `task-executor.test.ts`
  - [ ] 测试执行循环
  - [ ] 测试重试机制
- [ ] `agent-coordinator.test.ts`
  - [ ] 测试Agent调用
  - [ ] 测试结果解析

### 5.5 集成测试
- [ ] 完整执行流程测试
  - [ ] Mock OpenCode agents
  - [ ] Mock Git操作
  - [ ] Mock TFS API
- [ ] 错误恢复测试
  - [ ] 断点续传
  - [ ] 失败重试
  - [ ] 取消操作

## Phase 6: 性能优化与完善 (Week 3-4)

### 6.1 并行执行优化
- [ ] 实现 `ParallelTaskExecutor`
  - [ ] 识别可并行任务
  - [ ] 并发控制（最大并发数）
  - [ ] 结果合并

### 6.2 智能体提示词优化
- [ ] 优化@build prompt
  - [ ] 添加项目上下文
  - [ ] 添加编码规范
  - [ ] 添加示例代码
- [ ] 优化@review prompt
  - [ ] 细化审查维度
  - [ ] 标准化输出格式

### 6.3 错误处理增强
- [ ] 增加错误分类
  - [ ] 可重试错误
  - [ ] 需要人工介入错误
  - [ ] 致命错误
- [ ] 增加错误恢复策略
  - [ ] 自动修复尝试
  - [ ] 智能重试策略

### 6.4 文档完善
- [ ] 更新技术文档
- [ ] 编写用户指南
  - [ ] 如何查看执行进度
  - [ ] 如何处理执行失败
  - [ ] 如何自定义agents
- [ ] 编写开发文档
  - [ ] 如何添加新的agent
  - [ ] 如何扩展任务类型

---

## 依赖关系

```
Phase 1 (解析器)
    │
    ├──→ Phase 2 (执行器)
    │       │
    │       ├──→ Phase 3 (提交与同步)
    │       │
    │       └──→ Phase 4 (UI)
    │               │
    │               └──→ Phase 5 (集成)
    │                       │
    │                       └──→ Phase 6 (优化)
```

## 关键里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1 | Week 1末 | 计划解析器可用，可正确解析tasks.md |
| M2 | Week 2中 | 任务执行器可用，可调用agents执行 |
| M3 | Week 2末 | 代码提交流程完成，可提交到Git |
| M4 | Week 3中 | UI监控界面完成，可实时查看进度 |
| M5 | Week 3末 | 完整流程集成，可端到端执行 |
| M6 | Week 4末 | 优化完成，性能达标，文档完善 |

## 风险与缓解

| 风险 | 可能性 | 缓解措施 |
|------|--------|----------|
| OpenCode agent不稳定 | 中 | 实现重试机制，降级到默认实现 |
| 任务解析不准确 | 低 | 增加解析测试，支持多种格式 |
| 代码生成质量差 | 中 | 优化prompt，增加审查循环 |
| 执行时间长 | 中 | 支持并行执行，提供进度反馈 |

## 成功标准检查清单

- [ ] 能正确解析Task Center生成的tasks.md
- [ ] 能按依赖顺序执行所有任务
- [ ] 代码通过@review审查（评分>70）
- [ ] 代码成功提交到Git仓库
- [ ] TFS状态自动更新
- [ ] UI可实时显示执行进度
- [ ] 支持断点续传
- [ ] 支持取消和恢复
