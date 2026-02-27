import type { ParsedRequirement, DetectionResult } from "../../types/requirement-analyzer";
import { fsReadDir } from "./tauri";
import { fsCreateDir, fsReadFile, fsWriteFile } from "./fs-utils";
import { isTauriRuntime } from "../utils";

export type AnalysisCacheStatus = "pending" | "analyzing" | "completed" | "failed" | "expired";

export interface AnalysisCacheData {
  requirement?: ParsedRequirement;
  detection?: DetectionResult;
}

/**
 * Cached analysis entry persisted to disk.
 */
export interface CacheEntry {
  workItemId: number;
  timestamp: number;
  status: AnalysisCacheStatus;
  data: AnalysisCacheData;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export type AnalysisCacheDirectoryEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
};

export interface AnalysisCacheAdapter {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  readDir: (path: string) => Promise<AnalysisCacheDirectoryEntry[]>;
  createDir: (path: string) => Promise<void>;
  removeFile?: (path: string) => Promise<void>;
}

export interface AnalysisCacheConfig {
  workspaceRoot: string;
  adapter?: AnalysisCacheAdapter;
  now?: () => number;
}

const TRACKS_ROOT = "forge/tracks";
const CACHE_DIR = ".analysis";
const CACHE_FILE = "cache.json";

const getCacheDir = (workItemId: number) => `${TRACKS_ROOT}/tfs-${workItemId}/${CACHE_DIR}`;
const getCachePath = (workItemId: number) => `${getCacheDir(workItemId)}/${CACHE_FILE}`;

const parseWorkItemId = (value: string) => {
  if (!value.startsWith("tfs-")) return null;
  const id = Number(value.slice(4));
  return Number.isFinite(id) ? id : null;
};

const buildDefaultAdapter = (workspaceRoot: string): AnalysisCacheAdapter => ({
  readFile: async (path) => (await fsReadFile(path, workspaceRoot)).content,
  writeFile: (path, content) => fsWriteFile(path, content, workspaceRoot),
  readDir: async (path) => fsReadDir(path, workspaceRoot),
  createDir: (path) => fsCreateDir(path, workspaceRoot),
});

const normalizeTimestamp = (value: number | string): number => {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const serializeEntry = (entry: CacheEntry) => JSON.stringify(entry, null, 2);

const parseEntry = (raw: string): CacheEntry | null => {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.workItemId !== "number") return null;
    return parsed;
  } catch (error) {
    console.warn("[AnalysisCache] Failed to parse cache entry", error);
    return null;
  }
};

export const createMemoryCacheAdapter = (): AnalysisCacheAdapter => {
  const files = new Map<string, string>();

  const normalizePath = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/g, "") || "/";

  const writeFile = async (path: string, content: string) => {
    files.set(normalizePath(path), content);
  };

  const readFile = async (path: string) => {
    const normalized = normalizePath(path);
    const existing = files.get(normalized);
    if (existing === undefined) {
      throw new Error(`File not found: ${normalized}`);
    }
    return existing;
  };

  const readDir = async (path: string) => {
    const normalized = normalizePath(path);
    const prefix = normalized === "/" ? "" : `${normalized}/`;
    const entries = new Map<string, AnalysisCacheDirectoryEntry>();

    for (const filePath of files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const remainder = filePath.slice(prefix.length);
      const [segment] = remainder.split("/");
      if (!segment) continue;
      const isDir = remainder.includes("/");
      const entryPath = normalized === "/" ? `/${segment}` : `${normalized}/${segment}`;
      entries.set(segment, {
        name: segment,
        path: entryPath,
        type: isDir ? "directory" : "file",
      });
    }

    return Array.from(entries.values());
  };

  const createDir = async () => undefined;

  const removeFile = async (path: string) => {
    files.delete(normalizePath(path));
  };

  return {
    readFile,
    writeFile,
    readDir,
    createDir,
    removeFile,
  };
};

/**
 * Create a configurable analysis cache instance.
 */
export const createAnalysisCache = (initial?: Partial<AnalysisCacheConfig>) => {
  let workspaceRoot = initial?.workspaceRoot ?? "";
  let adapter = initial?.adapter ?? null;
  let now = initial?.now ?? (() => Date.now());

  const resolveAdapter = () => {
    if (adapter) return adapter;
    if (!workspaceRoot) {
      throw new Error("AnalysisCache workspaceRoot is not configured");
    }
    if (!isTauriRuntime()) {
      adapter = createMemoryCacheAdapter();
      return adapter;
    }
    return buildDefaultAdapter(workspaceRoot);
  };

  const listEntries = async () => {
    const activeAdapter = resolveAdapter();
    const entries = await activeAdapter.readDir(TRACKS_ROOT);
    const workItemIds = entries
      .filter((entry) => entry.type === "directory")
      .map((entry) => parseWorkItemId(entry.name))
      .filter((value): value is number => Number.isFinite(value));

    const results: CacheEntry[] = [];
    for (const id of workItemIds) {
      const entry = await cache.get(id);
      if (entry) results.push(entry);
    }

    return results;
  };

  const cache = {
    configure(next: Partial<AnalysisCacheConfig>) {
      if (next.workspaceRoot !== undefined) {
        workspaceRoot = next.workspaceRoot;
      }
      if (next.adapter !== undefined) {
        adapter = next.adapter;
      }
      if (next.now !== undefined) {
        now = next.now;
      }
    },

    async get(workItemId: number): Promise<CacheEntry | null> {
      const activeAdapter = resolveAdapter();
      const path = getCachePath(workItemId);

      try {
        const raw = await activeAdapter.readFile(path);
        return parseEntry(raw);
      } catch (error) {
        console.warn("[AnalysisCache] Cache miss", { workItemId, error });
        return null;
      }
    },

    async set(workItemId: number, data: AnalysisCacheData, options?: Partial<CacheEntry>): Promise<CacheEntry> {
      const activeAdapter = resolveAdapter();
      const entry: CacheEntry = {
        workItemId,
        timestamp: options?.timestamp ?? now(),
        status: options?.status ?? "completed",
        data,
        error: options?.error,
        startedAt: options?.startedAt,
        completedAt: options?.completedAt,
      };

      try {
        await activeAdapter.createDir(getCacheDir(workItemId));
        await activeAdapter.writeFile(getCachePath(workItemId), serializeEntry(entry));
      } catch (error) {
        console.warn("[AnalysisCache] Failed to persist cache entry", { workItemId, error });
      }
      return entry;
    },

    isExpired(timestamp: number | string, hours: number): boolean {
      const normalized = normalizeTimestamp(timestamp);
      if (!Number.isFinite(normalized)) return true;
      const ageMs = now() - normalized;
      return ageMs > hours * 60 * 60 * 1000;
    },

    async cleanExpired(maxAgeHours: number): Promise<CacheEntry[]> {
      const activeAdapter = resolveAdapter();
      const entries = await listEntries();
      const expired = entries.filter((entry) => cache.isExpired(entry.timestamp, maxAgeHours));

      for (const entry of expired) {
        if (activeAdapter.removeFile) {
          await activeAdapter.removeFile(getCachePath(entry.workItemId));
        } else {
          await activeAdapter.writeFile(
            getCachePath(entry.workItemId),
            serializeEntry({ ...entry, status: "expired" })
          );
        }
      }

      return expired;
    },

    async getPending(): Promise<CacheEntry[]> {
      const entries = await listEntries();
      const pending = entries.filter((entry) => entry.status !== "completed" && entry.status !== "expired");
      return pending.sort((a, b) => a.timestamp - b.timestamp);
    },
  };

  return cache;
};

/**
 * Shared analysis cache instance (configure before use).
 */
export const AnalysisCache = createAnalysisCache();
