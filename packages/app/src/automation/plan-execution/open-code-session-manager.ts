import { unwrap } from "../../app/lib/opencode";
import type { Client } from "../../app/types";
import type { ExecutionOptions } from "./types";

type ModelRef = { providerID: string; modelID: string };

type SessionStatus = { type?: string; status?: string; state?: string };

type PromptOptions = {
  systemPrompt?: string;
  model?: ModelRef | null;
  maxRetries?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

type SessionMessage = {
  info?: { role?: string; error?: unknown };
  parts?: Array<{ type?: string; text?: string }>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractAssistantText = (messages: SessionMessage[]) => {
  const assistantMessages = messages.filter((message) => message.info?.role === "assistant");
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
  if (!lastAssistantMessage) {
    return { text: "", error: null };
  }

  if (lastAssistantMessage.info?.error) {
    return { text: "", error: lastAssistantMessage.info.error };
  }

  const textParts = (lastAssistantMessage.parts ?? []).filter((part) => part.type === "text" && part.text);
  const text = textParts.map((part) => part.text ?? "").join("");
  return { text, error: null };
};

export class OpenCodeSessionManager {
  private getClient: () => Client | null;
  private getModel: () => ModelRef | null;
  private maxRetries: number;
  private pollIntervalMs: number;
  private timeoutMs: number;
  private now: () => number;

  constructor(options: {
    client: () => Client | null;
    getModel?: () => ModelRef | null;
    maxRetries?: number;
    pollIntervalMs?: number;
    timeoutMs?: number;
    now?: () => number;
  }) {
    this.getClient = options.client;
    this.getModel = options.getModel ?? (() => null);
    this.maxRetries = options.maxRetries ?? 3;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    this.now = options.now ?? (() => Date.now());
  }

  private requireClient(): Client {
    const client = this.getClient();
    if (!client) {
      throw new Error("OpenCode 客户端未连接");
    }
    return client;
  }

  async createExecutionSession(): Promise<string> {
    const client = this.requireClient();
    const sessionResult = unwrap(await client.session.create({})) as { id: string };
    if (!sessionResult?.id) {
      throw new Error("Session 创建失败");
    }
    return sessionResult.id;
  }

  async sendExecutionPrompt(
    sessionID: string,
    prompt: string,
    options?: PromptOptions & Pick<ExecutionOptions, "model">
  ): Promise<string> {
    const client = this.requireClient();
    const maxRetries = options?.maxRetries ?? this.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.sendPromptOnce(client, sessionID, prompt, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          await sleep(attempt * 2000);
        }
      }
    }

    throw new Error(`执行失败（已重试 ${maxRetries} 次）: ${lastError?.message ?? "未知错误"}`);
  }

  async startExecutionPrompt(
    sessionID: string,
    prompt: string,
    options?: PromptOptions & Pick<ExecutionOptions, "model">
  ): Promise<void> {
    const client = this.requireClient();
    const { promptOptions } = this.buildPromptPayload(sessionID, prompt, options);
    const result = await client.session.promptAsync(promptOptions);
    if (result && (result as any).data) {
      const data = (result as any).data;
      if (data.error) {
        throw new Error(`OpenCode 执行失败: ${JSON.stringify(data.error)}`);
      }
    }
  }

  private async sendPromptOnce(
    client: Client,
    sessionID: string,
    prompt: string,
    options?: PromptOptions
  ): Promise<string> {
    const { promptOptions } = this.buildPromptPayload(sessionID, prompt, options);
    const result = await client.session.promptAsync(promptOptions);
    if (result && (result as any).data) {
      const data = (result as any).data;
      if (data.error) {
        throw new Error(`OpenCode 执行失败: ${JSON.stringify(data.error)}`);
      }
      if (data.output) return data.output;
      if (data.content) return data.content;
    }

    return this.waitForCompletion(client, sessionID, options);
  }

  private buildPromptPayload(sessionID: string, prompt: string, options?: PromptOptions) {
    const model = options?.model ?? this.getModel();
    const systemPrompt = options?.systemPrompt?.trim();
    const content = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    const promptOptions: any = {
      sessionID,
      parts: [{ type: "text", text: content }],
    };
    if (model) {
      promptOptions.model = model;
    }
    return { promptOptions };
  }

  private async waitForCompletion(client: Client, sessionID: string, options?: PromptOptions): Promise<string> {
    const pollIntervalMs = options?.pollIntervalMs ?? this.pollIntervalMs;
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const start = this.now();
    let lastText = "";

    while (this.now() - start < timeoutMs) {
      await sleep(pollIntervalMs);

      const messages = unwrap(await client.session.messages({ sessionID })) as SessionMessage[];
      const { text, error } = extractAssistantText(messages ?? []);
      if (error) {
        throw new Error(`OpenCode 执行失败: ${JSON.stringify(error)}`);
      }
      if (text) lastText = text;

      const statusResult = unwrap(await client.session.status()) as Record<string, SessionStatus>;
      const currentStatus = statusResult?.[sessionID];
      const status = currentStatus?.type || currentStatus?.status || currentStatus?.state;

      if (!currentStatus || status === "completed" || status === "idle") {
        if (lastText) return lastText;
        break;
      }

      if (status === "failed" || status === "error") {
        throw new Error("OpenCode 执行失败");
      }
    }

    if (lastText) return lastText;
    throw new Error("OpenCode 执行超时");
  }

  async getSessionMessages(sessionID: string): Promise<SessionMessage[]> {
    const client = this.requireClient();
    return unwrap(await client.session.messages({ sessionID })) as SessionMessage[];
  }

  async closeSession(sessionID: string): Promise<boolean> {
    const client = this.requireClient();
    const sessionApi = (client as any).session;

    try {
      if (typeof sessionApi?.delete === "function") {
        await sessionApi.delete({ sessionID });
        return true;
      }
      if (typeof sessionApi?.remove === "function") {
        await sessionApi.remove({ sessionID });
        return true;
      }
      if (typeof sessionApi?.close === "function") {
        await sessionApi.close({ sessionID });
        return true;
      }
    } catch (error) {
      console.warn("[OpenCodeSessionManager] Failed to close session", error);
      return false;
    }

    return false;
  }
}
