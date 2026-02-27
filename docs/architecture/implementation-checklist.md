# 需求-工作区-仓库架构实施检查清单

> 对应设计文档: [requirement-workspace-repo-design.md](./requirement-workspace-repo-design.md)

## Phase 1: 基础架构（1-2周）

### 类型定义
- [ ] 创建 `packages/app/src/types/workspace-extension.ts`
  - [ ] OpenworkWorkspaceConfig 接口
  - [ ] RepositoryConfig 接口
  - [ ] RequirementContext 接口
  - [ ] VirtualWorkspace 接口
  - [ ] 其他相关类型

### 配置管理器
- [ ] 实现 `packages/app/src/lib/workspace/config-manager.ts`
  - [ ] load() 方法
  - [ ] save() 方法
  - [ ] addRepository() 方法
  - [ ] removeRepository() 方法
  - [ ] configureTFS() 方法
  - [ ] enableVirtualWorkspace() 方法

### 配置验证
- [ ] 添加 JSON Schema 验证
- [ ] 配置版本迁移逻辑
- [ ] 向后兼容性处理

## Phase 2: 仓库管理（2-3周）

### Repository Manager
- [ ] 实现 `packages/app/src/lib/repository/manager.ts`
  - [ ] initialize() 方法
  - [ ] checkRepositoryStatus() 方法
  - [ ] cloneRepository() 方法
  - [ ] createFeatureBranch() 方法
  - [ ] cloneAllMissing() 方法
  - [ ] 其他辅助方法

### Git Client 扩展
- [ ] 扩展 `packages/app/src/automation/git/client.ts`
  - [ ] 批量操作支持
  - [ ] 进度回调
  - [ ] 错误重试机制

### 远程 URL 解析
- [ ] 创建 `packages/app/src/lib/repository/remote-resolver.ts`
  - [ ] 从 repositories.json 映射到实际 URL
  - [ ] SSH/HTTPS 切换
  - [ ] 认证信息处理

## Phase 3: 虚拟工作区（2-3周）

### Virtual Workspace Manager
- [ ] 实现 `packages/app/src/lib/workspace/virtual-manager.ts`
  - [ ] createVirtualWorkspace() 方法
  - [ ] activateVirtualWorkspace() 方法
  - [ ] archiveVirtualWorkspace() 方法
  - [ ] cleanupVirtualWorkspace() 方法
  - [ ] autoCleanup() 方法

### 目录结构初始化
- [ ] 创建目录结构模板
- [ ] 复制父工作区配置
- [ ] 初始化 .opencode 目录

### 生命周期管理
- [ ] 工作区状态机
- [ ] 自动清理策略
- [ ] 归档压缩
- [ ] 过期检查

## Phase 4: Task Center 集成（1-2周）

### 需求上下文构建器
- [ ] 实现 `packages/app/src/lib/session/requirement-context-builder.ts`
  - [ ] buildSystemPrompt() 函数
  - [ ] createRequirementSession() 函数
  - [ ] 路径解析器

### Task Center 扩展
- [ ] 创建 `packages/app/src/app/context/task-center-workspace-integration.ts`
  - [ ] initializeManagers() 方法
  - [ ] prepareWorkspaceForTask() 方法
  - [ ] 与现有 Task Center 集成

### 执行流程
- [ ] executeRequirement() 函数
- [ ] 任务解析和执行
- [ ] 代码变更追踪
- [ ] 自动提交逻辑

## Phase 5: UI/UX（1-2周）

### 工作区配置面板
- [ ] 创建 `packages/app/src/app/components/workspace-config-panel.tsx`
  - [ ] 仓库配置标签页
  - [ ] TFS 配置标签页
  - [ ] 虚拟工作区配置标签页
  - [ ] 自动化配置标签页

### 状态显示
- [ ] 仓库状态徽章
- [ ] 虚拟工作区状态指示器
- [ ] 代码变更预览

### 操作流程
- [ ] 创建工作区向导
- [ ] 一键准备环境按钮
- [ ] 工作区切换确认

## 测试计划

### 单元测试
- [ ] ConfigManager 测试
- [ ] RepositoryManager 测试
- [ ] VirtualWorkspaceManager 测试
- [ ] PathResolver 测试

### 集成测试
- [ ] 完整需求执行流程测试
- [ ] 虚拟工作区生命周期测试
- [ ] 多仓库协同测试

### E2E 测试
- [ ] 从 TFS 同步到代码提交的完整流程
- [ ] 虚拟工作区自动清理测试

## 文档计划

- [ ] API 文档生成
- [ ] 使用指南编写
- [ ] 配置示例整理
- [ ] 故障排除手册

## 验收标准

- [ ] 可以为一个需求创建虚拟工作区
- [ ] 可以自动 clone 多个仓库
- [ ] AI 能够正确识别 repos/ 目录结构
- [ ] AI 可以修改多个仓库的代码
- [ ] 代码可以自动提交到远程
- [ ] 虚拟工作区可以自动清理
- [ ] 复用现有工作区策略正常工作

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 仓库 clone 耗时太长 | 用户体验差 | 支持复用现有工作区、显示进度、后台 clone |
| AI 理解错路径 | 代码改错位置 | 严格的 System Prompt、路径验证 |
| 虚拟工作区占用磁盘 | 磁盘空间不足 | 自动清理策略、大小限制 |
| 认证信息泄露 | 安全风险 | 使用 credential helper、不存储明文密码 |

## 时间线

```
Week 1-2:  Phase 1 (基础架构)
Week 3-5:  Phase 2 (仓库管理)
Week 6-8:  Phase 3 (虚拟工作区)
Week 9-10: Phase 4 (Task Center 集成)
Week 11-12: Phase 5 (UI/UX) + 测试
```

总计: 约 12 周

---

*创建: 2026-02-26*
*更新: 待更新*
