/**
 * TFS Client - TFS 2018 API 客户端 (Browser-compatible)
 * 使用原生 fetch API，兼容 Tauri WebView 环境
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  TFSConfig,
  FormattedWorkItem,
  CreateWorkItemFields,
  QueryWorkItemsOptions
} from './types';
import { DEFAULT_SERVER_URL, PROJECTS } from './types';
import { isTauriRuntime } from "../../app/utils";

// 定义最小化的 WorkItem 类型
interface WorkItem {
  id?: number;
  fields?: Record<string, unknown>;
  workItems?: Array<{ id?: number; url?: string }>;
  relations?: Array<{ rel?: string; url?: string; attributes?: Record<string, unknown> }>;
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
  private workItemTypesCache = new Map<string, Array<{ name: string; referenceName?: string }>>();

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
    console.log('[TFSClient] [DEBUG] fetchApi:', options.method || 'GET', url);
    const fetchImpl = isTauriRuntime() ? tauriFetch : fetch;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers
        }
      });
      console.log('[TFSClient] [DEBUG] Response status:', response.status, response.statusText);
    } catch (error) {
      console.error('[TFSClient] [DEBUG] Network error:', error);
      if (!isTauriRuntime() && error instanceof TypeError) {
        throw new Error("浏览器请求被 CORS 拦截，请使用桌面版或配置反向代理");
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TFSClient] [DEBUG] API error:', response.status, errorText);
      throw new Error(`TFS API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as T;
    console.log('[TFSClient] [DEBUG] Response data:', JSON.stringify(data).substring(0, 200) + '...');
    return data;
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

  private escapeWiqlString(value: string): string {
    // WIQL 字符串中单引号需要转义为两个单引号
    return value.replace(/'/g, "''");
  }

  /**
   * 获取分配给自己的查询条件
   */
  private getAssignedToClause(): string {
    if (this.username) {
      const safeUsername = this.escapeWiqlString(this.username);
      return `([System.AssignedTo] = @Me OR [System.AssignedTo] = '${safeUsername}')`;
    }
    return `[System.AssignedTo] = @Me`;
  }

  private async getWorkItemTypes(project: string): Promise<Array<{ name: string; referenceName?: string }>> {
    const cached = this.workItemTypesCache.get(project);
    if (cached) return cached;
    const url = `${this.serverUrl}/${encodeURIComponent(project)}/_apis/wit/workitemtypes?api-version=4.1`;
    const result = await this.fetchApi<{ value?: Array<{ name: string; referenceName?: string }> }>(url);
    const types = result.value ?? [];
    this.workItemTypesCache.set(project, types);
    return types;
  }

  private async resolveTaskWorkItemTypes(project: string): Promise<string[]> {
    try {
      const types = await this.getWorkItemTypes(project);
      if (!types.length) return ["Task", "任务"];

      const names = types
        .map((type) => type.name)
        .filter((name) => typeof name === "string" && name.trim().length > 0);

      const preferred: string[] = [];
      const lowerNames = new Map(names.map((name) => [name.toLowerCase(), name]));
      if (lowerNames.has("task")) preferred.push(lowerNames.get("task") as string);
      if (lowerNames.has("任务")) preferred.push(lowerNames.get("任务") as string);

      const refMatch = types.find((type) =>
        typeof type.referenceName === "string" && /\bTask$/i.test(type.referenceName)
      );
      if (refMatch?.name && !preferred.includes(refMatch.name)) {
        preferred.push(refMatch.name);
      }

      for (const name of names) {
        if (!preferred.includes(name)) preferred.push(name);
      }

      return preferred.length ? preferred : ["Task", "任务"];
    } catch (error) {
      console.warn("[TFS Client] Failed to resolve work item types", error);
      return ["Task", "任务"];
    }
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
      console.log('[TFSClient] [DEBUG] queryWorkItems called with WIQL:', wiql.substring(0, 200) + '...');
      const url = `${this.serverUrl}/_apis/wit/wiql?api-version=4.1${project ? `&project=${encodeURIComponent(project)}` : ''}`;
      console.log('[TFSClient] [DEBUG] Query URL:', url);
      
      const result = await this.fetchApi<{
        workItems: Array<{ id: number }>
      }>(url, {
        method: 'POST',
        body: JSON.stringify({ query: wiql })
      });

      console.log('[TFSClient] [DEBUG] WIQL query returned workItems count:', result.workItems?.length || 0);

      if (!result.workItems || result.workItems.length === 0) {
        return [];
      }

      const ids = result.workItems.map(wi => wi.id);
      console.log('[TFSClient] [DEBUG] Fetching details for IDs:', ids.slice(0, 10), ids.length > 10 ? `... and ${ids.length - 10} more` : '');
      return await this.getWorkItems(ids, project);
    } catch (error) {
      console.error('[TFSClient] [DEBUG] Error querying work items:', error);
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

    // 安全检查：确保数组不为空
    const safeStates = states.length > 0 ? states : ['已分析'];
    const safeWorkItemTypes = workItemTypes.length > 0 ? workItemTypes : ['Task'];

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
      AND [System.State] IN (${safeStates.map(s => `'${this.escapeWiqlString(s)}'`).join(', ')})
      AND [System.WorkItemType] IN (${safeWorkItemTypes.map(t => `'${this.escapeWiqlString(t)}'`).join(', ')})
    `;

    // 添加项目过滤
    if (project) {
      wiql += ` AND [System.TeamProject] = '${this.escapeWiqlString(project)}'`;
    }

    // 添加日期过滤
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const dateStr = this.formatDateForWIQL(cutoffDate);
      wiql += ` AND [System.ChangedDate] >= '${dateStr}'`;
    }

    wiql += ' ORDER BY [Microsoft.VSTS.Common.Priority], [System.ChangedDate] DESC';

    // 输出完整 WIQL 用于调试
    console.log('[TFSClient] [DEBUG] Full WIQL query:\n', wiql);
    console.log('[TFSClient] [DEBUG] WorkItemTypes:', safeWorkItemTypes);
    console.log('[TFSClient] [DEBUG] States:', safeStates);
    console.log('[TFSClient] [DEBUG] AssignedToClause:', this.getAssignedToClause());

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

    if (fields.tags) {
      document.push({
        op: 'add',
        path: '/fields/System.Tags',
        value: fields.tags
      });
    }

    if (fields.startDate) {
      document.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.StartDate',
        value: fields.startDate
      });
    }

    if (fields.finishDate) {
      document.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.FinishDate',
        value: fields.finishDate
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

    const url = `${this.serverUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=4.1`;
    return await this.fetchApi<WorkItem>(url, {
      method: 'POST',
      headers: this.getPatchAuthHeaders(),
      body: JSON.stringify(document)
    });
  }

  /**
   * 在父任务上添加子级关系链接
   */
  async addChildLink(parentId: number, childId: number, comment?: string): Promise<WorkItem> {
    const value: { rel: string; url: string; attributes?: Record<string, unknown> } = {
      rel: 'System.LinkTypes.Hierarchy-Forward',
      url: `${this.serverUrl}/_apis/wit/workItems/${childId}`
    };
    if (comment) {
      value.attributes = { comment };
    }

    const document: Array<{ op: string; path: string; value: unknown }> = [
      {
        op: 'add',
        path: '/relations/-',
        value
      }
    ];

    const url = `${this.serverUrl}/_apis/wit/workitems/${parentId}?api-version=4.1`;
    return await this.fetchApi<WorkItem>(url, {
      method: 'PATCH',
      headers: this.getPatchAuthHeaders(),
      body: JSON.stringify(document)
    });
  }

  /**
   * 创建子任务（自动关联父任务）
   * @param project 项目名称
   * @param fields 任务字段
   * @param parentId 父任务ID
   * @param tags 标签（可选）
   */
  async createChildTask(
    project: string,
    fields: CreateWorkItemFields,
    parentId: number,
    tags?: string
  ): Promise<WorkItem> {
    console.log('[TFS Client] createChildTask called:', { project, parentId, tags, title: fields.title });

    const nowIso = new Date().toISOString();
    const createFields: CreateWorkItemFields = {
      ...fields,
      tags: tags || fields.tags,
      startDate: fields.startDate ?? nowIso,
      finishDate: fields.finishDate ?? nowIso
    };

    const workItemTypes = await this.resolveTaskWorkItemTypes(project);
    let created: WorkItem | null = null;
    let lastError: unknown;

    for (const type of workItemTypes) {
      try {
        console.log('[TFS Client] Creating task work item type:', type);
        created = await this.createWorkItem(project, type, createFields);
        break;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[TFS Client] Create work item failed for type:', type, message);
      }
    }

    if (!created?.id) {
      console.error('[TFS Client] Failed to create task work item');
      throw lastError || new Error('Failed to create task work item');
    }

    console.log('[TFS Client] Task created:', created.id, 'linking to parent...');
    await this.addChildLink(parentId, created.id, '添加子任务');
    console.log('[TFS Client] Child link added to parent:', parentId);
    return created;
  }


  /**
   * 获取子任务列表
   * @param parentId 父任务ID
   * @param project 项目名称（可选）
   * @param includeTags 标签过滤（可选）
   */
  async getChildTasks(
    parentId: number,
    project?: string,
    includeTags?: string[]
  ): Promise<WorkItem[]> {
    const url = `${this.serverUrl}/_apis/wit/workitems/${parentId}?api-version=4.1${project ? `&project=${encodeURIComponent(project)}` : ''}&$expand=relations`;
    const result = await this.fetchApi<WorkItem>(url);

    const ids = (result.relations || [])
      .filter(rel => rel?.rel === 'System.LinkTypes.Hierarchy-Forward')
      .map(rel => {
        const match = rel?.url?.match(/workItems\/(\d+)/i);
        return match ? Number(match[1]) : null;
      })
      .filter((id): id is number => typeof id === 'number');

    let items = await this.getWorkItems(ids, project);

    if (includeTags && includeTags.length > 0) {
      items = items.filter(item => {
        const tags = String(item.fields?.['System.Tags'] || '');
        return includeTags.some(tag => tags.includes(tag));
      });
    }

    // 仅保留任务类型（中英文兼容）
    items = items.filter(item => {
      const type = String(item.fields?.['System.WorkItemType'] || '');
      return type === 'Task' || type === '任务';
    });

    return items;
  }

  /**
   * 检查是否已存在特定标签的子任务
   * @param parentId 父任务ID
   * @param tag 标签
   * @param project 项目名称（可选）
   */
  async hasChildTaskWithTag(
    parentId: number,
    tag: string,
    project?: string
  ): Promise<{ exists: boolean; taskId?: number; task?: WorkItem }> {
    const children = await this.getChildTasks(parentId, project, [tag]);
    
    if (children.length > 0) {
      return {
        exists: true,
        taskId: children[0].id,
        task: children[0]
      };
    }
    
    return { exists: false };
  }

  /**
   * 更新任务描述
   * @param id 任务ID
   * @param description 新描述
   * @param append 是否追加模式（默认false）
   */
  async updateTaskDescription(
    id: number,
    description: string,
    append = false
  ): Promise<WorkItem> {
    const document: Array<{ op: string; path: string; value: unknown }> = [];

    if (append) {
      // 追加模式：先获取现有描述
      const existing = await this.getWorkItem(id);
      const existingDesc = String(existing?.fields?.['System.Description'] || '');
      document.push({
        op: 'replace',
        path: '/fields/System.Description',
        value: existingDesc + '\n\n---\n\n' + description
      });
    } else {
      document.push({
        op: 'replace',
        path: '/fields/System.Description',
        value: description
      });
    }

    const url = `${this.serverUrl}/_apis/wit/workitems/${id}?api-version=4.1`;
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
