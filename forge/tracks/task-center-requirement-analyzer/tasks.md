# Tasks: Task Center 需求智能分析器

## Phase 1: 基础框架（类型 + API + JSON 配置）

### Task 1.1: 创建类型定义文件
- [x] 创建 `packages/app/src/types/requirement-analyzer.ts`
  - [x] 定义 `ParsedRequirement` 接口
  - [x] 定义 `RepositoryMatch` 接口
  - [x] 定义 `DetectionResult` 接口
  - [x] 定义 `PlanWizardState` 接口
  - [x] 定义 `RepositoryConfig` JSON 配置类型

**验证标准：** TypeScript 编译无错误 ✅

---

### Task 1.2: 创建仓库 JSON 配置文件
- [x] 创建 `packages/app/src/config/repositories.json`
  - [x] 添加门诊系统仓库配置（前端 + 后端）
  - [x] 添加住院系统仓库配置（前端 + 后端）
  - [x] 添加收费计费仓库配置
  - [x] 定义评分规则（keywordScore, techStackScore, thresholds）
- [x] 创建 JSON Schema 验证文件（可选）

**验证标准：** JSON 格式合法，可被 TypeScript import ✅

---

### Task 1.3: 实现 RequirementAnalyzer 核心类
- [x] 创建 `packages/app/src/api/requirement-analyzer/index.ts`
  - [x] 实现 `constructor(tfsClient)`
  - [x] 实现 `analyze(workItemId)` - 解析 TFS 工作项
    - [x] 调用 TFS API
    - [x] 提取标题和描述
    - [x] 检测技术栈（前端/后端/数据库）
    - [x] 提取关键词和领域
    - [x] 生成摘要
  - [x] 实现 `detectRepos(requirement)` - 识别仓库
    - [x] 加载 repositories.json
    - [x] 关键词匹配评分算法
    - [x] 技术栈匹配加分
    - [x] 应用权重计算
    - [x] 分类主要/次要仓库

**验证标准：** 编写单元测试，验证评分算法正确性 ✅

---

## Phase 2: Store 扩展（状态管理）

### Task 2.1: 扩展 TaskCenterStore
- [x] 修改 `packages/app/src/app/context/task-center.ts`
  - [x] 添加 `wizard` 状态（createStore）
    - [x] isOpen: boolean
    - [x] step: 1 | 2 | 3
    - [x] requirement: ParsedRequirement | null
    - [x] detection: DetectionResult | null
    - [x] selectedRepos: RepositoryMatch[]
    - [x] isLoading: boolean
    - [x] error: string | null
    - [x] generationProgress: number
  - [x] 添加 `wizardActions` 方法
    - [x] open() / close()
    - [x] analyzeRequirement(workItemId) - Step 1
    - [x] detectRepositories(requirement) - Step 2
    - [x] toggleRepo(repo) - 切换仓库选择
    - [x] generatePlan(item) - Step 3

**验证标准：** Store 方法可被调用，状态更新正确 ✅

---

### Task 2.2: 实现错误处理
- [x] 处理 TFS API 失败
  - [x] 显示错误提示
  - [x] 提供"重试"按钮
- [x] 处理 JSON 配置加载失败
  - [x] 使用默认配置降级
  - [x] 控制台警告
- [x] 处理未匹配到仓库的情况
  - [x] 显示"未匹配到仓库"提示
  - [x] 提供手动输入入口

**验证标准：** 各种错误场景都有友好提示和用户恢复路径 ✅

---

## Phase 3: UI 向导组件

### Task 3.1: 创建向导容器组件
- [x] 创建 `packages/app/src/app/components/requirement-wizard/index.tsx`
  - [x] RequirementWizard 主容器组件
  - [x] 步骤指示器（Step Indicator 1/3, 2/3, 3/3）
  - [x] 子组件切换逻辑（step 1/2/3）
  - [x] Modal 弹窗样式
  - [x] 关闭/取消逻辑

**验证标准：** 向导能正常打开/关闭，步骤可切换 ✅

---

### Task 3.2: 实现 Step 1 - 需求分析展示
- [x] 创建 `StepAnalysis.tsx`
  - [x] 显示工作项基本信息（ID、标题）
  - [x] AI 摘要卡片（Sparkles 图标高亮）
  - [x] 识别到的功能点标签列表
  - [x] 技术栈指示器（前端/后端/数据库图标）
  - [x] 加载状态（分析中动画）
  - [x] 错误状态显示
  - [x] "下一步"按钮（分析完成后启用）

**验证标准：** UI 展示与需求匹配，交互流畅 ✅

---

### Task 3.3: 实现 Step 2 - 仓库选择
- [x] 创建 `StepRepository.tsx`
  - [x] 主要修改仓库区域
    - [x] RepositoryCard 组件（选中态/未选中态）
    - [x] 显示仓库名称、描述
    - [x] 匹配原因标签
    - [x] 置信度徽章（高/中/低）
    - [x] 复选框切换
  - [x] 次要影响仓库区域（折叠/展开）
  - [x] 已选择数量显示
  - [x] "手动添加"按钮（输入仓库ID）
  - [x] "上一步"/"确认生成"按钮
  - [x] 未选择仓库时禁用"确认"按钮

**验证标准：** 可选中/取消仓库，确认按钮逻辑正确 ✅

---

### Task 3.4: 实现 Step 3 - 计划生成
- [x] 创建 `StepGeneration.tsx`
  - [x] 生成过程动画
    - [x] Loading 旋转图标
    - [x] 进度条（0% → 100%）
    - [x] 步骤文字（分析需求 → 识别组件 → 生成任务）
  - [x] 完成状态
    - [x] 成功图标（CheckCircle）
    - [x] 生成文档预览卡片
      - [x] intent.md 摘要
      - [x] design.md 摘要  
      - [x] tasks.md 任务数
    - [x] "查看计划"按钮
    - [x] "开始执行"按钮
  - [x] 错误状态
    - [x] 错误图标和描述
    - [x] "重试"按钮

**验证标准：** 进度动画流畅，完成/错误状态切换正确 ✅

---

## Phase 4: 集成与测试

### Task 4.1: 集成到 Task Center 页面
- [x] 修改 `packages/app/src/app/pages/task-center.tsx`
  - [x] 导入 RequirementWizard 组件
  - [x] 修改 handleStartAutomation 函数
    - [x] 打开向导（替代原有直接调用）
    - [x] 自动开始分析
  - [x] 在渲染部分插入 Wizard 组件
  - [x] 保留原有 TaskExecutionPanel（Plan 生成后使用）

**验证标准：** 点击"生成计划"打开向导，原有功能不被破坏 ✅

---

### Task 4.2: 类型检查与编译
- [x] 运行 `pnpm typecheck`
  - [x] 修复所有类型错误
- [x] 运行 `pnpm build`
  - [x] 确保生产构建成功

**验证标准：** 无类型错误，构建通过 ✅

---

### Task 4.3: 端到端测试
- [x] 测试场景 1：正常流程
  - [x] TFS 工作项包含"门诊"关键词
  - [x] 验证识别到门诊仓库
  - [x] 验证生成计划成功
- [x] 测试场景 2：未匹配到仓库
  - [x] TFS 工作项包含未知领域关键词
  - [x] 验证显示"未匹配"状态
  - [x] 验证可手动添加仓库
- [x] 测试场景 3：网络错误
  - [x] 断开网络后点击生成
  - [x] 验证错误提示和重试功能

**验证标准：** 所有场景测试通过 ✅

---

## Phase 5: 文档与优化（可选）

### Task 5.1: 添加代码注释
- [x] 为核心算法添加注释（评分逻辑、正则匹配等）
- [x] 为类型定义添加 JSDoc
- [x] 在复杂组件添加使用说明

---

### Task 5.2: 性能优化
- [x] 优化仓库识别算法（使用 Map 替代 Array 查找）
- [x] 添加分析结果缓存（避免重复分析同一工作项）
- [x] 按需加载向导组件（Code Splitting）

---

## Verification Checklist

完成所有任务后验证：

- [x] `repositories.json` 配置正确，可被 import
- [x] RequirementAnalyzer 类所有方法可正常工作
- [x] TaskCenterStore 新增 wizard 状态和方法
- [x] 向导组件 3 步骤流程完整
- [x] 与 Task Center 页面集成成功
- [x] TypeScript 编译无错误
- [x] 生产构建成功
- [x] 端到端测试通过

---

## Time Estimate

- Phase 1: 基础框架 - 4h ✅
- Phase 2: Store 扩展 - 4h ✅
- Phase 3: UI 向导 - 6h ✅
- Phase 4: 集成测试 - 2h ✅
- Phase 5: 文档优化 - 2h（可选）✅

**Total: ~16-18 hours** ✅

**状态：全部 12 个任务已完成，TypeScript 编译通过，可直接使用！**
