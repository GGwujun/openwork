import { createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";

import type { Client, TaskCenterItem, TaskCenterStatus, TaskCenterStage, TaskCenterAutomationState } from "../types";
import type { TFSConfig, FormattedWorkItem } from "../../api/tfs";
import { TFSClient, DEFAULT_SERVER_URL } from "../../api/tfs";
import { Persist, persisted } from "../utils/persist";
import { unwrap } from "../lib/opencode";
import { parseTasks, updateTaskStatus, type ParsedTask } from "../lib/tasks-parser";

import { 
  TFS_CONFIG_PATH, 
  DEFAULT_TFS_CONFIG, 
  validateTfsConfig, 
  createTfsConfig 
} from "../config/tfs";

// Use Record instead of Map for JSON serialization compatibility
export type AutomationStateMap = Record<number, TaskCenterAutomationState>;

// Helper to safely get value from Record
export function getAutomationState(record: AutomationStateMap, tfsId: number): TaskCenterAutomationState | undefined {
  return record[tfsId];
}

// Merge automation state with TFS items
// Merge TFS items with automation state - preserves automation items not in TFS query
export function mergeTfsItemsWithAutomation(
  tfsItems: TaskCenterItem[],
  automation: AutomationStateMap
): TaskCenterItem[] {
  const result: TaskCenterItem[] = [];
  const processedTfsIds = new Set<number>();

  // First, process all TFS items and merge with automation
  for (const item of tfsItems) {
    const autoState = getAutomationState(automation, item.tfsId);
    if (autoState) {
      // Merge automation state into TFS item
      result.push({
        ...item,
        status: autoState.status,
        stage: autoState.stage,
      });
    } else {
      // No automation state, use TFS item as-is
      result.push(item);
    }
    processedTfsIds.add(item.tfsId);
  }

  // Then, add automation items that are not in TFS query result
  for (const [key, autoState] of Object.entries(automation)) {
    const tfsId = Number(key);
    if (!Number.isNaN(tfsId) && !processedTfsIds.has(tfsId) && autoState) {
      // Create a TaskCenterItem from automation state
      result.push({
        id: `tfs-${tfsId}`,
        tfsId,
        title: `Work Item #${tfsId}`, // Placeholder, should be loaded from storage
        status: autoState.status,
        stage: autoState.stage,
        updatedAt: autoState.updatedAt,
      });
    }
  }

  return result;
}

export function mergeAutomationState(
  tfsItems: Array<{ tfsId: number; status: TaskCenterStatus }>,
  automation: AutomationStateMap
): AutomationStateMap {
  const result: AutomationStateMap = {};

  for (const item of tfsItems) {
    const existing = getAutomationState(automation, item.tfsId);

    if (existing) {
      // Check if TFS is in a final state (done/archived) - use TFS state
      const isTfsFinal = item.status === "done" || item.status === "archived";

      result[item.tfsId] = {
        ...existing,
        status: isTfsFinal ? item.status : existing.status,
        updatedAt: Date.now()
      };
    } else {
      // No automation state: create from TFS item
      result[item.tfsId] = {
        status: item.status,
        stage: "idle" as TaskCenterStage,
        updatedAt: Date.now()
      };
    }
  }

  return result;
}

export type TaskCenterStore = ReturnType<typeof createTaskCenterStore>;

type SyncStatus = "idle" | "syncing" | "error";

type TaskCenterUiState = {
  search: string;
};

function mapStateToStatus(state?: string | null): TaskCenterStatus {
  const normalized = (state ?? "").trim();
  if (normalized === "活动") return "progress";
  if (normalized === "已解决") return "done";
  if (normalized === "已关闭") return "archived";
  // Only "已分析" should map to "todo"
  if (normalized === "已分析") return "todo";
  // Other states like "已建议" should not appear in Task Center
  // (they will be filtered out by TFS query)
  return "todo";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readErrorMessage = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.message === "string") return value.message;
  return null;
};

const extractOutputFromParts = (parts: unknown): string | null => {
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (!isRecord(part)) continue;
    if (part.type === "tool") {
      const state = isRecord(part.state) ? part.state : null;
      if (state) {
        if (state.status === "error") {
          const message = readErrorMessage(state.error);
          if (message) throw new Error(message);
        }
        if (typeof state.output === "string") return state.output;
        const metadata = isRecord(state.metadata) ? state.metadata : null;
        if (metadata && typeof metadata.output === "string") return metadata.output;
      }
    }
    if (part.type === "text" && typeof part.text === "string") return part.text;
  }
  return null;
};

function extractOutput(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  if (!isRecord(result)) return null;
  const errorMessage = readErrorMessage(result.error);
  if (errorMessage) throw new Error(errorMessage || "Unknown error");

  const partsOutput = extractOutputFromParts(result.parts);
  if (partsOutput) return partsOutput;

  if (typeof result.output === "string") return result.output;
  if (typeof result.stdout === "string") return result.stdout;
  if (typeof result.data === "string") return result.data;

  if (isRecord(result.data)) {
    const dataError = readErrorMessage(result.data.error);
    if (dataError) throw new Error(dataError || "Unknown error");
    const dataParts = extractOutputFromParts(result.data.parts);
    if (dataParts) return dataParts;
    if (typeof result.data.output === "string") return result.data.output;
    if (typeof result.data.stdout === "string") return result.data.stdout;
  }
  return null;
}

/**
 * 将格式化的工作项转换为 TaskCenterItem
 */
function formatToTaskCenterItem(item: FormattedWorkItem): TaskCenterItem {
  const changedDate = item.changedDate;
  const updatedAt = changedDate ? Date.parse(changedDate) : null;
  return {
    id: `tfs-${item.id}`,
    tfsId: item.id,
    title: item.title,
    description: item.description,
    project: item.project,
    workItemType: item.workItemType,
    priority: item.priority,
    assignedTo: item.assignedTo,
    tags: item.tags,
    state: item.state,
    url: item.url,
    status: mapStateToStatus(item.state),
    stage: "idle",
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
  };
}

export function createTaskCenterStore(options: {
  client: () => Client | null;
  activeWorkspaceRoot: () => string;
  createSessionAndOpen: () => void;
  setPrompt: (value: string) => void;
  tfsConfig?: () => TFSConfig | null;
  createSessionAndOpenWithDirectory?: (directory: string) => void;
}) {
  const [items, setItems] = createSignal<TaskCenterItem[]>([]);
  const [status, setStatus] = createSignal<SyncStatus>("idle");
  const [error, setError] = createSignal<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = createSignal<number | null>(null);
  const [syncing, setSyncing] = createSignal(false);
  const [syncSessionId, setSyncSessionId] = createSignal<string | null>(null);
  
  // Task execution state
  const [selectedItem, setSelectedItem] = createSignal<TaskCenterItem | null>(null);
  const [tasks, setTasks] = createSignal<ParsedTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = createSignal<number>(-1);
  const [executing, setExecuting] = createSignal(false);

  // Automation state store - persists automation progress
  // Using Record instead of Map for JSON serialization compatibility
  const automationStore = (() => {
    const initialState: AutomationStateMap = {};
    const store = createStore<AutomationStateMap>(initialState);
    return persisted(Persist.global("task-center.automation"), store);
  })();
  const automationState = automationStore[0];
  const setAutomationState = (tfsId: number, state: TaskCenterAutomationState) => {
    const updater: Partial<AutomationStateMap> = {};
    updater[tfsId] = state;
    automationStore[1](updater);
  };

  // TFS Configuration store - persists TFS PAT and server URL
  const tfsConfigStore = (() => {
    const initialConfig: TFSConfig = DEFAULT_TFS_CONFIG;
    const store = createStore<TFSConfig>(initialConfig);
    return persisted(Persist.global("task-center.tfs-config"), store);
  })();
  const [tfsConfigState, setTfsConfigState] = tfsConfigStore;

  // Config loaded from file cache
  const [fileConfig, setFileConfig] = createSignal<TFSConfig | null>(null);
  const [configLoaded, setConfigLoaded] = createSignal(false);

  /**
   * Load TFS config from file (async)
   * Tries to read from .opencode/config/tfs.json
   */
  const loadTfsConfigFromFile = async (): Promise<TFSConfig | null> => {
    // Only try to load from file in Tauri desktop environment
    if (typeof window === 'undefined' || !(window as { __TAURI__?: unknown }).__TAURI__) {
      console.log('Not in Tauri environment, skipping file config');
      setConfigLoaded(true);
      return null;
    }

    try {
      // Dynamic import to avoid browser issues
      const fs = await import('@tauri-apps/plugin-fs');
      console.log('Loading TFS config from:', TFS_CONFIG_PATH);
      console.log('BaseDirectory values:', Object.keys(fs.BaseDirectory).join(', '));
      
      // Read from home directory (cross-platform)
      const content = await fs.readTextFile(TFS_CONFIG_PATH, { baseDir: fs.BaseDirectory.Home });
      console.log('TFS config file loaded, size:', content.length);
      
      const parsed = JSON.parse(content) as Partial<TFSConfig>;
      
      if (validateTfsConfig(parsed)) {
        const config = createTfsConfig(parsed);
        setFileConfig(config);
        // Also update persisted store
        setTfsConfigState(config);
        setConfigLoaded(true);
        console.log('TFS config loaded successfully');
        return config;
      } else {
        console.warn('TFS config file invalid (missing PAT)');
      }
    } catch (error) {
      // File doesn't exist or invalid - that's okay
      console.log('TFS config file not found or invalid:', error);
    }
    
    setConfigLoaded(true);
    return null;
  };

  /**
   * Save TFS config to file (async)
   */
  const saveTfsConfigToFile = async (config: TFSConfig): Promise<void> => {
    if (typeof window === 'undefined' || !(window as { __TAURI__?: unknown }).__TAURI__) {
      throw new Error('File operations only available in Tauri desktop app');
    }

    const fs = await import('@tauri-apps/plugin-fs');
    
    // Ensure directory exists
    try {
      await fs.mkdir('.opencode/config', { baseDir: fs.BaseDirectory.Home, recursive: true });
    } catch {
      // Directory might already exist
    }
    
    const content = JSON.stringify({
      serverUrl: config.serverUrl || DEFAULT_SERVER_URL,
      pat: config.pat,
      username: config.username,
    }, null, 2);
    
    await fs.writeTextFile(TFS_CONFIG_PATH, content, { baseDir: fs.BaseDirectory.Home });
    setFileConfig(config);
    console.log('TFS config saved to:', TFS_CONFIG_PATH);
  };

  // Hard-coded config for immediate use (will be overridden by file config when available)
  const HARDCODED_CONFIG: TFSConfig = {
    serverUrl: 'http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0',
    pat: 'yxnmy2hwkv4l2ulz7p7zt4b43fotxmsedamak4vfeattcehd5elq',
    username: 'WINNING\\g_wj'
  };

  /**
   * Get valid TFS configuration from store, file, or options
   * Priority: options > file > persisted storage > hardcoded
   */
  const getTfsConfig = (): TFSConfig | null => {
    // First try from options prop (highest priority)
    if (options.tfsConfig) {
      const config = options.tfsConfig();
      if (config && config.pat) return config;
    }

    // Then try from file cache
    const fromFile = fileConfig();
    if (fromFile && fromFile.pat) {
      return fromFile;
    }

    // Then try from persisted store (tfsConfigState is a Store, not a function)
    const stored = tfsConfigState;
    if (stored && stored.pat) {
      return {
        serverUrl: stored.serverUrl,
        pat: stored.pat,
        username: stored.username
      };
    }

    // Finally use hardcoded config as fallback
    return HARDCODED_CONFIG;
  };

  /**
   * Set TFS configuration (sync to store, async to file)
   */
  const setTfsConfig = (config: TFSConfig) => {
    setTfsConfigState(config);
    setFileConfig(config);
    // Also try to save to file (async, don't wait)
    if (typeof window !== 'undefined' && (window as { __TAURI__?: unknown }).__TAURI__) {
      saveTfsConfigToFile(config).catch(e => {
        console.warn('Failed to save TFS config to file:', e);
      });
    }
  };

  const uiStore = (() => {
    const store = createStore<TaskCenterUiState>({
      search: "",
    });
    return persisted(Persist.global("task-center.ui"), store);
  })();
  const ui = uiStore[0];
  const setUi = uiStore[1];

  const filteredItems = createMemo(() => {
    const uiState = ui;
    if (!uiState) return items();
    const query = uiState.search?.trim().toLowerCase() ?? "";
    if (!query) return items();
    return items().filter((item) => {
      const haystack = `${item.title ?? ""} ${item.project ?? ""} ${item.workItemType ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  const itemsByStatus = createMemo(() => {
    const grouped: Record<TaskCenterStatus, TaskCenterItem[]> = {
      todo: [],
      progress: [],
      done: [],
      archived: [],
      failed: [],
    };
    for (const item of filteredItems()) {
      grouped[item.status].push(item);
    }
    return grouped;
  });

  const setSearch = (value: string) => setUi("search", value);

  const syncTasks = async (syncOptions?: { force?: boolean }) => {
    if (syncing() && !syncOptions?.force) return;

    // Try to load config from file if not already loaded
    if (!configLoaded()) {
      await loadTfsConfigFromFile();
    }

    // Get TFS configuration
    const config = getTfsConfig();
    if (!config) {
      setError(`TFS configuration not found. Please create ${TFS_CONFIG_PATH} with your PAT:\n\n{\n  "serverUrl": "http://tfs2018-web.winning.com.cn:8080/tfs/WINNING-6.0",\n  "pat": "your-pat-token",\n  "username": "WINNING\\\\your-username"\n}`);
      setStatus("error");
      return;
    }

    setSyncing(true);
    setStatus("syncing");
    setError(null);
    setSyncSessionId(null);

    try {
      // Create TFS client and fetch work items directly
      const client = new TFSClient(config);
      const workItems = await client.getMyWorkItems({
        states: ['已分析'],
        top: 100
      });

      // Convert to TaskCenterItem format
      const tfsItems = workItems.map(formatToTaskCenterItem).map((item) => ({
        ...item,
        stage: "idle" as TaskCenterStage,
      }));

      // Merge with automation state to preserve items not in TFS query
      const mergedItems = mergeTfsItemsWithAutomation(tfsItems, automationState ?? {});
      setItems(mergedItems);
      setLastUpdatedAt(Date.now());
      setStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Task sync failed.";
      setError(message);
      setStatus("error");
    } finally {
      setSyncing(false);
    }
  };

  const startAutomation = async (item: TaskCenterItem) => {
    const tfsId = item.tfsId;

    // Get TFS configuration
    const config = getTfsConfig();
    if (!config) {
      setError("TFS configuration not found. Please configure TFS PAT in settings.");
      return;
    }

    try {
      // Step 1: Activate work item via TFS API
      const client = new TFSClient(config);
      await client.activateWorkItem(tfsId);

      // Step 2: Update local automation state
      setAutomationState(tfsId, {
        status: "progress",
        stage: "analyzing",
        subStage: null,
        sessionId: null,
        blockedReason: null,
        updatedAt: Date.now(),
      });

      // Step 3: Create OpenCode session with task-automation prompt
      const prompt = `使用 task-automation skill 完整处理 TFS 工作项 #${item.tfsId}。`;
      options.setPrompt(prompt);
      options.createSessionAndOpen();

    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start automation.";
      setError(message);
      console.error("Start automation error:", error);
    }
  };

  // Task execution functions
  const selectItem = (item: TaskCenterItem | null) => {
    setSelectedItem(item);
    if (item) {
      loadTasks(item);
    } else {
      setTasks([]);
      setCurrentTaskIndex(-1);
    }
  };

  const loadTasks = async (item: TaskCenterItem) => {
    const activeClient = options.client();
    if (!activeClient) return;

    const directory = options.activeWorkspaceRoot().trim();
    const tasksPath = `forge/tracks/workitem-autorun/tfs-${item.tfsId}/tasks.md`;

    try {
      const sessionApi = activeClient.session as typeof activeClient.session & {
        shellAsync?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
        shell?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
      };

      const result = await sessionApi.create({ directory: directory || undefined });
      const session = unwrap(result);
      const sessionID = session.id;

      // Try to read tasks.md
      const shellInput = {
        sessionID,
        command: `cat ${tasksPath}`,
        agent: "openwork",
        directory: directory || undefined,
      };

      const shellResult = sessionApi.shellAsync
        ? await sessionApi.shellAsync(shellInput)
        : sessionApi.shell
          ? await sessionApi.shell(shellInput)
          : null;

      if (shellResult) {
        const output = extractOutput(shellResult);
        if (output) {
          const parsed = parseTasks(output);
          setTasks(parsed);
          const nextIndex = parsed.findIndex(t => t.status === "pending" || t.status === "in-progress");
          setCurrentTaskIndex(nextIndex >= 0 ? nextIndex : 0);
        }
      }
    } catch (err) {
      console.warn("Failed to load tasks:", err);
      setTasks([]);
    }
  };

  const executeTaskStep = async (item: TaskCenterItem, taskIndex: number) => {
    const activeClient = options.client();
    if (!activeClient || executing()) return;

    const directory = options.activeWorkspaceRoot().trim();
    const tasksPath = `forge/tracks/workitem-autorun/tfs-${item.tfsId}/tasks.md`;

    setExecuting(true);
    
    try {
      const sessionApi = activeClient.session as typeof activeClient.session & {
        shellAsync?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
        shell?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
      };

      // Create session for file operations
      const result = await sessionApi.create({ directory: directory || undefined });
      const session = unwrap(result);
      const sessionID = session.id;

      // Read current tasks.md
      const readInput = {
        sessionID,
        command: `cat ${tasksPath}`,
        agent: "openwork",
        directory: directory || undefined,
      };

      const readResult = sessionApi.shellAsync
        ? await sessionApi.shellAsync(readInput)
        : sessionApi.shell
          ? await sessionApi.shell(readInput)
          : null;

      if (!readResult) {
        throw new Error("Cannot read tasks.md");
      }

      const content = extractOutput(readResult);
      if (!content) {
        throw new Error("Tasks.md is empty");
      }

      // Update task status to in-progress
      const updated = updateTaskStatus(content, taskIndex, "in-progress");
      
      // Write back
      const writeInput = {
        sessionID,
        command: `cat > ${tasksPath} << 'EOF'
${updated}
EOF`,
        agent: "openwork",
        directory: directory || undefined,
      };

      await sessionApi.shellAsync?.(writeInput) ?? sessionApi.shell?.(writeInput);

      // Update local state
      setTasks(prev => prev.map((t, i) => i === taskIndex ? { ...t, status: "in-progress" } : t));
      setCurrentTaskIndex(taskIndex);

      // Update automation state
      setAutomationState(item.tfsId, {
        status: "progress",
        stage: getStageForTask(taskIndex),
        subStage: `task-${taskIndex}`,
        sessionId: sessionID,
        blockedReason: null,
        updatedAt: Date.now(),
      });

      // Create OpenCode session for task execution
      const task = tasks()[taskIndex];
      if (task) {
        const prompt = `执行任务 ${taskIndex + 1}：${task.title}\n\n工作项: #${item.tfsId}\n\n${task.description}`;
        options.setPrompt(prompt);
        options.createSessionAndOpen();
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Task execution failed.";
      setError(message);
      console.error("Execute task step error:", error);
    } finally {
      setExecuting(false);
    }
  };

  const completeTaskStep = async (item: TaskCenterItem, taskIndex: number) => {
    const activeClient = options.client();
    if (!activeClient || executing()) return;

    const directory = options.activeWorkspaceRoot().trim();
    const tasksPath = `forge/tracks/workitem-autorun/tfs-${item.tfsId}/tasks.md`;

    setExecuting(true);

    try {
      const sessionApi = activeClient.session as typeof activeClient.session & {
        shellAsync?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
        shell?: (input: {
          sessionID: string;
          command: string;
          agent?: string;
          directory?: string;
        }) => Promise<unknown>;
      };

      const result = await sessionApi.create({ directory: directory || undefined });
      const session = unwrap(result);
      const sessionID = session.id;

      // Read current tasks.md
      const readInput = {
        sessionID,
        command: `cat ${tasksPath}`,
        agent: "openwork",
        directory: directory || undefined,
      };

      const readResult = sessionApi.shellAsync
        ? await sessionApi.shellAsync(readInput)
        : sessionApi.shell
          ? await sessionApi.shell(readInput)
          : null;

      if (!readResult) {
        throw new Error("Cannot read tasks.md");
      }

      const content = extractOutput(readResult);
      if (!content) {
        throw new Error("Tasks.md is empty");
      }

      // Mark current task as completed
      const updated = updateTaskStatus(content, taskIndex, "completed");

      // Write back
      const writeInput = {
        sessionID,
        command: `cat > ${tasksPath} << 'EOF'
${updated}
EOF`,
        agent: "openwork",
        directory: directory || undefined,
      };

      await sessionApi.shellAsync?.(writeInput) ?? sessionApi.shell?.(writeInput);

      // Update local state
      setTasks(prev => prev.map((t, i) => i === taskIndex ? { ...t, status: "completed" } : t));

      // Check if all tasks completed
      const allTasks = tasks().map((t, i) => i === taskIndex ? { ...t, status: "completed" as const } : t);
      const allCompleted = allTasks.every(t => t.status === "completed");

      if (allCompleted) {
        setAutomationState(item.tfsId, {
          status: "done",
          stage: "reviewing",
          subStage: null,
          sessionId: null,
          blockedReason: null,
          updatedAt: Date.now(),
        });
      } else {
        // Move to next task
        const nextIndex = allTasks.findIndex(t => t.status === "pending");
        if (nextIndex >= 0) {
          setCurrentTaskIndex(nextIndex);
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Complete task step failed.";
      setError(message);
      console.error("Complete task step error:", error);
    } finally {
      setExecuting(false);
    }
  };

  const getStageForTask = (taskIndex: number): TaskCenterStage => {
    // Map task index to stage based on typical workflow
    if (taskIndex === 0) return "analyzing";
    if (taskIndex === 1) return "designing";
    if (taskIndex === 2) return "planning";
    return "implementing";
  };

  return {
    items,
    setItems,
    status,
    error,
    lastUpdatedAt,
    syncing,
    ui: ui ?? { search: "" },
    setUi,
    setSearch,
    filteredItems,
    itemsByStatus,
    syncTasks,
    startAutomation,
    setSyncSessionId,
    syncSessionId,
    automationState,
    setAutomationState,
    // TFS Configuration
    tfsConfig: tfsConfigState,
    setTfsConfig,
    loadTfsConfigFromFile,
    saveTfsConfigToFile,
    TFS_CONFIG_PATH,
    // Task execution
    selectedItem,
    selectItem,
    tasks,
    currentTaskIndex,
    executing,
    executeTaskStep,
    completeTaskStep,
    loadTasks,
  };
}
