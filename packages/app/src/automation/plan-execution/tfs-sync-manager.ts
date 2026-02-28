import type { TFSClient } from "../../api/tfs";
import type { ExecutionResult } from "./types";

const formatList = (items: string[] | undefined) =>
  items && items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- 无";

const formatCommit = (result: ExecutionResult) => {
  if (!result.commit?.hash) return "- 无";
  const message = result.commit.message ? ` ${result.commit.message}` : "";
  return `- ${result.commit.hash}${message}`;
};

const formatDuration = (durationMs?: number) => {
  if (!durationMs || durationMs <= 0) return "- 无";
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export class TFSSyncManager {
  private tfsClient: TFSClient;

  constructor(tfsClient: TFSClient) {
    this.tfsClient = tfsClient;
  }

  async syncExecutionStart(workItemId: number, summary?: string) {
    await this.tfsClient.updateWorkItemState(
      workItemId,
      "活动",
      summary ?? "开始执行开发计划 (via OpenWork)"
    );
  }

  async syncExecutionComplete(workItemId: number, result: ExecutionResult) {
    const comment = [
      "## 开发完成 ✅",
      result.message ?? "计划执行完成",
      "",
      "### 归档路径",
      result.archivePath ? `- ${result.archivePath}` : "- 未检测到",
      "",
      "### 提交信息",
      formatCommit(result),
      "",
      "### 生成的文件",
      formatList(result.files),
      "",
      "### 执行统计",
      `- 总任务数: ${result.totalTasks ?? "-"}`,
      `- 完成任务数: ${result.completedTasks ?? "-"}`,
      `- 执行时长: ${formatDuration(result.durationMs)}`,
    ].join("\n");

    await this.tfsClient.resolveWorkItem(workItemId, { comment });
  }
}
