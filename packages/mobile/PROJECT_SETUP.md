# OpenWork Mobile 项目搭建完成！

🎉 **恭喜！** React Native项目脚手架已经搭建完成。

## 📁 项目结构

```
packages/mobile/
├── App.tsx                      # 应用入口
├── index.js                     # Expo注册
├── package.json                 # 依赖配置
├── tsconfig.json               # TypeScript配置
├── babel.config.js             # Babel配置
├── metro.config.js             # Metro配置
├── .eslintrc.js                # ESLint配置
├── .prettierrc                 # Prettier配置
├── .env.example                # 环境变量示例
├── README.md                   # 项目说明
│
└── src/                        # 源代码
    ├── api/                    # API客户端
    │   ├── client.ts          # Axios封装
    │   ├── auth.ts            # 认证API
    │   └── sessions.ts        # 会话API
    │
    ├── components/            # UI组件
    │   └── common/           # 通用组件
    │       ├── Button.tsx    # 按钮组件
    │       └── Input.tsx     # 输入框组件
    │
    ├── screens/              # 页面
    │   ├── auth/            # 认证
    │   │   └── ServerConnectScreen.tsx
    │   ├── session/         # 会话
    │   │   └── SessionListScreen.tsx
    │   ├── chat/           # 聊天
    │   │   └── ChatScreen.tsx
    │   └── settings/       # 设置
    │       └── SettingsScreen.tsx
    │
    ├── navigation/         # 导航配置
    │   └── index.tsx
    │
    ├── store/             # 状态管理
    │   ├── authStore.ts  # 认证状态
    │   └── sessionStore.ts # 会话状态
    │
    ├── utils/            # 工具函数
    │   ├── storage.ts   # 存储封装
    │   └── helpers.ts   # 通用工具
    │
    ├── constants/       # 常量
    │   └── index.ts
    │
    └── types/          # 类型定义
        └── index.ts
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd packages/mobile
npm install
```

**注意**: 首次安装可能需要10-15分钟。

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
EXPO_PUBLIC_API_URL=http://localhost:3005
EXPO_PUBLIC_WS_URL=ws://localhost:3006
```

### 3. 启动开发服务器

```bash
# iOS（需要Mac + Xcode）
npm run ios

# Android（需要Android Studio）
npm run android

# 或者启动Expo开发服务器
npm start
```

### 4. 在手机上预览

使用Expo Go App扫描二维码即可在真机上预览。

## ✅ 已实现功能

- ✅ **项目架构**: Expo + React Native + TypeScript
- ✅ **导航**: React Navigation（Stack + Tab）
- ✅ **状态管理**: Zustand（持久化）
- ✅ **存储**: MMKV + SecureStore
- ✅ **UI组件**: Button、Input基础组件
- ✅ **认证页面**: 服务器连接界面
- ✅ **会话列表**: 基础列表展示
- ✅ **API封装**: Axios + 拦截器 + 错误处理
- ✅ **类型定义**: TypeScript类型完整
- ✅ **路径别名**: @/* 路径支持

## 📝 下一步开发任务

### 优先级1（本周完成）

1. **测试当前代码**
   ```bash
   npm start
   ```
   确保没有报错，页面能正常显示。

2. **后端API联调**
   - 创建测试服务器
   - 验证设备注册流程
   - 验证会话列表获取

3. **完善服务器连接页面**
   - 添加设备注册逻辑
   - 添加生物识别设置引导
   - 完善错误提示

### 优先级2（下周完成）

4. **聊天界面开发**
   - 消息列表组件
   - 消息输入框
   - Markdown渲染
   - 代码高亮集成

5. **WebSocket集成**
   - 连接管理
   - 消息接收
   - 自动重连

### 优先级3（后续开发）

6. **推送通知**
7. **离线支持**
8. **性能优化**

## 🔧 常用命令

```bash
# 开发
npm start              # 启动Expo开发服务器
npm run ios           # 启动iOS模拟器
npm run android       # 启动Android模拟器
npm run web           # 启动Web版本

# 代码质量
npm run lint          # 运行ESlint
npm run typecheck     # 运行TypeScript检查
npm run format        # 格式化代码

# 测试
npm test              # 运行测试
```

## 📚 项目文档

- [MVP功能清单](docs/owpenbot-mobile-mvp-features.md)
- [开发计划](docs/owpenbot-mobile-development-plan.md)
- [技术方案](docs/owpenbot-mobile-pro-architecture.md)

## ⚠️ 已知问题

### 1. 路径别名配置
目前路径别名（@/*）需要在tsconfig.json和babel.config.js中配置。如果遇到模块找不到的错误，请检查配置是否正确。

### 2. 原生模块
由于使用Expo Managed Workflow，某些原生模块可能无法使用。如需使用，请考虑eject到Bare Workflow。

### 3. 类型报错
首次安装后可能会有类型报错，尝试运行：
```bash
rm -rf node_modules package-lock.json
npm install
```

## 💡 开发建议

1. **使用TypeScript严格模式**: 项目中已启用严格模式，确保类型安全。

2. **组件开发规范**:
   - 使用函数式组件 + Hooks
   - Props必须有类型定义
   - 复杂组件添加注释

3. **状态管理**:
   - 认证状态使用Zustand + 持久化
   - 服务端状态使用React Query（待集成）
   - 避免直接修改状态

4. **API调用**:
   - 统一使用src/api/client.ts
   - 错误处理已封装，直接使用
   - Token自动刷新已配置

## 🐛 调试技巧

### 1. 查看日志
```bash
# 查看React Native日志
npx react-native log-ios    # iOS
npx react-native log-android # Android
```

### 2. 使用React Native Debugger
```bash
# 安装
brew install react-native-debugger

# 启动
open "rndebugger://set-debugger-loc?host=localhost&port=8081"
```

### 3. 网络调试
使用Flipper查看网络请求。

## 📱 测试设备要求

- **iOS**: iPhone 12+（iOS 15+）
- **Android**: Android 10+（API 29+）

## 🤝 团队协作

### Git工作流

1. 创建功能分支
   ```bash
   git checkout -b feature/功能名
   ```

2. 提交代码
   ```bash
   git add .
   git commit -m "feat: 添加xxx功能"
   ```

3. 提交前检查
   ```bash
   npm run lint
   npm run typecheck
   ```

### 代码审查清单

- [ ] TypeScript无报错
- [ ] ESLint无警告
- [ ] 代码格式化
- [ ] 组件有类型定义
- [ ] 无console.log（除错误外）

## 🎯 本周目标

完成以下任务，达到**Milestone 1**:

- [ ] 项目能正常运行，无报错
- [ ] 服务器连接页面能输入地址并验证
- [ ] 会话列表能显示（使用Mock数据）
- [ ] 代码架构被团队认可

## 📞 需要帮助？

如果遇到问题：

1. 查看[React Native文档](https://reactnative.dev/)
2. 查看[Expo文档](https://docs.expo.dev/)
3. 在团队群提问
4. 检查docs/目录下的文档

---

**开始开发吧！** 🚀

先运行 `npm install` 安装依赖，然后 `npm start` 启动项目。
