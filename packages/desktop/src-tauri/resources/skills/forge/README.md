# Forge 最佳实践指南

> Forge 是一个结构化的软件开发工作流框架，确保变更的可追踪性、可验证性和可维护性。

---

## 核心原则

1. **意图先行** - 先明确为什么做、做什么、成功标准是什么
2. **契约驱动** - 模块间接口先定义，再实现
3. **隔离执行** - 每个变更在独立的 worktree 中进行
4. **验证为王** - 没有验证的声称是欺骗，不是效率
5. **可追溯归档** - 完成的变更归档保存，成为系统知识

---

## 核心流程（5步工作流）

```
┌─────────────────────────────────────────────────────────────────┐
│                     Forge 标准工作流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │ forge-start  │  ← 检查结构、发现活动 tracks、决策入口         │
│  └──────┬───────┘                                               │
│         │                                                       │
│  ┌──────▼───────┐                                               │
│  │ forge-plan   │  ← 创建意图、契约、设计、任务                   │
│  └──────┬───────┘                                               │
│         │                                                       │
│  ┌──────▼───────┐                                               │
│  │ forge-execute│  ← 创建 worktree，执行实现                     │
│  └──────┬───────┘                                               │
│         │                                                       │
│  ┌──────▼───────────────────┐                                   │
│  │ verification-before-     │  ← 铁律：先验证，再声称             │
│  │ completion               │                                   │
│  └──────┬───────────────────┘                                   │
│         │                                                       │
│  ┌──────▼───────┐                                               │
│  │ forge-verify │  ← 三维验证：完整性、正确性、一致性             │
│  └──────┬───────┘                                               │
│         │                                                       │
│  ┌──────▼──────────┐                                            │
│  │ forge-archive   │  ← 合并契约到 main，归档 track              │
│  └──────┬──────────┘                                            │
│         │                                                       │
│  ┌──────▼──────────┐                                            │
│  │ forge-finish    │  ← 合并/PR/保留/丢弃，清理 worktree         │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 详细流程说明

### Step 1: forge-start（入口）

**作用**：统一入口，智能检测项目状态

**决策树**：
```
forge/ 存在？
├── No → 创建骨架 → 询问是否教程
│         ├── Yes: 5分钟教程 → forge-plan
│         └── No: 直接进入 forge-plan
├── Yes → 有活动 tracks？
          ├── Yes: 列出 tracks → 询问继续/归档/新建
          └── No: 直接进入 forge-plan
```

**何时使用**：
- ✅ 每次开始 Forge 工作时
- ✅ 不确定项目状态时
- ✅ 想查看活动 tracks 时

**永远不要**：
- ❌ 手动创建 `forge/` 目录
- ❌ 跳过直接开始编码

---

### Step 2: forge-plan（规划）

**作用**：将想法转化为可执行的计划

**输出产物**：
```
forge/tracks/<change>/
├── intent.md          ← 为什么、做什么、成功标准
├── contracts/         ← 契约先行
│   ├── types/contract.md
│   ├── store/contract.md
│   ├── lib/contract.md
│   ├── ui/contract.md
│   └── ...
├── design.md          ← 架构和数据流
└── tasks.md           ← 可执行的任务清单
```

**契约内容模板**：
```markdown
# Contract: <domain>

## ADDED
- [需求描述] → [接口签名]

## MODIFIED
- [原接口] → [新接口]

## REMOVED
- [废弃接口]
```

**关键原则**：
- ✅ 契约先于设计
- ✅ 设计先于任务
- ✅ 任务必须可测试、可验收

---

### Step 3: forge-execute（执行）

**作用**：创建隔离环境，选择执行策略

**流程**：
```
1. 选择变更/track
2. 调用 using-git-worktrees 创建隔离工作区
   ┌─────────────────────────────────────┐
   │ .worktrees/<change>/                │
   │   ├── 独立文件系统                   │
   │   ├── 独立 node_modules/.git        │
   │   └── 基于 <base-branch>            │
   └─────────────────────────────────────┘
3. 选择执行模式：
   ├── subagent-driven-development    ← 本会话，任务独立
   └── executing-plans                ← 分批，需要检查点
4. 实施任务（更新 tasks.md 状态）
```

**何时选择哪种模式**：

| 情况 | 推荐模式 |
|------|----------|
| 想留在当前会话 | subagent-driven-development |
| 任务高度独立 | subagent-driven-development |
| 需要人类检查点 | executing-plans |
| 任务有复杂依赖 | executing-plans |
| 需要跨会话 | executing-plans |

---

### Step 4: verification-before-completion（验证原则）

**作用**：铁律 - 没有验证就没有完成

**5步验证法**：
```
1. IDENTIFY: 什么命令能证明这个声称？
2. RUN: 执行完整命令（新鲜、完整）
3. READ: 读取完整输出，检查退出码
4. VERIFY: 输出是否证实了声称？
5. ONLY THEN: 做出声称
```

**禁止词**：
- "应该通过了" ❌
- "看起来正确" ❌
- "应该没问题" ❌
- "大概率成功" ❌

**必须**：
- "测试通过：34/34 ✅" ✓
- "构建成功：exit 0 ✅" ✓
- "验证输出：[具体输出] ✅" ✓

---

### Step 5: forge-verify（Forge 验证）

**作用**：三维验证实现是否符合计划

**验证维度**：

| 维度 | 检查内容 | 发现问题 |
|------|----------|----------|
| **Completeness** | tasks.md 完成度、契约需求覆盖度 | CRITICAL |
| **Correctness** | 代码是否符合契约、测试是否覆盖场景 | WARNING |
| **Coherence** | 代码是否符合设计决策、模式一致性 | SUGGESTION |

**输出格式**：
```markdown
## Forge Verification: <change>

### Summary
| Dimension    | Status |
|--------------|--------|
| Completeness | 8/8 tasks, 12 reqs |
| Correctness  | 11/12 reqs covered |
| Coherence    | Followed |

### CRITICAL
- 未实现需求 X → 完成任务 Y

### WARNING
- 契约 Y 的实现与定义不符 → 修正接口签名

### SUGGESTION
- 考虑统一错误处理模式

Final: Ready with warnings
```

**状态判定**：
- `Ready` → 可以归档
- `Ready with warnings` → 可以归档（记录警告）
- `Blocked` → 必须修复后才能归档

---

### Step 6: forge-archive（归档）

**作用**：将变更固化为系统知识

**操作**：
```
1. 确认验证证据存在
2. 合并 delta contracts 到 main contracts：
   forge/contracts/<domain>/contract.md
3. 移动 track 到归档：
   forge/tracks/<change>/ → forge/archives/YYYY-MM-DD-<change>/
```

**多 track 模式**：
- 检测契约冲突
- 按依赖顺序归档
- 解决冲突后归档

---

### Step 7: forge-finish（完成分支）

**作用**：决定如何集成工作，清理资源

**4个选项**：

| 选项 | 操作 | Worktree | Branch |
|------|------|----------|--------|
| 1. Merge locally | checkout → pull → merge → 验证 → branch -d | ❌ 清理 | ✅ 删除 |
| 2. Create PR | push → gh pr create | ✅ 保留 | ✅ 保留 |
| 3. Keep as-is | 仅报告 | ✅ 保留 | ✅ 保留 |
| 4. Discard | 输入"discard"确认 → checkout → branch -D | ❌ 清理 | ✅ 强制删除 |

**Worktree 清理规则**：
- 选项 1、2、4 → 执行清理
- 选项 3 → **不清理**

---

## 支持 Skills 速查

### 执行策略

| Skill | 用途 | 调用时机 |
|-------|------|----------|
| `subagent-driven-development` | 当前会话执行独立任务 | forge-execute 选择 |
| `executing-plans` | 分批执行，带检查点 | forge-execute 选择 |
| `dispatching-parallel-agents` | 并行执行独立任务 | 任务完全独立时 |

### 基础设施

| Skill | 用途 |
|-------|------|
| `using-git-worktrees` | 创建隔离工作区 |
| `verification-before-completion` | 验证铁律（通用） |

### 代码审查

| Skill | 用途 |
|-------|------|
| `requesting-code-review` | 发起代码审查 |
| `receiving-code-review` | 处理审查反馈 |

### 工作流保护

| Skill | 用途 |
|-------|------|
| `forge-workflow-guard` | 验证 Forge 步骤完整性 |

---

## 完整示例流程

### 场景：添加用户登录功能

```
# Step 1: 启动
User: 我要添加用户登录功能
AI: [Running forge-start]
    → 发现无 Forge 结构
    → 创建骨架
    → 进入 forge-plan

# Step 2: 规划
AI: [Running forge-plan for "user-login"]
    → 创建 intent.md
       "添加邮箱/密码登录，支持记住我"
    → 创建契约：
       - contracts/types/: LoginRequest, LoginResponse
       - contracts/store/: authState, loginAction
       - contracts/ui/: LoginForm props
       - contracts/api/: /api/auth/login endpoint
    → 创建 design.md
       描述登录流程、错误处理、状态管理
    → 创建 tasks.md
       1. 实现 types
       2. 实现 API endpoint
       3. 实现 store actions
       4. 实现 LoginForm 组件
       5. 集成测试

# Step 3: 执行
AI: [Running forge-execute]
    → 选择 subagent-driven-development
    → 创建 .worktrees/user-login/
    → 依次执行任务（标记 tasks.md）

# Step 4: 验证原则
AI: 运行测试：npm test
    输出：42/42 passing ✅
    → 通过 verification-before-completion

# Step 5: Forge 验证
AI: [Running forge-verify]
    → Completeness: 5/5 tasks ✅
    → Correctness: 契约实现匹配 ✅
    → Coherence: 符合设计 ✅
    Final: Ready

# Step 6: 归档
AI: [Running forge-archive]
    → 合并契约到 forge/contracts/
    → 移动到 forge/archives/2024-03-15-user-login/

# Step 7: 完成
AI: [Running forge-finish]
    → 选项 2: Create PR
    → push branch
    → gh pr create
    → 清理 .worktrees/user-login/
```

---

## 常见错误与解决方案

### ❌ 错误 1: 跳过 forge-start
**问题**：可能错过活动 tracks，重复工作或丢失上下文
**解决**：总是从 forge-start 开始

### ❌ 错误 2: 契约后于设计
**问题**：设计没有接口约束，实现时才发现问题
**解决**：契约 → 设计 → 任务，严格顺序

### ❌ 错误 3: 在 main 分支直接开发
**问题**：污染主分支，无法并行工作
**解决**：总是使用 forge-execute 创建 worktree

### ❌ 错误 4: 声称完成但未验证
**问题**：代码可能不工作，浪费后续时间
**解决**：严格执行 verification-before-completion

### ❌ 错误 5: 不更新 tasks.md
**问题**：进度不可见，可能重复或遗漏
**解决**：每个任务完成后更新 tasks.md

### ❌ 错误 6: 错误选择 finish 选项
**问题**：
- 选了 Merge 但想发 PR
- 选了 Discard 误删工作
**解决**：
- 想合并到 main → 选项 1
- 想代码审查 → 选项 2
- 暂时不处理 → 选项 3
- 确定废弃 → 选项 4（需确认）

### ❌ 错误 7: Worktree 泄露
**问题**：.worktrees/ 目录堆积，占用空间
**解决**：
- 选项 1/4 自动清理
- 选项 2/3 记得后续手动清理

---

## 决策速查表

### 我开始新工作时...

```
Q: 项目有 Forge 结构吗？
├─ No → 运行 forge-start
└─ Yes → 有活动 tracks？
         ├─ Yes → 选择继续、归档或新建
         └─ No → 运行 forge-plan
```

### 我准备好实现时...

```
Q: 需要人类检查点吗？
├─ Yes → 选择 executing-plans
└─ No → 任务完全独立？
         ├─ Yes → 选择 subagent-driven-development
         └─ No → 选择 executing-plans
```

### 我完成实现时...

```
必须顺序：
1. 运行测试（verification-before-completion）
2. 运行 forge-verify
3. 运行 forge-archive
4. 运行 forge-finish
```

---

## 目录结构约定

```
project/
├── forge/
│   ├── tracks/              # 进行中
│   │   └── <change>/
│   │       ├── intent.md
│   │       ├── design.md
│   │       ├── tasks.md
│   │       └── contracts/
│   │           ├── types/
│   │           ├── store/
│   │           ├── lib/
│   │           ├── ui/
│   │           └── api/
│   ├── contracts/           # 系统契约（合并后）
│   │   ├── types/
│   │   ├── store/
│   │   └── ...
│   └── archives/            # 已完成
│       └── YYYY-MM-DD-<change>/
│           ├── intent.md
│           ├── design.md
│           ├── tasks.md
│           └── contracts/
│
└── .worktrees/              # 隔离工作区（gitignored）
    └── <change>/
        ├── [完整项目副本]
        └── .git/ → 指向原仓库
```

---

## 总结

Forge 的价值在于：

1. **可追踪** - 每个变更都有完整的意图、设计、实现记录
2. **可验证** - 三维验证确保质量
3. **可隔离** - worktree 保证并行安全
4. **可归档** - 历史知识不丢失
5. **可集成** - 标准化完成流程

**黄金法则**：

```
forge-start → forge-plan → forge-execute
      ↓
verification-before-completion + forge-verify
      ↓
forge-archive → forge-finish
```

---

*文档版本: 1.0*
*更新日期: 2024*
