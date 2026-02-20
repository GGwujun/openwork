// api/requirement-analyzer/__tests__/utils/mock-opencode.ts
// 模拟 OpenCode Engine 服务

export interface MockOpencodeOptions {
  delay?: number;
  errorRate?: number;
}

export interface MockSession {
  id: string;
  prompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * 创建模拟 OpenCode 服务器
 */
export function createMockOpencode(options: MockOpencodeOptions = {}) {
  const { delay = 500, errorRate = 0 } = options;
  const sessions = new Map<string, MockSession>();
  let sessionId = 0;

  return {
    // 创建会话
    async createSession(prompt: string): Promise<MockSession> {
      await sleep(delay);
      
      if (Math.random() < errorRate) {
        throw new Error('模拟 OpenCode 错误');
      }

      const id = `session-${++sessionId}`;
      const session: MockSession = {
        id,
        prompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      };

      sessions.set(id, session);
      
      // 自动生成 AI 响应
      const aiResponse = generateAIResponse(prompt);
      session.messages.push({ role: 'assistant', content: aiResponse });
      
      return session;
    },

    // 获取会话
    async getSession(id: string): Promise<MockSession | null> {
      await sleep(delay / 2);
      return sessions.get(id) || null;
    },

    // 清理
    clear() {
      sessions.clear();
    }
  };
}

/**
 * 根据 Prompt 生成 AI 响应
 */
function generateAIResponse(prompt: string): string {
  // 需求分析场景
  if (prompt.includes('需求分析')) {
    return generateRequirementAnalysisResponse(prompt);
  }
  
  // 仓库识别场景
  if (prompt.includes('仓库')) {
    return generateRepoDetectionResponse(prompt);
  }
  
  return JSON.stringify({ error: '无法识别的 prompt 类型' });
}

/**
 * 生成需求分析响应
 */
function generateRequirementAnalysisResponse(prompt: string): string {
  const titleMatch = prompt.match(/【需求标题】\n(.+)/);
  const contentMatch = prompt.match(/【需求内容】\n([\s\S]+?)(?=\n\n请分析)/);
  
  const title = titleMatch?.[1] || '';
  const content = contentMatch?.[1] || '';
  
  // 根据内容判断需求类型
  let summary = '需求开发';
  let keyFeatures: string[] = [];
  let techStack = { frontend: false, backend: false, database: false };
  let domain = '通用';

  if (content.includes('校验') || content.includes('验证')) {
    summary = '参数校验: 修改配置参数校验功能';
    keyFeatures = ['修改配置参数', '添加参数校验'];
    techStack = { frontend: true, backend: true, database: false };
    domain = '配置中心';
  } else if (content.includes('登录') || content.includes('认证')) {
    summary = '认证优化: 优化登录认证流程';
    keyFeatures = ['优化登录认证', '修复认证问题'];
    techStack = { frontend: true, backend: true, database: true };
    domain = '认证中心';
  } else if (content.includes('查询') || content.includes('接口')) {
    summary = '接口优化: 优化查询接口性能';
    keyFeatures = ['优化查询接口', '提升查询性能'];
    techStack = { frontend: false, backend: true, database: true };
    domain = '数据服务';
  } else {
    summary = extractActionAndTarget(title, content);
    keyFeatures = extractFeatures(content);
    techStack = detectTechStack(content);
  }

  return JSON.stringify({
    summary,
    keyFeatures,
    techStack,
    domain,
    keywords: extractKeywords(content)
  });
}

/**
 * 生成仓库识别响应
 */
function generateRepoDetectionResponse(prompt: string): string {
  const reposMatch = prompt.match(/【当前可选仓库】\n([\s\S]+?)\n\n【需求分析结果】/);
  let availableRepos: any[] = [];
  
  if (reposMatch) {
    try {
      availableRepos = JSON.parse(reposMatch[1]);
    } catch (e) {
      console.warn('Failed to parse available repos');
    }
  }

  const summaryMatch = prompt.match(/- 摘要：(.+)/);
  const featuresMatch = prompt.match(/- 功能点：(.+)/);
  
  const summary = summaryMatch?.[1] || '';
  const features = featuresMatch?.[1] || '';

  // 根据摘要和功能点匹配仓库
  const primaryRepos: any[] = [];
  const secondaryRepos: any[] = [];

  for (const repo of availableRepos) {
    const confidence = calculateRepoConfidence(repo, summary, features);
    
    if (confidence >= 0.8) {
      primaryRepos.push({
        repoId: repo.id,
        reason: generateReason(repo, summary, features),
        confidence: Math.min(confidence, 0.99)
      });
    } else if (confidence >= 0.6) {
      secondaryRepos.push({
        repoId: repo.id,
        reason: generateSecondaryReason(repo),
        confidence
      });
    }
  }

  // 限制数量
  const limitedPrimary = primaryRepos.slice(0, 3);
  const limitedSecondary = secondaryRepos.slice(0, 5);

  return JSON.stringify({
    primaryRepos: limitedPrimary,
    secondaryRepos: limitedSecondary,
    analysis: limitedPrimary.length > 0 
      ? `基于需求摘要"${summary}"和功能点"${features}"，主要涉及${limitedPrimary.map(r => r.repoId).join('、')}仓库。`
      : '未识别到高置信度匹配的仓库，请手动选择。'
  });
}

// 辅助函数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractActionAndTarget(title: string, content: string): string {
  const actionKeywords = ['修改', '添加', '优化', '实现', '重构', '删除', '修复', '完善'];
  const text = title + ' ' + content;
  
  for (const action of actionKeywords) {
    if (text.includes(action)) {
      // 提取动作后面的内容（最多15个字）
      const match = text.match(new RegExp(`${action}([\\u4e00-\\u9fa5]{2,15})`));
      if (match) {
        return `${action}: ${match[1]}`;
      }
    }
  }
  
  return '功能开发: 需求实现';
}

function extractFeatures(content: string): string[] {
  const features: string[] = [];
  const patterns = [
    /(修改|调整|优化|完善|重构)([^，。；]{2,10})/g,
    /(添加|新增|创建|开发|实现)([^，。；]{2,10})/g
  ];
  
  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const feature = match[1] + match[2];
      if (feature.length >= 4 && feature.length <= 12) {
        features.push(feature);
      }
    }
  }
  
  return features.slice(0, 3);
}

function detectTechStack(content: string): { frontend: boolean; backend: boolean; database: boolean } {
  const text = content.toLowerCase();
  return {
    frontend: /react|vue|angular|ui|页面|前端|css|html|typescript/.test(text),
    backend: /api|接口|服务|后端|controller|service|java|spring/.test(text),
    database: /sql|数据库|table|查询|存储|db/.test(text)
  };
}

function extractKeywords(content: string): string[] {
  const keywords = new Set<string>();
  const matches = content.match(/[a-zA-Z]+|[\u4e00-\u9fa5]{2,4}/g) || [];
  matches.forEach(m => {
    if (m.length >= 2 && !/^(的|了|是|需要|针对)$/.test(m)) {
      keywords.add(m);
    }
  });
  return Array.from(keywords).slice(0, 8);
}

function calculateRepoConfidence(repo: any, summary: string, features: string): number {
  let score = 0;
  const text = `${summary} ${features}`.toLowerCase();
  const repoDesc = `${repo.name} ${repo.description} ${repo.keywords?.join(' ')}`.toLowerCase();
  
  // 关键词匹配
  for (const keyword of repo.keywords || []) {
    if (text.includes(keyword.toLowerCase())) {
      score += 0.3;
    }
  }
  
  // 名称匹配
  if (text.includes(repo.name.toLowerCase())) {
    score += 0.5;
  }
  
  // 技术栈匹配
  if (repo.techStack?.includes('frontend') && /ui|页面|前端/.test(text)) {
    score += 0.2;
  }
  if (repo.techStack?.includes('backend') && /api|接口|后端/.test(text)) {
    score += 0.2;
  }
  
  // 基础分 + 随机波动（模拟 AI 不确定性）
  return Math.min(0.4 + score + Math.random() * 0.1, 0.98);
}

function generateReason(repo: any, summary: string, features: string): string {
  return `基于需求"${summary}"和"${features}", 需要使用或修改${repo.name}中的相关功能。`;
}

function generateSecondaryReason(repo: any): string {
  return `可能需要使用${repo.name}中的工具类或配置。`;
}

export default createMockOpencode;
