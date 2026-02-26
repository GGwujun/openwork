# Owpenbot 独立移动端应用技术方案

## 1. 需求分析

### 1.1 现状
- **当前模式**: owpenbot作为桥接器，连接OpenCode与Telegram/Slack/WeCom等社交平台
- **依赖问题**: 用户必须拥有Telegram/Slack账号才能使用
- **限制**: 无法提供统一、原生的移动体验

### 1.2 目标
- 创建**独立的原生移动应用**（iOS/Android）
- 直接与owpenbot的HTTP API通信
- 提供聊天式交互界面
- 支持消息推送通知
- 保持与桌面端OpenWork的功能对等

---

## 2. 技术架构方案

### 方案A: React Native（推荐）

#### 2.1 技术栈
```
┌─────────────────────────────────────────────────────────────┐
│                    Owpenbot Mobile App                      │
├─────────────────────────────────────────────────────────────┤
│  UI层: React Native 0.73+                                   │
│  ├── React Navigation 6 (导航)                              │
│  ├── React Native Gifted Chat (聊天UI)                      │
│  ├── React Native Reanimated 3 (动画)                       │
│  └── React Native MMKV (本地存储)                           │
├─────────────────────────────────────────────────────────────┤
│  状态管理: Zustand + React Query                            │
├─────────────────────────────────────────────────────────────┤
│  网络层:                                                    │
│  ├── Axios (HTTP API)                                       │
│  ├── Socket.io-client (WebSocket/实时消息)                  │
│  └── EventSource (SSE - OpenCode事件流)                     │
├─────────────────────────────────────────────────────────────┤
│  原生模块:                                                  │
│  ├── @react-native-firebase/messaging (推送通知)            │
│  ├── react-native-keychain (安全存储)                       │
│  └── react-native-fs (文件操作)                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 优势
- **跨平台**: 一套代码支持iOS/Android
- **生态成熟**: 丰富的第三方库
- **性能优秀**: 接近原生体验
- **团队熟悉**: 与OpenWork现有技术栈（TypeScript/React）一致
- **热更新**: 支持CodePush快速迭代

#### 2.3 劣势
- **包体积**: 基础包约15-20MB
- **原生依赖**: 复杂功能需要写桥接代码

---

### 方案B: Flutter

#### 2.4 技术栈
```
┌─────────────────────────────────────────────────────────────┐
│                    Owpenbot Mobile App                      │
├─────────────────────────────────────────────────────────────┤
│  UI层: Flutter 3.16+                                        │
│  ├── Material 3 / Cupertino (设计系统)                      │
│  ├── flutter_chat_ui (聊天组件)                             │
│  └── flutter_animate (动画)                                 │
├─────────────────────────────────────────────────────────────┤
│  状态管理: Riverpod / Bloc                                  │
├─────────────────────────────────────────────────────────────┤
│  网络层:                                                    │
│  ├── dio (HTTP)                                             │
│  ├── web_socket_channel (WebSocket)                         │
│  └── sse_client (SSE)                                       │
├─────────────────────────────────────────────────────────────┤
│  存储: Hive / SharedPreferences                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.5 优势
- **性能极致**: 自绘引擎，120fps流畅
- **UI一致**: 跨平台UI完全统一
- **包体积**: 比React Native更小

#### 2.6 劣势
- **学习成本**: Dart语言新团队需要适应
- **生态较小**: 特定功能库不如RN丰富

---

### 方案C: PWA (渐进式Web应用)

#### 2.7 技术栈
```
┌─────────────────────────────────────────────────────────────┐
│                    Owpenbot Mobile PWA                      │
├─────────────────────────────────────────────────────────────┤
│  框架: SolidJS (复用OpenWork现有技术)                       │
│  ├── 复用 packages/app 的组件                               │
│  ├── TailwindCSS (样式)                                     │
│  └── Workbox (Service Worker)                               │
├─────────────────────────────────────────────────────────────┤
│  移动适配:                                                  │
│  ├── Capacitor 5 (原生桥接，可选)                           │
│  └── PWA manifest + Service Worker                          │
└─────────────────────────────────────────────────────────────┘
```

#### 2.8 优势
- **开发速度**: 最快上线，复用现有代码
- **无需审核**: 无需App Store审核
- **即时更新**: 用户无需手动更新

#### 2.9 劣势
- **推送受限**: iOS PWA推送支持有限
- **功能受限**: 无法访问某些原生API
- **发现性差**: 用户习惯从应用商店下载

---

## 3. 推荐方案：React Native

### 3.1 选型理由
1. **团队效率**: OpenWork团队已有TypeScript/SolidJS经验，React Native学习曲线平缓
2. **生态完善**: 聊天、推送、存储都有成熟解决方案
3. **社区活跃**: 问题容易找到解决方案
4. **未来扩展**: 可逐步迁移到New Architecture (Fabric/TurboModules)

---

## 4. 详细架构设计

### 4.1 系统架构图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              移动端应用                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   聊天界面    │  │   设置页面    │  │   会话列表    │  │   状态监控    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         └────────────────────┬─────────────────────────────┘               │
│                              │                                             │
│  ┌───────────────────────────┴───────────────────────────┐                 │
│  │                    App State (Zustand)                 │                 │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐ │                 │
│  │  │ AuthStore  │ │ ChatStore  │ │ NotificationStore  │ │                 │
│  │  └────────────┘ └────────────┘ └────────────────────┘ │                 │
│  └───────────────────────────┬───────────────────────────┘                 │
│                              │                                             │
│  ┌───────────────────────────┴───────────────────────────┐                 │
│  │                    API Layer                           │                 │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐ │                 │
│  │  │ Owpenbot   │ │ OpenCode   │ │ Push Notification  │ │                 │
│  │  │   API      │ │   SDK      │ │      Service       │ │                 │
│  │  └────────────┘ └────────────┘ └────────────────────┘ │                 │
│  └───────────────────────────┬───────────────────────────┘                 │
└──────────────────────────────┼─────────────────────────────────────────────┘
                               │
                               │ HTTPS / WebSocket
                               │
┌──────────────────────────────┼─────────────────────────────────────────────┐
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         Owpenbot Server                              │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Health API   │  │  WebSocket   │  │    Push Gateway (FCM)    │  │  │
│  │  │   (3005)     │  │   Gateway    │  │                          │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  └──────────────────────────────┬─────────────────────────────────────┘  │
│                                 │                                         │
│  ┌──────────────────────────────┴─────────────────────────────────────┐  │
│  │                         OpenCode Server                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Session API  │  │  SSE Events  │  │    Permission API        │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 核心模块设计

#### 4.2.1 API客户端层

```typescript
// src/api/owpenbot.ts
interface OwpenbotAPI {
  // 健康检查
  health(): Promise<HealthSnapshot>;
  
  // 身份管理
  listTelegramIdentities(): Promise<TelegramIdentity[]>;
  upsertTelegramIdentity(input: TelegramInput): Promise<void>;
  
  // 绑定管理
  listBindings(): Promise<Binding[]>;
  setBinding(binding: BindingInput): Promise<void>;
  
  // 消息发送
  sendMessage(message: SendMessageInput): Promise<void>;
}

// src/api/opencode.ts
interface OpenCodeAPI {
  // 会话管理
  createSession(): Promise<Session>;
  sendPrompt(sessionId: string, text: string): Promise<void>;
  
  // SSE事件订阅
  subscribeEvents(callback: EventCallback): () => void;
  
  // 消息历史
  getMessages(sessionId: string): Promise<Message[]>;
}
```

#### 4.2.2 状态管理

```typescript
// src/store/authStore.ts
interface AuthState {
  // 用户身份
  deviceId: string;
  owpenbotUrl: string;
  opencodeUrl: string;
  
  // 绑定信息
  binding: {
    channel: 'mobile';
    peerId: string;
    directory: string;
  } | null;
  
  // Actions
  connectToServer(url: string): Promise<void>;
  createBinding(directory: string): Promise<void>;
}

// src/store/chatStore.ts
interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>;
  isTyping: boolean;
  
  // Actions
  sendMessage(text: string): Promise<void>;
  receiveMessage(message: Message): void;
  createNewSession(): Promise<void>;
}
```

#### 4.2.3 WebSocket实时通信

```typescript
// src/services/realtime.ts
class RealtimeService {
  private ws: WebSocket | null = null;
  
  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          // 收到新消息
          chatStore.receiveMessage(data.payload);
          break;
        case 'typing':
          // AI正在输入
          chatStore.setTyping(data.sessionId, true);
          break;
        case 'tool_update':
          // 工具执行状态更新
          chatStore.addToolUpdate(data.payload);
          break;
      }
    };
  }
}
```

---

## 5. owpenbot后端改造

### 5.1 新增Mobile Channel支持

owpenbot需要新增一个`mobile` channel来支持独立应用：

```typescript
// packages/owpenbot/src/mobile.ts
interface MobileAdapter extends Adapter {
  name: 'mobile';
  
  // 通过WebSocket发送消息到移动应用
  sendToDevice(deviceId: string, message: MobileMessage): Promise<void>;
  
  // 处理设备注册
  registerDevice(deviceId: string, pushToken: string): Promise<void>;
}

interface MobileMessage {
  type: 'text' | 'typing' | 'tool_update' | 'session_status';
  sessionId: string;
  payload: unknown;
  timestamp: number;
}
```

### 5.2 API扩展

```typescript
// packages/owpenbot/src/health.ts 新增端点

// POST /mobile/register
// 注册移动设备
{
  deviceId: string;
  pushToken?: string;  // FCM/APNs token
  directory: string;   // 绑定的工作目录
}

// POST /mobile/send
// 从移动应用发送消息
{
  deviceId: string;
  sessionId?: string;  // 可选，不传则创建新会话
  text: string;
}

// GET /mobile/sessions/:deviceId
// 获取设备的所有会话

// WebSocket /mobile/ws
// 实时消息推送
```

### 5.3 推送通知集成

```typescript
// packages/owpenbot/src/push.ts
interface PushService {
  // FCM (Android)
  sendFCM(token: string, notification: Notification): Promise<void>;
  
  // APNs (iOS)
  sendAPNs(token: string, notification: Notification): Promise<void>;
}

// 当收到OpenCode回复时触发推送
async function onOpenCodeResponse(deviceId: string, message: string) {
  const device = await db.getDevice(deviceId);
  
  if (device.pushToken) {
    await pushService.send(device.pushToken, {
      title: 'OpenWork',
      body: message.substring(0, 100), // 截断预览
      data: { sessionId, type: 'message' }
    });
  }
}
```

---

## 6. 移动端UI设计

### 6.1 页面结构

```
App
├── NavigationContainer
│   ├── AuthStack (未登录)
│   │   └── ServerConnectScreen (连接服务器)
│   │
│   └── MainTab (已登录)
│       ├── ChatTab
│       │   ├── ChatListScreen (会话列表)
│       │   └── ChatScreen (聊天界面)
│       │
│       ├── SessionsTab
│       │   └── SessionsScreen (所有会话)
│       │
│       └── SettingsTab
│           ├── SettingsScreen (设置)
│           ├── WorkspacesScreen (工作空间)
│           └── AboutScreen (关于)
```

### 6.2 核心界面草图

```
┌───────────────────────┐     ┌───────────────────────┐
│     会话列表           │     │      聊天界面         │
├───────────────────────┤     ├───────────────────────┤
│ ◀ 会话          [+]   │     │ ◀ 任务名称      ⋮    │
├───────────────────────┤     ├───────────────────────┤
│ 🔍 搜索历史会话...    │     │ [系统] 正在初始化...   │
├───────────────────────┤     ├───────────────────────┤
│                       │     │                       │
│ ┌───────────────────┐ │     │ 👤 帮我分析一下这个   │
│ │ 📄 代码优化任务    │ │     │    项目的结构         │
│ │ 3条消息 · 刚刚     │ │     │                       │
│ └───────────────────┘ │     │        ┌──────────┐   │
│                       │     │        │ 🤖 正在思 │   │
│ ┌───────────────────┐ │     │        │    考...  │   │
│ │ 🔧 Bug修复        │ │     │        └──────────┘   │
│ │ 12条消息 · 5分钟前 │ │     │                       │
│ └───────────────────┘ │     │ 🤖 好的，我来分析这   │
│                       │     │    个项目的目录结构：  │
│ ┌───────────────────┐ │     │    • src/            │
│ │ 📝 PRD文档编写    │ │     │    • components/     │
│ │ 8条消息 · 1小时前  │ │     │    • hooks/          │
│ └───────────────────┘ │     │                       │
│                       │     ├───────────────────────┤
│ [+] 新建会话          │     │ [📎] 输入消息...  [▶] │
└───────────────────────┘     └───────────────────────┘
```

### 6.3 组件设计

```typescript
// src/components/ChatMessage.tsx
interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
    status: 'sending' | 'sent' | 'error';
  };
  onRetry?: () => void;
}

// src/components/ToolCallCard.tsx
interface ToolCallCardProps {
  toolCall: {
    tool: string;
    status: 'running' | 'completed' | 'error';
    title: string;
    output?: string;
  };
}

// src/components/ThinkingIndicator.tsx
// 显示AI正在思考的动画
```

---

## 7. 项目结构

```
packages/mobile/
├── android/                    # Android原生代码
├── ios/                        # iOS原生代码
├── src/
│   ├── api/
│   │   ├── owpenbot.ts         # owpenbot API客户端
│   │   ├── opencode.ts         # OpenCode SDK封装
│   │   └── client.ts           # HTTP/WebSocket客户端
│   │
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   └── ThinkingIndicator.tsx
│   │   ├── Common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Card.tsx
│   │   └── Session/
│   │       ├── SessionList.tsx
│   │       └── SessionCard.tsx
│   │
│   ├── screens/
│   │   ├── Auth/
│   │   │   └── ServerConnectScreen.tsx
│   │   ├── Chat/
│   │   │   ├── ChatListScreen.tsx
│   │   │   └── ChatScreen.tsx
│   │   └── Settings/
│   │       ├── SettingsScreen.tsx
│   │       └── WorkspacesScreen.tsx
│   │
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   └── index.ts
│   │
│   ├── services/
│   │   ├── realtime.ts         # WebSocket服务
│   │   ├── pushNotification.ts # 推送通知
│   │   └── storage.ts          # 本地存储
│   │
│   ├── hooks/
│   │   ├── useOwpenbot.ts
│   │   ├── useOpenCode.ts
│   │   └── useRealtime.ts
│   │
│   ├── types/
│   │   ├── api.ts
│   │   └── models.ts
│   │
│   ├── utils/
│   │   ├── constants.ts
│   │   └── helpers.ts
│   │
│   └── App.tsx
│
├── index.js                    # 入口文件
├── package.json
├── tsconfig.json
├── babel.config.js
└── metro.config.js
```

---

## 8. 开发路线图

### 阶段1: MVP (4-6周)
- [ ] 搭建React Native项目框架
- [ ] 实现服务器连接功能
- [ ] 基础聊天界面（发送/接收消息）
- [ ] 会话列表和历史
- [ ] owpenbot后端改造（添加mobile channel）

### 阶段2: 功能完善 (3-4周)
- [ ] SSE事件流集成（实时消息）
- [ ] 工具调用状态显示
- [ ] 会话管理（创建/删除/重命名）
- [ ] 工作空间切换
- [ ] 消息搜索

### 阶段3: 原生体验 (2-3周)
- [ ] 推送通知（FCM/APNs）
- [ ] 离线模式（消息队列）
- [ ] 生物识别认证
- [ ] 文件分享支持
- [ ] 深色模式

### 阶段4: 发布准备 (2周)
- [ ] 性能优化
- [ ] 错误监控（Sentry）
- [ ] 应用商店准备
- [ ] 文档编写

---

## 9. 部署方案

### 9.1 owpenbot升级

```bash
# 新版本包含mobile channel支持
npm install -g owpenwork@latest

# 启动时启用WebSocket网关
owpenwork start --ws-port 3006
```

### 9.2 移动应用发布

```
Android:
├── 构建: cd android && ./gradlew assembleRelease
├── 签名: 使用keystore签名APK
└── 发布: Google Play Console

iOS:
├── 构建: xcodebuild -workspace ios/Owpenbot.xcworkspace -scheme Owpenbot -configuration Release
├── 归档: Xcode → Product → Archive
└── 发布: App Store Connect
```

---

## 10. 安全考虑

### 10.1 通信安全
- 强制HTTPS/WSS连接
- 证书固定（Certificate Pinning）
- 设备指纹识别

### 10.2 数据安全
- 敏感数据存储在Keychain/Keystore
- 本地SQLite加密
- 消息端到端加密（可选）

### 10.3 认证机制
```typescript
// 设备配对流程
async function pairDevice() {
  // 1. 扫描QR码或手动输入服务器地址
  const serverUrl = await scanQRCode();
  
  // 2. 生成设备唯一ID
  const deviceId = await generateDeviceId();
  
  // 3. 发送配对请求到owpenbot
  const { token } = await api.pairDevice({
    deviceId,
    publicKey: await getPublicKey()
  });
  
  // 4. 存储认证token
  await secureStorage.set('auth_token', token);
}
```

---

## 11. 与现有OpenWork生态的集成

### 11.1 代码复用
```
可复用:
├── @opencode-ai/sdk (OpenCode API客户端)
├── 类型定义 (packages/app/src/types)
└── 工具函数 (packages/app/src/utils)

需重写:
├── UI组件 (使用React Native替代SolidJS)
├── 存储层 (MMKV替代IndexedDB)
└── 导航 (React Navigation替代浏览器路由)
```

### 11.2 品牌一致性
- 使用OpenWork设计系统（颜色、字体、间距）
- 复用图标库
- 保持交互动画一致

---

## 12. 预估资源

| 项目 | 预估 |
|------|------|
| **开发时间** | 10-14周（2-3名开发者） |
| **iOS开发者** | 0.5 FTE（原生模块、发布） |
| **Android开发者** | 0.5 FTE（原生模块、发布） |
| **React Native开发者** | 1.5 FTE（核心业务） |
| **后端改造** | 1周（owpenbot mobile channel） |
| **年度维护成本** | 约2-3人周/年 |

---

## 13. 替代方案对比

| 方案 | 开发时间 | 性能 | 维护成本 | 推荐指数 |
|------|---------|------|---------|---------|
| **React Native** | 10-14周 | ⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐⭐ |
| Flutter | 12-16周 | ⭐⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐ |
| PWA | 4-6周 | ⭐⭐⭐ | 低 | ⭐⭐⭐ |
| 原生iOS+Android | 20-30周 | ⭐⭐⭐⭐⭐ | 高 | ⭐⭐ |

---

## 14. 决策建议

### 立即执行
1. **选择React Native**作为技术栈
2. **创建原型**验证关键流程（连接服务器→发送消息→接收回复）
3. **设计owpenbot mobile channel**接口规范

### 下一步
1. 搭建开发环境（React Native + TypeScript）
2. 实现owpenbot后端改造
3. 开发MVP版本

### 风险缓解
- **技术风险**: React Native New Architecture尚不稳定，使用旧架构
- **资源风险**: 如果团队不熟悉React Native，考虑先开发PWA验证市场
- **时间风险**: MVP阶段聚焦核心聊天功能，其他功能延后

---

## 15. 附录

### A. 参考资源
- React Native: https://reactnative.dev/
- React Navigation: https://reactnavigation.org/
- React Native Gifted Chat: https://github.com/FaridSafi/react-native-gifted-chat

### B. 相关文档
- OpenCode SDK: `@opencode-ai/sdk`
- owpenbot API: `packages/owpenbot/src/health.ts`
- OpenWork架构: `ARCHITECTURE.md`

---

*方案设计日期: 2025年2月*
*版本: 1.0*
