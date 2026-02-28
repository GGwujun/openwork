// task-center-generate-plan.ts
// 使用 AI 生成开发计划文档

import type { TaskCenterItem, ParsedRequirement, RepositoryMatch } from '../../types/requirement-analyzer';

/**
 * 构建生成开发计划的提示词
 * 
 * 基于 Forge skills 规范生成标准格式的开发计划文档
 */
export function buildGeneratePlanPrompt(
  item: TaskCenterItem,
  requirement: ParsedRequirement,
  repos: RepositoryMatch[],
  workingDirectory: string
): string {
  const repoList = repos.map(r => `- ${r.name}: ${r.path}`).join('\n');
  
  return `请为 TFS 工作项 #${item.tfsId} 生成开发计划文档，不要创建任何文件。

## 工作项信息
- ID: #${item.tfsId}
- 标题: ${item.title}
- 工作组目录: ${workingDirectory}

## 需求分析
- 摘要: ${requirement.summary}
- 功能点: ${requirement.keyFeatures.join(', ') || '需求实现'}
- 技术栈: ${[
    requirement.techIndicators.frontend && '前端',
    requirement.techIndicators.backend && '后端', 
    requirement.techIndicators.database && '数据库'
  ].filter(Boolean).join('、') || '待确定'}
- 领域: ${requirement.domainKeywords.join(', ')}

## 目标仓库
${repoList || '- 待确定'}

## 输出要求
请输出三段 Markdown 文档，必须包含 intent.md、design.md、tasks.md 的内容。

## 输出格式
---BEGIN_INTENT_MD---
<intent 内容>
---END_INTENT_MD---

---BEGIN_DESIGN_MD---
<design 内容>
---END_DESIGN_MD---

---BEGIN_TASKS_MD---
<tasks 内容>
---END_TASKS_MD---

不要输出其它说明文字。`;
}

/**
 * 解析 AI 返回的开发计划内容
 */
export function parseGeneratedPlan(response: string): {
  intent: string;
  design: string;
  tasks: string;
} {
  // 尝试匹配分隔符格式（老格式兼容）
  const intentMatch = response.match(/---BEGIN_INTENT_MD---\n([\s\S]*?)\n---END_INTENT_MD---/);
  const designMatch = response.match(/---BEGIN_DESIGN_MD---\n([\s\S]*?)\n---END_DESIGN_MD---/);
  const tasksMatch = response.match(/---BEGIN_TASKS_MD---\n([\s\S]*?)\n---END_TASKS_MD---/);

  return {
    intent: intentMatch?.[1]?.trim() || generateFallbackIntent(),
    design: designMatch?.[1]?.trim() || generateFallbackDesign(),
    tasks: tasksMatch?.[1]?.trim() || generateFallbackTasks(),
  };
}


function generateFallbackIntent(): string {
  return `# Intent: 开发计划

## Why
业务价值实现

## Scope
### In Scope
- 需求实现

### Out of Scope
- 其他无关模块

## Target Repositories
- 待确定

## Technical Stack
- 待确定

## Success Criteria
- [ ] 功能实现完成
- [ ] 代码通过审查
`;
}

function generateFallbackDesign(): string {
  return `# Design: 开发计划

## Overview
技术方案设计

## Architecture
### 功能模块
待详细设计

## Technical Details
待补充

## Implementation Steps
待补充

## Testing Strategy
1. 单元测试
2. 集成测试
`;
}

function generateFallbackTasks(): string {
  return `# Tasks: 开发计划

## Phase 1: 环境准备
- [ ] 检出目标仓库
- [ ] 创建特性分支

## Phase 2: 代码实现
- [ ] 实现核心功能

## Phase 3: 测试验证
- [ ] 单元测试

## Phase 4: 代码提交
- [ ] 提交代码
- [ ] 创建 PR
`;
}
