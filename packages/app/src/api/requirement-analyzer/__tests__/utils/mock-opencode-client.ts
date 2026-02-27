import { vi } from "vitest";

import type { Client } from "../../../app/types";

export type PromptResolver = (prompt: string) => string | Error;

export type MockClientHarness = {
  client: Client;
  getCallCount: () => number;
};

export function createMockClient(resolver: PromptResolver): MockClientHarness {
  let callCount = 0;
  let sessionId = 0;

  const client = {
    session: {
      create: vi.fn(async () => ({ data: { id: `session-${++sessionId}` } })),
      promptAsync: vi.fn(async (options: any) => {
        callCount += 1;
        const text = options?.parts?.[0]?.text ?? "";
        const output = resolver(text);
        if (output instanceof Error) {
          return { data: { error: { message: output.message } } };
        }
        return { data: { output } };
      }),
      messages: vi.fn(async () => ({ data: [] })),
      status: vi.fn(async () => ({ data: {} })),
    },
  } as unknown as Client;

  return {
    client,
    getCallCount: () => callCount,
  };
}
