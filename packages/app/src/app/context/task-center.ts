import { createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";

import type { Client, TaskCenterItem, TaskCenterStatus, TaskCenterStage, TaskCenterAutomationState } from "../types";
import type { TFSConfig, FormattedWorkItem } from "../../api/tfs";
import { TFSClient, DEFAULT_SERVER_URL } from "../../api/tfs";
import { Persist, persisted } from "../utils/persist";
import { unwrap } from "../lib/opencode";
import { parseTasks, updateTaskStatus, type ParsedTask } from "../lib/tasks-parser";

// Note: fs plugin disabled - rely on AI to write files
// import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs';

import { 
  TFS_CONFIG_PATH, 
  DEFAULT_TFS_CONFIG, 
  validateTfsConfig, 
  createTfsConfig 
} from "../config/tfs";

import { RequirementAnalyzer, createRequirementAnalyzer } from '../../api/requirement-analyzer';
import type {
  ParsedRequirement,
  RepositoryMatch,
  DetectionResult,
  PlanWizardState,
  TaskAutoAnalysisState,
  AnalysisQueueStatus,
  AnalysisResult,
  AnalysisPriority,
} from '../../types/requirement-analyzer';
import { getAutoAnalysisConfig, subscribeAutoAnalysisConfig } from '../../types/config';

// AI Generate Plan
import { 
  buildGeneratePlanPrompt, 
  parseGeneratedFiles, 
  readGeneratedFiles,
  readPlanStatus,
  writePlanStatus,
  readAnalysisResult,
  writeAnalysisResult,
  readReposResult,
  writeReposResult,
  initPlanStatus,
  type PlanStatus,
} from './task-center-generate-plan';
import { fsReadFile } from '../lib/tauri';
import { AnalysisCache, type CacheEntry, type AnalysisCacheData } from '../lib/analysis-cache';
import { AnalysisQueue } from '../lib/analysis-queue';
import { AutoAnalyzer } from '../lib/auto-analyzer';

// TFS 子任务同步
import {
  createAnalysisTask,
  createPlanTask,
  checkSyncStatus,
  type TfsSyncStatus,
  type SyncOptions,
} from '../lib/sync-task-to-tfs';

// 删除未使用的导入
// import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs';

// Embedded Automation Engine - 内嵌式自动化引擎
import {
  AutomationEngine,
  PhaseAnalyzer,
  PhaseDesigner,
  PhasePlanner,
  TFSClient as AutomationTFSClient,
  AIService,
  TFSConfigManager,
} from '../../automation';
import type {
  AutomationState,
  PhaseType,
} from '../../automation';

// Use Record instead of Map for JSON serialization compatibility
export type AutomationStateMap = Record<number, TaskCenterAutomationState>;

// Helper to safely get value from Record
export function getAutomationState(record: AutomationStateMap, tfsId: number): TaskCenterAutomationState | undefined {
  return record[tfsId];
}

// Merge TFS items with automation state
// Note: TFS state is the source of truth for item.status
// Automation state only provides stage/subStage for UI display
export function mergeTfsItemsWithAutomation(
  tfsItems: TaskCenterItem[],
  automation: AutomationStateMap,
  tfsSyncMap?: Record<number, { analysisSynced?: boolean; planSynced?: boolean }>
): TaskCenterItem[] {
  const result: TaskCenterItem[] = [];
  const processedTfsIds = new Set<number>();

  // First, process all TFS items and optionally merge with automation
  for (const item of tfsItems) {
    const autoState = getAutomationState(automation, item.tfsId);
    const tfsSync = tfsSyncMap?.[item.tfsId];
    const isTfsSynced = tfsSync?.analysisSynced || tfsSync?.planSynced;
    
    if (autoState) {
      // TFS state has priority - never override TFS status
      // Only use automation stage/subStage for display if TFS is synced (analysis done)
      const mergedStage = isTfsSynced ? (autoState.stage ?? item.stage) : item.stage;
      const mergedSubStage = isTfsSynced ? autoState.subStage : undefined;

      result.push({
        ...item,
        // Keep TFS status as-is (todo for "已分析" items)
        stage: mergedStage,
        subStage: mergedSubStage,
      });
    } else {
      // No automation state, use TFS item as-is
      result.push(item);
    }
    processedTfsIds.add(item.tfsId);
  }

  // Then, add automation items that are not in TFS query result
  // Only if they have TFS sync (meaning they were synced before)
  for (const [key, autoState] of Object.entries(automation)) {
    const tfsId = Number(key);
    if (!Number.isNaN(tfsId) && !processedTfsIds.has(tfsId) && autoState) {
      const tfsSync = tfsSyncMap?.[tfsId];
      const isTfsSynced = tfsSync?.analysisSynced || tfsSync?.planSynced;
      
      // Only add orphan automation items if they have TFS sync
      if (isTfsSynced) {
        // Create a TaskCenterItem from automation state
        result.push({
          id: `tfs-${tfsId}`,
          tfsId,
          title: `Work Item #${tfsId}`, // Placeholder, should be loaded from storage
          status: "todo", // Always todo since not in TFS query (should be "已分析")
          stage: autoState.stage,
          updatedAt: autoState.updatedAt,
        });
      }
    }
  }

  return result;
}

export function mergeAutomationState(
  tfsItems: Array<{ tfsId: number; status: TaskCenterStatus }>,
  automation: AutomationStateMap
): AutomationStateMap {
  const result: AutomationStateMap = {};

  for (const item of tfsItems) {
    const existing = getAutomationState(automation, item.tfsId);

    if (existing) {
      // Check if TFS is in a final state (done/archived) - use TFS state
      const isTfsFinal = item.status === "done" || item.status === "archived";

      result[item.tfsId] = {
        ...existing,
        status: isTfsFinal ? item.status : existing.status,
        updatedAt: Date.now()
      };
    } else {
      // No automation state: create from TFS item
      result[item.tfsId] = {
        status: item.status,
        stage: "idle" as TaskCenterStage,
        updatedAt: Date.now()
      };
    }
  }

  return result;
}

export type TaskCenterStore = ReturnType<typeof createTaskCenterStore>;

type SyncStatus = "idle" | "syncing" | "error";

type TaskCenterUiState = {
  search: string;
};

function mapStateToStatus(state?: string | null): TaskCenterStatus {
  const normalized = (state ?? "").trim();
  if (normalized === "活动") return "progress";
  if (normalized === "已解决") return "done";
  if (normalized === "已关闭") return "archived";
  // Only "已分析" should map to "todo"
  if (normalized === "已分析") return "todo";
  // Other states like "已建议" should not appear in Task Center
  // (they will be filtered out by TFS query)
  return "todo";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readErrorMessage = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.message === "string") return value.message;
  return null;
};

const formatSyncError = (error: unknown): string => {
  const message = readErrorMessage(error) ?? "Task sync failed.";
  if (/CORS|被 CORS/i.test(message)) {
    return "网络访问被 CORS 拦截，请使用桌面版或配置反向代理。";
  }
  if (/Failed to fetch|NetworkError|网络/i.test(message)) {
    return "网络连接失败，请检查网络或 TFS 服务可用性。";
  }
  if (/429|rate limit|too many/i.test(message)) {
    return "TFS 请求过于频繁，请稍后重试。";
  }
  return message;
};

const formatAutoAnalysisError = (error: unknown): string => {
  const message = readErrorMessage(error) ?? "分析失败";
  if (/not found|不存在|deleted/i.test(message)) {
    return "工作项不存在或已删除";
  }
  if (/AI 分析结果格式错误|仓库识别结果格式错误|JSON/i.test(message)) {
    return `AI 返回格式错误: ${message}`;
  }
  if (/OpenCode 客户端未连接/i.test(message)) {
    return "OpenCode 未连接，无法进行 AI 分析。";
  }
  return message;
};

const extractOutputFromParts = (parts: unknown): string | null => {
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (!isRecord(part)) continue;
    if (part.type === "tool") {
      const state = isRecord(part.state) ? part.state : null;
      if (state) {
        if (state.status === "error") {
          const message = readErrorMessage(state.error);
          if (message) throw new Error(message);
        }
        if (typeof state.output === "string") return state.output;
        const metadata = isRecord(state.metadata) ? state.metadata : null;
        if (metadata && typeof metadata.output === "string") return metadata.output;
      }
    }
    if (part.type === "text" && typeof part.text === "string") return part.text;
  }
  return null;
};

function extractOutput(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  if (!isRecord(result)) return null;
  const errorMessage = readErrorMessage(result.error);
  if (errorMessage) throw new Error(errorMessage || "Unknown error");

  const partsOutput = extractOutputFromParts(result.parts);
  if (partsOutput) return partsOutput;

  if (typeof result.output === "string") return result.output;
  if (typeof result.stdout === "string") return result.stdout;
  if (typeof result.data === "string") return result.data;

  if (isRecord(result.data)) {
    const dataError = readErrorMessage(result.data.error);
    if (dataError) throw new Error(dataError || "Unknown error");
    const dataParts = extractOutputFromParts(result.data.parts);
    if (dataParts) return dataParts;
    if (typeof result.data.output === "string") return result.data.output;
    if (typeof result.data.stdout === "string") return result.data.stdout;
  }
  return null;
}

// ========== Forge Track File Generation Helpers ==========

/**
 * 生成 intent.md 内容
 */
function generateIntentMd(
  item: TaskCenterItem,
  requirement: ParsedRequirement,
  repos: RepositoryMatch[]
): string {
  const repoList = repos.map(r => `- ${r.name} (${r.id})`).join('\n');
  const techStack = [
    requirement.techIndicators.frontend && '前端',
    requirement.techIndicators.backend && '后端',
    requirement.techIndicators.database && '数据库'
  ].filter(Boolean).join('、') || '待确定';

  return `# Intent: ${item.title}

## Why

${requirement.summary}

## Scope

### In Scope
${requirement.keyFeatures.map(f => `- ${f}`).join('\n') || '- 需求实现'}

### Out of Scope
- 其他模块的修改（除非必要）

## Target Repositories
${repoList || '- 待确定'}

## Technical Stack
- ${techStack}

## Success Criteria
- [ ] 功能实现完成
- [ ] 代码通过审查
- [ ] TFS 工作项状态更新

## TFS Work Item
- ID: #${item.tfsId}
- Type: ${item.workItemType || 'Task'}
- Project: ${item.project || 'N/A'}
`;
}

/**
 * 生成 design.md 内容（简化版）
 */
function generateDesignMd(
  item: TaskCenterItem,
  requirement: ParsedRequirement,
  repos: RepositoryMatch[]
): string {
  const features = requirement.keyFeatures.length > 0 
    ? requirement.keyFeatures.map(f => `1. **${f}**\n   - 实现步骤待补充`).join('\n')
    : '1. **需求实现**\n   - 具体步骤待补充';

  const components = repos.map(r => `
### ${r.name}
- **路径**: ${r.path}
- **匹配原因**: ${r.reason}
- **主要修改**: 待确定
`).join('');

  return `# Design: ${item.title}

## Overview

${requirement.summary}

## Architecture

### 功能模块
${features}

### 代码仓库
${components || '- 待确定修改范围'}

## Technical Details

### 技术栈
${requirement.techIndicators.frontend ? '- 前端: React + TypeScript\n' : ''}${requirement.techIndicators.backend ? '- 后端: Java/Spring\n' : ''}${requirement.techIndicators.database ? '- 数据库: SQL\n' : ''}

### 数据流
1. 用户操作触发请求
2. 后端处理业务逻辑
3. 数据持久化
4. 返回响应给前端

## Error Handling

| Error Scenario | Handling |
|---------------|----------|
| Validation Error | 返回 400 错误码 |
| Not Found | 返回 404 错误码 |
| Server Error | 返回 500 错误码，记录日志 |

## Testing Strategy

1. **单元测试** - 核心业务逻辑
2. **集成测试** - API 接口测试
3. **手动测试** - 端到端流程
`;
}

/**
 * 生成 tasks.md 内容
 */
function generateTasksMd(
  item: TaskCenterItem,
  requirement: ParsedRequirement,
  repos: RepositoryMatch[]
): string {
  const hasRepos = repos.length > 0;
  const primaryRepo = repos.find(r => r.isPrimary);

  return `# Tasks: ${item.title}

## Phase 1: 环境准备
- [ ] 检出目标仓库
  - ${primaryRepo ? `主要仓库: ${primaryRepo.name}` : '确定主要仓库'}
- [ ] 创建特性分支
  - 分支名: feature/tfs-${item.tfsId}
- [ ] 验证开发环境

## Phase 2: 需求分析
- [x] 分析 TFS 工作项 #${item.tfsId}
- [x] 识别目标代码仓库
${repos.map(r => `  - [x] ${r.name}`).join('\n')}
- [x] 确定技术栈
${requirement.techIndicators.frontend ? '  - [x] 前端\n' : ''}${requirement.techIndicators.backend ? '  - [x] 后端\n' : ''}${requirement.techIndicators.database ? '  - [x] 数据库\n' : ''}

## Phase 3: 代码实现
${hasRepos ? repos.map((r, i) => `- [ ] ${r.name} 修改
  - [ ] 实现核心功能
  - [ ] 添加单元测试
  - [ ] 代码自测`).join('\n') : '- [ ] 实现核心功能\n  - [ ] 添加单元测试\n  - [ ] 代码自测'}

## Phase 4: 代码提交
- [ ] 提交代码到 Git
  - Commit message: "[TFS#${item.tfsId}] ${item.title.substring(0, 50)}"
- [ ] 推送到远程仓库
- [ ] 创建 Pull Request

## Phase 5: 代码审查
- [ ] 通过自动化测试
- [ ] 通过代码审查
- [ ] 修复审查意见

## Phase 6: 完成归档
- [ ] 更新 TFS 工作项状态为"已解决"
- [ ] 归档 Forge track

---

**生成时间**: ${new Date().toISOString()}
**工作项**: #${item.tfsId}
**识别仓库**: ${repos.length} 个
`;
}

/**
 * 调用 AI 生成开发计划（带轮询等待）
 *
note: 使用 OpenCode API 发送 prompt 并等待响应完整内容
 * 参考: requirement-analyzer/index.ts sendPromptToAIOnce
 */
async function callAIGeneratePlan(
  client: any,
  prompt: string,
  getModel?: () => { providerID: string; modelID: string } | null
): Promise<string> {
  console.log(`[TaskCenter] [DEBUG] callAIGeneratePlan started, prompt length: ${prompt.length}`);
  
  try {
    // 创建临时 session
    console.log(`[TaskCenter] [DEBUG] Creating session...`);
    const sessionResult = await client.session.create({});
    const session = unwrap(sessionResult) as { id: string };
    const sessionID = session.id;
    console.log(`[TaskCenter] [DEBUG] Session created: ${sessionID}`);
    
    // 构建 prompt 选项（参考 requirement-analyzer 模式）
    const promptOptions: any = {
      sessionID,
      parts: [{ type: 'text', text: prompt }],
    };
    
    // 如果提供了模型选择，传入 model 参数
    const model = getModel?.();
    if (model) {
      promptOptions.model = model;
      console.log(`[TaskCenter] [DEBUG] Using model: ${model.providerID}/${model.modelID}`);
    }
    
    // 调用 promptAsync - 可能会直接返回结果
    console.log(`[TaskCenter] [DEBUG] Calling promptAsync...`);
    const result = await client.session.promptAsync(promptOptions);
    console.log(`[TaskCenter] [DEBUG] promptAsync returned:`, result ? '有数据' : '空');
    
    // 优先检查返回的数据（同步模式）
    if (result && (result as any).data) {
      const data = (result as any).data;
      console.log(`[TaskCenter] [DEBUG] promptAsync returned data:`, JSON.stringify(data, null, 2));
      
      if (data.error) {
        throw new Error(`AI 生成失败: ${JSON.stringify(data.error)}`);
      }
      
      if (data.output || data.content) {
        const content = data.output || data.content;
        console.log(`[TaskCenter] [DEBUG] Got content from promptAsync, length: ${content.length}`);
        return content;
      }
    }
    
    // 如果 promptAsync 没有直接返回内容，进入轮询模式
    console.log(`[TaskCenter] [DEBUG] Entering poll mode for session ${sessionID}...`);
    
    const maxWaitTime = 5 * 60 * 1000;
    const pollInterval = 1000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      // 获取消息
      const messagesResult = await client.session.messages({ sessionID });
      const messages = unwrap(messagesResult) || [];
      
      // 获取状态
      const statusResult = await client.session.status();
      const sessions = unwrap(statusResult) as Record<string, { type?: string; status?: string; state?: string }>;
      const currentSessionStatus = sessions[sessionID];
      const status = currentSessionStatus?.type || currentSessionStatus?.status || currentSessionStatus?.state;
      
      // 查找 assistant 消息
      const assistantMessages = messages.filter((m: any) => m.info?.role === 'assistant');
      
      if (assistantMessages.length > 0) {
        const lastMsg = assistantMessages[assistantMessages.length - 1];
        
        // 如果有错误，立即抛出
        if (lastMsg.info?.error) {
          console.error(`[TaskCenter] [DEBUG] AI error:`, lastMsg.info.error);
          throw new Error(`AI execution failed: ${JSON.stringify(lastMsg.info.error)}`);
        }
        
        // session 结束或完成
        if (!currentSessionStatus || status === 'completed' || status === 'idle') {
          console.log(`[TaskCenter] [DEBUG] Session completed after ${elapsed}s`);
          
          if (lastMsg.parts && Array.isArray(lastMsg.parts)) {
            const textParts = lastMsg.parts.filter((p: any) => p.type === 'text');
            const content = textParts.map((p: any) => p.text).join('');
            console.log(`[TaskCenter] [DEBUG] Got content from messages, length: ${content.length}`);
            return content;
          }
        }
        
        // session 失败
        if (status === 'failed' || status === 'error') {
          throw new Error(`AI session failed: ${status}`);
        }
      }
      
      // 每 10 秒打个点
      if (elapsed % 10 === 0) {
        console.log(`[TaskCenter] [DEBUG] Waiting... ${elapsed}s elapsed, messages: ${messages.length}, status: ${status || 'none'}`);
      }
    }
    
    throw new Error('AI generation timeout (5 minutes)');
    
  } catch (error) {
    console.error('[TaskCenter] [DEBUG] callAIGeneratePlan failed:', error);
    throw error;
  }
}

/**
 * 将格式化的工作项转换为 TaskCenterItem
 */
function formatToTaskCenterItem(item: FormattedWorkItem): TaskCenterItem {
  const changedDate = item.changedDate;
  const updatedAt = changedDate ? Date.parse(changedDate) : null;
  return {
    id: `tfs-${item.id}`,
    tfsId: item.id,
    title: item.title,
    description: item.description,
    project: item.project,
    workItemType: item.workItemType,
    priority: item.priority,
    assignedTo: item.assignedTo,
    tags: item.tags,
    state: item.state,
    url: item.url,
    status: mapStateToStatus(item.state),
    stage: "idle",
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
  };
}

export function createTaskCenterStore(options: {
  client: () => Client | null;
  getSelectedModel?: () => { providerID: string; modelID: string } | null;
  activeWorkspaceRoot: () => string;
  createSessionAndOpen: () => void;
  setPrompt: (value: string) => void;
  tfsConfig?: () => TFSConfig | null;
  createSessionAndOpenWithDirectory?: (directory: string) => void;
}) {
  const [items, setItems] = createSignal<TaskCenterItem[]>([]);
  const [status, setStatus] = createSignal<SyncStatus>("idle");
  const [error, setError] = createSignal<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = createSignal<number | null>(null);
  const [syncing, setSyncing] = createSignal(false);
  const [syncSessionId, setSyncSessionId] = createSignal<string | null>(null);
  
  // Task execution state
  const [selectedItem, setSelectedItem] = createSignal<TaskCenterItem | null>(null);
  const [tasks, setTasks] = createSignal<ParsedTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = createSignal<number>(-1);
  const [executing, setExecuting] = createSignal(false);
  const [showTaskPanel, setShowTaskPanel] = createSignal(false);

  // Requirement Analysis Wizard State - 需求分析向导状态
  const [wizard, setWizard] = createStore<PlanWizardState>({
    isOpen: false,
    step: 1,
    requirement: null,
    detection: null,
    selectedRepos: [],
    isLoading: false,
    error: null,
    generationProgress: 0,
    intent: undefined,
    design: undefined,
    tasks: undefined,
    autoPlanStep: 'idle',
    autoPlanProgress: 0,
  });

  // Requirement Analyzer instance (lazy init)
  let requirementAnalyzer: RequirementAnalyzer | null = null;
  
  const getRequirementAnalyzer = (): RequirementAnalyzer => {
    if (!requirementAnalyzer) {
      const config = getTfsConfig();
      if (!config) throw new Error('TFS not configured');
      requirementAnalyzer = createRequirementAnalyzer(
        new TFSClient(config),
        options.client, // getClient
        options.getSelectedModel, // getModel
        (progress) => {
          // 转发进度到 wizard
          if (progress) {
            setWizard({
              isLoading: true,
              error: null,
              generationProgress: progress.progress || 0,
              stage: progress.stage,
              message: progress.message
            });
          }
        }
      );
    }
    return requirementAnalyzer;
  };

  AutoAnalyzer.configure({ getAnalyzer: getRequirementAnalyzer });
  const analysisQueue = AnalysisQueue.getInstance();
  const [autoAnalysisConfig, setAutoAnalysisConfigSignal] = createSignal(getAutoAnalysisConfig());

  analysisQueue.configure({ maxAttempts: autoAnalysisConfig().maxRetries });
  subscribeAutoAnalysisConfig((next) => {
    setAutoAnalysisConfigSignal(next);
    analysisQueue.configure({ maxAttempts: next.maxRetries });
  });

  // Automation state store - persists automation progress
  // Using Record instead of Map for JSON serialization compatibility
  const automationStore = (() => {
    const initialState: AutomationStateMap = {};
    const store = createStore<AutomationStateMap>(initialState);
    return persisted(Persist.global("task-center.automation"), store);
  })();
  const automationState = automationStore[0];
  const setAutomationState = (tfsId: number, state: TaskCenterAutomationState) => {
    const updater: Partial<AutomationStateMap> = {};
    updater[tfsId] = state;
    automationStore[1](updater);
  };

  // TFS Sync status store - persists TFS subtask sync status
  // Using Record to track sync status per TFS work item
  type TfsSyncStatusMap = Record<number, TfsSyncStatus>;
  const SYNC_STALE_MS = 5 * 60 * 1000;
  
  const tfsSyncStore = (() => {
    const initialState: TfsSyncStatusMap = {};
    const store = createStore<TfsSyncStatusMap>(initialState);
    return persisted(Persist.global("task-center.tfs-sync"), store);
  })();
  const tfsSyncState = tfsSyncStore[0];
  const normalizeTfsSyncStatus = (status: TfsSyncStatus): TfsSyncStatus => {
    if (status.isSyncing) {
      const startedAt = status.syncStartedAt ?? Date.now();
      if (Date.now() - startedAt > SYNC_STALE_MS) {
        return {
          ...status,
          isSyncing: false,
          syncStartedAt: undefined,
          error: status.error ?? "同步超时，请重试",
        };
      }
      return {
        ...status,
        syncStartedAt: startedAt,
      };
    }
    return {
      ...status,
      syncStartedAt: undefined,
    };
  };

  const setTfsSyncState = (tfsId: number, status: TfsSyncStatus) => {
    const updater: Partial<TfsSyncStatusMap> = {};
    updater[tfsId] = normalizeTfsSyncStatus(status);
    tfsSyncStore[1](updater);
  };

  // 重置所有 isSyncing 状态为 false（防止上次崩溃后状态卡住）
  (() => {
    const currentState = tfsSyncState;
    const resetState: TfsSyncStatusMap = {};
    for (const [key, value] of Object.entries(currentState)) {
      resetState[Number(key)] = { ...value, isSyncing: false };
    }
    if (Object.keys(resetState).length > 0) {
      tfsSyncStore[1](resetState);
    }
  })();


  type AutoAnalysisStateMap = Record<number, TaskAutoAnalysisState>;
  const autoAnalysisStore = (() => {
    const initialState: AutoAnalysisStateMap = {};
    return createStore<AutoAnalysisStateMap>(initialState);
  })();
  const autoAnalysisMap = autoAnalysisStore[0];
  const setAutoAnalysisState = (tfsId: number, next: Partial<TaskAutoAnalysisState>) => {
    const current = autoAnalysisMap[tfsId];
    autoAnalysisStore[1]({
      [tfsId]: {
        status: current?.status ?? "idle",
        updatedAt: Date.now(),
        ...current,
        ...next,
      },
    });
  };

  const [queueStatus, setQueueStatus] = createSignal<AnalysisQueueStatus>({
    queueLength: 0,
    isProcessing: false,
    currentWorkItemId: undefined,
    estimatedTimeRemaining: undefined,
  });

  const ensureAnalysisCache = () => {
    const workspaceRoot = options.activeWorkspaceRoot().trim();
    if (!workspaceRoot) {
      throw new Error("Workspace root is required for analysis cache");
    }
    AnalysisCache.configure({ workspaceRoot });
    return workspaceRoot;
  };

  const mergeAnalysisData = (entry: CacheEntry | null, patch: Partial<AnalysisCacheData> = {}): AnalysisCacheData => ({
    requirement: patch.requirement ?? entry?.data.requirement,
    detection: patch.detection ?? entry?.data.detection,
  });

  const writeAnalysisCache = async (
    workItemId: number,
    patch: Partial<AnalysisCacheData>,
    options: Partial<CacheEntry>
  ) => {
    ensureAnalysisCache();
    const existing = await AnalysisCache.get(workItemId);
    const data = mergeAnalysisData(existing, patch);
    return AnalysisCache.set(workItemId, data, options);
  };

  const buildAnalysisResultFromCache = (entry: CacheEntry | null): AnalysisResult | null => {
    if (!entry?.data.requirement || !entry.data.detection) return null;
    const duration = entry.completedAt && entry.startedAt ? entry.completedAt - entry.startedAt : 0;
    return {
      workItemId: entry.workItemId,
      requirement: entry.data.requirement,
      detection: entry.data.detection,
      duration,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
    };
  };

  const runAutoAnalysis = async (workItemId: number): Promise<AnalysisResult> => {
    const startedAt = Date.now();
    setAutoAnalysisState(workItemId, {
      status: "analyzing",
      progress: 0,
      message: "分析中",
      startedAt,
      error: undefined,
    });

    await writeAnalysisCache(workItemId, {}, { status: "analyzing", startedAt, timestamp: startedAt });

    try {
      const result = await AutoAnalyzer.analyze(workItemId);
      const completedAt = result.completedAt ?? Date.now();

      await writeAnalysisCache(workItemId, {
        requirement: result.requirement,
        detection: result.detection,
      }, {
        status: "completed",
        startedAt,
        completedAt,
        timestamp: completedAt,
      });

      setAutoAnalysisState(workItemId, {
        status: "completed",
        progress: 100,
        message: "分析完成",
        result,
        completedAt,
      });

      return result;
    } catch (error) {
      const message = formatAutoAnalysisError(error);
      const completedAt = Date.now();

      await writeAnalysisCache(workItemId, {}, {
        status: "failed",
        startedAt,
        completedAt,
        timestamp: completedAt,
        error: message,
      });

      setAutoAnalysisState(workItemId, {
        status: "failed",
        error: message,
        completedAt,
      });

      throw error;
    }
  };

  analysisQueue.configure({
    processor: runAutoAnalysis,
    maxAttempts: autoAnalysisConfig().maxRetries,
    getPendingEntries: async () => {
      ensureAnalysisCache();
      return AnalysisCache.getPending();
    },
    getSyncContext: (workItemId, result) => {
      if (!autoAnalysisConfig().autoSyncToTfs) return null;
      const item = items().find((entry) => entry.tfsId === workItemId);
      if (!item) return null;
      const config = getTfsConfig();
      if (!config) return null;
      return {
        tfsClient: new TFSClient(config),
        parentId: item.tfsId,
        parentTitle: item.title,
        options: {
          workspaceRoot: options.activeWorkspaceRoot(),
          project: item.project || "WiNEX-General",
          assignedTo: item.assignedTo ?? undefined,
          priority: item.priority ?? undefined,
        },
      };
    },
    onSyncStatus: (workItemId, status) => setTfsSyncState(workItemId, status),
    getSyncStatus: (workItemId) => tfsSyncState[workItemId] ?? null,
  });

  analysisQueue.subscribe((next) => setQueueStatus(next));

  // 清空所有 automation 状态（重置为初始状态）并刷新 TFS 数据
  const clearAutomationState = async () => {
    automationStore[1]({});
    console.log('[TaskCenter] Automation state cleared');
    // 强制刷新 TFS 数据
    await syncTasks({ force: true });
    console.log('[TaskCenter] TFS data synced after clear');
  };

  // Embedded Automation Engine - 内嵌式自动化引擎
  let automationEngine: AutomationEngine | null = null;
  let engineUnsubscribeFns: Array<() => void> = [];

  // Automation Engine State
  const [engineState, setEngineState] = createSignal<AutomationState>('idle');
  const [enginePhase, setEnginePhase] = createSignal<PhaseType | null>(null);
  const [engineProgress, setEngineProgress] = createSignal<number>(0);
  const [engineLogs, setEngineLogs] = createSignal<Array<{ timestamp: Date; level: string; message: string }>>([]);
  const [engineError, setEngineError] = createSignal<Error | null>(null);
  const [engineContext, setEngineContext] = createSignal<Record<string, unknown>>({});

  /**
   * 初始化内嵌式自动化引擎
   */
  const initializeAutomationEngine = (aiConfig?: { provider: string; apiKey: string; model: string; baseUrl?: string }): boolean => {
    try {
      // 清理旧引擎
      if (automationEngine) {
        engineUnsubscribeFns.forEach(fn => fn());
        engineUnsubscribeFns = [];
        automationEngine = null;
      }

      // 获取TFS配置
      const tfsConfig = getTfsConfig();
      if (!tfsConfig) {
        console.error('TFS未配置，无法初始化自动化引擎');
        return false;
      }

      // 创建TFS客户端（使用内嵌版本）
      const tfsClient = new AutomationTFSClient({
        serverUrl: tfsConfig.serverUrl,
        pat: tfsConfig.pat,
        username: tfsConfig.username || undefined,
      });

      // 创建AI服务（如果提供了配置）
      let aiService: AIService | undefined;
      if (aiConfig) {
        aiService = new AIService({
          provider: aiConfig.provider as any,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          baseUrl: aiConfig.baseUrl,
        });
      }

      // 创建引擎
      automationEngine = new AutomationEngine({
        tfsClient,
        aiService: aiService as any,
        gitClient: null as any, // 暂时不传入
        onStateChange: (state) => {
          setEngineState(state);
        },
        onPhaseComplete: (phase, output) => {
          setEngineContext((prev) => ({
            ...prev,
            [phase]: output,
          }));
          
          // 更新进度
          const phases: PhaseType[] = ['analyze', 'design', 'plan', 'implement', 'commit', 'review', 'pr', 'archive'];
          const index = phases.indexOf(phase);
          setEngineProgress(Math.round(((index + 1) / phases.length) * 100));
        },
        onError: (error) => {
          setEngineError(error);
        },
        onLog: (log) => {
          setEngineLogs((prev) => [...prev, {
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
          }]);
        },
      });

      // 注册Phase执行器
      automationEngine.registerPhase('analyze', new PhaseAnalyzer({ tfsClient }));
      if (aiService) {
        automationEngine.registerPhase('design', new PhaseDesigner({ aiService }));
        automationEngine.registerPhase('plan', new PhasePlanner({ aiService }));
      }

      // 订阅事件
      engineUnsubscribeFns.push(
        automationEngine.on('phaseStart', (data) => {
          const { phase } = data as { phase: PhaseType };
          setEnginePhase(phase);
        }),
        automationEngine.on('started', (data) => {
          const { workItemId } = data as { workItemId: number };
          console.log(`[Embedded Engine] 自动化已启动: Work Item #${workItemId}`);
        }),
        automationEngine.on('completed', () => {
          console.log('[Embedded Engine] 自动化已完成');
        }),
        automationEngine.on('cancelled', () => {
          console.log('[Embedded Engine] 自动化已取消');
        })
      );

      console.log('[TaskCenter] 内嵌式自动化引擎初始化成功');
      return true;
    } catch (error) {
      console.error('[TaskCenter] 初始化自动化引擎失败:', error);
      setEngineError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  };

  /**
   * 使用内嵌式引擎启动自动化（新的方法）
   */
  const startEmbeddedAutomation = async (item: TaskCenterItem, aiConfig?: { provider: string; apiKey: string; model: string; baseUrl?: string }): Promise<boolean> => {
    try {
      // 初始化引擎
      const initialized = initializeAutomationEngine(aiConfig);
      if (!initialized) {
        throw new Error('自动化引擎初始化失败');
      }

      if (!automationEngine) {
        throw new Error('自动化引擎未初始化');
      }

      // 重置状态
      setEngineError(null);
      setEngineLogs([]);
      setEngineProgress(0);
      setEngineContext({});

      // 启动自动化
      await automationEngine.start(item.tfsId);
      
      return true;
    } catch (error) {
      console.error('[TaskCenter] 启动嵌入式自动化失败:', error);
      setEngineError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  };

  /**
   * 暂停嵌入式自动化
   */
  const pauseEmbeddedAutomation = (): void => {
    automationEngine?.pause();
  };

  /**
   * 恢复嵌入式自动化
   */
  const resumeEmbeddedAutomation = async (): Promise<void> => {
    await automationEngine?.resume();
  };

  /**
   * 取消嵌入式自动化
   */
  const cancelEmbeddedAutomation = (): void => {
    automationEngine?.cancel();
  };

  // TFS Configuration store - persists TFS PAT and server URL
  const tfsConfigStore = (() => {
    const initialConfig: TFSConfig = DEFAULT_TFS_CONFIG;
    const store = createStore<TFSConfig>(initialConfig);
    return persisted(Persist.global("task-center.tfs-config"), store);
  })();
  const [tfsConfigState, setTfsConfigState] = tfsConfigStore;

  // Config loaded from file cache
  const [fileConfig, setFileConfig] = createSignal<TFSConfig | null>(null);
  const [configLoaded, setConfigLoaded] = createSignal(false);

  /**
   * Load TFS config from file (async)
   * Tries to read from .opencode/config/tfs.json
   */
  const loadTfsConfigFromFile = async (): Promise<TFSConfig | null> => {
    // Only try to load from file in Tauri desktop environment
    if (typeof window === 'undefined' || !(window as { __TAURI__?: unknown }).__TAURI__) {
      console.log('Not in Tauri environment, skipping file config');
      setConfigLoaded(true);
      return null;
    }

    try {
      // Dynamic import to avoid browser issues
      const fs = await import('@tauri-apps/plugin-fs');
      console.log('Loading TFS config from:', TFS_CONFIG_PATH);
      console.log('BaseDirectory values:', Object.keys(fs.BaseDirectory).join(', '));
      
      // Read from home directory (cross-platform)
      const content = await fs.readTextFile(TFS_CONFIG_PATH, { baseDir: fs.BaseDirectory.Home });
      console.log('TFS config file loaded, size:', content.length);
      
      const parsed = JSON.parse(content) as Partial<TFSConfig>;
      
      if (validateTfsConfig(parsed)) {
        const config = createTfsConfig(parsed);
        setFileConfig(config);
        // Also update persisted store
        setTfsConfigState(config);
        setConfigLoaded(true);
        console.log('TFS config loaded successfully');
        return config;
      } else {
        console.warn('TFS config file invalid (missing PAT)');
      }
    } catch (error) {
      // File doesn't exist or invalid - that's okay
      console.log('TFS config file not found or invalid:', error);
    }
    
    setConfigLoaded(true);
    return null;
  };

  /**
   * Save TFS config to file (async)
   */
  const saveTfsConfigToFile = async (config: TFSConfig): Promise<void> => {
    if (typeof window === 'undefined' || !(window as { __TAURI__?: unknown }).__TAURI__) {
      throw new Error('File operations only available in Tauri desktop app');
    }

    const fs = await import('@tauri-apps/plugin-fs');
    
    // Ensure directory exists
    try {
      await fs.mkdir('.opencode/config', { baseDir: fs.BaseDirectory.Home, recursive: true });
    } catch {
      // Directory might already exist
    }
    
    const content = JSON.stringify({
      serverUrl: config.serverUrl || DEFAULT_SERVER_URL,
      pat: config.pat,
      username: config.username,
    }, null, 2);
    
    await fs.writeTextFile(TFS_CONFIG_PATH, content, { baseDir: fs.BaseDirectory.Home });
    setFileConfig(config);
    console.log('TFS config saved to:', TFS_CONFIG_PATH);
  };

  // Hard-coded config for immediate use (will be overridden by file config when available)
  const HARDCODED_CONFIG: TFSConfig = {
    serverUrl: 'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0',
    pat: 'yxnmy2hwkv4l2ulz7p7zt4b43fotxmsedamak4vfeattcehd5elq',
    username: 'WINNING\\g_wj'
  };

  /**
   * Get valid TFS configuration from store, file, or options
   * Priority: options > file > persisted storage > hardcoded
   */
  const getTfsConfig = (): TFSConfig | null => {
    // First try from options prop (highest priority)
    if (options.tfsConfig) {
      const config = options.tfsConfig();
      if (config && config.pat) return config;
    }

    // Then try from file cache
    const fromFile = fileConfig();
    if (fromFile && fromFile.pat) {
      return fromFile;
    }

    // Then try from persisted store (tfsConfigState is a Store, not a function)
    const stored = tfsConfigState;
    if (stored && stored.pat) {
      return {
        serverUrl: stored.serverUrl,
        pat: stored.pat,
        username: stored.username
      };
    }

    // Finally use hardcoded config as fallback
    return HARDCODED_CONFIG;
  };

  /**
   * Set TFS configuration (sync to store, async to file)
   */
  const setTfsConfig = (config: TFSConfig) => {
    setTfsConfigState(config);
    setFileConfig(config);
    // Also try to save to file (async, don't wait)
    if (typeof window !== 'undefined' && (window as { __TAURI__?: unknown }).__TAURI__) {
      saveTfsConfigToFile(config).catch(e => {
        console.warn('Failed to save TFS config to file:', e);
      });
    }
  };

  const uiStore = (() => {
    const store = createStore<TaskCenterUiState>({
      search: "",
    });
    return persisted(Persist.global("task-center.ui"), store);
  })();
  const ui = uiStore[0];
  const setUi = uiStore[1];

  const filteredItems = createMemo(() => {
    const uiState = ui;
    if (!uiState) return items();
    const query = uiState.search?.trim().toLowerCase() ?? "";
    if (!query) return items();
    return items().filter((item) => {
      const haystack = `${item.title ?? ""} ${item.project ?? ""} ${item.workItemType ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  const itemsByStatus = createMemo(() => {
    const grouped: Record<TaskCenterStatus, TaskCenterItem[]> = {
      todo: [],
      progress: [],
      done: [],
      archived: [],
      failed: [],
    };
    for (const item of filteredItems()) {
      grouped[item.status].push(item);
    }
    return grouped;
  });

  const setSearch = (value: string) => setUi("search", value);

  const readAnalysisCacheEntries = async (targetItems: TaskCenterItem[]) => {
    const results: Record<number, CacheEntry | null> = {};
    const concurrency = 8;
    let index = 0;

    const worker = async () => {
      while (index < targetItems.length) {
        const currentIndex = index;
        index += 1;
        const item = targetItems[currentIndex];
        try {
          results[item.tfsId] = await AnalysisCache.get(item.tfsId);
        } catch {
          results[item.tfsId] = null;
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, targetItems.length) }, () => worker());
    await Promise.all(workers);
    return results;
  };

  const refreshAnalysisStatus = async (targetItems?: TaskCenterItem[]) => {
    const config = autoAnalysisConfig();
    const list = targetItems ?? items();
    const emptyResults: Record<number, CacheEntry | null> = {};

    if (list.length === 0) return emptyResults;

    try {
      ensureAnalysisCache();
    } catch {
      return emptyResults;
    }

    const results = await readAnalysisCacheEntries(list);

    for (const item of list) {
      const entry = results[item.tfsId] ?? null;
      const tfsSync = tfsSyncState[item.tfsId];
      // 只有当分析和计划都同步完成时，才视为已完成
      const isFullySynced = tfsSync?.analysisSynced && tfsSync?.planSynced;
      
      if (!entry) {
        // 如果 TFS 已完全同步（分析和计划），说明分析已完成，即使没有本地缓存
        if (isFullySynced) {
          setAutoAnalysisState(item.tfsId, {
            status: "completed",
            progress: 100,
            message: "已同步 TFS",
            error: undefined,
            updatedAt: Date.now(),
          });
        } else {
          setAutoAnalysisState(item.tfsId, { status: "idle", message: undefined, error: undefined });
        }
        continue;
      }

      const expired = AnalysisCache.isExpired(entry.timestamp, config.cacheExpiryHours);
      if (expired) {
        // 如果 TFS 已完全同步，即使缓存过期也视为已完成
        if (isFullySynced) {
          setAutoAnalysisState(item.tfsId, {
            status: "completed",
            progress: 100,
            message: "已同步 TFS",
            error: undefined,
            updatedAt: Date.now(),
          });
        } else {
          setAutoAnalysisState(item.tfsId, {
            status: "idle",
            message: "缓存已过期",
            error: undefined,
          });
        }
        continue;
      }

      const result = buildAnalysisResultFromCache(entry);
      const hasResult = !!result;
      const currentState = autoAnalysisMap[item.tfsId];
      // 如果正在分析，优先保持 analyzing，避免被缓存 pending 覆盖
      const status = currentState?.status === "analyzing"
        ? "analyzing"
        : isFullySynced
          ? "completed"
          : hasResult
            ? "completed"
            : entry.status === "pending"
              ? "queued"
              : entry.status === "analyzing"
                ? "analyzing"
                : entry.status === "failed"
                  ? "failed"
                  : entry.status === "completed"
                    ? "completed"
                    : "idle";

      setAutoAnalysisState(item.tfsId, {
        status,
        progress: status === "completed" ? 100 : status === "analyzing" ? (currentState?.progress ?? 50) : 0,
        message: entry.error ? `分析失败: ${entry.error}` : status === "completed" ? (isFullySynced ? "已同步 TFS" : "缓存命中") : undefined,
        error: entry.error,
        result: result ?? undefined,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
      });
    }

    return results;
  };

  const enqueueAutoAnalysis = async (workItemId: number, priority: AnalysisPriority = "normal") => {
    // 先检查是否已同步，避免加入队列后卡住
    const tfsSync = tfsSyncState[workItemId];
    const isFullySynced = tfsSync?.analysisSynced && tfsSync?.planSynced;
    if (isFullySynced) {
      console.log(`[TaskCenter] Skipping enqueue for #${workItemId} - already fully synced`);
      setAutoAnalysisState(workItemId, { status: "completed", progress: 100, message: "已同步 TFS" });
      return;
    }
    
    setAutoAnalysisState(workItemId, { status: "queued", message: "排队中" });
    try {
      await writeAnalysisCache(workItemId, {}, { status: "pending", timestamp: Date.now() });
    } catch {
      // ignore cache failures
    }
    analysisQueue.enqueue(workItemId, priority);
  };

  const reanalyzeWorkItem = async (item: TaskCenterItem) => {
    await enqueueAutoAnalysis(item.tfsId, "high");
  };

  const syncTasks = async (syncOptions?: { force?: boolean }) => {
    if (syncing() && !syncOptions?.force) return;

    // Try to load config from file if not already loaded
    if (!configLoaded()) {
      await loadTfsConfigFromFile();
    }

    // Get TFS configuration
    const config = getTfsConfig();
    if (!config) {
      setError(`TFS configuration not found. Please create ${TFS_CONFIG_PATH} with your PAT:\n\n{\n  "serverUrl": "http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0",\n  "pat": "your-pat-token",\n  "username": "WINNING\\\\your-username"\n}`);
      setStatus("error");
      return;
    }

    setSyncing(true);
    setStatus("syncing");
    setError(null);
    setSyncSessionId(null);

    try {
      // Create TFS client and fetch work items directly
      const client = new TFSClient(config);
      const workItems = await client.getMyWorkItems({
        states: ['已分析'],
        top: 100
      });

      // Convert to TaskCenterItem format
      const tfsItems = workItems.map(formatToTaskCenterItem).map((item) => ({
        ...item,
        stage: "idle" as TaskCenterStage,
      }));

      // Merge with automation state to preserve items not in TFS query
      const mergedItems = mergeTfsItemsWithAutomation(tfsItems, automationState ?? {}, tfsSyncState);
      setItems(mergedItems);

      // First, check TFS subtask sync status before refreshing analysis status
      // This ensures tfsSyncState is up-to-date for refreshAnalysisStatus to use
      for (const item of mergedItems) {
        await checkAndRefreshTfsSyncStatus(item);
      }

      // Now refresh analysis status with up-to-date tfsSyncState
      const cacheEntries = await refreshAnalysisStatus(mergedItems);

      if (autoAnalysisConfig().autoSyncToTfs) {
        for (const item of mergedItems) {
          await autoSyncExistingPlanToTfs(item);
        }
      }

      if (autoAnalysisConfig().enabled) {
        // Check TFS sync status BEFORE restoring queue
        // to avoid restoring items that are already synced
        for (const item of mergedItems) {
          const tfsSync = tfsSyncState[item.tfsId];
          // 只有当分析和计划都同步完成时，才跳过队列恢复
          const isFullySynced = tfsSync?.analysisSynced && tfsSync?.planSynced;
          
          if (isFullySynced) {
            // Skip restoring items that are fully synced to TFS (both analysis and plan)
            console.log(`[TaskCenter] Skipping queue restore for #${item.tfsId} - fully synced to TFS`);
            // Also update autoAnalysisState to completed
            setAutoAnalysisState(item.tfsId, {
              status: "completed",
              progress: 100,
              message: "已同步 TFS",
              error: undefined,
            updatedAt: Date.now(),
          });
        }
      }

      try {
          const restored = await analysisQueue.restoreQueue({ maxStuckMinutes: autoAnalysisConfig().stuckMinutes });
          if (restored.length > 0) {
            for (const item of restored) {
              // Double-check TFS sync status before marking as queued
              const tfsSync = tfsSyncState[item.workItemId];
              // 只有当分析和计划都同步完成时，才跳过
              const isFullySynced = tfsSync?.analysisSynced && tfsSync?.planSynced;
              
              if (isFullySynced) {
                console.log(`[TaskCenter] Restored item #${item.workItemId} fully synced, marking as completed`);
                setAutoAnalysisState(item.workItemId, { status: "completed", progress: 100, message: "已同步 TFS" });
                continue;
              }
              
              setAutoAnalysisState(item.workItemId, { status: "queued", message: "队列已恢复" });
              try {
                await writeAnalysisCache(item.workItemId, {}, { status: "pending", timestamp: Date.now() });
              } catch {
                // ignore cache failures
              }
            }
          }
        } catch (error) {
          console.warn('[TaskCenter] Failed to restore analysis queue:', error);
        }
        for (const item of mergedItems) {
          const entry = cacheEntries[item.tfsId] ?? null;
          const expired = entry ? AnalysisCache.isExpired(entry.timestamp, autoAnalysisConfig().cacheExpiryHours) : true;
          const state = autoAnalysisMap[item.tfsId];
          const tfsSync = tfsSyncState[item.tfsId];
          // 只有当分析和计划都同步完成时，才跳过加入队列
          const isFullySynced = tfsSync?.analysisSynced && tfsSync?.planSynced;
          
          if (isFullySynced) {
            console.log(`[TaskCenter] Skipping queue for #${item.tfsId} - fully synced to TFS`);
            continue;
          }
          
          const shouldQueue = !entry || expired || entry.status === "failed" || entry.status === "pending";

          if (shouldQueue && state?.status !== "analyzing" && state?.status !== "queued") {
            const priority: AnalysisPriority = entry?.status === "failed" ? "high" : "normal";
            await enqueueAutoAnalysis(item.tfsId, priority);
          }
        }
      }

      setLastUpdatedAt(Date.now());
      setStatus("idle");
    } catch (error) {
      const message = formatSyncError(error);
      setError(message);
      setStatus("error");
    } finally {
      setSyncing(false);
    }
  };

  const startAutomation = async (item: TaskCenterItem) => {
    const tfsId = item.tfsId;

    // Get TFS configuration
    const config = getTfsConfig();
    if (!config) {
      setError("TFS configuration not found. Please configure TFS PAT in settings.");
      return;
    }

    try {
      // Note: 不更新 TFS 状态，保持为"已分析"
      // 只在开发完成后才更新为"已解决"

      // Update local automation state only
      setAutomationState(tfsId, {
        status: "progress",
        stage: "analyzing",
        subStage: null,
        sessionId: null,
        blockedReason: null,
        updatedAt: Date.now(),
      });

      // Create OpenCode session with task-automation prompt
      const prompt = `使用 task-automation skill 完整处理 TFS 工作项 #${item.tfsId}。`;
      options.setPrompt(prompt);
      options.createSessionAndOpen();

    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start automation.";
      setError(message);
      console.error("Start automation error:", error);
    }
  };

  // ========== Requirement Analysis Wizard Actions ==========
  
  const wizardActions = {
    open: (item?: TaskCenterItem) => setWizard({ 
      isOpen: true, 
      step: 1, 
      error: null, 
      currentWorkItemId: item?.tfsId,
    }),
    
    close: () => setWizard({
      isOpen: false,
      step: 1,
      currentWorkItemId: undefined,
      requirement: null,
      detection: null,
      selectedRepos: [],
      isLoading: false,
      error: null,
      generationProgress: 0,
      intent: undefined,
      design: undefined,
      tasks: undefined,
      autoPlanStep: 'idle',
      autoPlanProgress: 0,
      isAutoGenerating: false,
    }),

    nextStep: () => setWizard('step', s => Math.min(s + 1, 3) as 1 | 2 | 3),
    prevStep: () => {
      const nextStep = Math.max(wizard.step - 1, 1) as 1 | 2 | 3;
      setWizard('step', nextStep);
      setWizard({
        isAutoGenerating: false,
        autoPlanStep: 'idle',
        autoPlanProgress: 0,
      });
    },

    // Open wizard directly in plan view if documents exist
    async openPlanViewer(item: TaskCenterItem): Promise<boolean> {
      const directory = options.activeWorkspaceRoot().trim();
      if (!directory) {
        setWizard({ isOpen: true, step: 3, isLoading: false, error: '未选择工作目录' });
        return false;
      }

      setWizard({
        isOpen: true,
        step: 3,
        isLoading: true,
        error: null,
        currentWorkItemId: item.tfsId,
        generationProgress: 0,
        autoPlanProgress: 0,
      });

      const trackPath = `forge/tracks/tfs-${item.tfsId}`;
      const possibleFiles = [
        `${trackPath}/intent.md`,
        `${trackPath}/design.md`,
        `${trackPath}/tasks.md`,
      ];

      const fileResult = await readGeneratedFiles(possibleFiles, directory);
      const hasContent = !!(fileResult.intent || fileResult.design || fileResult.tasks);

      if (!hasContent) {
        setWizard('isLoading', false);
        return false;
      }

      const [analysisResult, reposResult] = await Promise.all([
        readAnalysisResult(item.tfsId, directory),
        readReposResult(item.tfsId, directory),
      ]);

      if (analysisResult?.requirement && reposResult?.detection) {
        const completedAt = Date.now();
        try {
          await writeAnalysisCache(item.tfsId, {
            requirement: analysisResult.requirement,
            detection: reposResult.detection,
          }, {
            status: "completed",
            completedAt,
            timestamp: completedAt,
          });
        } catch {
          // ignore cache failures
        }

        setAutoAnalysisState(item.tfsId, {
          status: "completed",
          progress: 100,
          message: "已加载计划",
          result: {
            workItemId: item.tfsId,
            requirement: analysisResult.requirement,
            detection: reposResult.detection,
            duration: 0,
            completedAt,
          },
          completedAt,
        });
      }

      setWizard({
        isOpen: true,
        step: 3,
        isLoading: false,
        error: null,
        generationProgress: 100,
        autoPlanStep: 'completed',
        autoPlanProgress: 100,
        requirement: analysisResult?.requirement ?? null,
        detection: reposResult?.detection ?? null,
        selectedRepos: reposResult?.selectedRepos ?? [],
        intent: fileResult.intent,
        design: fileResult.design,
        tasks: fileResult.tasks,
      });

      return true;
    },
    
    // Step 1: Analyze requirement
    async analyzeRequirement(workItemId: number) {
      setWizard({ isLoading: true, error: null });
      const config = autoAnalysisConfig();
      try {
        const inMemory = autoAnalysisMap[workItemId];
        if (inMemory?.status === "completed" && inMemory.result?.requirement) {
          const completedAt = inMemory.result.completedAt ?? inMemory.completedAt ?? Date.now();
          const expired = AnalysisCache.isExpired(completedAt, config.cacheExpiryHours);
          if (!expired) {
            console.log(`[TaskCenter] Using in-memory cache for #${workItemId}`);
            setWizard('requirement', inMemory.result.requirement);
            await this.detectRepositories(inMemory.result.requirement);
            return;
          }
        }

        let cacheEntry: CacheEntry | null = null;
        try {
          ensureAnalysisCache();
          cacheEntry = await AnalysisCache.get(workItemId);
        } catch (error) {
          console.warn('[TaskCenter] Analysis cache read failed:', error);
        }

        if (cacheEntry && cacheEntry.data.requirement && !AnalysisCache.isExpired(cacheEntry.timestamp, config.cacheExpiryHours)) {
          console.log(`[TaskCenter] Using cached analysis for #${workItemId}`);
          setWizard('requirement', cacheEntry.data.requirement);
          const cachedResult = buildAnalysisResultFromCache(cacheEntry);
          if (cachedResult) {
            setAutoAnalysisState(workItemId, {
              status: "completed",
              progress: 100,
              message: "缓存命中",
              result: cachedResult,
              completedAt: cachedResult.completedAt,
            });
          }
          await this.detectRepositories(cacheEntry.data.requirement);
          return;
        }

        const analyzer = getRequirementAnalyzer();
        const result = await analyzer.analyze(workItemId);
        setWizard('requirement', result);

        try {
          await writeAnalysisCache(workItemId, { requirement: result }, { status: "pending", timestamp: Date.now() });
        } catch (error) {
          console.warn('[TaskCenter] Failed to cache analysis result:', error);
        }
        setAutoAnalysisState(workItemId, { status: "queued", message: "需求已分析" });
        
        // Auto-detect repos after analysis
        await this.detectRepositories(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : '分析需求失败';
        setWizard('error', message);
        console.error('Analyze requirement error:', err);
      } finally {
        setWizard({ isLoading: false, isAutoGenerating: false });
      }
    },
    
    // Step 2: Detect repositories
    async detectRepositories(requirement: ParsedRequirement) {
      setWizard('isLoading', true);
      try {
        const analyzer = getRequirementAnalyzer();
        const result = analyzer.detectRepos(requirement);
        setWizard('detection', result);
        
        // Auto-select high-confidence primary repos
        const selectedRepos = result.primary.filter((r: RepositoryMatch) => r.confidence > 0.6);
        setWizard('selectedRepos', selectedRepos);

        try {
          const completedAt = Date.now();
          await writeAnalysisCache(requirement.workItemId, {
            requirement,
            detection: result,
          }, {
            status: "completed",
            completedAt,
            timestamp: completedAt,
          });

          setAutoAnalysisState(requirement.workItemId, {
            status: "completed",
            progress: 100,
            message: "分析完成",
            result: {
              workItemId: requirement.workItemId,
              requirement,
              detection: result,
              duration: 0,
              completedAt,
            },
            completedAt,
          });
        } catch (error) {
          console.warn('[TaskCenter] Failed to cache detection result:', error);
        }

        // Auto-generate plan after repo detection
        const currentItem = items().find(i => i.tfsId === requirement.workItemId);
        if (currentItem && selectedRepos.length > 0) {
          console.log(`[TaskCenter] Auto-generating plan for #${requirement.workItemId}`);
          setWizard({
            isAutoGenerating: true,
            step: 3, // Auto advance to step 3
          });
          await this.generatePlan(currentItem);
        } else if (selectedRepos.length === 0) {
          console.warn(`[TaskCenter] No repos selected for #${requirement.workItemId}, skipping auto-generation`);
        }
      } finally {
        setWizard('isLoading', false);
      }
    },

    
    // Toggle repo selection
    toggleRepo(repo: RepositoryMatch) {
      const current = wizard.selectedRepos;
      const exists = current.find(r => r.id === repo.id);
      if (exists) {
        setWizard('selectedRepos', current.filter(r => r.id !== repo.id));
      } else {
        setWizard('selectedRepos', [...current, repo]);
      }
    },
    
    // Step 3: Generate plan - 只生成 Forge track 文件，不改变 TFS 状态
    async generatePlan(item: TaskCenterItem) {
      const requirement = wizard.requirement;
      const selectedRepos = wizard.selectedRepos;
      
      if (!requirement) {
        setWizard('error', '需求分析结果不存在');
        return;
      }
      
      if (selectedRepos.length === 0) {
        setWizard('error', '请至少选择一个代码仓库');
        return;
      }
      
      setWizard({ 
        isLoading: true, 
        error: null, 
        generationProgress: 0,
        autoPlanProgress: 0,
        intent: undefined,
        design: undefined,
        tasks: undefined,
      });
      
      try {
        // 1. 获取工作目录和客户端
        setWizard('generationProgress', 10);
        const directory = options.activeWorkspaceRoot().trim();
        const activeClient = options.client();
        if (!activeClient) {
          throw new Error('OpenWork client not connected');
        }
        
        // 2. 先检查是否已有生成的文档
        const trackPath = `forge/tracks/tfs-${item.tfsId}`;
        const possibleFiles = [
          `${trackPath}/intent.md`,
          `${trackPath}/design.md`, 
          `${trackPath}/tasks.md`,
        ];
        
        console.log(`[TaskCenter] [DEBUG] Checking existing files for TFS #${item.tfsId}...`);
        let existingFiles: string[] = [];
        
        for (const filePath of possibleFiles) {
          try {
            await fsReadFile(filePath, directory);
            existingFiles.push(filePath);
            console.log(`[TaskCenter] [DEBUG] Found existing file: ${filePath}`);
          } catch {
            console.log(`[TaskCenter] [DEBUG] File not found: ${filePath}`);
          }
        }
        
        // 如果已有文档，直接读取不调用AI
        if (existingFiles.length > 0) {
          console.log(`[TaskCenter] [DEBUG] Found ${existingFiles.length} existing files, skipping AI generation`);
          setWizard({ generationProgress: 50, autoPlanProgress: 50 });
          
          const fileResult = await readGeneratedFiles(possibleFiles, directory);
          
          if (fileResult.intent || fileResult.design || fileResult.tasks) {
            setWizard({
              generationProgress: 100,
              autoPlanProgress: 100,
              intent: fileResult.intent,
              design: fileResult.design,
              tasks: fileResult.tasks,
            });
            console.log(`[TaskCenter] [DEBUG] Loaded existing documents, skipping AI call`);
            console.log(`[TaskCenter] [DEBUG] Loaded existing documents, skipping AI call`);
            void autoSyncExistingPlanToTfs(item);
            return;
          }
        }
        
        // 3. 构建 prompt
        setWizard({ generationProgress: 20, autoPlanProgress: 20 });
        console.log(`[TaskCenter] Building generate plan prompt for TFS #${item.tfsId}...`);
        const prompt = buildGeneratePlanPrompt(item, requirement, selectedRepos, directory);
        
        // 4. 调用 AI 生成（自动重试3次）
        setWizard({ generationProgress: 40, autoPlanProgress: 40 });
        
        const maxRetries = 3;
        let aiResponse: string = '';
        let lastError: Error | null = null;
        
        console.log(`[TaskCenter] [DEBUG] Starting AI plan generation (max ${maxRetries} retries)...`);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[TaskCenter] [DEBUG] Attempt ${attempt}/${maxRetries} - calling callAIGeneratePlan...`);
            aiResponse = await callAIGeneratePlan(activeClient, prompt, options.getSelectedModel);
            console.log(`[TaskCenter] [DEBUG] Attempt ${attempt} SUCCESS - got response length: ${aiResponse.length}`);
            console.log(`[TaskCenter] [DEBUG] Full AI response:\n${aiResponse}`);
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`[TaskCenter] [DEBUG] Attempt ${attempt} FAILED:`, lastError.message);
            console.error(`[TaskCenter] [DEBUG] Attempt ${attempt} error details:`, error);
            
            if (attempt < maxRetries) {
              const delay = attempt * 2000;
              console.log(`[TaskCenter] [DEBUG] Retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }
        
        console.log(`[TaskCenter] [DEBUG] All attempts completed. aiResponse length: ${aiResponse.length}`);
        
        if (!aiResponse) {
          throw new Error(`生成计划失败（已重试${maxRetries}次）。错误: ${lastError?.message || '未知错误'}。请检查 OpenCode 连接或稍后重试。`);
        }
        
        // 5. 解析 AI 返回的文件列表
        setWizard({ generationProgress: 60, autoPlanProgress: 60 });
        console.log(`[TaskCenter] [DEBUG] Parsing generated files from response...`);
        const generatedFiles = parseGeneratedFiles(aiResponse);
        console.log(`[TaskCenter] [DEBUG] Parsed files count: ${generatedFiles.length}`);
        console.log(`[TaskCenter] [DEBUG] Generated files list:`, generatedFiles);
        
        // 6. 尝试读取 AI 生成的文件
        let intentContent = '';
        let designContent = '';
        let tasksContent = '';
        
        if (generatedFiles.length > 0) {
          console.log(`[TaskCenter] [DEBUG] Reading ${generatedFiles.length} AI-generated files from: ${directory}`);
          const fileResult = await readGeneratedFiles(generatedFiles, directory);
          intentContent = fileResult.intent;
          designContent = fileResult.design;
          tasksContent = fileResult.tasks;
          console.log(`[TaskCenter] [DEBUG] File read results - intent: ${intentContent ? 'YES' : 'NO'}, design: ${designContent ? 'YES' : 'NO'}, tasks: ${tasksContent ? 'YES' : 'NO'}`);
        } else {
          console.warn(`[TaskCenter] [DEBUG] No files found in AI response! Using fallback plan parsing...`);
        }
        
        // 7. 如果文件缺失，显示详细信息
        if (!intentContent && !designContent && !tasksContent) {
          console.error(`[TaskCenter] [DEBUG] NO PLAN CONTENT FOUND!`);
          console.error(`[TaskCenter] [DEBUG] Generated files:`, generatedFiles);
          console.error(`[TaskCenter] [DEBUG] Response length: ${aiResponse.length}`);
          console.error(`[TaskCenter] [DEBUG] Last 500 chars of response: ${aiResponse.substring(aiResponse.length - 500)}`);
          throw new Error('AI 未能生成开发计划文档。请检查 AI 是否正确执行了 forge-plan skill。');
        }
        
        // 8. 完成并加载任务 - 一次性更新所有状态
        console.log(`[TaskCenter] [DEBUG] Setting final state with documents...`);
        console.log(`[TaskCenter] [DEBUG] intentContent length: ${intentContent.length}`);
        console.log(`[TaskCenter] [DEBUG] designContent length: ${designContent.length}`);
        console.log(`[TaskCenter] [DEBUG] tasksContent length: ${tasksContent.length}`);
        
        setWizard({
          generationProgress: 100,
          autoPlanProgress: 100,
          intent: intentContent,
          design: designContent,
          tasks: tasksContent,
        });

        console.log(`[TaskCenter] [DEBUG] Wizard state updated`);
        console.log(`[TaskCenter] Tasks loaded:`, tasks().length);
        void autoSyncExistingPlanToTfs(item);
        // 保持向导弹窗打开，不自动关闭
        // this.close();
        
      } catch (err) {
        const message = err instanceof Error ? err.message : '生成计划失败';
        setWizard({ 
          error: message, 
          generationProgress: 0,
          autoPlanProgress: 0,
          intent: undefined,
          design: undefined,
          tasks: undefined,
        });
        console.error('Generate plan error:', err);
        console.error('Generate plan error:', err);
      } finally {
        setWizard('isLoading', false);
      }
    },

    /**
     * 单步自动开发计划流程
     * 依次执行：需求分析 → 仓库识别 → 生成计划
     * 每步结果持久化到文件，支持中断恢复
     */
    async createDevelopmentPlan(item: TaskCenterItem) {
      const directory = options.activeWorkspaceRoot().trim();
      console.log(`[TaskCenter] [DEBUG] createDevelopmentPlan started, directory: ${directory}`);
      if (!directory) {
        setWizard({ error: '未选择工作目录', isLoading: false });
        return;
      }

      setWizard({ 
        isLoading: true, 
        error: null,
        autoPlanStep: 'idle',
        autoPlanProgress: 0,
      });

      try {
        // 1. 读取或初始化状态
        let status = await readPlanStatus(item.tfsId, directory);
        if (!status) {
          status = initPlanStatus(item.tfsId, item.title);
        }

        // 2. 步骤1：需求分析（如未完成）
        if (!status.completedSteps.includes('analysis')) {
          setWizard({ autoPlanStep: 'analysis', autoPlanProgress: 10 });
          console.log(`[TaskCenter] [AutoPlan] Step 1/3: Analyzing requirement for TFS #${item.tfsId}...`);
          
          const analyzer = getRequirementAnalyzer();
          const requirement = await analyzer.analyze(item.tfsId);
          
          // 保存分析结果
          console.log(`[TaskCenter] [AutoPlan] Saving analysis result to file...`);
          try {
            await writeAnalysisResult(item.tfsId, item.title, requirement, directory);
            console.log(`[TaskCenter] [AutoPlan] Analysis result saved successfully`);
          } catch (writeError) {
            console.error(`[TaskCenter] [AutoPlan] Failed to save analysis result:`, writeError);
            // 继续执行，不中断流程
          }
          
          // 更新状态
          status.steps.analysis = { status: 'completed', output: `01-analysis.json` };
          status.completedSteps.push('analysis');
          status.updatedAt = new Date().toISOString();
          console.log(`[TaskCenter] [AutoPlan] Saving plan status...`);
          try {
            await writePlanStatus(status, directory);
            console.log(`[TaskCenter] [AutoPlan] Plan status saved successfully`);
          } catch (writeError) {
            console.error(`[TaskCenter] [AutoPlan] Failed to save plan status:`, writeError);
          }
          
          setWizard({ 
            requirement,
            autoPlanProgress: 33,
          });
          console.log(`[TaskCenter] [AutoPlan] Step 1/3: Analysis completed`);
        } else {
          // 读取已存在的分析结果
          const analysisResult = await readAnalysisResult(item.tfsId, directory);
          if (analysisResult) {
            setWizard({ 
              requirement: analysisResult.requirement,
              autoPlanProgress: 33,
            });
            console.log(`[TaskCenter] [AutoPlan] Step 1/3: Analysis loaded from cache`);
          }
        }

        // 3. 步骤2：仓库识别（如未完成）
        if (!status.completedSteps.includes('repos')) {
          setWizard({ autoPlanStep: 'repos', autoPlanProgress: 40 });
          console.log(`[TaskCenter] [AutoPlan] Step 2/3: Detecting repositories...`);
          
          const requirement = wizard.requirement;
          if (!requirement) {
            throw new Error('需求分析结果不存在');
          }
          
          const analyzer = getRequirementAnalyzer();
          const detection = analyzer.detectRepos(requirement);
          const selectedRepos = detection.primary.filter((r: RepositoryMatch) => r.confidence > 0.6);
          
          // 保存识别结果
          await writeReposResult(item.tfsId, detection, selectedRepos, directory);
          
          // 更新状态
          status.steps.repos = { status: 'completed', output: `02-repos.json` };
          status.completedSteps.push('repos');
          status.updatedAt = new Date().toISOString();
          await writePlanStatus(status, directory);
          
          setWizard({ 
            detection,
            selectedRepos,
            autoPlanProgress: 66,
          });
          console.log(`[TaskCenter] [AutoPlan] Step 2/3: Repository detection completed, found ${selectedRepos.length} repos`);
        } else {
          // 读取已存在的识别结果
          const reposResult = await readReposResult(item.tfsId, directory);
          if (reposResult) {
            setWizard({ 
              detection: reposResult.detection,
              selectedRepos: reposResult.selectedRepos,
              autoPlanProgress: 66,
            });
            console.log(`[TaskCenter] [AutoPlan] Step 2/3: Repository detection loaded from cache`);
          }
        }

        // 4. 步骤3：生成计划（如未完成）
        if (!status.completedSteps.includes('plan')) {
          setWizard({ autoPlanStep: 'plan', autoPlanProgress: 70 });
          console.log(`[TaskCenter] [AutoPlan] Step 3/3: Generating development plan...`);
          
          const requirement = wizard.requirement;
          const selectedRepos = wizard.selectedRepos;
          
          if (!requirement) {
            throw new Error('需求分析结果不存在');
          }
          if (selectedRepos.length === 0) {
            throw new Error('请至少选择一个代码仓库');
          }

          // 检查是否已有生成的文档
          const trackPath = `forge/tracks/tfs-${item.tfsId}`;
          const possibleFiles = [
            `${trackPath}/intent.md`,
            `${trackPath}/design.md`, 
            `${trackPath}/tasks.md`,
          ];

          let existingFiles: string[] = [];
          for (const filePath of possibleFiles) {
            try {
              await fsReadFile(filePath, directory);
              existingFiles.push(filePath);
            } catch {
              // 文件不存在
            }
          }

          let intentContent = '';
          let designContent = '';
          let tasksContent = '';

          if (existingFiles.length > 0) {
            // 读取已有文档
            setWizard({ autoPlanProgress: 80 });
            const fileResult = await readGeneratedFiles(possibleFiles, directory);
            intentContent = fileResult.intent;
            designContent = fileResult.design;
            tasksContent = fileResult.tasks;
            console.log(`[TaskCenter] [AutoPlan] Loaded existing plan documents`);
          } else {
            // 调用AI生成
            setWizard({ autoPlanProgress: 75 });
            const activeClient = options.client();
            if (!activeClient) {
              throw new Error('OpenWork client not connected');
            }

            const prompt = buildGeneratePlanPrompt(item, requirement, selectedRepos, directory);
            
            setWizard({ autoPlanProgress: 80 });
            const aiResponse = await callAIGeneratePlan(activeClient, prompt, options.getSelectedModel);
            
            setWizard({ autoPlanProgress: 85 });
            const generatedFiles = parseGeneratedFiles(aiResponse);
            
            if (generatedFiles.length > 0) {
              const fileResult = await readGeneratedFiles(generatedFiles, directory);
              intentContent = fileResult.intent;
              designContent = fileResult.design;
              tasksContent = fileResult.tasks;
            }
          }

          if (!intentContent && !designContent && !tasksContent) {
            throw new Error('未能生成开发计划文档');
          }

          // 更新状态
          status.steps.plan = { 
            status: 'completed', 
            output: ['intent.md', 'design.md', 'tasks.md'] 
          };
          status.completedSteps.push('plan');
          status.currentStep = 'completed';
          status.updatedAt = new Date().toISOString();
          await writePlanStatus(status, directory);

        setWizard({ 
          autoPlanStep: 'completed',
          autoPlanProgress: 100,
          intent: intentContent,
          design: designContent,
          tasks: tasksContent,
          step: 3, // 进入第三步显示结果
        });
        console.log(`[TaskCenter] [AutoPlan] Step 3/3: Plan generation completed`);
        void autoSyncExistingPlanToTfs(item);
      } else {
        // 读取已存在的计划文档
        const trackPath = `forge/tracks/tfs-${item.tfsId}`;
        const possibleFiles = [
          `${trackPath}/intent.md`,
          `${trackPath}/design.md`, 
          `${trackPath}/tasks.md`,
        ];
        const fileResult = await readGeneratedFiles(possibleFiles, directory);
        
        setWizard({ 
          autoPlanStep: 'completed',
          autoPlanProgress: 100,
          intent: fileResult.intent,
          design: fileResult.design,
          tasks: fileResult.tasks,
          step: 3,
        });
        console.log(`[TaskCenter] [AutoPlan] Plan documents loaded from cache`);
        void autoSyncExistingPlanToTfs(item);
      }

      } catch (err) {
        const message = err instanceof Error ? err.message : '生成计划失败';
        setWizard({ 
          error: message, 
          autoPlanProgress: 0,
        });
        console.error('Create development plan error:', err);
      } finally {
        setWizard({ isLoading: false, isAutoGenerating: false });
      }
    },

    // TFS Sync
    syncAllToTFS,

  };

  // ========== TFS 子任务同步函数 ==========

  /**
   * 同步分析结果到 TFS（创建子任务）
   * @param item TaskCenterItem
   * @param force 是否强制更新
   */
  async function syncAnalysisToTFS(item: TaskCenterItem, force = false): Promise<boolean> {
    console.log('[TaskCenter] syncAnalysisToTFS called:', { tfsId: item.tfsId, force });
    try {
      const tfsConfig = getTfsConfig();
      console.log('[TaskCenter] TFS Config:', tfsConfig ? 'exists' : 'null');
      if (!tfsConfig) {
        console.error('[TaskCenter] TFS not configured');
        return false;
      }

      // 检查当前 wizard 中是否有分析结果
      const requirement = wizard.requirement;
      const detection = wizard.detection;
      console.log('[TaskCenter] Wizard data:', { 
        hasRequirement: !!requirement, 
        hasDetection: !!detection 
      });
      
      if (!requirement || !detection) {
        console.error('[TaskCenter] No analysis result available');
        return false;
      }

      console.log('[TaskCenter] Creating TFS client...');
      const client = new TFSClient(tfsConfig);
      console.log('[TaskCenter] Calling createAnalysisTask...');
      const result = await createAnalysisTask(
        client,
        item.tfsId,
        item.title,
        requirement,
        detection,
        {
          workspaceRoot: options.activeWorkspaceRoot(),
          project: item.project || 'WiNEX-General',
          force,
          assignedTo: item.assignedTo,
        }
      );
      console.log('[TaskCenter] createAnalysisTask result:', result);

      if (result.success && result.taskId) {
        console.log('[TaskCenter] Setting sync state for analysis...');
        setTfsSyncState(item.tfsId, {
          analysisSynced: true,
          analysisTaskId: result.taskId,
          planSynced: tfsSyncState[item.tfsId]?.planSynced || false,
          planTaskId: tfsSyncState[item.tfsId]?.planTaskId,
          lastSyncedAt: new Date().toISOString(),
        });
        console.log(`[TaskCenter] Analysis synced to TFS: #${result.taskId}`);
        return true;
      }

      console.log('[TaskCenter] Analysis sync failed or returned no taskId');
      return false;
    } catch (error) {
      console.error('[TaskCenter] Failed to sync analysis to TFS:', error);
      return false;
    }
  }


  /**
   * 同步开发计划到 TFS（创建子任务）
   * @param item TaskCenterItem
   * @param force 是否强制更新
   */
  async function syncPlanToTFS(item: TaskCenterItem, force = false): Promise<boolean> {
    console.log('[TaskCenter] syncPlanToTFS called:', { tfsId: item.tfsId, force });
    try {
      const tfsConfig = getTfsConfig();
      console.log('[TaskCenter] TFS Config for plan:', tfsConfig ? 'exists' : 'null');
      if (!tfsConfig) {
        console.error('[TaskCenter] TFS not configured');
        return false;
      }

      const requirement = wizard.requirement;
      const selectedRepos = wizard.selectedRepos;
      console.log('[TaskCenter] Wizard data for plan:', { 
        hasRequirement: !!requirement, 
        selectedReposCount: selectedRepos?.length || 0 
      });
      
      if (!requirement || selectedRepos.length === 0) {
        console.error('[TaskCenter] No plan data available');
        return false;
      }

      console.log('[TaskCenter] Creating TFS client for plan...');
      const client = new TFSClient(tfsConfig);
      console.log('[TaskCenter] Calling createPlanTask...');
      const result = await createPlanTask(
        client,
        item.tfsId,
        item.title,
        item.tfsId,
        requirement,
        selectedRepos,
        {
          workspaceRoot: options.activeWorkspaceRoot(),
          project: item.project || 'WiNEX-General',
          force,
          assignedTo: item.assignedTo,
        },
        {
          intent: wizard.intent,
          design: wizard.design,
          tasks: wizard.tasks,
        }
      );
      console.log('[TaskCenter] createPlanTask result:', result);

      if (result.success && result.taskId) {
        console.log('[TaskCenter] Setting sync state for plan...');
        setTfsSyncState(item.tfsId, {
          ...tfsSyncState[item.tfsId],
          planSynced: true,
          planTaskId: result.taskId,
          lastSyncedAt: new Date().toISOString(),
        });
        console.log(`[TaskCenter] Plan synced to TFS: #${result.taskId}`);
        return true;
      }

      console.log('[TaskCenter] Plan sync failed or returned no taskId');
      return false;
    } catch (error) {
      console.error('[TaskCenter] Failed to sync plan to TFS:', error);
      return false;
    }
  }

  /**
   * 同步所有内容到 TFS
   * @param item TaskCenterItem
   * @param force 是否强制更新
   */
  async function syncAllToTFS(item: TaskCenterItem, force = false): Promise<boolean> {
    console.log('[TaskCenter] syncAllToTFS called:', { tfsId: item.tfsId, title: item.title, force });
    
    // 强制重置 isSyncing 状态（防止之前的状态卡住）
    console.log('[TaskCenter] Resetting isSyncing state before sync...');
    setTfsSyncState(item.tfsId, {
      ...tfsSyncState[item.tfsId],
      isSyncing: true,
      syncStartedAt: Date.now(),
      error: undefined,
    });
    
    try {
      console.log(`[TaskCenter] Starting TFS sync for item #${item.tfsId}`);
      
      // 同步分析结果
      console.log('[TaskCenter] Calling syncAnalysisToTFS...');
      const analysisSuccess = await syncAnalysisToTFS(item, force);
      console.log('[TaskCenter] syncAnalysisToTFS result:', analysisSuccess);
      
      // 同步开发计划
      console.log('[TaskCenter] Calling syncPlanToTFS...');
      const planSuccess = await syncPlanToTFS(item, force);
      console.log('[TaskCenter] syncPlanToTFS result:', planSuccess);
      
      // 清除同步中状态
      console.log('[TaskCenter] Clearing isSyncing state...');
      setTfsSyncState(item.tfsId, {
        ...tfsSyncState[item.tfsId],
        isSyncing: false,
        syncStartedAt: undefined,
      });
      
      const success = analysisSuccess || planSuccess;
      console.log(`[TaskCenter] TFS sync final result:`, { analysisSuccess, planSuccess, success });
      if (success) {
        console.log(`[TaskCenter] TFS sync completed successfully for item #${item.tfsId}`);
        void checkAndRefreshTfsSyncStatus(item);
      } else {
        // 设置错误信息帮助用户理解失败原因
        const tfsConfig = getTfsConfig();
        if (!tfsConfig) {
          setTfsSyncState(item.tfsId, {
            ...tfsSyncState[item.tfsId],
            isSyncing: false,
            syncStartedAt: undefined,
            error: 'TFS 未配置，请在设置中配置 TFS',
          });
        } else if (!wizard.requirement) {
          setTfsSyncState(item.tfsId, {
            ...tfsSyncState[item.tfsId],
            isSyncing: false,
            syncStartedAt: undefined,
            error: '没有需求分析数据，请先完成需求分析',
          });
        } else {
          setTfsSyncState(item.tfsId, {
            ...tfsSyncState[item.tfsId],
            isSyncing: false,
            syncStartedAt: undefined,
            error: '同步失败，请检查 TFS 配置和网络连接',
          });
        }
      }
      
      return success;
    } catch (error) {
      console.error('[TaskCenter] Failed to sync to TFS:', error);
      // 设置错误状态
      setTfsSyncState(item.tfsId, {
        ...tfsSyncState[item.tfsId],
        isSyncing: false,
        syncStartedAt: undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async function loadLocalPlanArtifacts(item: TaskCenterItem): Promise<{
    requirement: ParsedRequirement | null;
    detection: DetectionResult | null;
    selectedRepos: RepositoryMatch[];
    docs: { intent?: string; design?: string; tasks?: string };
  } | null> {
    const directory = options.activeWorkspaceRoot().trim();
    if (!directory) return null;

    const trackPath = `forge/tracks/tfs-${item.tfsId}`;
    const possibleFiles = [
      `${trackPath}/intent.md`,
      `${trackPath}/design.md`,
      `${trackPath}/tasks.md`,
    ];

    const docs = await readGeneratedFiles(possibleFiles, directory);
    const hasDocs = !!(docs.intent || docs.design || docs.tasks);
    if (!hasDocs) return null;

    const [analysisResult, reposResult] = await Promise.all([
      readAnalysisResult(item.tfsId, directory),
      readReposResult(item.tfsId, directory),
    ]);

    let requirement = analysisResult?.requirement ?? null;
    let detection = reposResult?.detection ?? null;
    let selectedRepos = reposResult?.selectedRepos ?? [];

    if (!requirement || (!detection && selectedRepos.length === 0)) {
      try {
        ensureAnalysisCache();
        const cached = await AnalysisCache.get(item.tfsId);
        if (!requirement && cached?.data.requirement) {
          requirement = cached.data.requirement;
        }
        if (!detection && cached?.data.detection) {
          detection = cached.data.detection;
        }
      } catch {
        // ignore cache failures
      }
    }

    if (selectedRepos.length === 0 && detection?.primary?.length) {
      selectedRepos = detection.primary.filter((repo) => repo.confidence > 0.6);
    }

    return {
      requirement,
      detection,
      selectedRepos,
      docs,
    };
  }

  async function autoSyncExistingPlanToTfs(item: TaskCenterItem): Promise<void> {
    if (!autoAnalysisConfig().autoSyncToTfs) return;

    const baseStatus = tfsSyncState[item.tfsId];
    const isFullySynced = baseStatus?.analysisSynced && baseStatus?.planSynced;
    if (isFullySynced || baseStatus?.isSyncing) return;

    const tfsConfig = getTfsConfig();
    if (!tfsConfig) return;

    const artifacts = await loadLocalPlanArtifacts(item);
    if (!artifacts) return;
    if (!artifacts.requirement) {
      console.warn(`[TaskCenter] Auto-sync skipped for #${item.tfsId} - missing requirement data`);
      return;
    }

    setTfsSyncState(item.tfsId, {
      ...baseStatus,
      isSyncing: true,
      syncStartedAt: Date.now(),
      error: undefined,
    });

    try {
      const client = new TFSClient(tfsConfig);
      const syncOptions: SyncOptions = {
        workspaceRoot: options.activeWorkspaceRoot(),
        project: item.project || "WiNEX-General",
        assignedTo: item.assignedTo ?? undefined,
        priority: item.priority ?? undefined,
      };

      let analysisSynced = baseStatus?.analysisSynced ?? false;
      let planSynced = baseStatus?.planSynced ?? false;
      let analysisTaskId = baseStatus?.analysisTaskId;
      let planTaskId = baseStatus?.planTaskId;
      let errorMessage: string | undefined;

      if (!analysisSynced) {
        if (artifacts.detection) {
          const result = await createAnalysisTask(
            client,
            item.tfsId,
            item.title,
            artifacts.requirement,
            artifacts.detection,
            syncOptions
          );
          if (result.success && result.taskId) {
            analysisSynced = true;
            analysisTaskId = result.taskId;
          } else {
            errorMessage = result.error ?? "分析子任务同步失败";
          }
        } else {
          errorMessage = errorMessage ?? "缺少分析数据，无法同步需求分析子任务";
        }
      }

      if (!planSynced) {
        const result = await createPlanTask(
          client,
          item.tfsId,
          item.title,
          item.tfsId,
          artifacts.requirement,
          artifacts.selectedRepos,
          syncOptions,
          artifacts.docs
        );
        if (result.success && result.taskId) {
          planSynced = true;
          planTaskId = result.taskId;
        } else {
          errorMessage = result.error ?? "计划子任务同步失败";
        }
      }

      const success = analysisSynced || planSynced;

      setTfsSyncState(item.tfsId, {
        analysisSynced,
        analysisTaskId,
        planSynced,
        planTaskId,
        lastSyncedAt: success ? new Date().toISOString() : baseStatus?.lastSyncedAt,
        isSyncing: false,
        syncStartedAt: undefined,
        error: success ? undefined : errorMessage ?? "同步失败，请检查 TFS 配置和网络连接",
      });

      if (success) {
        void checkAndRefreshTfsSyncStatus(item);
      }
    } catch (error) {
      setTfsSyncState(item.tfsId, {
        ...baseStatus,
        isSyncing: false,
        syncStartedAt: undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }


  /**
   * 获取 TFS 同步状态
   * @param tfsId TFS 工作项 ID
   */
  function getTfsSyncStatus(tfsId: number): TfsSyncStatus | undefined {
    const current = tfsSyncState[tfsId];
    if (!current) return undefined;
    const normalized = normalizeTfsSyncStatus(current);
    const shouldPersist =
      (current.isSyncing && (!current.syncStartedAt || Date.now() - current.syncStartedAt > SYNC_STALE_MS)) ||
      (!current.isSyncing && current.syncStartedAt);
    if (shouldPersist) {
      setTfsSyncState(tfsId, normalized);
    }
    return normalized;
  }

  /**
   * 检查并刷新 TFS 同步状态
   * @param item TaskCenterItem
   */
  async function checkAndRefreshTfsSyncStatus(item: TaskCenterItem): Promise<void> {
    try {
      const tfsConfig = getTfsConfig();
      if (!tfsConfig) return;

      const client = new TFSClient(tfsConfig);
      const status = await checkSyncStatus(client, item.tfsId, item.project);
      
      const current = tfsSyncState[item.tfsId];
      setTfsSyncState(item.tfsId, {
        ...current,
        ...status,
        // 不要覆盖 isSyncing 状态，让调用者控制
        isSyncing: current?.isSyncing ?? false,
      });
    } catch (error) {
      console.warn('[TaskCenter] Failed to check TFS sync status:', error);
    }
  }



  // Task execution functions
  const selectItem = (item: TaskCenterItem | null) => {
    setSelectedItem(item);
    if (item) {
      loadTasks(item);
    } else {
      setTasks([]);
      setCurrentTaskIndex(-1);
    }
  };

  const loadTasks = async (item: TaskCenterItem) => {
    const directory = options.activeWorkspaceRoot().trim();
    if (!directory) return;

    // Check all possible paths - generatePlan uses tfs-{id} directly
    const trackPaths = [
      `forge/tracks/tfs-${item.tfsId}/tasks.md`,                    // generatePlan 生成的路径
      `forge/tracks/task-center-requirement-analyzer/tfs-${item.tfsId}/tasks.md`,
      `forge/tracks/workitem-autorun/tfs-${item.tfsId}/tasks.md`,
    ];

    try {
      // Try to read tasks.md from all possible paths using fsReadFile
      let output: string | null = null;
      
      for (const tasksPath of trackPaths) {
        try {
          const result = await fsReadFile(tasksPath, directory);
          if (result.content && result.content.length > 0) {
            output = result.content;
            console.log(`[TaskCenter] Loaded tasks from ${tasksPath}`);
            break; // Found valid tasks file
          }
        } catch (err) {
          // Path doesn't exist, try next
          continue;
        }
      }

      if (output) {
        const parsed = parseTasks(output);
        setTasks(parsed);
        const nextIndex = parsed.findIndex(t => t.status === "pending" || t.status === "in-progress");
        setCurrentTaskIndex(nextIndex >= 0 ? nextIndex : 0);
      } else {
        console.warn("[TaskCenter] No tasks.md found for item", item.tfsId);
        setTasks([]);
      }
    } catch (err) {
      console.warn("Failed to load tasks:", err);
      setTasks([]);
    }
  };

  const executeTaskStep = async (item: TaskCenterItem, taskIndex: number) => {
    const activeClient = options.client();
    if (!activeClient || executing()) return;

    const directory = options.activeWorkspaceRoot().trim();
    // Try to find tasks.md in possible locations
    const possiblePaths = [
      `forge/tracks/tfs-${item.tfsId}/tasks.md`,
      `forge/tracks/task-center-requirement-analyzer/tfs-${item.tfsId}/tasks.md`,
      `forge/tracks/workitem-autorun/tfs-${item.tfsId}/tasks.md`,
    ];
    let tasksPath = possiblePaths[0]; // default

    setExecuting(true);
    
    try {
      const sessionApi = activeClient.session as typeof activeClient.session & {
        shellAsync: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
        shell?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
      };

      // Create session for file operations
      const result = await sessionApi.create({ directory: directory || undefined });
      const session = unwrap(result) as { id: string };
      const sessionID = session.id;

      // Find the correct tasks.md path
      for (const path of possiblePaths) {
        try {
          const checkResult = await sessionApi.shellAsync({
            sessionID,
            command: `test -f ${path} && echo "exists"`,
            agent: "openwork",
            directory: directory || undefined,
          });
          const output = extractOutput(checkResult);
          if (output?.includes("exists")) {
            tasksPath = path;
            console.log(`[TaskCenter] Found tasks.md at: ${tasksPath}`);
            break;
          }
        } catch {
          // Path doesn't exist, try next
          continue;
        }
      }

      // Read current tasks.md
      const readInput = {
        sessionID,
        command: `cat ${tasksPath}`,
        agent: "openwork",
        directory: directory || undefined,
      };

      const readResult = sessionApi.shellAsync
        ? await sessionApi.shellAsync(readInput)
        : sessionApi.shell
          ? await sessionApi.shell(readInput)
          : null;

      if (!readResult) {
        throw new Error("Cannot read tasks.md");
      }

      const content = extractOutput(readResult);
      if (!content) {
        throw new Error("Tasks.md is empty");
      }

      // Update task status to in-progress
      const updated = updateTaskStatus(content, taskIndex, "in-progress");
      
      // Write back
      const writeInput = {
        sessionID,
        command: `cat > ${tasksPath} << 'EOF'
${updated}
EOF`,
        agent: "openwork",
        directory: directory || undefined,
      };

      await sessionApi.shellAsync?.(writeInput) ?? sessionApi.shell?.(writeInput);

      // Update local state
      setTasks(prev => prev.map((t, i) => i === taskIndex ? { ...t, status: "in-progress" } : t));
      setCurrentTaskIndex(taskIndex);

      // Update automation state
      setAutomationState(item.tfsId, {
        status: "progress",
        stage: getStageForTask(taskIndex),
        subStage: `task-${taskIndex}`,
        sessionId: sessionID,
        blockedReason: null,
        updatedAt: Date.now(),
      });

      // Create OpenCode session for task execution
      const task = tasks()[taskIndex];
      if (task) {
        const prompt = `执行任务 ${taskIndex + 1}：${task.title}\n\n工作项: #${item.tfsId}\n\n${task.description}`;
        options.setPrompt(prompt);
        options.createSessionAndOpen();
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Task execution failed.";
      setError(message);
      console.error("Execute task step error:", error);
    } finally {
      setExecuting(false);
    }
  };

  const completeTaskStep = async (item: TaskCenterItem, taskIndex: number) => {
    const activeClient = options.client();
    if (!activeClient || executing()) return;

    const directory = options.activeWorkspaceRoot().trim();
    const tasksPath = `forge/tracks/workitem-autorun/tfs-${item.tfsId}/tasks.md`;

    setExecuting(true);

    try {
      const sessionApi = activeClient.session as typeof activeClient.session & {
        shellAsync?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
        shell?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
      };

      const result = await sessionApi.create({ directory: directory || undefined });
      const session = unwrap(result);
      const sessionID = session.id;

      // Read current tasks.md
      const readInput = {
        sessionID,
        command: `cat ${tasksPath}`,
        agent: "openwork",
        directory: directory || undefined,
      };

      const readResult = sessionApi.shellAsync
        ? await sessionApi.shellAsync(readInput)
        : sessionApi.shell
          ? await sessionApi.shell(readInput)
          : null;

      if (!readResult) {
        throw new Error("Cannot read tasks.md");
      }

      const content = extractOutput(readResult);
      if (!content) {
        throw new Error("Tasks.md is empty");
      }

      // Mark current task as completed
      const updated = updateTaskStatus(content, taskIndex, "completed");

      // Write back
      const writeInput = {
        sessionID,
        command: `cat > ${tasksPath} << 'EOF'
${updated}
EOF`,
        agent: "openwork",
        directory: directory || undefined,
      };

      await sessionApi.shellAsync?.(writeInput) ?? sessionApi.shell?.(writeInput);

      // Update local state
      setTasks(prev => prev.map((t, i) => i === taskIndex ? { ...t, status: "completed" } : t));

      // Check if all tasks completed
      const allTasks = tasks().map((t, i) => i === taskIndex ? { ...t, status: "completed" as const } : t);
      const allCompleted = allTasks.every(t => t.status === "completed");

      if (allCompleted) {
        setAutomationState(item.tfsId, {
          status: "done",
          stage: "reviewing",
          subStage: null,
          sessionId: null,
          blockedReason: null,
          updatedAt: Date.now(),
        });
      } else {
        // Move to next task
        const nextIndex = allTasks.findIndex(t => t.status === "pending");
        if (nextIndex >= 0) {
          setCurrentTaskIndex(nextIndex);
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Complete task step failed.";
      setError(message);
      console.error("Complete task step error:", error);
    } finally {
      setExecuting(false);
    }
  };

  const getStageForTask = (taskIndex: number): TaskCenterStage => {
    // Map task index to stage based on typical workflow
    if (taskIndex === 0) return "analyzing";
    if (taskIndex === 1) return "designing";
    if (taskIndex === 2) return "planning";
    return "implementing";
  };

  return {
    items,
    setItems,
    status,
    error,
    lastUpdatedAt,
    syncing,
    ui: ui ?? { search: "" },
    setUi,
    setSearch,
    filteredItems,
    itemsByStatus,
    syncTasks,
    startAutomation,
    setSyncSessionId,
    syncSessionId,
    automationState,
    setAutomationState,
    clearAutomationState,
    autoAnalysisMap,
    queueStatus,
    refreshAnalysisStatus,
    reanalyzeWorkItem,
    // TFS Configuration
    tfsConfig: tfsConfigState,
    setTfsConfig,
    loadTfsConfigFromFile,
    saveTfsConfigToFile,
    TFS_CONFIG_PATH,
    // Task execution
    selectedItem,
    selectItem,
    tasks,
    currentTaskIndex,
    executing,
    executeTaskStep,
    completeTaskStep,
    loadTasks,
    showTaskPanel,
    setShowTaskPanel,
    // Requirement Analysis Wizard
    wizard,
    wizardActions,
    // Embedded Automation Engine - 内嵌式自动化引擎
    engineState,
    enginePhase,
    engineProgress,
    engineLogs,
    engineError,
    engineContext,
    startEmbeddedAutomation,
    pauseEmbeddedAutomation,
    resumeEmbeddedAutomation,
    cancelEmbeddedAutomation,
    initializeAutomationEngine,
    // TFS 子任务同步
    tfsSyncState,
    getTfsSyncStatus,
    syncAnalysisToTFS,
    syncPlanToTFS,
    syncAllToTFS,
    checkAndRefreshTfsSyncStatus,
  };
}
