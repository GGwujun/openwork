import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../sync-task-to-tfs", () => ({
  createAnalysisTask: vi.fn().mockResolvedValue({ success: true, taskId: 101 }),
}));

import { AnalysisQueue } from "../analysis-queue";
import { createAnalysisTask } from "../sync-task-to-tfs";

const createRequirement = (workItemId: number) => ({
  workItemId,
  title: `Task ${workItemId}`,
  description: "Test description",
  acceptanceCriteria: "Test acceptance",
  demandAnalysis: "Test analysis",
  summary: "Summary",
  keyFeatures: ["Feature"],
  techIndicators: { frontend: true, backend: false, database: false },
  domainKeywords: ["keyword"],
});

const createDetection = () => ({
  primary: [],
  secondary: [],
  confidence: 0.5,
});

const waitForQueue = (queue: AnalysisQueue) =>
  new Promise<void>((resolve) => {
    let unsubscribe = () => undefined;
    unsubscribe = queue.subscribe((status) => {
      if (!status.isProcessing && status.queueLength === 0) {
        unsubscribe();
        resolve();
      }
    });
  });

describe("analysis-queue", () => {
  const createAnalysisTaskMock = vi.mocked(createAnalysisTask);

  beforeEach(() => {
    vi.clearAllMocks();
    createAnalysisTaskMock.mockResolvedValue({ success: true, taskId: 101 });
  });

  it("processes high priority first", async () => {
    const queue = new AnalysisQueue();
    const order: number[] = [];

    queue.configure({
      processor: async (workItemId) => {
        order.push(workItemId);
        return {
          workItemId,
          requirement: createRequirement(workItemId),
          detection: createDetection(),
          duration: 1,
        };
      },
    });

    queue.enqueue(1, "normal");
    queue.enqueue(2, "high");

    await waitForQueue(queue);
    expect(order).toEqual([2, 1]);
  });

  it("retries failed items up to maxAttempts", async () => {
    vi.useFakeTimers();
    const queue = new AnalysisQueue();
    let attempts = 0;

    queue.configure({
      processor: async () => {
        attempts += 1;
        throw new Error("fail");
      },
      maxAttempts: 2,
    });

    queue.enqueue(1, "normal");

    await vi.runAllTimersAsync();
    await waitForQueue(queue);

    expect(attempts).toBe(2);
    vi.useRealTimers();
  });

  it("syncs analysis result to TFS when context provided", async () => {
    const queue = new AnalysisQueue();
    const syncStates: Array<{ analysisSynced?: boolean }> = [];

    queue.configure({
      processor: async (workItemId) => ({
        workItemId,
        requirement: createRequirement(workItemId),
        detection: createDetection(),
        duration: 1,
      }),
      getSyncContext: (workItemId) => ({
        tfsClient: {} as any,
        parentId: workItemId,
        parentTitle: "Test",
        options: {
          workspaceRoot: "workspace",
          project: "Demo",
        },
      }),
      onSyncStatus: (_id, status) => syncStates.push(status),
    });

    queue.enqueue(7, "normal");
    await waitForQueue(queue);

    expect(createAnalysisTask).toHaveBeenCalled();
    expect(syncStates.some((state) => state.analysisSynced)).toBe(true);
  });

  it("processes items serially", async () => {
    vi.useFakeTimers();
    const queue = new AnalysisQueue();
    let active = 0;
    let maxActive = 0;

    queue.configure({
      processor: async (workItemId) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return {
          workItemId,
          requirement: createRequirement(workItemId),
          detection: createDetection(),
          duration: 1,
        };
      },
    });

    queue.enqueue(10, "normal");
    queue.enqueue(11, "normal");

    await vi.runAllTimersAsync();
    await waitForQueue(queue);

    expect(maxActive).toBe(1);
    vi.useRealTimers();
  });

  it("retries TFS sync without rerunning analysis", async () => {
    vi.useFakeTimers();
    const queue = new AnalysisQueue();
    const processor = vi.fn(async (workItemId: number) => ({
      workItemId,
      requirement: createRequirement(workItemId),
      detection: createDetection(),
      duration: 1,
    }));

    createAnalysisTaskMock
      .mockResolvedValueOnce({ success: false, error: "TFS API error: 429" })
      .mockResolvedValueOnce({ success: true, taskId: 202 });

    queue.configure({
      processor,
      getSyncContext: (workItemId) => ({
        tfsClient: {} as any,
        parentId: workItemId,
        parentTitle: "Test",
        options: {
          workspaceRoot: "workspace",
          project: "Demo",
        },
      }),
    });

    queue.enqueue(8, "normal");

    await vi.runAllTimersAsync();
    await waitForQueue(queue);

    expect(processor).toHaveBeenCalledTimes(1);
    expect(createAnalysisTaskMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("clears cached results after completion", async () => {
    const queue = new AnalysisQueue();
    const processor = vi.fn(async (workItemId: number) => ({
      workItemId,
      requirement: createRequirement(workItemId),
      detection: createDetection(),
      duration: 1,
    }));

    queue.configure({ processor });

    queue.enqueue(99, "normal");
    await waitForQueue(queue);

    queue.enqueue(99, "normal");
    await waitForQueue(queue);

    expect(processor).toHaveBeenCalledTimes(2);
  });
});
