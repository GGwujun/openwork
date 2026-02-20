// automation/types/tfs.ts
// TFS 2018 API 类型定义 - 内嵌式核心

/**
 * TFS配置
 */
export interface TFSConfig {
  serverUrl: string;
  pat: string;
  username?: string;
}

/**
 * TFS工作项查询条件
 */
export interface TFSWorkItemQuery {
  id?: number;
  project?: string;
  states?: string[];
  assignedTo?: string;
  workItemTypes?: string[];
  top?: number;
  days?: number;
}

/**
 * TFS工作项字段定义
 */
export interface TFSWorkItemFields {
  'System.Id': number;
  'System.Title': string;
  'System.Description': string;
  'System.State': string;
  'System.WorkItemType': string;
  'System.AssignedTo': string;
  'System.AreaPath': string;
  'System.IterationPath'?: string;
  'System.Tags'?: string;
  'Microsoft.VSTS.Common.Priority'?: number;
  'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
  'Winning.Demand.Analysis'?: string;
}

/**
 * TFS API工作项响应
 */
export interface TFSWorkItemResponse {
  id: number;
  rev: number;
  fields: Partial<TFSWorkItemFields>;
  url: string;
}

/**
 * TFS WIQL查询结果
 */
export interface TFSWiqlQueryResult {
  workItems: Array<{ id: number; url: string }>;
}

/**
 * TFS状态流转定义
 */
export interface TFSStateTransition {
  from: string;
  to: string;
  comment?: string;
}

/**
 * TFS工作项历史记录
 */
export interface TFSWorkItemHistory {
  rev: number;
  revisedBy: string;
  revisedDate: string;
  fields: Partial<TFSWorkItemFields>;
  relations?: Array<{
    rel: string;
    url: string;
    attributes?: Record<string, unknown>;
  }>;
}

/**
 * TFS错误基类
 */
export class TFSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'TFSError';
  }
}

/**
 * TFS查询错误
 */
export class TFSQueryError extends TFSError {
  constructor(
    message: string,
    code: string = 'QUERY_ERROR',
    statusCode?: number
  ) {
    super(message, code, statusCode);
    this.name = 'TFSQueryError';
  }
}

/**
 * TFS认证错误
 */
export class TFSAuthError extends TFSError {
  constructor(message: string = 'TFS认证失败') {
    super(message, 'AUTH_ERROR');
    this.name = 'TFSAuthError';
  }
}

/**
 * TFS连接错误
 */
export class TFSConnectionError extends TFSError {
  constructor(message: string = '无法连接到TFS服务器') {
    super(message, 'CONNECTION_ERROR');
    this.name = 'TFSConnectionError';
  }
}

export default {};
