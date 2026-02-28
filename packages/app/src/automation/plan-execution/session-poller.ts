export type SessionMessagePart = { type?: string; text?: string };
export type SessionMessageInfo = { id?: string; role?: string; createdAt?: number; created?: number; error?: unknown };
export type SessionMessage = { info?: SessionMessageInfo; parts?: SessionMessagePart[] };

export type SessionPollerOptions = {
  sessionId: string;
  intervalMs?: number;
  maxIntervalMs?: number;
  idleThreshold?: number;
  getMessages: (sessionId: string) => Promise<SessionMessage[]>;
  onMessages: (messages: SessionMessage[]) => void;
  onError?: (error: unknown) => void;
};

const messageKey = (message: SessionMessage, index: number) => {
  const info = message.info;
  const id = info?.id;
  if (id) return id;
  const created = info?.createdAt ?? info?.created ?? 0;
  const role = info?.role ?? "unknown";
  return `${created}-${role}-${index}`;
};

export class SessionPoller {
  private sessionId: string;
  private baseIntervalMs: number;
  private maxIntervalMs: number;
  private idleThreshold: number;
  private currentIntervalMs: number;
  private getMessages: (sessionId: string) => Promise<SessionMessage[]>;
  private onMessages: (messages: SessionMessage[]) => void;
  private onError?: (error: unknown) => void;
  private timer: number | null = null;
  private lastLength = 0;
  private seen = new Set<string>();
  private running = false;
  private idleCount = 0;

  constructor(options: SessionPollerOptions) {
    this.sessionId = options.sessionId;
    this.baseIntervalMs = options.intervalMs ?? 2000;
    this.maxIntervalMs = options.maxIntervalMs ?? Math.max(this.baseIntervalMs * 4, 8000);
    this.idleThreshold = options.idleThreshold ?? 2;
    this.currentIntervalMs = this.baseIntervalMs;
    this.getMessages = options.getMessages;
    this.onMessages = options.onMessages;
    this.onError = options.onError;
  }

  isRunning() {
    return this.running;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startTimer();
    void this.pollOnce();
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  resume() {
    if (this.running) return;
    this.start();
  }

  stop() {
    this.pause();
    this.lastLength = 0;
    this.seen.clear();
    this.idleCount = 0;
    this.currentIntervalMs = this.baseIntervalMs;
  }

  private startTimer() {
    if (this.timer != null) {
      window.clearInterval(this.timer);
    }
    this.timer = window.setInterval(() => {
      void this.pollOnce();
    }, this.currentIntervalMs);
  }

  private adjustInterval(hasMessages: boolean) {
    if (hasMessages) {
      this.idleCount = 0;
      if (this.currentIntervalMs !== this.baseIntervalMs) {
        this.currentIntervalMs = this.baseIntervalMs;
        if (this.running) this.startTimer();
      }
      return;
    }

    this.idleCount += 1;
    if (this.idleCount < this.idleThreshold) return;
    const next = Math.min(this.maxIntervalMs, Math.round(this.currentIntervalMs * 1.5));
    if (next !== this.currentIntervalMs) {
      this.currentIntervalMs = next;
      if (this.running) this.startTimer();
    }
  }

  private async pollOnce() {
    try {
      const messages = await this.getMessages(this.sessionId);
      const next = Array.isArray(messages) ? messages : [];

      if (next.length < this.lastLength) {
        this.lastLength = 0;
        this.seen.clear();
      }

      const slice = next.slice(this.lastLength);
      const fresh = slice.filter((message, index) => {
        const key = messageKey(message, this.lastLength + index);
        if (this.seen.has(key)) return false;
        this.seen.add(key);
        return true;
      });

      this.lastLength = next.length;
      if (fresh.length > 0) {
        this.onMessages(fresh);
      }
      this.adjustInterval(fresh.length > 0);
    } catch (error) {
      this.onError?.(error);
    }
  }
}
