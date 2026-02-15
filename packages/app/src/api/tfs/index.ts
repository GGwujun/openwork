/**
 * TFS API - 任务中心 TFS 集成
 * 内嵌自 tfs2018-integration skill
 */

export { TFSClient } from './client';
export type {
  TFSConfig,
  TFSWorkItem,
  TFSWorkItemFields,
  FormattedWorkItem,
  WorkItemHistory,
  CreateWorkItemFields,
  QueryWorkItemsOptions,
  UpdateWorkItemStateOptions
} from './types';
export { DEFAULT_SERVER_URL, PROJECTS } from './types';

// 重新导出默认客户端
export { default } from './client';
