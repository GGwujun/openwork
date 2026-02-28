import { createSignal, onCleanup } from "solid-js";

import Button from "../button";
import {
  getTfsUserConfig,
  setTfsUserConfig,
  subscribeTfsUserConfig,
  hasValidTfsConfig,
  type TFSUserConfig,
} from "../../../types/config";

export default function TfsSettings() {
  const [config, setConfig] = createSignal<TFSUserConfig>(getTfsUserConfig());
  const [showPat, setShowPat] = createSignal(false);

  const unsubscribe = subscribeTfsUserConfig((next) => setConfig(next));
  onCleanup(() => unsubscribe());

  const updateConfig = (patch: Partial<TFSUserConfig>) => {
    console.log('[TfsSettings] updateConfig called with:', Object.keys(patch));
    const next = setTfsUserConfig(patch);
    console.log('[TfsSettings] Config updated, hasPat:', !!next.pat);
    setConfig(next);
  };

  const isConfigured = () => hasValidTfsConfig();

  return (
    <div class="bg-gray-2/30 border border-gray-6/50 rounded-2xl p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2">
          <div class="text-sm font-medium text-gray-12">TFS 配置</div>
          <div
            class={`text-xs px-2 py-0.5 rounded-full ${
              isConfigured()
                ? "bg-green-7/10 text-green-11 border border-green-7/20"
                : "bg-amber-7/10 text-amber-11 border border-amber-7/20"
            }`}
          >
            {isConfigured() ? "已配置" : "未配置"}
          </div>
        </div>
        <div class="text-xs text-gray-10 mt-1">
          配置 TFS 服务器连接以使用任务中心功能。
        </div>
      </div>

      <div class="space-y-3">
        <label class="block">
          <div class="text-xs text-gray-10 mb-1.5">服务器地址</div>
          <input
            type="text"
            value={config().serverUrl}
            onInput={(e) => updateConfig({ serverUrl: e.currentTarget.value })}
            placeholder="http://tfs-server:8080/tfs/Collection"
            class="w-full rounded-md border border-gray-6 bg-white px-3 py-2 text-xs text-gray-12"
          />
        </label>

        <label class="block">
          <div class="text-xs text-gray-10 mb-1.5">个人访问令牌 (PAT)</div>
          <div class="relative">
            <input
              type={showPat() ? "text" : "password"}
              value={config().pat}
              onInput={(e) => updateConfig({ pat: e.currentTarget.value })}
              placeholder="输入您的 TFS PAT 令牌"
              class="w-full rounded-md border border-gray-6 bg-white px-3 py-2 text-xs text-gray-12 pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPat(!showPat())}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-10 hover:text-gray-12"
            >
              {showPat() ? "隐藏" : "显示"}
            </button>
          </div>
          <div class="text-[11px] text-gray-7 mt-1">
            在 TFS 用户设置 → 安全 → 个人访问令牌 中生成
          </div>
        </label>

        <label class="block">
          <div class="text-xs text-gray-10 mb-1.5">用户名（可选）</div>
          <input
            type="text"
            value={config().username || ""}
            onInput={(e) =>
              updateConfig({
                username: e.currentTarget.value || null,
              })
            }
            placeholder="DOMAIN\username"
            class="w-full rounded-md border border-gray-6 bg-white px-3 py-2 text-xs text-gray-12"
          />
        </label>
      </div>

      <div class="pt-2 border-t border-gray-6/30">
        <div class="text-[11px] text-gray-7 space-y-1">
          <p>配置说明：</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li>PAT 令牌需要有工作项读取和写入权限</li>
            <li>配置将保存在浏览器本地存储中</li>
            <li>令牌仅用于本地 TFS 连接，不会上传到服务器</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
