import { For, Show, createSignal } from "solid-js";

import Button from "../button";

export type ExecutionQuestionModalProps = {
  open: boolean;
  question: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (answer: string) => void;
};

export default function ExecutionQuestionModal(props: ExecutionQuestionModalProps) {
  const [answer, setAnswer] = createSignal("");
  const quickOptions = ["继续执行", "请继续按计划执行", "停止并报告问题"];

  const handleSubmit = () => {
    const value = answer().trim();
    if (!value) return;
    props.onSubmit(value);
    setAnswer("");
  };

  return (
    <Show when={props.open && props.question}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div class="w-full max-w-lg rounded-2xl border border-dls-border bg-dls-surface shadow-xl">
          <div class="border-b border-dls-border px-5 py-4">
            <div class="text-sm font-semibold text-dls-text">AI 提问</div>
            <div class="mt-2 text-xs text-dls-secondary whitespace-pre-wrap">{props.question}</div>
          </div>
          <div class="p-5 space-y-3">
            <div class="flex flex-wrap gap-2">
              <For each={quickOptions}>
                {(option) => (
                  <button
                    type="button"
                    class="rounded-full border border-dls-border bg-dls-hover px-3 py-1 text-[11px] text-dls-text hover:border-dls-accent"
                    onClick={() => setAnswer(option)}
                    disabled={props.busy}
                  >
                    {option}
                  </button>
                )}
              </For>
            </div>
            <textarea
              value={answer()}
              onInput={(event) => setAnswer(event.currentTarget.value)}
              rows={4}
              placeholder="输入你的回复"
              class="w-full resize-none rounded-xl border border-dls-border bg-dls-hover px-3 py-2 text-xs text-dls-text focus:border-dls-accent focus:outline-none"
            />
            <div class="flex justify-end gap-2">
              <Button variant="outline" class="h-8 px-3 text-xs" onClick={props.onClose}>
                关闭
              </Button>
              <Button variant="primary" class="h-8 px-3 text-xs" onClick={handleSubmit} disabled={props.busy}>
                发送回复
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
