# Tasks: Task Center 需求智能分析器

## Phase 1: 基础框架（类型 + API + JSON 配置）

### Task 1.1: 创建类型定义文件
- [ ] 创建 `packages/app/src/types/requirement-analyzer.ts`
  - [ ] 定义 `ParsedRequirement` 接口
  - [ ] 定义 `RepositoryMatch` 接口
  - [ ] 定义 `DetectionResult` 接口
  - [ ] 定义 `PlanWizardState` 接口
  - [ ] 定义 `RepositoryConfig` JSON 配置类型

**验证标准：** TypeScript 编译无错误

---

### Task 1.2: 创建仓库 JSON 配置文件
- [ ] 创建 `packages/app/src/config/repositories.json`
  - [ ] 添加门诊系统仓库配置（前端 + 后端）
  - [ ] 添加住院系统仓库配置（前端 + 后端）
  - [ ] 添加收费计费仓库配置
  - [ ] 定义评分规则（keywordScore, techStackScore, thresholds）
- [ ] 创建 JSON Schema 验证文件（可选）

**验证标准：** JSON 格式合法，可被 TypeScript import

---

### Task 1.3: 实现 RequirementAnalyzer 核心类
- [ ] 创建 `packages/app/src/api/requirement-analyzer/index.ts`
  - [ ] 实现 `constructor(tfsClient)`
  - [ ] 实现 `analyze(workItemId)` - 解析 TFS 工作项
    - [ ] 调用 TFS API
    - [ ] 提取标题和描述
    - [ ] 检测技术栈（前端/后端/数据库）
    - [ ] 提取关键词和领域
    - [ ] 生成摘要
  - [ ] 实现 `detectRepos(requirement)` - 识别仓库
    - [ ] 加载 repositories.json
    - [ ] 关键词匹配评分算法
    - [ ] 技术栈匹配加分
    - [ ] 应用权重计算
    - [ ] 分类主要/次要仓库

**验证标准：** 编写单元测试，验证评分算法正确性

---

## Phase 2: Store 扩展（状态管理）

### Task 2.1: 扩展 TaskCenterStore
- [ ] 修改 `packages/app/src/app/context/task-center.ts`
  - [ ] 添加 `wizard` 状态（createStore）
    - [ ] isOpen: boolean
    - [ ] step: 1 | 2 | 3
    - [ ] requirement: ParsedRequirement | null
    - [ ] detection: DetectionResult | null
    - [ ] selectedRepos: RepositoryMatch[]
    - [ ] isLoading: boolean
    - [ ] error: string | null
    - [ ] generationProgress: number
  - [ ] 添加 `wizardActions` 方法
    - [ ] open() / close()
    - [ ] analyzeRequirement(workItemId) - Step 1
    - [ ] detectRepositories(requirement) - Step 2
    - [ ] toggleRepo(repo) - 切换仓库选择
    - [ ] generatePlan(item) - Step 3

**验证标准：** Store 方法可被调用，状态更新正确

---

### Task 2.2: 实现错误处理
- [ ] 处理 TFS API 失败
  - [ ] 显示错误提示
  - [ ] 提供"重试"按钮
- [ ] 处理 JSON 配置加载失败
  - [ ] 使用默认配置降级
  - [ ] 控制台警告
- [ ] 处理未匹配到仓库的情况
  - [ ] 显示"未匹配到仓库"提示
  - [ ] 提供手动输入入口

**验证标准：** 各种错误场景都有友好提示和用户恢复路径

---

## Phase 3: UI 向导组件

### Task 3.1: 创建向导容器组件
- [ ] 创建 `packages/app/src/app/components/requirement-wizard/index.tsx`
  - [ ] RequirementWizard 主容器组件
  - [ ] 步骤指示器（Step Indicator 1/3, 2/3, 3/3）
  - [ ] 子组件切换逻辑（step 1/2/3）
  - [ ] Modal 弹窗样式
  - [ ] 关闭/取消逻辑

**验证标准：** 向导能正常打开/关闭，步骤可切换

---

### Task 3.2: 实现 Step 1 - 需求分析展示
- [ ] 创建 `StepAnalysis.tsx`
  - [ ] 显示工作项基本信息（ID、标题）
  - [ ] AI 摘要卡片（Sparkles 图标高亮）
  - [ ] 识别到的功能点标签列表
  - [ ] 技术栈指示器（前端/后端/数据库图标）
  - [ ] 加载状态（分析中动画）
  - [ ] 错误状态显示
  - [ ] "下一步"按钮（分析完成后启用）

**验证标准：** UI 展示与需求匹配，交互流畅

---

### Task 3.3: 实现 Step 2 - 仓库选择
- [ ] 创建 `StepRepository.tsx`
  - [ ] 主要修改仓库区域
    - [ ] RepositoryCard 组件（选中态/未选中态）
    - [ ] 显示仓库名称、描述
    - [ ] 匹配原因标签
    - [ ] 置信度徽章（高/中/低）
    - [ ] 复选框切换
  - [ ] 次要影响仓库区域（折叠/展开）
  - [ ] 已选择数量显示
  - [ ] "手动添加"按钮（输入仓库ID）
  - [ ] "上一步"/"确认生成"按钮
  - [ ] 未选择仓库时禁用"确认"按钮

**验证标准：** 可选中/取消仓库，确认按钮逻辑正确

---

### Task 3.4: 实现 Step 3 - 计划生成
- [ ] 创建 `StepGeneration.tsx`
  - [ ] 生成过程动画
    - [ ] Loading 旋转图标
    - [ ] 进度条（0% → 100%）
    - [ ] 步骤文字（分析需求 → 识别组件 → 生成任务）
  - [ ] 完成状态
    - [ ] 成功图标（CheckCircle）
    - [ ] 生成文档预览卡片
      - [ ] intent.md 摘要
      - [ ] design.md 摘要  
      - [ ] tasks.md 任务数
    - [ ] "查看计划"按钮
    - [ ] "开始执行"按钮
  - [ ] 错误状态
    - [ ] 错误图标和描述
    - [ ] "重试"按钮

**验证标准：** 进度动画流畅，完成/错误状态切换正确

---

## Phase 4: 集成与测试

### Task 4.1: 集成到 Task Center 页面
- [ ] 修改 `packages/app/src/app/pages/task-center.tsx`
  - [ ] 导入 RequirementWizard 组件
  - [ ] 修改 handleStartAutomation 函数
    - [ ] 打开向导（替代原有直接调用）
    - [ ] 自动开始分析
  - [ ] 在渲染部分插入 Wizard 组件
  - [ ] 保留原有 TaskExecutionPanel（Plan 生成后使用）

**验证标准：** 点击"生成计划"打开向导，原有功能不被破坏

---

### Task 4.2: 类型检查与编译
- [ ] 运行 `pnpm typecheck`
  - [ ] 修复所有类型错误
- [ ] 运行 `pnpm build`
  - [ ] 确保生产构建成功

**验证标准：** 无类型错误，构建通过

---

### Task 4.3: 端到端测试
- [ ] 测试场景 1：正常流程
  - [ ] TFS 工作项包含"门诊"关键词
  - [ ] 验证识别到门诊仓库
  - [ ] 验证生成计划成功
- [ ] 测试场景 2：未匹配到仓库
  - [ ] TFS 工作项包含未知领域关键词
  - [ ] 验证显示"未匹配"状态
  - [ ] 验证可手动添加仓库
- [ ] 测试场景 3：网络错误
  - [ ] 断开网络后点击生成
  - [ ] 验证错误提示和重试功能

**验证标准：** 所有场景测试通过

---

## Phase 5: 文档与优化（可选）

### Task 5.1: 添加代码注释
- [ ] 为核心算法添加注释（评分逻辑、正则匹配等）
- [ ] 为类型定义添加 JSDoc
- [ ] 在复杂组件添加使用说明

---

### Task 5.2: 性能优化
- [ ] 优化仓库识别算法（使用 Map 替代 Array 查找）
- [ ] 添加分析结果缓存（避免重复分析同一工作项）
- [ ] 按需加载向导组件（Code Splitting）

---

## Verification Checklist

完成所有任务后验证：

- [ ] `repositories.json` 配置正确，可被 import
- [ ] RequirementAnalyzer 类所有方法可正常工作
- [ ] TaskCenterStore 新增 wizard 状态和方法
- [ ] 向导组件 3 步骤流程完整
- [ ] 与 Task Center 页面集成成功
- [ ] TypeScript 编译无错误
- [ ] 生产构建成功
- [ ] 端到端测试通过

---

## Time Estimate

- Phase 1: 基础框架 - 4h
- Phase 2: Store 扩展 - 4h
- Phase 3: UI 向导 - 6h
- Phase 4: 集成测试 - 2h
- Phase 5: 文档优化 - 2h（可选）

**Total: ~16-18 hours**
