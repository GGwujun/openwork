import type { ExecutionMessage, ExecutionProgress } from "./types";

const progressPattern = /\[PROGRESS\]\s*done=(\d+)\s*\/\s*(\d+)\s*task=([^\n]+)/i;
const progressAltPattern = /任务\s*(\d+)\s*\/\s*(\d+)\s*完成[:：]?\s*(.*)/i;
const taskUpdateBlockPattern = /\[\[TASK_UPDATE_START\]\]([\s\S]*?)\[\[TASK_UPDATE_END\]\]/i;
const questionPattern = /\[QUESTION\]\s*(.+)/i;
const donePattern = /\[DONE\]|\[\[EXEC_DONE\]\]|执行完成|完成全部任务|execution complete/i;
const errorPattern = /\[ERROR\]|执行失败|failed|error/i;
const archivePattern = /(forge-archive|归档完成|archive complete)/i;
const archivePathPattern = /forge\/archives\/\d{4}-\d{2}-\d{2}-tfs-\d+/i;
const questionPlaceholderPattern = /<\s*问题\s*>|并等待用户回复/gi;

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

export type TaskUpdate = {
  done?: number;
  total?: number;
  currentTaskId?: string;
  status?: "completed" | "failed" | "blocked";
  executionMode?: "serial" | "parallel-batch";
  dependsOn?: string[];
  readyQueue?: string[];
  tasksMarkdown?: string;
};

export class ExecutionProgressMonitor {
  parseTaskUpdate(message: ExecutionMessage): TaskUpdate | null {
    const text = message.content || "";
    const match = text.match(taskUpdateBlockPattern);
    if (!match) return null;
    const block = match[1]?.trim();
    if (!block) return null;

    const readString = (pattern: RegExp) => {
      const m = block.match(pattern);
      return m?.[1]?.trim() || undefined;
    };
    const parseList = (value?: string) =>
      value ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined;

    const doneMatch = block.match(/done\s*=\s*(\d+)\s*\/\s*(\d+)/i);
    const status = readString(/status\s*=\s*([^\n]+)/i)?.toLowerCase();
    const executionMode = readString(/execution_mode\s*=\s*([^\n]+)/i)?.toLowerCase();
    const tasksMatch = block.match(/tasks_markdown\s*=\s*([\s\S]*)$/i);

    return {
      done: doneMatch ? Number.parseInt(doneMatch[1], 10) : undefined,
      total: doneMatch ? Number.parseInt(doneMatch[2], 10) : undefined,
      currentTaskId: readString(/(?:current_task_id|completed_task_id)\s*=\s*([^\n]+)/i),
      status:
        status === "completed" || status === "failed" || status === "blocked"
          ? status
          : undefined,
      executionMode: executionMode === "parallel-batch" ? "parallel-batch" : "serial",
      dependsOn: parseList(readString(/depends_on\s*=\s*([^\n]+)/i)),
      readyQueue: parseList(readString(/ready_queue\s*=\s*([^\n]+)/i)),
      tasksMarkdown: tasksMatch?.[1]?.trim() || undefined,
    };
  }

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
    const normalizeQuestion = (value: string) => {
      const cleaned = value.replace(questionPlaceholderPattern, "").trim();
      return cleaned.length > 0 ? cleaned : null;
    };
    const match = text.match(questionPattern);
    if (match) return normalizeQuestion(match[1].trim());
    if (/\?|请问|是否需要|确认/i.test(text)) return normalizeQuestion(text.trim());
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
