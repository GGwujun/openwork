import { describe, expect, it } from "vitest";

import { createAnalysisCache, createMemoryCacheAdapter } from "../analysis-cache";

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

describe("analysis-cache", () => {
  it("writes and reads cache entries", async () => {
    const adapter = createMemoryCacheAdapter();
    const cache = createAnalysisCache({ workspaceRoot: "workspace", adapter });

    await cache.set(12345, { requirement: createRequirement(12345), detection: createDetection() });
    const entry = await cache.get(12345);

    expect(entry).toBeTruthy();
    expect(entry?.data.requirement?.title).toBe("Task 12345");
  });

  it("detects expiry by timestamp", () => {
    const cache = createAnalysisCache({
      workspaceRoot: "workspace",
      adapter: createMemoryCacheAdapter(),
      now: () => 60 * 60 * 1000,
    });

    expect(cache.isExpired(0, 0.5)).toBe(true);
    expect(cache.isExpired(60 * 60 * 1000, 1)).toBe(false);
  });

  it("cleans expired entries", async () => {
    const adapter = createMemoryCacheAdapter();
    const cache = createAnalysisCache({
      workspaceRoot: "workspace",
      adapter,
      now: () => 10_000,
    });

    await cache.set(1, { requirement: createRequirement(1) }, { timestamp: 0, status: "failed" });
    await cache.set(2, { requirement: createRequirement(2) }, { timestamp: 9_000, status: "completed" });

    const cleaned = await cache.cleanExpired(0);
    expect(cleaned.map((entry) => entry.workItemId)).toEqual([1, 2]);
    expect(await cache.get(1)).toBeNull();
    expect(await cache.get(2)).toBeNull();
  });

  it("returns pending entries", async () => {
    const adapter = createMemoryCacheAdapter();
    const cache = createAnalysisCache({ workspaceRoot: "workspace", adapter });

    await cache.set(1, { requirement: createRequirement(1) }, { status: "pending", timestamp: 1 });
    await cache.set(2, { requirement: createRequirement(2) }, { status: "completed", timestamp: 2 });
    await cache.set(3, { requirement: createRequirement(3) }, { status: "failed", timestamp: 3 });

    const pending = await cache.getPending();
    expect(pending.map((entry) => entry.workItemId)).toEqual([1, 3]);
  });
});
