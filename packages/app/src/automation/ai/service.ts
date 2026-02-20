// automation/ai/service.ts
// AI服务封装 - 支持多Provider

/**
 * AI服务配置
 */
export interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'azure' | 'local';
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * AI完成请求
 */
export interface AICompletionRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}

/**
 * AI完成响应
 */
export interface AICompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

/**
 * AI服务错误
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/**
 * AI服务类
 * 封装多种AI Provider的调用
 */
export class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = {
      timeout: 120000, // 默认2分钟超时
      ...config,
    };
  }

  /**
   * 发送Completion请求
   * @param request 请求参数
   * @returns AI响应
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(request);
      case 'anthropic':
        return this.callAnthropic(request);
      case 'azure':
        return this.callAzure(request);
      case 'local':
        return this.callLocal(request);
      default:
        throw new AIServiceError(
          `不支持的AI Provider: ${this.config.provider}`,
          'UNSUPPORTED_PROVIDER'
        );
    }
  }

  /**
   * 流式Completion（用于实时显示进度）
   * @param request 请求参数
   * @param onChunk 块回调
   */
  async completeStream(
    request: AICompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    // 目前非流式实现，后续可扩展
    const response = await this.complete(request);
    onChunk(response.content);
    return response;
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAI(request: AICompletionRequest): Promise<AICompletionResponse> {
    const url = this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt }
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIServiceError(
        errorData.error?.message || `OpenAI API错误: ${response.statusText}`,
        'OPENAI_ERROR',
        response.status
      );
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  /**
   * 调用Anthropic API
   */
  private async callAnthropic(request: AICompletionRequest): Promise<AICompletionResponse> {
    const url = this.config.baseUrl || 'https://api.anthropic.com/v1/messages';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt }
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 4096,
        stop_sequences: request.stopSequences,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIServiceError(
        errorData.error?.message || `Anthropic API错误: ${response.statusText}`,
        'ANTHROPIC_ERROR',
        response.status
      );
    }

    const data = await response.json();
    
    return {
      content: data.content?.[0]?.text || '',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      model: data.model,
      finishReason: data.stop_reason,
    };
  }

  /**
   * 调用Azure OpenAI API
   */
  private async callAzure(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.config.baseUrl) {
      throw new AIServiceError('Azure OpenAI需要提供baseUrl', 'MISSING_BASE_URL');
    }
    
    const url = `${this.config.baseUrl}/openai/deployments/${this.config.model}/chat/completions?api-version=2023-05-15`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt }
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIServiceError(
        errorData.error?.message || `Azure OpenAI错误: ${response.statusText}`,
        'AZURE_ERROR',
        response.status
      );
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  /**
   * 调用本地LLM API
   */
  private async callLocal(request: AICompletionRequest): Promise<AICompletionResponse> {
    const url = this.config.baseUrl || 'http://localhost:11434/api/generate';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: request.systemPrompt 
          ? `${request.systemPrompt}\n\n${request.prompt}` 
          : request.prompt,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new AIServiceError(
        `本地LLM错误: ${response.statusText}`,
        'LOCAL_ERROR',
        response.status
      );
    }

    const data = await response.json();
    
    return {
      content: data.response || data.text || '',
      model: this.config.model,
    };
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.complete({
        prompt: 'Hello',
        maxTokens: 5,
      });
      
      return {
        success: true,
        message: `连接成功 (模型: ${response.model || this.config.model})`,
      };
    } catch (error) {
      return {
        success: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }
}

export default AIService;
