import { createMemo, Show } from "solid-js";
import { CheckCircle2, Loader2, RefreshCw, X } from "lucide-solid";

import type { TaskAutoAnalysisState } from "../../../types/requirement-analyzer";
import type { TfsSyncStatus } from "../../lib/sync-task-to-tfs";

export type AnalysisStatusBadgeProps = {
  workItemId: number;
  autoAnalysisState?: TaskAutoAnalysisState;
  tfsSyncStatus?: TfsSyncStatus;
  onReanalyze?: (workItemId: number) => void;
};

const statusTone: Record<TaskAutoAnalysisState["status"], string> = {
  idle: "border-gray-4 bg-gray-2 text-gray-10",
  queued: "border-amber-5/60 bg-amber-2 text-amber-11",
  analyzing: "badge-blue badge-pulse",
  completed: "badge-green",
  failed: "badge-red",
};

export default function AnalysisStatusBadge(props: AnalysisStatusBadgeProps) {
  const status = createMemo<TaskAutoAnalysisState["status"]>(() => props.autoAnalysisState?.status ?? "idle");
  const progress = createMemo(() => Math.round(props.autoAnalysisState?.progress ?? 0));
  const showRetry = () => status() === "failed";

  const label = createMemo(() => {
    switch (status()) {
      case "queued":
        return "AI分析排队中";
      case "analyzing":
        return `AI分析中 ${progress()}%`;
      case "completed":
        return "AI分析完成";
      case "failed":
        return "AI分析失败";
      default:
        return "未分析";
    }
  });

  const onRetry = () => {
    if (!showRetry()) return;
    props.onReanalyze?.(props.workItemId);
  };

  return (
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone[status()]} ${showRetry() ? "" : "cursor-default"}`}
        onClick={onRetry}
      >
        <Show
          when={status() === "analyzing"}
          fallback={
            <Show when={status() === "completed"} fallback={<Show when={status() === "failed"} fallback={<RefreshCw size={12} />}><X size={12} /></Show>}>
              <CheckCircle2 size={12} />
            </Show>
          }
        >
          <Loader2 size={12} class="animate-spin" />
        </Show>
        <span>{label()}</span>
      </button>

      <Show when={props.tfsSyncStatus?.analysisSynced || props.tfsSyncStatus?.planSynced}>
        <span class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          props.tfsSyncStatus?.analysisSynced && props.tfsSyncStatus?.planSynced
            ? 'badge-purple' // 两者都同步
            : 'badge-amber' // 只同步了一个
        }`}>
          <CheckCircle2 size={12} />
          {props.tfsSyncStatus?.analysisSynced && props.tfsSyncStatus?.planSynced
            ? '已同步 TFS'
            : props.tfsSyncStatus?.analysisSynced
              ? '分析已同步'
              : '计划已同步'}
        </span>
      </Show>
    </div>
  );
}
