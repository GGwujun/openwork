// api/requirement-analyzer/index.ts
// Task Center 需求智能分析器 - 使用 OpenCode 引擎
// 使用 client.session.promptAsync() API（与 sendPrompt 相同）

import { TFSClient } from '../tfs';
import { unwrap } from '../../app/lib/opencode';
import repoConfig from '../../config/repositories.json' assert { type: 'json' };
import type {
  ParsedRequirement,
  RepositoryMatch,
  DetectionResult,
  RepositoryIndex,
  RepositoryConfig,
  TFSWorkItem,
} from '../../types';

import type {
  Client
} from '../../app/types';

// AI 分析结果类型
export interface AIAnalysisResult {
  summary: string;
  keyFeatures: string[];
  techStack: {
    frontend: boolean;
    backend: boolean;
    database: boolean;
  };
  domain: string;
  keywords: string[];
}

// AI 仓库匹配结果
export interface AIRepositoryMatch extends RepositoryMatch {
  aiReason: string;
  aiConfidence: number;
}

// AI 仓库识别结果
export interface AIRepoDetectionResult {
  primaryRepos: AIRepositoryMatch[];
  secondaryRepos: AIRepositoryMatch[];
  analysis: string;
}

// 分析进度回调
export interface AnalysisProgress {
  stage: 'fetching' | 'analyzing' | 'detecting_repos' | 'completed' | 'error';
  message: string;
  progress: number; // 0-100
}

export type ProgressCallback = (progress: AnalysisProgress) => void;

/**
 * 需求智能分析器（OpenCode 引擎版）
 * 使用 client.session.promptAsync() API（与 sendPrompt 相同）
 */
export class RequirementAnalyzer {
  private tfsClient: TFSClient;
  private getClient: () => Client | null;
  private getModel: () => { providerID: string; modelID: string } | null;
  private config: RepositoryIndex;
  private onProgress?: ProgressCallback;

  // 置信度阈值
  private readonly CONFIDENCE_THRESHOLD = 0.8;

  constructor(
    tfsClient: TFSClient,
    getClient: () => Client | null,
    getModel?: () => { providerID: string; modelID: string } | null,
    onProgress?: ProgressCallback
  ) {
    this.tfsClient = tfsClient;
    this.getClient = getClient;
    this.getModel = getModel || (() => null);
    this.config = repoConfig as RepositoryIndex;
    this.onProgress = onProgress;
    
    // 验证配置加载
    if (!this.config || !Array.isArray(this.config.repositories)) {
      console.error('[RequirementAnalyzer] 仓库配置加载失败:', repoConfig);
      this.config = { repositories: [], rules: { keywordScore: 1, techStackScore: 1, primaryThreshold: 0.8, secondaryThreshold: 0.6 } };
    }
  }

  private reportProgress(progress: AnalysisProgress) {
    console.log(`[AI分析] ${progress.stage}: ${progress.message} (${progress.progress}%)`);
    this.onProgress?.(progress);
  }

  /**
   * 使用 promptAsync API 发送 prompt
   * 参考 sendPrompt 实现，支持自动重试
   */
  private async sendPromptToAI(
    prompt: string,
    systemPrompt?: string,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[sendPromptToAI] 第 ${attempt}/${maxRetries} 次尝试...`);
        const result = await this.sendPromptToAIOnce(prompt, systemPrompt);
        console.log(`[sendPromptToAI] 第 ${attempt} 次尝试成功`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[sendPromptToAI] 第 ${attempt} 次尝试失败:`, lastError.message);
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // 2s, 4s, 6s
          console.log(`[sendPromptToAI] 等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`AI 分析失败（已重试 ${maxRetries} 次）: ${lastError?.message}`);
  }

  /**
   * 单次发送 prompt（内部方法）
   */
  private async sendPromptToAIOnce(
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    const client = this.getClient();
    if (!client) {
      throw new Error('OpenCode 客户端未连接');
    }

    // 创建临时 session（空 session，prompt 通过 promptAsync 发送）
    const sessionResult = unwrap(
      await client.session.create({})
    ) as { id: string };

    const sessionID = sessionResult.id;

    try {
      // 获取当前模型（如果提供了 getModel）
      const model = this.getModel();
      
      // 使用 promptAsync 发送 prompt 并等待 AI 完成
      const promptOptions: any = {
        sessionID,
        parts: [{ type: 'text', text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }],
      };
      
      // 只有当 model 存在时才传递，否则使用 OpenCode 默认模型
      // model 应该是 { providerID, modelID } 对象
      if (model) {
        promptOptions.model = model;
      }
      
      const result = await client.session.promptAsync(promptOptions);
      
      // 获取结果
      if (result && (result as any).data) {
        const data = (result as any).data;
        
        // 检查是否有错误
        if (data.error) {
          throw new Error(`AI 分析失败: ${JSON.stringify(data.error)}`);
        }
        
        // 尝试从结果中提取内容
        if (data.output) return data.output;
        if (data.content) return data.content;
      }
      
      // 如果 promptAsync 没有直接返回内容，轮询检查 session 状态
      const maxWaitTime = 5 * 60 * 1000; // 最大等待 5 分钟
      const startTime = Date.now();
      let lastMessageCount = 0;
      
      while (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 每 500ms 检查一次
        
        // 获取消息
        // messagesResult 直接是消息数组
        const messagesResult = unwrap(
          await client.session.messages({ sessionID })
        );
        
        const currentMessageCount = messagesResult?.length || 0;
        
        // 检查是否有 assistant 消息
        if (messagesResult && Array.isArray(messagesResult)) {
          const assistantMessages = messagesResult.filter(m => m.info?.role === 'assistant');
          const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
          
          if (lastAssistantMessage && lastAssistantMessage.parts) {
            lastMessageCount = currentMessageCount;
            
            // 先尝试返回已获取的内容
            // 然后检查 session 状态确认是否完成
          }
        }
        
        // 获取所有 session 状态
        // 返回格式: { "ses_xxx": { "type": "busy"|"idle"|... } }
        const statusResult = unwrap(
          await client.session.status()
        ) as Record<string, { type?: string; status?: string; state?: string }>;
        
        // 找到当前 session 的状态
        const currentSessionStatus = statusResult[sessionID];
        
        // 如果 session 不在状态列表中（为空），说明已结束
        if (!currentSessionStatus) {
          // session 已结束，获取最后的 assistant 消息返回
          console.log('[DEBUG] Session ended, messagesResult:', JSON.stringify(messagesResult, null, 2));
          console.log('[DEBUG] messagesResult type:', typeof messagesResult);
          console.log('[DEBUG] messagesResult isArray:', Array.isArray(messagesResult));
          if (messagesResult && Array.isArray(messagesResult)) {
            console.log('[DEBUG] messagesResult length:', messagesResult.length);
            console.log('[DEBUG] First message:', JSON.stringify(messagesResult[0], null, 2));
            const assistantMessages = messagesResult.filter(m => m.info?.role === 'assistant');
            console.log('[DEBUG] assistantMessages count:', assistantMessages.length);
            console.log('[DEBUG] assistantMessages:', JSON.stringify(assistantMessages, null, 2));
            const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
            console.log('[DEBUG] lastAssistantMessage:', JSON.stringify(lastAssistantMessage, null, 2));
            if (lastAssistantMessage && lastAssistantMessage.parts) {
              console.log('[DEBUG] lastAssistantMessage.parts:', JSON.stringify(lastAssistantMessage.parts, null, 2));
              const textParts = lastAssistantMessage.parts.filter((p: { type: string; text: string }) => p.type === 'text');
              console.log('[DEBUG] textParts:', JSON.stringify(textParts, null, 2));
              const fullContent = textParts.map((p: { text: string }) => p.text).join('');
              console.log('[DEBUG] fullContent:', fullContent);
              if (fullContent) {
                return fullContent;
              }
            }
          }
          throw new Error('AI 分析完成但没有返回内容');
        }
        
        const status = currentSessionStatus?.type || currentSessionStatus?.status || currentSessionStatus?.state;
        
        // 如果 session 状态为 completed 或 idle，获取内容返回
          if (status === 'completed' || status === 'idle') {
          if (messagesResult && Array.isArray(messagesResult)) {
            const assistantMessages = messagesResult.filter(m => m.info?.role === 'assistant');
            const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
            if (lastAssistantMessage && lastAssistantMessage.parts) {
              const textParts = lastAssistantMessage.parts.filter((p: { type: string; text: string }) => p.type === 'text');
              const fullContent = textParts.map((p: { text: string }) => p.text).join('');
              if (fullContent) {
                return fullContent;
              }
            }
          }
        }
        
        // 如果 session 状态为 failed 或 error，抛出错误
        if (status === 'failed' || status === 'error') {
          throw new Error(`AI 分析失败，session 状态: ${status}`);
        }
      }
      
      throw new Error('AI 分析超时（超过 5 分钟）');
    } catch (error) {
      // 抛出原始错误
      throw error;
    }
    // 注意：暂时不删除临时 session，便于调试
  }

  /**
   * 执行完整的 AI 需求分析流程
   */
  async analyze(workItemId: number): Promise<ParsedRequirement & { 
    aiRepos: AIRepoDetectionResult;
    aiAnalysis: string;
  }> {
    // Step 1: 获取工作项
    this.reportProgress({
      stage: 'fetching',
      message: '获取 TFS 工作项...',
      progress: 10
    });

    const workItem = await this.tfsClient.getWorkItem(workItemId);
    if (!workItem || !workItem.id) {
      throw new Error(`Work item ${workItemId} not found or invalid`);
    }

    // Step 2: AI 需求分析
    this.reportProgress({
      stage: 'analyzing',
      message: 'AI 正在分析需求内容...',
      progress: 30
    });

    const requirementText = this.buildRequirementText(workItem);
    const title = workItem.fields?.['System.Title'] as string || '';
    
    const aiRequirementResult = await this.analyzeWithAI(title, requirementText);

    this.reportProgress({
      stage: 'analyzing',
      message: `AI 识别到 ${aiRequirementResult.keyFeatures.length} 个功能点`,
      progress: 50
    });

    // Step 3: AI 仓库识别
    this.reportProgress({
      stage: 'detecting_repos',
      message: 'AI 正在识别相关仓库...',
      progress: 60
    });

    const aiRepoResult = await this.detectReposWithAI(aiRequirementResult);

    this.reportProgress({
      stage: 'detecting_repos',
      message: `AI 识别到 ${aiRepoResult.primaryRepos.length} 个主要仓库`,
      progress: 80
    });

    // Step 4: 构建结果
    this.reportProgress({
      stage: 'completed',
      message: 'AI 分析完成',
      progress: 100
    });

    const result: ParsedRequirement & { 
      aiRepos: AIRepoDetectionResult;
      aiAnalysis: string;
    } = {
      workItemId: workItem.id!,
      title,
      description: workItem.fields?.['System.Description'] as string || '',
      acceptanceCriteria: workItem.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] as string || '',
      demandAnalysis: workItem.fields?.['Winning.Demand.Analysis'] as string || '',
      rawDescription: workItem.fields?.['System.Description'] as string || '',
      rawAcceptanceCriteria: workItem.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] as string || '',
      rawDemandAnalysis: workItem.fields?.['Winning.Demand.Analysis'] as string || '',
      area: workItem.fields?.['System.AreaPath'] as string || '',
      
      // AI 生成的内容
      summary: aiRequirementResult.summary,
      keyFeatures: aiRequirementResult.keyFeatures,
      techIndicators: aiRequirementResult.techStack,
      domainKeywords: aiRequirementResult.keywords,
      
      // AI 识别的仓库（用于展示和确认）
      aiRepos: aiRepoResult,
      
      // AI 分析说明
      aiAnalysis: aiRepoResult.analysis
    };

    return result;
  }

  /**
   * AI 需求分析
   */
  private async analyzeWithAI(
    title: string, 
    content: string
  ): Promise<AIAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(title, content);
    const systemPrompt = '你是一个专业的需求分析师，擅长从需求文档中提取关键信息并以JSON格式输出。';
    
    try {
      const response = await this.sendPromptToAI(prompt, systemPrompt);
      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('[AI分析失败]', error);
      throw new Error(`AI 分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * AI 仓库识别
   */
  private async detectReposWithAI(
    requirement: AIAnalysisResult
  ): Promise<AIRepoDetectionResult> {
    const prompt = this.buildRepoDetectionPrompt(requirement);
    const systemPrompt = '你是一个资深软件架构师，擅长根据需求判断应该修改哪些代码仓库。';
    
    try {
      const response = await this.sendPromptToAI(prompt, systemPrompt);
      const rawResult = this.parseRepoDetectionResponse(response);
      
      // 验证仓库存在性并补充信息
      const enrichedResult = this.enrichRepos(rawResult);
      
      // 过滤低置信度仓库（< 80%）
      return this.filterByConfidence(enrichedResult);
    } catch (error) {
      console.error('[仓库识别失败]', error);
      // 返回空结果而不是报错
      return {
        primaryRepos: [],
        secondaryRepos: [],
        analysis: error instanceof Error ? error.message : '仓库识别失败'
      };
    }
  }

  /**
   * 构建需求文本
   */
  private buildRequirementText(workItem: TFSWorkItem): string {
    const parts: string[] = [];
    
    const demandAnalysis = workItem.fields?.['Winning.Demand.Analysis'] as string || '';
    const acceptanceCriteria = workItem.fields?.['Microsoft.VSTS.Common.AcceptanceCriteria'] as string || '';
    const description = workItem.fields?.['System.Description'] as string || '';
    
    if (demandAnalysis) {
      parts.push(this.cleanHtml(demandAnalysis));
    }
    
    if (acceptanceCriteria) {
      parts.push(this.cleanHtml(acceptanceCriteria));
    }
    
    if (description) {
      parts.push(this.cleanHtml(description));
    }
    
    return parts.join('\n\n');
  }

  /**
   * 清理 HTML 标签
   */
  private cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 构建需求分析 Prompt
   */
  private buildAnalysisPrompt(title: string, content: string): string {
    return `请分析以下需求文档并提取关键信息。

【需求标题】
${title}

【需求内容】
${content}

请分析并返回以下 JSON 格式（不要包含 markdown 代码块标记，只返回纯 JSON）：

{
  "summary": "一句话概括需求核心业务价值（格式：动作+目标，如'参数校验: 修改spark登录插件'）",
  "keyFeatures": [
    "动词+名词格式的功能点1",
    "动词+名词格式的功能点2"
  ],
  "techStack": {
    "frontend": true/false,  // 是否需要修改前端代码（UI界面、前端组件、页面、样式等）
    "backend": true/false,   // 是否需要修改后端代码（API接口、业务逻辑、服务等）
    "database": true/false   // 是否需要修改数据库（表结构、存储过程、数据迁移等）
  },
  "domain": "业务领域",
  "keywords": ["关键词1", "关键词2"]
}`;
  }

  /**
   * 构建仓库识别 Prompt
   */
  private buildRepoDetectionPrompt(requirement: AIAnalysisResult): string {
    // 确保仓库配置存在
    if (!this.config.repositories || !Array.isArray(this.config.repositories)) {
      return `无可用仓库配置。`;
    }
    
    const reposInfo = this.config.repositories.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      keywords: r.keywords
    }));

    return `请根据需求分析判断应该修改哪些代码仓库。

【可选仓库】
${JSON.stringify(reposInfo, null, 2)}

【需求分析】
- 摘要：${requirement.summary}
- 功能点：${requirement.keyFeatures.join('、')}
- 技术栈：前端(${requirement.techStack.frontend ? '是' : '否'})、后端(${requirement.techStack.backend ? '是' : '否'})、数据库(${requirement.techStack.database ? '是' : '否'})

请返回 JSON 格式：
{
  "primaryRepos": [{"repoId": "id", "reason": "原因", "confidence": 0.95}],
  "secondaryRepos": [],
  "analysis": "说明"
}`;
  }

  /**
   * 解析 AI 分析响应
   */
  private parseAnalysisResponse(response: string): AIAnalysisResult {
    try {
      const cleanJson = this.extractJsonFromResponse(response);
      
      const parsed = JSON.parse(cleanJson);
      
      return {
        summary: parsed.summary || '',
        keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures : [],
        techStack: {
          frontend: Boolean(parsed.techStack?.frontend),
          backend: Boolean(parsed.techStack?.backend),
          database: Boolean(parsed.techStack?.database)
        },
        domain: parsed.domain || '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
      };
    } catch (error) {
      console.error('[解析失败]', response);
      throw new Error(`AI 分析结果格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从混合文本中提取 JSON 字符串
   * 支持以下格式：
   * 1. 纯 JSON
   * 2. Markdown 代码块 ```json {...} ```
   * 3. 混合文本 "说明文字 {...} 说明文字"
   */
  private extractJsonFromResponse(response: string): string {
    // 1. 先尝试提取 markdown 代码块
    const markdownMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      const content = markdownMatch[1].trim();
      // 验证是否是有效的 JSON
      try {
        JSON.parse(content);
        return content;
      } catch {
        // 继续尝试下一步
      }
    }

    // 2. 尝试匹配最外层的大括号对象（处理嵌套大括号）
    const braceMatch = this.findBalancedBracket(response, '{', '}');
    if (braceMatch) {
      try {
        JSON.parse(braceMatch);
        return braceMatch;
      } catch {
        // 继续尝试下一步
      }
    }

    // 3. 尝试匹配方括号数组
    const bracketMatch = this.findBalancedBracket(response, '[', ']');
    if (bracketMatch) {
      try {
        JSON.parse(bracketMatch);
        return bracketMatch;
      } catch {
        // 继续尝试下一步
      }
    }

    // 4. 最后的备选：清理后尝试
    return response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/gi, '')
      .trim();
  }

  /**
   * 查找匹配的括号内容
   */
  private findBalancedBracket(text: string, openChar: string, closeChar: string): string | null {
    let depth = 0;
    let startIndex = -1;
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === openChar) {
        if (depth === 0) {
          startIndex = i;
        }
        depth++;
      } else if (text[i] === closeChar) {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          return text.substring(startIndex, i + 1);
        }
      }
    }
    
    return null;
  }

  /**
   * 解析仓库识别响应
   */
  private parseRepoDetectionResponse(response: string): any {
    try {
      const cleanJson = this.extractJsonFromResponse(response);
      const parsed = JSON.parse(cleanJson);
      
      // 处理 AI 返回的不同格式
      // 1. 如果已经是标准格式，直接返回
      if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.primaryRepos) || Array.isArray(parsed.secondaryRepos))) {
        return parsed;
      }
      
      // 2. 如果是单个仓库对象，包装为 primaryRepos
      if (parsed && typeof parsed === 'object' && parsed.repoId) {
        return {
          primaryRepos: [parsed],
          secondaryRepos: [],
          analysis: `识别到主要仓库: ${parsed.repoId}`
        };
      }
      
      // 3. 如果是仓库数组，包装为 primaryRepos
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.repoId) {
        return {
          primaryRepos: parsed,
          secondaryRepos: [],
          analysis: `识别到 ${parsed.length} 个仓库`
        };
      }
      
      // 4. 其他情况，返回空结果
      return {
        primaryRepos: [],
        secondaryRepos: [],
        analysis: '无法识别的响应格式'
      };
    } catch (error) {
      console.error('[解析失败]', response);
      throw new Error(`仓库识别结果格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证仓库存在性并补充信息
   */
  private enrichRepos(rawResult: any): AIRepoDetectionResult {
    if (!this.config.repositories || !Array.isArray(this.config.repositories)) {
      return { primaryRepos: [], secondaryRepos: [], analysis: '' };
    }
    
    const enrich = (repos: any[], isPrimary: boolean): AIRepositoryMatch[] => {
      if (!Array.isArray(repos)) return [];
      
      return repos
        .map((repo: any) => {
          const config = this.config.repositories.find(r => r.id === repo.repoId);
          if (!config) return null;
          
          return {
            id: config.id,
            name: config.name,
            path: config.path,
            description: config.description,
            reason: repo.reason || '',
            confidence: Math.min(Math.max(repo.confidence || 0, 0), 1),
            isPrimary,
            aiReason: repo.reason || '',
            aiConfidence: repo.confidence || 0
          };
        })
        .filter((r): r is AIRepositoryMatch => r !== null);
    };

    return {
      primaryRepos: enrich(rawResult.primaryRepos, true),
      secondaryRepos: enrich(rawResult.secondaryRepos, false),
      analysis: rawResult.analysis || ''
    };
  }

  /**
   * 按置信度过滤
   */
  private filterByConfidence(result: AIRepoDetectionResult): AIRepoDetectionResult {
    return {
      primaryRepos: result.primaryRepos.filter(r => r.aiConfidence >= this.CONFIDENCE_THRESHOLD),
      secondaryRepos: result.secondaryRepos.filter(r => r.aiConfidence >= this.CONFIDENCE_THRESHOLD * 0.75),
      analysis: result.analysis
    };
  }

  /**
   * 用于非 AI 场景的仓库识别
   */
  detectRepos(requirement: ParsedRequirement): DetectionResult {
    if ('aiRepos' in requirement) {
      const aiRepos = (requirement as any).aiRepos as AIRepoDetectionResult;
      return {
        primary: aiRepos.primaryRepos,
        secondary: aiRepos.secondaryRepos,
        confidence: aiRepos.primaryRepos.length > 0 
          ? Math.max(...aiRepos.primaryRepos.map(r => r.confidence))
          : 0
      };
    }
    
    return { primary: [], secondary: [], confidence: 0 };
  }
}

/**
 * 工厂函数
 */
export const createRequirementAnalyzer = (
  tfsClient: TFSClient,
  getClient: () => Client | null,
  getModel?: () => { providerID: string; modelID: string } | null,
  onProgress?: ProgressCallback
): RequirementAnalyzer => {
  return new RequirementAnalyzer(tfsClient, getClient, getModel, onProgress);
};

export default RequirementAnalyzer;
