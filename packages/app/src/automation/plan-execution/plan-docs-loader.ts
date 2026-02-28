import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";

import {
  createTaskCenterArtifactStore,
  type TaskCenterArtifact,
  type TaskCenterArtifactStore,
  type TaskCenterPlanDocs,
} from "../../app/lib/task-center-artifacts";
import { isTauriRuntime, safeParseJson } from "../../app/utils";

import { getArtifactPath, getArtifactScope } from "./track-paths";

export type PlanDocsLoaderOptions = {
  workspaceRoot: string;
  getArtifactStore?: (workspaceRoot: string) => TaskCenterArtifactStore;
  isTauriRuntime?: () => boolean;
  readArtifactFile?: (path: string) => Promise<string>;
};

const normalizePlanDocs = (docs: TaskCenterPlanDocs | null | undefined) => {
  if (!docs) return null;
  const normalize = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };
  const normalized: TaskCenterPlanDocs = {
    intent: normalize(docs.intent),
    design: normalize(docs.design),
    tasks: normalize(docs.tasks),
    generatedAt: docs.generatedAt,
  };
  if (!normalized.intent && !normalized.design && !normalized.tasks) {
    return null;
  }
  return normalized;
};

export class PlanDocsLoader {
  private workspaceRoot: string;
  private getArtifactStore: (workspaceRoot: string) => TaskCenterArtifactStore;
  private isTauriRuntime: () => boolean;
  private readArtifactFile: (path: string) => Promise<string>;

  constructor(options: PlanDocsLoaderOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.getArtifactStore =
      options.getArtifactStore ?? createTaskCenterArtifactStore;
    this.isTauriRuntime = options.isTauriRuntime ?? isTauriRuntime;
    this.readArtifactFile =
      options.readArtifactFile ??
      ((path: string) => readTextFile(path, { baseDir: BaseDirectory.AppLocalData }));
  }

  async loadFromArtifactStore(tfsId: number): Promise<TaskCenterPlanDocs | null> {
    try {
      const store = this.getArtifactStore(this.workspaceRoot);
      if (!store.ready()) return null;
      const artifact = await store.get(tfsId);
      return normalizePlanDocs(artifact?.planDocs);
    } catch (error) {
      console.warn("[PlanDocsLoader] Failed to load from artifact store", error);
      return null;
    }
  }

  async loadFromFileSystem(tfsId: number): Promise<TaskCenterPlanDocs | null> {
    if (!this.isTauriRuntime()) return null;
    const scope = getArtifactScope(this.workspaceRoot);
    const artifactPath = getArtifactPath(scope, tfsId);

    try {
      const content = await this.readArtifactFile(artifactPath);
      const parsed = safeParseJson<TaskCenterArtifact>(content);
      return normalizePlanDocs(parsed?.planDocs);
    } catch (error) {
      console.warn("[PlanDocsLoader] Failed to load from file system", error);
      return null;
    }
  }

  async load(tfsId: number): Promise<TaskCenterPlanDocs | null> {
    const fromStore = await this.loadFromArtifactStore(tfsId);
    if (fromStore) return fromStore;
    return this.loadFromFileSystem(tfsId);
  }
}
