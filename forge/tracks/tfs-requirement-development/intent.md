# Intent: TFS需求开发计划执行器

## Why

当前Task Center已经完成了需求分析和开发计划生成（Phase 1-3）：
- ✅ **Phase 1: Analyze** - AI智能分析TFS需求
- ✅ **Phase 2: Design** - 生成技术设计方案  
- ✅ **Phase 3: Plan** - 创建详细的开发任务列表

生成的计划文档位于：
```
forge/tracks/tfs-{workitem-id}/
├── intent.md    (需求意图和Scope)
├── design.md    (技术架构和设计)
└── tasks.md     (具体实现任务)
```

**本track的目标是通过OpenCode执行这个已生成的计划**，完成实际的代码编写、审查和提交工作。

## Scope

### In Scope - 计划执行

#### Phase 4: Execute Plan (执行计划)
- 读取已生成的 `tasks.md` 中的任务列表
- 通过OpenCode使用Forge skills执行计划
- 监控执行进度并反馈给用户
- 处理执行过程中的交互（提问、确认等）

#### Phase 5: Commit & Verify (提交与验证)
- Forge skills自动完成代码提交
- 运行测试验证
- 更新TFS工作项状态

### Out of Scope
- 需求分析（已完成）
- 开发计划生成（已完成）
- 复杂的代码生成逻辑（由Forge skills处理）
- 深度代码审查（由Forge subagents处理）

## Technical Approach

### OpenWork + OpenCode + Forge Skills 协作架构

```
┌─────────────────────────────────────────────┐
│              OpenWork Task Center            │
│                                              │
│  • 接收用户"开始开发"指令                   │
│  • 构建execution prompt                     │
│  • 创建OpenCode session                     │
│  • 监控执行进度                             │
│  • 同步TFS状态                              │
└─────────────────────┬───────────────────────┘
                      │ 创建Session + Prompt
                      ▼
┌─────────────────────────────────────────────┐
│           OpenCode AI (with Forge Skills)    │
│                                              │
│  读取 forge-execute SKILL.md                │
│       │                                      │
│       ├──→ using-git-worktrees (准备工作区) │
│       │                                      │
│       ├──→ executing-plans /               │
│       │    subagent-driven-development     │
│       │    (执行tasks.md中的任务)          │
│       │                                      │
│       └──→ finishing-a-development-branch  │
│            (完成和提交)                     │
│                                              │
│  🔑 Forge skills自动处理：                  │
│  • 读取并理解tasks.md                       │
│  • 创建隔离的worktree                       │
│  • 逐个执行task                             │
│  • 自动更新checkbox状态                     │
│  • 代码审查和修复                           │
│  • git提交和推送                            │
└─────────────────────────────────────────────┘
```

### 核心机制：Prompt Engineering

OpenWork不需要实现复杂的执行逻辑，只需要：

1. **构建高质量的execution prompt**
2. **创建OpenCode session并发送prompt**
3. **监控session状态和消息**
4. **同步执行结果到TFS**

让OpenCode AI自主使用Forge skills完成所有执行工作。

## Target

**输入**: Task Center生成的计划文档
- `forge/tracks/tfs-{id}/intent.md`
- `forge/tracks/tfs-{id}/design.md`
- `forge/tracks/tfs-{id}/tasks.md`

**输出**: 
- 完成的代码实现（在worktree中）
- Git commit和push
- 更新的TFS工作项状态

## Success Criteria

### 功能要求
- [ ] 成功读取并发送正确的execution prompt
- [ ] OpenCode正确理解和使用Forge skills
- [ ] 所有tasks.md中的任务被执行完成
- [ ] 代码成功提交到Git仓库
- [ ] TFS工作项状态自动更新为"已完成"

### 交互要求
- [ ] 实时显示执行进度
- [ ] 显示当前执行的任务
- [ ] 处理AI的提问和确认请求
- [ ] 支持暂停和恢复执行

### 质量要求
- [ ] 生成的代码符合设计文档
- [ ] 通过Forge skills的审查
- [ ] 包含基本的错误处理

## Timeline

- **Week 1**: Prompt工程 + OpenCode Session管理
- **Week 2**: 进度监控 + TFS同步 + UI集成

## Dependencies

- **输入**: Task Center生成的开发计划文档
- **依赖**: OpenCode SDK (@opencode-ai/sdk)
- **依赖**: Forge skills (forge-execute, using-git-worktrees, executing-plans等)
- **依赖**: TFSClient (已存在)

## Key Design Decision

**OpenWork不实现执行逻辑，只负责编排和监控。**

所有的执行工作（代码生成、审查、提交）都通过OpenCode使用Forge skills完成。OpenWork的核心价值是：
- 无缝集成到Task Center工作流
- 提供友好的执行监控UI
- 自动同步TFS状态

## Related Work

- **前置**: Task Center需求分析功能
- **前置**: Task Center计划生成功能
- **前置**: Forge skills (已存在于.opencode/skills/forge/)

## Notes

本track的核心是**Prompt Engineering + 监控编排**，不是底层执行逻辑实现。
所有代码生成、审查、提交的复杂性都由Forge skills和OpenCode处理。
