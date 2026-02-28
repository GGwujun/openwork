import type { ExecutionMessage, ExecutionProgress } from "./types";

const progressPattern = /\[PROGRESS\]\s*done=(\d+)\s*\/\s*(\d+)\s*task=([^\n]+)/i;
const progressAltPattern = /任务\s*(\d+)\s*\/\s*(\d+)\s*完成[:：]?\s*(.*)/i;
const questionPattern = /\[QUESTION\]\s*(.+)/i;
const donePattern = /\[DONE\]|执行完成|完成全部任务|execution complete/i;
const errorPattern = /\[ERROR\]|执行失败|failed|error/i;
const archivePattern = /(forge-archive|归档完成|archive complete)/i;
const archivePathPattern = /forge\/archives\/\d{4}-\d{2}-\d{2}-tfs-\d+/i;

const toNumber = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const calcPercent = (current?: number, total?: number) => {
  if (!current || !total || total <= 0) return undefined;
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
};

export type ArchiveDetection = {
  ok: boolean;
  path?: string;
};

export class ExecutionProgressMonitor {
  parseProgress(message: ExecutionMessage): ExecutionProgress | null {
    const text = message.content || "";
    const match = text.match(progressPattern) ?? text.match(progressAltPattern);
    if (!match) return null;
    const current = toNumber(match[1]);
    const total = toNumber(match[2]);
    const task = match[3]?.trim();
    const percent = calcPercent(current, total);

    return {
      status: "running",
      current,
      total,
      task,
      percent,
      message: task ? `完成 ${current}/${total}: ${task}` : undefined,
      updatedAt: Date.now(),
    };
  }

  parseQuestion(message: ExecutionMessage): string | null {
    const text = message.content || "";
    const match = text.match(questionPattern);
    if (match) return match[1].trim();
    if (/\?|请问|是否需要|确认/i.test(text)) return text.trim();
    return null;
  }

  isExecutionComplete(message: ExecutionMessage): boolean {
    const text = message.content || "";
    return donePattern.test(text);
  }

  isExecutionFailed(message: ExecutionMessage): boolean {
    const text = message.content || "";
    return errorPattern.test(text);
  }

  isArchiveComplete(message: ExecutionMessage): ArchiveDetection {
    const text = message.content || "";
    if (!archivePattern.test(text)) return { ok: false };
    const pathMatch = text.match(archivePathPattern);
    return { ok: true, path: pathMatch?.[0] };
  }
}
