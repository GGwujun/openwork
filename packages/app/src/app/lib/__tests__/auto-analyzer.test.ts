import { describe, expect, it, vi } from "vitest";

import { AutoAnalyzer } from "../auto-analyzer";
import type { RequirementAnalyzer } from "../../../api/requirement-analyzer";

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

describe("auto-analyzer", () => {
  it("returns analysis result with duration", async () => {
    const analyzer = {
      analyze: vi.fn().mockResolvedValue(createRequirement(42)),
      detectRepos: vi.fn().mockReturnValue(createDetection()),
    } as unknown as RequirementAnalyzer;

    AutoAnalyzer.configure({ getAnalyzer: () => analyzer });

    const result = await AutoAnalyzer.analyze(42);

    expect(analyzer.analyze).toHaveBeenCalledWith(42);
    expect(analyzer.detectRepos).toHaveBeenCalled();
    expect(result.workItemId).toBe(42);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("throws when analyzer fails", async () => {
    const analyzer = {
      analyze: vi.fn().mockRejectedValue(new Error("boom")),
      detectRepos: vi.fn(),
    } as unknown as RequirementAnalyzer;

    AutoAnalyzer.configure({ getAnalyzer: () => analyzer });

    await expect(AutoAnalyzer.analyze(1)).rejects.toThrow("AutoAnalyzer failed");
  });
});
