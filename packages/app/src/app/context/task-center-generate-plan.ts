// task-center-generate-plan.ts
// 使用 AI 生成开发计划文档

import type { TaskCenterItem, ParsedRequirement, RepositoryMatch } from '../../types/requirement-analyzer';
import { fsReadFile, fsWriteFile } from '../lib/tauri';

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
  
  return `请为 TFS 工作项 #${item.tfsId} 执行 forge-plan skill，创建开发计划。

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

## 任务
1. 在 forge/tracks/tfs-${item.tfsId}/ 目录下创建开发计划文档
2. 必须包含的文件：intent.md, design.md, tasks.md
3. 完成后报告生成的文件路径列表

## 输出格式
完成后请在响应中列出所有生成的文件路径：

---GENERATED_FILES---
forge/tracks/tfs-${item.tfsId}/intent.md
forge/tracks/tfs-${item.tfsId}/design.md
forge/tracks/tfs-${item.tfsId}/tasks.md
---END_GENERATED_FILES---

如果只生成了部分文件，只列出实际存在的文件。`;
}

/**
 * 解析 AI 返回生成的文件列表
 */
export function parseGeneratedFiles(response: string): string[] {
  const filesMatch = response.match(/---GENERATED_FILES---\n([\s\S]*?)\n---END_GENERATED_FILES---/);
  
  if (filesMatch?.[1]) {
    return filesMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('.md'));
  }
  
  return [];
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

/**
 * 读取生成的文件内容
 * 使用 Tauri fs_read_file 命令读取工作区文件
 */
export async function readGeneratedFiles(
  filePaths: string[],
  workspaceRoot: string
): Promise<{ intent: string; design: string; tasks: string }> {
  const result = {
    intent: '',
    design: '',
    tasks: ''
  };
  
  console.log(`[TaskCenter] [DEBUG] readGeneratedFiles called with ${filePaths.length} files in ${workspaceRoot}`);
  
  for (const filePath of filePaths) {
    try {
      console.log(`[TaskCenter] [DEBUG] Reading file: ${filePath}`);
      
      // 使用 Tauri fsReadFile 命令读取（方式1）
      const fileResult = await fsReadFile(filePath, workspaceRoot);
      
      console.log(`[TaskCenter] [DEBUG] Successfully read ${filePath}, length: ${fileResult.content.length}`);
      
      if (filePath.endsWith('intent.md')) {
        result.intent = fileResult.content;
        console.log('[TaskCenter] [DEBUG] intent.md content length:', fileResult.content.length);
      } else if (filePath.endsWith('design.md')) {
        result.design = fileResult.content;
        console.log('[TaskCenter] [DEBUG] design.md content length:', fileResult.content.length);
      } else if (filePath.endsWith('tasks.md')) {
        result.tasks = fileResult.content;
        console.log('[TaskCenter] [DEBUG] tasks.md content length:', fileResult.content.length);
      }
    } catch (error) {
      console.warn(`[TaskCenter] [DEBUG] Error reading ${filePath}:`, error);
    }
  }
  
  console.log(`[TaskCenter] [DEBUG] readGeneratedFiles result: intent=${result.intent ? 'YES' : 'NO'}, design=${result.design ? 'YES' : 'NO'}, tasks=${result.tasks ? 'YES' : 'NO'}`);
  return result;
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

// ============================================================
// 单步自动开发计划流程 - 文件持久化
// ============================================================

/** 计划执行状态 */
export interface PlanStatus {
  version: number;
  tfsId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStep: 'idle' | 'analysis' | 'repos' | 'plan' | 'completed';
  completedSteps: ('analysis' | 'repos' | 'plan')[];
  steps: {
    analysis?: { status: 'pending' | 'running' | 'completed' | 'failed'; output?: string; error?: string };
    repos?: { status: 'pending' | 'running' | 'completed' | 'failed'; output?: string; error?: string };
    plan?: { status: 'pending' | 'running' | 'completed' | 'failed'; output?: string[]; error?: string };
  };
}

/** 工作项分析结果文件 */
export interface AnalysisResult {
  version: number;
  tfsId: number;
  timestamp: string;
  requirement: ParsedRequirement;
}

/** 仓库识别结果文件 */
export interface ReposResult {
  version: number;
  tfsId: number;
  timestamp: string;
  detection: DetectionResult;
  selectedRepos: RepositoryMatch[];
}

/** 获取计划状态文件路径 */
function getPlanStatusPath(tfsId: number): string {
  return `forge/tracks/tfs-${tfsId}/.plan/status.json`;
}

/** 获取分析结果文件路径 */
function getAnalysisPath(tfsId: number): string {
  return `forge/tracks/tfs-${tfsId}/.plan/01-analysis.json`;
}

/** 获取仓库识别结果文件路径 */
function getReposPath(tfsId: number): string {
  return `forge/tracks/tfs-${tfsId}/.plan/02-repos.json`;
}

/** 读取计划状态 */
export async function readPlanStatus(tfsId: number, workspaceRoot: string): Promise<PlanStatus | null> {
  try {
    const result = await fsReadFile(getPlanStatusPath(tfsId), workspaceRoot);
    return JSON.parse(result.content) as PlanStatus;
  } catch (error) {
    console.log(`[TaskCenter] [DEBUG] readPlanStatus: status file not found or invalid for TFS #${tfsId}`, error);
    return null;
  }
}

/** 写入计划状态 */
export async function writePlanStatus(status: PlanStatus, workspaceRoot: string): Promise<void> {
  const path = getPlanStatusPath(status.tfsId);
  const content = JSON.stringify(status, null, 2);
  await fsWriteFile(path, content, workspaceRoot);
}

/** 读取分析结果 */
export async function readAnalysisResult(tfsId: number, workspaceRoot: string): Promise<AnalysisResult | null> {
  try {
    const result = await fsReadFile(getAnalysisPath(tfsId), workspaceRoot);
    return JSON.parse(result.content) as AnalysisResult;
  } catch {
    return null;
  }
}

/** 写入分析结果 */
export async function writeAnalysisResult(tfsId: number, title: string, requirement: ParsedRequirement, workspaceRoot: string): Promise<void> {
  const data: AnalysisResult = {
    version: 1,
    tfsId,
    timestamp: new Date().toISOString(),
    requirement,
  };
  const content = JSON.stringify(data, null, 2);
  await fsWriteFile(getAnalysisPath(tfsId), content, workspaceRoot);
}

/** 读取仓库识别结果 */
export async function readReposResult(tfsId: number, workspaceRoot: string): Promise<ReposResult | null> {
  try {
    const result = await fsReadFile(getReposPath(tfsId), workspaceRoot);
    return JSON.parse(result.content) as ReposResult;
  } catch {
    return null;
  }
}

/** 写入仓库识别结果 */
export async function writeReposResult(
  tfsId: number, 
  detection: DetectionResult, 
  selectedRepos: RepositoryMatch[], 
  workspaceRoot: string
): Promise<void> {
  const data: ReposResult = {
    version: 1,
    tfsId,
    timestamp: new Date().toISOString(),
    detection,
    selectedRepos,
  };
  const content = JSON.stringify(data, null, 2);
  await fsWriteFile(getReposPath(tfsId), content, workspaceRoot);
}

/**
 * 初始化新的计划状态
 */
export function initPlanStatus(tfsId: number, title: string): PlanStatus {
  const now = new Date().toISOString();
  return {
    version: 1,
    tfsId,
    title,
    createdAt: now,
    updatedAt: now,
    currentStep: 'idle',
    completedSteps: [],
    steps: {
      analysis: { status: 'pending' },
      repos: { status: 'pending' },
      plan: { status: 'pending' },
    },
  };
}
