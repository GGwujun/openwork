import type { AnalysisResult } from "../../types/requirement-analyzer";
import { RequirementAnalyzer } from "../../api/requirement-analyzer";

export type AutoAnalyzerConfig = {
  getAnalyzer: () => RequirementAnalyzer;
};

/**
 * Auto analyzer wrapper around RequirementAnalyzer.
 */
export class AutoAnalyzer {
  private static config: AutoAnalyzerConfig | null = null;

  static configure(config: AutoAnalyzerConfig) {
    AutoAnalyzer.config = config;
  }

  static async analyze(workItemId: number): Promise<AnalysisResult> {
    const start = Date.now();
    const analyzer = AutoAnalyzer.config?.getAnalyzer();

    if (!analyzer) {
      throw new Error("AutoAnalyzer is not configured");
    }

    try {
      console.log("[AutoAnalyzer] analyze:start", { workItemId });
      const requirement = await analyzer.analyze(workItemId);
      const detection = analyzer.detectRepos(requirement);
      const duration = Date.now() - start;

      console.log("[AutoAnalyzer] analyze:complete", { workItemId, duration });

      return {
        workItemId,
        requirement,
        detection,
        duration,
        startedAt: start,
        completedAt: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[AutoAnalyzer] analyze:failed", { workItemId, message });
      throw new Error(`AutoAnalyzer failed: ${message}`);
    }
  }
}

export default AutoAnalyzer;
