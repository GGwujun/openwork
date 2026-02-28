import type { ExecutionMessage } from "./types";

const archiveSignal = /(forge-archive|归档完成|archive complete)/i;
const archiveFailure = /(forge-archive|归档).*失败|archive failed/i;
const archivePathPattern = /forge\/archives\/\d{4}-\d{2}-\d{2}-tfs-\d+/i;

export type ArchiveResult = {
  ok: boolean;
  path?: string;
  error?: string;
};

export class ArchiveMonitor {
  detect(message: ExecutionMessage): ArchiveResult {
    const text = message.content || "";
    if (archiveFailure.test(text)) {
      return { ok: false, error: text.trim() };
    }
    if (!archiveSignal.test(text)) return { ok: false };
    const path = text.match(archivePathPattern)?.[0];
    return { ok: true, path };
  }
}
