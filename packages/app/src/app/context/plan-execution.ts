import { createStore } from "solid-js/store";

import { Persist, persisted } from "../utils/persist";
import type { ExecutionMessage, ExecutionProgress, ExecutionResult } from "../../automation/plan-execution/types";

export type PlanExecutionState = {
  tfsId: number;
  status: ExecutionProgress["status"];
  sessionId?: string | null;
  workspaceRoot?: string | null;
  progress?: ExecutionProgress;
  messages: ExecutionMessage[];
  question?: string | null;
  questionAt?: number | null;
  result?: ExecutionResult;
  error?: string | null;
  syncError?: string | null;
  startedAt?: number | null;
  completedAt?: number | null;
  archivePath?: string | null;
  paused?: boolean;
  updatedAt: number;
};

export type PlanExecutionHistoryEntry = {
  sessionId?: string | null;
  status: ExecutionProgress["status"];
  startedAt?: number | null;
  completedAt?: number | null;
  archivePath?: string | null;
};

type PlanExecutionStoreState = {
  executions: Record<number, PlanExecutionState>;
  history: Record<number, PlanExecutionHistoryEntry[]>;
};

const createDefaultState = (tfsId: number): PlanExecutionState => ({
  tfsId,
  status: "idle",
  sessionId: null,
  workspaceRoot: null,
  messages: [],
  question: null,
  questionAt: null,
  error: null,
  syncError: null,
  startedAt: null,
  completedAt: null,
  archivePath: null,
  paused: false,
  updatedAt: Date.now(),
});

export function createPlanExecutionStore() {
  const [store, setStore] = persisted(
    Persist.global("task-center.plan-execution"),
    createStore<PlanExecutionStoreState>({ executions: {}, history: {} })
  );

  const getExecution = (tfsId: number) => store.executions[tfsId] ?? null;

  const setExecution = (tfsId: number, next: PlanExecutionState) => {
    setStore("executions", tfsId, next);
  };

  const updateExecution = (tfsId: number, patch: Partial<PlanExecutionState>) => {
    setStore("executions", tfsId, (current) => ({
      ...(current ?? createDefaultState(tfsId)),
      ...patch,
      updatedAt: Date.now(),
    }));
  };

  const appendMessages = (tfsId: number, messages: ExecutionMessage[]) => {
    setStore("executions", tfsId, "messages", (current) => {
      const base = Array.isArray(current) ? current : [];
      return [...base, ...messages];
    });
    updateExecution(tfsId, {});
  };

  const setQuestion = (tfsId: number, question: string | null) => {
    updateExecution(tfsId, {
      question,
      questionAt: question ? Date.now() : null,
      status: question ? "waiting" : "running",
    });
  };

  const addHistory = (tfsId: number, entry: PlanExecutionHistoryEntry) => {
    setStore("history", tfsId, (current) => {
      const base = Array.isArray(current) ? current : [];
      return [...base, entry];
    });
  };

  const clearExecution = (tfsId: number) => {
    setStore("executions", tfsId, createDefaultState(tfsId));
  };

  return {
    store,
    getExecution,
    setExecution,
    updateExecution,
    appendMessages,
    setQuestion,
    addHistory,
    clearExecution,
  };
}
