// sync-task-to-tfs.ts
// TFS 子任务同步模块 - 将 AI 分析结果和开发计划同步到 TFS

import type { TFSClient } from '../../api/tfs';
import type { 
  ParsedRequirement, 
  RepositoryMatch, 
  DetectionResult 
} from '../../types/requirement-analyzer';

/**
 * TFS 同步配置
 */
export interface TfsSyncConfig {
  /** 是否自动同步 */
  autoSync: boolean;
  /** 项目前缀（用于任务标题） */
  projectPrefix?: string;
  /** 自定义标签 */
  customTags?: string[];
}

/**
 * 同步状态
 */
export interface TfsSyncStatus {
  /** 是否已同步分析任务 */
  analysisSynced: boolean;
  /** 分析任务 ID */
  analysisTaskId?: number;
  /** 是否已同步计划任务 */
  planSynced: boolean;
  /** 计划任务 ID */
  planTaskId?: number;
  /** 最后同步时间 */
  lastSyncedAt?: string;
  /** 错误信息 */
  error?: string;
  /** 是否正在同步中 */
  isSyncing?: boolean;
}

/**
 * 同步选项
 */
export interface SyncOptions {
  /** 工作区根目录 */
  workspaceRoot: string;
  /** 项目名 */
  project: string;
  /** 是否强制更新（即使已存在） */
  force?: boolean;
  /** 分配给 */
  assignedTo?: string;
  /** 优先级 */
  priority?: number;
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  analysisTaskId?: number;
  planTaskId?: number;
  error?: string;
}

// TFS Description 字段长度限制（约 32KB，留一些余量）
const MAX_DESCRIPTION_LENGTH = 200000;
const MAX_COMMENT_HTML_LENGTH = Math.max(8000, Math.min(20000, MAX_DESCRIPTION_LENGTH - 1000));

/**
 * 创建需求分析子任务
 */
export async function createAnalysisTask(
  tfsClient: TFSClient,
  parentId: number,
  parentTitle: string,
  requirement: ParsedRequirement,
  detection: DetectionResult,
  options: SyncOptions
): Promise<{ success: boolean; taskId?: number; error?: string }> {
  console.log('[TFS Sync] createAnalysisTask called:', { parentId, parentTitle, project: options.project, force: options.force });
  try {
    // 检查是否已存在
    if (!options.force) {
      console.log('[TFS Sync] Checking for existing analysis task...');
      const existing = await tfsClient.hasChildTaskWithTag(parentId, 'AI分析', options.project);
      console.log('[TFS Sync] Existing check result:', existing);
      if (existing.exists) {
        console.log(`[TFS Sync] AI分析子任务已存在: #${existing.taskId}`);
        return { success: true, taskId: existing.taskId };
      }
    }

    // 格式化描述
    console.log('[TFS Sync] Formatting analysis description...');
    const description = formatAnalysisDescription(requirement, detection);
    console.log('[TFS Sync] Description length:', description.length);
    
    // 创建子任务
    console.log('[TFS Sync] Calling createChildTask for analysis...');
    const task = await tfsClient.createChildTask(
      options.project,
      {
        title: `[自动生成] ${parentTitle} - 需求分析`,
        description,
        assignedTo: options.assignedTo,
        priority: options.priority
      },
      parentId,
      'AI分析;OpenWork'
    );

    console.log(`[TFS Sync] 创建 AI分析子任务成功: #${task.id}`);
    return { success: true, taskId: task.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[TFS Sync] 创建 AI分析子任务失败:`, message);
    return { success: false, error: message };
  }
}


/**
 * 创建开发计划子任务
 */
export async function createPlanTask(
  tfsClient: TFSClient,
  parentId: number,
  parentTitle: string,
  tfsId: number,
  requirement: ParsedRequirement,
  selectedRepos: RepositoryMatch[],
  options: SyncOptions,
  docs?: { intent?: string; design?: string; tasks?: string }
): Promise<{ success: boolean; taskId?: number; error?: string }> {
  console.log('[TFS Sync] createPlanTask called:', { parentId, parentTitle, tfsId, project: options.project, force: options.force });
  try {
    // 检查是否已存在
    if (!options.force) {
      console.log('[TFS Sync] Checking for existing plan task...');
      const existing = await tfsClient.hasChildTaskWithTag(parentId, 'AI计划', options.project);
      console.log('[TFS Sync] Existing plan check result:', existing);
      if (existing.exists) {
        console.log(`[TFS Sync] AI计划子任务已存在: #${existing.taskId}`);
        return { success: true, taskId: existing.taskId };
      }
    }

    // 格式化描述
    console.log('[TFS Sync] Formatting plan description...');
    const formatted = formatPlanDescription(
      tfsId,
      requirement,
      selectedRepos,
      options.workspaceRoot,
      docs
    );
    const description = formatted.html;
    console.log('[TFS Sync] Plan description length:', description.length);
    
    // 创建子任务
    console.log('[TFS Sync] Calling createChildTask for plan...');
    const task = await tfsClient.createChildTask(
      options.project,
      {
        title: `[自动生成] ${parentTitle} - 开发计划`,
        description,
        assignedTo: options.assignedTo,
        priority: options.priority
      },
      parentId,
      'AI计划;OpenWork'
    );

    if (!task.id) {
      throw new Error('TFS task created without id');
    }

    console.log(`[TFS Sync] 创建 AI计划子任务成功: #${task.id}`);

    if (docs && formatted.truncated) {
      try {
        await appendPlanDocsAsComments(tfsClient, task.id, tfsId, options.workspaceRoot, docs);
      } catch (commentError) {
        const message = commentError instanceof Error ? commentError.message : String(commentError);
        console.warn('[TFS Sync] Failed to append plan docs to comments:', message);
      }
    }

    return { success: true, taskId: task.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[TFS Sync] 创建 AI计划子任务失败:`, message);
    return { success: false, error: message };
  }
}


/**
 * 同步所有内容到 TFS（便捷方法）
 */
export async function syncAllToTFS(
  tfsClient: TFSClient,
  parentId: number,
  parentTitle: string,
  parentProject: string,
  requirement: ParsedRequirement,
  detection: DetectionResult,
  selectedRepos: RepositoryMatch[],
  options: SyncOptions,
  docs?: { intent?: string; design?: string; tasks?: string }
): Promise<SyncResult> {
  const result: SyncResult = { success: false };

  try {
    // 1. 同步分析任务
    const analysisResult = await createAnalysisTask(
      tfsClient,
      parentId,
      parentTitle,
      requirement,
      detection,
      options
    );

    if (analysisResult.success) {
      result.analysisTaskId = analysisResult.taskId;
    }

    // 2. 同步计划任务
    const planResult = await createPlanTask(
      tfsClient,
      parentId,
      parentTitle,
      parentId,
      requirement,
      selectedRepos,
      options,
      docs
    );

    if (planResult.success) {
      result.planTaskId = planResult.taskId;
    }

    result.success = !!(result.analysisTaskId || result.planTaskId);
    
    if (result.success) {
      console.log(`[TFS Sync] 同步完成: 分析任务 #${result.analysisTaskId}, 计划任务 #${result.planTaskId}`);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`[TFS Sync] 同步失败:`, result.error);
  }

  return result;
}

/**
 * 检查同步状态
 */
export async function checkSyncStatus(
  tfsClient: TFSClient,
  parentId: number,
  project?: string
): Promise<TfsSyncStatus> {
  try {
    const children = await tfsClient.getChildTasks(parentId, project);
    
    const analysisTask = children.find(t => 
      String(t.fields?.['System.Tags'] || '').includes('AI分析')
    );
    
    const planTask = children.find(t => 
      String(t.fields?.['System.Tags'] || '').includes('AI计划')
    );

    return {
      analysisSynced: !!analysisTask,
      analysisTaskId: analysisTask?.id,
      planSynced: !!planTask,
      planTaskId: planTask?.id,
      lastSyncedAt: analysisTask 
        ? new Date().toISOString() 
        : undefined
    };
  } catch (error) {
    console.error(`[TFS Sync] 检查同步状态失败:`, error);
    return {
      analysisSynced: false,
      planSynced: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 格式化需求分析描述
 */
function formatAnalysisDescription(
  requirement: ParsedRequirement,
  detection: DetectionResult
): string {
  const parts: string[] = [];

  // 摘要
  parts.push('## 📊 需求摘要');
  parts.push(requirement.summary || '暂无摘要');
  parts.push('');

  // 功能点
  parts.push('## 🎯 识别到的功能点');
  if (requirement.keyFeatures?.length > 0) {
    requirement.keyFeatures.forEach(feature => {
      parts.push(`- ${feature}`);
    });
  } else {
    parts.push('- 需求实现');
  }
  parts.push('');

  // 技术栈
  parts.push('## 🔧 技术栈');
  parts.push(`- 前端: ${requirement.techIndicators?.frontend ? '是' : '否'}`);
  parts.push(`- 后端: ${requirement.techIndicators?.backend ? '是' : '否'}`);
  parts.push(`- 数据库: ${requirement.techIndicators?.database ? '是' : '否'}`);
  parts.push('');

  // 主要仓库
  parts.push('## 📁 主要目标仓库');
  if (detection.primary?.length > 0) {
    detection.primary.forEach(repo => {
      parts.push(`- **${repo.name}** (${Math.round(repo.confidence * 100)}%)`);
      parts.push(`  - 路径: ${repo.path}`);
      parts.push(`  - 原因: ${repo.reason}`);
      parts.push('');
    });
  } else {
    parts.push('- 待确定');
    parts.push('');
  }

  // 次要仓库
  if (detection.secondary?.length > 0) {
    parts.push('## 📁 次要目标仓库');
    detection.secondary.forEach(repo => {
      parts.push(`- ${repo.name} (${Math.round(repo.confidence * 100)}%)`);
    });
    parts.push('');
  }

  // 领域关键词
  if (requirement.domainKeywords?.length > 0) {
    parts.push('## 🏷️ 领域关键词');
    parts.push(requirement.domainKeywords.join(', '));
    parts.push('');
  }

  // 分隔线
  parts.push('---');
  parts.push('🤖 由 OpenWork AI 自动生成');
  parts.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);

  let content = parts.join('\n');
  
  // 截断处理
  if (content.length > MAX_DESCRIPTION_LENGTH) {
    content = content.substring(0, MAX_DESCRIPTION_LENGTH - 100);
    content += '\n\n[内容过长，已截断。完整分析请查看 OpenWork]';
  }

  return markdownToTfsHtml(content, MAX_DESCRIPTION_LENGTH);
}

/**
 * 格式化开发计划描述
 */
function formatPlanDescription(
  tfsId: number,
  requirement: ParsedRequirement,
  selectedRepos: RepositoryMatch[],
  workspaceRoot: string,
  docs?: { intent?: string; design?: string; tasks?: string }
): { html: string; truncated: boolean } {
  const parts: string[] = [];

  // Intent
  parts.push('## 📄 开发意图 (Intent)');
  if (docs?.intent) {
    parts.push(docs.intent);
  } else {
    parts.push(requirement.summary || '暂无');
  }
  parts.push('');

  // 技术栈
  const techStack: string[] = [];
  if (requirement.techIndicators?.frontend) techStack.push('前端');
  if (requirement.techIndicators?.backend) techStack.push('后端');
  if (requirement.techIndicators?.database) techStack.push('数据库');
  
  parts.push('### 技术栈');
  parts.push(techStack.length > 0 ? techStack.join('、') : '待确定');
  parts.push('');

  // 目标仓库
  parts.push('### 目标仓库');
  selectedRepos.forEach(repo => {
    parts.push(`- ${repo.name}${repo.isPrimary ? ' (主要)' : ''}`);
  });
  parts.push('');

  // Design
  parts.push('## 📄 技术设计 (Design)');
  if (docs?.design) {
    parts.push(docs.design);
  } else {
    parts.push('详见本地文档');
  }
  parts.push('');

  // Tasks
  parts.push('## 📋 任务清单 (Tasks)');
  if (docs?.tasks) {
    parts.push(docs.tasks);
  } else {
    parts.push('详见本地文档');
  }
  parts.push('');

  // 完整文档链接
  parts.push('## 🔗 完整文档');
  parts.push(`本地文档路径: \`${workspaceRoot}/forge/tracks/tfs-${tfsId}/\``);
  parts.push('完整内容已同步到任务描述中，超长内容会追加到评论。');
  parts.push('');
  parts.push('- **intent.md** - 开发意图完整文档');
  parts.push('- **design.md** - 技术设计完整文档');
  parts.push('- **tasks.md** - 任务清单完整文档');
  parts.push('');

  // 分隔线
  parts.push('---');
  parts.push('🤖 由 OpenWork AI 自动生成');
  parts.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);

  let content = parts.join('\n');
  let truncated = false;
  
  // 截断处理
  if (content.length > MAX_DESCRIPTION_LENGTH) {
    truncated = true;
    content = content.substring(0, MAX_DESCRIPTION_LENGTH - 100);
    content += '\n\n[内容过长，已截断。完整文档请查看本地文件]';
  }

  return {
    html: markdownToTfsHtml(content, MAX_DESCRIPTION_LENGTH),
    truncated
  };
}

function markdownToTfsHtml(content: string, maxLength: number): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const htmlLines: string[] = [];
  let totalLength = 0;

  for (const line of lines) {
    const htmlLine = renderMarkdownLine(line);
    if (totalLength + htmlLine.length > maxLength) {
      const tail = "<div>内容过长，已截断。</div>";
      if (totalLength + tail.length <= maxLength) {
        htmlLines.push(tail);
      }
      break;
    }
    htmlLines.push(htmlLine);
    totalLength += htmlLine.length;
  }

  return htmlLines.join("");
}

async function appendPlanDocsAsComments(
  tfsClient: TFSClient,
  taskId: number,
  tfsId: number,
  workspaceRoot: string,
  docs: { intent?: string; design?: string; tasks?: string }
): Promise<void> {
  const sections: Array<{ title: string; content?: string }> = [
    { title: 'intent.md - 开发意图', content: docs.intent },
    { title: 'design.md - 技术设计', content: docs.design },
    { title: 'tasks.md - 任务清单', content: docs.tasks },
  ];

  const header = [
    '## 📌 完整文档内容（自动同步）',
    `来源路径: ${workspaceRoot}/forge/tracks/tfs-${tfsId}/`,
    '如果内容过长，将分段写入评论。',
    '',
  ].join('\n');

  await tfsClient.addComment(taskId, markdownToTfsHtml(header, MAX_DESCRIPTION_LENGTH));

  for (const section of sections) {
    if (!section.content) continue;

    await tfsClient.addComment(
      taskId,
      markdownToTfsHtml(`## ${section.title}`, MAX_DESCRIPTION_LENGTH)
    );

    const chunks = chunkMarkdownToHtml(section.content, MAX_COMMENT_HTML_LENGTH);
    for (let index = 0; index < chunks.length; index += 1) {
      const prefix = chunks.length > 1
        ? renderMarkdownLine(`（${index + 1}/${chunks.length}）`)
        : '';
      await tfsClient.addComment(taskId, `${prefix}${chunks[index]}`);
    }
  }
}

function chunkMarkdownToHtml(content: string, maxLength: number): string[] {
  if (!content) return [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const chunks: string[] = [];
  let buffer: string[] = [];
  let currentLength = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    chunks.push(buffer.join(''));
    buffer = [];
    currentLength = 0;
  };

  const pushLine = (line: string) => {
    const htmlLine = renderMarkdownLine(line);
    if (htmlLine.length > maxLength) {
      flush();
      const segments = splitTextByLength(line, Math.max(1000, Math.floor(maxLength / 4)));
      for (const segment of segments) {
        const segmentHtml = renderMarkdownLine(segment);
        chunks.push(segmentHtml);
      }
      return;
    }

    if (currentLength + htmlLine.length > maxLength) {
      flush();
    }

    buffer.push(htmlLine);
    currentLength += htmlLine.length;
  };

  for (const line of lines) {
    pushLine(line);
  }

  flush();
  return chunks;
}

function splitTextByLength(text: string, length: number): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += length) {
    chunks.push(text.slice(i, i + length));
  }
  return chunks;
}

function renderMarkdownLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "<div><br></div>";
  }

  const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
  if (headingMatch) {
    const headingText = formatInlineMarkdown(headingMatch[1]);
    return `<div><span style="font-weight:bold;">${headingText}</span></div>`;
  }

  const bulletMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
  if (bulletMatch) {
    const indent = "&nbsp;".repeat(bulletMatch[1].length);
    const bulletText = formatInlineMarkdown(bulletMatch[3]);
    return `<div>${indent}• ${bulletText}</div>`;
  }

  return `<div>${formatInlineMarkdown(line)}</div>`;
}

function formatInlineMarkdown(text: string): string {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight:bold;">$1</span>');
  safe = safe.replace(/__([^_]+)__/g, '<span style="font-weight:bold;">$1</span>');
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');
  return safe;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 提取文档摘要
 */
function extractSummary(content: string, maxLength: number): string {
  // 移除 markdown 格式
  const plainText = content
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  return plainText.substring(0, maxLength) + '...';
}

/**
 * 提取任务摘要
 */
function extractTaskSummary(tasksContent: string): string {
  const lines = tasksContent.split('\n');
  const summary: string[] = [];
  let phaseCount = 0;
  
  for (const line of lines) {
    // 提取阶段标题
    if (line.match(/^##\s+Phase\s+\d+/i) || line.match(/^##\s+第[一二三四五六]阶段/)) {
      if (phaseCount < 3) {
        summary.push(line.replace(/^##\s*/, '- '));
        phaseCount++;
      }
    }
    // 提取完成的任务
    else if (line.includes('- [x]') && summary.length < 10) {
      summary.push('  ' + line.trim());
    }
    // 提取未完成的任务
    else if (line.includes('- [ ]') && summary.length < 10) {
      summary.push('  ' + line.trim());
    }
  }
  
  if (summary.length === 0) {
    return '详见本地文档';
  }
  
  return summary.join('\n');
}

export default {
  createAnalysisTask,
  createPlanTask,
  syncAllToTFS,
  checkSyncStatus
};
