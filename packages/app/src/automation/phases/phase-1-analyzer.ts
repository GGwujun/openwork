// automation/phases/phase-1-analyzer.ts
// Phase 1: 需求分析 - 使用现有的RequirementAnalyzer

import type { PhaseExecutor, PhaseResult, PhaseLogger } from '../types/phase';
import type { AutomationContext, RepositoryMatch, TFSClientInterface } from '../types/automation';
import { RequirementAnalyzer } from '../../api/requirement-analyzer';

/**
 * TFS客户端包装器 - 适配 api/tfs 和 automation/tfs 的差异
 */
class TFSClientWrapper {
  constructor(private client: TFSClientInterface) {}

  async getWorkItem(id: number) {
    return this.client.getWorkItem(id);
  }
}

/**
 * 需求分析Phase执行器
 * 整合现有的RequirementAnalyzer进行分析
 */
export class PhaseAnalyzer implements PhaseExecutor {
  readonly phaseType = 'analyze';
  
  private tfsClient: TFSClientInterface;
  private requirementAnalyzer: RequirementAnalyzer;

  constructor(config: { tfsClient: TFSClientInterface }) {
    this.tfsClient = config.tfsClient;
    // 使用包装器适配器
    this.requirementAnalyzer = new RequirementAnalyzer(new TFSClientWrapper(config.tfsClient) as any);
  }

  /**
   * 执行需求分析
   */
  async execute(context: AutomationContext, logger: PhaseLogger): Promise<PhaseResult> {
    try {
      logger.info('开始需求分析...');
      
      const { workItem } = context;
      
      // 1. 使用RequirementAnalyzer分析
      logger.info(`分析工作项 #${workItem.id}: ${workItem.title}`);
      
      const analysis = await this.requirementAnalyzer.analyze(workItem.id);
      
      logger.info('需求分析完成', {
        keyFeatures: analysis.keyFeatures,
        techIndicators: analysis.techIndicators,
        domainKeywords: analysis.domainKeywords,
      });

      // 2. 识别仓库
      logger.info('开始仓库识别...');
      
      const detection = this.requirementAnalyzer.detectRepos(analysis);
      
      const primaryRepos = detection.primary.map(repo => ({
        ...repo,
        isPrimary: true,
      }));
      
      const secondaryRepos = detection.secondary.map(repo => ({
        ...repo,
        isPrimary: false,
      }));
      
      const allRepos = [...primaryRepos, ...secondaryRepos];
      
      logger.info(`识别到 ${allRepos.length} 个相关仓库`, {
        primary: primaryRepos.map(r => r.name),
        secondary: secondaryRepos.map(r => r.name),
        confidence: detection.confidence,
      });

      // 3. 验证至少有一个仓库被识别
      if (allRepos.length === 0) {
        logger.warn('未识别到任何相关仓库，将使用默认配置');
        // 可以在这里添加默认仓库或返回错误
      }

      return {
        success: true,
        data: {
          analysis,
          repositories: allRepos,
          confidence: detection.confidence,
        },
      };
    } catch (error) {
      logger.error('需求分析失败', error as Error);
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 验证输入
   */
  validate(context: AutomationContext): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!context.workItem) {
      errors.push('缺少工作项信息');
    } else {
      if (!context.workItem.id) {
        errors.push('工作项ID不能为空');
      }
      if (!context.workItem.title) {
        errors.push('工作项标题不能为空');
      }
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
    return '解析TFS工作项，提取需求信息，识别相关代码仓库';
  }
}

export default PhaseAnalyzer;
