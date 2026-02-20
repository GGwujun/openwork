# AI 需求分析器测试文档

## 测试结构

```
__tests__/
├── ai-analyzer.test.ts       # 核心功能单元测试
├── integration.test.ts       # 完整流程集成测试
├── utils/
│   └── mock-opencode.ts      # OpenCode 模拟服务器
├── README.md                 # 测试文档
```

## 运行测试

```bash
# 运行所有测试
cd packages/app
pnpm test requirement-analyzer

# 仅运行单元测试
pnpm test ai-analyzer.test

# 仅运行集成测试
pnpm test integration.test

# 带覆盖率报告
pnpm test --coverage requirement-analyzer
```

## 测试用例说明

### 1. 单元测试 (ai-analyzer.test.ts)

#### 需求提取测试
- ✓ 应该正确提取工作项标题和描述
- ✓ 应该正确处理标题中的括号内容
- ✓ 功能点应该是动词+名词格式

#### AI 仓库识别测试
- ✓ 应该识别主仓库且置信度 >= 80%
- ✓ 应该过滤掉置信度 < 80% 的仓库

#### HTML 清理测试
- ✓ 应该正确清理 HTML 标签
- ✓ 应该正确解析特殊字符
- ✓ 应该规范化空格

#### JSON 解析测试
- ✓ 应该正确解析 markdown 代码块
- ✓ 应该在解析失败时抛出错误

#### 错误处理测试
- ✓ 应该正确处理 OpenCode API 错误
- ✓ 应该处理工作项不存在的情况

### 2. 集成测试 (integration.test.ts)

#### 完整流程测试
- ✓ 应该完成从工作项获取到 AI 分析的完整流程
- ✓ 应该调用两次 OpenCode API
- ✓ 应该生成符合要求的摘要格式
- ✓ 功能点应该是动词+名词格式
- ✓ 应该正确保留原始 HTML 内容
- ✓ 次要仓库应该被正确过滤
- ✓ 应该包含 AI 生成的详细理由

#### 进度回调测试
- ✓ 应该在不同阶段触发进度回调

## 验证工具

```typescript
import { validateAIRequirementResult, printValidationResult } from '../validate';

const result = await analyzer.analyze(12345);
const validation = validateAIRequirementResult(result);

// 打印报告
printValidationResult(validation, '工作项 #12345');

// 检查是否通过
if (!validation.valid) {
  console.error('验证失败:', validation.errors);
}
```

## 测试结果报告

### 预期成功场景

| 工作项类型 | 摘要示例 | 功能点 | 主要仓库 |
|-----------|---------|-------|---------|
| 参数校验 | 参数校验: 修改spark登录插件配置 | ["修改登录插件", "配置参数校验"] | spark-login-plugin (>=80%) |
| 登录修复 | 缺陷修复: 修复登录闪退问题 | ["修复登录闪退", "优化登录稳定性"] | spark-login-plugin (>=80%) |
| 接口优化 | 接口优化: 优化用户查询接口 | ["优化查询接口", "提升查询性能"] | user-service (>=80%) |

### 验证规则

| 字段 | 要求 | 验证方式 |
|-----|------|---------|
| 摘要 | 5-30字，动作:目标格式 | `validateSummary()` |
| 功能点 | 3-15字，动词+名词，最多5个 | `validateFeatures()` |
| 主要仓库 | 置信度 >= 80% | `validateConfidence()` |
| 次要仓库 | 置信度 >= 60% | `validateConfidence()` |

## 故障排查

### 常见问题

1. **AI 返回空内容**
   - 检查 OpenCode Engine 是否运行
   - 检查 API 地址是否正确
   - 检查 prompt 是否过长

2. **功能点格式不正确**
   - 检查 prompt 中的格式要求是否被 AI 忽略
   - 考虑添加 few-shot examples

3. **仓库置信度过低**
   - 检查仓库配置是否包含足够的关键词
   - 检查需求描述是否清晰

4. **JSON 解析失败**
   - 检查 AI 是否返回了 markdown 代码块
   - 检查 AI 是否返回了额外的解释文字

## 手动测试脚本

```bash
# 1. 创建测试工作项
curl -X POST http://your-tfs/api/workitems \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试需求分析",
    "description": "修改spark的登录插件，针对插件的配置参数做参数校验"
  }'

# 2. 运行分析
node -e "
const analyzer = new RequirementAnalyzer(tfsClient, 'http://localhost:3000');
analyzer.analyze(99999).then(result => {
  console.log('摘要:', result.summary);
  console.log('功能点:', result.keyFeatures);
  console.log('主要仓库:', result.aiRepos.primaryRepos.map(r => r.name));
});
"
```

## 覆盖率目标

- **语句覆盖率**: >= 80%
- **分支覆盖率**: >= 75%
- **函数覆盖率**: >= 90%
