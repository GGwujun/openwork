import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import type { ExecutionMessage, ExecutionMessageKind } from "../../../automation/plan-execution/types";

const kindLabel: Record<string, { label: string; tone: string }> = {
  info: { label: "Info", tone: "bg-blue-9/20 text-blue-11" },
  progress: { label: "Progress", tone: "bg-amber-9/20 text-amber-11" },
  question: { label: "Question", tone: "bg-purple-9/20 text-purple-11" },
  error: { label: "Error", tone: "bg-red-9/20 text-red-11" },
  complete: { label: "Done", tone: "bg-emerald-9/20 text-emerald-11" },
  archive: { label: "Archive", tone: "bg-slate-9/20 text-slate-11" },
};

export type ExecutionMessageListProps = {
  messages: ExecutionMessage[];
};

export default function ExecutionMessageList(props: ExecutionMessageListProps) {
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal<ExecutionMessageKind | "all">("all");
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(360);
  let containerRef: HTMLDivElement | undefined;
  const rowHeight = 72;
  const buffer = 6;

  const filtered = createMemo(() => {
    const value = query().trim().toLowerCase();
    const kind = filter();
    return props.messages.filter((message) => {
      if (kind !== "all" && message.kind !== kind) return false;
      if (!value) return true;
      return message.content.toLowerCase().includes(value);
    });
  });

  const metrics = createMemo(() => {
    const list = filtered();
    const total = list.length;
    const height = containerHeight();
    const start = Math.max(0, Math.floor(scrollTop() / rowHeight) - buffer);
    const visibleCount = Math.ceil(height / rowHeight) + buffer * 2;
    const end = Math.min(total, start + visibleCount);
    return {
      list,
      start,
      end,
      paddingTop: start * rowHeight,
      paddingBottom: Math.max(0, (total - end) * rowHeight),
    };
  });

  const visibleMessages = createMemo(() => {
    const { list, start, end } = metrics();
    return list.slice(start, end);
  });

  const scrollToBottom = () => {
    if (!containerRef) return;
    containerRef.scrollTop = containerRef.scrollHeight;
    setScrollTop(containerRef.scrollTop);
  };

  const handleScroll = () => {
    if (!containerRef) return;
    const offset = containerRef.scrollHeight - containerRef.scrollTop - containerRef.clientHeight;
    setScrollTop(containerRef.scrollTop);
    setAutoScroll(offset < 24);
  };

  createEffect(() => {
    if (!containerRef) return;
    const updateHeight = () => setContainerHeight(containerRef?.clientHeight ?? 0);
    updateHeight();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(containerRef);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    metrics();
    if (!autoScroll()) return;
    queueMicrotask(scrollToBottom);
  });

  return (
    <div class="rounded-xl border border-dls-border bg-dls-surface p-4">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="搜索消息"
          class="h-8 rounded-lg border border-dls-border bg-dls-hover px-3 text-xs text-dls-text focus:border-dls-accent focus:outline-none"
        />
        <select
          value={filter()}
          onChange={(event) => setFilter(event.currentTarget.value as ExecutionMessageKind | "all")}
          class="h-8 rounded-lg border border-dls-border bg-dls-hover px-2 text-xs text-dls-text"
        >
          <option value="all">全部</option>
          <option value="progress">进度</option>
          <option value="question">提问</option>
          <option value="complete">完成</option>
          <option value="archive">归档</option>
          <option value="error">错误</option>
        </select>
      </div>
      <div
        class="space-y-2 max-h-[360px] overflow-y-auto"
        ref={(el) => (containerRef = el)}
        onScroll={handleScroll}
      >
        <Show when={metrics().list.length > 0} fallback={<div class="text-xs text-dls-secondary">暂无消息</div>}>
          <div style={{ "padding-top": `${metrics().paddingTop}px`, "padding-bottom": `${metrics().paddingBottom}px` }}>
            <For each={visibleMessages()}>
              {(message) => {
                const meta = () => kindLabel[message.kind ?? "info"] ?? kindLabel.info;
                return (
                  <div class="rounded-lg border border-dls-border bg-dls-hover/40 p-3">
                    <div class="flex items-center justify-between text-[10px] text-dls-secondary">
                      <span class={`px-2 py-0.5 rounded-full ${meta().tone}`}>{meta().label}</span>
                      <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div class="mt-2 text-xs text-dls-text whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
      <Show when={!autoScroll() && metrics().list.length > 0}>
        <button
          type="button"
          class="mt-3 text-[11px] text-dls-accent hover:text-[var(--dls-accent-hover)]"
          onClick={() => {
            setAutoScroll(true);
            scrollToBottom();
          }}
        >
          回到底部
        </button>
      </Show>
    </div>
  );
}
