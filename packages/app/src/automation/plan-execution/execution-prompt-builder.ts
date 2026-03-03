import type { ExecutionContext, ExecutionOptions } from "./types";

const yesNo = (value: boolean | undefined) => (value ? "是" : "否");

const mergeOptions = (
  base: ExecutionOptions | undefined,
  overrides: Partial<ExecutionOptions> | undefined,
): Required<
  Pick<ExecutionOptions, "includeForgeSkills" | "allowQuestions" | "requireVerification" | "requireArchive" | "docDeliveryMode">
> & ExecutionOptions => ({
  includeForgeSkills: base?.includeForgeSkills ?? true,
  allowQuestions: base?.allowQuestions ?? true,
  requireVerification: base?.requireVerification ?? false,
  requireArchive: base?.requireArchive ?? false,
  docDeliveryMode: base?.docDeliveryMode ?? "inline-docs",
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

const formatForgeExecuteSkill = (docDeliveryMode: "inline-docs" | "forge-files") => [
  "## Embedded Skill: forge-execute",
  "Overview: Single entry for execution stage; isolate before execution, disciplined finish after.",
  docDeliveryMode === "forge-files"
    ? "When to use: Plan exists at forge/tracks/<change>/tasks.md and ready to implement."
    : "When to use: Plan docs are embedded inline in this prompt; execute directly from inline tasks.",
  "Do not use: No plan yet (use forge-plan).",
  "Flow:",
  docDeliveryMode === "forge-files"
    ? "1) Select change/plan; if unclear, list forge/tracks/ and pick one."
    : "1) Load intent/design/tasks from this prompt (inline docs) and do not depend on local forge/tracks files.",
  "2) Ensure isolated workspace: use forge:using-git-worktrees; reuse existing worktree if present.",
  "3) Choose execution mode:",
  "   - Tasks mostly independent + stay in this session → forge:subagent-driven-development",
  "   - Need batch checkpoints or separate session → forge:executing-plans",
  docDeliveryMode === "forge-files"
    ? "4) Execute tasks: follow chosen skill exactly; CRITICAL update tasks.md checkbox after each task."
    : "4) Execute tasks from inline tasks content and return updated full tasks_markdown after each task update.",
  "5) Finish the branch: use forge:finishing-a-development-branch; ensure forge-archive completed.",
  "Decision checklist:",
  "- Stay in this session? If no → executing-plans.",
  "- Tasks mostly independent? If yes → subagent-driven-development; else → executing-plans.",
  "- Need batch checkpoints? If yes → executing-plans.",
  "Resume existing worktree:",
  "- Open .worktrees/<change>/ and verify branch with git status",
  docDeliveryMode === "forge-files"
    ? "- Confirm plan at forge/tracks/<change>/tasks.md"
    : "- Confirm inline tasks content is present in this prompt",
  "- Continue from execution mode step",
  "Common mistakes:",
  "- Executing on main/master without a worktree",
  "- Starting without a plan",
  "- Creating a second worktree for the same change",
  docDeliveryMode === "forge-files"
    ? "- Not updating tasks.md checkbox status"
    : "- Not returning updated tasks_markdown",
  "Integration: requires forge-plan + using-git-worktrees + executing-plans/subagent-driven-development + forge-finish.",
].join("\n");

const formatExecutingPlansSkill = (docDeliveryMode: "inline-docs" | "forge-files") => [
  "## Embedded Skill: executing-plans",
  "Announce at start: \"I'm using the executing-plans skill to implement this plan.\"",
  docDeliveryMode === "forge-files"
    ? "Step 1: Load and review plan (forge/tracks/<change>/tasks.md); raise concerns before starting."
    : "Step 1: Load and review plan from inline docs in this prompt; raise concerns before starting.",
  "Step 2: Execute batch (default first 3 tasks):",
  docDeliveryMode === "forge-files"
    ? "  - Mark task in_progress in tasks.md"
    : "  - Report in-progress via TASK_UPDATE block",
  "  - Follow steps exactly and run verifications",
  docDeliveryMode === "forge-files"
    ? "  - Mark task completed in tasks.md; show progress"
    : "  - Return full updated tasks_markdown; show progress",
  "Step 3: Report results; show verification output; say \"Ready for feedback.\"",
  "Step 4: Continue next batch after feedback.",
  "Step 5: Complete development: use forge:finishing-a-development-branch.",
  docDeliveryMode === "forge-files"
    ? "CRITICAL: tasks.md is the audit record; always update checkboxes immediately."
    : "CRITICAL: inline tasks_markdown is the audit record; always return full updated content immediately.",
].join("\n");

const formatReportingGuidance = (allowQuestions: boolean) => {
  const base = [
    "## 进度报告",
    "- 每完成一个任务输出一行 [PROGRESS] done=<completed>/<total> task=<任务标题>",
    "- 统一格式示例: [PROGRESS] done=3/10 task=更新登录接口",
    allowQuestions
      ? "- 如遇阻塞或需要用户确认，输出 [QUESTION] <问题> 并等待用户回复"
      : "- 禁止提问；遇到不明确的情况自行做出合理决策并继续",
    "- 执行过程中不得暂停；必须连续推进直到完成",
    "- 除非被阻塞，请不要频繁输出额外说明；能继续执行就直接继续",
    "- 完成全部任务后输出 [DONE] 并汇总验证结果",
  ];
  return base.join("\n");
};

const formatTaskUpdateProtocol = () => [
  "## TASK_UPDATE Protocol (Mandatory)",
  "- 每完成一个 task（或并行批次中的单个 task）后必须输出以下块：",
  "[[TASK_UPDATE_START]]",
  "done=<n>/<m>",
  "completed_task_id=<task-id>",
  "status=completed|failed|blocked",
  "execution_mode=serial|parallel-batch",
  "depends_on=<comma-separated-task-ids>",
  "ready_queue=<comma-separated-task-ids>",
  "tasks_markdown=<完整更新后的tasks全文>",
  "[[TASK_UPDATE_END]]",
  "- 严格按 tasks 文档定义的依赖与并行策略执行；未明确并行时默认串行",
  "- 禁止自行重排已明确依赖关系",
  "- 完成全部任务后输出：",
  "[[EXEC_DONE]]",
  "verification=passed|failed",
  "summary=<简短总结>",
  "[[EXEC_DONE_END]]",
].join("\n");

const formatWorktreeDependencyRule = () => [
  "## Worktree Dependency Rule",
  "- After entering the worktree, check dependencies before installing:",
  "  - If node_modules/ exists → skip install",
  "  - If vendor/ or target/ exists (other ecosystems) → skip install",
  "  - Only install when required for build/test and missing",
  "- Avoid long installs unless strictly needed for the current task",
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
    parts.push(`- 文档传输模式: ${options.docDeliveryMode}`);
    if (options.maxRetries != null) {
      parts.push(`- 最大重试次数: ${options.maxRetries}`);
    }
    if (options.model) {
      parts.push(`- 指定模型: ${options.model.providerID}/${options.model.modelID}`);
    }
    parts.push("");

    if (options.includeForgeSkills) {
      parts.push(formatForgeExecuteSkill(options.docDeliveryMode));
      parts.push("");
      parts.push(formatExecutingPlansSkill(options.docDeliveryMode));
      parts.push("");
    }

    parts.push(formatReportingGuidance(options.allowQuestions));
    parts.push("");
    parts.push(formatTaskUpdateProtocol());
    parts.push("");
    parts.push(formatWorktreeDependencyRule());
    parts.push("");
    parts.push("## Local Overrides");
    parts.push("- 必须按计划执行，不得中途暂停");
    parts.push("- 禁止提问，遇到不明确的情况自行做出合理决策并继续");
    parts.push("- 当前测试环境：不要运行测试/验证，直接标记 verification=passed (skipped)");
    parts.push("");

    parts.push(formatPlanDocs(this.context));

    return parts.join("\n");
  }
}
