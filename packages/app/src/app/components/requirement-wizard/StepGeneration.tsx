// app/components/requirement-wizard/StepGeneration.tsx
// Step 3: 计划生成

import { Show, For, createSignal, createEffect } from "solid-js";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  GitBranch,
  RefreshCw,
  X,
} from "lucide-solid";
import type { RepositoryMatch } from "../../../types/requirement-analyzer";
import { Cloud, Check, Loader2 as Loader2Icon } from "lucide-solid";
import Button from "../../components/button";

interface StepGenerationProps {
  progress: number;
  isLoading: boolean;
  error: string | null;
  selectedRepos: RepositoryMatch[];
  intent?: string;
  design?: string;
  tasks?: string;
  onGenerate: () => void;
  onBack: () => void;
  onSyncToTFS?: () => Promise<boolean>;
  syncStatus?: {
    analysisSynced: boolean;
    planSynced: boolean;
    isSyncing: boolean;
    error?: string;
  };
}

export default function StepGeneration(props: StepGenerationProps) {
  const [activeDoc, setActiveDoc] = createSignal<"intent" | "design" | "tasks" | null>(null);

  // Debug: log props changes
  createEffect(() => {
    console.log("[StepGeneration] Props updated:", {
      intent: props.intent?.substring(0, 100),
      design: props.design?.substring(0, 100),
      tasks: props.tasks?.substring(0, 100),
      progress: props.progress,
    });
  });

  const getProgressStep = () => {
    if (props.progress < 30) return 1;
    if (props.progress < 60) return 2;
    if (props.progress < 100) return 3;
    return 4;
  };

  const viewDocument = (type: "intent" | "design" | "tasks") => {
    setActiveDoc(type);
  };

  const getActiveDocTitle = () => {
    switch (activeDoc()) {
      case "intent":
        return "需求意图 (intent.md)";
      case "design":
        return "技术设计 (design.md)";
      case "tasks":
        return "实施计划 (tasks.md)";
      default:
        return "";
    }
  };

  const getActiveDocContent = () => {
    switch (activeDoc()) {
      case "intent":
        return props.intent || "暂无内容";
      case "design":
        return props.design || "暂无内容";
      case "tasks":
        return props.tasks || "暂无内容";
      default:
        return "";
    }
  };

  return (
    <div class="space-y-6">
      {/* Document Viewer Modal */}
      <Show when={activeDoc()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div class="flex items-center justify-between px-6 py-4 border-b">
              <h3 class="text-lg font-medium text-gray-900">{getActiveDocTitle()}</h3>
              <button
                onClick={() => setActiveDoc(null)}
                class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div class="flex-1 overflow-auto p-6">
              <pre class="whitespace-pre-wrap font-mono text-sm text-gray-700 leading-relaxed">
                {getActiveDocContent()}
              </pre>
            </div>
          </div>
        </div>
      </Show>

      {/* Loading / Progress State */}
      <Show when={props.isLoading}>
        <div class="text-center py-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 mb-6">
            <Loader2 size={36} class="text-blue-500 animate-spin" />
          </div>

          <h3 class="text-lg font-medium text-dls-text mb-2">
            正在生成开发计划...
          </h3>

          {/* Progress Bar */}
          <div class="max-w-xs mx-auto mb-4">
            <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${props.progress}%` }}
              />
            </div>
            <div class="flex justify-between text-xs text-dls-secondary mt-2">
              <span class={getProgressStep() >= 1 ? "text-blue-600" : ""}>
                分析需求
              </span>
              <span class={getProgressStep() >= 2 ? "text-blue-600" : ""}>
                识别组件
              </span>
              <span class={getProgressStep() >= 3 ? "text-blue-600" : ""}>
                生成任务
              </span>
            </div>
          </div>

          <p class="text-sm text-dls-secondary">
            {getProgressStep() === 1 && "解析需求意图和关键功能..."}
            {getProgressStep() === 2 && "识别相关代码组件和依赖..."}
            {getProgressStep() === 3 && "生成实施计划和任务列表..."}
          </p>
        </div>
      </Show>

      {/* Error State */}
      <Show when={!props.isLoading && props.error}>
        <div class="text-center py-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 mb-6">
            <AlertCircle size={36} class="text-red-500" />
          </div>

          <h3 class="text-lg font-medium text-dls-text mb-2">生成失败</h3>
          <p class="text-sm text-dls-secondary mb-6 max-w-sm mx-auto">
            {props.error}
          </p>

          <div class="flex justify-center gap-3">
            <Button variant="outline" onClick={props.onBack}>
              返回修改
            </Button>
            <Button variant="primary" onClick={props.onGenerate}>
              <RefreshCw size={16} class="mr-2" />
              重新生成
            </Button>
          </div>
        </div>
      </Show>

      {/* Success State - 需要有实际文档内容 */}
      <Show when={!props.isLoading && !props.error && props.progress === 100 && (props.intent || props.design || props.tasks)}>
        <div class="text-center py-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
            <CheckCircle2 size={32} class="text-emerald-500" />
          </div>

          <h3 class="text-lg font-medium text-dls-text mb-2">
            计划生成完成
          </h3>
          <p class="text-sm text-dls-secondary mb-6">
            已基于选择的 {props.selectedRepos.length} 个仓库生成完整计划
          </p>

          {/* Selected Repos Summary */}
          <div class="mb-6">
            <div class="text-sm font-medium text-dls-text mb-2 text-left">
              涉及的仓库
            </div>
            <div class="flex flex-wrap gap-2">
              <For each={props.selectedRepos}>
                {(repo) => (
                  <div class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                    <GitBranch size={14} class="text-gray-500" />
                    <span>{repo.name}</span>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Generated Documents */}
          <div class="mb-6">
            <div class="text-sm font-medium text-dls-text mb-3 text-left">
              生成的文档
            </div>
            <div class="grid grid-cols-3 gap-3">
              <DocumentCard
                icon={FileText}
                title="intent.md"
                description="需求意图"
                color="blue"
                onClick={() => viewDocument("intent")}
              />
              <DocumentCard
                icon={FileText}
                title="design.md"
                description="技术设计"
                color="amber"
                onClick={() => viewDocument("design")}
              />
              <DocumentCard
                icon={FileText}
                title="tasks.md"
                description="实施计划"
                color="emerald"
                onClick={() => viewDocument("tasks")}
              />
            </div>
          </div>
          {/* Sync to TFS Card Button */}
          <Show when={props.onSyncToTFS}>

            <div 
              class={`mb-6 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                props.syncStatus?.isSyncing
                  ? 'bg-blue-50 border-blue-300 cursor-wait'
                  : props.syncStatus?.analysisSynced && props.syncStatus?.planSynced
                  ? 'bg-emerald-50 border-emerald-300 cursor-default'
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
              }`}
              onClick={async () => {
                console.log('[StepGeneration] Sync button clicked', {
                  isSyncing: props.syncStatus?.isSyncing,
                  analysisSynced: props.syncStatus?.analysisSynced,
                  planSynced: props.syncStatus?.planSynced,
                  hasOnSyncToTFS: !!props.onSyncToTFS
                });
                if (!props.syncStatus?.isSyncing && !(props.syncStatus?.analysisSynced && props.syncStatus?.planSynced)) {
                  try {
                    console.log('[StepGeneration] Calling onSyncToTFS...');
                    const result = await props.onSyncToTFS?.();
                    console.log('[StepGeneration] onSyncToTFS result:', result);
                  } catch (error) {
                    console.error('[StepGeneration] Sync to TFS failed:', error);
                    // 错误已经在 task-center.ts 中设置到 syncStatus.error
                  }
                } else {
                  console.log('[StepGeneration] Sync skipped - already syncing or already synced');
                }
              }}>

            <div class="flex items-center justify-between">

                <div class="flex items-center gap-3">
                  <div class={`p-2 rounded-lg ${
                    props.syncStatus?.analysisSynced && props.syncStatus?.planSynced
                      ? 'bg-emerald-100'
                      : props.syncStatus?.isSyncing
                      ? 'bg-blue-100'
                      : 'bg-blue-100'
                  }`}>
                    <Show
                      when={props.syncStatus?.analysisSynced && props.syncStatus?.planSynced}
                      fallback={
                        <Show
                          when={props.syncStatus?.isSyncing}
                          fallback={<Cloud size={20} class="text-blue-600" />}
                        >
                          <Loader2Icon size={20} class="text-blue-600 animate-spin" />
                        </Show>
                      }
                    >
                      <Check size={20} class="text-emerald-600" />
                    </Show>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-dls-text">
                      {props.syncStatus?.analysisSynced && props.syncStatus?.planSynced
                        ? '已同步到 TFS'
                        : props.syncStatus?.isSyncing
                        ? '正在同步...'
                        : '同步到 TFS'}
                    </div>
                    <p class="text-xs text-dls-secondary">
                      {props.syncStatus?.error
                        ? <span class="text-red-500">错误: {props.syncStatus.error}</span>
                        : props.syncStatus?.analysisSynced && props.syncStatus?.planSynced
                        ? '分析结果和开发计划已同步到 TFS 子任务'
                        : props.syncStatus?.analysisSynced
                        ? '分析结果已同步，点击同步开发计划'
                        : props.syncStatus?.planSynced
                        ? '开发计划已同步，点击同步分析结果'
                        : '点击将分析结果和开发计划同步到 TFS'}
                    </p>
                  </div>
                </div>
                
                {/* Sync Status Badge */}
                <Show when={props.syncStatus?.analysisSynced || props.syncStatus?.planSynced}>
                  <div class="flex flex-col gap-1 items-end">
                    <Show when={props.syncStatus?.analysisSynced}>
                      <span class="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                        分析 ✓
                      </span>
                    </Show>
                    <Show when={props.syncStatus?.planSynced}>
                      <span class="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                        计划 ✓
                      </span>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
          

          {/* Action Buttons */}
          <div class="flex justify-center gap-3">
            <Button variant="outline" onClick={props.onBack}>
              返回查看
            </Button>
            <Button variant="primary" onClick={props.onGenerate}>
              开始执行
            </Button>
          </div>
        </div>
      </Show>

      {/* Initial State - Start Generation */}
      <Show
        when={
          !props.isLoading && !props.error && props.progress === 0
        }
      >
        <div class="text-center py-8">
          <h3 class="text-lg font-medium text-dls-text mb-2">
            准备生成计划
          </h3>
          <p class="text-sm text-dls-secondary mb-6">
            确认仓库选择后，将调用 OpenCode 引擎生成完整开发计划
          </p>

          <div class="flex justify-center gap-3">
            <Button variant="outline" onClick={props.onBack}>
              返回修改
            </Button>
            <Button variant="primary" onClick={props.onGenerate}>
              确认并生成
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}

// Document Card Component
function DocumentCard(props: {
  icon: typeof FileText;
  title: string;
  description: string;
  color: "blue" | "amber" | "emerald";
  onClick: () => void;
}) {
  const Icon = props.icon;
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer",
    amber: "bg-amber-50 border-amber-200 hover:bg-amber-100 cursor-pointer",
    emerald: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer",
  };

  return (
    <div
      onClick={props.onClick}
      class={`p-4 rounded-xl border text-center transition-colors ${colorClasses[props.color]}`}
    >
      <Icon size={20} class="mx-auto mb-2 text-gray-600" />
      <div class="text-sm font-medium text-dls-text">{props.title}</div>
      <div class="text-xs text-dls-secondary">{props.description}</div>
      <div class="mt-1 text-xs text-blue-600">点击查看</div>
    </div>
  );
}
