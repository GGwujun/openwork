# Design: OpenWork → Wwork 品牌改名

## Overview

本文档详细说明品牌改名的技术实现方案，确保修改完整、一致、可追溯。

## 命名规范

### 核心原则

1. **大小写规则**
   - 代码/文件名: `wwork` (全小写)
   - 品牌显示: `Wwork` (首字母大写)
   - 包名 scope: `@wwork/*` (小写)
   - Rust crate: `wwork` (snake_case)
   - Rust 类型: `Wwork*` (PascalCase)

2. **缩写处理**
   - CLI 命令: `wwork` (不是 `ww`)
   - 机器人: `wwbot` (不是 `wb`)

3. **公司关联**
   - Tauri identifier: `com.winninghealth.wwork`
   - 体现卫宁公司 (Winning Health)

## 文件分类与修改策略

### Category A: 配置类文件（最高优先级）

这些文件直接控制包名和构建产物，必须准确修改。

| 文件 | 修改内容 | 验证方式 |
|------|----------|----------|
| `package.json` | `"name": "openwork"` → `"wwork"` | `cat package.json \| grep '"name"'` |
| `packages/*/package.json` | `"@openwork/*"` → `"@wwork/*"` | 同上 |
| `tauri.conf.json` | `productName`, `identifier`, `title`, `sidecars` | JSON 校验 |
| `tauri.dev.conf.json` | 同上 | 同上 |
| `Cargo.toml` | `name`, `description` | `cargo check` |
| `capabilities/default.json` | `identifier` | JSON 校验 |

### Category B: 代码类文件（中优先级）

包含品牌字符串和常量的源代码。

| 文件类型 | 示例 | 修改策略 |
|----------|------|----------|
| TypeScript/TSX | `i18n/locales/*.ts`, `lib/tauri.ts` | grep + 手动检查 |
| Rust | `lib.rs`, `commands/*.rs` | grep + 编译检查 |
| 构建脚本 | `scripts/*.mjs`, `*.ts` | grep + 执行测试 |

### Category C: 资源类文件（低优先级）

Logo、图标、静态资源。

| 文件 | 操作 | 说明 |
|------|------|------|
| `openwork-logo.tsx` | 重命名 → `wwork-logo.tsx` | 组件文件 |
| `icons/*` | 替换 | 需设计提供新图标 |
| `public/logo.*` | 替换 | 同上 |

### Category D: 文档类文件（最后执行）

| 文件 | 修改范围 |
|------|----------|
| `README.md` | 标题、描述、安装命令 |
| `VISION.md` | 品牌引用 |
| `PRODUCT.md` | 品牌引用 |
| `AGENTS.md` | 品牌引用 |
| `packages/*/README.md` | 包级文档 |

## Sidecar 名称映射

```
旧名称              →  新名称
openwork-server    →  wwork-server
owpenbot           →  wwbot
openwrk            →  wwork
```

### 影响文件清单

1. **Tauri 配置**
   - `tauri.conf.json` → `bundle.externalBin`
   
2. **构建脚本**
   - `build-bin.ts` → 输出文件名
   - `build-sidecars.mjs` → 构建配置
   - `prepare-sidecar.mjs` → 复制逻辑

3. **Headless 包**
   - `package.json` → `dependencies`
   - CLI 实现中的 sidecar 引用

## Rust 代码修改细节

### 模块重命名

```
src/commands/
├── mod.rs          # 更新 pub mod 声明
├── openwrk.rs      → 重命名为 wwork.rs
└── owpenbot.rs     → 重命名为 wwbot.rs
```

### 类型重命名

| 旧类型名 | 新类型名 |
|----------|----------|
| `OpenwrkManager` | `WworkManager` |
| `OwpenbotManager` | `WwbotManager` |
| `openwrk_status` | `wwork_status` |

### 字符串常量

```rust
// 旧
const APP_NAME: &str = "OpenWork";

// 新
const APP_NAME: &str = "Wwork";
```

## 依赖关系图

```
[Root package.json]
    │
    ├──→ [packages/app/package.json] @wwork/app
    ├──→ [packages/server/package.json] @wwork/server
    ├──→ [packages/desktop/package.json] @wwork/desktop
    ├──→ [packages/headless/package.json] wwork
    ├──→ [packages/owpenbot/package.json] @wwork/wwbot
    ├──→ [packages/landing/package.json] @wwork/landing
    └──→ [packages/agent-lab/package.json] @wwork/agent-lab

[Tauri Config]
    │
    ├──→ [Cargo.toml] crate name: wwork
    ├──→ [tauri.conf.json] productName: Wwork
    └──→ [capabilities] identifier: com.winninghealth.wwork

[Sidecars]
    │
    ├──→ wwork-server (原 openwork-server)
    ├──→ wwbot (原 owpenbot)
    └──→ wwork (原 openwrk)
```

## 修改顺序建议

### Phase 1: 基础配置（依赖最少）
1. Root `package.json`
2. 各包 `package.json`
3. `Cargo.toml`

### Phase 2: Tauri 配置（依赖 Phase 1）
1. `tauri.conf.json`
2. `tauri.dev.conf.json`
3. `capabilities/default.json`

### Phase 3: 构建脚本（依赖 Phase 1-2）
1. `build-bin.ts`
2. `build-sidecars.mjs`
3. `prepare-sidecar.mjs`

### Phase 4: 源代码（依赖 Phase 1-3）
1. TypeScript 代码
2. Rust 代码（文件重命名 + 内容修改）

### Phase 5: 文档（最后）
1. 根目录文档
2. 包级文档

## 验证检查清单

### 静态检查
- [ ] `grep -r "openwork" --include="*.json" .` 无结果（除保留项）
- [ ] `grep -r "OpenWork" --include="*.ts" --include="*.tsx" .` 无结果
- [ ] `grep -r "openwrk" --include="*.ts" .` 无结果
- [ ] `grep -r "owpenbot" .` 无结果（除历史引用）

### 动态检查
- [ ] `pnpm install` 成功
- [ ] `cargo check` 成功（Tauri 目录）
- [ ] JSON 配置文件语法正确

### 保留项确认
- [ ] GitHub URL 仍为 `different-ai/openwork`
- [ ] `opencode` 引用未变
- [ ] API 端点未变

## 风险与缓解

| 风险 | 可能性 | 缓解措施 |
|------|--------|----------|
| 遗漏某些文件 | 中 | 全局搜索 + 多轮验证 |
| 破坏构建 | 中 | 每阶段后执行构建检查 |
| npm 包冲突 | 低 | 提前检查 `@wwork` scope 可用性 |
| 用户数据丢失 | 中 | 文档说明 + 迁移指南 |

## 回滚方案

如需要回滚：
1. 使用 git revert 撤销所有提交
2. 或从改名前分支重新开发

建议：在执行前创建分支 `backup/pre-rebrand`

## 后续工作

改名完成后需要：
1. 发布新的 npm 包 `@wwork/*`
2. 更新 CI/CD 配置
3. 更新官网和文档站点
4. 通知用户迁移（提供迁移指南）
