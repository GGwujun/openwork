# Owpenbot Mobile

面向专业开发者的AI编程助手移动应用。

## 技术栈

- **框架**: React Native + Expo (Managed Workflow)
- **导航**: React Navigation 6
- **状态管理**: Zustand + React Query
- **UI组件**: React Native Paper
- **存储**: MMKV + SQLite
- **网络**: Axios

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Expo CLI: `npm install -g expo-cli`
- iOS: macOS + Xcode 15+
- Android: Android Studio + Android SDK

### 安装依赖

```bash
npm install
```

### 开发环境配置

1. 复制环境变量文件
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置你的开发环境

### 启动开发服务器

```bash
# 启动 Expo 开发服务器
npm start

# 或者在特定平台运行
npm run ios
npm run android
```

### 运行测试

```bash
# 运行单元测试
npm test

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

## 项目结构

```
src/
├── api/              # API客户端和类型定义
├── components/       # UI组件
│   ├── common/      # 通用组件
│   ├── chat/        # 聊天相关组件
│   └── session/     # 会话相关组件
├── screens/          # 页面
│   ├── auth/        # 认证相关
│   ├── chat/        # 聊天页面
│   ├── session/     # 会话管理
│   └── settings/    # 设置页面
├── store/           # 状态管理
├── hooks/           # 自定义Hooks
├── utils/           # 工具函数
├── constants/       # 常量
└── types/           # TypeScript类型定义
```

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- ESLint + Prettier 自动格式化
- 组件使用函数式组件 + Hooks
- 状态管理使用 Zustand

### Git 工作流

- 主分支: `main`
- 开发分支: `develop`
- 功能分支: `feature/功能名`
- Bug修复: `fix/bug描述`

### 提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

## 发布流程

### 测试版 (Internal Testing)

```bash
# iOS TestFlight
eas build --platform ios --profile preview

# Android Internal Testing
eas build --platform android --profile preview
```

### 生产版 (Production)

```bash
# iOS App Store
eas build --platform ios --profile production

# Android Play Store
eas build --platform android --profile production
```

## 常见问题

### Q: 如何清除缓存？

```bash
npx expo start --clear
```

### Q: 如何调试网络请求？

使用 React Native Debugger 或 Flipper。

### Q: 如何处理原生模块问题？

由于是 Managed Workflow，如需原生模块，请先评估是否可以使用 Expo Modules API。

## 许可证

MIT
