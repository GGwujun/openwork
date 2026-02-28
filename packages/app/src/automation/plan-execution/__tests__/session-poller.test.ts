import { describe, expect, it } from "vitest";

import { SessionPoller } from "../session-poller";

describe("SessionPoller", () => {
  it("emits only new messages", async () => {
    let payload: any[] = [];
    const messages: any[] = [
      { info: { id: "msg-1", role: "assistant" }, parts: [{ type: "text", text: "a" }] },
    ];

    const poller = new SessionPoller({
      sessionId: "ses-1",
      getMessages: async () => messages,
      onMessages: (next) => {
        payload = payload.concat(next);
      },
    });

    await (poller as any).pollOnce();
    expect(payload).toHaveLength(1);

    messages.push({ info: { id: "msg-2", role: "assistant" }, parts: [{ type: "text", text: "b" }] });
    await (poller as any).pollOnce();

    expect(payload).toHaveLength(2);
    expect(payload[1].info.id).toBe("msg-2");
  });
});
