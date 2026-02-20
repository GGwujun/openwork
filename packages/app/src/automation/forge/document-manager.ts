// automation/forge/document-manager.ts
// Forge文档管理器 - 管理开发跟踪文档

import { exists, mkdir, writeTextFile, readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

/**
 * Forge Track
 */
export interface ForgeTrack {
  id: string;
  path: string;
  intent: IntentDocument;
  design: DesignDocument;
  tasks: TasksDocument;
  verification?: VerificationDocument;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Intent文档
 */
export interface IntentDocument {
  why: string;
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
  successCriteria: string[];
  implementationApproach: string;
  risks: Array<{
    description: string;
    probability: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    mitigation: string;
  }>;
  timeEstimate: string;
}

/**
 * Design文档
 */
export interface DesignDocument {
  overview: string;
  architecture: {
    diagram?: string;
    components: string[];
    dependencies: string[];
  };
  interfaces: Array<{
    name: string;
    description: string;
    method: string;
    path: string;
    request: unknown;
    response: unknown;
    errors: unknown[];
  }>;
  dataModels: Array<{
    name: string;
    description: string;
    fields: unknown[];
  }>;
  implementation: Array<{
    title: string;
    description: string;
    considerations: string[];
  }>;
  risks: Array<{
    type: string;
    description: string;
    probability: string;
    impact: string;
    mitigation: string;
  }>;
  timeline: {
    phases: Array<{
      name: string;
      description: string;
      estimate: string;
      dependencies: string[];
    }>;
    totalEstimate: string;
    milestones: Array<{
      name: string;
      description: string;
      targetDate?: Date;
    }>;
  };
}

/**
 * Tasks文档
 */
export interface TasksDocument {
  phases: Array<{
    name: string;
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: 'pending' | 'in_progress' | 'completed';
      estimatedTime: string;
      actualTime?: string;
      dependencies: string[];
      assignee?: string;
    }>;
  }>;
}

/**
 * 验证文档
 */
export interface VerificationDocument {
  summary: string;
  checklist: Array<{
    item: string;
    status: 'passed' | 'failed' | 'pending';
    notes?: string;
  }>;
  testResults?: unknown;
  reviewedBy?: string;
  approved: boolean;
}

/**
 * Forge文档管理器
 */
export class ForgeDocumentManager {
  private basePath: string;

  constructor(basePath: string = 'forge/tracks') {
    this.basePath = basePath;
  }

  /**
   * 创建新的Track
   */
  async createTrack(workItemId: number, title: string): Promise<string> {
    const trackId = `tfs-${workItemId}`;
    const trackPath = `${this.basePath}/${trackId}`;
    
    // 创建目录结构
    await this.ensureDir(trackPath);
    
    // 创建contracts目录
    await this.ensureDir(`${trackPath}/contracts`);
    
    return trackPath;
  }

  /**
   * 保存Intent文档
   */
  async saveIntent(trackPath: string, intent: IntentDocument): Promise<void> {
    const content = this.renderIntentMarkdown(intent);
    await this.writeFile(`${trackPath}/intent.md`, content);
  }

  /**
   * 保存Design文档
   */
  async saveDesign(trackPath: string, design: DesignDocument): Promise<void> {
    const content = this.renderDesignMarkdown(design);
    await this.writeFile(`${trackPath}/design.md`, content);
  }

  /**
   * 保存Tasks文档
   */
  async saveTasks(trackPath: string, tasks: TasksDocument): Promise<void> {
    const content = this.renderTasksMarkdown(tasks);
    await this.writeFile(`${trackPath}/tasks.md`, content);
  }

  /**
   * 保存Verification文档
   */
  async saveVerification(
    trackPath: string, 
    verification: VerificationDocument
  ): Promise<void> {
    const content = this.renderVerificationMarkdown(verification);
    await this.writeFile(`${trackPath}/verification.md`, content);
  }

  /**
   * 保存合约文档
   */
  async saveContract(
    trackPath: string,
    component: string,
    contract: unknown
  ): Promise<void> {
    const content = this.renderContractMarkdown(contract);
    await this.writeFile(`${trackPath}/contracts/${component}.md`, content);
  }

  /**
   * 读取Track
   */
  async readTrack(trackId: string): Promise<ForgeTrack | null> {
    const trackPath = `${this.basePath}/${trackId}`;
    
    try {
      // 检查目录是否存在
      const trackExists = await exists(trackPath, { baseDir: BaseDirectory.AppLocalData });
      if (!trackExists) return null;

      // 读取各文档
      const intent = await this.readIntent(`${trackPath}/intent.md`);
      const design = await this.readDesign(`${trackPath}/design.md`);
      const tasks = await this.readTasks(`${trackPath}/tasks.md`);
      
      // 验证文档（可选）
      const verificationPath = `${trackPath}/verification.md`;
      const verificationExists = await exists(verificationPath, { baseDir: BaseDirectory.AppLocalData });
      const verification = verificationExists 
        ? await this.readVerification(verificationPath) 
        : undefined;

      return {
        id: trackId,
        path: trackPath,
        intent,
        design,
        tasks,
        verification,
        createdAt: new Date(), // 可以从git历史获取
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error(`读取Track ${trackId} 失败:`, error);
      return null;
    }
  }

  /**
   * 列出所有Tracks
   */
  async listTracks(): Promise<Array<{ id: string; path: string }>> {
    // 实现目录扫描
    return [];
  }

  /**
   * 删除Track
   */
  async deleteTrack(trackId: string): Promise<boolean> {
    // 实现删除逻辑
    return false;
  }

  /**
   * 渲染Intent Markdown
   */
  private renderIntentMarkdown(intent: IntentDocument): string {
    return `# Intent

## Why
${intent.why}

## Scope

### In Scope
${intent.scope.inScope.map(item => `- ${item}`).join('\n')}

### Out of Scope
${intent.scope.outOfScope.map(item => `- ${item}`).join('\n')}

## Success Criteria
${intent.successCriteria.map(criteria => `- [ ] ${criteria}`).join('\n')}

## Implementation Approach
${intent.implementationApproach}

## Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
${intent.risks.map(r => `| ${r.description} | ${r.probability} | ${r.impact} | ${r.mitigation} |`).join('\n')}

## Time Estimate
${intent.timeEstimate}
`;
  }

  /**
   * 渲染Design Markdown
   */
  private renderDesignMarkdown(design: DesignDocument): string {
    return `# Design

## Overview
${design.overview}

## Architecture
${design.architecture.components.map(c => `- ${c}`).join('\n')}

## Interfaces
${design.interfaces.map(i => `### ${i.name}
- **Method**: ${i.method}
- **Path**: ${i.path}
- **Description**: ${i.description}
`).join('\n')}

## Data Models
${design.dataModels.map(m => `### ${m.name}
${m.description}
`).join('\n')}

## Implementation Details
${design.implementation.map(impl => `### ${impl.title}
${impl.description}

Considerations:
${impl.considerations.map(c => `- ${c}`).join('\n')}
`).join('\n')}

## Risks
${design.risks.map(r => `- **${r.type}**: ${r.description}`).join('\n')}

## Timeline
${design.timeline.phases.map(p => `- **${p.name}**: ${p.estimate}`).join('\n')}

**Total Estimate**: ${design.timeline.totalEstimate}
`;
  }

  /**
   * 渲染Tasks Markdown
   */
  private renderTasksMarkdown(tasks: TasksDocument): string {
    return `# Tasks

${tasks.phases.map(phase => `## ${phase.name}

${phase.tasks.map(task => `### ${task.id}: ${task.title}
- **Status**: ${task.status}
- **Estimate**: ${task.estimatedTime}
${task.actualTime ? `- **Actual**: ${task.actualTime}` : ''}
- **Description**: ${task.description}
${task.dependencies.length > 0 ? `- **Dependencies**: ${task.dependencies.join(', ')}` : ''}
`).join('\n')}
`).join('\n')}
`;
  }

  /**
   * 渲染Verification Markdown
   */
  private renderVerificationMarkdown(verification: VerificationDocument): string {
    return `# Verification

## Summary
${verification.summary}

## Checklist
| Item | Status | Notes |
|------|--------|-------|
${verification.checklist.map(item => `| ${item.item} | ${item.status} | ${item.notes || ''} |`).join('\n')}

## Approval
${verification.approved ? '✅ Approved' : '❌ Not Approved'}
${verification.reviewedBy ? `\nReviewed by: ${verification.reviewedBy}` : ''}
`;
  }

  /**
   * 渲染Contract Markdown
   */
  private renderContractMarkdown(contract: unknown): string {
    return `# Contract

${JSON.stringify(contract, null, 2)}
`;
  }

  /**
   * 读取Intent文档
   */
  private async readIntent(path: string): Promise<IntentDocument> {
    const content = await this.readFile(path);
    // 简化解析，实际应该使用Markdown解析器
    return {
      why: '',
      scope: { inScope: [], outOfScope: [] },
      successCriteria: [],
      implementationApproach: '',
      risks: [],
      timeEstimate: '',
    };
  }

  /**
   * 读取Design文档
   */
  private async readDesign(path: string): Promise<DesignDocument> {
    const content = await this.readFile(path);
    return {
      overview: '',
      architecture: { components: [], dependencies: [] },
      interfaces: [],
      dataModels: [],
      implementation: [],
      risks: [],
      timeline: { phases: [], totalEstimate: '', milestones: [] },
    };
  }

  /**
   * 读取Tasks文档
   */
  private async readTasks(path: string): Promise<TasksDocument> {
    const content = await this.readFile(path);
    return { phases: [] };
  }

  /**
   * 读取Verification文档
   */
  private async readVerification(path: string): Promise<VerificationDocument> {
    const content = await this.readFile(path);
    return {
      summary: '',
      checklist: [],
      approved: false,
    };
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(path: string): Promise<void> {
      const dirExists = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (!dirExists) {
      await mkdir(path, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    }
  }

  /**
   * 写入文件
   */
  private async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content, { baseDir: BaseDirectory.AppLocalData });
  }

  /**
   * 读取文件
   */
  private async readFile(path: string): Promise<string> {
    return await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
  }
}

export default ForgeDocumentManager;
