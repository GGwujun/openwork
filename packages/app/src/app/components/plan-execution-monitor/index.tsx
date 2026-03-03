import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import type { TaskCenterItem } from "../../types";
import type { PlanExecutionState } from "../../context/plan-execution";
import ExecutionProgressBar from "./ProgressBar";
import ExecutionQuestionModal from "./QuestionModal";
import Button from "../button";
import { isTauriRuntime } from "../../utils";

export type PlanExecutionMonitorProps = {
  open: boolean;
  item: TaskCenterItem;
  state: PlanExecutionState;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onAnswerQuestion: (answer: string) => void | Promise<void>;
};

const statusLabel = (status: PlanExecutionState["status"]) => {
  switch (status) {
    case "running":
      return "执行中";
    case "waiting":
      return "等待回复";
    case "completed":
      return "执行完成";
    case "archived":
      return "归档完成";
    case "failed":
      return "执行失败";
    default:
      return "空闲";
  }
};

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs || durationMs <= 0) return "-";
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const isAbsolutePath = (value: string) => {
  if (!value) return false;
  const first = value[0];
  if (first === "/" || first === "\\") return true;
  return value.length > 2 && value[1] === ":" && (value[2] === "\\" || value[2] === "/");
};

const joinPath = (root: string, relative: string) => {
  const normalizedRoot = root.replace(/[\\/]+$/g, "");
  const normalizedRelative = relative.replace(/^[\\/]+/g, "");
  return `${normalizedRoot}/${normalizedRelative}`;
};

export default function PlanExecutionMonitor(props: PlanExecutionMonitorProps) {
  const statusText = createMemo(() => statusLabel(props.state.status));
  const progressLabel = createMemo(() => props.state.progress?.message ?? statusText());
  const allowQuestions = createMemo(() => props.state.options?.allowQuestions === true);
  const isTerminalStatus = createMemo(
    () => props.state.status === "completed" || props.state.status === "archived" || props.state.status === "failed"
  );
  const [now, setNow] = createSignal(Date.now());
  const [archiveStatus, setArchiveStatus] = createSignal<string | null>(null);
  const [answering, setAnswering] = createSignal(false);
  const [showTasks, setShowTasks] = createSignal(true);
  const latestMessage = createMemo(() => props.state.latestMessage ?? null);
  const latestMessageTime = createMemo(() =>
    latestMessage()?.createdAt ? new Date(latestMessage()!.createdAt).toLocaleTimeString() : "-"
  );
  const tasksSnapshot = createMemo(() => props.state.tasksSnapshot?.trim() || "");
  const hasTasksSnapshot = createMemo(() => Boolean(tasksSnapshot()));

  const archivePath = createMemo(() => props.state.archivePath ?? props.state.result?.archivePath ?? null);
  const hasResult = createMemo(() => isTerminalStatus() && Boolean(props.state.result));
  const totalTasks = createMemo(() => props.state.progress?.total ?? props.state.result?.totalTasks ?? null);
  const completedTasks = createMemo(() => props.state.progress?.current ?? props.state.result?.completedTasks ?? null);
  const elapsedMs = createMemo(() => {
    const startedAt = props.state.startedAt ?? props.state.result?.startedAt;
    if (!startedAt) return null;
    const end = props.state.completedAt ?? props.state.result?.completedAt ?? now();
    return Math.max(0, end - startedAt);
  });
  const remainingMs = createMemo(() => {
    const current = props.state.progress?.current ?? props.state.result?.completedTasks ?? 0;
    const total = props.state.progress?.total ?? props.state.result?.totalTasks ?? 0;
    if (!current || !total) return null;
    const elapsed = elapsedMs();
    if (!elapsed) return null;
    const perTask = elapsed / Math.max(1, current);
    return Math.max(0, Math.round(perTask * total - elapsed));
  });

  createEffect(() => {
    if (!props.open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => window.clearInterval(timer));
  });


  const resolveArchiveTarget = () => {
    const path = archivePath();
    if (!path) return null;
    if (isAbsolutePath(path)) return path;
    const root = props.state.workspaceRoot ?? "";
    if (!root) return path;
    return joinPath(root, path);
  };

  const handleOpenArchive = async () => {
    const target = resolveArchiveTarget();
    if (!target) return;
    setArchiveStatus(null);
    if (isTauriRuntime()) {
      try {
        const openerModule = await import("@tauri-apps/plugin-opener");
        const openTarget =
          openerModule.open ??
          (openerModule as { default?: (path: string) => Promise<void> }).default;
        if (openTarget) {
          await openTarget(target);
          setArchiveStatus("已打开归档");
          return;
        }
      } catch (error) {
        console.warn("Failed to open archive", error);
      }
    }

    try {
      await navigator.clipboard.writeText(target);
      setArchiveStatus("已复制归档路径");
    } catch {
      setArchiveStatus("无法打开或复制归档路径");
    }
  };

  const handleAnswerQuestion = async (answer: string) => {
    if (answering()) return;
    setAnswering(true);
    try {
      await Promise.resolve(props.onAnswerQuestion(answer));
    } finally {
      setAnswering(false);
    }
  };

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={props.onClose}
      >
        <div
          class="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-dls-border bg-dls-surface shadow-2xl flex flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div class="flex items-center justify-between border-b border-dls-border px-6 py-4">
            <div>
              <div class="text-sm font-semibold text-dls-text">计划执行监控</div>
              <div class="text-[11px] text-dls-secondary mt-1">
                #{props.item.tfsId} · {props.item.title}
              </div>
              <Show when={props.state.workspaceId || props.state.workspaceRoot}>
                <div class="text-[11px] text-dls-secondary mt-1">
                  工作区: {props.state.workspaceId ?? "-"} · {props.state.workspaceRoot ?? "-"}
                </div>
              </Show>
              <Show when={props.state.options?.docDeliveryMode}>
                <div class="text-[11px] text-dls-secondary mt-1">
                  文档模式: {props.state.options?.docDeliveryMode}
                </div>
              </Show>
            </div>
            <Button variant="outline" class="h-8 px-3 text-xs" onClick={props.onClose}>
              关闭
            </Button>
          </div>
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <ExecutionProgressBar
              percent={props.state.progress?.percent}
              label={progressLabel()}
              status={statusText()}
            />
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div class="rounded-xl border border-dls-border bg-dls-surface p-4">
                <div class="text-xs font-semibold text-dls-text">执行信息</div>
                <div class="mt-2 text-[11px] text-dls-secondary space-y-1">
                  <div>状态: {statusText()}</div>
                  <Show when={totalTasks() != null && completedTasks() != null}>
                    <div>
                      任务: {completedTasks()}/{totalTasks()}
                    </div>
                  </Show>
                  <Show when={elapsedMs() != null}>
                    <div>已用时间: {formatDuration(elapsedMs())}</div>
                  </Show>
                  <Show when={remainingMs() != null}>
                    <div>预计剩余: {formatDuration(remainingMs())}</div>
                  </Show>
                  <Show when={props.state.sessionId}>
                    <div>Session: {props.state.sessionId}</div>
                  </Show>
                  <Show when={props.state.schedulerMeta?.executionMode}>
                    <div>调度: {props.state.schedulerMeta?.executionMode === "parallel-batch" ? "并行批次" : "串行"}</div>
                  </Show>
                  <Show when={props.state.schedulerMeta?.completedTaskId}>
                    <div>最近完成任务: {props.state.schedulerMeta?.completedTaskId}</div>
                  </Show>
                  <Show when={props.state.schedulerMeta?.readyQueue?.length}>
                    <div>就绪队列: {props.state.schedulerMeta?.readyQueue?.join(", ")}</div>
                  </Show>
                  <Show when={props.state.schedulerMeta?.dependsOn?.length}>
                    <div>依赖: {props.state.schedulerMeta?.dependsOn?.join(", ")}</div>
                  </Show>
                  <Show when={props.state.lastTaskUpdateAt}>
                    <div>最近任务更新: {new Date(props.state.lastTaskUpdateAt as number).toLocaleTimeString()}</div>
                  </Show>
                  <Show when={props.state.archivePath}>
                    <div>归档: {props.state.archivePath}</div>
                  </Show>
                  <Show when={props.state.error}>
                    <div class="text-red-11">错误: {props.state.error}</div>
                  </Show>
                  <Show when={props.state.syncError}>
                    <div class="text-amber-11">TFS同步: {props.state.syncError}</div>
                  </Show>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <Show when={props.state.status === "running"}>
                    <div class="text-[11px] text-dls-secondary">执行期间不可暂停</div>
                  </Show>
                  <Show when={props.state.status === "running" || props.state.status === "waiting"}>
                    <Button variant="outline" class="h-7 px-3 text-[11px]" onClick={props.onCancel}>
                      取消
                    </Button>
                  </Show>
                </div>
                <Show when={archivePath()}>
                  <div class="mt-3">
                    <Button variant="outline" class="h-7 px-3 text-[11px]" onClick={handleOpenArchive}>
                      查看归档
                    </Button>
                    <Show when={archiveStatus()}>
                      <div class="mt-1 text-[10px] text-dls-secondary">{archiveStatus()}</div>
                    </Show>
                  </div>
                </Show>
              </div>
              <div class="lg:col-span-2 rounded-xl border border-dls-border bg-dls-surface p-4">
                <div class="text-xs font-semibold text-dls-text">最新消息</div>
                <Show when={latestMessage()} fallback={<div class="mt-2 text-[11px] text-dls-secondary">暂无消息</div>}>
                  <div class="mt-2 text-[10px] text-dls-secondary">
                    {latestMessageTime()}
                  </div>
                  <pre class="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap text-xs text-dls-text">
                    {latestMessage()?.content}
                  </pre>
                </Show>
              </div>
            </div>
            <div class="rounded-xl border border-dls-border bg-dls-surface p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="text-xs font-semibold text-dls-text">当前 tasks.md</div>
                <Show when={hasTasksSnapshot()}>
                  <Button
                    variant="outline"
                    class="h-7 px-3 text-[11px]"
                    onClick={() => setShowTasks((prev) => !prev)}
                  >
                    {showTasks() ? "收起" : "展开"}
                  </Button>
                </Show>
              </div>
              <Show
                when={hasTasksSnapshot()}
                fallback={<div class="mt-2 text-[11px] text-dls-secondary">暂无任务快照</div>}
              >
                <pre class="mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap text-xs text-dls-text">
                  {showTasks() ? tasksSnapshot() : ""}
                </pre>
              </Show>
            </div>
            <Show when={hasResult()}>
              <div class="rounded-xl border border-dls-border bg-dls-surface p-4">
                <div class="text-xs font-semibold text-dls-text">完成摘要</div>
                <div class="mt-2 text-[11px] text-dls-secondary space-y-1">
                  <Show when={props.state.result?.message}>
                    <div>{props.state.result?.message}</div>
                  </Show>
                  <Show when={props.state.result?.commit?.hash}>
                    <div>提交: {props.state.result?.commit?.hash}</div>
                  </Show>
                  <Show when={props.state.result?.verification?.ok}>
                    <div>验证: {props.state.result?.verification?.summary ?? "通过"}</div>
                  </Show>
                  <Show when={props.state.result?.files?.length}>
                    <div>文件: {props.state.result?.files?.length}</div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
      <ExecutionQuestionModal
        open={Boolean(props.state.question) && allowQuestions()}
        question={props.state.question ?? null}
        busy={answering()}
        onClose={props.onClose}
        onSubmit={handleAnswerQuestion}
      />
    </Show>
  );
}
