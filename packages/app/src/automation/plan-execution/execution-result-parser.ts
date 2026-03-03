import type { ExecutionMessage, ExecutionResult } from "./types";

const archivePathPattern = /forge\/archives\/\d{4}-\d{2}-\d{2}-tfs-\d+/i;
const commitHashPattern = /\b[0-9a-f]{7,40}\b/i;
const progressPattern = /\[PROGRESS\]\s*done=(\d+)\s*\/\s*(\d+)\s*task=([^\n]+)/i;
const progressAltPattern = /任务\s*(\d+)\s*\/\s*(\d+)\s*完成[:：]?\s*(.*)/i;
const taskUpdateDonePattern = /done\s*=\s*(\d+)\s*\/\s*(\d+)/i;
const errorPattern = /\[ERROR\]|执行失败|failed|error/i;

const extractLines = (messages: ExecutionMessage[]) =>
  messages.flatMap((message) => (message.content || "").split(/\r?\n/));

const findLastMatch = (lines: string[], predicate: (line: string) => boolean) => {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim();
    if (line && predicate(line)) return line;
  }
  return null;
};

const extractProgressStats = (messages: ExecutionMessage[]) => {
  let maxCurrent = 0;
  let maxTotal = 0;

  for (const message of messages) {
    const text = message.content || "";
    const match = text.match(progressPattern) ?? text.match(progressAltPattern);
    const taskUpdateMatch = text.match(taskUpdateDonePattern);
    if (!match && !taskUpdateMatch) continue;
    const current = Number.parseInt((match?.[1] ?? taskUpdateMatch?.[1] ?? "0"), 10);
    const total = Number.parseInt((match?.[2] ?? taskUpdateMatch?.[2] ?? "0"), 10);
    if (Number.isFinite(current)) maxCurrent = Math.max(maxCurrent, current);
    if (Number.isFinite(total)) maxTotal = Math.max(maxTotal, total);
  }

  return {
    totalTasks: maxTotal || undefined,
    completedTasks: maxCurrent || undefined,
  };
};

export class ExecutionResultParser {
  parse(messages: ExecutionMessage[]): ExecutionResult {
    const lines = extractLines(messages);
    const combined = lines.join("\n");
    const createdAtValues = messages
      .map((message) => message.createdAt)
      .filter((value) => Number.isFinite(value));
    const startedAt = createdAtValues.length ? Math.min(...createdAtValues) : undefined;
    const completedAt = createdAtValues.length ? Math.max(...createdAtValues) : undefined;
    const durationMs =
      startedAt != null && completedAt != null ? Math.max(0, completedAt - startedAt) : undefined;
    const progressStats = extractProgressStats(messages);

    const archiveMatch = combined.match(archivePathPattern);
    const doneLine = findLastMatch(lines, (line) => /\[DONE\]|\[\[EXEC_DONE\]\]|执行完成|完成全部任务/i.test(line));
    const verificationOk = /forge-verify|verification/i.test(combined) && /通过|success|ok|passed/i.test(combined);
    const commitLine = findLastMatch(lines, (line) => /commit|提交/i.test(line));
    const commitHash = commitLine?.match(commitHashPattern)?.[0] ?? combined.match(commitHashPattern)?.[0];
    const errorLine = findLastMatch(lines, (line) => errorPattern.test(line));
    const success = /\[DONE\]|\[\[EXEC_DONE\]\]|执行完成|完成全部任务/i.test(combined);
    const completedTasks =
      success && progressStats.totalTasks
        ? progressStats.totalTasks
        : progressStats.completedTasks;

    const fileLines = lines.filter((line) => /^[-*]\s+/.test(line));
    const files = fileLines
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter((value) => /\//.test(value) || /\.[a-z0-9]+$/i.test(value));

    return {
      success,
      status: success ? "completed" : "failed",
      message: doneLine ?? undefined,
      error: errorLine ?? undefined,
      startedAt,
      completedAt,
      durationMs,
      totalTasks: progressStats.totalTasks,
      completedTasks,
      archivePath: archiveMatch?.[0],
      verification: verificationOk ? { ok: true, summary: "forge-verify passed" } : undefined,
      commit: commitHash ? { hash: commitHash, message: commitLine ?? undefined } : undefined,
      files: files.length > 0 ? Array.from(new Set(files)) : undefined,
      messages,
    };
  }
}
