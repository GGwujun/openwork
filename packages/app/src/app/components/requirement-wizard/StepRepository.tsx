// app/components/requirement-wizard/StepRepository.tsx
// Step 2: 仓库选择

import { Show, For, createSignal } from "solid-js";
import {
  Check,
  GitBranch,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Plus,
  Loader2 as Loader2Icon,
} from "lucide-solid";
import type {
  RepositoryMatch,
  DetectionResult,
} from "../../../types/requirement-analyzer";
import Button from "../../components/button";

interface StepRepositoryProps {
  detection: DetectionResult | null;
  selectedRepos: RepositoryMatch[];
  onToggleRepo: (repo: RepositoryMatch) => void;
  onBack: () => void;
  onNext: () => void;
  onGenerate?: () => void;
  hasPlan?: boolean;
  isAutoGenerating?: boolean;
}
export default function StepRepository(props: StepRepositoryProps) {
  const [showSecondary, setShowSecondary] = createSignal(false);
  const [showManualAdd, setShowManualAdd] = createSignal(false);

  const selectedCount = () => props.selectedRepos.length;
  const isSelected = (repo: RepositoryMatch) =>
    props.selectedRepos.some((r) => r.id === repo.id);

  return (
    <div class="space-y-6">
      {/* Primary Repositories */}
      <div>
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm font-medium text-dls-text">
            主要修改仓库
            <span class="text-xs text-dls-secondary font-normal ml-2">
              置信度较高，建议修改
            </span>
          </div>
          <Show when={props.detection}>
            <span class="text-xs text-dls-secondary">
              置信度: {Math.round((props.detection?.confidence || 0) * 100)}%
            </span>
          </Show>
        </div>

        <Show
          when={
            props.detection?.primary && props.detection.primary.length > 0
          }
          fallback={
            <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <AlertCircle
                size={20}
                class="text-amber-500 mx-auto mb-2"
              />
              <p class="text-sm text-amber-700">
                未能自动识别到主要仓库
              </p>
              <p class="text-xs text-amber-600 mt-1">
                请在下方手动选择或添加仓库
              </p>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={props.detection?.primary}>
              {(repo) => (
                <RepositoryCard
                  repo={repo}
                  selected={isSelected(repo)}
                  onToggle={() => props.onToggleRepo(repo)}
                />
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Secondary Repositories */}
      <Show
        when={
          props.detection?.secondary && props.detection.secondary.length > 0
        }
      >
        <div>
          <button
            onClick={() => setShowSecondary(!showSecondary())}
            class="flex items-center gap-2 text-sm text-dls-secondary hover:text-dls-text transition-colors"
          >
            {showSecondary() ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
            可能影响的仓库 ({props.detection?.secondary.length})
          </button>

          <Show when={showSecondary()}>
            <div class="mt-3 space-y-2">
              <For each={props.detection?.secondary}>
                {(repo) => (
                  <RepositoryRow
                    repo={repo}
                    selected={isSelected(repo)}
                    onToggle={() => props.onToggleRepo(repo)}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Manual Add */}
      <div class="pt-4 border-t border-dls-border">
        <button
          onClick={() => setShowManualAdd(!showManualAdd())}
          class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          <Plus size={16} />
          {showManualAdd() ? "取消手动添加" : "手动添加仓库"}
        </button>

        <Show when={showManualAdd()}>
          <div class="mt-3 p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-500 mb-2">
              如需添加配置文件外的仓库，请编辑 repositories.json
            </p>
            <code class="text-xs bg-gray-200 px-2 py-1 rounded">
              packages/app/src/config/repositories.json
            </code>
          </div>
        </Show>
      </div>

      {/* Selected Summary */}
      <Show when={selectedCount() > 0}>
        <div class="p-3 bg-blue-50 rounded-lg">
          <div class="text-sm text-blue-700">
            已选择 <span class="font-semibold">{selectedCount()}</span> 个仓库
          </div>
        </div>
      </Show>

      {/* Footer Buttons */}
      <Show
        when={!props.isAutoGenerating}
        fallback={(
          <div class="flex justify-center pt-4 border-t border-dls-border">
            <div class="flex items-center gap-2 text-blue-600">
              <Loader2Icon size={20} class="animate-spin" />
              <span class="text-sm font-medium">正在自动生成开发计划...
              </span>
            </div>
          </div>
        )}
      >
        <div class="flex justify-between pt-4 border-t border-dls-border">
          <Button variant="outline" onClick={props.onBack}>
            上一步
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              props.onNext();
              props.onGenerate?.();
            }}
            disabled={selectedCount() === 0}
          >
            {props.hasPlan ? '查看计划' : '生成开发计划'}
          </Button>
        </div>
      </Show>
    </div>
  );
}

// Repository Card Component (Primary)
function RepositoryCard(props: {
  repo: RepositoryMatch;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={props.onToggle}
      class={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        props.selected
          ? "border-blue-500 bg-blue-50"
          : "border-dls-border hover:border-blue-300"
      }`}
    >
      <div class="flex items-start gap-3">
        {/* <div
          class={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
            props.selected
              ? "bg-blue-500 border-blue-500"
              : "border-gray-300 bg-white"
          }`}
        >
          <Show when={props.selected}>
            <Check size={12} class="text-white" />
          </Show>
        </div> */}

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <GitBranch size={16} class="text-dls-secondary flex-shrink-0" />
            <span class="font-medium text-dls-text">{props.repo.name}</span>
            <ConfidenceBadge confidence={props.repo.confidence} />
          </div>
          <p class="text-sm text-dls-secondary text-sm">
            {props.repo.description}
          </p>
          <div class="mt-2 flex items-center gap-2">
            <span class="text-xs text-dls-secondary">
              匹配: {props.repo.reason}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Repository Row Component (Secondary)
function RepositoryRow(props: {
  repo: RepositoryMatch;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={props.onToggle}
      class={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        props.selected
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div
        class={`w-4 h-4 rounded border flex items-center justify-center ${
          props.selected ? "bg-blue-500 border-blue-500" : "border-gray-300"
        }`}
      >
        <Show when={props.selected}>
          <Check size={10} class="text-white" />
        </Show>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-dls-text">
            {props.repo.name}
          </span>
          <ConfidenceBadge confidence={props.repo.confidence} small />
        </div>
        <p class="text-xs text-dls-secondary truncate">
          {props.repo.reason}
        </p>
      </div>
    </div>
  );
}

// Confidence Badge Component
function ConfidenceBadge(props: { confidence: number; small?: boolean }) {
  const percentage = Math.round(props.confidence * 100);
  const color =
    percentage >= 80
      ? "bg-emerald-100 text-emerald-700"
      : percentage >= 60
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-600";

  return (
    <span
      class={`${color} ${
        props.small ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-0.5"
      } rounded font-medium`}
    >
      {percentage}%
    </span>
  );
}
