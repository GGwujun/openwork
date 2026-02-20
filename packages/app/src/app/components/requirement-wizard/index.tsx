// app/components/requirement-wizard/index.tsx
// Requirement Analysis Wizard - 需求分析向导主容器

import { Show } from "solid-js";
import { X, Loader2 } from "lucide-solid";
import type {
  ParsedRequirement,
  RepositoryMatch,
  DetectionResult,
  PlanWizardState,
} from "../../../types/requirement-analyzer";

import Button from "../../components/button";
import StepAnalysis from "./StepAnalysis";
import StepRepository from "./StepRepository";
import StepGeneration from "./StepGeneration";

interface RequirementWizardProps {
  wizard: PlanWizardState;
  step: 1 | 2 | 3;
  requirement: ParsedRequirement | null;
  detection: DetectionResult | null;
  selectedRepos: RepositoryMatch[];
  isLoading: boolean;
  error: string | null;
  generationProgress: number;
  intent?: string;
  design?: string;
  tasks?: string;
  autoPlanStep?: 'idle' | 'analysis' | 'repos' | 'plan' | 'completed';
  autoPlanProgress?: number;
  onClose: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onToggleRepo: (repo: RepositoryMatch) => void;
  onGeneratePlan: () => void;
  onCreateDevelopmentPlan?: () => void;
}

export default function RequirementWizard(props: RequirementWizardProps) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-dls-border bg-dls-surface shadow-xl flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-dls-border px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-dls-text">生成开发计划</h2>
            <p class="text-sm text-dls-secondary mt-1">
              步骤 {props.step}/3: {getStepTitle(props.step)}
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="rounded-full p-2 text-dls-secondary hover:text-dls-text hover:bg-dls-hover transition-colors"
            disabled={props.isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div class="flex items-center justify-center gap-2 px-6 py-4 border-b border-dls-border bg-dls-hover/30">
          <StepDot step={1} current={props.step} label="需求分析" />
          <StepLine active={props.step >= 2} />
          <StepDot step={2} current={props.step} label="仓库识别" />
          <StepLine active={props.step >= 3} />
          <StepDot step={3} current={props.step} label="生成计划" />
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-6">
          <Show when={props.error}>
            <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <span class="font-medium">错误：</span>
              {props.error}
            </div>
          </Show>

          <Show when={props.step === 1}>
            <StepAnalysis
              requirement={props.requirement}
              isLoading={props.isLoading}
              progress={{
                stage: props.wizard?.stage || 'fetching',
                message: props.wizard?.message || '准备分析...',
                progress: props.generationProgress
              }}
              onNext={props.onNextStep}
            />
          </Show>

          <Show when={props.step === 2}>
            <StepRepository
              detection={props.detection}
              selectedRepos={props.selectedRepos}
              onToggleRepo={props.onToggleRepo}
              onBack={props.onPrevStep}
              onNext={props.onNextStep}
              onGenerate={props.onCreateDevelopmentPlan || props.onGeneratePlan}
            />
          </Show>

          <Show when={props.step === 3}>
            <StepGeneration
              progress={props.generationProgress}
              isLoading={props.isLoading}
              error={props.error}
              selectedRepos={props.selectedRepos}
              intent={props.intent}
              design={props.design}
              tasks={props.tasks}
              onGenerate={props.onGeneratePlan}
              onBack={props.onPrevStep}
            />
          </Show>
        </div>
      </div>
    </div>
  );
}

// Helper: 获取步骤标题
function getStepTitle(step: number): string {
  switch (step) {
    case 1:
      return "需求分析";
    case 2:
      return "仓库识别";
    case 3:
      return "生成计划";
    default:
      return "";
  }
}

// Step Indicator Components
function StepDot(props: { step: number; current: number; label: string }) {
  const isActive = props.step === props.current;
  const isCompleted = props.step < props.current;

  return (
    <div class="flex flex-col items-center gap-1">
      {/* 使用双层div确保可见性 - 外层背景 + 内层文字 */}
      <div
        class={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          isActive
            ? "bg-gradient-to-br from-blue-700 to-blue-900"
            : isCompleted
            ? "bg-gradient-to-br from-emerald-600 to-emerald-800"
            : "bg-gradient-to-br from-gray-200 to-gray-300"
        }`}
        style={{
          "box-shadow": "inset 0 2px 4px rgba(255,255,255,0.3), 0 4px 6px rgba(0,0,0,0.2)",
        }}
      >
        {/* 文字容器 - 添加描边效果 */}
        <span
          class="text-2xl font-black"
          style={{
            color: isActive || isCompleted ? "#ffffff" : "#1f2937",
            "text-shadow": isActive || isCompleted 
              ? "0 2px 4px rgba(0,0,0,0.5), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" // 黑色描边
              : "0 1px 2px rgba(255,255,255,0.8)",
            "-webkit-text-stroke": isActive || isCompleted ? "1px rgba(0,0,0,0.3)" : "none",
          }}
        >
          {isCompleted ? "✓" : props.step}
        </span>
      </div>
      <span
        class={`text-xs font-bold tracking-wide ${
          isActive ? "text-blue-900" : isCompleted ? "text-emerald-800" : "text-gray-800"
        }`}
      >
        {props.label}
      </span>
    </div>
  );
}

function StepLine(props: { active: boolean }) {
  return (
    <div
      class={`w-16 h-0.5 transition-colors ${
        props.active ? "bg-blue-500" : "bg-gray-200"
      }`}
    />
  );
}
