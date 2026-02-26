// src/api/sessions.ts
// 会话相关API

import { api } from './client';
import { Message, Session } from '@/types';

interface CreateSessionRequest {
  title?: string;
  initialMessage?: string;
}

interface ListSessionsResponse {
  sessions: Session[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

interface ListMessagesResponse {
  messages: Message[];
  hasMore: boolean;
  cursor?: string;
}

interface SendMessageRequest {
  content: string;
}

// 获取会话列表
export async function listSessions(params?: {
  cursor?: string;
  limit?: number;
  status?: 'active' | 'archived';
}) {
  return api.get<ListSessionsResponse>('/sessions', { params });
}

// 创建会话
export async function createSession(data: CreateSessionRequest) {
  return api.post<Session>('/sessions', data);
}

// 获取会话详情
export async function getSession(sessionId: string) {
  return api.get<Session>(`/sessions/${sessionId}`);
}

// 更新会话
export async function updateSession(
  sessionId: string,
  data: { title?: string; status?: 'active' | 'archived' }
) {
  return api.patch<Session>(`/sessions/${sessionId}`, data);
}

// 删除会话
export async function deleteSession(sessionId: string) {
  return api.delete<void>(`/sessions/${sessionId}`);
}

// 获取会话消息
export async function listMessages(
  sessionId: string,
  params?: { cursor?: string; limit?: number }
) {
  return api.get<ListMessagesResponse>(`/sessions/${sessionId}/messages`, {
    params,
  });
}

// 发送消息
export async function sendMessage(sessionId: string, data: SendMessageRequest) {
  return api.post<Message>(`/sessions/${sessionId}/messages`, data);
}
