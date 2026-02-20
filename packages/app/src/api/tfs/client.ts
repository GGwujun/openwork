/**
 * TFS Client - TFS 2018 API 客户端 (Browser-compatible)
 * 使用原生 fetch API，兼容 Tauri WebView 环境
 */

import type {
  TFSConfig,
  FormattedWorkItem,
  CreateWorkItemFields,
  QueryWorkItemsOptions
} from './types';
import { DEFAULT_SERVER_URL, PROJECTS } from './types';

// 定义最小化的 WorkItem 类型
interface WorkItem {
  id?: number;
  fields?: Record<string, unknown>;
  workItems?: Array<{ id?: number; url?: string }>;
}

// 定义最小化的 Commit 类型
interface GitCommitRef {
  commitId?: string;
  comment?: string;
  author?: { date?: Date };
  committer?: { date?: Date };
  workItems?: Array<{ id?: number; url?: string }>;
}

export class TFSClient {
  private serverUrl: string;
  private pat: string;
  private username: string | null;

  constructor(config: TFSConfig) {
    this.serverUrl = (config.serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
    this.pat = config.pat;
    this.username = this.normalizeUsername(config.username);
  }

  private normalizeUsername(username: string | null | undefined): string | null {
    if (!username) return null;
    if (username.includes('\\')) return username;
    return `WINNING\\${username}`;
  }

  /**
   * 获取认证 Header
   */
  private getAuthHeaders(): Record<string, string> {
    // TFS 2018 使用 PAT (Basic Auth with empty username)
    const encodedPat = btoa(`:${this.pat}`);
    return {
      'Authorization': `Basic ${encodedPat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * 获取用于 PATCH 请求的身份验证头（json-patch 格式）
   */
  private getPatchAuthHeaders(): Record<string, string> {
    // TFS 2018 PATCH 请求必须使用 application/json-patch+json
    const encodedPat = btoa(`:${this.pat}`);
    return {
      'Authorization': `Basic ${encodedPat}`,
      'Content-Type': 'application/json-patch+json',
      'Accept': 'application/json'
    };
  }

  /**
   * 发起 API 请求（普通 GET/POST）
   */
  private async fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TFS API error: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * 格式化日期为TFS WIQL格式 (TFS 2018 需要日期格式 YYYY-MM-DD，不能包含时间部分)
   */
  private formatDateForWIQL(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取分配给自己的查询条件
   */
  private getAssignedToClause(): string {
    if (this.username) {
      return `[System.AssignedTo] = '${this.username}'`;
    }
    return `[System.AssignedTo] = @Me`;
  }

  /**
   * 按 ID 获取单个工作项
   */
  async getWorkItem(id: number, project?: string): Promise<WorkItem | null> {
    try {
      const url = `${this.serverUrl}/_apis/wit/workitems/${id}?api-version=4.1${project ? `&project=${encodeURIComponent(project)}` : ''}`;
      return await this.fetchApi<WorkItem>(url);
    } catch (error) {
      console.error('Error fetching work item:', error);
      return null;
    }
  }

  /**
   * 批量获取工作项
   */
  async getWorkItems(ids: number[], project?: string): Promise<WorkItem[]> {
    if (!ids.length) return [];
    
    try {
      const idsParam = ids.join(',');
      const url = `${this.serverUrl}/_apis/wit/workitems?ids=${idsParam}&api-version=4.1${project ? `&project=${encodeURIComponent(project)}` : ''}`;
      const result = await this.fetchApi<{ value: WorkItem[] }>(url);
      return result.value || [];
    } catch (error) {
      console.error('Error fetching work items:', error);
      return [];
    }
  }

  /**
   * 使用 WIQL 查询工作项
   */
  async queryWorkItems(wiql: string, project?: string): Promise<WorkItem[]> {
    try {
      const url = `${this.serverUrl}/_apis/wit/wiql?api-version=4.1${project ? `&project=${encodeURIComponent(project)}` : ''}`;
      const result = await this.fetchApi<{
        workItems: Array<{ id: number }>
      }>(url, {
        method: 'POST',
        body: JSON.stringify({ query: wiql })
      });

      if (!result.workItems || result.workItems.length === 0) {
        return [];
      }

      const ids = result.workItems.map(wi => wi.id);
      return await this.getWorkItems(ids, project);
    } catch (error) {
      console.error('Error querying work items:', error);
      throw error;
    }
  }

  /**
   * 查询分配给我的任务
   */
  async getMyTasks(project?: string): Promise<WorkItem[]> {
    let wiql = `
      SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo]
      FROM WorkItems
      WHERE [System.WorkItemType] = 'Task'
      AND [System.State] <> '已关闭'
      AND ${this.getAssignedToClause()}
    `;

    if (project) {
      wiql += ` AND [System.TeamProject] = '${project}'`;
    }

    wiql += ' ORDER BY [System.ChangedDate] DESC';

    return await this.queryWorkItems(wiql, project);
  }

  /**
   * 查询分配给我的工作项（完整字段）- 任务中心专用
   */
  async getMyWorkItems(options: QueryWorkItemsOptions = {}): Promise<FormattedWorkItem[]> {
    const {
      project = null,
      states = ['已分析'],
      workItemTypes = ['Task', 'Bug', 'User Story', '需求'],
      days = null,
      top = 100
    } = options;

    // 构建 WIQL 查询
    let wiql = `
      SELECT [System.Id], [System.Title], [System.State], 
             [System.AssignedTo], [System.WorkItemType], 
             [System.CreatedDate], [System.ChangedDate],
             [System.Description], [Microsoft.VSTS.Common.Priority],
             [System.Tags], [Microsoft.VSTS.Common.AcceptanceCriteria],
             [System.AreaPath], [System.IterationPath]
      FROM WorkItems
      WHERE ${this.getAssignedToClause()}
      AND [System.State] IN (${states.map(s => `'${s}'`).join(', ')})
      AND [System.WorkItemType] IN (${workItemTypes.map(t => `'${t}'`).join(', ')})
    `;

    // 添加项目过滤
    if (project) {
      wiql += ` AND [System.TeamProject] = '${project}'`;
    }

    // 添加日期过滤
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const dateStr = this.formatDateForWIQL(cutoffDate);
      wiql += ` AND [System.ChangedDate] >= '${dateStr}'`;
    }

    wiql += ' ORDER BY [Microsoft.VSTS.Common.Priority], [System.ChangedDate] DESC';

    const workItems = await this.queryWorkItems(wiql, project || undefined);
    return workItems.slice(0, top).map(wi => this.formatWorkItemForTaskCenter(wi));
  }

  /**
   * 查询未关闭的 Bug
   */
  async getOpenBugs(project?: string): Promise<WorkItem[]> {
    let wiql = `
      SELECT [System.Id], [System.Title], [System.State], [Microsoft.VSTS.Common.Severity]
      FROM WorkItems
      WHERE [System.WorkItemType] = 'Bug'
      AND [System.State] <> '已关闭'
    `;

    if (project) {
      wiql += ` AND [System.TeamProject] = '${project}'`;
    }

    wiql += ' ORDER BY [System.CreatedDate] DESC';

    return await this.queryWorkItems(wiql, project);
  }

  /**
   * 查询近期已解决/已关闭的工作项
   */
  async getRecentResolvedWorkItems(
    project?: string,
    days = 7,
    states = ['已解决', '已关闭']
  ): Promise<WorkItem[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = this.formatDateForWIQL(startDate);

    let wiql = `
      SELECT [System.Id], [System.Title], [System.WorkItemType],
             [System.State], [System.AssignedTo], [System.CreatedDate],
             [System.ChangedDate],
             [System.Description], [Microsoft.VSTS.Common.Priority],
             [Microsoft.VSTS.Common.Severity], [System.Reason]
      FROM WorkItems
      WHERE [System.State] IN (${states.map(s => `'${s}'`).join(', ')})
      AND [System.ChangedDate] >= '${startDateStr}'
    `;

    if (project) {
      wiql += ` AND [System.TeamProject] = '${project}'`;
    }

    wiql += ' ORDER BY [System.ChangedDate] DESC';

    return await this.queryWorkItems(wiql, project);
  }

  /**
   * 创建工作项
   */
  async createWorkItem(
    project: string,
    workItemType: string,
    fields: CreateWorkItemFields
  ): Promise<WorkItem> {
    const document: Array<{ op: string; path: string; value: unknown }> = [
      { op: 'add', path: '/fields/System.Title', value: fields.title },
      { op: 'add', path: '/fields/System.Description', value: fields.description || '' }
    ];

    if (fields.assignedTo) {
      document.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: fields.assignedTo
      });
    }

    if (fields.priority !== undefined) {
      document.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: String(fields.priority)
      });
    }

    if (fields.parentId) {
      document.push({
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${this.serverUrl}/_apis/wit/workItems/${fields.parentId}`
        }
      });
    }

    const url = `${this.serverUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/$${workItemType}?api-version=4.1`;
    return await this.fetchApi<WorkItem>(url, {
      method: 'PATCH',
      headers: this.getPatchAuthHeaders(),
      body: JSON.stringify(document)
    });
  }

  /**
   * 更新工作项状态
   */
  async updateWorkItemState(
    id: number,
    newState: string,
    comment?: string
  ): Promise<WorkItem> {
    const document: Array<{ op: string; path: string; value: unknown }> = [
      { op: 'replace', path: '/fields/System.State', value: newState }
    ];

    if (comment) {
      document.push({
        op: 'add',
        path: '/fields/System.History',
        value: comment
      });
    }

    const url = `${this.serverUrl}/_apis/wit/workitems/${id}?api-version=2.2`;
    const result = await this.fetchApi<WorkItem>(url, {
      method: 'PATCH',
      headers: this.getPatchAuthHeaders(),
      body: JSON.stringify(document)
    });
    return this.formatWorkItemForTaskCenter(result);
  }

  /**
   * 将工作项标记为进行中（活动）- 任务中心专用
   */
  async activateWorkItem(id: number, comment?: string): Promise<FormattedWorkItem> {
    const defaultComment = comment || '任务已开始处理 (via Task Center)';
    // TFS 2018 使用中文状态值
    await this.updateWorkItemState(id, '活动', defaultComment);
    // Reload the work item to get formatted result
    const workItem = await this.getWorkItemDetail(id);
    return workItem;
  }

  /**
   * 将工作项标记为已解决 - 任务中心专用
   */
  async resolveWorkItem(
    id: number,
    options: { comment?: string; prUrl?: string; prTitle?: string } = {}
  ): Promise<FormattedWorkItem> {
    const { comment = null } = options;
    const defaultComment = comment || '任务已完成，代码已提交 (via Task Center)';
    // TFS 2018 使用中文状态值
    await this.updateWorkItemState(id, '已解决', defaultComment || undefined);
    const workItem = await this.getWorkItemDetail(id);
    return workItem;
  }

  /**
   * 将工作项标记为已关闭 - 任务中心专用
   */
  async closeWorkItem(id: number, comment?: string): Promise<FormattedWorkItem> {
    const defaultComment = comment || '任务已验证通过并关闭 (via Task Center)';
    // TFS 2018 使用中文状态值
    await this.updateWorkItemState(id, '已关闭', defaultComment);
    const workItem = await this.getWorkItemDetail(id);
    return workItem;
  }

  /**
   * 添加评论
   */
  async addComment(workItemId: number, comment: string): Promise<WorkItem> {
    const document = [
      { op: 'add' as const, path: '/fields/System.History', value: comment }
    ];
    const url = `${this.serverUrl}/_apis/wit/workitems/${workItemId}?api-version=2.2`;
    return await this.fetchApi<WorkItem>(url, {
      method: 'PATCH',
      headers: this.getPatchAuthHeaders(),
      body: JSON.stringify(document)
    });
  }

  /**
   * 获取工作项的历史记录
   */
  async getWorkItemHistory(id: number): Promise<Array<{
    id: number;
    rev: number;
    revisedBy: string;
    revisedDate: string;
    fields: Record<string, unknown>;
  }>> {
    const url = `${this.serverUrl}/_apis/wit/workitems/${id}/updates?api-version=4.1`;
    const result = await this.fetchApi<{ value: Array<{
      id?: number;
      rev?: number;
      revisedBy?: { displayName?: string } | string;
      revisedDate?: string;
      fields?: Record<string, unknown>;
    }> }>(url);

    return (result.value || []).map(update => ({
      id: update.id || 0,
      rev: update.rev || 0,
      revisedBy: typeof update.revisedBy === 'object' 
        ? update.revisedBy?.displayName || 'Unknown'
        : 'Unknown',
      revisedDate: update.revisedDate || '',
      fields: update.fields || {}
    }));
  }

  /**
   * 获取工作项详情（完整信息）- 任务中心专用
   */
  async getWorkItemDetail(id: number, project?: string): Promise<FormattedWorkItem> {
    const workItem = await this.getWorkItem(id, project);
    if (!workItem) {
      throw new Error(`Work item ${id} not found`);
    }
    return this.formatWorkItemForTaskCenter(workItem, true);
  }

  /**
   * 批量获取工作项详情 - 任务中心专用
   */
  async getWorkItemsDetails(ids: number[], project?: string): Promise<FormattedWorkItem[]> {
    if (!ids.length) return [];
    const workItems = await this.getWorkItems(ids, project);
    return workItems.map(wi => this.formatWorkItemForTaskCenter(wi, true));
  }

  /**
   * 获取项目的 Git 仓库列表
   */
  async getRepositories(project: string): Promise<unknown[]> {
    const url = `${this.serverUrl}/${encodeURIComponent(project)}/_apis/git/repositories?api-version=4.1`;
    const result = await this.fetchApi<{ value: unknown[] }>(url);
    return result.value || [];
  }

  /**
   * 获取最近的提交记录
   */
  async getCommits(
    repositoryId: string,
    project: string,
    top = 20,
    days?: number
  ): Promise<GitCommitRef[]> {
    const url = `${this.serverUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${repositoryId}/commits?$top=${top}&api-version=4.1`;
    const result = await this.fetchApi<{ value: GitCommitRef[] }>(url);
    const commits = result.value || [];

    // 如果指定了天数，在客户端进行日期过滤
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return commits.filter(commit => {
        const commitDate = commit.author?.date 
          ? new Date(commit.author.date) 
          : commit.committer?.date 
            ? new Date(commit.committer.date)
            : null;
        return commitDate ? commitDate >= cutoffDate : true;
      });
    }

    return commits;
  }

  /**
   * 检查提交的工作项关联
   */
  async checkCommitWorkItems(
    repositoryId: string,
    projectId: string,
    commitId: string
  ): Promise<{
    commitId: string;
    hasWorkItems: boolean;
    workItemCount: number;
    workItems: Array<{ id: number; url: string }>;
  }> {
    const url = `${this.serverUrl}/${encodeURIComponent(projectId)}/_apis/git/repositories/${repositoryId}/commits/${commitId}?api-version=4.1`;
    const commit = await this.fetchApi<GitCommitRef>(url);

    const workItems = commit.workItems || [];
    return {
      commitId: commitId,
      hasWorkItems: workItems.length > 0,
      workItemCount: workItems.length,
      workItems: workItems.map(wi => ({
        id: wi.id || 0,
        url: wi.url || ''
      }))
    };
  }

  /**
   * 查询与代码提交关联的工作项
   */
  async getWorkItemsLinkedToCommits(
    repositoryId: string,
    project: string,
    days = 7
  ): Promise<{
    commits: Array<{ commitId: string; comment: string; workItems: number[] }>;
    workItems: FormattedWorkItem[];
  }> {
    // 获取最近的提交
    const commits = await this.getCommits(repositoryId, project, 100, days);

    // 收集所有关联的工作项 ID
    const workItemIds = new Set<number>();
    const commitWorkItemMap = new Map<string, { commitId: string; comment: string; workItems: number[] }>();

    for (const commit of commits) {
      const workItems = commit.workItems || [];
      if (workItems.length > 0) {
        commitWorkItemMap.set(String(commit.commitId), {
          commitId: (commit.commitId || '').slice(0, 8),
          comment: commit.comment || '',
          workItems: workItems.map(wi => wi.id).filter((id): id is number => id !== undefined)
        });

        workItems.forEach(wi => {
          if (wi.id !== undefined) {
            workItemIds.add(wi.id);
          }
        });
      }
    }

    // 获取工作项详情
    const workItemDetails: FormattedWorkItem[] = [];
    if (workItemIds.size > 0) {
      const ids = Array.from(workItemIds);
      const items = await this.getWorkItemsDetails(ids, project);
      workItemDetails.push(...items);
    }

    return {
      commits: Array.from(commitWorkItemMap.values()),
      workItems: workItemDetails
    };
  }

  /**
   * 获取项目的所有工作项（用于管理员）
   */
  async getAllProjectWorkItems(
    project: string,
    options: { states?: string[]; days?: number; top?: number } = {}
  ): Promise<FormattedWorkItem[]> {
    const {
      // TFS 2018 中文版使用中文状态值
      states = ['已建议', '活动', '已解决'],
      days = 30,
      top = 200
    } = options;

    let wiql = `
      SELECT [System.Id], [System.Title], [System.State], 
             [System.AssignedTo], [System.WorkItemType], 
             [System.CreatedDate], [System.ChangedDate],
             [System.Description], [Microsoft.VSTS.Common.Priority]
      FROM WorkItems
      WHERE [System.State] IN (${states.map(s => `'${s}'`).join(', ')})
      AND [System.TeamProject] = '${project}'
    `;

    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const dateStr = this.formatDateForWIQL(cutoffDate);
      wiql += ` AND [System.ChangedDate] >= '${dateStr}'`;
    }

    wiql += ' ORDER BY [System.ChangedDate] DESC';

    const workItems = await this.queryWorkItems(wiql, project);
    return workItems.slice(0, top).map(wi => this.formatWorkItemForTaskCenter(wi));
  }

  /**
   * 格式化工作项为任务控制中心标准格式
   */
  private formatWorkItemForTaskCenter(workItem: WorkItem, includeDetails = false): FormattedWorkItem {
    const fields = workItem.fields || {};

    const projectName = String(fields['System.TeamProject'] || '');
    const projectSegment = projectName ? `/${encodeURIComponent(projectName)}` : '';
    const browserUrl = `${this.serverUrl}${projectSegment}/_workitems?id=${workItem.id}`;

    const extractUserName = (userField: unknown): string => {
      if (!userField) return 'Unassigned';
      if (typeof userField === 'string') return userField;
      const user = userField as { displayName?: string; uniqueName?: string };
      return user.displayName || user.uniqueName || 'Unknown';
    };

    const parseTags = (tagsField: unknown): string[] => {
      if (!tagsField) return [];
      if (typeof tagsField === 'string') {
        return tagsField.split(';').map(t => t.trim()).filter(Boolean);
      }
      return [];
    };

    const formatted: FormattedWorkItem = {
      id: workItem.id || 0,
      title: String(fields['System.Title'] || 'No Title'),
      description: String(fields['System.Description'] || ''),
      state: String(fields['System.State'] || 'Unknown'),
      workItemType: String(fields['System.WorkItemType'] || 'Unknown'),
      assignedTo: extractUserName(fields['System.AssignedTo']),
      priority: parseInt(String(fields['Microsoft.VSTS.Common.Priority'])) || 0,
      project: projectName || 'Unknown',
      createdDate: String(fields['System.CreatedDate'] || ''),
      changedDate: String(fields['System.ChangedDate'] || ''),
      tags: parseTags(fields['System.Tags']),
      url: browserUrl
    };

    // 详细信息
    if (includeDetails) {
      formatted.acceptanceCriteria = String(fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '');
      formatted.areaPath = String(fields['System.AreaPath'] || '');
      formatted.iterationPath = String(fields['System.IterationPath'] || '');
      formatted.reason = String(fields['System.Reason'] || '');
      formatted.createdBy = extractUserName(fields['System.CreatedBy']);
      formatted.changedBy = extractUserName(fields['System.ChangedBy']);
    }

    return formatted;
  }

  // 静态项目相关方法
  static getProjectId(projectName: string): string | undefined {
    return PROJECTS[projectName];
  }

  static getProjects(): Record<string, string> {
    return { ...PROJECTS };
  }

  static hasProject(projectName: string): boolean {
    return projectName in PROJECTS;
  }
}

export default TFSClient;
