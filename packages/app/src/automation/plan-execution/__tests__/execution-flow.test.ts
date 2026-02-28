import { describe, expect, it, vi } from "vitest";

import { ExecutionProgressMonitor } from "../progress-monitor";
import { ExecutionResultParser } from "../execution-result-parser";
import { SessionPoller } from "../session-poller";
import { TFSSyncManager } from "../tfs-sync-manager";
import type { ExecutionMessage, ExecutionResult } from "../types";
import type { TFSClient } from "../../../api/tfs";

describe("plan execution integration", () => {
  it("builds execution result with stats and archive path", () => {
    const parser = new ExecutionResultParser();
    const messages: ExecutionMessage[] = [
      { role: "assistant", content: "[PROGRESS] done=1/3 task=初始化", createdAt: 1000 },
      { role: "assistant", content: "[PROGRESS] done=3/3 task=收尾", createdAt: 3000 },
      { role: "assistant", content: "[DONE] 全部任务完成\ncommit abc123", createdAt: 4000 },
      {
        role: "assistant",
        content: "[forge-archive] 归档完成: forge/archives/2026-02-28-tfs-1",
        createdAt: 5000,
      },
    ];

    const result = parser.parse(messages);
    expect(result.totalTasks).toBe(3);
    expect(result.completedTasks).toBe(3);
    expect(result.archivePath).toBe("forge/archives/2026-02-28-tfs-1");
    expect(result.durationMs).toBe(4000);
  });

  it("polls messages and detects progress updates", async () => {
    const monitor = new ExecutionProgressMonitor();
    const messages: any[] = [
      { info: { id: "msg-1", role: "assistant" }, parts: [{ type: "text", text: "[PROGRESS] done=1/2 task=A" }] },
    ];
    const updates: number[] = [];

    const poller = new SessionPoller({
      sessionId: "ses-1",
      getMessages: async () => messages,
      onMessages: (items) => {
        for (const message of items) {
          const content = message.parts?.map((part: any) => part.text ?? "").join("") ?? "";
          const progress = monitor.parseProgress({
            role: "assistant",
            content,
            createdAt: Date.now(),
          });
          if (progress?.current) updates.push(progress.current);
        }
      },
    });

    await (poller as any).pollOnce();
    messages.push({
      info: { id: "msg-2", role: "assistant" },
      parts: [{ type: "text", text: "[PROGRESS] done=2/2 task=B" }],
    });
    await (poller as any).pollOnce();

    expect(updates).toEqual([1, 2]);
  });

  it("syncs execution summary to TFS", async () => {
    const resolveWorkItem = vi.fn().mockResolvedValue({});
    const tfsClient = { resolveWorkItem } as unknown as TFSClient;
    const syncManager = new TFSSyncManager(tfsClient);

    const result: ExecutionResult = {
      success: true,
      status: "completed",
      message: "完成",
      archivePath: "forge/archives/2026-02-28-tfs-1",
      totalTasks: 3,
      completedTasks: 3,
      durationMs: 65000,
      commit: { hash: "abc123" },
      files: ["src/app.ts"],
    };

    await syncManager.syncExecutionComplete(123, result);
    const comment = resolveWorkItem.mock.calls[0]?.[1]?.comment ?? "";
    expect(comment).toContain("执行统计");
    expect(comment).toContain("总任务数: 3");
    expect(comment).toContain("完成任务数: 3");
  });
});
