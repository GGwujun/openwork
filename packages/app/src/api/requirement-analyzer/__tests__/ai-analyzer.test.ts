// api/requirement-analyzer/__tests__/ai-analyzer.test.ts
// AI 需求分析器测试用例

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequirementAnalyzer, AIAnalysisResult } from '../index';
import type { TFSClient } from '../../tfs';
import { createMockClient } from './utils/mock-opencode-client';

describe('RequirementAnalyzer (AI 增强版)', () => {
  let analyzer: RequirementAnalyzer;
  let mockTfsClient: TFSClient;
  const createAnalyzerWithOutputs = (outputs: Array<string | Error>) => {
    const queue = [...outputs];
    const fallback = outputs.length > 0 ? outputs[outputs.length - 1] : "";
    const { client } = createMockClient(() => queue.shift() ?? fallback);
    return new RequirementAnalyzer(
      mockTfsClient,
      () => client,
      () => null,
      vi.fn()
    );
  };

  beforeEach(() => {
    // Mock TFS Client
    mockTfsClient = {
      getWorkItem: vi.fn()
    } as unknown as TFSClient;

    const { client } = createMockClient(() => "");
    analyzer = new RequirementAnalyzer(
      mockTfsClient,
      () => client,
      () => null,
      vi.fn()
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyze - 需求提取', () => {
    it('应该正确提取工作项标题和描述', async () => {
      const workItem = {
        id: 12345,
        fields: {
          'System.Title': 'spark2.0开发（开发者设计）',
          'System.Description': '<p>修改spark的登录插件，针对插件的配置参数做参数校验</p>',
          'Winning.Demand.Analysis': '<h3>二、需求分析</h3><p>1.功能分析</p><p>修改spark的登录插件，针对插件的配置参数做参数校验</p>',
          'System.AreaPath': '\\Project\\Auth'
        }
      };

      mockTfsClient.getWorkItem = vi.fn().mockResolvedValue(workItem);
      
      analyzer = createAnalyzerWithOutputs([
        JSON.stringify({
          summary: '参数校验: 修改spark登录插件配置',
          keyFeatures: ['修改登录插件', '配置参数校验'],
          techStack: { frontend: true, backend: true, database: false },
          domain: '认证中心',
          keywords: ['spark', '登录', '校验', '配置']
        }),
        JSON.stringify({
          primaryRepos: [{
            repoId: 'spark-login-plugin',
            reason: '需求明确要求修改spark的登录插件，需要添加配置验证逻辑',
            confidence: 0.95
          }],
          secondaryRepos: [],
          analysis: '基于需求内容和关键词，主要涉及spark-login-plugin仓库'
        })
      ]);

      const result = await analyzer.analyze(12345);

      expect(result.title).toBe('spark2.0开发（开发者设计）');
      expect(result.summary).toBe('参数校验: 修改spark登录插件配置');
      expect(result.keyFeatures).toContain('修改登录插件');
      expect(result.keyFeatures).toContain('配置参数校验');
    });

    it('应该正确处理标题中的括号内容', async () => {
      const workItem = {
        id: 12346,
        fields: {
          'System.Title': '修复登录Bug（独立项）',
          'Winning.Demand.Analysis': '<p>修复用户登录时的闪退问题</p>',
          'Microsoft.VSTS.Common.AcceptanceCriteria': '<p>登录不再闪退</p>'
        }
      };

      mockTfsClient.getWorkItem = vi.fn().mockResolvedValue(workItem);

      analyzer = createAnalyzerWithOutputs([
        JSON.stringify({
          summary: '缺陷修复: 修复登录闪退问题',
          keyFeatures: ['修复登录闪退', '优化登录稳定性'],
          techStack: { frontend: true, backend: false, database: false },
          domain: '用户认证',
          keywords: ['登录', '闪退', '修复']
        }),
        JSON.stringify({
          primaryRepos: [{
            repoId: 'spark-login-plugin',
            reason: '登录闪退问题需要修改登录插件的错误处理逻辑',
            confidence: 0.88
          }],
          secondaryRepos: [],
          analysis: '登录相关问题主要涉及登录插件模块'
        })
      ]);

      const result = await analyzer.analyze(12346);

      // 验证摘要不包含"独立项"
      expect(result.summary).not.toContain('独立项');
      expect(result.summary).toContain('缺陷修复');
    });

    it('应该在功能点为动词+名词格式时正确解析', async () => {
      const testCases = [
        { input: '<p>添加用户管理功能</p>', expected: ['添加用户管理'] },
        { input: '<p>优化数据库查询性能</p>', expected: ['优化数据库查询'] },
        { input: '<p>实现扫码支付接口</p>', expected: ['实现扫码支付'] }
      ];

      for (const testCase of testCases) {
        const workItem = {
          id: 12347,
          fields: {
            'System.Title': '功能开发',
            'Winning.Demand.Analysis': testCase.input
          }
        };

        mockTfsClient.getWorkItem = vi.fn().mockResolvedValue(workItem);

        analyzer = createAnalyzerWithOutputs([
          JSON.stringify({
            summary: '功能开发',
            keyFeatures: testCase.expected,
            techStack: { frontend: true, backend: true, database: false },
            domain: '通用',
            keywords: []
          }),
          JSON.stringify({
            primaryRepos: [],
            secondaryRepos: [],
            analysis: '测试用例'
          })
        ]);

        const result = await analyzer.analyze(12347);
        
        // 验证功能点格式
        expect(result.keyFeatures.length).toBeGreaterThan(0);
        result.keyFeatures.forEach(feature => {
          expect(feature).toMatch(/^[\u4e00-\u9fa5]+/); // 以中文开头
        });
      }
    });
  });

  describe('analyze - AI 仓库识别', () => {
    it('应该识别主仓库且置信度 >= 80%', async () => {
      const workItem = {
        id: 12348,
        fields: {
          'System.Title': '配置参数校验',
          'Winning.Demand.Analysis': '<p>修改spark的登录插件，针对插件的配置参数做参数校验</p>'
        }
      };

      mockTfsClient.getWorkItem = vi.fn().mockResolvedValue(workItem);

      analyzer = createAnalyzerWithOutputs([
        JSON.stringify({
          summary: '参数校验: 修改spark登录插件配置',
          keyFeatures: ['修改登录插件', '配置参数校验'],
          techStack: { frontend: true, backend: true, database: false },
          domain: '认证中心',
          keywords: ['spark', '登录', '校验']
        }),
        JSON.stringify({
          primaryRepos: [{
            repoId: 'spark-ui',
            reason: '需求涉及spark前端框架配置与校验，主要影响spark UI前端模块',
            confidence: 0.95
          }],
          secondaryRepos: [],
          analysis: '基于需求摘要和关键词匹配'
        })
      ]);

      const result = await analyzer.analyze(12348);

      expect(result.aiRepos.primaryRepos).toHaveLength(1);
      expect(result.aiRepos.primaryRepos[0].aiConfidence).toBeGreaterThanOrEqual(0.8);
      expect(result.aiRepos.primaryRepos[0].name).toBe('Spark UI前端框架');
    });

    it('应该过滤掉置信度 < 80% 的仓库', async () => {
      const workItem = {
        id: 12349,
        fields: {
          'System.Title': '查询优化',
          'Winning.Demand.Analysis': '<p>优化用户查询接口</p>'
        }
      };

      mockTfsClient.getWorkItem = vi.fn().mockResolvedValue(workItem);

      analyzer = createAnalyzerWithOutputs([
        JSON.stringify({
          summary: '性能优化: 优化用户查询接口',
          keyFeatures: ['优化查询接口'],
          techStack: { frontend: false, backend: true, database: true },
          domain: '查询系统',
          keywords: ['查询', '优化']
        }),
        JSON.stringify({
          primaryRepos: [
            {
              repoId: 'billing-api',
              reason: '需要优化用户查询逻辑',
              confidence: 0.85
            },
            {
              repoId: 'outpatient-web',
              reason: '低置信度仓库',
              confidence: 0.75
            }
          ],
          secondaryRepos: [],
          analysis: '测试低置信度过滤'
        })
      ]);

      const result = await analyzer.analyze(12349);

      // 只保留 >= 80% 的仓库
      expect(result.aiRepos.primaryRepos).toHaveLength(1);
      expect(result.aiRepos.primaryRepos[0].aiConfidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('cleanHtml - HTML 清理', () => {
    it('应该正确清理 HTML 标签', () => {
      const { client } = createMockClient(() => "");
      const analyzer = new RequirementAnalyzer({} as TFSClient, () => client);
      
      const testCases = [
        { input: '<p>测试</p>', expected: '测试' },
        { input: '<h1>标题</h1><p>内容</p>', expected: '标题 内容' },
        { input: '&nbsp;&lt;&gt;&amp;', expected: '<>&' },
        { input: '<div>  多   空格  </div>', expected: '多 空格' }
      ];

      testCases.forEach(({ input, expected }) => {
        // 通过反射访问 private 方法
        const result = (analyzer as any).cleanHtml(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('parseAnalysisResponse - JSON 解析', () => {
    it('应该正确解析 markdown 代码块包裹的 JSON', () => {
      const { client } = createMockClient(() => "");
      const analyzer = new RequirementAnalyzer({} as TFSClient, () => client);
      
      const testCases = [
        {
          input: '```json\n{"summary": "测试"}\n```',
          expected: { summary: '测试' }
        },
        {
          input: '```\n{"summary": "测试"}\n```',
          expected: { summary: '测试' }
        },
        {
          input: '{"summary": "测试"}',
          expected: { summary: '测试' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (analyzer as any).parseAnalysisResponse(input);
        expect(result.summary).toBe(expected.summary);
      });
    });

    it('应该在 JSON 解析失败时抛出错误', () => {
      const { client } = createMockClient(() => "");
      const analyzer = new RequirementAnalyzer({} as TFSClient, () => client);
      
      expect(() => {
        (analyzer as any).parseAnalysisResponse('invalid json');
      }).toThrow('AI 分析结果格式错误');
    });
  });

  describe('错误处理', () => {
    it('应该正确处理 OpenCode API 错误', async () => {
      const workItem = {
        id: 12350,
        fields: {
          'System.Title': '测试',
          'Winning.Demand.Analysis': '<p>测试内容</p>'
        }
      };

      mockTfsClient.getWorkItem = vi.fn().mockResolvedValue(workItem);
      analyzer = createAnalyzerWithOutputs([new Error('OpenCode API 错误')]);

      vi.useFakeTimers();
      const promise = analyzer.analyze(12350);
      const expectation = expect(promise).rejects.toThrow('AI 分析失败');
      await vi.runAllTimersAsync();
      await expectation;
      vi.useRealTimers();
    });

    it('应该处理工作项不存在的情况', async () => {
      mockTfsClient.getWorkItem = vi.fn().mockResolvedValue(null);

      await expect(analyzer.analyze(99999)).rejects.toThrow('not found');
    });
  });
});
