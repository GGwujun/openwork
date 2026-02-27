// api/requirement-analyzer/__tests__/integration.test.ts
// AI 分析器集成测试 - 完整流程验证

import { describe, it, expect, beforeEach } from 'vitest';
import { RequirementAnalyzer } from '../index';
import type { TFSClient } from '../../tfs';
import type { TFSWorkItem } from '../../../types/requirement-analyzer';
import { createMockClient } from './utils/mock-opencode-client';

// 模拟数据
const MOCK_WORKITEMS: Record<number, TFSWorkItem> = {
  10001: {
    id: 10001,
    fields: {
      'System.Title': '【spark2.0开发（开发者设计）】登录插件配置参数校验',
      'System.Description': '<h3>背景</h3><p>当前spark登录插件缺乏配置参数校验机制</p>',
      'Winning.Demand.Analysis': `<h3>二、需求分析</h3>
        <h4>1.功能分析</h4>
        <p>1.1 业务、数据流程和功能目标</p>
        <p>修改spark的登录插件，针对插件的配置参数做参数校验</p>
        <h4>1.2 功能、界面设计方案</h4>
        <p>修改spark的登录插件，针对插件的配置参数做参数校验</p>`,
      'Microsoft.VSTS.Common.AcceptanceCriteria': '<p>1. 配置参数为空时能正确校验并提示</p><p>2. 配置格式错误时能正确校验并提示</p>',
      'System.AreaPath': '\\WINNING-6.0\\FEX\\认证中心'
    }
  } as TFSWorkItem
};

const mockOpencodeOutputs = {
  requirementAnalysis: JSON.stringify({
    summary: '参数校验: 修改spark登录插件配置',
    keyFeatures: [
      '修改登录插件',
      '配置参数校验',
      '添加校验提示'
    ],
    techStack: {
      frontend: true,
      backend: true,
      database: false
    },
    domain: '认证中心',
    keywords: ['spark', '登录', '插件', '配置', '校验', '参数', '提示']
  }),
  repoDetection: JSON.stringify({
    primaryRepos: [
      {
        repoId: 'spark-ui',
        reason: '需求明确涉及spark前端框架配置校验，此仓库是Spark UI框架核心模块。',
        confidence: 0.95
      }
    ],
    secondaryRepos: [
      {
        repoId: 'common-components',
        reason: '可能需要复用公共组件或工具类',
        confidence: 0.65
      }
    ],
    analysis: '基于需求摘要和关键词分析，主要修改对象是spark-ui仓库（Spark UI框架）。次要影响common-components（公共组件库）。涉及前后端开发，主要功能为参数校验。'
  })
};

describe('RequirementAnalyzer 集成测试', () => {
  let analyzer: RequirementAnalyzer;
  let mockTfsClient: TFSClient;
  let getCallCount: () => number;

  beforeEach(() => {
    getCallCount = () => 0;

    // Mock TFS Client
    mockTfsClient = {
      getWorkItem: async (id: number) => MOCK_WORKITEMS[id] || null
    } as TFSClient;

    const { client, getCallCount: callCountFn } = createMockClient((prompt) => {
      if (prompt.includes('可选仓库')) {
        return mockOpencodeOutputs.repoDetection;
      }
      if (prompt.includes('需求分析')) {
        return mockOpencodeOutputs.requirementAnalysis;
      }
      return JSON.stringify({});
    });
    getCallCount = callCountFn;

    analyzer = new RequirementAnalyzer(
      mockTfsClient,
      () => client,
      () => null,
      (progress) => {
        console.log(`[Test Progress] ${progress.progress}%: ${progress.message}`);
      }
    );
  });

  describe('完整分析流程', () => {
    it('应该完成从工作项获取到 AI 分析的完整流程', async () => {
      const result = await analyzer.analyze(10001);

      // 验证基本字段
      expect(result.workItemId).toBe(10001);
      expect(result.title).toContain('spark2.0开发');
      
      // 验证 AI 生成的内容
      expect(result.summary).toBe('参数校验: 修改spark登录插件配置');
      expect(result.keyFeatures).toContain('修改登录插件');
      expect(result.keyFeatures).toContain('配置参数校验');
      
      // 验证技术栈
      expect(result.techIndicators.frontend).toBe(true);
      expect(result.techIndicators.backend).toBe(true);
      expect(result.techIndicators.database).toBe(false);
      
      // 验证 AI 仓库识别
      expect(result.aiRepos.primaryRepos).toHaveLength(1);
      expect(result.aiRepos.primaryRepos[0].id).toBe('spark-ui');
      expect(result.aiRepos.primaryRepos[0].aiConfidence).toBe(0.95);
      expect(result.aiRepos.primaryRepos[0].aiConfidence).toBeGreaterThanOrEqual(0.8);
      
      // 验证 AI 分析说明
      expect(result.aiAnalysis).toContain('spark-ui');
    });

    it('应该调用两次 OpenCode API（一次需求分析，一次仓库识别）', async () => {
      await analyzer.analyze(10001);
      
      // 验证调用了 2 次 fetch（需求分析 + 仓库识别）
      expect(getCallCount()).toBe(2);
    });

    it('应该生成符合要求的摘要格式', async () => {
      const result = await analyzer.analyze(10001);
      
      // 摘要格式要求：动作:目标
      expect(result.summary).toMatch(/[^:]+:.+/);
      
      // 不包含括号内容
      expect(result.summary).not.toContain('（');
      expect(result.summary).not.toContain('）');
      
      // 在 5-30 字之间
      expect(result.summary.length).toBeGreaterThanOrEqual(5);
      expect(result.summary.length).toBeLessThanOrEqual(30);
    });

    it('功能点应该是动词+名词格式', async () => {
      const result = await analyzer.analyze(10001);
      
      result.keyFeatures.forEach(feature => {
        // 以中文动词开头
        expect(feature).toMatch(/^[\u4e00-\u9fa5]+/);
        
        // 长度适中（3-15 字）
        expect(feature.length).toBeGreaterThanOrEqual(3);
        expect(feature.length).toBeLessThanOrEqual(15);
        
        // 不是元信息
        expect(feature).not.toMatch(/开发者设计|独立项|需求分析|业务分析/);
      });
    });

    it('应该正确保留原始 HTML 内容用于富文本显示', async () => {
      const result = await analyzer.analyze(10001);
      
      // 验证原始内容存在
      expect(result.rawDemandAnalysis).toContain('<h3>二、需求分析</h3>');
      expect(result.rawDescription).toContain('<h3>背景</h3>');
      expect(result.rawAcceptanceCriteria).toContain('<p>1. 配置参数为空时');
      
      // 当前结果保留原始 HTML
      expect(result.demandAnalysis).toContain('<h3>');
      expect(result.description).toContain('<h3>');
    });

    it('次要仓库应该被过滤（因为置信度 < 80%）', async () => {
      const result = await analyzer.analyze(10001);
      
      // 置信度 < 0.6 的仓库应该被过滤
      const secondaryWithLowConfidence = result.aiRepos.secondaryRepos.find(
        r => r.aiConfidence < 0.6
      );
      expect(secondaryWithLowConfidence).toBeUndefined();
    });

    it('应该包含 AI 生成的详细理由', async () => {
      const result = await analyzer.analyze(10001);
      
      const primaryRepo = result.aiRepos.primaryRepos[0];
      expect(primaryRepo.aiReason).toContain('spark');
      expect(primaryRepo.aiReason).toContain('前端');
      expect(primaryRepo.aiReason.length).toBeGreaterThan(20);
    });
  });

  describe('进度回调', () => {
    it('应该在不同阶段触发进度回调', async () => {
      const progressLogs: string[] = [];
      
      const { client } = createMockClient((prompt) => {
        if (prompt.includes('可选仓库')) {
          return mockOpencodeOutputs.repoDetection;
        }
        if (prompt.includes('需求分析')) {
          return mockOpencodeOutputs.requirementAnalysis;
        }
        return JSON.stringify({});
      });
      const progressAnalyzer = new RequirementAnalyzer(
        mockTfsClient,
        () => client,
        () => null,
        (progress) => {
          progressLogs.push(`${progress.stage}:${progress.progress}`);
        }
      );

      await progressAnalyzer.analyze(10001);

      // 验证关键阶段都有回调
      expect(progressLogs).toContain('fetching:10');
      expect(progressLogs).toContain('analyzing:30');
      expect(progressLogs).toContain('detecting_repos:60');
      expect(progressLogs).toContain('completed:100');
    });
  });
});

describe('需求分析真实场景测试', () => {
  // 真实 TFS 工作项 ID：699076, 699073, 699067
  const REAL_WORKITEMS = [699076, 699073, 699067];

  it.skip('应该能正确分析真实工作项（需要实际配置 OpenCode）', async () => {
    // 注意：这个测试需要真实的 TFS 连接和 OpenCode Engine
    // 默认跳过，只在手动测试时启用
    
    for (const workItemId of REAL_WORKITEMS) {
      console.log(`\n========== 测试工作项 ${workItemId} ==========`);
      
      // 这里需要真实的 TFS 客户端和 OpenCode 配置
      // const result = await analyzer.analyze(workItemId);
      
      // console.log('摘要:', result.summary);
      // console.log('功能点:', result.keyFeatures.join('、'));
      // console.log('主要仓库:', result.aiRepos.primaryRepos.map(r => r.name).join('、'));
      // console.log('AI分析:', result.aiAnalysis);
    }
  });
});
