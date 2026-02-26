# Owpenbot Mobile - MVP功能清单

> **版本**: MVP Phase 1  
> **目标**: 验证核心假设，让专业开发者能在移动端获得基础可用的AI编程助手体验  
> **周期**: 10-12周  
> **团队**: 2-3名开发者

---

## 总体目标

### 产品目标
- 让专业开发者能在移动设备上与OpenCode进行基础交互
- 提供比社交软件Bot更好的代码展示体验
- 验证"移动端专业编程助手"的市场需求

### 技术目标
- 建立稳定的技术架构基础
- 实现核心数据流（认证→会话→消息→推送）
- 确保基础性能（启动<3s，消息发送<1s）

### 商业目标
- 获取10-20名种子用户
- 收集100+条有效反馈
- 验证付费意愿（为Phase 2决策提供依据）

---

## 功能模块总览

```
MVP功能矩阵（10-12周）

模块          功能数    周数    优先级
───────────────────────────────────────
基础设施       5项      3周     P0
后端API        4项      3周     P0
核心功能       5项      3周     P0
完善优化       4项      2-3周   P1
───────────────────────────────────────
总计          18项     10-12周
```

---

## 模块1: 基础设施（3周）

### 1.1 项目脚手架
**功能描述**: 搭建React Native项目基础框架

**验收标准**:
- [ ] 项目能在iOS模拟器和Android模拟器上运行
- [ ] TypeScript配置完善（无any类型）
- [ ] ESLint + Prettier配置完成
- [ ] 基础文件夹结构建立
- [ ] 开发/生产环境变量配置

**技术要点**:
```bash
# 初始化命令
npx react-native@latest init OwpenbotMobile --template react-native-template-typescript

# 或 Expo 方案（推荐快速验证）
npx create-expo-app OwpenbotMobile --template blank-typescript
```

**交付物**:
- 可运行的空项目
- README（开发环境搭建指南）
- 项目结构文档

**预计时间**: 3天

---

### 1.2 导航与路由
**功能描述**: 实现应用的基础导航系统

**验收标准**:
- [ ] 底部Tab导航（Workbench/Explorer/Settings）
- [ ] 栈导航（页面跳转、返回）
- [ ] 模态框（登录、设置）
- [ ] 深度链接支持（从外部打开特定会话）
- [ ] 导航状态持久化

**技术要点**:
```typescript
// 导航结构
NavigationContainer
├── AuthStack（未认证）
│   └── ServerConnectScreen
└── MainTab（已认证）
    ├── WorkbenchTab
    │   ├── SessionListScreen
    │   └── ChatScreen
    ├── ExplorerTab
    │   └── FileTreeScreen（Phase 2）
    └── SettingsTab
        ├── ProfileScreen
        └── SecurityScreen
```

**交付物**:
- 可导航的空页面框架
- 导航类型定义
- 路由守卫（未登录跳转登录）

**预计时间**: 3天

---

### 1.3 UI组件库
**功能描述**: 建立基础UI组件库，确保视觉一致性

**验收标准**:
- [ ] Button（主按钮、次按钮、文字按钮、加载状态）
- [ ] Input（普通输入、密码输入、搜索输入）
- [ ] Card（基础卡片、可点击卡片）
- [ ] List（列表项、分割线、空状态）
- [ ] Loading（加载指示器、骨架屏）
- [ ] Toast/Alert（消息提示）
- [ ] 暗色/亮色主题切换

**技术要点**:
```typescript
// 使用 react-native-paper 或自研
// 主题配置
const theme = {
  colors: {
    primary: '#3b82f6',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    // ...
  },
  dark: {
    colors: {
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f8fafc',
      // ...
    }
  }
};
```

**交付物**:
- 组件Storybook/展示页面
- 组件使用文档
- 主题配置

**预计时间**: 5天

---

### 1.4 本地存储与安全存储
**功能描述**: 实现数据持久化和敏感信息安全存储

**验收标准**:
- [ ] MMKV集成（高性能KV存储）
- [ ] Keychain/Keystore集成（敏感数据：token、密钥）
- [ ] SQLite集成（消息历史、会话列表）
- [ ] 存储加密（敏感字段）
- [ ] 存储迁移策略（版本升级时）

**技术要点**:
```typescript
// 存储分层
├── SecureStorage (react-native-keychain)
│   ├── authToken
│   ├── refreshToken
│   └── deviceKey
│
├── MMKV (react-native-mmkv)
│   ├── userPreferences
│   ├── theme
│   └── lastSyncTime
│
└── SQLite (react-native-sqlite-storage)
    ├── messages
    ├── sessions
    └── offlineQueue
```

**交付物**:
- 存储工具类封装
- 存储Schema定义
- 数据迁移脚本

**预计时间**: 4天

---

### 1.5 网络与API基础
**功能描述**: 建立HTTP客户端和错误处理机制

**验收标准**:
- [ ] Axios配置（baseURL、超时、重试）
- [ ] 请求/响应拦截器（Token自动附加）
- [ ] 错误处理（网络错误、API错误、业务错误）
- [ ] 加载状态管理
- [ ] 请求取消机制

**技术要点**:
```typescript
// api/client.ts
const apiClient = axios.create({
  baseURL: '', // 动态配置
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 拦截器
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 错误分类
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',      // 无网络
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',      // 超时
  AUTH_ERROR = 'AUTH_ERROR',            // 401
  SERVER_ERROR = 'SERVER_ERROR',        // 5xx
  VALIDATION_ERROR = 'VALIDATION_ERROR', // 400
}
```

**交付物**:
- API客户端封装
- 错误处理工具
- API类型定义

**预计时间**: 3天

---

## 模块2: 后端API（3周，可与前端并行）

### 2.1 设备注册与认证API
**功能描述**: 实现设备注册、登录、Token刷新

**API端点**:
```typescript
// POST /mobile/v1/devices/register
interface RegisterDeviceRequest {
  deviceName: string;           // "iPhone 15 Pro"
  deviceType: 'ios' | 'android';
  publicKey: string;            // 用于E2E加密（预留）
}

interface RegisterDeviceResponse {
  deviceId: string;
  deviceToken: string;          // JWT
  refreshToken: string;
  expiresAt: number;
}

// POST /mobile/v1/auth/refresh
// DELETE /mobile/v1/devices/:deviceId (注销)
// GET /mobile/v1/devices (列出设备)
```

**验收标准**:
- [ ] 设备注册接口
- [ ] Token生成与验证（JWT）
- [ ] Token刷新机制
- [ ] 设备注销
- [ ] 多设备管理（查看已登录设备）

**数据模型**:
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('ios', 'android')),
  public_key TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at INTEGER,
  last_active_at INTEGER
);
```

**预计时间**: 5天

---

### 2.2 会话管理API
**功能描述**: 会话的CRUD操作

**API端点**:
```typescript
// GET /mobile/v1/sessions
interface ListSessionsResponse {
  sessions: Session[];
  total: number;
}

// POST /mobile/v1/sessions
interface CreateSessionRequest {
  title?: string;
  initialMessage?: string;
}

// GET /mobile/v1/sessions/:sessionId/messages
interface GetMessagesRequest {
  cursor?: string;    // 分页游标
  limit?: number;     // 默认20
}

// DELETE /mobile/v1/sessions/:sessionId
// PATCH /mobile/v1/sessions/:sessionId (更新标题)
```

**验收标准**:
- [ ] 会话列表（分页）
- [ ] 创建会话
- [ ] 获取会话消息（分页、增量同步）
- [ ] 删除会话
- [ ] 更新会话信息

**数据模型**:
```sql
CREATE TABLE mobile_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  title TEXT,
  opencode_session_id TEXT,  -- 关联OpenCode会话
  status TEXT CHECK(status IN ('active', 'archived')),
  created_at INTEGER,
  updated_at INTEGER,
  last_message_at INTEGER
);

CREATE TABLE mobile_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata TEXT,  -- JSON: 模型、工具调用等
  created_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES mobile_sessions(id)
);
```

**预计时间**: 5天

---

### 2.3 WebSocket实时通信
**功能描述**: WebSocket网关，支持实时消息推送

**API端点**:
```
WS /mobile/v1/realtime?token={deviceToken}
```

**消息协议**:
```typescript
interface WebSocketMessage {
  type: 'message' | 'typing' | 'error' | 'ping' | 'pong';
  payload: unknown;
  timestamp: number;
}

// 服务器 → 客户端
interface ServerMessage {
  type: 'message';
  payload: {
    sessionId: string;
    messageId: string;
    role: 'assistant';
    content: string;
    // 流式更新时可能部分字段为空
  };
}

interface TypingIndicator {
  type: 'typing';
  payload: {
    sessionId: string;
    isTyping: boolean;
  };
}

// 客户端 → 服务器
interface ClientMessage {
  type: 'subscribe';
  payload: {
    sessionIds: string[];
  };
}
```

**验收标准**:
- [ ] WebSocket连接建立
- [ ] 心跳机制（ping/pong）
- [ ] 自动重连（指数退避）
- [ ] 消息订阅（订阅特定会话）
- [ ] 错误处理与降级（降级到HTTP轮询）

**技术要点**:
```typescript
// 重连策略
class WebSocketManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000; // 1秒

  private getReconnectDelay(): number {
    // 指数退避: 1s, 2s, 4s, 8s... 最大30s
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    return delay;
  }
}
```

**预计时间**: 7天

---

### 2.4 推送通知服务
**功能描述**: 集成FCM（Android）和APNs（iOS）

**功能点**:
- [ ] FCM集成（Android）
- [ ] APNs集成（iOS）
- [ ] 推送Token管理
- [ ] 富媒体推送（标题+正文+数据）
- [ ] 推送统计（送达率、打开率）

**推送场景**:
```typescript
enum PushScenario {
  NEW_MESSAGE = 'new_message',           // 新消息
  SESSION_COMPLETE = 'session_complete', // 会话完成
  PERMISSION_REQUEST = 'permission_request', // 权限请求
  SYSTEM_NOTICE = 'system_notice',       // 系统通知
}

interface PushPayload {
  title: string;
  body: string;
  data: {
    type: PushScenario;
    sessionId?: string;
    messageId?: string;
    actionUrl?: string;  // 深度链接
  };
}
```

**预计时间**: 4天

---

## 模块3: 核心功能（3周）

### 3.1 服务器连接与认证
**功能描述**: 用户首次打开应用，连接到自己的owpenbot服务器

**UI流程**:
```
启动 → 检查是否有服务器配置？
  ├─ 是 → 自动连接 → 检查Token有效性？
  │         ├─ 有效 → 进入主界面
  │         └─ 过期 → 刷新Token → 成功 → 进入主界面
  │                    └─ 失败 → 重新登录
  └─ 否 → 显示服务器连接页面 → 输入服务器地址 → 验证连接
            ↓
         显示配对码/扫码 → 完成配对 → 进入主界面
```

**验收标准**:
- [ ] 服务器地址输入（URL验证）
- [ ] 连接状态检测（ping/pong）
- [ ] 设备配对流程
- [ ] Token自动刷新
- [ ] 生物识别设置引导（Face ID/Touch ID）
- [ ] 错误处理（连接失败、服务器不可达）

**UI设计**:
```
┌─────────────────────────────────────────┐
│                                         │
│         [OpenWork Logo]                 │
│                                         │
│      连接到你的OpenWork服务器           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ https://your-server.com           │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  验证连接                         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [🔗 如何找到服务器地址？]              │
│                                         │
└─────────────────────────────────────────┘
```

**技术要点**:
```typescript
// 服务器连接验证
async function validateServer(url: string): Promise<ValidationResult> {
  try {
    const response = await fetch(`${url}/health`);
    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        version: data.version,
        features: data.features, // 支持哪些功能
      };
    }
    return { valid: false, error: '服务器响应异常' };
  } catch (error) {
    return { valid: false, error: '无法连接到服务器' };
  }
}
```

**预计时间**: 5天

---

### 3.2 会话列表管理
**功能描述**: 显示所有会话，支持创建、删除、搜索

**验收标准**:
- [ ] 会话列表（倒序，最新的在上面）
- [ ] 会话卡片（标题、最后消息预览、时间、未读数）
- [ ] 下拉刷新
- [ ] 上拉加载更多
- [ ] 创建新会话（+按钮）
- [ ] 删除会话（左滑删除）
- [ ] 搜索会话（标题搜索）
- [ ] 空状态（首次使用引导）

**UI设计**:
```
┌─────────────────────────────────────────┐
│ 工作台                          [+]     │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 搜索会话...                      │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 优化Button组件性能                  │ │
│ │ 已应用React.memo优化...        2分钟 │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Code Review: PR #234                │ │
│ │ 这个PR看起来不错，建议合并...   1小时 │ │
│ │                              [未读3] │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Bug修复讨论                         │ │
│ │ 问题已定位，是race condition...  昨天 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+] 新建会话                            │
└─────────────────────────────────────────┘
```

**技术要点**:
```typescript
// 会话列表状态管理
interface SessionListState {
  sessions: Session[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  cursor?: string;
  searchQuery: string;
}

// 虚拟列表优化（大量会话时）
import { FlashList } from "@shopify/flash-list";

<FlashList
  data={sessions}
  renderItem={renderSessionItem}
  estimatedItemSize={80}
  onEndReached={loadMore}
  refreshControl={
    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
  }
/>
```

**预计时间**: 4天

---

### 3.3 聊天界面
**功能描述**: 核心聊天功能，支持消息收发、Markdown、代码块

**验收标准**:
- [ ] 消息气泡（用户右对齐，助手左对齐）
- [ ] 消息时间戳
- [ ] 消息状态（发送中、已发送、失败）
- [ ] 文本消息（支持Markdown）
- [ ] 代码块（语法高亮）
- [ ] 输入框（多行、自动增高）
- [ ] 发送按钮（发送中显示loading）
- [ ] 下拉加载历史消息
- [ ] 新消息自动滚动
- [ ] 消息复制（长按菜单）
- [ ] 空状态引导

**UI设计**:
```
┌─────────────────────────────────────────┐
│ ◀ 优化Button组件              [⋮]       │
├─────────────────────────────────────────┤
│                                         │
│ [系统] 已同步桌面端上下文               │
│ 当前文件: src/components/Button.tsx     │
│                                         │
│     ┌───────────────────────────────┐   │
│     │ 帮我优化这个按钮组件的性能    │   │
│     │                               │   │
│     │ 当前文件: Button.tsx          │   │
│     │ 21:32 ✓                       │   │
│     └───────────────────────────────┘   │
│                                         │
│ ┌───────────────────────────────┐       │
│ │ 🤖 好的，我来分析这个Button组 │       │
│ │ 件...                         │       │
│ │                               │       │
│ │ 主要问题:                     │       │
│ │ 1. 每次渲染都创建新函数       │       │
│ │ 2. 缺少shouldComponentUpdate  │       │
│ │                               │       │
│ │ [查看代码优化]                │       │
│ │ 21:33                         │       │
│ └───────────────────────────────┘       │
│                                         │
├─────────────────────────────────────────┤
│ [📎] [🎤]                             [▶]│
│ 输入消息...                             │
└─────────────────────────────────────────┘
```

**技术要点**:
```typescript
// 聊天组件选择
// 方案1: react-native-gifted-chat（功能完整，定制复杂）
// 方案2: 自研（MVP推荐，更轻量）

// Markdown + 代码高亮
import Markdown from 'react-native-markdown-display';
import SyntaxHighlighter from 'react-native-syntax-highlighter';

const markdownStyles = {
  code_block: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontFamily: 'JetBrainsMono-Regular',
  },
  code_inline: {
    backgroundColor: '#f1f5f9',
    padding: 2,
    borderRadius: 4,
    fontFamily: 'JetBrainsMono-Regular',
  },
};
```

**预计时间**: 7天

---

### 3.4 代码高亮与展示
**功能描述**: 美观的代码展示，支持语法高亮和基础交互

**验收标准**:
- [ ] 语法高亮（支持Top 10语言）
- [ ] 行号显示（可选）
- [ ] 代码复制（一键复制按钮）
- [ ] 代码折叠（长代码折叠）
- [ ] 文件名显示
- [ ] 语言标识
- [ ] 暗色/亮色主题适配

**支持语言**（MVP阶段）:
- TypeScript/JavaScript
- Python
- Go
- Rust
- Java
- C/C++
- HTML/CSS
- JSON/YAML
- Markdown
- Shell/Bash

**UI设计**:
```
┌─────────────────────────────────────────┐
│ src/components/Button.tsx    [📋]       │
├─────────────────────────────────────────┤
│  1  import React, { memo, useCallback } │
│  2  from 'react';                       │
│  3                                      │
│  4  interface ButtonProps {             │
│  5    onClick: () => void;              │
│  6    label: string;                    │
│  7  }                                   │
│  8                                      │
│  9  export const Button = memo(<ButtonProps>│
│ 10    ({ onClick, label }) => {         │
│ 11    const handleClick = useCallback(()=>│
│ 12      onClick();                      │
│ 13    }, [onClick]);                    │
│ 14                                      │
│ 15    return (                          │
│ 16      <button onClick={handleClick}>  │
│ 17        {label}                       │
│ 18      </button>                       │
│ 19    );                                │
│ 20  });                                 │
│     [展开更多...]                       │
└─────────────────────────────────────────┘
```

**技术要点**:
```typescript
// 代码高亮库选择
// 方案1: react-native-syntax-highlighter（基于prismjs）
// 方案2: react-native-highlight-underline-text（轻量）
// MVP推荐方案1

import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { vs2015 } from 'react-syntax-highlighter/styles/hljs';

<SyntaxHighlighter
  language="typescript"
  style={isDarkMode ? vs2015 : docco}
  showLineNumbers={true}
  lineNumberStyle={{ color: '#64748b' }}
>
  {code}
</SyntaxHighlighter>
```

**预计时间**: 4天

---

### 3.5 消息推送与离线支持
**功能描述**: 推送通知+离线消息队列

**验收标准**:
- [ ] 推送Token注册（FCM/APNs）
- [ ] 新消息推送（标题+正文+会话ID）
- [ ] 点击推送进入对应会话
- [ ] 离线消息检测（网络恢复时）
- [ ] 离线消息队列（发送失败自动重试）
- [ ] 消息发送状态显示（发送中、已发送、失败重试）
- [ ] 网络状态提示（顶部Toast提示）

**离线队列策略**:
```typescript
interface OfflineMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'sending' | 'failed';
}

class OfflineQueue {
  async enqueue(message: Omit<OfflineMessage, 'id' | 'status' | 'retryCount'>): Promise<void> {
    // 存入SQLite
    await db.insert({
      ...message,
      id: generateUUID(),
      status: 'pending',
      retryCount: 0,
    });
    
    // 如果在线，立即尝试发送
    if (network.isOnline) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    const pending = await db.getPendingMessages();
    
    for (const message of pending) {
      try {
        await api.sendMessage(message);
        await db.delete(message.id);
      } catch (error) {
        if (message.retryCount < message.maxRetries) {
          await db.incrementRetry(message.id);
          // 指数退避重试
          setTimeout(() => this.processQueue(), Math.pow(2, message.retryCount) * 1000);
        } else {
          await db.markAsFailed(message.id);
        }
      }
    }
  }
}
```

**预计时间**: 5天

---

## 模块4: 完善与优化（2-3周）

### 4.1 性能优化
**功能描述**: 确保流畅的用户体验

**优化项**:
- [ ] 启动时间优化（<3秒）
  - 代码分割（Code Splitting）
  - 懒加载（Lazy Loading）
  - 启动屏优化
- [ ] 列表性能优化（<60fps）
  - 使用FlashList替代FlatList
  - 图片懒加载
  - 组件memoization
- [ ] 内存优化
  - 大图片压缩
  - 消息历史分页加载
  - 缓存清理策略

**技术指标**:
```
启动时间: < 3秒
列表滚动: 60fps
内存占用: < 150MB（正常使用）
APK大小: < 50MB
```

**预计时间**: 4天

---

### 4.2 错误处理与监控
**功能描述**: 完善的错误处理和基础监控

**功能点**:
- [ ] 全局错误边界（React Error Boundary）
- [ ] 网络错误提示（友好的错误信息）
- [ ] 崩溃报告（Sentry集成）
- [ ] 性能监控（启动时间、页面加载时间）
- [ ] 用户行为埋点（核心流程）

**错误分类处理**:
```typescript
enum AppError {
  NETWORK_ERROR = '网络连接失败，请检查网络设置',
  AUTH_ERROR = '登录已过期，请重新登录',
  SERVER_ERROR = '服务器繁忙，请稍后再试',
  VALIDATION_ERROR = '输入格式不正确',
  UNKNOWN_ERROR = '发生未知错误，请重试',
}

// 全局错误处理
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Sentry.captureException(error);
  
  if (isFatal) {
    // 显示崩溃提示，建议重启
    Alert.alert(
      '应用发生错误',
      '请重启应用。如果问题持续，请联系支持。',
      [{ text: '重启', onPress: () => RNRestart.Restart() }]
    );
  }
});
```

**预计时间**: 3天

---

### 4.3 测试覆盖
**功能描述**: 基础测试覆盖

**测试项**:
- [ ] 单元测试（Jest）
  - 工具函数测试
  - API客户端测试
  - 状态管理测试
- [ ] 集成测试（React Native Testing Library）
  - 关键页面渲染测试
  - 用户交互流程测试
- [ ] E2E测试（Maestro或Detox）
  - 登录流程
  - 发送消息流程
- [ ] 手动测试清单
  - iOS设备（iPhone 12+）
  - Android设备（Android 10+）
  - 不同网络环境（WiFi/4G/弱网）

**预计时间**: 4天

---

### 4.4 发布准备
**功能描述**: 应用商店上架准备

**准备项**:
- [ ] 应用图标（iOS + Android）
- [ ] 启动屏（Splash Screen）
- [ ] 应用截图（5张/平台）
- [ ] 应用描述（中文+英文）
- [ ] 隐私政策页面
- [ ] 用户协议
- [ ] 测试账号（审核用）
- [ ] 构建配置（Release模式）

**构建检查清单**:
```bash
# iOS
✅ Bundle Identifier设置
✅ 版本号（CFBundleShortVersionString）
✅ Build号（CFBundleVersion）
✅ 签名证书（Distribution）
✅ 启动屏（LaunchScreen.storyboard）
✅ App图标（所有尺寸）
✅ 权限描述（相机、麦克风等，如需要）

# Android
✅ Application ID
✅ Version Code
✅ Version Name
✅ 签名密钥（Release Keystore）
✅ 启动屏（Splash Screen API）
✅ 自适应图标（Adaptive Icon）
✅ ProGuard/R8配置（代码混淆）
```

**预计时间**: 3天

---

## 开发排期表

### 人员配置
- **前端开发**: 2人
- **后端开发**: 1人（可与前端并行）
- **UI/UX设计**: 1人（兼职，前期介入）
- **产品经理**: 1人（兼职）

### 详细排期

| 周次 | 前端任务 | 后端任务 | 产出 |
|------|---------|---------|------|
| **W1** | 项目脚手架、导航 | API设计、数据库设计 | 可运行空项目 |
| **W2** | UI组件库 | 设备管理API | 组件库Demo |
| **W3** | 存储、网络层 | 会话管理API | 基础架构完成 |
| **W4** | 服务器连接UI | WebSocket网关 | 登录流程可跑通 |
| **W5** | 会话列表 | 推送服务集成 | 会话列表可展示 |
| **W6** | 聊天界面 | 消息同步逻辑 | 可收发消息 |
| **W7** | 代码高亮 | 离线队列 | 代码展示优化 |
| **W8** | 推送客户端 | API联调 | 推送功能可用 |
| **W9** | 离线支持 | 性能优化 | 离线功能完成 |
| **W10** | 性能优化 | 监控集成 | 性能达标 |
| **W11** | 测试覆盖 | Bug修复 | 测试报告 |
| **W12** | 发布准备 | 文档完善 | 上架审核 |

---

## 验收标准汇总

### 功能验收
- [ ] 用户能成功连接服务器并完成设备配对
- [ ] 用户能创建新会话
- [ ] 用户能收发文本消息
- [ ] 代码块能正确高亮显示
- [ ] 用户能复制代码
- [ ] 新消息能推送通知
- [ ] 离线消息能在网络恢复后自动发送
- [ ] 生物识别能正常解锁

### 性能验收
- [ ] 冷启动时间 < 3秒
- [ ] 消息发送延迟 < 1秒
- [ ] 列表滚动流畅（60fps）
- [ ] 应用包大小 < 50MB
- [ ] 内存占用 < 150MB

### 质量验收
- [ ] 崩溃率 < 1%
- [ ] 核心流程测试覆盖率 > 60%
- [ ] 无P0/P1级Bug
- [ ] 通过iOS和Android审核

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **React Native环境问题** | 高 | 高 | 使用Expo简化环境搭建 |
| **WebSocket不稳定** | 中 | 高 | 实现自动重连+降级策略 |
| **性能不达标** | 中 | 中 | 使用FlashList，及时性能测试 |
| **后端API延迟** | 低 | 高 | 前后端并行开发，API先行 |
| **审核被拒** | 中 | 中 | 提前了解审核指南，准备测试账号 |

---

## 附录

### A. 技术选型对比

| 方案 | 优点 | 缺点 | MVP建议 |
|------|------|------|---------|
| **Expo** | 快速开发、OTA更新 | 原生模块受限 | ✅ **推荐** |
| **Bare RN** | 完全控制 | 配置复杂 | Phase 2考虑 |
| **Flutter** | 性能更好 | 学习成本 | 不适用 |

### B. 第三方库清单

```json
{
  "dependencies": {
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@react-navigation/native-stack": "^6.9.17",
    "react-native-mmkv": "^2.11.0",
    "react-native-keychain": "^8.1.2",
    "react-native-sqlite-storage": "^6.0.1",
    "axios": "^1.6.2",
    "zustand": "^4.4.7",
    "@tanstack/react-query": "^5.13.4",
    "react-native-markdown-display": "^7.1.6",
    "react-native-syntax-highlighter": "^2.1.0",
    "@react-native-firebase/app": "^18.7.3",
    "@react-native-firebase/messaging": "^18.7.3",
    "react-native-biometrics": "^3.0.3",
    "@sentry/react-native": "^5.15.1"
  }
}
```

### C. 开发环境要求

- Node.js 18+
- React Native CLI 或 Expo CLI
- Xcode 15+ (Mac)
- Android Studio Hedgehog+
- CocoaPods (iOS)
- 模拟器/真机（iPhone 12+, Android 10+）

---

**文档版本**: 1.0  
**更新日期**: 2025年2月  
**下次评审**: W6结束时
