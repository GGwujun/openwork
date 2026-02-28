import { describe, expect, it } from "vitest";

import { ExecutionProgressMonitor } from "../progress-monitor";

describe("ExecutionProgressMonitor", () => {
  it("parses progress messages", () => {
    const monitor = new ExecutionProgressMonitor();
    const progress = monitor.parseProgress({
      role: "assistant",
      content: "[PROGRESS] done=3/10 task=更新登录接口",
      createdAt: Date.now(),
    });

    expect(progress?.current).toBe(3);
    expect(progress?.total).toBe(10);
    expect(progress?.task).toBe("更新登录接口");
    expect(progress?.percent).toBe(30);
  });

  it("detects questions", () => {
    const monitor = new ExecutionProgressMonitor();
    const question = monitor.parseQuestion({
      role: "assistant",
      content: "[QUESTION] 是否继续执行单元测试？",
      createdAt: Date.now(),
    });

    expect(question).toBe("是否继续执行单元测试？");
  });

  it("detects completion and archive", () => {
    const monitor = new ExecutionProgressMonitor();
    const done = monitor.isExecutionComplete({
      role: "assistant",
      content: "[DONE] 全部任务完成",
      createdAt: Date.now(),
    });
    const archive = monitor.isArchiveComplete({
      role: "assistant",
      content: "[forge-archive] 归档完成: forge/archives/2026-02-28-tfs-123",
      createdAt: Date.now(),
    });

    expect(done).toBe(true);
    expect(archive.ok).toBe(true);
    expect(archive.path).toBe("forge/archives/2026-02-28-tfs-123");
  });
});
