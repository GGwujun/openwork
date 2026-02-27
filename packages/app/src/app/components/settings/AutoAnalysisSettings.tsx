import { createSignal, onCleanup } from "solid-js";

import Button from "../button";
import {
  getAutoAnalysisConfig,
  setAutoAnalysisConfig,
  subscribeAutoAnalysisConfig,
  type AutoAnalysisConfig,
} from "../../../types/config";

export default function AutoAnalysisSettings() {
  const [config, setConfig] = createSignal<AutoAnalysisConfig>(getAutoAnalysisConfig());

  const unsubscribe = subscribeAutoAnalysisConfig((next) => setConfig(next));
  onCleanup(() => unsubscribe());

  const updateConfig = (patch: Partial<AutoAnalysisConfig>) => {
    const next = setAutoAnalysisConfig(patch);
    setConfig(next);
  };

  const onNumberChange = (key: "cacheExpiryHours" | "maxRetries") => (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const value = Number(target.value);
    if (!Number.isFinite(value)) return;
    updateConfig({ [key]: value });
  };

  return (
    <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-4">
      <div>
        <div class="text-sm font-medium text-gray-12">自动分析</div>
        <div class="text-xs text-gray-10">任务中心自动分析与同步配置。</div>
      </div>

      <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
        <div class="min-w-0">
          <div class="text-sm text-gray-12">启用自动分析</div>
          <div class="text-xs text-gray-7">同步任务后自动触发 AI 分析。</div>
        </div>
        <Button
          variant="outline"
          class="text-xs h-8 py-0 px-3 shrink-0"
          onClick={() => updateConfig({ enabled: !config().enabled })}
        >
          {config().enabled ? "On" : "Off"}
        </Button>
      </div>

      <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
        <div class="min-w-0">
          <div class="text-sm text-gray-12">自动同步到 TFS</div>
          <div class="text-xs text-gray-7">分析完成后自动创建 TFS 子任务。</div>
        </div>
        <Button
          variant="outline"
          class="text-xs h-8 py-0 px-3 shrink-0"
          onClick={() => updateConfig({ autoSyncToTfs: !config().autoSyncToTfs })}
          disabled={!config().enabled}
        >
          {config().autoSyncToTfs ? "On" : "Off"}
        </Button>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <label class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
          <div class="min-w-0">
            <div class="text-sm text-gray-12">缓存有效期（小时）</div>
            <div class="text-xs text-gray-7">超过此时间自动重新分析。</div>
          </div>
          <input
            type="number"
            min="1"
            max="168"
            value={config().cacheExpiryHours}
            onInput={onNumberChange("cacheExpiryHours")}
            class="w-20 rounded-md border border-gray-6 bg-white px-2 py-1 text-xs text-gray-12"
            disabled={!config().enabled}
          />
        </label>

        <label class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
          <div class="min-w-0">
            <div class="text-sm text-gray-12">失败重试次数</div>
            <div class="text-xs text-gray-7">分析失败时自动重试次数。</div>
          </div>
          <input
            type="number"
            min="1"
            max="10"
            value={config().maxRetries}
            onInput={onNumberChange("maxRetries")}
            class="w-20 rounded-md border border-gray-6 bg-white px-2 py-1 text-xs text-gray-12"
            disabled={!config().enabled}
          />
        </label>
      </div>
    </div>
  );
}
