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
import type {
  ResolvedWorkspace,
  WorkspaceManagerOptions,
  WorkspaceMapEntry,
} from './types';
export type { ResolvedWorkspace, WorkspaceManagerOptions, WorkspaceMapEntry } from './types';


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
    const matchedWorkspace = allWorkspaces.find(ws => ws.id === existingEntry.workspaceId) ?? null;

    if (matchedWorkspace) {
      const actualRoot = resolveWorkspaceRoot(matchedWorkspace);
      const entryRoot = existingEntry.workspaceRoot || actualRoot;
      const actualRootKey = normalizePathValue(actualRoot).toLowerCase();
      const entryRootKey = normalizePathValue(entryRoot).toLowerCase();

      if (actualRootKey && entryRootKey && actualRootKey === entryRootKey) {
        console.log(`[WorkspaceManager] 工作空间有效，直接使用`);

        const currentRoot = normalizePathValue(options.getActiveWorkspaceRoot()).toLowerCase();
        const isAlreadyActive = currentRoot && currentRoot === actualRootKey;

        if (!isAlreadyActive) {
          console.log(`[WorkspaceManager] 激活工作空间:`, existingEntry.workspaceId);
          const activated = await options.activateWorkspace(existingEntry.workspaceId);
          if (!activated) {
            console.warn(`[WorkspaceManager] 激活失败，尝试重新匹配`);
            // 继续执行匹配流程
          } else {
            options.setWorkspaceMapEntry(tfsId, {
              ...existingEntry,
              workspaceRoot: actualRoot,
              updatedAt: Date.now()
            });

            return {
              success: true,
              workspace: {
                workspaceId: existingEntry.workspaceId,
                workspaceRoot: actualRoot,
                isNewlyCreated: false,
                isActivated: true
              }
            };
          }
        } else {
          console.log(`[WorkspaceManager] 工作空间已经是当前活动状态`);
          options.setWorkspaceMapEntry(tfsId, {
            ...existingEntry,
            workspaceRoot: actualRoot,
            updatedAt: Date.now()
          });
          return {
            success: true,
            workspace: {
              workspaceId: existingEntry.workspaceId,
              workspaceRoot: actualRoot,
              isNewlyCreated: false,
              isActivated: true
            }
          };
        }
      } else {
        console.warn(`[WorkspaceManager] 记录的工作空间路径不一致，重新匹配`, {
          workspaceId: existingEntry.workspaceId,
          entryRoot,
          actualRoot
        });
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

  const matchResult = await matchExistingWorkspace(primaryRepo, options);
  
  if (matchResult.workspace) {
    console.log(`[WorkspaceManager] 匹配到现有工作区:`, matchResult.workspace.id);
    
    // 激活工作区
    const activated = await options.activateWorkspace(matchResult.workspace.id);
    if (!activated) {
      return {
        success: false,
        error: "工作区匹配成功但激活失败"
      };
    }

    // 记录映射关系
    const workspaceRoot = resolveWorkspaceRoot(matchResult.workspace);
    const entry: WorkspaceMapEntry = {
      workspaceId: matchResult.workspace.id,
      workspaceRoot,
      repoUrlKey: normalizeGitRemote(primaryRepo.path),
      repoPathKey: normalizePathValue(primaryRepo.path).toLowerCase(),
      updatedAt: Date.now()
    };
    options.setWorkspaceMapEntry(tfsId, entry);
    console.log(`[WorkspaceManager] 已记录映射关系:`, { tfsId, workspaceId: matchResult.workspace.id });

    return {
      success: true,
      workspace: {
        workspaceId: matchResult.workspace.id,
        workspaceRoot,
        isNewlyCreated: false,
        isActivated: true
      }
    };
  }

  if (matchResult.isAmbiguous) {
    return {
      success: false,
      error: matchResult.reason ?? "匹配到多个工作区，请手动选择"
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
type WorkspaceMatchResult = {
  workspace: TauriWorkspaceInfo | null;
  reason?: string;
  isAmbiguous?: boolean;
};

async function matchExistingWorkspace(
  repo: RepositoryMatch,
  options: WorkspaceManagerOptions
): Promise<WorkspaceMatchResult> {
  const allWorkspaces = options.getWorkspaces();
  const localWorkspaces = allWorkspaces.filter(ws => ws.workspaceType !== "remote");

  if (localWorkspaces.length === 0) {
    return { workspace: null };
  }

  const repoUrlKey = normalizeGitRemote(repo.path);
  const repoPathKey = normalizePathValue(repo.path).toLowerCase();

  // 方法1: 通过 Git URL 匹配
  if (repoUrlKey) {
    const reader = options.readWorkspaceOriginUrl ?? readWorkspaceOriginUrl;
    const urlMatches: TauriWorkspaceInfo[] = [];
    for (const workspace of localWorkspaces) {
      const root = resolveWorkspaceRoot(workspace);
      const originUrl = await reader(root);
      if (normalizeGitRemote(originUrl) === repoUrlKey) {
        urlMatches.push(workspace);
      }
    }
    if (urlMatches.length === 1) {
      return { workspace: urlMatches[0] };
    }
    if (urlMatches.length > 1) {
      return { workspace: null, reason: "匹配到多个工作区，请手动选择", isAmbiguous: true };
    }
  }

  // 方法2: 通过路径匹配
  const pathMatches = localWorkspaces.filter((workspace) => {
    const root = resolveWorkspaceRoot(workspace);
    const rootKey = normalizePathValue(root).toLowerCase();
    return rootKey === repoPathKey;
  });
  if (pathMatches.length === 1) {
    return { workspace: pathMatches[0] };
  }
  if (pathMatches.length > 1) {
    return { workspace: null, reason: "匹配到多个工作区，请手动选择", isAmbiguous: true };
  }

  return { workspace: null };
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
