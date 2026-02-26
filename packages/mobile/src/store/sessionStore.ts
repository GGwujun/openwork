// src/store/sessionStore.ts
// 会话状态管理

import { create } from 'zustand';
import { Session, Message } from '@/types';
import * as sessionApi from '@/api/sessions';

interface SessionState {
  // 状态
  sessions: Session[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  cursor?: string;
  error: string | null;

  // 动作
  fetchSessions: () => Promise<void>;
  fetchMoreSessions: () => Promise<void>;
  createSession: (title?: string, initialMessage?: string) => Promise<Session | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  setCurrentSession: (sessionId: string | null) => void;
  fetchMessages: (sessionId: string) => Promise<void>;
  fetchMoreMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  // 初始状态
  sessions: [],
  currentSessionId: null,
  messages: {},
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  cursor: undefined,
  error: null,

  // 获取会话列表
  fetchSessions: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await sessionApi.listSessions({ limit: 20 });

      if (response.success) {
        set({
          sessions: response.data!.sessions,
          hasMore: response.data!.hasMore,
          cursor: response.data!.cursor,
          isLoading: false,
        });
      } else {
        set({
          error: response.error?.message || '获取会话失败',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取会话失败',
        isLoading: false,
      });
    }
  },

  // 加载更多会话
  fetchMoreSessions: async () => {
    const { cursor, isLoadingMore, hasMore } = get();

    if (!cursor || isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });

    try {
      const response = await sessionApi.listSessions({
        cursor,
        limit: 20,
      });

      if (response.success) {
        set((state) => ({
          sessions: [...state.sessions, ...response.data!.sessions],
          hasMore: response.data!.hasMore,
          cursor: response.data!.cursor,
          isLoadingMore: false,
        }));
      } else {
        set({ isLoadingMore: false });
      }
    } catch {
      set({ isLoadingMore: false });
    }
  },

  // 创建会话
  createSession: async (title?: string, initialMessage?: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await sessionApi.createSession({
        title,
        initialMessage,
      });

      if (response.success) {
        const session = response.data!;
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
          isLoading: false,
        }));
        return session;
      } else {
        set({
          error: response.error?.message || '创建会话失败',
          isLoading: false,
        });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '创建会话失败',
        isLoading: false,
      });
      return null;
    }
  },

  // 删除会话
  deleteSession: async (sessionId: string) => {
    try {
      const response = await sessionApi.deleteSession(sessionId);

      if (response.success) {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          messages: {
            ...state.messages,
            [sessionId]: undefined,
          },
          currentSessionId:
            state.currentSessionId === sessionId
              ? null
              : state.currentSessionId,
        }));
      }
    } catch {
      // 忽略错误
    }
  },

  // 设置当前会话
  setCurrentSession: (sessionId: string | null) => {
    set({ currentSessionId: sessionId });
  },

  // 获取消息
  fetchMessages: async (sessionId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await sessionApi.listMessages(sessionId, { limit: 50 });

      if (response.success) {
        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: response.data!.messages,
          },
          hasMore: response.data!.hasMore,
          cursor: response.data!.cursor,
          isLoading: false,
        }));
      } else {
        set({
          error: response.error?.message || '获取消息失败',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取消息失败',
        isLoading: false,
      });
    }
  },

  // 加载更多消息
  fetchMoreMessages: async (sessionId: string) => {
    const { cursor, isLoadingMore, hasMore } = get();

    if (!cursor || isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });

    try {
      const response = await sessionApi.listMessages(sessionId, {
        cursor,
        limit: 50,
      });

      if (response.success) {
        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: [
              ...(response.data!.messages || []),
              ...(state.messages[sessionId] || []),
            ],
          },
          hasMore: response.data!.hasMore,
          cursor: response.data!.cursor,
          isLoadingMore: false,
        }));
      } else {
        set({ isLoadingMore: false });
      }
    } catch {
      set({ isLoadingMore: false });
    }
  },

  // 发送消息
  sendMessage: async (sessionId: string, content: string) => {
    // 乐观更新：先添加到本地
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), tempMessage],
      },
    }));

    try {
      const response = await sessionApi.sendMessage(sessionId, { content });

      if (response.success) {
        // 替换临时消息
        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: state.messages[sessionId].map((m) =>
              m.id === tempMessage.id ? { ...response.data!, status: 'sent' as const } : m
            ),
          },
        }));
      } else {
        // 标记为失败
        set((state) => ({
          messages: {
            ...state.messages,
            [sessionId]: state.messages[sessionId].map((m) =>
              m.id === tempMessage.id ? { ...m, status: 'error' as const } : m
            ),
          },
        }));
      }
    } catch {
      // 标记为失败
      set((state) => ({
        messages: {
          ...state.messages,
          [sessionId]: state.messages[sessionId].map((m) =>
            m.id === tempMessage.id ? { ...m, status: 'error' as const } : m
          ),
        },
      }));
    }
  },

  // 添加消息（用于WebSocket接收）
  addMessage: (sessionId: string, message: Message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] || []), message],
      },
    }));
  },

  // 更新消息
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: state.messages[sessionId]?.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ) || [],
      },
    }));
  },

  // 清除错误
  clearError: () => set({ error: null }),
}));
