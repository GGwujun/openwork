import { For, Show, createMemo, createSignal } from "solid-js";

import type { ExecutionMessage, ExecutionMessageKind } from "../../../automation/plan-execution/types";

const kindLabel: Record<string, { label: string; tone: string }> = {
  info: { label: "Info", tone: "bg-blue-9/20 text-blue-11" },
  progress: { label: "Progress", tone: "bg-amber-9/20 text-amber-11" },
  question: { label: "Question", tone: "bg-purple-9/20 text-purple-11" },
  error: { label: "Error", tone: "bg-red-9/20 text-red-11" },
  complete: { label: "Done", tone: "bg-emerald-9/20 text-emerald-11" },
  archive: { label: "Archive", tone: "bg-slate-9/20 text-slate-11" },
};

const MAX_MESSAGE_CHARS = 2000;

export type ExecutionMessageListProps = {
  messages: ExecutionMessage[];
};

export default function ExecutionMessageList(props: ExecutionMessageListProps) {
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});
  const list = createMemo(() => props.messages);

  return (
    <div class="rounded-xl border border-dls-border bg-dls-surface p-4">
      <div class="space-y-2 max-h-[360px] overflow-y-auto">
        <Show when={list().length > 0} fallback={<div class="text-xs text-dls-secondary">暂无消息</div>}>
          <For each={list()}>
            {(message, index) => {
              const meta = () => kindLabel[message.kind ?? "info"] ?? kindLabel.info;
              const id = () => message.id ?? `${message.createdAt}-${message.kind ?? "info"}-${index()}`;
              const isOpen = () => Boolean(expanded()[id()]);
              const toggle = () =>
                setExpanded((prev) => ({ ...prev, [id()]: !prev[id()] }));
              const content = () => message.content ?? "";
              const isLong = () => content().length > MAX_MESSAGE_CHARS;
              const preview = () =>
                isLong() ? `${content().slice(0, MAX_MESSAGE_CHARS)}\n\n... (内容过长，已截断)` : content();
              return (
                <div class="rounded-lg border border-dls-border bg-dls-hover/40 p-3">
                  <div class="flex items-center justify-between text-[10px] text-dls-secondary">
                    <span class={`px-2 py-0.5 rounded-full ${meta().tone}`}>{meta().label}</span>
                    <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div class="mt-2 text-[11px] text-dls-secondary">
                    <button type="button" class="text-dls-accent hover:text-[var(--dls-accent-hover)]" onClick={toggle}>
                      {isOpen() ? "收起内容" : "查看内容"}
                    </button>
                  </div>
                  <Show when={isOpen()}>
                    <div class="mt-2 text-xs text-dls-text whitespace-pre-wrap">
                      {preview()}
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}
