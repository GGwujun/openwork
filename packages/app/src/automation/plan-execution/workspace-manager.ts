// packages/app/src/automation/plan-execution/workspace-manager.ts
/**
 * 工作空间管理器 - 处理 TFS 工作项的工作空间获取、创建和记录
 * 
 * 职责：
 * 1. 获取工作空间（从 workspaceMap 或重新匹配/创建）
 * 2. 自动创建工作空间（如果找不到）
 * 3. 记录映射关系（tfsId → workspace）
 * 4. 验证工作空间是否有效
 */

import type { RepositoryMatch } from '../../types/requirement-analyzer';
import type { WorkspaceInfo as TauriWorkspaceInfo } from '../../app/lib/tauri';

/**
 * 工作空间条目（从 task-center.ts 导入）
 */
export interface WorkspaceMapEntry {
  workspaceId: string;
  workspaceRoot?: string;
  repoUrlKey?: string;
  repoPathKey?: string;
  updatedAt: number;
}

/**
 * 工作空间信息
 */
export interface ResolvedWorkspace {
  workspaceId: string;
  workspaceRoot: string;
  isNewlyCreated: boolean;
  isActivated: boolean;
}

/**
 * 工作空间管理器选项
 */
export interface WorkspaceManagerOptions {
  // 工作区相关函数
  getWorkspaces: () => TauriWorkspaceInfo[];
  createWorkspaceForRepo: (input: {
    repoUrl?: string | null;
    folderPath?: string | null;
    preset?: "starter" | "automation" | "minimal";
  }) => Promise<TauriWorkspaceInfo | null>;
  activateWorkspace: (workspaceId: string) => Promise<boolean>;
  getActiveWorkspaceRoot: () => string;
  
  // 存储相关
  getWorkspaceMap: () => Record<number, WorkspaceMapEntry>;
  setWorkspaceMapEntry: (tfsId: number, entry: WorkspaceMapEntry) => void;
}

/**
 * 获取或创建工作空间
 * 
 * 流程：
 * 1. 检查 workspaceMap 是否有记录
 * 2. 有记录 → 验证是否有效 → 返回
 * 3. 无记录 → 尝试匹配现有工作区
 * 4. 匹配不到 → 自动创建
 * 5. 记录映射关系到 workspaceMap
 */
export async function getOrCreateWorkspace(
  tfsId: number,
  repos: RepositoryMatch[],
  options: WorkspaceManagerOptions
): Promise<{ success: boolean; workspace?: ResolvedWorkspace; error?: string }> {
  console.log(`[WorkspaceManager] 开始获取/创建工作空间:`, { tfsId, repoCount: repos.length });

  // Step 1: 检查 workspaceMap 是否有记录
  const workspaceMap = options.getWorkspaceMap();
  const existingEntry = workspaceMap[tfsId];

  if (existingEntry?.workspaceId) {
    console.log(`[WorkspaceManager] 找到已有记录:`, {
      workspaceId: existingEntry.workspaceId,
      workspaceRoot: existingEntry.workspaceRoot,
      updatedAt: new Date(existingEntry.updatedAt).toISOString()
    });

    // 验证工作空间是否仍然存在
    const allWorkspaces = options.getWorkspaces();
    const workspaceExists = allWorkspaces.some(ws => ws.id === existingEntry.workspaceId);

    if (workspaceExists && existingEntry.workspaceRoot) {
      console.log(`[WorkspaceManager] 工作空间有效，直接使用`);
      
      // 确保工作区已激活
      const currentRoot = options.getActiveWorkspaceRoot();
      const isAlreadyActive = currentRoot === existingEntry.workspaceRoot;
      
      if (!isAlreadyActive) {
        console.log(`[WorkspaceManager] 激活工作空间:`, existingEntry.workspaceId);
        const activated = await options.activateWorkspace(existingEntry.workspaceId);
        if (!activated) {
          console.warn(`[WorkspaceManager] 激活失败，尝试重新匹配`);
          // 继续执行匹配流程
        } else {
          // 更新记录时间
          options.setWorkspaceMapEntry(tfsId, {
            ...existingEntry,
            updatedAt: Date.now()
          });
          
          return {
            success: true,
            workspace: {
              workspaceId: existingEntry.workspaceId,
              workspaceRoot: existingEntry.workspaceRoot,
              isNewlyCreated: false,
              isActivated: true
            }
          };
        }
      } else {
        console.log(`[WorkspaceManager] 工作空间已经是当前活动状态`);
        return {
          success: true,
          workspace: {
            workspaceId: existingEntry.workspaceId,
            workspaceRoot: existingEntry.workspaceRoot,
            isNewlyCreated: false,
            isActivated: true
          }
        };
      }
    } else {
      console.warn(`[WorkspaceManager] 记录的工作空间已失效，清理记录:`, existingEntry.workspaceId);
      // 记录失效，继续创建流程
    }
  }

  // Step 2: 无记录或记录失效，尝试匹配现有工作区
  console.log(`[WorkspaceManager] 尝试匹配现有工作区`);
  
  const primaryRepo = repos.find(r => r.isPrimary) || repos[0];
  if (!primaryRepo) {
    return {
      success: false,
      error: "未识别到目标仓库，无法匹配工作区"
    };
  }

  const matchedWorkspace = await matchExistingWorkspace(primaryRepo, options);
  
  if (matchedWorkspace) {
    console.log(`[WorkspaceManager] 匹配到现有工作区:`, matchedWorkspace.id);
    
    // 激活工作区
    const activated = await options.activateWorkspace(matchedWorkspace.id);
    if (!activated) {
      return {
        success: false,
        error: "工作区匹配成功但激活失败"
      };
    }

    // 记录映射关系
    const workspaceRoot = resolveWorkspaceRoot(matchedWorkspace);
    const entry: WorkspaceMapEntry = {
      workspaceId: matchedWorkspace.id,
      workspaceRoot,
      repoUrlKey: normalizeGitRemote(primaryRepo.path),
      repoPathKey: normalizePathValue(primaryRepo.path).toLowerCase(),
      updatedAt: Date.now()
    };
    options.setWorkspaceMapEntry(tfsId, entry);
    console.log(`[WorkspaceManager] 已记录映射关系:`, { tfsId, workspaceId: matchedWorkspace.id });

    return {
      success: true,
      workspace: {
        workspaceId: matchedWorkspace.id,
        workspaceRoot,
        isNewlyCreated: false,
        isActivated: true
      }
    };
  }

  // Step 3: 匹配不到，自动创建工作区
  console.log(`[WorkspaceManager] 未匹配到工作区，开始自动创建:`, {
    repoName: primaryRepo.name,
    repoPath: primaryRepo.path
  });

  const createdWorkspace = await autoCreateWorkspace(primaryRepo, options);
  
  if (!createdWorkspace) {
    return {
      success: false,
      error: `无法为仓库 "${primaryRepo.name}" 创建工作区。请手动创建工作区后再试。`
    };
  }

  console.log(`[WorkspaceManager] 工作空间创建成功:`, {
    workspaceId: createdWorkspace.id,
    path: createdWorkspace.path
  });

  // 激活工作区
  const activated = await options.activateWorkspace(createdWorkspace.id);
  if (!activated) {
    return {
      success: false,
      error: "工作空间创建成功但激活失败"
    };
  }

  // 记录映射关系
  const workspaceRoot = resolveWorkspaceRoot(createdWorkspace);
  const entry: WorkspaceMapEntry = {
    workspaceId: createdWorkspace.id,
    workspaceRoot,
    repoUrlKey: normalizeGitRemote(primaryRepo.path),
    repoPathKey: normalizePathValue(primaryRepo.path).toLowerCase(),
    updatedAt: Date.now()
  };
  options.setWorkspaceMapEntry(tfsId, entry);
  console.log(`[WorkspaceManager] 已记录新映射关系:`, { tfsId, workspaceId: createdWorkspace.id });

  return {
    success: true,
    workspace: {
      workspaceId: createdWorkspace.id,
      workspaceRoot,
      isNewlyCreated: true,
      isActivated: true
    }
  };
}

/**
 * 匹配现有工作区
 */
async function matchExistingWorkspace(
  repo: RepositoryMatch,
  options: WorkspaceManagerOptions
): Promise<TauriWorkspaceInfo | null> {
  const allWorkspaces = options.getWorkspaces();
  const localWorkspaces = allWorkspaces.filter(ws => ws.workspaceType !== "remote");

  if (localWorkspaces.length === 0) {
    return null;
  }

  const repoUrlKey = normalizeGitRemote(repo.path);
  const repoPathKey = normalizePathValue(repo.path).toLowerCase();

  // 方法1: 通过 Git URL 匹配
  if (repoUrlKey) {
    for (const workspace of localWorkspaces) {
      const root = resolveWorkspaceRoot(workspace);
      const originUrl = await readWorkspaceOriginUrl(root);
      if (normalizeGitRemote(originUrl) === repoUrlKey) {
        return workspace;
      }
    }
  }

  // 方法2: 通过路径匹配
  for (const workspace of localWorkspaces) {
    const root = resolveWorkspaceRoot(workspace);
    const rootKey = normalizePathValue(root).toLowerCase();
    if (rootKey === repoPathKey) {
      return workspace;
    }
  }

  return null;
}

/**
 * 自动创建工作区
 */
async function autoCreateWorkspace(
  repo: RepositoryMatch,
  options: WorkspaceManagerOptions
): Promise<TauriWorkspaceInfo | null> {
  const isUrl = isGitUrl(repo.path);
  
  const input = {
    repoUrl: isUrl ? repo.path : null,
    folderPath: isUrl ? null : repo.path,
    preset: "starter" as const
  };

  console.log(`[WorkspaceManager] 调用 createWorkspaceForRepo:`, input);
  
  try {
    const created = await options.createWorkspaceForRepo(input);
    return created;
  } catch (error) {
    console.error(`[WorkspaceManager] 创建工作区失败:`, error);
    return null;
  }
}

/**
 * 读取工作区的 Git origin URL
 */
async function readWorkspaceOriginUrl(workspaceRoot: string): Promise<string | null> {
  try {
    // 这里需要调用 Tauri 命令读取 .git/config
    // 简化实现，实际应该在 lib/tauri.ts 中定义
    const { fsReadFile } = await import('../../app/lib/tauri');
    const result = await fsReadFile(".git/config", workspaceRoot);
    return parseGitOriginUrl(result.content);
  } catch {
    return null;
  }
}

/**
 * 解析 Git origin URL
 */
function parseGitOriginUrl(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  let inOrigin = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      inOrigin = /^remote\s+"origin"$/i.test(sectionMatch[1].trim());
      continue;
    }

    if (!inOrigin) continue;

    const urlMatch = trimmed.match(/^url\s*=\s*(.+)$/i);
    if (urlMatch) return urlMatch[1].trim();
  }

  return null;
}

/**
 * 解析工作区根路径
 */
function resolveWorkspaceRoot(workspace: TauriWorkspaceInfo): string {
  if (workspace.workspaceType === "remote") {
    return workspace.directory?.trim() ?? "";
  }
  return workspace.path?.trim() ?? "";
}

/**
 * 判断是否为 Git URL
 */
function isGitUrl(value: string): boolean {
  return /^(https?:\/\/|ssh:\/\/|git@)/i.test(value.trim());
}

/**
 * 归一化 Git remote URL
 */
function normalizeGitRemote(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  let hostPath = trimmed;
  const scpLike = trimmed.match(/^git@([^:]+):(.+)$/i);
  if (scpLike) {
    hostPath = `${scpLike[1]}/${scpLike[2]}`;
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      hostPath = `${parsed.host}${parsed.pathname}`;
    } catch {
      hostPath = trimmed;
    }
  }

  return hostPath
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

/**
 * 归一化路径值
 */
function normalizePathValue(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}

/**
 * 导出工具函数
 */
export {
  normalizeGitRemote,
  normalizePathValue,
  isGitUrl,
  resolveWorkspaceRoot
};
