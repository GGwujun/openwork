import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";

import { createTaskCenterStore } from "../task-center";
import { RequirementAnalyzer } from "../../../api/requirement-analyzer";
import { TFSClient } from "../../../api/tfs";
import { AnalysisCache } from "../../lib/analysis-cache";
import { createAnalysisCacheAdapter, createTaskCenterArtifactStore } from "../../lib/task-center-artifacts";
import { AutoAnalyzer } from "../../lib/auto-analyzer";
import { AnalysisQueue } from "../../lib/analysis-queue";
import * as tfsSync from "../../lib/sync-task-to-tfs";
import { setAutoAnalysisConfig } from "../../../types/config";

const storageBuckets = new Map<string, Map<string, string>>();
const getBucket = (name = "default") => {
  const existing = storageBuckets.get(name);
  if (existing) return existing;
  const bucket = new Map<string, string>();
  storageBuckets.set(name, bucket);
  return bucket;
};

vi.mock("../platform", () => ({
  usePlatform: () => ({
    platform: "desktop",
    storage: (name?: string) => ({
      getItem: (key: string) => getBucket(name).get(key) ?? null,
      setItem: (key: string, value: string) => {
        getBucket(name).set(key, value);
      },
      removeItem: (key: string) => {
        getBucket(name).delete(key);
      },
    }),
    openLink: () => undefined,
    restart: async () => undefined,
    notify: async () => undefined,
  }),
}));

vi.mock("../../utils/persist", () => ({
  Persist: {
    global: (key: string, legacy?: string[]) => ({ key, legacy }),
    workspace: (dir: string, key: string, legacy?: string[]) => ({ storage: dir, key, legacy }),
    session: (dir: string, session: string, key: string, legacy?: string[]) => ({ storage: dir, key, legacy }),
    scoped: (dir: string, session: string | undefined, key: string, legacy?: string[]) =>
      session ? { storage: dir, key: `session:${session}:${key}`, legacy } : { storage: dir, key, legacy },
  },
  persisted: <T,>(_: unknown, store: [T, (value: T) => void]) => [store[0], store[1], null, () => true],
  removePersisted: () => undefined,
}));

vi.mock("../../lib/sync-task-to-tfs", () => ({
  createAnalysisTask: vi.fn().mockResolvedValue({ success: true, taskId: 456 }),
  createPlanTask: vi.fn().mockResolvedValue({ success: true, taskId: 789 }),
  checkSyncStatus: vi.fn().mockResolvedValue({ exists: false }),
}));

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

const tfsConfig = {
  serverUrl: "http://tfs.local",
  pat: "token",
  username: "user",
};

const createStore = () =>
  createRoot(() =>
    createTaskCenterStore({
      client: () => null,
      getSelectedModel: () => null,
      activeWorkspaceRoot: () => "workspace",
      createSessionAndOpen: () => undefined,
      setPrompt: () => undefined,
      tfsConfig: () => tfsConfig,
    })
  );

const waitForStatus = (predicate: () => boolean, timeoutMs = 2000) =>
  new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for status"));
      }
    }, 10);
  });

describe("task-center integration", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(AnalysisQueue, "getInstance").mockReturnValue(new AnalysisQueue());
    storageBuckets.clear();
    const artifactsStore = createTaskCenterArtifactStore("workspace");
    const artifacts = await artifactsStore.list();
    await Promise.all(artifacts.map((entry) => artifactsStore.remove(entry.tfsId)));
    AnalysisCache.configure({ adapter: createAnalysisCacheAdapter(artifactsStore) });
    setAutoAnalysisConfig({ enabled: true, autoSyncToTfs: false, maxRetries: 1 });
  });

  it("returns undefined when no TFS sync status is recorded", () => {
    const store = createStore();

    expect(store.getTfsSyncStatus?.(123)).toBeUndefined();
  });

  it("reuses cached analysis in wizard", async () => {
    const workItemId = 12345;
    const requirement = createRequirement(workItemId);
    await AnalysisCache.set(workItemId, { requirement }, { status: "completed", timestamp: Date.now() });

    const analyzeSpy = vi.spyOn(RequirementAnalyzer.prototype, "analyze");
    const store = createStore();

    await store.wizardActions.analyzeRequirement(workItemId);

    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(store.wizard.requirement?.workItemId).toBe(workItemId);
  });

  it("syncTasks triggers auto analysis", async () => {
    const workItemId = 1;
    const requirement = createRequirement(workItemId);
    const detection = createDetection();

    vi.spyOn(AutoAnalyzer, "analyze").mockResolvedValue({
      workItemId,
      requirement,
      detection,
      duration: 5,
    });

    vi.spyOn(TFSClient.prototype, "getMyWorkItems").mockResolvedValue([
      {
        id: workItemId,
        title: "Test item",
        state: "已分析",
        description: "",
        project: "Demo",
        workItemType: "Task",
        priority: 2,
        assignedTo: "User",
        tags: [],
        url: "",
        changedDate: new Date().toISOString(),
      } as any,
    ]);

    vi.spyOn(TFSClient.prototype, "getChildTasks").mockResolvedValue([] as any);

    const store = createStore();
    await store.syncTasks({ force: true });

    await waitForStatus(() => store.autoAnalysisMap[workItemId]?.status === "completed");

    expect(AutoAnalyzer.analyze).toHaveBeenCalledWith(workItemId);
    expect(store.autoAnalysisMap[workItemId]?.status).toBe("completed");
  });

  it("syncTasks creates analysis subtask when auto sync enabled", async () => {
    setAutoAnalysisConfig({ enabled: true, autoSyncToTfs: true, maxRetries: 1 });
    const workItemId = 2;
    const requirement = createRequirement(workItemId);
    const detection = createDetection();

    vi.spyOn(AutoAnalyzer, "analyze").mockResolvedValue({
      workItemId,
      requirement,
      detection,
      duration: 5,
    });

    vi.spyOn(TFSClient.prototype, "getMyWorkItems").mockResolvedValue([
      {
        id: workItemId,
        title: "Test item",
        state: "已分析",
        description: "",
        project: "Demo",
        workItemType: "Task",
        priority: 2,
        assignedTo: "User",
        tags: [],
        url: "",
        changedDate: new Date().toISOString(),
      } as any,
    ]);

    vi.spyOn(TFSClient.prototype, "getChildTasks").mockResolvedValue([] as any);

    const createAnalysisTaskSpy = vi
      .spyOn(tfsSync, "createAnalysisTask")
      .mockResolvedValue({ success: true, taskId: 456 });

    const store = createStore();
    await store.syncTasks({ force: true });

    await waitForStatus(() => store.tfsSyncState[workItemId]?.analysisSynced === true);

    expect(createAnalysisTaskSpy).toHaveBeenCalled();
    expect(store.tfsSyncState[workItemId]?.analysisTaskId).toBe(456);
  });

  it("recovers from analysis errors when reanalyzed", async () => {
    setAutoAnalysisConfig({ enabled: true, autoSyncToTfs: false, maxRetries: 1 });
    const workItemId = 3;
    const requirement = createRequirement(workItemId);
    const detection = createDetection();
    const analyzeSpy = vi
      .spyOn(AutoAnalyzer, "analyze")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({
        workItemId,
        requirement,
        detection,
        duration: 5,
      });

    vi.spyOn(TFSClient.prototype, "getMyWorkItems").mockResolvedValue([
      {
        id: workItemId,
        title: "Test item",
        state: "已分析",
        description: "",
        project: "Demo",
        workItemType: "Task",
        priority: 2,
        assignedTo: "User",
        tags: [],
        url: "",
        changedDate: new Date().toISOString(),
      } as any,
    ]);

    vi.spyOn(TFSClient.prototype, "getChildTasks").mockResolvedValue([] as any);

    const store = createStore();
    await store.syncTasks({ force: true });

    await waitForStatus(() => store.autoAnalysisMap[workItemId]?.status === "failed");

    const item = store.items().find((entry) => entry.tfsId === workItemId);
    if (!item) throw new Error("Missing work item");

    await store.reanalyzeWorkItem(item);
    await waitForStatus(() => store.autoAnalysisMap[workItemId]?.status === "completed");

    expect(analyzeSpy).toHaveBeenCalledTimes(2);
    expect(store.autoAnalysisMap[workItemId]?.status).toBe("completed");
  });

  it("surfaces network errors when syncing tasks", async () => {
    const store = createStore();

    vi.spyOn(TFSClient.prototype, "getMyWorkItems").mockRejectedValue(new Error("Failed to fetch"));

    await store.syncTasks({ force: true });

    expect(store.status()).toBe("error");
    expect(store.error()).toContain("网络");
  });

  it("marks deleted work items as failed", async () => {
    const workItemId = 404;

    vi.spyOn(AutoAnalyzer, "analyze").mockRejectedValue(new Error("Work item 404 not found or invalid"));
    vi.spyOn(TFSClient.prototype, "getMyWorkItems").mockResolvedValue([
      {
        id: workItemId,
        title: "Missing item",
        state: "已分析",
        description: "",
        project: "Demo",
        workItemType: "Task",
        priority: 2,
        assignedTo: "User",
        tags: [],
        url: "",
        changedDate: new Date().toISOString(),
      } as any,
    ]);
    vi.spyOn(TFSClient.prototype, "getChildTasks").mockResolvedValue([] as any);

    const store = createStore();
    await store.syncTasks({ force: true });

    await waitForStatus(() => store.autoAnalysisMap[workItemId]?.status === "failed");

    expect(store.autoAnalysisMap[workItemId]?.error).toContain("工作项不存在");
  });

  it("surfaces AI format errors", async () => {
    const workItemId = 5;

    vi.spyOn(AutoAnalyzer, "analyze").mockRejectedValue(new Error("AI 分析结果格式错误: invalid json"));
    vi.spyOn(TFSClient.prototype, "getMyWorkItems").mockResolvedValue([
      {
        id: workItemId,
        title: "Format error",
        state: "已分析",
        description: "",
        project: "Demo",
        workItemType: "Task",
        priority: 2,
        assignedTo: "User",
        tags: [],
        url: "",
        changedDate: new Date().toISOString(),
      } as any,
    ]);
    vi.spyOn(TFSClient.prototype, "getChildTasks").mockResolvedValue([] as any);

    const store = createStore();
    await store.syncTasks({ force: true });

    await waitForStatus(() => store.autoAnalysisMap[workItemId]?.status === "failed");

    expect(store.autoAnalysisMap[workItemId]?.error).toContain("AI 返回格式错误");
  });

  it("loads analysis cache with bounded concurrency", async () => {
    const store = createStore();
    const largeList = Array.from({ length: 120 }, (_, index) => ({
      id: `tfs-${index}`,
      tfsId: index,
      title: `Task ${index}`,
      status: "todo" as const,
      stage: "idle" as const,
      updatedAt: Date.now(),
    }));

    let active = 0;
    let maxActive = 0;
    const cacheSpy = vi.spyOn(AnalysisCache, "get").mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return null;
    });

    cacheSpy.mockClear();

    await store.refreshAnalysisStatus(largeList as any);

    expect(cacheSpy).toHaveBeenCalledTimes(120);
    expect(maxActive).toBeLessThanOrEqual(8);
    expect(maxActive).toBeGreaterThan(1);
  });
});
