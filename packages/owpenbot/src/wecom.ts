import crypto from "node:crypto";
import http from "node:http";

import type { Logger } from "pino";

import type { Config, WecomIdentity, WecomMode } from "./config.js";

export type InboundMessage = {
  channel: "wecom";
  identityId: string;
  peerId: string;
  text: string;
  raw: unknown;
};

export type MessageHandler = (message: InboundMessage) => Promise<void> | void;

export type WecomAdapter = {
  name: "wecom";
  identityId: string;
  maxTextLength: number;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendText(peerId: string, text: string): Promise<void>;
};

const MAX_STREAM_BYTES = 20_480;
const STREAM_IDLE_MS = 8_000;
const STREAM_CLEANUP_MS = 30_000;
const THINKING_PLACEHOLDER = "思考中...";

type StreamState = {
  id: string;
  content: string;
  finished: boolean;
  updatedAt: number;
};

type StreamRuntime = {
  streams: Map<string, StreamState>;
  peerQueues: Map<string, string[]>;
  finishTimers: Map<string, NodeJS.Timeout>;
  responseUrls: Map<string, { url: string; expiresAt: number; used: boolean }>;
};

type WebhookTarget = {
  identity: WecomIdentity;
  config: Config;
  log: Logger;
  onMessage: MessageHandler;
  runtime?: StreamRuntime;
};

type WebhookServerState = {
  host: string;
  port: number;
  server: http.Server | null;
  targets: Map<string, WebhookTarget>;
};

const globalServer: WebhookServerState = {
  host: "127.0.0.1",
  port: 0,
  server: null,
  targets: new Map(),
};

const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

class WecomCrypto {
  private readonly token: string;
  private readonly aesKey: Buffer;
  private readonly iv: Buffer;

  constructor(token: string, encodingAesKey: string) {
    if (!encodingAesKey || encodingAesKey.length !== 43) {
      throw new Error("EncodingAESKey must be 43 characters");
    }
    if (!token) {
      throw new Error("WeCom token is required");
    }
    this.token = token;
    this.aesKey = Buffer.from(`${encodingAesKey}=`, "base64");
    this.iv = this.aesKey.subarray(0, 16);
  }

  getSignature(timestamp: string, nonce: string, encrypt: string): string {
    const parts = [this.token, timestamp, nonce, encrypt]
      .map((value) => String(value))
      .toSorted();
    return crypto.createHash("sha1").update(parts.join("")).digest("hex");
  }

  decrypt(encrypted: string, corpId?: string): string {
    const decipher = crypto.createDecipheriv("aes-256-cbc", this.aesKey, this.iv);
    decipher.setAutoPadding(false);
    const decoded = Buffer.concat([decipher.update(encrypted, "base64"), decipher.final()]);
    const plain = this.decodePkcs7(decoded);
    const content = plain.subarray(16);
    const msgLen = content.subarray(0, 4).readUInt32BE(0);
    const msg = content.subarray(4, 4 + msgLen).toString("utf8");
    const appId = content.subarray(4 + msgLen).toString("utf8").trim();
    if (corpId && appId && appId !== corpId) {
      throw new Error("WeCom corpId mismatch");
    }
    return msg;
  }

  encrypt(text: string): string {
    const random16 = crypto.randomBytes(16);
    const msgBuffer = Buffer.from(text);
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32BE(msgBuffer.length, 0);
    const raw = Buffer.concat([random16, lenBuffer, msgBuffer]);
    const padded = this.encodePkcs7(raw);
    const cipher = crypto.createCipheriv("aes-256-cbc", this.aesKey, this.iv);
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(padded), cipher.final()]).toString("base64");
  }

  private encodePkcs7(buff: Buffer): Buffer {
    const blockSize = 32;
    const pad = blockSize - (buff.length % blockSize);
    return Buffer.concat([buff, Buffer.alloc(pad, pad)]);
  }

  private decodePkcs7(buff: Buffer): Buffer {
    const pad = buff[buff.length - 1];
    if (pad < 1 || pad > 32) {
      throw new Error("Invalid PKCS7 padding");
    }
    return buff.subarray(0, buff.length - pad);
  }
}

function normalizeWebhookPath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

function parseXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>|<${tag}>([^<]+)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  const value = match?.[1] ?? match?.[2];
  return typeof value === "string" ? value.trim() : null;
}

function parseEncryptField(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { encrypt?: string };
      return typeof parsed.encrypt === "string" ? parsed.encrypt.trim() : null;
    } catch {
      return null;
    }
  }
  return parseXmlValue(trimmed, "Encrypt");
}

function truncateStreamContent(content: string): string {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes <= MAX_STREAM_BYTES) return content;
  return Buffer.from(content, "utf8").subarray(0, MAX_STREAM_BYTES).toString("utf8");
}

function buildStreamResponse(
  cryptoClient: WecomCrypto,
  streamId: string,
  content: string,
  finish: boolean,
  timestamp: string,
  nonce: string,
): string {
  const payload = {
    msgtype: "stream",
    stream: {
      id: streamId,
      finish,
      content: truncateStreamContent(content),
    },
  };
  const encrypted = cryptoClient.encrypt(JSON.stringify(payload));
  const signature = cryptoClient.getSignature(timestamp, nonce, encrypted);
  return JSON.stringify({
    encrypt: encrypted,
    msgsignature: signature,
    timestamp,
    nonce,
  });
}

function ensureServer(config: Config, logger: Logger) {
  const host = config.wecomWebhookHost;
  const port = config.wecomWebhookPort;
  if (globalServer.server) {
    if (globalServer.host !== host || globalServer.port !== port) {
      logger.warn({ host, port }, "wecom server already running on different host/port");
    }
    return;
  }

  globalServer.host = host;
  globalServer.port = port;

  globalServer.server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "", "http://localhost");
      const path = normalizeWebhookPath(url.pathname);
      const target = globalServer.targets.get(path);
      if (!target) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      const { identity, config: targetConfig, log, onMessage, runtime } = target;
      const token = identity.token?.trim() ?? "";
      const encodingAesKey = identity.encodingAesKey?.trim() ?? "";
      if (!token || !encodingAesKey) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("WeCom credentials missing");
        return;
      }

      const cryptoClient = new WecomCrypto(token, encodingAesKey);
      const timestamp = url.searchParams.get("timestamp") ?? "";
      const nonce = url.searchParams.get("nonce") ?? "";
      const signature = url.searchParams.get("msg_signature") ?? "";

      if (req.method === "GET") {
        const echostr = url.searchParams.get("echostr") ?? "";
        if (!timestamp || !nonce || !signature || !echostr) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing verification params");
          return;
        }
        const calc = cryptoClient.getSignature(timestamp, nonce, echostr);
        if (calc !== signature) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Invalid signature");
          return;
        }
        try {
          const decrypted = cryptoClient.decrypt(echostr, identity.mode === "app" ? identity.corpId : undefined);
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(decrypted);
        } catch (error) {
          log.warn({ error }, "wecom verify decrypt failed");
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Decrypt failed");
        }
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method not allowed");
        return;
      }

      let raw = "";
      for await (const chunk of req) {
        raw += chunk.toString();
        if (raw.length > 1024 * 1024) {
          res.writeHead(413, { "Content-Type": "text/plain" });
          res.end("Payload too large");
          return;
        }
      }

      const encrypt = parseEncryptField(raw);
      if (!encrypt || !timestamp || !nonce || !signature) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid request");
        return;
      }

      const calcSignature = cryptoClient.getSignature(timestamp, nonce, encrypt);
      if (calcSignature !== signature) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Invalid signature");
        return;
      }

      let decrypted = "";
      try {
        decrypted = cryptoClient.decrypt(encrypt, identity.mode === "app" ? identity.corpId : undefined);
      } catch (error) {
        log.warn({ error }, "wecom message decrypt failed");
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Decrypt failed");
        return;
      }

      if (identity.mode === "ai-bot") {
        let payload: any = null;
        try {
          payload = JSON.parse(decrypted);
        } catch (error) {
          log.warn({ error }, "wecom ai-bot payload parse failed");
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid payload");
          return;
        }

        if (payload?.msgtype === "stream") {
          const streamId = payload?.stream?.id;
          const stream = runtime?.streams.get(String(streamId || ""));
          const content = stream?.content ?? "";
          const finished = stream?.finished ?? true;
          const response = buildStreamResponse(cryptoClient, String(streamId || ""), content, finished, timestamp, nonce);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(response);
          if (stream && stream.finished && Date.now() - stream.updatedAt > STREAM_CLEANUP_MS) {
            runtime?.streams.delete(stream.id);
          }
          return;
        }

        const text = buildAiBotText(payload);
        const fromUser = typeof payload?.from?.userid === "string" ? payload.from.userid : "";
        const chatType = typeof payload?.chattype === "string" ? payload.chattype : "single";
        const chatId = typeof payload?.chatid === "string" ? payload.chatid : "";
        const responseUrl = typeof payload?.response_url === "string" ? payload.response_url : "";
        const peerId = chatType === "group" && chatId ? `group:${chatId}` : `user:${fromUser || "unknown"}`;

        if (chatType === "group" && !targetConfig.groupsEnabled) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(buildStreamResponse(cryptoClient, crypto.randomUUID(), "", true, timestamp, nonce));
          return;
        }

        const streamId = crypto.randomUUID();
        const runtimeState = runtime ?? createRuntime();
        target.runtime = runtimeState;
        const stream = createStream(runtimeState, peerId, streamId);
        stream.content = THINKING_PLACEHOLDER;
        stream.updatedAt = Date.now();
        const response = buildStreamResponse(cryptoClient, streamId, THINKING_PLACEHOLDER, false, timestamp, nonce);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(response);

        if (responseUrl) {
          runtimeState.responseUrls.set(peerId, {
            url: responseUrl,
            expiresAt: Date.now() + 60 * 60 * 1000,
            used: false,
          });
        }

        if (!text.trim()) {
          return;
        }

        void Promise.resolve().then(() =>
          onMessage({
            channel: "wecom",
            identityId: identity.id,
            peerId,
            text,
            raw: payload,
          }),
        );
        return;
      }

      const msgType = parseXmlValue(decrypted, "MsgType") ?? "";
      const fromUser = parseXmlValue(decrypted, "FromUserName") ?? "";
      const chatType = parseXmlValue(decrypted, "ChatType") ?? "";
      const chatId = parseXmlValue(decrypted, "ChatId") ?? "";
      const peerId = chatType === "group" && chatId ? `group:${chatId}` : `user:${fromUser || "unknown"}`;

      if (chatType === "group" && !targetConfig.groupsEnabled) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("success");
        return;
      }

      const text = msgType === "text"
        ? parseXmlValue(decrypted, "Content") ?? ""
        : msgType
          ? `[wecom:${msgType}]`
          : "";

      if (text.trim()) {
        void Promise.resolve().then(() =>
          onMessage({
            channel: "wecom",
            identityId: identity.id,
            peerId,
            text,
            raw: decrypted,
          }),
        );
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("success");
    })().catch((error) => {
      logger.warn({ error }, "wecom webhook handler failed");
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal error");
    });
  });

  globalServer.server.listen(port, host, () => {
    logger.info({ host, port }, "wecom webhook server listening");
  });
}

function createRuntime(): StreamRuntime {
  return {
    streams: new Map(),
    peerQueues: new Map(),
    finishTimers: new Map(),
    responseUrls: new Map(),
  };
}

function createStream(runtime: StreamRuntime, peerId: string, streamId: string): StreamState {
  const stream: StreamState = {
    id: streamId,
    content: "",
    finished: false,
    updatedAt: Date.now(),
  };
  runtime.streams.set(streamId, stream);
  const queue = runtime.peerQueues.get(peerId) ?? [];
  queue.push(streamId);
  runtime.peerQueues.set(peerId, queue);
  return stream;
}

function resolveStream(runtime: StreamRuntime, peerId: string): StreamState | null {
  const queue = runtime.peerQueues.get(peerId);
  if (!queue || queue.length === 0) return null;
  const streamId = queue[0];
  return runtime.streams.get(streamId) ?? null;
}

function markStreamFinished(runtime: StreamRuntime, peerId: string, streamId: string) {
  const stream = runtime.streams.get(streamId);
  if (!stream) return;
  stream.finished = true;
  stream.updatedAt = Date.now();
  const queue = runtime.peerQueues.get(peerId) ?? [];
  if (queue[0] === streamId) {
    queue.shift();
    runtime.peerQueues.set(peerId, queue);
  }
}

function scheduleStreamFinish(runtime: StreamRuntime, peerId: string, streamId: string) {
  const key = `${peerId}:${streamId}`;
  const existing = runtime.finishTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    runtime.finishTimers.delete(key);
    markStreamFinished(runtime, peerId, streamId);
  }, STREAM_IDLE_MS);
  runtime.finishTimers.set(key, timer);
}

function buildAiBotText(payload: any): string {
  const msgType = payload?.msgtype ?? "";
  if (msgType === "text") {
    return typeof payload?.text?.content === "string" ? payload.text.content : "";
  }
  if (msgType === "voice") {
    return typeof payload?.voice?.content === "string" ? payload.voice.content : "";
  }
  if (msgType === "image") {
    const url = typeof payload?.image?.url === "string" ? payload.image.url : "";
    return url ? `[image] ${url}` : "[image]";
  }
  if (msgType === "file") {
    const url = typeof payload?.file?.url === "string" ? payload.file.url : "";
    const name = typeof payload?.file?.name === "string" ? payload.file.name : "";
    return name || url ? `[file] ${name || url}` : "[file]";
  }
  if (msgType === "location") {
    const name = payload?.location?.name ?? payload?.location?.label;
    const lat = payload?.location?.latitude;
    const lon = payload?.location?.longitude;
    const prefix = name ? `[location] ${name}` : "[location]";
    return lat && lon ? `${prefix} (${lat}, ${lon})` : prefix;
  }
  if (msgType === "link") {
    const title = payload?.link?.title ?? "";
    const url = payload?.link?.url ?? "";
    if (title || url) return `[link] ${title || url}`;
    return "[link]";
  }
  if (msgType === "mixed") {
    const items = Array.isArray(payload?.mixed?.msg_item) ? payload.mixed.msg_item : [];
    const texts: string[] = [];
    for (const item of items) {
      if (item?.msgtype === "text" && item?.text?.content) {
        texts.push(String(item.text.content));
      }
      if (item?.msgtype === "image" && item?.image?.url) {
        texts.push(`[image] ${String(item.image.url)}`);
      }
    }
    return texts.join("\n");
  }
  return msgType ? `[wecom:${msgType}]` : "";
}

function parseWecomPeer(peerId: string): { kind: "user" | "group"; id: string } {
  const trimmed = peerId.trim();
  if (trimmed.startsWith("group:")) return { kind: "group", id: trimmed.slice("group:".length) };
  if (trimmed.startsWith("user:")) return { kind: "user", id: trimmed.slice("user:".length) };
  return { kind: "user", id: trimmed };
}

async function fetchWecomAccessToken(identity: WecomIdentity, log: Logger): Promise<string> {
  const corpId = identity.corpId?.trim() ?? "";
  const secret = identity.secret?.trim() ?? "";
  if (!corpId || !secret) {
    throw new Error("WeCom corpId and secret are required for app mode");
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`WeCom token request failed (${response.status})`);
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
  if (!data.access_token) {
    throw new Error(`WeCom token response invalid: ${data.errmsg ?? data.errcode ?? "unknown"}`);
  }
  const expiresAt = Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000;
  accessTokenCache.set(`${corpId}:${secret}`, { token: data.access_token, expiresAt });
  log.debug({ expiresIn: data.expires_in }, "wecom access token refreshed");
  return data.access_token;
}

async function getWecomAccessToken(identity: WecomIdentity, log: Logger): Promise<string> {
  const corpId = identity.corpId?.trim() ?? "";
  const secret = identity.secret?.trim() ?? "";
  if (corpId && secret) {
    const cacheKey = `${corpId}:${secret}`;
    const cached = accessTokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.token;
  }
  return fetchWecomAccessToken(identity, log);
}

async function sendWecomAppText(identity: WecomIdentity, peerId: string, text: string, log: Logger) {
  const agentId = identity.agentId?.trim() ?? "";
  if (!agentId) {
    throw new Error("WeCom agentId is required for app mode");
  }
  const peer = parseWecomPeer(peerId);
  if (peer.kind !== "user" || !peer.id) {
    throw new Error("WeCom app mode only supports direct user messages");
  }
  const accessToken = await getWecomAccessToken(identity, log);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      touser: peer.id,
      msgtype: "text",
      agentid: Number(agentId),
      text: { content: text },
      safe: 0,
    }),
  });
  const payload = (await response.json()) as { errcode?: number; errmsg?: string };
  if (!response.ok || payload?.errcode) {
    throw new Error(`WeCom send failed: ${payload?.errmsg ?? response.statusText}`);
  }
}

function registerTarget(target: WebhookTarget): () => void {
  const path = normalizeWebhookPath(target.identity.webhookPath ?? `/wecom/${target.identity.id}`);
  globalServer.targets.set(path, target);
  return () => {
    globalServer.targets.delete(path);
  };
}

export function createWecomAdapter(
  identity: WecomIdentity,
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
): WecomAdapter {
  const log = logger.child({ channel: "wecom", identityId: identity.id, mode: identity.mode });
  const runtime = identity.mode === "ai-bot" ? createRuntime() : undefined;
  let unregister: (() => void) | null = null;
  let started = false;

  return {
    name: "wecom",
    identityId: identity.id,
    maxTextLength: 15_000,
    async start() {
      if (started) return;
      const hasCallbackCreds = Boolean(identity.token?.trim() && identity.encodingAesKey?.trim());
      if (identity.mode === "ai-bot" && !hasCallbackCreds) {
        throw new Error("WeCom token and encodingAesKey are required for ai-bot mode");
      }
      if (hasCallbackCreds) {
        ensureServer(config, logger);
        unregister = registerTarget({ identity, config, log, onMessage, ...(runtime ? { runtime } : {}) });
      } else {
        unregister = null;
      }
      started = true;
      log.info("wecom adapter started");
    },
    async stop() {
      if (!started) return;
      unregister?.();
      unregister = null;
      started = false;
      log.info("wecom adapter stopped");
      if (globalServer.targets.size === 0 && globalServer.server) {
        globalServer.server.close();
        globalServer.server = null;
      }
    },
    async sendText(peerId: string, text: string) {
      if (identity.mode === "app") {
        await sendWecomAppText(identity, peerId, text, log);
        return;
      }
      if (!runtime) return;
      const stream = resolveStream(runtime, peerId);
      if (!stream) {
        const fallback = runtime.responseUrls.get(peerId);
        if (fallback && !fallback.used && Date.now() < fallback.expiresAt) {
          fallback.used = true;
          await fetch(fallback.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ msgtype: "text", text: { content: text } }),
          });
        }
        return;
      }

      const content = stream.content.trim() === THINKING_PLACEHOLDER.trim()
        ? text
        : stream.content.length
          ? `${stream.content}\n\n${text}`
          : text;
      stream.content = truncateStreamContent(content);
      stream.updatedAt = Date.now();
      scheduleStreamFinish(runtime, peerId, stream.id);
    },
  };
}
