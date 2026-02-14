import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

import { Copy, X } from "lucide-solid";

import Button from "./button";
import { currentLocale, t } from "../../i18n";

type ShareField = {
  label: string;
  value: string;
  secret?: boolean;
  placeholder?: string;
  hint?: string;
};

export default function ShareWorkspaceModal(props: {
  open: boolean;
  onClose: () => void;
  title?: string;
  workspaceName: string;
  workspaceDetail?: string | null;
  fields: ShareField[];
  note?: string | null;
  onExportConfig?: () => void;
  exportDisabledReason?: string | null;
  onOpenBots?: () => void;
}) {
  let firstCopyRef: HTMLButtonElement | undefined;

  const translate = (key: string) => t(key, currentLocale());
  const title = createMemo(() => props.title ?? translate("share_workspace.title"));
  const detail = createMemo(() => props.workspaceDetail?.trim() ?? "");
  const note = createMemo(() => props.note?.trim() ?? "");

  const [revealedByIndex, setRevealedByIndex] = createSignal<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);

  createEffect(() => {
    if (!props.open) return;
    setRevealedByIndex({});
    setCopiedKey(null);
    requestAnimationFrame(() => firstCopyRef?.focus());
  });

  const maskValue = (value: string) => (value ? "************" : "");

  const handleCopy = async (value: string, key: string) => {
    const text = value?.trim() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 900);
    } catch {
      // ignore
    }
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-1/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div
          class="bg-gray-2 border border-gray-6 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
        >
          <div class="p-6 border-b border-gray-6 flex justify-between items-center bg-gray-1">
            <div class="min-w-0">
              <h3 class="font-semibold text-gray-12 text-lg">{title()}</h3>
              <div class="text-sm text-gray-10 truncate">{props.workspaceName}</div>
              <Show when={detail()}>
                <div class="text-xs text-gray-8 font-mono truncate">{detail()}</div>
              </Show>
            </div>
            <button
              onClick={props.onClose}
              class="hover:bg-gray-4 p-1 rounded-full"
              aria-label={translate("share_workspace.close")}
              title={translate("share_workspace.close")}
            >
              <X size={20} class="text-gray-10" />
            </button>
          </div>

          <div class="p-6 flex-1 overflow-y-auto space-y-6">
            <div class="space-y-2">
              <div class="text-sm font-medium text-gray-12">{translate("share_workspace.access_title")}</div>
              <div class="text-xs text-gray-10">
                {translate("share_workspace.access_hint")}
              </div>
            </div>

            <div class="grid gap-3">
              <For each={props.fields}>
                {(field, index) => {
                  const key = () => `${field.label}:${index()}`;
                  const isSecret = () => Boolean(field.secret);
                  const revealed = () => Boolean(revealedByIndex()[index()]);
                  const shownValue = () =>
                    isSecret() && !revealed() ? maskValue(field.value) : field.value;

                  return (
                    <div class="flex items-center justify-between bg-gray-1 p-3 rounded-xl border border-gray-6 gap-3">
                      <div class="min-w-0">
                        <div class="text-xs font-medium text-gray-11">{field.label}</div>
                        <div class="text-xs text-gray-7 font-mono truncate">
                          {shownValue() || field.placeholder || "-"}
                        </div>
                        <Show when={field.hint && field.hint.trim()}>
                          <div class="text-[11px] text-gray-8 mt-1">{field.hint}</div>
                        </Show>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <Show when={isSecret()}>
                          <Button
                            variant="outline"
                            class="text-xs h-8 py-0 px-3"
                            onClick={() =>
                              setRevealedByIndex((prev) => ({
                                ...prev,
                                [index()]: !prev[index()],
                              }))
                            }
                            disabled={!field.value}
                          >
                            {revealed()
                              ? translate("share_workspace.hide")
                              : translate("share_workspace.show")}
                          </Button>
                        </Show>
                        <Button
                          ref={(el) => {
                            if (index() === 0) firstCopyRef = el;
                          }}
                          variant="outline"
                          class="text-xs h-8 py-0 px-3"
                          onClick={() => handleCopy(field.value, key())}
                          disabled={!field.value}
                        >
                          <Copy size={14} />
                          {copiedKey() === key()
                            ? translate("share_workspace.copied")
                            : translate("share_workspace.copy")}
                        </Button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>

            <Show when={note()}>
              <div class="rounded-xl border border-gray-6 bg-gray-1/40 px-4 py-3 text-xs text-gray-10">
                {note()}
              </div>
            </Show>

            <div class="rounded-2xl border border-gray-6 bg-gray-1/30 p-4 space-y-3">
              <div>
                <div class="text-sm font-medium text-gray-12">{translate("share_workspace.config_title")}</div>
                <div class="text-xs text-gray-10">{translate("share_workspace.config_hint")}</div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="text-xs text-gray-9">
                  {props.exportDisabledReason?.trim() || translate("share_workspace.export_desktop_only")}
                </div>
                <Button
                  variant="outline"
                  class="text-xs h-8 py-0 px-3 shrink-0"
                  onClick={() => props.onExportConfig?.()}
                  disabled={!props.onExportConfig || Boolean(props.exportDisabledReason)}
                >
                  {translate("share_workspace.export")}
                </Button>
              </div>
            </div>

            <div class="rounded-2xl border border-gray-6 bg-gray-1/30 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-gray-12">{translate("share_workspace.bots_title")}</div>
                  <div class="text-xs text-gray-10">{translate("share_workspace.bots_hint")}</div>
                </div>
                <span class="text-[10px] px-2 py-1 rounded-full border border-gray-6 text-gray-10">
                  {translate("share_workspace.alpha")}
                </span>
              </div>
              <div class="flex justify-end">
                <Button
                  variant="outline"
                  class="text-xs h-8 py-0 px-3"
                  onClick={() => props.onOpenBots?.()}
                  disabled={!props.onOpenBots}
                >
                  {translate("share_workspace.open_bots_settings")}
                </Button>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-gray-6 bg-gray-1 flex justify-end">
            <Button variant="ghost" onClick={props.onClose}>
              {translate("share_workspace.close")}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
}
