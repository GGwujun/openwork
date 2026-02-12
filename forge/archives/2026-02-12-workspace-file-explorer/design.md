# Design: Workspace File Explorer

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Session View                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Main Content Area                                  │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ File Preview (点击文件后显示)                 │   │   │
│  │  │ ┌─────────────────────────────────────────┐ │   │   │
│  │  │ │ src/components/button.tsx          [×] │ │   │   │
│  │  │ ├─────────────────────────────────────────┤ │   │   │
│  │  │ │ 1  │ import { ... } from 'solid-js';   │ │   │   │
│  │  │ │ 2  │                                    │ │   │   │
│  │  │ │ 3  │ export function Button() {        │ │   │   │
│  │  │ │ 4  │   return (                         │ │   │   │
│  │  │ │ ... │                                    │ │   │   │
│  │  │ └─────────────────────────────────────────┘ │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Right Sidebar                                      │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ [Work] [项目目录] ← 右侧菜单 Tab              │   │   │
│  │  │                                             │   │   │
│  │  │ Work 视图: 现有右侧内容                       │   │   │
│  │  │ 项目目录 视图:                               │   │   │
│  │  │ ▼ src/                                      │   │   │
│  │  │   ▼ components/                             │   │   │
│  │  │     - button.tsx                            │   │   │
│  │  │     - modal.tsx                             │   │   │
│  │  │   - app.tsx                                 │   │   │
│  │  │ - package.json                              │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Backend                           │
│  ┌─────────────────┐      ┌─────────────────┐              │
│  │  fs_read_dir    │      │  fs_read_file   │              │
│  │  - 读取目录      │      │  - 读取文件      │              │
│  │  - 返回文件列表  │      │  - 检测语言      │              │
│  │  - 过滤二进制    │      │  - 大小限制      │              │
│  │  - 路径校验      │      │  - 路径校验      │              │
│  └─────────────────┘      └─────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. 右侧 Tab 设计

- 右侧菜单区域新增 `[Work] [项目目录]` Tab
- Work Tab 保留现有右侧内容
- 项目目录 Tab 展示文件树

### 2. 文件树懒加载

- 初始只加载第一层目录
- 点击目录展开时才加载子目录
- 使用展开状态缓存避免重复加载

### 3. 文件预览策略

- 点击文件时异步加载内容
- 使用 `FilePreview` 组件展示内容（`<pre>` 只读渲染）
- 大文件（>1MB）拒绝加载
- 二进制文件显示"不支持预览"提示

### 4. 状态管理

```typescript
// Session View 中的右侧 Tab 与文件预览状态
{
  rightSidebarTab: "work" | "files",
  expandedFilePathsByWorkspace: {
    "workspace-id-1": ["/src", "/src/components"],
  },
  selectedFilePath: "/src/app.tsx"
}
```

### 5. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 目录读取失败 | FileTree 错误态 |
| 文件读取失败 | FilePreview 错误态 |
| 文件过大 | 后端拒绝 + 错误提示 |
| 二进制文件 | 显示不支持提示 |
| 路径越界 | 拒绝访问 |

## Data Flow

### 文件树加载流程

```
1. 用户点击 [项目目录] 切换
   │
   ▼
2. FileTree 调用 fs_read_dir(path, workspace_root)
   │
   ▼
3. Tauri 后端读取目录，返回 FileEntry[]
   - 过滤隐藏文件（.git, node_modules 等）
   - 标记目录/文件类型
   │
   ▼
4. FileTree 组件渲染
   - 目录可展开/收起
   - 文件可点击
```

### 文件预览流程

```
1. 用户点击文件
   │
   ▼
2. FileTree 调用 onSelectFile(path)
   │
   ▼
3. SessionView 调用 fs_read_file(path, workspace_root)
   │
   ▼
4. Tauri 后端:
   - 校验 path 是否在 workspace_root 内
   - 检测文件类型
   - 读取内容（限制大小）
   - 返回 FileReadResult
   │
   ▼
5. FilePreview 组件渲染
```

## Component Structure

```
SessionView
├── RightSidebar
│   ├── TabSwitch [Work|项目目录]
│   ├── WorkPanel (现有)
│   └── FileTree (新增)
│       └── FileTreeItem
│           ├── Directory (可展开)
│           └── File (可点击)
└── MainContent
    └── FilePreview (新增)
```

## Performance Considerations

1. **懒加载**：目录展开时才读取子目录
2. **缓存**：已加载的目录结构缓存
3. **忽略旧请求**：切换文件时忽略旧请求结果

---

**Status**: Complete  
**Related**: intent.md, contracts/*
