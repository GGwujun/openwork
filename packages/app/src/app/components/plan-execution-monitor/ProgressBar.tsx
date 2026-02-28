import { Show } from "solid-js";

export type ExecutionProgressBarProps = {
  percent?: number;
  label?: string;
  status?: string;
};

export default function ExecutionProgressBar(props: ExecutionProgressBarProps) {
  const percent = () => Math.min(100, Math.max(0, props.percent ?? 0));

  return (
    <div class="rounded-xl border border-dls-border bg-dls-surface px-4 py-3">
      <div class="flex items-center justify-between text-[11px] text-dls-secondary">
        <span>{props.label ?? "执行进度"}</span>
        <span class="font-medium text-dls-text">{percent()}%</span>
      </div>
      <div class="mt-2 h-2 w-full rounded-full bg-dls-hover">
        <div
          class="h-2 rounded-full bg-dls-accent transition-all"
          style={{ width: `${percent()}%` }}
        />
      </div>
      <Show when={props.status}>
        <div class="mt-2 text-[11px] text-dls-secondary">{props.status}</div>
      </Show>
    </div>
  );
}
