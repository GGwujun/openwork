// automation/tfs/client.ts
// TFS 2018 API客户端 - 内嵌式核心实现

import type {
  TFSConfig,
  TFSWorkItemQuery,
  TFSWorkItemResponse,
  TFSWiqlQueryResult,
} from '../types/tfs';
import { TFSQueryError, TFSAuthError, TFSConnectionError } from '../types/tfs';
import type { TFSWorkItem } from '../types/automation';

/**
 * TFS API客户端
 * 封装TFS 2018 REST API调用
 */
export class TFSClient {
  private config: TFSConfig;
  private baseUrl: string;
  private authHeader: string;

  constructor(config: TFSConfig) {
    this.config = config;
    this.baseUrl = `${config.serverUrl}/_apis/wit`;
    this.authHeader = `Basic ${btoa(`:${config.pat}`)}`;
  }

  /**
   * 获取单个工作项详情
   * @param id 工作项ID
   * @returns 工作项详情或null
   */
  async getWorkItem(id: number): Promise<TFSWorkItem | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/workitems/${id}?api-version=4.1&$expand=all`,
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401) {
        throw new TFSAuthError('PAT Token无效或已过期');
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new TFSQueryError(
          `TFS API错误: ${response.statusText}`,
          'API_ERROR',
          response.status
        );
      }

      const data: TFSWorkItemResponse = await response.json();
      return this.transformWorkItem(data);
    } catch (error) {
      if (error instanceof TFSAuthError || error instanceof TFSQueryError) {
        throw error;
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new TFSConnectionError('无法连接到TFS服务器，请检查网络');
      }
      
      console.error(`获取工作项 ${id} 失败:`, error);
      return null;
    }
  }

  /**
   * 批量获取工作项
   * @param ids 工作项ID数组
   * @returns 工作项列表
   */
  async getWorkItems(ids: number[]): Promise<TFSWorkItem[]> {
    if (ids.length === 0) return [];
    
    // TFS API限制：一次最多获取200个
    const batchSize = 200;
    const results: TFSWorkItem[] = [];
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchResults = await this.getWorkItemsBatch(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * 查询工作项列表
   * @param query 查询条件
   * @returns 工作项列表
   */
  async queryWorkItems(query: TFSWorkItemQuery): Promise<TFSWorkItem[]> {
    try {
      const wiql = this.buildWiqlQuery(query);
      
      const response = await fetch(
        `${this.baseUrl}/wiql?api-version=4.1`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: wiql }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new TFSQueryError(
          `WIQL查询失败: ${errorText}`,
          'WIQL_ERROR',
          response.status
        );
      }

      const result: TFSWiqlQueryResult = await response.json();
      const ids = result.workItems?.map((wi) => wi.id) || [];
      
      if (ids.length === 0) return [];
      
      // 批量获取详情
      return await this.getWorkItems(ids.slice(0, query.top || 50));
    } catch (error) {
      if (error instanceof TFSQueryError) {
        throw error;
      }
      console.error('查询工作项失败:', error);
      return [];
    }
  }

  /**
   * 获取分配给指定用户的工作项
   * @param project 项目名称
   * @param username 用户名（可选，默认当前用户）
   * @param states 状态列表（可选）
   * @returns 工作项列表
   */
  async getMyWorkItems(
    project: string,
    username?: string,
    states: string[] = ['New', 'Active']
  ): Promise<TFSWorkItem[]> {
    return this.queryWorkItems({
      project,
      assignedTo: username || '@me',
      states,
      workItemTypes: ['Task', 'Bug', 'User Story'],
      top: 50,
    });
  }

  /**
   * 获取最近更新过的工作项
   * @param project 项目名称
   * @param days 最近N天
   * @param states 状态列表
   * @returns 工作项列表
   */
  async getRecentWorkItems(
    project: string,
    days: number = 7,
    states?: string[]
  ): Promise<TFSWorkItem[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().split('T')[0];
    
    const wiql = `
      SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType]
      FROM workitems
      WHERE [System.TeamProject] = '${project}'
      ${states ? `AND (${states.map(s => `[System.State] = '${s}'`).join(' OR ')})` : ''}
      AND [System.ChangedDate] >= '${dateStr}'
      ORDER BY [System.ChangedDate] DESC
    `;
    
    return this.queryWorkItems({ project, top: 100 });
  }

  /**
   * 更新工作项状态
   * @param id 工作项ID
   * @param newState 新状态
   * @param comment 备注（可选）
   * @returns 是否成功
   */
  async updateWorkItemState(
    id: number,
    newState: string,
    comment?: string
  ): Promise<boolean> {
    try {
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

      const response = await fetch(
        `${this.baseUrl}/workitems/${id}?api-version=4.1`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json-patch+json',
          },
          body: JSON.stringify(document),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new TFSQueryError(
          `更新状态失败: ${errorText}`,
          'UPDATE_ERROR',
          response.status
        );
      }

      return true;
    } catch (error) {
      if (error instanceof TFSQueryError) {
        throw error;
      }
      console.error(`更新工作项 ${id} 状态失败:`, error);
      return false;
    }
  }

  /**
   * 添加工作项评论
   * @param id 工作项ID
   * @param comment 评论内容
   * @returns 是否成功
   */
  async addComment(id: number, comment: string): Promise<boolean> {
    return this.updateWorkItemState(id, '', comment);
  }

  /**
   * 关联PR到工作项
   * @param id 工作项ID
   * @param prUrl PR链接
   * @param prTitle PR标题
   * @returns 是否成功
   */
  async linkPullRequest(
    id: number,
    prUrl: string,
    prTitle?: string
  ): Promise<boolean> {
    const comment = `关联Pull Request: ${prTitle || ''}\n${prUrl}`;
    return this.addComment(id, comment);
  }

  /**
   * 获取工作项历史记录
   * @param id 工作项ID
   * @returns 历史记录列表
   */
  async getWorkItemHistory(id: number): Promise<unknown[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/workitems/${id}/revisions?api-version=4.1`,
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.error(`获取工作项 ${id} 历史失败:`, error);
      return [];
    }
  }

  /**
   * 批量获取工作项（内部方法）
   */
  private async getWorkItemsBatch(ids: number[]): Promise<TFSWorkItem[]> {
    if (ids.length === 0) return [];
    
    try {
      const response = await fetch(
        `${this.baseUrl}/workitems?ids=${ids.join(',')}&api-version=4.1&$expand=all`,
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new TFSQueryError(
          `批量获取失败: ${response.statusText}`,
          'BATCH_ERROR',
          response.status
        );
      }

      const data = await response.json();
      return (data.value || [])
        .map((item: TFSWorkItemResponse) => this.transformWorkItem(item))
        .filter(Boolean) as TFSWorkItem[];
    } catch (error) {
      console.error('批量获取工作项失败:', error);
      return [];
    }
  }

  /**
   * 构建WIQL查询语句
   */
  private buildWiqlQuery(query: TFSWorkItemQuery): string {
    const conditions: string[] = [];
    
    if (query.project) {
      conditions.push(`[System.TeamProject] = '${query.project}'`);
    }
    
    if (query.states && query.states.length > 0) {
      const stateConditions = query.states
        .map(s => `[System.State] = '${s}'`)
        .join(' OR ');
      conditions.push(`(${stateConditions})`);
    }
    
    if (query.assignedTo) {
      conditions.push(`[System.AssignedTo] = '${query.assignedTo}'`);
    }
    
    if (query.workItemTypes && query.workItemTypes.length > 0) {
      const typeConditions = query.workItemTypes
        .map(t => `[System.WorkItemType] = '${t}'`)
        .join(' OR ');
      conditions.push(`(${typeConditions})`);
    }

    if (query.days) {
      const date = new Date();
      date.setDate(date.getDate() - query.days);
      const dateStr = date.toISOString().split('T')[0];
      conditions.push(`[System.ChangedDate] >= '${dateStr}'`);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    return `
      SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType]
      FROM workitems
      ${whereClause}
      ORDER BY [System.ChangedDate] DESC
    `;
  }

  /**
   * 转换工作项格式
   */
  private transformWorkItem(data: TFSWorkItemResponse): TFSWorkItem | null {
    if (!data || !data.id) return null;
    
    const fields = data.fields || {};
    
    // 解析AssignedTo，提取用户名
    const assignedToRaw = fields['System.AssignedTo'] || '';
    const assignedTo = assignedToRaw.includes('<') 
      ? assignedToRaw.split('<')[0].trim()
      : assignedToRaw;
    
    return {
      id: data.id,
      title: fields['System.Title'] || '',
      description: this.cleanHtml(fields['System.Description'] || ''),
      acceptanceCriteria: this.cleanHtml(fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || ''),
      demandAnalysis: this.cleanHtml(fields['Winning.Demand.Analysis'] || ''),
      state: fields['System.State'] || '',
      type: fields['System.WorkItemType'] || '',
      priority: fields['Microsoft.VSTS.Common.Priority'] || 2,
      assignedTo,
      areaPath: fields['System.AreaPath'] || '',
      iterationPath: fields['System.IterationPath'],
      tags: fields['System.Tags']?.split(';').map((t: string) => t.trim()) || [],
      url: data.url,
    };
  }

  /**
   * 清理HTML标签
   */
  private cleanHtml(text: string): string {
    if (!text) return '';
    
    // 移除HTML标签
    let clean = text.replace(/\u003c[^\u003e]*\u003e/g, ' ');
    
    // 解码HTML实体
    clean = clean
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    // 规范化空白
    clean = clean.replace(/\s+/g, ' ').trim();
    
    return clean;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // 尝试查询一个简单的工作项
      const response = await fetch(
        `${this.baseUrl}/workitems/1?api-version=4.1`,
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401) {
        return {
          success: false,
          message: '认证失败：PAT Token无效或已过期'
        };
      }

      // 404表示认证成功但工作项不存在
      if (response.ok || response.status === 404) {
        return {
          success: true,
          message: '连接成功'
        };
      }

      return {
        success: false,
        message: `连接失败：${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        message: `连接失败：${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }
}

export default TFSClient;
