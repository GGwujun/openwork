import type { TaskCenterPlanDocs } from "../../app/lib/task-center-artifacts";
import type { WorkspaceInfo as TauriWorkspaceInfo } from "../../app/lib/tauri";
import type { RepositoryMatch } from "../../types/requirement-analyzer";

export type ExecutionMessageRole = "user" | "assistant" | "system";
export type ExecutionMessageKind = "info" | "progress" | "question" | "error" | "complete" | "archive";

export interface ExecutionMessage {
  id?: string;
  role: ExecutionMessageRole;
  content: string;
  createdAt: number;
  kind?: ExecutionMessageKind;
  metadata?: Record<string, unknown>;
}

export interface ExecutionProgress {
  status: "idle" | "running" | "waiting" | "completed" | "failed" | "archived";
  percent?: number;
  message?: string;
  current?: number;
  total?: number;
  task?: string;
  updatedAt: number;
}

export interface ExecutionResult {
  success: boolean;
  status: ExecutionProgress["status"];
  message?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  totalTasks?: number;
  completedTasks?: number;
  durationMs?: number;
  archivePath?: string;
  verification?: { ok: boolean; summary?: string };
  commit?: { hash?: string; message?: string };
  files?: string[];
  messages?: ExecutionMessage[];
}

export interface ExecutionOptions {
  model?: { providerID: string; modelID: string } | null;
  includeForgeSkills?: boolean;
  requireVerification?: boolean;
  requireArchive?: boolean;
  allowQuestions?: boolean;
  maxRetries?: number;
}

export interface ExecutionContext {
  tfsId: number;
  title?: string;
  workspaceRoot: string;
  trackPath: string;
  planDocs: TaskCenterPlanDocs;
  selectedRepos?: RepositoryMatch[];
  workspace?: ResolvedWorkspace;
  options?: ExecutionOptions;
}

export interface WorkspaceMapEntry {
  workspaceId: string;
  workspaceRoot?: string;
  repoUrlKey?: string;
  repoPathKey?: string;
  updatedAt: number;
}

export interface ResolvedWorkspace {
  workspaceId: string;
  workspaceRoot: string;
  isNewlyCreated: boolean;
  isActivated: boolean;
}

export interface WorkspaceManagerOptions {
  getWorkspaces: () => TauriWorkspaceInfo[];
  createWorkspaceForRepo: (input: {
    repoUrl?: string | null;
    folderPath?: string | null;
    preset?: "starter" | "automation" | "minimal";
  }) => Promise<TauriWorkspaceInfo | null>;
  activateWorkspace: (workspaceId: string) => Promise<boolean>;
  getActiveWorkspaceRoot: () => string;
  readWorkspaceOriginUrl?: (workspaceRoot: string) => Promise<string | null>;
  getWorkspaceMap: () => Record<number, WorkspaceMapEntry>;
  setWorkspaceMapEntry: (tfsId: number, entry: WorkspaceMapEntry) => void;
}
