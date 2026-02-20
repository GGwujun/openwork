// app/components/requirement-wizard/StepAnalysis.tsx
// Step 1: 需求分析展示

import { Show, For, createMemo } from "solid-js";
import { Loader2, Sparkles, Monitor, Server, Database } from "lucide-solid";
import type { ParsedRequirement } from "../../../types/requirement-analyzer";
import Button from "../../components/button";

// Get raw HTML content for rich text display - prefer raw (HTML) versions
const getDisplayContent = (req: ParsedRequirement | null): string => {
  if (!req) return '';
  // Use raw HTML versions first (contains original formatting from TFS)
  // Fallback to cleaned text versions if raw not available
  return req.rawDemandAnalysis || 
         req.rawAcceptanceCriteria || 
         req.rawDescription ||
         req.demandAnalysis || 
         req.acceptanceCriteria || 
         req.description || 
         '';
};

interface StepAnalysisProps {
  requirement: ParsedRequirement | null;
  isLoading: boolean;
  progress?: {
    stage: string;
    message: string;
    progress: number;
  } | null;
  onNext: () => void;
}

export default function StepAnalysis(props: StepAnalysisProps) {
  // Memoize the content to prevent re-processing
  const displayContent = createMemo(() => {
    // Return raw HTML content directly from TFS
    return getDisplayContent(props.requirement);
  });

  const hasContent = createMemo(() => {
    return !!props.requirement?.demandAnalysis || 
           !!props.requirement?.acceptanceCriteria || 
           !!props.requirement?.description;
  });

  return (
    <div class="space-y-6">
      {/* Loading State with Progress */}
      <Show when={props.isLoading}>
        <div class="flex flex-col items-center justify-center py-12 space-y-4">
          <div class="relative">
            <Loader2 size={48} class="text-blue-500 animate-spin" />
            <div class="absolute inset-0 flex items-center justify-center">
              <Sparkles size={20} class="text-blue-300" />
            </div>
          </div>
          
          <div class="text-center space-y-2">
            <h3 class="text-lg font-medium text-dls-text">
              AI 智能分析中
            </h3>
            <p class="text-sm text-dls-secondary">
              {props.progress?.message || '准备分析...'}
            </p>
          </div>
          
          {/* 进度条 */}
          <div class="w-64 space-y-2">
            <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 rounded-full"
                style={{ width: `${props.progress?.progress || 0}%` }}
              />
            </div>
            <div class="flex justify-between text-xs text-dls-secondary">
              <span>进度 {props.progress?.progress || 0}%</span>
              <span class="capitalize">{props.progress?.stage || '初始化'}</span>
            </div>
          </div>
        </div>
      </Show>

      {/* Content */}
      <Show when={!props.isLoading && props.requirement}>
        <div class="space-y-6">
          {/* Work Item Info */}
          <div class="p-4 bg-dls-hover/50 rounded-xl border border-dls-border">
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                #{props.requirement?.workItemId}
              </span>
              <h3 class="font-medium text-dls-text">
                {props.requirement?.title}
              </h3>
            </div>
            {/* 优先显示需求分析内容，其次验收标准，最后显示描述 */}
            <div class="max-h-[200px] overflow-y-auto rounded-lg border border-dls-border bg-dls-surface p-3">
              <Show when={hasContent()} fallback={
                <p class="text-sm text-dls-secondary">暂无需求分析内容</p>
              }>
                {/* Use dangerouslySetInnerHTML equivalent for SolidJS */}
                <div 
                  class="text-sm text-dls-text leading-relaxed [&_div]:mb-2 [&_p]:mb-2 [&_br]:block [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_em]:italic [&_a]:text-blue-600 [&_a]:underline"
                  innerHTML={displayContent()}
                />
              </Show>
            </div>
          </div>

          {/* AI Summary */}
          <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div class="flex items-start gap-3">
              <Sparkles size={20} class="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <div class="text-xs text-amber-600 font-medium mb-1">
                  AI 摘要
                </div>
                <div class="text-sm text-amber-900">
                  {props.requirement?.summary}
                </div>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div>
            <div class="text-sm font-medium text-dls-text mb-2">
              识别到的功能点
            </div>
            <Show
              when={
                props.requirement?.keyFeatures &&
                props.requirement.keyFeatures.length > 0
              }
              fallback={
                <p class="text-sm text-dls-secondary">
                  未能提取明确的功能点
                </p>
              }
            >
              <div class="flex flex-wrap gap-2">
                <For each={props.requirement?.keyFeatures}>
                  {(feature) => (
                    <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {feature}
                    </span>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Domain Keywords */}
          <Show
            when={
              props.requirement?.domainKeywords &&
              props.requirement.domainKeywords.length > 0
            }
          >
            <div>
              <div class="text-sm font-medium text-dls-text mb-2">
                领域关键词
              </div>
              <div class="flex flex-wrap gap-1.5">
                <For each={props.requirement?.domainKeywords}>
                  {(keyword) => (
                    <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {keyword}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Footer Buttons */}
      <div class="flex justify-end pt-4 border-t border-dls-border">
        <Button
          variant="primary"
          onClick={props.onNext}
          disabled={props.isLoading || !props.requirement}
        >
          下一步：识别仓库
        </Button>
      </div>
    </div>
  );
}

// Tech Indicator Component
function TechIndicator(props: {
  icon: typeof Monitor;
  label: string;
  active: boolean | undefined;
}) {
  const Icon = props.icon;
  return (
    <div
      class={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        props.active
          ? "bg-blue-50 border-blue-200 text-blue-700"
          : "bg-gray-50 border-gray-200 text-gray-400"
      }`}
    >
      <Icon size={16} />
      <span class="text-sm">{props.label}</span>
    </div>
  );
}
