# Design: Task Center 需求智能分析器

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Task Center 需求智能分析器                     │
└─────────────────────────────────────────────────────────────────┘

   用户点击"生成计划"
         │
         ▼
┌─────────────────────┐
│  Step 1: 需求分析   │
│  ├─ 解析 TFS 数据   │
│  ├─ 提取关键词      │
│  ├─ 检测技术栈      │
│  └─ 生成摘要        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Step 2: 仓库识别   │
│  ├─ 加载 JSON 配置  │
│  ├─ 关键词匹配      │
│  ├─ 置信度评分      │
│  └─ 展示结果界面    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Step 3: 计划生成   │
│  ├─ 调用 OpenCode   │
│  ├─ 生成 Forge 文档 │
│  └─ 展示执行面板    │
└─────────────────────┘
```

## File Structure

```
packages/app/src/
├── config/
│   ├── repositories.json              # 仓库索引配置
│   └── repositories.schema.json       # 配置 JSON Schema
├── api/
│   └── requirement-analyzer/
│       ├── index.ts                   # 主类 RequirementAnalyzer
│       ├── parser.ts                  # TFS 需求解析器
│       └── detector.ts                # 仓库识别引擎
├── types/
│   └── requirement-analyzer.ts        # 类型定义
├── app/
│   ├── context/
│   │   └── task-center.ts             # 修改：添加向导状态
│   ├── components/
│   │   └── requirement-wizard/
│   │       ├── index.tsx              # 主容器
│   │       ├── StepAnalysis.tsx       # 步骤1：需求分析展示
│   │       ├── StepRepository.tsx     # 步骤2：仓库选择
│   │       └── StepGeneration.tsx     # 步骤3：计划生成
│   └── pages/
│       └── task-center.tsx            # 修改：集成向导
└── lib/
    └── repository-config-validator.ts # 配置验证工具
```

## Core Components

### 1. JSON 配置 (`config/repositories.json`)

```json
{
  "repositories": [
    {
      "id": "outpatient-web",
      "name": "门诊前端",
      "description": "Winning门诊系统前端React项目",
      "keywords": ["门诊", "挂号", "门诊医生", "clinic", "outpatient"],
      "techStack": ["frontend", "react", "typescript"],
      "weight": 1.0
    },
    {
      "id": "outpatient-api",
      "name": "门诊后端API",
      "description": "Winning门诊系统后端服务",
      "keywords": ["门诊", "挂号", "api", "interface", "outpatient"],
      "techStack": ["backend", "java", "spring"],
      "weight": 1.0
    }
  ],
  "rules": {
    "keywordScore": 2.0,
    "techStackScore": 1.0,
    "primaryThreshold": 3.0,
    "secondaryThreshold": 1.5
  }
}
```

### 2. API 层 (`api/requirement-analyzer/`)

**RequirementAnalyzer 类**

```typescript
class RequirementAnalyzer {
  // Step 1: 解析需求
  async analyze(workItemId: number): Promise<ParsedRequirement>
  
  // Step 2: 识别仓库
  detectRepos(req: ParsedRequirement): DetectionResult
  
  // Step 3: 生成提示词
  buildPrompt(req: ParsedRequirement, repos: RepositoryMatch[]): string
}
```

**算法：关键词匹配评分**

```
score = 0

// 1. 关键词匹配
for keyword in repo.keywords:
  if text.contains(keyword):
    score += rules.keywordScore

// 2. 技术栈匹配
if req.techIndicators.frontend and repo.techStack contains 'frontend':
  score += rules.techStackScore

// 3. 权重调整
score *= repo.weight

// 分类
if score >= rules.primaryThreshold:
  repo.isPrimary = true
else if score >= rules.secondaryThreshold:
  repo.isSecondary = true
```

### 3. Store 扩展

**新增状态**

```typescript
interface PlanWizardState {
  isOpen: boolean
  step: 1 | 2 | 3
  requirement: ParsedRequirement | null
  detection: DetectionResult | null
  selectedRepos: RepositoryMatch[]
  isLoading: boolean
  error: string | null
  generationProgress: number
}
```

**新增方法**

```typescript
wizardActions: {
  open: () => void
  close: () => void
  analyzeRequirement: (workItemId: number) => Promise<void>
  detectRepositories: (req: ParsedRequirement) => void
  toggleRepo: (repo: RepositoryMatch) => void
  generatePlan: (item: TaskCenterItem) => Promise<void>
}
```

### 4. UI 向导组件

**Step 1: 需求分析 (`StepAnalysis.tsx`)**

- 展示 TFS Work Item 基本信息
- 显示 AI 提取的关键词
- 显示检测到的技术栈图标
- "下一步"按钮

**Step 2: 仓库选择 (`StepRepository.tsx`)**

- 主要修改仓库（高置信度，自动勾选）
- 次要影响仓库（低置信度，用户可选）
- 每个仓库显示：名称、描述、匹配原因、置信度徽章
- "手动添加"按钮（支持补足）
- "上一步"/"确认生成"按钮

**Step 3: 计划生成 (`StepGeneration.tsx`)**

- 进度动画（分析需求 → 识别组件 → 生成任务）
- 生成的文档预览（intent/design/tasks）
- "查看" 和 "开始执行" 按钮

## Data Flow

```
用户点击"生成计划"
  │
  ▼
TaskCenterStore.wizardActions.open()
  │
  ▼
自动调用 analyzeRequirement(workItemId)
  ├─ TFSClient.getWorkItem()
  ├─ RequirementAnalyzer.analyze()
  │   ├─ 提取关键词
  │   ├─ 检测技术栈
  │   └─ 生成摘要
  │
  ▼
显示 Step 1 界面
  │
  ▼
用户点击"下一步"
  │
  ▼
自动调用 detectRepositories()
  ├─ 加载 repositories.json
  ├─ 关键词匹配评分
  ├─ 分类 primary/secondary
  └─ 默认选择高置信度仓库
  │
  ▼
显示 Step 2 界面
  │
  ▼
用户确认/调整仓库 → 点击"生成计划"
  │
  ▼
调用 generatePlan()
  ├─ 调用 task-automation skill
  ├─ 生成 Forge artifacts
  └─ 显示 Step 3 完成界面
  │
  ▼
用户点击"开始执行"
  └─ 打开 TaskExecutionPanel（现有功能）
```

## Integration Points

### 与现有 Task Center 集成

```typescript
// task-center.tsx 修改点

// 1. 导入向导
import { RequirementWizard } from '../components/requirement-wizard'

// 2. 修改按钮点击处理
const handleStartAutomation = async (item: TaskCenterItem) => {
  setSelectedItem(item)
  wizardActions.open()           // 打开向导
  await wizardActions.analyzeRequirement(item.tfsId)  // 自动分析
}

// 3. 渲染向导
<Show when={wizard.isOpen}>
  <RequirementWizard ... />
</Show>
```

### 与 task-automation 协作

```
Step 3 生成计划时：

prompt = `
  分析 TFS 工作项 #${id}：
  标题：${title}
  描述：${description}
  
  需要修改的仓库：
  ${selectedRepos.map(r => `- ${r.name}: ${r.description}`).join('\n')}
  
  请生成完整的 Forge 开发计划。
`

调用：task-automation skill with prompt
```

## Error Handling

| 错误场景 | 处理方式 |
|----------|----------|
| 配置 JSON 格式错误 | 使用默认配置，控制台警告 |
| TFS 连接失败 | 显示错误，保留"重试"按钮 |
| 未识别到任何仓库 | Step 2 显示"未匹配到仓库"，提供手动输入 |
| OpenCode 调用失败 | Step 3 显示错误详情，支持重试 |

## Performance Targets

| 环节 | 目标时间 |
|------|----------|
| Step 1 分析需求 | < 500ms |
| Step 2 仓库识别 | < 100ms（本地计算） |
| Step 3 生成计划 | < 3s（OpenCode调用） |
| 总流程 | < 5s |

## Configuration Schema

```typescript
// validators/repository-config.ts

export const RepositoryConfigSchema = z.object({
  repositories: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    keywords: z.array(z.string()),
    techStack: z.array(z.string()),
    weight: z.number().default(1.0)
  })),
  rules: z.object({
    keywordScore: z.number().default(2.0),
    techStackScore: z.number().default(1.0),
    primaryThreshold: z.number().default(3.0),
    secondaryThreshold: z.number().default(1.5)
  })
})
```

## Future Enhancements

1. **Semantic Search** - 使用向量嵌入进行语义匹配
2. **Historical Analysis** - 基于历史 PR 学习仓库关联模式  
3. **Multi-language** - 支持英文需求分析
4. **Config UI** - 提供界面管理仓库索引，无需手动编辑 JSON
