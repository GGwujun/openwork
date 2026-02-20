// automation/phases/phase-3-planner.ts
// Phase 3: 计划生成 - AI生成实施计划

import type { PhaseExecutor, PhaseResult, PhaseLogger } from '../types/phase';
import type { 
  AutomationContext, 
  PlanDocument,
  PlanPhase,
  PlanStep,
  DesignDocument 
} from '../types/automation';
import type { AIService } from '../ai/service';

/**
 * 计划生成Phase执行器
 * 使用AI生成详细的实施计划
 */
export class PhasePlanner implements PhaseExecutor {
  readonly phaseType = 'plan';
  
  private aiService: AIService;

  constructor(config: { aiService: AIService }) {
    this.aiService = config.aiService;
  }

  /**
   * 执行计划生成
   */
  async execute(context: AutomationContext, logger: PhaseLogger): Promise<PhaseResult> {
    try {
      logger.info('开始计划生成...');
      
      const { workItem, repositories, designDocument } = context;
      
      if (!designDocument) {
        throw new Error('缺少设计文档，请先执行设计Phase');
      }

      // 1. 构建计划Prompt
      const prompt = this.buildPlanPrompt(workItem, repositories, designDocument);
      logger.info('已构建计划Prompt', { promptLength: prompt.length });

      // 2. 调用AI生成计划
      logger.info('调用AI生成实施计划...');
      
      const response = await this.aiService.complete({
        prompt,
        temperature: 0.5, // 较低温度以获得更确定性的计划
        maxTokens: 4000,
        systemPrompt: `你是一位资深技术项目经理，擅长制定详细、可执行的实施计划。
请将技术设计拆分为具体的开发任务，每个任务都应该：
1. 有明确的标题和描述
2. 有具体的验收标准
3. 有合理的工时估算
4. 有清晰的依赖关系
输出必须是结构化的Markdown格式。`,
      });

      logger.info('AI生成完成', { 
        contentLength: response.content.length,
        usage: response.usage,
      });

      // 3. 解析计划文档
      logger.info('解析计划文档...');
      const plan = this.parsePlanDocument(response.content);
      
      logger.info('计划文档解析完成', {
        phaseCount: plan.phases?.length || 0,
        totalSteps: plan.phases?.reduce((sum, p) => sum + (p.steps?.length || 0), 0) || 0,
        totalEstimate: plan.totalEstimate,
      });

      return {
        success: true,
        data: plan,
      };
    } catch (error) {
      logger.error('计划生成失败', error as Error);
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 构建计划Prompt
   */
  private buildPlanPrompt(
    workItem: AutomationContext['workItem'],
    repositories: AutomationContext['repositories'],
    design: DesignDocument
  ): string {
    return `# 任务：生成实施计划

## 需求信息

- **工作项ID**: #${workItem.id}
- **标题**: ${workItem.title}
- **类型**: ${workItem.type}

## 目标仓库

${repositories.map(repo => `- **${repo.name}** (${repo.id}): ${repo.description}`).join('\n')}

## 设计概述

### 架构
${design.architecture?.components?.map(c => `- ${c}`).join('\n') || '待补充'}

### 接口
${design.interfaces?.map(i => `- ${i.method} ${i.path}: ${i.name}`).join('\n') || '待补充'}

### 数据模型
${design.dataModels?.map(m => `- ${m.name}: ${m.fields?.length || 0}个字段`).join('\n') || '待补充'}

## 输出要求

请生成详细的实施计划，包含以下Phase：

### Phase 1: 环境准备
- [ ] 初始化开发环境
- [ ] 创建特性分支
- [ ] 安装/更新依赖

### Phase 2: 核心开发
按模块划分的开发任务：

### Phase 3: 测试验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] 代码审查

### Phase 4: 文档和交付
- [ ] 更新文档
- [ ] 创建PR
- [ ] 代码合并

对于每个任务，请提供：
1. **任务ID**: 格式如 "task-001"
2. **标题**: 简洁明了的任务标题
3. **描述**: 详细的任务描述
4. **验收标准**: 可验证的完成标准（至少3条）
5. **预估工时**: 如 "2h", "4h", "1d"
6. **依赖任务**: 依赖的其他任务ID列表

请使用Markdown格式输出，确保计划详细、可执行、可追踪。`;
  }

  /**
   * 解析计划文档
   */
  private parsePlanDocument(content: string): PlanDocument {
    const phases: PlanPhase[] = [];
    const dependencies: PlanDocument['dependencies'] = [];
    
    // 提取Phase
    const phaseBlocks = this.extractPhaseBlocks(content);
    
    for (const block of phaseBlocks) {
      const phase = this.parsePhase(block);
      if (phase) {
        phases.push(phase);
      }
    }

    // 提取依赖关系
    const allSteps = phases.flatMap(p => p.steps);
    for (const step of allSteps) {
      for (const depId of step.dependencies) {
        dependencies.push({
          from: step.id,
          to: depId,
          type: 'hard',
        });
      }
    }

    return {
      phases,
      totalEstimate: this.calculateTotalEstimate(phases),
      dependencies,
      parallelTasks: this.identifyParallelTasks(phases),
    };
  }

  /**
   * 提取Phase块
   */
  private extractPhaseBlocks(content: string): string[] {
    const blocks: string[] = [];
    const lines = content.split('\n');
    let currentBlock: string[] = [];
    let inPhase = false;

    for (const line of lines) {
      const isPhaseHeader = /^#{1,3}\s+(Phase\s+\d+|阶段\s*\d+|\d+\.[\s\u3000]+)/i.test(line);
      
      if (isPhaseHeader) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
        }
        currentBlock = [line];
        inPhase = true;
      } else if (inPhase) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }

    return blocks;
  }

  /**
   * 解析单个Phase
   */
  private parsePhase(block: string): PlanPhase | null {
    const lines = block.split('\n');
    const headerLine = lines[0];
    
    // 提取Phase名称
    const headerMatch = headerLine.match(/^#{1,3}\s+(?:Phase\s+\d+[\s:]*)?(.+)$/i);
    if (!headerMatch) return null;
    
    const phaseName = headerMatch[1].trim();
    const phaseId = `phase-${phaseName.toLowerCase().replace(/\s+/g, '-')}`;
    
    // 提取描述（第一个段落）
    const description = lines
      .slice(1)
      .filter(line => !line.startsWith('-') && !line.startsWith('['))
      .join(' ')
      .trim();

    // 提取任务
    const steps = this.parseSteps(block, phaseId);

    // 计算Phase总工时
    const phaseEstimate = this.sumEstimates(steps.map(s => s.estimatedTime));

    return {
      id: phaseId,
      name: phaseName,
      description,
      steps,
      estimatedTime: phaseEstimate,
      dependencies: [],
    };
  }

  /**
   * 解析任务
   */
  private parseSteps(content: string, phaseId: string): PlanStep[] {
    const steps: PlanStep[] = [];
    const lines = content.split('\n');
    
    let currentStep: Partial<PlanStep> | null = null;
    let currentSection: string | null = null;
    let order = 1;

    for (const line of lines) {
      // 检测任务（复选框格式）
      const taskMatch = line.match(/^\s*[-*]\s*\[([\s\u3000xX])\]\s*(.+)$/);
      
      if (taskMatch) {
        // 保存前一个任务
        if (currentStep?.title) {
          steps.push(this.finalizeStep(currentStep as PlanStep, order++));
        }
        
        // 开始新任务
        currentStep = {
          id: `${phaseId}-step-${String(order).padStart(3, '0')}`,
          order,
          title: taskMatch[2].trim(),
          description: '',
          acceptanceCriteria: [],
          estimatedTime: '',
          dependencies: [],
        };
        currentSection = 'description';
      } else if (currentStep) {
        // 解析任务详情
        const trimmed = line.trim();
        
        if (trimmed.startsWith('**验收标准**') || trimmed.startsWith('验收标准：')) {
          currentSection = 'criteria';
        } else if (trimmed.startsWith('**预估工时**') || trimmed.startsWith('工时：')) {
          const timeMatch = trimmed.match(/(\d+[hmd])/i);
          if (timeMatch) {
            currentStep.estimatedTime = timeMatch[1];
          }
          currentSection = null;
        } else if (trimmed.startsWith('**依赖**') || trimmed.startsWith('依赖：')) {
          const depMatch = trimmed.match(/依赖[：:]\s*(.+)/);
          if (depMatch) {
            currentStep.dependencies = depMatch[1]
              .split(/[,，]/)
              .map(s => s.trim())
              .filter(Boolean);
          }
          currentSection = null;
        } else if (trimmed) {
          // 累积内容
          if (currentSection === 'description') {
            currentStep.description += (currentStep.description ? '\n' : '') + trimmed;
          } else if (currentSection === 'criteria') {
            // 检查是否是列表项
            if (/^[-*]\s+/.test(trimmed) || /^\d+[.\)]\s+/.test(trimmed)) {
              currentStep.acceptanceCriteria?.push(trimmed.replace(/^[-*\d.\)\s]+/, '').trim());
            }
          }
        }
      }
    }

    // 保存最后一个任务
    if (currentStep?.title) {
      steps.push(this.finalizeStep(currentStep as PlanStep, order));
    }

    return steps;
  }

  /**
   * 完善任务信息
   */
  private finalizeStep(step: PlanStep, order: number): PlanStep {
    return {
      ...step,
      order,
      acceptanceCriteria: step.acceptanceCriteria?.length > 0 
        ? step.acceptanceCriteria 
        : ['任务完成', '代码提交', '测试通过'],
      estimatedTime: step.estimatedTime || '2h',
      dependencies: step.dependencies || [],
    };
  }

  /**
   * 计算总工时
   */
  private calculateTotalEstimate(phases: PlanPhase[]): string {
    const totalMinutes = phases.reduce((sum, phase) => {
      return sum + phase.steps.reduce((stepSum, step) => {
        return stepSum + this.parseTimeToMinutes(step.estimatedTime);
      }, 0);
    }, 0);

    return this.minutesToReadable(totalMinutes);
  }

  /**
   * 将时间字符串转换为分钟
   */
  private parseTimeToMinutes(time: string): number {
    if (!time) return 0;
    
    const match = time.match(/(\d+)\s*([hmd])/i);
    if (!match) return 0;
    
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'h': return value * 60;
      case 'd': return value * 8 * 60; // 8小时/天
      case 'm': return value; // 分钟
      default: return value * 60;
    }
  }

  /**
   * 将分钟转换为可读格式
   */
  private minutesToReadable(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours >= 8) {
      const days = Math.floor(hours / 8);
      const remainingHours = hours % 8;
      return `${days}d ${remainingHours}h`;
    }
    
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  /**
   * 汇总工时
   */
  private sumEstimates(times: string[]): string {
    const totalMinutes = times.reduce((sum, time) => {
      return sum + this.parseTimeToMinutes(time);
    }, 0);
    
    return this.minutesToReadable(totalMinutes);
  }

  /**
   * 识别可并行执行的任务组
   */
  private identifyParallelTasks(phases: PlanPhase[]): PlanDocument['parallelTasks'] {
    const parallelGroups: PlanDocument['parallelTasks'] = [];
    
    for (const phase of phases) {
      // 同一Phase内无依赖的任务可以并行
      const independentTasks = phase.steps
        .filter(step => step.dependencies.length === 0)
        .map(step => step.id);
      
      if (independentTasks.length > 1) {
        parallelGroups.push({
          tasks: independentTasks,
          maxConcurrency: independentTasks.length,
        });
      }
    }

    return parallelGroups;
  }

  /**
   * 验证输入
   */
  validate(context: AutomationContext): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!context.designDocument) {
      errors.push('缺少设计文档，请先执行设计Phase');
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
    return '基于设计文档生成详细的实施计划，包含任务拆分和依赖关系';
  }
}

export default PhasePlanner;
