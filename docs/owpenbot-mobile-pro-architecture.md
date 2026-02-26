# Owpenbot Mobile - 专业开发者/企业版技术方案

> **产品定位**: 面向专业开发者和企业团队的AI编程助手移动应用  
> **核心价值**: 从"聊天机器人"进化为"专业开发工具的移动端延伸"

---

## 1. 产品战略定位

### 1.1 用户画像

#### 核心用户 - 专业开发者
```
身份: 资深工程师、Tech Lead、架构师
场景: 
  - 通勤路上Review代码/PR
  - 会议间隙快速处理紧急任务
  - 出差时远程协作开发
痛点:
  - 无法在移动端获得IDE级别的体验
  - 社交软件的消息格式无法展示代码结构
  - 缺乏上下文感知（不知道当前在看哪个文件）
需求:
  - 代码Diff可视化
  - 文件树导航
  - 会话与代码库状态同步
```

#### 次要用户 - 企业团队管理者
```
身份: 工程经理、CTO、技术VP
场景:
  - 监控团队AI工具使用情况
  - 审批敏感操作（权限管理）
  - 查看项目进度摘要
痛点:
  - 无法管控数据安全
  - 缺乏审计日志
  - 团队配置分散
需求:
  - 企业级SSO
  - 细粒度权限控制
  - 集中式配置管理
```

### 1.2 价值主张

#### 对比社交软件方案

| 维度 | Telegram Bot | Slack Bot | **OpenWork Mobile** |
|------|--------------|-----------|---------------------|
| **代码展示** | 纯文本代码块 | 代码片段 | **语法高亮+折叠+复制+跳转到IDE** |
| **Diff查看** | ❌ 不支持 | ❌ 不支持 | **✅ 行内Diff+评论** |
| **文件浏览** | ❌ 不支持 | ❌ 不支持 | **✅ 文件树+代码预览** |
| **上下文感知** | ❌ 无 | ⚠️ 有限 | **✅ 当前打开文件、Git状态** |
| **企业管控** | ❌ 无 | ⚠️ Slack管理 | **✅ 审计日志+权限矩阵+SSO** |
| **离线能力** | ❌ 依赖网络 | ❌ 依赖网络 | **✅ 消息队列+本地缓存** |
| **推送深度** | 纯文本通知 | 基础通知 | **✅ 富媒体通知（代码片段预览）** |

---

## 2. 技术架构（企业级）

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           客户端层 (Mobile)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      React Native 0.73+                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │   Chat UI    │ │  Code Viewer │ │  File Tree   │ │  Session Mgr │ │   │
│  │  │  (Gifted)    │ │ (Monaco-ish) │ │  (Virtual)   │ │  (Zustand)   │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  │                                                                       │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │   Diff View  │ │  Settings    │ │  Admin Panel │ │  Audit Logs  │ │   │
│  │  │  (Inline)    │ │  (Secure)    │ │  (RBAC)      │ │  (Filter)    │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────┐     │
│  │                        Services Layer                              │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐│     │
│  │  │ Sync Engine  │ │  Offline DB  │ │ Push Handler │ │ Biometric   ││     │
│  │  │ (WorkQueue)  │ │  (SQLite)    │ │  (FCM/APNs)  │ │ Auth        ││     │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘│     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │     │
│  │  │ Encryption   │ │ File Cache   │ │ Context Sync │                │     │
│  │  │ (Keychain)   │ │ (Secure)     │ │ (IDE Bridge) │                │     │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTPS/WSS
                                   │ mTLS (企业版)
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                           网关层 (API Gateway)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Owpenbot Server (Enhanced)                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │ Mobile API   │ │  WebSocket   │ │ Push Gateway │ │ Rate Limit   │ │   │
│  │  │  (REST)      │ │  Gateway     │ │  (FCM/APNs)  │ │  (Redis)     │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                   │   │
│  │  │ Device Mgr   │ │ Session Mgr  │ │ Audit Logger │                   │   │
│  │  │ (Register)   │ │ (Mobile)     │ │  (ELK)       │                   │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                          核心服务层 (OpenCode)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      OpenCode Server                                 │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │ Session API  │ │  SSE Events  │ │ Permission   │ │ Tool Exec    │ │   │
│  │  │              │ │              │ │   API        │ │   API        │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心技术选型

#### 前端技术栈
| 层级 | 技术 | 选择理由 |
|------|------|---------|
| **框架** | React Native 0.73+ | 跨平台、团队熟悉、企业级生态 |
| **导航** | React Navigation 6 | 原生导航体验、深度链接支持 |
| **状态** | Zustand + React Query | 轻量、TypeScript友好、离线支持 |
| **UI组件** | 自研 + react-native-paper | 企业级设计系统、暗色模式 |
| **代码展示** | react-native-syntax-highlighter | 代码高亮、多语言支持 |
| **Diff** | 自研 (基于react-native-markdown) | 行内Diff、评论支持 |
| **图表** | react-native-svg | 自定义图表、性能可控 |
| **存储** | react-native-mmkv + SQLite | 加密存储、高性能KV |
| **推送** | @react-native-firebase/messaging | FCM集成、富媒体通知 |
| **安全** | react-native-keychain | 系统级安全存储 |
| **生物识别** | @react-native-biometrics | Face ID/Touch ID |

#### 后端增强（owpenbot改造）
```typescript
// 新增企业级模块

// 1. 设备管理模块
interface DeviceManager {
  register(device: DeviceInfo): Promise<DeviceToken>;
  verify(deviceId: string, token: string): Promise<boolean>;
  revoke(deviceId: string): Promise<void>;
  listDevices(userId: string): Promise<Device[]>;
}

// 2. 会话管理模块（移动端专用）
interface MobileSessionManager {
  createSession(userId: string, context: Context): Promise<Session>;
  syncSession(sessionId: string, deviceId: string): Promise<void>;
  getSessionHistory(userId: string, options: QueryOptions): Promise<Message[]>;
  archiveSession(sessionId: string): Promise<void>;
}

// 3. 审计日志模块
interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
  query(filters: AuditFilters): Promise<AuditLog[]>;
  export(startDate: Date, endDate: Date): Promise<Stream>;
}

// 4. 推送网关
interface PushGateway {
  send(deviceToken: string, notification: RichNotification): Promise<void>;
  batchSend(tokens: string[], notification: Notification): Promise<BatchResult>;
}
```

---

## 3. 核心功能设计

### 3.1 功能矩阵

#### Phase 1: 基础专业版 (MVP)
| 功能模块 | 功能点 | 优先级 | 说明 |
|---------|-------|-------|------|
| **认证** | 设备配对 | P0 | 扫码/手动输入服务器地址 |
| | 生物识别 | P1 | Face ID/Touch ID解锁 |
| | Token刷新 | P0 | 后台自动刷新 |
| **聊天** | 消息收发 | P0 | 支持Markdown、代码块 |
| | 会话管理 | P0 | 创建、重命名、删除 |
| | 消息搜索 | P1 | 全文搜索 |
| **代码** | 语法高亮 | P0 | 支持20+语言 |
| | 代码折叠 | P1 | 长代码折叠 |
| | 复制代码 | P0 | 一键复制 |
| **推送** | 消息推送 | P0 | 新消息通知 |
| | 富媒体通知 | P1 | 代码片段预览 |
| **离线** | 消息队列 | P1 | 离线消息自动重发 |
| | 本地缓存 | P1 | 最近消息缓存 |

#### Phase 2: 高级专业版
| 功能模块 | 功能点 | 优先级 | 说明 |
|---------|-------|-------|------|
| **代码** | Diff查看 | P0 | 行内Diff、对比模式 |
| | 文件树 | P0 | 项目文件树浏览 |
| | 代码跳转 | P1 | 跳转到IDE（深度链接）|
| **会话** | 上下文同步 | P0 | 同步桌面端打开的会话 |
| | 多工作空间 | P0 | 切换不同项目 |
| | 会话标签 | P1 | 给会话打标签 |
| **工具** | 工具状态可视化 | P0 | 实时显示工具执行进度 |
| | 工具结果查看 | P0 | 查看工具输出 |
| | 工具重试 | P1 | 失败工具重试 |
| **管理** | 审计日志查看 | P1 | 查看操作历史 |
| | 权限申请 | P1 | 移动端响应权限请求 |

#### Phase 3: 企业版
| 功能模块 | 功能点 | 优先级 | 说明 |
|---------|-------|-------|------|
| **认证** | SSO集成 | P0 | SAML/OIDC |
| | 多因素认证 | P1 | MFA支持 |
| | 设备策略 | P1 | 企业设备管理 |
| **管理** | 团队管理 | P0 | 邀请成员、角色分配 |
| | 配置下发 | P0 | 集中式配置 |
| | 审计导出 | P1 | 导出审计日志 |
| **安全** | 数据加密 | P0 | 端到端加密 |
| | 远程擦除 | P1 | 设备丢失时擦除数据 |
| | 合规报告 | P2 | SOC2/ISO27001报告 |

---

### 3.2 核心界面设计

#### 主界面架构
```
App
├── AuthStack（未认证）
│   ├── ServerConnectScreen（服务器连接）
│   └── BiometricSetupScreen（生物识别设置）
│
└── MainTab（已认证）
    ├── WorkbenchTab（工作台）
    │   ├── SessionListScreen（会话列表）
    │   ├── ChatScreen（聊天界面）
    │   ├── CodeViewerScreen（代码查看）
    │   └── DiffViewerScreen（Diff查看）
    │
    ├── ExplorerTab（资源管理器）
    │   ├── FileTreeScreen（文件树）
    │   ├── WorkspaceListScreen（工作空间列表）
    │   └── ToolStatusScreen（工具状态）
    │
    └── SettingsTab（设置）
        ├── ProfileScreen（个人资料）
        ├── SecurityScreen（安全设置）
        ├── NotificationsScreen（通知设置）
        └── AdminScreen（管理面板 - 仅管理员）
```

#### 关键界面草图

**1. 聊天界面（专业版）**
```
┌─────────────────────────────────────────┐
│ ◀ Session #123          [🔍] [⋮]       │
├─────────────────────────────────────────┤
│                                         │
│ [System] 已同步桌面端上下文              │
│ 当前文件: src/components/Button.tsx     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 👤 帮我优化这个按钮组件的性能         │ │
│ │                                     │ │
│ │ context: src/components/Button.tsx  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [🤔 分析中...]                         │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🤖 已优化Button组件。主要改进:        │ │
│ │                                     │ │
│ │ 1. 使用React.memo避免不必要渲染       │ │
│ │ 2. 将回调函数提取到useCallback        │ │
│ │                                     │ │
│ │ [查看Diff] [应用到文件] [复制代码]    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [工具] read_file: src/components/Button │
│ [工具] edit_file: src/components/Button │
│                                         │
├─────────────────────────────────────────┤
│ [📎] [🎤] 输入消息...        [上下文▼] [▶]│
└─────────────────────────────────────────┘
```

**2. Diff查看器**
```
┌─────────────────────────────────────────┐
│ ◀ Diff: Button.tsx           [⋯]       │
├─────────────────────────────────────────┤
│ [文件: src/components/Button.tsx]       │
│                                         │
│  @@ -1,10 +1,15 @@                     │
│                                         │
│   import React from 'react';            │
│                                         │
│  -const Button = ({ onClick, label }) =>│
│  +const Button = React.memo(({ onClick,│
│  +  label                               │
│  +}) => {                               │
│     const handleClick = () => {         │
│       console.log('Button clicked');    │
│       onClick();                        │
│     };                                  │
│                                         │
│  +    // Optimized with useCallback     │
│     return (                            │
│       <button onClick={handleClick}>    │
│         {label}                         │
│       </button>                         │
│     );                                  │
│   };                                    │
│                                         │
│  +export default Button;                │
│                                         │
├─────────────────────────────────────────┤
│ [全屏] [分享] [导出]                    │
│ [接受更改] [拒绝] [评论]                │
└─────────────────────────────────────────┘
```

**3. 文件树浏览器**
```
┌─────────────────────────────────────────┐
│ ◀ Project: my-app          [🔍] [⋮]    │
├─────────────────────────────────────────┤
│ 📁 my-app/                              │
│   📁 src/                               │
│     📁 components/                      │
│       📄 Button.tsx        [当前打开]    │
│       📄 Card.tsx                       │
│       📄 Input.tsx                      │
│     📁 hooks/                           │
│       📄 useAuth.ts                     │
│       📄 useAPI.ts                      │
│     📁 utils/                           │
│       📄 helpers.ts                     │
│     📄 App.tsx                          │
│     📄 index.ts                         │
│   📄 package.json                       │
│   📄 tsconfig.json                      │
│   📄 README.md                          │
│                                         │
├─────────────────────────────────────────┤
│ [刷新] [在IDE中打开]                    │
└─────────────────────────────────────────┘
```

**4. 工具执行状态面板**
```
┌─────────────────────────────────────────┐
│ ◀ 工具状态                    [全部清除]│
├─────────────────────────────────────────┤
│ 运行中 (2)                              │
│ ┌─────────────────────────────────────┐ │
│ │ 🔄 bash: npm test                   │ │
│ │ ████████████████░░░░ 80%            │ │
│ │ stdout: Running test suite...       │ │
│ │ [停止] [查看详情]                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 已完成 (3)                              │
│ ┌─────────────────────────────────────┐ │
│ │ ✅ read_file: Button.tsx            │ │
│ │ 用时: 0.2s                          │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ✅ edit_file: Button.tsx            │ │
│ │ 用时: 0.5s                          │ │
│ │ [查看更改]                          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 失败 (1)                                │
│ ┌─────────────────────────────────────┐ │
│ │ ❌ bash: npm build                  │ │
│ │ 错误: Module not found              │ │
│ │ [重试] [查看日志]                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 4. owpenbot后端改造方案

### 4.1 API设计

#### Mobile专用端点

```typescript
// ==================== 设备管理 ====================

// POST /mobile/v1/devices/register
// 注册新设备
interface RegisterDeviceRequest {
  deviceName: string;           // 设备名称（如 "iPhone 15 Pro"）
  deviceType: 'ios' | 'android';
  pushToken?: string;           // FCM/APNs token
  publicKey: string;            // 设备公钥（用于E2E加密）
}

interface RegisterDeviceResponse {
  deviceId: string;
  deviceToken: string;          // 长期token
  refreshToken: string;
  expiresAt: number;
}

// DELETE /mobile/v1/devices/:deviceId
// 注销设备

// GET /mobile/v1/devices
// 列出用户设备

// ==================== 会话管理 ====================

// GET /mobile/v1/sessions
// 获取会话列表（支持分页）
interface ListSessionsRequest {
  status?: 'active' | 'archived';
  workspace?: string;
  limit?: number;
  cursor?: string;
}

// POST /mobile/v1/sessions
// 创建新会话
interface CreateSessionRequest {
  title?: string;
  context?: {
    currentFile?: string;
    gitBranch?: string;
    workspace: string;
  };
}

// GET /mobile/v1/sessions/:sessionId/messages
// 获取会话消息（支持增量同步）
interface GetMessagesRequest {
  since?: string;               // 游标，用于增量同步
  limit?: number;
}

// WebSocket /mobile/v1/realtime
// 实时消息推送
interface RealtimeMessage {
  type: 'message' | 'typing' | 'tool_status' | 'session_sync' | 'permission_request';
  sessionId: string;
  payload: unknown;
  timestamp: number;
}

// ==================== 代码操作 ====================

// GET /mobile/v1/workspaces/:workspace/files
// 获取文件树

// GET /mobile/v1/workspaces/:workspace/files/:path
// 获取文件内容
interface GetFileResponse {
  path: string;
  content: string;
  language: string;
  lastModified: number;
  size: number;
}

// POST /mobile/v1/sessions/:sessionId/diff
// 获取会话中的代码Diff

// ==================== 企业管理 ====================

// GET /mobile/v1/admin/audit-logs
// 查询审计日志（仅管理员）
interface AuditLogQuery {
  userId?: string;
  action?: string;
  startDate: string;
  endDate: string;
  limit?: number;
}

// GET /mobile/v1/admin/team
// 获取团队成员列表

// POST /mobile/v1/admin/config
// 下发团队配置
```

### 4.2 核心模块实现

#### 设备管理服务
```typescript
// packages/owpenbot/src/mobile/device.ts

import { createHash, randomBytes } from 'crypto';

interface Device {
  id: string;
  userId: string;
  name: string;
  type: 'ios' | 'android';
  pushToken?: string;
  publicKey: string;
  registeredAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
}

class DeviceManager {
  private db: Database;
  private pushService: PushService;

  async register(
    userId: string, 
    request: RegisterDeviceRequest
  ): Promise<RegisterDeviceResponse> {
    // 1. 生成设备ID
    const deviceId = this.generateDeviceId();
    
    // 2. 创建设备记录
    const device: Device = {
      id: deviceId,
      userId,
      name: request.deviceName,
      type: request.deviceType,
      pushToken: request.pushToken,
      publicKey: request.publicKey,
      registeredAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true,
    };
    
    await this.db.devices.insert(device);
    
    // 3. 生成token对
    const { token, refreshToken, expiresAt } = await this.generateTokens(deviceId);
    
    // 4. 发送欢迎推送
    if (request.pushToken) {
      await this.pushService.send(request.pushToken, {
        title: '设备已注册',
        body: `${request.deviceName} 已成功添加到您的账户`,
      });
    }
    
    return {
      deviceId,
      deviceToken: token,
      refreshToken,
      expiresAt,
    };
  }

  async verifyToken(deviceId: string, token: string): Promise<boolean> {
    // 验证token有效性
    const device = await this.db.devices.findById(deviceId);
    if (!device || !device.isActive) return false;
    
    return await this.verifyJWT(token, device.publicKey);
  }

  async revoke(deviceId: string): Promise<void> {
    await this.db.devices.update(deviceId, { isActive: false });
    // 发送通知到其他设备
    await this.notifyOtherDevices(deviceId, 'device_revoked');
  }

  private generateDeviceId(): string {
    return `dev_${createHash('sha256')
      .update(randomBytes(32))
      .digest('hex')
      .substring(0, 16)}`;
  }
}
```

#### 会话同步服务
```typescript
// packages/owpenbot/src/mobile/session-sync.ts

interface SessionSyncState {
  sessionId: string;
  userId: string;
  devices: string[];           // 已同步的设备列表
  lastMessageId: string;
  context: MobileContext;
  updatedAt: number;
}

interface MobileContext {
  currentFile?: string;
  gitBranch?: string;
  workspace: string;
  cursorPosition?: { line: number; column: number };
}

class SessionSyncManager {
  private db: Database;
  private wsGateway: WebSocketGateway;

  // 当桌面端会话更新时同步到移动端
  async syncFromDesktop(
    sessionId: string, 
    desktopContext: Context
  ): Promise<void> {
    const syncState = await this.getSyncState(sessionId);
    if (!syncState) return;

    // 转换上下文格式
    const mobileContext: MobileContext = {
      currentFile: desktopContext.currentFile,
      gitBranch: desktopContext.gitBranch,
      workspace: desktopContext.workspace,
    };

    // 推送到所有关联的移动设备
    for (const deviceId of syncState.devices) {
      await this.wsGateway.sendToDevice(deviceId, {
        type: 'session_sync',
        sessionId,
        payload: {
          context: mobileContext,
          lastMessageId: syncState.lastMessageId,
        },
      });
    }

    // 更新同步状态
    await this.updateSyncState(sessionId, {
      ...syncState,
      context: mobileContext,
      updatedAt: Date.now(),
    });
  }

  // 移动端主动同步
  async syncFromMobile(
    deviceId: string,
    sessionId: string,
    lastMessageId?: string
  ): Promise<SyncResult> {
    // 获取增量消息
    const messages = await this.getMessagesSince(sessionId, lastMessageId);
    
    // 获取会话上下文
    const context = await this.getSessionContext(sessionId);
    
    // 注册设备到同步列表
    await this.addDeviceToSession(sessionId, deviceId);

    return {
      messages,
      context,
      hasMore: messages.length >= 100,
    };
  }
}
```

#### 推送服务
```typescript
// packages/owpenbot/src/mobile/push.ts

interface RichNotification {
  title: string;
  body: string;
  data?: {
    sessionId?: string;
    messageId?: string;
    type: 'message' | 'tool_complete' | 'permission_request';
    // 富媒体数据
    codePreview?: string;      // 代码片段预览
    fileName?: string;
    actionUrl?: string;        // 深度链接
  };
  // iOS特定
  apns?: {
    badge?: number;
    sound?: string;
    category?: string;
  };
  // Android特定
  android?: {
    channelId?: string;
    priority?: 'high' | 'normal';
    actions?: Array<{
      title: string;
      action: string;
    }>;
  };
}

class PushGateway {
  private fcm: FCM;
  private apns: APNs;

  async send(deviceToken: string, notification: RichNotification): Promise<void> {
    if (deviceToken.startsWith('fcm:')) {
      await this.sendFCM(deviceToken, notification);
    } else if (deviceToken.startsWith('apns:')) {
      await this.sendAPNs(deviceToken, notification);
    }
  }

  private async sendFCM(token: string, notification: RichNotification): Promise<void> {
    await this.fcm.send({
      token: token.replace('fcm:', ''),
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data as Record<string, string>,
      android: notification.android,
    });
  }

  private async sendAPNs(token: string, notification: RichNotification): Promise<void> {
    await this.apns.send({
      deviceToken: token.replace('apns:', ''),
      alert: {
        title: notification.title,
        body: notification.body,
      },
      payload: notification.data,
      ...notification.apns,
    });
  }

  // 批量发送（用于团队通知）
  async batchSend(
    tokens: string[], 
    notification: RichNotification
  ): Promise<BatchResult> {
    const results = await Promise.allSettled(
      tokens.map(token => this.send(token, notification))
    );

    return {
      total: tokens.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    };
  }
}
```

---

## 5. 移动端实现方案

### 5.1 项目结构

```
packages/mobile-pro/
├── android/                          # Android原生代码
├── ios/                              # iOS原生代码
├── src/
│   ├── api/
│   │   ├── client.ts                 # HTTP客户端（Axios封装）
│   │   ├── websocket.ts              # WebSocket管理
│   │   ├── auth.ts                   # 认证API
│   │   ├── sessions.ts               # 会话API
│   │   ├── files.ts                  # 文件API
│   │   └── sync.ts                   # 同步API
│   │
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatBubble.tsx        # 聊天气泡
│   │   │   ├── CodeBlock.tsx         # 代码块组件
│   │   │   ├── DiffViewer.tsx        # Diff查看器
│   │   │   ├── ToolStatusCard.tsx    # 工具状态卡片
│   │   │   └── MessageInput.tsx      # 消息输入框
│   │   │
│   │   ├── Explorer/
│   │   │   ├── FileTree.tsx          # 文件树
│   │   │   ├── FileItem.tsx          # 文件项
│   │   │   └── Breadcrumb.tsx        # 面包屑导航
│   │   │
│   │   ├── Common/
│   │   │   ├── Button.tsx            # 按钮
│   │   │   ├── Input.tsx             # 输入框
│   │   │   ├── Card.tsx              # 卡片
│   │   │   ├── SyntaxHighlighter.tsx # 语法高亮
│   │   │   └── Skeleton.tsx          # 骨架屏
│   │   │
│   │   └── Admin/
│   │       ├── AuditLogTable.tsx     # 审计日志表格
│   │       ├── TeamMemberList.tsx    # 团队成员列表
│   │       └── PermissionEditor.tsx  # 权限编辑器
│   │
│   ├── screens/
│   │   ├── Auth/
│   │   │   ├── ServerConnectScreen.tsx
│   │   │   └── BiometricSetupScreen.tsx
│   │   │
│   │   ├── Workbench/
│   │   │   ├── SessionListScreen.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── CodeViewerScreen.tsx
│   │   │   └── DiffViewerScreen.tsx
│   │   │
│   │   ├── Explorer/
│   │   │   ├── FileTreeScreen.tsx
│   │   │   └── ToolStatusScreen.tsx
│   │   │
│   │   ├── Settings/
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── SecurityScreen.tsx
│   │   │   └── NotificationsScreen.tsx
│   │   │
│   │   └── Admin/
│   │       ├── DashboardScreen.tsx
│   │       ├── AuditLogsScreen.tsx
│   │       └── TeamManagementScreen.tsx
│   │
│   ├── store/
│   │   ├── authStore.ts              # 认证状态
│   │   ├── sessionStore.ts           # 会话状态
│   │   ├── syncStore.ts              # 同步状态
│   │   ├── offlineStore.ts           # 离线状态
│   │   └── index.ts
│   │
│   ├── services/
│   │   ├── syncEngine.ts             # 同步引擎
│   │   ├── offlineQueue.ts           # 离线队列
│   │   ├── pushHandler.ts            # 推送处理
│   │   ├── biometrics.ts             # 生物识别
│   │   ├── deeplink.ts               # 深度链接
│   │   └── encryption.ts             # 加密服务
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSession.ts
│   │   ├── useSync.ts
│   │   ├── useOffline.ts
│   │   └── useCodeViewer.ts
│   │
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   ├── storage.ts
│   │   └── security.ts
│   │
│   ├── types/
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── navigation.ts
│   │
│   └── App.tsx
│
├── package.json
├── tsconfig.json
├── babel.config.js
└── metro.config.js
```

### 5.2 核心服务实现

#### 同步引擎
```typescript
// src/services/syncEngine.ts

import EventEmitter from 'eventemitter3';

interface SyncConfig {
  pollInterval: number;           // 轮询间隔（毫秒）
  batchSize: number;              // 批量大小
  conflictResolution: 'server' | 'client' | 'manual';
}

class SyncEngine extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: SyncConfig;
  private isOnline: boolean = false;
  private syncState: Map<string, SyncState> = new Map();

  constructor(config: SyncConfig) {
    super();
    this.config = config;
    this.setupNetworkListener();
  }

  // 建立WebSocket连接
  async connect(url: string, token: string): Promise<void> {
    this.ws = new WebSocket(`${url}?token=${token}`);
    
    this.ws.onopen = () => {
      this.isOnline = true;
      this.emit('connected');
      this.startInitialSync();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleServerMessage(message);
    };

    this.ws.onclose = () => {
      this.isOnline = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    };
  }

  // 处理服务器消息
  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'message':
        this.emit('newMessage', message.payload);
        break;
      case 'typing':
        this.emit('typing', message.payload);
        break;
      case 'tool_status':
        this.emit('toolStatus', message.payload);
        break;
      case 'session_sync':
        this.handleSessionSync(message.payload);
        break;
      case 'permission_request':
        this.emit('permissionRequest', message.payload);
        break;
    }
  }

  // 初始同步
  private async startInitialSync(): Promise<void> {
    // 获取所有活跃会话
    const sessions = await this.fetchActiveSessions();
    
    for (const session of sessions) {
      // 增量同步每个会话的消息
      await this.syncSession(session.id, session.lastMessageId);
    }

    this.emit('initialSyncComplete');
  }

  // 会话增量同步
  async syncSession(sessionId: string, lastMessageId?: string): Promise<void> {
    const response = await api.sessions.getMessages(sessionId, {
      since: lastMessageId,
      limit: this.config.batchSize,
    });

    // 存储到本地数据库
    await offlineStore.saveMessages(sessionId, response.messages);

    // 更新同步状态
    this.syncState.set(sessionId, {
      lastMessageId: response.messages[response.messages.length - 1]?.id,
      syncedAt: Date.now(),
    });

    if (response.hasMore) {
      // 继续同步更多消息
      await this.syncSession(sessionId, this.syncState.get(sessionId)?.lastMessageId);
    }
  }

  // 监听网络状态
  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        this.emit('backOnline');
        this.processOfflineQueue();
      }
    });
  }

  // 处理离线队列
  private async processOfflineQueue(): Promise<void> {
    const queue = await offlineQueue.getPending();
    
    for (const item of queue) {
      try {
        await this.sendToServer(item);
        await offlineQueue.markAsSent(item.id);
      } catch (error) {
        console.error('Failed to send offline item:', error);
      }
    }
  }
}
```

#### 离线队列
```typescript
// src/services/offlineQueue.ts

interface QueueItem {
  id: string;
  type: 'message' | 'action' | 'sync';
  payload: unknown;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
}

class OfflineQueue {
  private db: SQLiteDatabase;
  private maxQueueSize: number = 1000;

  async enqueue(item: Omit<QueueItem, 'id' | 'retryCount' | 'createdAt'>): Promise<string> {
    const id = generateUUID();
    
    await this.db.executeSql(
      `INSERT INTO offline_queue (id, type, payload, priority, retry_count, max_retries, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [id, item.type, JSON.stringify(item.payload), item.priority, item.maxRetries, Date.now()]
    );

    // 检查队列大小，清理旧项
    await this.trimQueue();

    return id;
  }

  async getPending(limit: number = 50): Promise<QueueItem[]> {
    const result = await this.db.executeSql(
      `SELECT * FROM offline_queue 
       WHERE retry_count < max_retries 
       ORDER BY priority DESC, created_at ASC 
       LIMIT ?`,
      [limit]
    );

    return result.rows.raw().map(row => ({
      ...row,
      payload: JSON.parse(row.payload),
    }));
  }

  async markAsSent(id: string): Promise<void> {
    await this.db.executeSql(
      'DELETE FROM offline_queue WHERE id = ?',
      [id]
    );
  }

  async incrementRetry(id: string): Promise<void> {
    await this.db.executeSql(
      'UPDATE offline_queue SET retry_count = retry_count + 1 WHERE id = ?',
      [id]
    );
  }

  private async trimQueue(): Promise<void> {
    const count = await this.db.executeSql('SELECT COUNT(*) as count FROM offline_queue');
    
    if (count.rows.item(0).count > this.maxQueueSize) {
      // 删除最旧、优先级最低的项目
      await this.db.executeSql(
        `DELETE FROM offline_queue 
         WHERE id IN (
           SELECT id FROM offline_queue 
           ORDER BY priority ASC, created_at ASC 
           LIMIT ?
         )`,
        [count.rows.item(0).count - this.maxQueueSize + 100]
      );
    }
  }
}
```

---

## 6. 实施路线图

### Phase 1: MVP 基础专业版 (10-12周)

**目标**: 验证核心假设，让专业开发者能用

#### 第1-3周: 基础设施
- [ ] 搭建React Native项目框架（TypeScript + Expo）
- [ ] 配置CI/CD（EAS Build）
- [ ] 设计并实现基础UI组件库
- [ ] 集成react-native-mmkv（本地存储）
- [ ] 集成react-native-keychain（安全存储）

#### 第4-6周: 后端改造（owpenbot）
- [ ] 设计Mobile API规范
- [ ] 实现设备注册/认证模块
- [ ] 实现基础会话管理API
- [ ] 实现WebSocket网关
- [ ] 集成FCM/APNs推送

#### 第7-9周: 核心功能
- [ ] 服务器连接界面
- [ ] 聊天界面（Gifted Chat集成）
- [ ] 代码高亮组件
- [ ] 会话列表管理
- [ ] 消息收发（支持Markdown）

#### 第10-12周: 完善与测试
- [ ] 离线消息队列
- [ ] 生物识别认证
- [ ] 消息推送
- [ ] 端到端测试
- [ ] 内测版本发布（TestFlight + Firebase）

**里程碑**: 内测版本，支持10-20个核心用户

---

### Phase 2: 高级专业版 (8-10周)

**目标**: 提升专业度，与桌面端体验对齐

#### 第1-3周: 代码体验
- [ ] Diff查看器组件
- [ ] 文件树浏览器
- [ ] 代码折叠/展开
- [ ] 代码跳转到IDE（深度链接）

#### 第4-6周: 同步与上下文
- [ ] 会话上下文同步（桌面端↔移动端）
- [ ] 多工作空间切换
- [ ] 会话标签系统
- [ ] 文件搜索

#### 第7-8周: 工具可视化
- [ ] 工具执行状态面板
- [ ] 实时进度显示
- [ ] 工具结果查看
- [ ] 权限请求弹窗

#### 第9-10周: 性能优化
- [ ] 大数据量虚拟列表
- [ ] 图片/文件懒加载
- [ ] 启动速度优化
- [ ] 电池优化

**里程碑**: 公测版本，支持100+用户

---

### Phase 3: 企业版 (8-10周)

**目标**: 满足企业安全与管控需求

#### 第1-3周: 企业认证
- [ ] SSO集成（SAML 2.0）
- [ ] OIDC支持
- [ ] 多因素认证（MFA）
- [ ] 企业设备策略

#### 第4-6周: 管理功能
- [ ] 团队管理界面
- [ ] 审计日志查询
- [ ] 权限矩阵管理
- [ ] 配置下发系统

#### 第7-8周: 安全加固
- [ ] 端到端加密
- [ ] 远程擦除功能
- [ ] 安全审计
- [ ] 合规报告导出

#### 第9-10周: 企业集成
- [ ] LDAP集成
- [ ] SCIM用户同步
- [ ] 企业MDM支持
- [ ] 私有化部署文档

**里程碑**: 正式版发布，开始商业化

---

### Phase 4: 规模化 (持续)

**目标**: 产品迭代与市场扩展

- [ ] 用户反馈收集与迭代
- [ ] 性能监控与优化（Sentry + Firebase）
- [ ] 新功能开发（语音输入、AI辅助等）
- [ ] 多语言支持
- [ ] 应用商店优化（ASO）

---

## 7. 差异化竞争策略

### 7.1 与竞品的差异

| 维度 | ChatGPT App | Claude App | **OpenWork Mobile** |
|------|-------------|------------|---------------------|
| **目标场景** | 通用对话 | 通用对话 | **专业编程** |
| **代码展示** | 代码块 | 代码块 | **IDE级体验（Diff、文件树）** |
| **上下文感知** | 有限 | 有限 | **与桌面端同步** |
| **离线能力** | 无 | 无 | **离线队列+本地缓存** |
| **企业功能** | 有限 | 有限 | **SSO+审计+合规** |
| **集成深度** | 独立应用 | 独立应用 | **与OpenCode深度集成** |

### 7.2 核心卖点

#### 对专业开发者
> "在手机上Review PR、查看代码Diff，就像在IDE里一样自然"

- **代码Diff可视化**: 行内Diff、对比模式
- **上下文同步**: 手机与桌面端状态实时同步
- **工具可视化**: 实时查看AI工具执行进度

#### 对企业客户
> "企业级的AI编程助手，满足最严格的安全与合规要求"

- **SSO集成**: 与企业现有身份系统对接
- **审计日志**: 完整的操作追溯
- **数据安全**: 支持端到端加密和私有化部署

---

## 8. 商业化路径

### 8.1 定价策略

```
免费层 (Free)
├── 基础聊天功能
├── 最多3个活跃会话
├── 7天消息历史
└── 社区支持

专业版 (Pro) - $9.99/月
├── 无限会话
├── 无限消息历史
├── 代码Diff查看
├── 文件树浏览
├── 上下文同步
├── 优先支持
└── 自定义主题

团队版 (Team) - $29.99/用户/月
├── 所有专业版功能
├── 团队管理
├── 共享工作空间
├── 审计日志
├── SSO集成
├── 管理员面板
└── 优先技术支持

企业版 (Enterprise) - 定制
├── 所有团队版功能
├── 私有化部署
├── 定制集成
├── SLA保障
├── 专属客户成功经理
└── 合规认证支持
```

### 8.2 推广策略

1. **种子用户**: 从现有OpenWork桌面用户中邀请
2. **社区运营**: 在GitHub、Reddit、Twitter推广
3. **内容营销**: 发布使用场景文章、视频教程
4. **合作伙伴**: 与CI/CD工具、代码托管平台集成
5. **企业直销**: 针对大企业客户进行直销

---

## 9. 风险评估与缓解

### 9.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **React Native性能瓶颈** | 中 | 高 | 使用New Architecture、原生模块优化 |
| **WebSocket稳定性** | 中 | 中 | 实现自动重连、降级到HTTP轮询 |
| **离线同步冲突** | 高 | 中 | 设计清晰的冲突解决策略 |
| **安全漏洞** | 低 | 高 | 定期安全审计、Bug Bounty计划 |

### 9.2 商业风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **用户接受度低** | 中 | 高 | MVP快速验证、持续收集反馈 |
| **竞品快速跟进** | 高 | 中 | 保持迭代速度、建立生态壁垒 |
| **商业化困难** | 中 | 高 | 免费增值模式、企业服务溢价 |

---

## 10. 成功指标

### 10.1 产品指标

| 指标 | Phase 1目标 | Phase 2目标 | Phase 3目标 |
|------|------------|------------|------------|
| **日活跃用户(DAU)** | 50 | 500 | 5000 |
| **会话留存率** | 40% | 50% | 60% |
| **功能使用率** | - | Diff: 60% | 全部>50% |
| **崩溃率** | <1% | <0.5% | <0.1% |
| **平均启动时间** | <3s | <2s | <1.5s |

### 10.2 商业指标

| 指标 | Phase 1目标 | Phase 2目标 | Phase 3目标 |
|------|------------|------------|------------|
| **付费转化率** | - | 5% | 10% |
| **月经常性收入(MRR)** | - | $5,000 | $50,000 |
| **企业客户数** | - | - | 10 |
| **NPS评分** | >40 | >50 | >60 |

---

## 11. 附录

### A. 技术参考

- React Native New Architecture: https://reactnative.dev/docs/new-architecture-intro
- React Native Performance: https://reactnative.dev/docs/performance
- Mobile Security Best Practices: https://owasp.org/www-project-mobile-security/

### B. 竞品分析

- ChatGPT Mobile App
- Claude Mobile App
- GitHub Mobile
- GitLab Mobile
- Linear Mobile

### C. 设计资源

- Material Design 3: https://m3.material.io/
- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines

---

**版本**: 1.0  
**日期**: 2025年2月  
**状态**: 设计方案待评审

---

## 快速决策清单

在启动开发前，请确认以下问题：

- [ ] 团队是否有React Native经验？（没有需预留学习时间）
- [ ] 是否有iOS开发者账号（$99/年）？
- [ ] 是否有Google Play开发者账号（$25一次性）？
- [ ] 是否确定了MVP功能范围（避免范围蔓延）？
- [ ] 是否有10-20个种子用户愿意内测？
- [ ] 是否有足够的开发资源（2-3名全职开发者，3个月）？

如果以上问题都确认，可以开始Phase 1开发。
