import { appLocalDataDir } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { createStore } from "solid-js/store";

import { Persist, persisted } from "../utils/persist";
import { isTauriRuntime, normalizeDirectoryPath, safeParseJson } from "../utils";
import type { RepositoryMatch } from "../../types/requirement-analyzer";
import type { AnalysisCacheAdapter, AnalysisCacheDirectoryEntry, CacheEntry } from "./analysis-cache";

export type PlanStatus = {
  version: number;
  tfsId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStep: "idle" | "analysis" | "repos" | "plan" | "completed";
  completedSteps: ("analysis" | "repos" | "plan")[];
  steps: {
    analysis?: { status: "pending" | "running" | "completed" | "failed"; output?: string; error?: string };
    repos?: { status: "pending" | "running" | "completed" | "failed"; output?: string; error?: string };
    plan?: { status: "pending" | "running" | "completed" | "failed"; output?: string[]; error?: string };
  };
};

export type TaskCenterPlanDocs = {
  intent?: string;
  design?: string;
  tasks?: string;
  generatedAt?: string;
};

export type TaskCenterArtifact = {
  version: 1;
  tfsId: number;
  updatedAt: string;
  analysisCache?: CacheEntry;
  selectedRepos?: RepositoryMatch[];
  planDocs?: TaskCenterPlanDocs;
  planStatus?: PlanStatus;
};

type TaskCenterArtifactPatch = {
  analysisCache?: CacheEntry | null;
  selectedRepos?: RepositoryMatch[] | null;
  planDocs?: TaskCenterPlanDocs | null;
  planStatus?: PlanStatus | null;
};

export type TaskCenterArtifactStore = {
  get: (tfsId: number) => Promise<TaskCenterArtifact | null>;
  list: () => Promise<TaskCenterArtifact[]>;
  update: (tfsId: number, patch: TaskCenterArtifactPatch) => Promise<TaskCenterArtifact>;
  remove: (tfsId: number) => Promise<void>;
  ready: () => boolean;
};

const STORAGE_KEY = "task-center.artifacts.v1";

const checksum = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const resolveScope = (workspaceRoot: string) => {
  const normalized = normalizeDirectoryPath(workspaceRoot);
  if (!normalized) return "default";
  return `ws-${checksum(normalized)}`;
};

const mergePlanDocs = (base: TaskCenterPlanDocs | undefined, patch: TaskCenterPlanDocs) => {
  if (!base) return { ...patch };
  return { ...base, ...patch };
};

const mergeArtifact = (
  base: TaskCenterArtifact | null,
  patch: TaskCenterArtifactPatch,
  tfsId: number,
): TaskCenterArtifact => {
  const now = new Date().toISOString();
  const analysisCache =
    patch.analysisCache === undefined
      ? base?.analysisCache
      : patch.analysisCache === null
        ? undefined
        : patch.analysisCache;
  const selectedRepos =
    patch.selectedRepos === undefined
      ? base?.selectedRepos
      : patch.selectedRepos === null
        ? undefined
        : patch.selectedRepos;
  const planDocs =
    patch.planDocs === undefined
      ? base?.planDocs
      : patch.planDocs === null
        ? undefined
        : mergePlanDocs(base?.planDocs, patch.planDocs);
  const planStatus =
    patch.planStatus === undefined
      ? base?.planStatus
      : patch.planStatus === null
        ? undefined
        : patch.planStatus;

  return {
    version: 1,
    tfsId,
    updatedAt: now,
    analysisCache,
    selectedRepos,
    planDocs,
    planStatus,
  };
};

const createTauriStore = (workspaceRoot: string): TaskCenterArtifactStore => {
  const scope = resolveScope(workspaceRoot);
  const basePath = `openwork/task-center/${scope}/artifacts`;
  const baseDir = BaseDirectory.AppLocalData;

  const ensureDir = async () => {
    const dirExists = await exists(basePath, { baseDir });
    if (!dirExists) {
      await mkdir(basePath, { baseDir, recursive: true });
    }
  };

  const artifactPath = (tfsId: number) => `${basePath}/tfs-${tfsId}.json`;

  const readArtifact = async (tfsId: number): Promise<TaskCenterArtifact | null> => {
    try {
      const content = await readTextFile(artifactPath(tfsId), { baseDir });
      const parsed = safeParseJson<TaskCenterArtifact>(content);
      if (!parsed || parsed.tfsId !== tfsId) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeArtifact = async (artifact: TaskCenterArtifact) => {
    await ensureDir();
    const content = JSON.stringify(artifact, null, 2);
    await writeTextFile(artifactPath(artifact.tfsId), content, { baseDir });
  };

  const list = async () => {
    try {
      const dirExists = await exists(basePath, { baseDir });
      if (!dirExists) return [];
      const entries = await readDir(basePath, { baseDir });
      const results: TaskCenterArtifact[] = [];
      for (const entry of entries) {
        const name = entry.name ?? "";
        const match = name.match(/^tfs-(\d+)\.json$/);
        if (!match) continue;
        const tfsId = Number(match[1]);
        if (!Number.isFinite(tfsId)) continue;
        const artifact = await readArtifact(tfsId);
        if (artifact) results.push(artifact);
      }
      return results;
    } catch {
      return [];
    }
  };

  return {
    get: (tfsId) => readArtifact(tfsId),
    list,
    update: async (tfsId, patch) => {
      const base = await readArtifact(tfsId);
      const next = mergeArtifact(base, patch, tfsId);
      await writeArtifact(next);
      return next;
    },
    remove: async (tfsId) => {
      try {
        await remove(artifactPath(tfsId), { baseDir });
      } catch {
        // ignore
      }
    },
    ready: () => true,
  };
};

const createWebStore = (workspaceRoot: string): TaskCenterArtifactStore => {
  const [artifacts, setArtifacts, , ready] = persisted(
    Persist.workspace(workspaceRoot || "default", STORAGE_KEY),
    createStore<Record<string, TaskCenterArtifact>>({}),
  );

  return {
    get: async (tfsId) => artifacts[String(tfsId)] ?? null,
    list: async () => Object.values(artifacts),
    update: async (tfsId, patch) => {
      const key = String(tfsId);
      const base = artifacts[key] ?? null;
      const next = mergeArtifact(base, patch, tfsId);
      setArtifacts(key, next);
      return next;
    },
    remove: async (tfsId) => {
      const key = String(tfsId);
      setArtifacts((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    },
    ready: () => ready(),
  };
};

const storeCache = new Map<string, TaskCenterArtifactStore>();
const loggedStorageScopes = new Set<string>();

const logStorageLocation = async (workspaceRoot: string, scope: string) => {
  if (loggedStorageScopes.has(scope)) return;
  loggedStorageScopes.add(scope);

  if (isTauriRuntime()) {
    const basePath = `openwork/task-center/${resolveScope(workspaceRoot)}/artifacts`;
    try {
      const root = await appLocalDataDir();
      const normalizedRoot = normalizeDirectoryPath(root).replace(/\\/g, "/").replace(/\/+$/g, "");
      const fullPath = normalizedRoot ? `${normalizedRoot}/${basePath}` : `AppLocalData/${basePath}`;
      console.log(`[TaskCenter] Artifact storage directory: ${fullPath}`);
    } catch {
      console.log(`[TaskCenter] Artifact storage directory: AppLocalData/${basePath}`);
    }
    return;
  }

  const target = Persist.workspace(workspaceRoot || "default", STORAGE_KEY);
  const storage = target.storage ?? "localStorage";
  console.log(`[TaskCenter] Artifact storage: ${storage} (key: ${target.key})`);
};

export function createTaskCenterArtifactStore(workspaceRoot: string): TaskCenterArtifactStore {
  const scope = isTauriRuntime()
    ? `tauri:${resolveScope(workspaceRoot)}`
    : `web:${workspaceRoot || "default"}`;
  const cached = storeCache.get(scope);
  if (cached) return cached;

  const store = isTauriRuntime()
    ? createTauriStore(workspaceRoot)
    : createWebStore(workspaceRoot);
  storeCache.set(scope, store);
  void logStorageLocation(workspaceRoot, scope);
  return store;
}

const parseWorkItemId = (path: string) => {
  const match = path.match(/tfs-(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
};

export function createAnalysisCacheAdapter(store: TaskCenterArtifactStore): AnalysisCacheAdapter {
  return {
    readFile: async (path: string) => {
      const id = parseWorkItemId(path);
      if (!id) throw new Error(`Invalid cache path: ${path}`);
      const artifact = await store.get(id);
      if (!artifact?.analysisCache) return "";
      return JSON.stringify(artifact.analysisCache, null, 2);
    },
    writeFile: async (path: string, content: string) => {
      const id = parseWorkItemId(path);
      if (!id) throw new Error(`Invalid cache path: ${path}`);
      const parsed = safeParseJson<CacheEntry>(content);
      if (!parsed) throw new Error(`Invalid cache content for ${path}`);
      await store.update(id, { analysisCache: parsed });
    },
    readDir: async (path: string): Promise<AnalysisCacheDirectoryEntry[]> => {
      const entries = await store.list();
      return entries
        .filter((entry) => !!entry.analysisCache)
        .map((entry) => ({
          name: `tfs-${entry.tfsId}`,
          path: `${path.replace(/\\/g, "/").replace(/\/+$/, "")}/tfs-${entry.tfsId}`,
          type: "directory" as const,
        }));
    },
    createDir: async () => undefined,
    removeFile: async (path: string) => {
      const id = parseWorkItemId(path);
      if (!id) return;
      await store.update(id, { analysisCache: null });
    },
  };
}

export function initPlanStatus(tfsId: number, title: string): PlanStatus {
  const now = new Date().toISOString();
  return {
    version: 1,
    tfsId,
    title,
    createdAt: now,
    updatedAt: now,
    currentStep: "idle",
    completedSteps: [],
    steps: {
      analysis: { status: "pending" },
      repos: { status: "pending" },
      plan: { status: "pending" },
    },
  };
}
