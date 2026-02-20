// app/components/ai-requirement-analyzer/index.tsx
// AI 需求分析组件 - 包含分析状态和仓库确认界面

import { Show, For, createSignal, createEffect, Switch, Match } from 'solid-js';
import { Loader2, Sparkles, GitBranch, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-solid';
import type { 
  AIAnalysisResult, 
  AIRepositoryMatch, 
  AIRepoDetectionResult,
  AnalysisProgress 
} from '../../../api/requirement-analyzer';
import Button from '../button';

// 分析状态
interface AIAnalysisState {
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  progress: AnalysisProgress | null;
  result?: {
    requirement: AIAnalysisResult;
    repos: AIRepoDetectionResult;
  };
  error?: string;
}

// 组件 Props
interface AIRequirementAnalyzerProps {
  workItemId: number;
  onAnalysisComplete?: (result: {
    requirement: AIAnalysisResult;
    repos: AIRepoDetectionResult;
    selectedRepos: AIRepositoryMatch[];
  }) => void;
  onCancel?: () => void;
}

export default function AIRequirementAnalyzer(props: AIRequirementAnalyzerProps) {
  const [state, setState] = createSignal<AIAnalysisState>({
    status: 'idle',
    progress: null
  });
  
  // 获取配置 (必须在组件顶层调用 hooks)
  const tfsConfig = useTfsConfig();
  const client = useClient();
  
  // 用户选择的仓库
  const [selectedPrimary, setSelectedPrimary] = createSignal<AIRepositoryMatch[]>([]);
  const [selectedSecondary, setSelectedSecondary] = createSignal<AIRepositoryMatch[]>([]);
  
  // 开始 AI 分析
  const startAnalysis = async () => {
    setState({ status: 'analyzing', progress: null });
    
    try {
      if (!tfsConfig) {
        throw new Error('TFS 未配置');
      }
      
      // 创建带有进度回调的分析器
      const analyzer = createRequirementAnalyzer(
        new TFSClient(tfsConfig),
        () => client(),
        undefined, // 使用默认模型
        (progress) => {
          // 更新进度到状态
          if (progress) {
            setState(prev => ({ ...prev, progress }));
          }
        }
      );
      
      // 执行真实分析
      const result = await analyzer.analyze(props.workItemId);
      
      // 设置完成状态
      setState({
        status: 'completed',
        progress: { stage: 'completed', message: 'AI 分析完成', progress: 100 },
        result: {
          requirement: {
            summary: result.summary,
            keyFeatures: result.keyFeatures,
            techStack: result.techIndicators,
            domain: result.domain,
            keywords: result.domainKeywords
          },
          repos: result.aiRepos
        }
      });
      
      // 默认全选主要仓库
      setSelectedPrimary(result.aiRepos.primaryRepos);
      setSelectedSecondary(result.aiRepos.secondaryRepos);
      
    } catch (error) {
      setState({
        status: 'error',
        progress: null,
        error: error instanceof Error ? error.message : 'AI 分析失败'
      });
    }
  };
  
  // 确认仓库选择
  const confirmSelection = () => {
    const result = state().result;
    if (!result) return;
    
    // 主要仓库默认全选，次要仓库由用户选择
    props.onAnalysisComplete?.({
      requirement: result.requirement,
      repos: result.repos,
      selectedRepos: [...result.repos.primaryRepos, ...selectedSecondary()]
    });
  };
  
  // 切换仓库选择
  const togglePrimary = (repo: AIRepositoryMatch) => {
    setSelectedPrimary(prev => 
      prev.find(r => r.id === repo.id)
        ? prev.filter(r => r.id !== repo.id)
        : [...prev, repo]
    );
  };
  
  const toggleSecondary = (repo: AIRepositoryMatch) => {
    setSelectedSecondary(prev => 
      prev.find(r => r.id === repo.id)
        ? prev.filter(r => r.id !== repo.id)
        : [...prev, repo]
    );
  };
  
  // 自动开始分析
  createEffect(() => {
    if (props.workItemId && state().status === 'idle') {
      startAnalysis();
    }
  });
  
  return (
    <div class="space-y-6">
      <Switch>
        {/* 分析中状态 */}
        <Match when={state().status === 'analyzing'}>
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
                {state().progress?.message || '准备分析...'}
              </p>
            </div>
            
            {/* 进度条 */}
            <div class="w-64 space-y-2">
              <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 rounded-full"
                  style={{ width: `${state().progress?.progress || 0}%` }}
                />
              </div>
              <div class="flex justify-between text-xs text-dls-secondary">
                <span>进度 {state().progress?.progress || 0}%</span>
                <span class="capitalize">{state().progress?.stage || '初始化'}</span>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={props.onCancel}>
              取消分析
            </Button>
          </div>
        </Match>
        
        {/* 分析完成 - 展示结果 */}
        <Match when={state().status === 'completed' && state().result}>
          <div class="space-y-6">
            {/* AI 摘要 */}
            <div class="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <div class="flex items-center gap-2 mb-2">
                <Sparkles size={18} class="text-blue-600" />
                <span class="text-sm font-medium text-blue-700">AI 摘要</span>
              </div>
              <p class="text-dls-text font-medium">
                {state().result!.requirement.summary}
              </p>
            </div>
            
            {/* 识别到的功能点 */}
            <div>
              <h4 class="text-sm font-medium text-dls-text mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} class="text-emerald-500" />
                识别到的功能点
              </h4>
              <div class="flex flex-wrap gap-2">
                <For each={state().result!.requirement.keyFeatures}>
                  {(feature) => (
                    <span class="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm rounded-full">
                      {feature}
                    </span>
                  )}
                </For>
              </div>
            </div>
            
            {/* 涉及技术层 */}
            <div>
              <h4 class="text-sm font-medium text-dls-text mb-3">涉及技术层</h4>
              <div class="flex gap-3">
                <Show when={state().result!.requirement.techStack.frontend}>
                  <span class="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-lg flex items-center gap-1.5">
                    <div class="w-2 h-2 bg-blue-500 rounded-full" />
                    前端
                  </span>
                </Show>
                <Show when={state().result!.requirement.techStack.backend}>
                  <span class="px-3 py-1.5 bg-purple-100 text-purple-700 text-sm rounded-lg flex items-center gap-1.5">
                    <div class="w-2 h-2 bg-purple-500 rounded-full" />
                    后端
                  </span>
                </Show>
                <Show when={state().result!.requirement.techStack.database}>
                  <span class="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm rounded-lg flex items-center gap-1.5">
                    <div class="w-2 h-2 bg-amber-500 rounded-full" />
                    数据库
                  </span>
                </Show>
              </div>
            </div>
            
            {/* AI 识别的仓库 */}
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-dls-text flex items-center gap-2">
                <GitBranch size={16} class="text-indigo-500" />
                AI 识别的仓库（请确认）
              </h4>
              
              {/* 主要仓库 - 默认全选，不显示选择框 */}
              <Show when={state().result!.repos.primaryRepos.length > 0}>
                <div class="space-y-2">
                  <div class="text-xs text-dls-secondary font-medium uppercase tracking-wider">
                    主要修改仓库
                  </div>
                  <For each={state().result!.repos.primaryRepos}>
                    {(repo) => (
                      <div class="flex items-start gap-3 p-3 bg-white border border-dls-border rounded-lg">
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-dls-text">{repo.name}</span>
                            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              置信度 {(repo.aiConfidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p class="text-sm text-dls-secondary mt-1">{repo.description}</p>
                          <p class="text-xs text-blue-600 mt-2">
                            <span class="font-medium">AI 判断：</span>
                            {repo.aiReason}
                          </p>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              
              {/* 次要仓库 */}
              <Show when={state().result!.repos.secondaryRepos.length > 0}>
                <div class="space-y-2">
                  <div class="text-xs text-dls-secondary font-medium uppercase tracking-wider">
                    次要影响仓库
                  </div>
                  <For each={state().result!.repos.secondaryRepos}>
                    {(repo) => (
                      <label class="flex items-start gap-3 p-3 bg-white border border-dls-border rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedSecondary().find(r => r.id === repo.id) !== undefined}
                          onChange={() => toggleSecondary(repo)}
                          class="mt-1 w-4 h-4 text-gray-600 rounded border-gray-300"
                        />
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-dls-text">{repo.name}</span>
                            <span class="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                              置信度 {(repo.aiConfidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p class="text-sm text-dls-secondary mt-1">{repo.description}</p>
                          <p class="text-xs text-gray-600 mt-2">{repo.aiReason}</p>
                        </div>
                      </label>
                    )}
                  </For>
                </div>
              </Show>
              
              {/* AI 分析说明 */}
              <Show when={state().result!.repos.analysis}>
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p class="text-xs text-slate-600">
                    <span class="font-medium">AI 分析：</span>
                    {state().result!.repos.analysis}
                  </p>
                </div>
              </Show>
            </div>
            
            {/* 操作按钮 */}
            <div class="flex gap-3 pt-4 border-t border-dls-border">
            <Button 
              variant="primary" 
              onClick={confirmSelection}
              disabled={selectedSecondary().length === 0 && state().result!.repos.secondaryRepos.length > 0}
            >
              确认选择（{state().result!.repos.primaryRepos.length} 个主要仓库
              <Show when={selectedSecondary().length > 0}>
                + {selectedSecondary().length} 个次要仓库
              </Show>
              ）
            </Button>
              <Button variant="ghost" onClick={() => setState({ status: 'idle', progress: null })}>
                <RefreshCw size={16} class="mr-1.5" />
                重新分析
              </Button>
            </div>
          </div>
        </Match>
        
        {/* 错误状态 */}
        <Match when={state().status === 'error'}>
          <div class="flex flex-col items-center justify-center py-12 space-y-4">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle size={32} class="text-red-500" />
            </div>
            <div class="text-center space-y-2">
              <h3 class="text-lg font-medium text-dls-text">AI 分析失败</h3>
              <p class="text-sm text-dls-secondary max-w-sm">
                {state().error}
              </p>
            </div>
            <div class="flex gap-3">
              <Button variant="primary" onClick={startAnalysis}>
                <RefreshCw size={16} class="mr-1.5" />
                重试
              </Button>
              <Button variant="ghost" onClick={props.onCancel}>
                取消
              </Button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

export type { AIAnalysisState, AIRequirementAnalyzerProps };
