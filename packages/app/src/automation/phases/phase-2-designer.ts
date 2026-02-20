// automation/phases/phase-2-designer.ts
// Phase 2: 设计生成 - AI生成技术设计文档

import type { PhaseExecutor, PhaseResult, PhaseLogger } from '../types/phase';
import type { 
  AutomationContext, 
  DesignDocument,
  RepositoryMatch 
} from '../types/automation';
import type { AIService } from '../ai/service';

/**
 * 设计生成Phase执行器
 * 使用AI生成技术设计文档
 */
export class PhaseDesigner implements PhaseExecutor {
  readonly phaseType = 'design';
  
  private aiService: AIService;

  constructor(config: { aiService: AIService }) {
    this.aiService = config.aiService;
  }

  /**
   * 执行设计生成
   */
  async execute(context: AutomationContext, logger: PhaseLogger): Promise<PhaseResult> {
    try {
      logger.info('开始设计生成...');
      
      const { workItem, repositories } = context;
      
      if (!repositories || repositories.length === 0) {
        throw new Error('没有识别到相关仓库，无法生成设计');
      }

      // 1. 构建设计Prompt
      const prompt = this.buildDesignPrompt(workItem, repositories);
      logger.info('已构建设计Prompt', { promptLength: prompt.length });

      // 2. 调用AI生成设计
      logger.info('调用AI生成设计文档...');
      
      const response = await this.aiService.complete({
        prompt,
        temperature: 0.7,
        maxTokens: 4000,
        systemPrompt: `你是一位资深软件架构师，擅长设计清晰、可实施的技术方案。
请基于需求生成详细的技术设计文档，包含架构、接口、数据模型等关键信息。
输出必须是结构化的Markdown格式。`,
      });

      logger.info('AI生成完成', { 
        contentLength: response.content.length,
        usage: response.usage,
      });

      // 3. 解析设计文档
      logger.info('解析设计文档...');
      const design = this.parseDesignDocument(response.content);
      
      logger.info('设计文档解析完成', {
        hasArchitecture: !!design.architecture,
        interfaceCount: design.interfaces?.length || 0,
        dataModelCount: design.dataModels?.length || 0,
      });

      return {
        success: true,
        data: design,
      };
    } catch (error) {
      logger.error('设计生成失败', error as Error);
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 构建设计Prompt
   */
  private buildDesignPrompt(
    workItem: AutomationContext['workItem'],
    repositories: RepositoryMatch[]
  ): string {
    return `# 任务：生成技术设计文档

## 需求信息

### 工作项
- **ID**: #${workItem.id}
- **标题**: ${workItem.title}
- **类型**: ${workItem.type}
- **优先级**: P${workItem.priority}

### 描述
${workItem.description || '无详细描述'}

${workItem.acceptanceCriteria ? `### 验收标准\n${workItem.acceptanceCriteria}` : ''}

${workItem.demandAnalysis ? `### 需求分析\n${workItem.demandAnalysis}` : ''}

### 标签
${workItem.tags?.join(', ') || '无'}

## 目标仓库

${repositories.map(repo => `### ${repo.name}
- **ID**: ${repo.id}
- **描述**: ${repo.description}
- **匹配原因**: ${repo.reason}
- **置信度**: ${(repo.confidence * 100).toFixed(0)}%
`).join('\n')}

## 输出要求

请生成完整的技术设计文档，包含以下章节：

### 1. 概述
- 一句话总结需求
- 技术方案概述
- 实施范围

### 2. 架构设计
- 系统架构描述
- 关键组件列表
- 组件依赖关系

### 3. 接口设计
对于每个需要新增的接口：
- 接口名称和路径
- HTTP方法
- 请求参数（名称、类型、必填、描述）
- 响应格式（JSON示例）
- 错误码定义

### 4. 数据模型
- 新增/修改的数据结构
- 字段定义（名称、类型、约束）
- 关系定义

### 5. 实现细节
- 核心算法或业务逻辑
- 关键代码片段（伪代码）
- 性能考虑

### 6. 风险评估
列出可能的技术风险及缓解措施

### 7. 时间估算
- 各阶段工时估算
- 总工时
- 关键里程碑

请使用Markdown格式输出，确保内容详细、专业、可实施。`;
  }

  /**
   * 解析设计文档
   */
  private parseDesignDocument(content: string): DesignDocument {
    // 基础解析 - 提取主要章节
    const sections = this.extractSections(content);
    
    return {
      overview: sections['概述'] || sections['overview'] || '',
      architecture: this.parseArchitecture(sections['架构设计'] || sections['architecture'] || ''),
      interfaces: this.parseInterfaces(sections['接口设计'] || sections['接口'] || ''),
      dataModels: this.parseDataModels(sections['数据模型'] || sections['数据'] || ''),
      implementation: this.parseImplementation(sections['实现细节'] || sections['implementation'] || ''),
      risks: this.parseRisks(sections['风险评估'] || sections['风险'] || ''),
      timeline: this.parseTimeline(sections['时间估算'] || sections['timeline'] || ''),
    };
  }

  /**
   * 提取Markdown章节
   */
  private extractSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
      
      if (headerMatch) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        currentSection = headerMatch[1].trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  /**
   * 解析架构部分
   */
  private parseArchitecture(content: string): DesignDocument['architecture'] {
    return {
      diagram: '', // 可以从内容中提取mermaid图表
      components: this.extractListItems(content),
      dependencies: [],
    };
  }

  /**
   * 解析接口部分
   */
  private parseInterfaces(content: string): DesignDocument['interfaces'] {
    const interfaces: DesignDocument['interfaces'] = [];
    
    // 简单的接口解析逻辑
    const interfaceBlocks = content.split(/###\s+/).filter(Boolean);
    
    for (const block of interfaceBlocks) {
      const lines = block.split('\n');
      const name = lines[0]?.trim();
      
      if (name) {
        interfaces.push({
          name,
          method: this.extractMethod(block),
          path: this.extractPath(block),
          description: block,
          request: { parameters: [] },
          response: { statusCode: 200, description: '' },
          errors: [],
        });
      }
    }

    return interfaces;
  }

  /**
   * 解析数据模型
   */
  private parseDataModels(content: string): DesignDocument['dataModels'] {
    const models: DesignDocument['dataModels'] = [];
    
    const modelBlocks = content.split(/###\s+/).filter(Boolean);
    
    for (const block of modelBlocks) {
      const lines = block.split('\n');
      const name = lines[0]?.trim();
      
      if (name) {
        models.push({
          name,
          description: block,
          fields: this.extractFields(block),
        });
      }
    }

    return models;
  }

  /**
   * 解析实现细节
   */
  private parseImplementation(content: string): DesignDocument['implementation'] {
    const items = content.split(/###\s+/).filter(Boolean);
    
    return items.map(item => ({
      title: item.split('\n')[0]?.trim() || '实现项',
      description: item,
      considerations: this.extractListItems(item),
    }));
  }

  /**
   * 解析风险
   */
  private parseRisks(content: string): DesignDocument['risks'] {
    const risks: DesignDocument['risks'] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('：') || line.includes(':')) {
        const [desc, mitigation] = line.split(/[：:]/).map(s => s.trim());
        if (desc) {
          risks.push({
            type: 'technical',
            description: desc,
            probability: 'medium',
            impact: 'medium',
            mitigation: mitigation || '待补充',
          });
        }
      }
    }

    return risks;
  }

  /**
   * 解析时间线
   */
  private parseTimeline(content: string): DesignDocument['timeline'] {
    return {
      phases: this.extractListItems(content).map(name => ({
        name,
        description: '',
        estimate: '',
        dependencies: [],
      })),
      totalEstimate: '',
      milestones: [],
    };
  }

  /**
   * 提取列表项
   */
  private extractListItems(content: string): string[] {
    const items: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^[-*]\s+(.+)$/);
      if (match) {
        items.push(match[1].trim());
      }
    }

    return items;
  }

  /**
   * 提取HTTP方法
   */
  private extractMethod(content: string): string {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    for (const method of methods) {
      if (content.toUpperCase().includes(method)) {
        return method;
      }
    }
    return 'GET';
  }

  /**
   * 提取路径
   */
  private extractPath(content: string): string {
    const pathMatch = content.match(/[`\/]([\/\w-]+)/);
    return pathMatch ? pathMatch[1] : '/';
  }

  /**
   * 提取字段
   */
  private extractFields(content: string): Array<{ name: string; type: string; required: boolean; description: string }> {
    const fields: Array<{ name: string; type: string; required: boolean; description: string }> = [];
    
    // 简单解析表格或列表
    const lines = content.split('\n');
    let inTable = false;
    
    for (const line of lines) {
      if (line.includes('|')) {
        const cells = line.split('|').map(s => s.trim()).filter(Boolean);
        if (cells.length >= 2 && !line.includes('---')) {
          fields.push({
            name: cells[0],
            type: cells[1] || 'string',
            required: !cells[2]?.toLowerCase().includes('optional'),
            description: cells[3] || '',
          });
        }
      }
    }

    return fields;
  }

  /**
   * 验证输入
   */
  validate(context: AutomationContext): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!context.repositories || context.repositories.length === 0) {
      errors.push('缺少仓库信息，请先执行需求分析Phase');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 获取Phase描述
   */
  getDescription(): string {
    return '基于需求生成技术设计文档，包含架构、接口、数据模型';
  }
}

export default PhaseDesigner;
