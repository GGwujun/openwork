/**
 * TFS Types - 任务中心 TFS 集成类型定义
 * 内嵌自 tfs2018-integration skill
 */

// TFS 工作项字段
export interface TFSWorkItemFields {
  'System.Id'?: number;
  'System.Title'?: string;
  'System.Description'?: string;
  'System.State'?: string;
  'System.WorkItemType'?: string;
  'System.AssignedTo'?: string | { displayName?: string; uniqueName?: string };
  'System.CreatedDate'?: string;
  'System.ChangedDate'?: string;
  'System.Tags'?: string;
  'System.TeamProject'?: string;
  'System.AreaPath'?: string;
  'System.IterationPath'?: string;
  'System.CreatedBy'?: string | { displayName?: string; };
  'System.ChangedBy'?: string | { displayName?: string; };
  'Microsoft.VSTS.Common.Priority'?: number | string;
  'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
  'System.Reason'?: string;
  'Winning.Demand.Analysis'?: string; // 需求分析字段
  [key: string]: unknown;
}

// TFS 工作项
export interface TFSWorkItem {
  id: number;
  fields?: TFSWorkItemFields;
  workItems?: Array<{ id: number; url: string }>;
}

// 任务中心格式化的工作项
export interface FormattedWorkItem {
  id: number;
  title: string;
  description: string;
  state: string;
  workItemType: string;
  assignedTo: string;
  priority: number;
  project: string;
  createdDate: string;
  changedDate: string;
  tags: string[];
  url: string;
  // 详细信息时包含
  acceptanceCriteria?: string;
  areaPath?: string;
  iterationPath?: string;
  reason?: string;
  createdBy?: string;
  changedBy?: string;
}

// 工作项历史记录
export interface WorkItemHistory {
  id: number;
  rev: number;
  revisedBy: string;
  revisedDate: string;
  fields: Record<string, unknown>;
}

// 提交关联信息
export interface CommitWorkItemLink {
  commitId: string;
  comment: string;
  workItems: number[];
}

export interface CommitsLinkedResult {
  commits: Array<{
    commitId: string;
    comment: string;
    workItems: number[];
  }>;
  workItems: FormattedWorkItem[];
}

// TFS 配置
export interface TFSConfig {
  serverUrl: string;
  pat: string;
  username?: string | null;
}

// 查询选项
export interface QueryWorkItemsOptions {
  project?: string | null;
  states?: string[];
  workItemTypes?: string[];
  days?: number | null;
  top?: number;
}

// 状态更新选项
export interface UpdateWorkItemStateOptions {
  comment?: string | null;
  prUrl?: string | null;
  prTitle?: string | null;
}

// 创建工作项字段
export interface CreateWorkItemFields {
  title: string;
  description?: string;
  assignedTo?: string;
  priority?: number;
  parentId?: number;
}

// 项目列表
export const PROJECTS: Record<string, string> = {
  'OA4.0': '4150312b-3a53-4da7-a8a7-e2bfe7fd970f',
  'win-cloud': 'b46e3a4d-0b96-4d7b-aa4a-216121a1ef73',
  'WiNEX-Copilot': 'a3f67cbb-d375-4a58-a6c8-da448150c495',
  '售前演示': 'ddbd09b1-59ea-420d-843d-2f70ef9aa8e8',
  'WiNEX-DCP': 'f4e79b7d-13e6-4e47-9a17-570d72d4f6ef',
  'W.in-DEMO': 'fa4a1591-32d3-4e3f-82c2-761005d119a2',
  'WiNEX-PatientInterests': '6a84d2a9-b5ce-44e5-bce0-171ad6cd96e1',
  'W.in-MVP': '8c3c22dc-6d35-49b5-8589-3375adb60a84',
  'WiNEX-MDM': 'aa8c3418-9ec5-4c9e-8209-e229aeda3cfa',
  'HUMANITY': '595b77d4-6f9a-46cf-9aeb-ea2afdef59d6',
  'WiNEX-Cloud': 'd4361d76-6ff9-4fc3-851c-536d9305c40c',
  'WiNEX-MiddlePlatform': '8ef8a81d-59bd-455e-a86c-2687ba9b6e03',
  'WiNEX-Inpatient-2': 'fa2bf9fc-fdc9-4167-ae72-feef8525e1f5',
  'WiNEX-Outpatient': 'e17bb6a1-2677-4695-8202-c3c296bbd05c',
  'WiNEX-General': '250f7599-5c8c-4e93-892c-71157224ae73',
  'WiNEX-Integration': '7c4d1061-6885-4c24-8096-1e1fc9795432',
  'MiddlePlatform': '5c6e7482-f12f-418d-8994-bc5aeaea75a8',
  'WiNEX-CaseHistory': '739645d0-5770-4efc-98d3-33c98e749837',
  'Public Query': 'bad35cc1-f0d6-4f80-8ba0-6f166b3ef6be',
  'WiNEX_WXP': '89f17307-4986-4251-a04f-e534f9a1b99d',
  'UED': '58e8e9b0-5975-48d2-af2d-2719222c7ff0',
  'WiNEX-Inpatient': '9e4a971d-4027-4c9a-b55b-f0b74487afb5',
  'WiNEX-Triage': 'af9ab1c7-72ef-42cf-91a3-ef771be43f5a',
  'WiNEX-Emergency': '5f498025-58dd-4ba0-8137-3fc962e1acaf',
  'WiNEX-Management': 'e92e726a-8dbe-4385-998f-58182a4ddb1c',
  'WiNEX-Taikang': 'af798a82-646e-467a-8f90-8f3b2c9c39a4',
  'WiNEX-BasicInfoService': '7dfa9b49-818c-4765-8aae-aec1304af4e9',
  'WiNEX-Specialized': '8f70e3be-75e3-4969-a3fb-93481dc2c589',
  'WINEX-ConfigManage': '18eb3c40-2667-435f-80df-51ce43b24935',
  'WiNEX-HospitalAdministration': '6dcd7f28-99b5-4f43-8877-82230e999906',
  'WiNEX-MY': '6cdb1969-bbbc-4ea2-818a-ae29389df42e'
};

// 默认服务器地址
export const DEFAULT_SERVER_URL = 'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0';
