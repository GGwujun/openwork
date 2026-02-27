# Task Center Automation Contract (workitem-autorun)

## Purpose
Define Task Center automation behavior for "已分析" work items and map Forge/openspec workflow progress into Task Center statuses and sub-stages.

## Requirements

### REQ-1: ToDo scope
- Task Center ToDo lists only work items whose TFS state is exactly "已分析".

### REQ-2: Progress with sub-stage
- Progress represents the active automation flow.
- Use `TaskCenterStage` for the main phase and `subStage` for implementing details.
- Implementing subStage values include: `workspace-prep`, `plan-exec`, `tests`, `fixes`, `ready-review`.

### REQ-3: Progress state (local only)
- When user clicks "生成计划" button, **do NOT update TFS state** (keep it as "已分析").
- Task Center `progress` status is a **local automation state**, independent of TFS state.
- Create Forge artifacts (intent.md, design.md, tasks.md) directly without TFS state change.

### REQ-3a: Done meaning
- Done indicates the implementation plan is complete and waiting for archive.
- Done is a local Task Center state; TFS state remains "已分析" (not updated).

### REQ-4: Blocked meaning
- Blocked represents an interrupted or divergent workflow.
- Blocked retains the last `stage` and `subStage` for diagnosis.
- Blocked is a local state; TFS state remains "已分析" (not updated).

### REQ-5: TFS 状态流转 (重要变更)
- **TFS 状态只在一处更新**：
  - **开发完成后**：从"已分析"更新为"已解决"（REQ-5a）
  - Task Center 的 Progress、Done、Blocked 都是本地状态，不改变 TFS 状态。
- TFS 查询始终只返回状态为"已分析"的工作项。

### REQ-5a: TFS resolution
- After development is complete (implementation done), update TFS state from "已分析" to "已解决".
- This is the **only** TFS state update performed by Task Center.
- Add a comment: "任务已完成，代码已提交 (via Task Center)".
### REQ-6: Forge artifacts
- Generate artifacts under `forge/tracks/workitem-autorun/`:
  - `intent.md`
  - `design.md`
  - `tasks.md`

### REQ-7: Sync merge
- Task Center sync must preserve local automation states even when TFS query returns only "已分析" items.

### REQ-8: UI 按钮显示规则（问题3）
- **ToDo 状态**: 显示"生成计划"按钮，点击后创建 intent.md + design.md + tasks.md
- **Progress 状态**: 显示"查看计划"按钮，打开 tasks.md 查看执行进度
- **Done 状态**: 显示"查看计划"按钮，查看已完成的执行结果
- **Blocked 状态**: 显示"查看计划"按钮，查看中断位置和错误信息
- **Archived 状态**: 显示"查看归档"按钮，查看最终归档输出

### REQ-9: 逐步执行任务（问题4）
- tasks.md 中的每个任务必须包含执行状态（待执行/执行中/已完成/失败）
- 每个待执行的任务显示"开始执行"按钮
- 任务完成后，自动显示下一个任务的"开始执行"按钮
- 用户可以查看计划文件了解当前执行位置和剩余步骤
- 执行状态实时同步到 UI

## Task Auto Analysis

### REQ-10: Auto analysis types
```typescript
interface TaskAutoAnalysisState {
  workItemId: number;
  status: 'pending' | 'analyzing' | 'analyzed' | 'failed';
  progress: number;
  requirement?: ParsedRequirement;
  detection?: DetectionResult;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  tfsSync: {
    analysisTaskCreated: boolean;
    analysisTaskId?: number;
    syncedAt?: string;
    error?: string;
  };
}

interface AnalysisResult {
  workItemId: number;
  title: string;
  project: string;
  assignedTo?: string;
  requirement: ParsedRequirement;
  detection: DetectionResult;
  timestamp: string;
  duration?: number;
}

interface AnalysisQueueStatus {
  isProcessing: boolean;
  queueLength: number;
  currentWorkItemId?: number;
  estimatedTimeRemaining?: number;
}

interface QueueItem {
  workItemId: number;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
}

interface CacheEntry {
  workItemId: number;
  timestamp: string;
  data: AnalysisResult;
}

interface AutoAnalysisConfig {
  enabled: boolean;
  autoAnalyzeOnSync: boolean;
  autoSyncToTfs: boolean;
  cacheExpiryHours: number;
  maxRetries: number;
}
```

### REQ-11: Auto analysis library APIs
```typescript
class AnalysisQueue {
  static getInstance(): AnalysisQueue
  enqueue(workItemId: number, priority?: 'high' | 'normal' | 'low'): void
  subscribe(callback: (status: AnalysisQueueStatus) => void): () => void
}

class AnalysisCache {
  static get(workItemId: number): Promise<CacheEntry | null>
  static set(workItemId: number, data: AnalysisResult): Promise<void>
  static isExpired(timestamp: string, hours: number): boolean
  static cleanExpired(maxAgeHours?: number): Promise<void>
  static getPending(): Promise<Array<{ workItemId: number; status: string }>>
}

class AutoAnalyzer {
  static async analyze(workItemId: number): Promise<AnalysisResult>
}
```
- Storage Path: `{workspaceRoot}/forge/tracks/tfs-{workItemId}/.analysis/cache.json`
- Analysis flow: fetch TFS item -> RequirementAnalyzer.analyzeWithAI -> detectReposWithAI -> return result.

### REQ-12: TaskCenterStore auto analysis extension
- State additions: `autoAnalysisMap`, `queueStatus`.
- Methods: `refreshAnalysisStatus(workItemId)`, `reanalyzeWorkItem(workItemId)`, `getTfsSyncStatus(workItemId): TfsSyncStatus | undefined`.
- `syncTasks()` behavior: after sync, initialize pending analysis states and enqueue items into `AnalysisQueue`.
- Wizard analyze: check memory cache -> check file cache -> if hit, jump to Step 2; else run original analysis.

### REQ-13: UI behaviors for auto analysis
- Task card shows `AnalysisStatusBadge` with `autoAnalysisState` and `tfsSyncStatus` and supports reanalyze action.
- Button states map to analysis status: 未分析/分析中/分析完成/计划已生成.
- Queue status indicator shows when `queueLength > 0` with current work item ID.
- Settings include: enable auto analysis, auto sync to TFS, cache expiry hours (1-168), max retries (1-5).

### REQ-14: Badge styling + animations
```css
.badge-blue { @apply bg-blue-100 text-blue-700; }
.badge-green { @apply bg-emerald-100 text-emerald-700; }
.badge-purple { @apply bg-purple-100 text-purple-700; }
.badge-red { @apply bg-red-100 text-red-700 cursor-pointer hover:bg-red-200; }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
```
