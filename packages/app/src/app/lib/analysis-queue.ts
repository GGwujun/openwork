import type { AnalysisPriority, AnalysisQueueItem, AnalysisQueueStatus, AnalysisResult } from "../../types/requirement-analyzer";
import type { TFSClient } from "../../api/tfs";
import { createAnalysisTask, type SyncOptions, type TfsSyncStatus } from "./sync-task-to-tfs";

export type { AnalysisPriority, AnalysisQueueItem, AnalysisQueueStatus };

export type AnalysisQueueSubscriber = (status: AnalysisQueueStatus) => void;
export type AnalysisProcessor = (workItemId: number) => Promise<AnalysisResult>;

export type AnalysisQueueSyncContext = {
  tfsClient: TFSClient;
  parentId: number;
  parentTitle: string;
  options: SyncOptions;
};

export type AnalysisQueuePendingEntry = {
  workItemId: number;
  status: string;
  timestamp: number;
  startedAt?: number;
};

export type AnalysisQueueConfig = {
  processor: AnalysisProcessor;
  getSyncContext?: (workItemId: number, result: AnalysisResult) => AnalysisQueueSyncContext | null;
  onSyncStatus?: (workItemId: number, status: TfsSyncStatus) => void;
  getSyncStatus?: (workItemId: number) => TfsSyncStatus | null;
  getPendingEntries?: () => Promise<AnalysisQueuePendingEntry[]>;
  maxAttempts?: number;
};

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;

const priorityWeight: Record<AnalysisPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class AnalysisQueueSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisQueueSyncError";
  }
}

const normalizeSyncErrorMessage = (message: string) => {
  if (/429|rate limit|too many/i.test(message)) {
    return "TFS 请求过于频繁，请稍后重试";
  }
  return message;
};

/**
 * Serial analysis queue with retry + optional TFS sync.
 */
export class AnalysisQueue {
  private static instance: AnalysisQueue | null = null;

  static getInstance() {
    if (!AnalysisQueue.instance) {
      AnalysisQueue.instance = new AnalysisQueue();
    }
    return AnalysisQueue.instance;
  }

  private queue: AnalysisQueueItem[] = [];
  private processing = false;
  private currentItem: AnalysisQueueItem | null = null;
  private subscribers = new Set<AnalysisQueueSubscriber>();
  private processor: AnalysisProcessor | null = null;
  private maxAttempts = MAX_ATTEMPTS;
  private cachedResults = new Map<number, AnalysisResult>();
  private getSyncContext?: AnalysisQueueConfig["getSyncContext"];
  private onSyncStatus?: AnalysisQueueConfig["onSyncStatus"];
  private getSyncStatus?: AnalysisQueueConfig["getSyncStatus"];
  private getPendingEntries?: AnalysisQueueConfig["getPendingEntries"];

  configure(config: Partial<AnalysisQueueConfig>) {
    if (config.processor) {
      this.processor = config.processor;
    }
    if (config.getSyncContext) {
      this.getSyncContext = config.getSyncContext;
    }
    if (config.onSyncStatus) {
      this.onSyncStatus = config.onSyncStatus;
    }
    if (config.getSyncStatus) {
      this.getSyncStatus = config.getSyncStatus;
    }
    if (config.getPendingEntries) {
      this.getPendingEntries = config.getPendingEntries;
    }
    if (config.maxAttempts) {
      this.maxAttempts = Math.max(1, config.maxAttempts);
    }
  }

  setProcessor(processor: AnalysisProcessor) {
    this.processor = processor;
  }

  enqueue(workItemId: number, priority: AnalysisPriority = "normal") {
    const existing = this.queue.find((item) => item.workItemId === workItemId);
    if (existing) {
      existing.priority = priority;
      this.sortQueue();
      this.notifySubscribers();
      return;
    }

    this.queue.push({
      workItemId,
      priority,
      attempts: 0,
      enqueuedAt: Date.now(),
    });
    this.sortQueue();
    this.notifySubscribers();
    void Promise.resolve().then(() => this.processQueue());
  }

  subscribe(callback: AnalysisQueueSubscriber) {
    this.subscribers.add(callback);
    callback(this.getStatus());
    return () => this.subscribers.delete(callback);
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) continue;
      this.currentItem = next;
      this.notifySubscribers();
      await this.processItem(next);
    }

    this.currentItem = null;
    this.processing = false;
    this.notifySubscribers();
  }

  private async processItem(item: AnalysisQueueItem) {
    // Check if already synced to TFS before processing
    const baseStatus = this.getSyncStatus?.(item.workItemId) ?? {
      analysisSynced: false,
      planSynced: false,
    };
    
    // 只有当分析和计划都同步完成时，才跳过（与 task-center 保持一致）
    const isFullySynced = baseStatus.analysisSynced && baseStatus.planSynced;
    if (isFullySynced) {
      console.log(`[AnalysisQueue] Skipping #${item.workItemId} - fully synced to TFS`);
      return;
    }

    while (item.attempts < this.maxAttempts) {
      try {
        if (!this.processor) {
          throw new Error("AnalysisQueue processor not configured");
        }
        const cached = this.cachedResults.get(item.workItemId);
        const result = cached ?? (await this.processor(item.workItemId));
        if (!cached) {
          this.cachedResults.set(item.workItemId, result);
        }
        await this.syncToTfs(item.workItemId, result);
        this.cachedResults.delete(item.workItemId);
        return;
      } catch (error) {
        item.attempts += 1;
        item.lastError = error instanceof Error ? error.message : String(error);
        this.notifySubscribers();

        if (!(error instanceof AnalysisQueueSyncError)) {
          this.cachedResults.delete(item.workItemId);
        }

        if (item.attempts >= this.maxAttempts) {
          console.warn("[AnalysisQueue] Item failed after retries", item);
          return;
        }

        const backoff = BASE_RETRY_DELAY_MS * Math.pow(2, item.attempts - 1);
        await delay(backoff);
      }
    }
  }

  private sortQueue() {
    this.queue.sort((a, b) => {
      const priorityDelta = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return a.enqueuedAt - b.enqueuedAt;
    });
  }

  private notifySubscribers() {
    const status = this.getStatus();
    for (const subscriber of this.subscribers) {
      subscriber(status);
    }
  }

  private getStatus(): AnalysisQueueStatus {
    return {
      queueLength: this.queue.length,
      isProcessing: this.processing,
      currentWorkItemId: this.currentItem?.workItemId,
      estimatedTimeRemaining: undefined,
    };
  }

  async restoreQueue(options?: { maxStuckMinutes?: number }) {
    if (!this.getPendingEntries) return [];
    const pending = await this.getPendingEntries();
    const restored: AnalysisQueueItem[] = [];
    const now = Date.now();
    const stuckAfterMs = (options?.maxStuckMinutes ?? 30) * 60 * 1000;

    for (const entry of pending) {
      // Check if already synced to TFS before restoring
      const syncStatus = this.getSyncStatus?.(entry.workItemId) ?? {
        analysisSynced: false,
        planSynced: false,
      };
      
      // 只有当分析和计划都同步完成时，才跳过恢复（与 task-center 保持一致）
      const isFullySynced = syncStatus.analysisSynced && syncStatus.planSynced;
      
      if (isFullySynced) {
        console.log(`[AnalysisQueue] Skip restoring #${entry.workItemId} - fully synced to TFS`);
        continue;
      }

      const isProcessing = this.currentItem?.workItemId === entry.workItemId;
      const isQueued = this.queue.some((item) => item.workItemId === entry.workItemId);
      if (isProcessing || isQueued) continue;
      const startedAt = entry.startedAt ?? entry.timestamp;
      const isStuck = entry.status === "analyzing" && Number.isFinite(startedAt) && now - startedAt > stuckAfterMs;
      const priority: AnalysisPriority = entry.status === "failed" || isStuck ? "high" : "normal";

      this.enqueue(entry.workItemId, priority);
      restored.push({
        workItemId: entry.workItemId,
        priority,
        attempts: 0,
        enqueuedAt: Date.now(),
      });
    }

    return restored;
  }

  private async syncToTfs(workItemId: number, result: AnalysisResult) {
    const context = this.getSyncContext?.(workItemId, result) ?? null;
    if (!context) return;

    const baseStatus: TfsSyncStatus = this.getSyncStatus?.(workItemId) ?? {
      analysisSynced: false,
      planSynced: false,
    };

    this.onSyncStatus?.(workItemId, {
      ...baseStatus,
      isSyncing: true,
      error: undefined,
    });

    let syncResult: { success: boolean; taskId?: number; error?: string };
    try {
      syncResult = await createAnalysisTask(
        context.tfsClient,
        context.parentId,
        context.parentTitle,
        result.requirement,
        result.detection,
        context.options
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const normalized = normalizeSyncErrorMessage(message);
      console.warn("[AnalysisQueue] TFS sync failed", { workItemId, message: normalized });
      this.onSyncStatus?.(workItemId, {
        ...baseStatus,
        analysisSynced: false,
        isSyncing: false,
        error: normalized,
      });
      throw new AnalysisQueueSyncError(normalized);
    }

    if (!syncResult.success) {
      const message = normalizeSyncErrorMessage(syncResult.error || "TFS sync failed");
      console.warn("[AnalysisQueue] TFS sync failed", { workItemId, message });
      this.onSyncStatus?.(workItemId, {
        ...baseStatus,
        analysisSynced: false,
        isSyncing: false,
        error: message,
      });
      throw new AnalysisQueueSyncError(message);
    }

    console.log("[AnalysisQueue] TFS sync complete", { workItemId, taskId: syncResult.taskId });

    this.onSyncStatus?.(workItemId, {
      ...baseStatus,
      analysisSynced: true,
      analysisTaskId: syncResult.taskId,
      lastSyncedAt: new Date().toISOString(),
      isSyncing: false,
      error: undefined,
    });
  }
}

export default AnalysisQueue;
