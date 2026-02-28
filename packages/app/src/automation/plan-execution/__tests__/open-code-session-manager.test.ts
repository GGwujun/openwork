import { describe, expect, it } from "vitest";

import { OpenCodeSessionManager } from "../open-code-session-manager";

const createFieldsResult = <T,>(data: T) => ({ data } as { data: T });

const createClient = (overrides?: {
  promptAsync?: (options: any) => Promise<any>;
  messages?: () => Promise<any>;
  status?: () => Promise<any>;
  deleteSession?: () => Promise<any>;
}) => {
  const session = {
    create: async () => createFieldsResult({ id: "ses-1" }),
    promptAsync: overrides?.promptAsync ?? (async () => createFieldsResult({ output: "ok" })),
    messages: overrides?.messages ?? (async () => createFieldsResult([])),
    status: overrides?.status ?? (async () => createFieldsResult({})),
    delete: overrides?.deleteSession ?? (async () => createFieldsResult(true)),
  };
  return { session } as any;
};

describe("OpenCodeSessionManager", () => {
  it("throws when client is unavailable", async () => {
    const manager = new OpenCodeSessionManager({ client: () => null });
    await expect(manager.createExecutionSession()).rejects.toThrow("OpenCode 客户端未连接");
  });

  it("creates an execution session", async () => {
    const manager = new OpenCodeSessionManager({ client: () => createClient() });
    const sessionId = await manager.createExecutionSession();
    expect(sessionId).toBe("ses-1");
  });

  it("sends prompt and returns immediate output", async () => {
    const manager = new OpenCodeSessionManager({ client: () => createClient() });
    const output = await manager.sendExecutionPrompt("ses-1", "hello");
    expect(output).toBe("ok");
  });

  it("starts prompt without waiting", async () => {
    let called = false;
    const manager = new OpenCodeSessionManager({
      client: () =>
        createClient({
          promptAsync: async () => {
            called = true;
            return createFieldsResult({});
          },
        }),
    });

    await manager.startExecutionPrompt("ses-1", "hello");
    expect(called).toBe(true);
  });

  it("uses model override when provided", async () => {
    let captured: any = null;
    const manager = new OpenCodeSessionManager({
      client: () =>
        createClient({
          promptAsync: async (options) => {
            captured = options;
            return createFieldsResult({ output: "ok" });
          },
        }),
      getModel: () => ({ providerID: "default", modelID: "model" }),
    });

    await manager.sendExecutionPrompt("ses-1", "hello", {
      model: { providerID: "custom", modelID: "x" },
    });

    expect(captured.model).toEqual({ providerID: "custom", modelID: "x" });
  });

  it("polls session when promptAsync returns no output", async () => {
    const manager = new OpenCodeSessionManager({
      client: () =>
        createClient({
          promptAsync: async () => ({}),
          messages: async () =>
            createFieldsResult([
              { info: { role: "assistant" }, parts: [{ type: "text", text: "done" }] },
            ]),
          status: async () => createFieldsResult({ "ses-1": { type: "completed" } }),
        }),
    });

    const output = await manager.sendExecutionPrompt("ses-1", "hello", {
      pollIntervalMs: 0,
      timeoutMs: 10,
    });

    expect(output).toBe("done");
  });

  it("returns session messages", async () => {
    const messages = [{ info: { role: "assistant" } }];
    const manager = new OpenCodeSessionManager({
      client: () => createClient({ messages: async () => createFieldsResult(messages) }),
    });

    const result = await manager.getSessionMessages("ses-1");
    expect(result).toEqual(messages);
  });

  it("closes session when delete is available", async () => {
    let called = false;
    const manager = new OpenCodeSessionManager({
      client: () =>
        createClient({
          deleteSession: async () => {
            called = true;
            return createFieldsResult(true);
          },
        }),
    });

    const closed = await manager.closeSession("ses-1");
    expect(closed).toBe(true);
    expect(called).toBe(true);
  });
});
