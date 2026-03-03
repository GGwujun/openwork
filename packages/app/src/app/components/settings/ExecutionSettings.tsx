import { createSignal, onCleanup } from "solid-js";

import Button from "../button";
import {
  getExecutionConfig,
  setExecutionConfig,
  subscribeExecutionConfig,
  type ExecutionConfig,
  type ExecutionDocDeliveryMode,
} from "../../../types/config";

export default function ExecutionSettings() {
  const [config, setConfig] = createSignal<ExecutionConfig>(getExecutionConfig());

  const unsubscribe = subscribeExecutionConfig((next) => setConfig(next));
  onCleanup(() => unsubscribe());

  const setMode = (docDeliveryMode: ExecutionDocDeliveryMode) => {
    const next = setExecutionConfig({ docDeliveryMode });
    setConfig(next);
  };

  return (
    <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-4">
      <div>
        <div class="text-sm font-medium text-gray-12">开发执行文档模式</div>
        <div class="text-xs text-gray-10">控制开始开发时如何把计划文档传给 OpenCode。</div>
      </div>

      <div class="grid gap-2 md:grid-cols-2">
        <Button
          variant={config().docDeliveryMode === "inline-docs" ? "secondary" : "outline"}
          class="justify-start"
          onClick={() => setMode("inline-docs")}
        >
          inline-docs（默认）
        </Button>
        <Button
          variant={config().docDeliveryMode === "forge-files" ? "secondary" : "outline"}
          class="justify-start"
          onClick={() => setMode("forge-files")}
        >
          forge-files（兼容）
        </Button>
      </div>

      <div class="text-[11px] text-gray-7 space-y-1">
        <div>inline-docs：不落地 forge/tracks 文件，直接把 intent/design/tasks 注入执行引擎。</div>
        <div>forge-files：保留本地 forge/tracks 文件流程，仅用于兼容旧行为。</div>
      </div>
    </div>
  );
}
