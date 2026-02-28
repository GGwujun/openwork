import type { ExecutionContext, ExecutionOptions } from "./types";

const yesNo = (value: boolean | undefined) => (value ? "是" : "否");

const mergeOptions = (
  base: ExecutionOptions | undefined,
  overrides: Partial<ExecutionOptions> | undefined,
): Required<Pick<ExecutionOptions, "includeForgeSkills" | "allowQuestions" | "requireVerification" | "requireArchive">> & ExecutionOptions => ({
  includeForgeSkills: base?.includeForgeSkills ?? true,
  allowQuestions: base?.allowQuestions ?? true,
  requireVerification: base?.requireVerification ?? false,
  requireArchive: base?.requireArchive ?? false,
  ...base,
  ...overrides,
});

const formatRepos = (context: ExecutionContext) => {
  const repos = context.selectedRepos ?? [];
  if (repos.length === 0) return "- 未提供";
  return repos
    .map((repo) => `- ${repo.name} (${repo.path})${repo.isPrimary ? " [primary]" : ""}`)
    .join("\n");
};

const formatPlanDocs = (context: ExecutionContext) => {
  const intent = context.planDocs.intent?.trim() || "(empty)";
  const design = context.planDocs.design?.trim() || "(empty)";
  const tasks = context.planDocs.tasks?.trim() || "(empty)";

  return [
    "## Plan Docs",
    "### intent.md",
    intent,
    "",
    "### design.md",
    design,
    "",
    "### tasks.md",
    tasks,
  ].join("\n");
};

const formatForgeGuidance = () => [
  "## Forge Workflow",
  "- 使用 forge-execute 作为执行入口",
  "- 先阅读 track 的 tasks.md，按顺序执行",
  "- 每完成一个任务，立刻更新 tasks.md 的 checkbox",
  "- 在工作区内执行命令，保持改动隔离",
  "- 阶段完成后总结进度并等待反馈",
].join("\n");

const formatReportingGuidance = () => [
  "## 进度报告",
  "- 每完成一个任务输出一行 [PROGRESS] done=<completed>/<total> task=<任务标题>",
  "- 统一格式示例: [PROGRESS] done=3/10 task=更新登录接口",
  "- 如遇阻塞或需要用户确认，输出 [QUESTION] <问题> 并等待用户回复",
  "- 除非被阻塞，请不要频繁提问；能继续执行就直接继续",
  "- 完成全部任务后输出 [DONE] 并汇总验证结果",
].join("\n");

export class ExecutionPromptBuilder {
  private context: ExecutionContext;

  constructor(context: ExecutionContext) {
    this.context = context;
  }

  build(overrides?: Partial<ExecutionOptions>): string {
    const options = mergeOptions(this.context.options, overrides);
    const parts: string[] = [];

    parts.push("你是 OpenWork 执行引擎，请按照计划执行任务。\n");
    parts.push("## Execution Context");
    parts.push(`- TFS: #${this.context.tfsId}${this.context.title ? ` ${this.context.title}` : ""}`);
    parts.push(`- Workspace: ${this.context.workspaceRoot}`);
    parts.push(`- Track: ${this.context.trackPath}`);
    parts.push("- Repositories:");
    parts.push(formatRepos(this.context));
    parts.push("");

    parts.push("## Execution Options");
    parts.push(`- 允许提问: ${yesNo(options.allowQuestions)}`);
    parts.push(`- 需要验证: ${yesNo(options.requireVerification)}`);
    parts.push(`- 需要归档: ${yesNo(options.requireArchive)}`);
    if (options.maxRetries != null) {
      parts.push(`- 最大重试次数: ${options.maxRetries}`);
    }
    if (options.model) {
      parts.push(`- 指定模型: ${options.model.providerID}/${options.model.modelID}`);
    }
    parts.push("");

    if (options.includeForgeSkills) {
      parts.push(formatForgeGuidance());
      parts.push("");
    }

    parts.push(formatReportingGuidance());
    parts.push("");

    parts.push(formatPlanDocs(this.context));

    return parts.join("\n");
  }
}
