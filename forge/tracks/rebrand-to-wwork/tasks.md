# Tasks: OpenWork → Wwork 品牌改名

## Phase 0: 近期更新核对 (10分钟)

### 0.1 全局扫描与新增命中
- [ ] 重新扫描关键字：`OpenWork` / `openwork` / `openwrk` / `owpenbot`
- [ ] 记录新增命中文件并纳入修改范围：
  - [ ] `packages/desktop/src-tauri/src/openwork_server/*`
  - [ ] `packages/desktop/src-tauri/src/commands/openwork_server.rs`
  - [ ] `packages/headless/bin/openwrk`
  - [ ] `.opencode/openwork.json`
  - [ ] `.opencode/agents/openwork.md`
- [ ] 对新增文件给出“改名/保留”结论并记录在保留项清单

## Phase 1: 包名与配置 (30分钟)

### 1.1 Root 项目配置
- [ ] 修改根目录 `package.json`
  - [ ] `"name": "openwork"` → `"wwork"`
  - [ ] 更新 `description` 中的品牌名
  - [ ] 检查 `scripts` 中的品牌引用

### 1.2 App 包配置
- [ ] 修改 `packages/app/package.json`
  - [ ] `"name": "@openwork/app"` → `"@wwork/app"`
  - [ ] 检查 `scripts`
  - [ ] 检查 `dependencies` 中的内部包引用

### 1.3 Server 包配置
- [ ] 修改 `packages/server/package.json`
  - [ ] `"name": "@openwork/server"` → `"@wwork/server"`
  - [ ] 检查 `bin` 字段: `openwork-server` → `wwork-server`

### 1.4 Desktop 包配置
- [ ] 修改 `packages/desktop/package.json`
  - [ ] `"name": "@openwork/desktop"` → `"@wwork/desktop"`
  - [ ] 检查 `scripts` 中的品牌引用

### 1.5 Headless (CLI) 包配置
- [ ] 修改 `packages/headless/package.json`
  - [ ] `"name": "openwrk"` → `"wwork"`
  - [ ] 检查 `description`
  - [ ] 检查 `keywords` 中的 `openwork`
  - [ ] 检查 `scripts` 中的 `build:bin` 文件名

### 1.6 Owpenbot → Wwbot 包配置
- [ ] 修改 `packages/owpenbot/package.json`
  - [ ] `"name": "@openwork/owpenbot"` → `"@wwork/wwbot"`
  - [ ] `"bin": "owpenbot"` → `"wwbot"`
  - [ ] 检查 `description` 和 `keywords`

### 1.7 Landing 包配置
- [ ] 修改 `packages/landing/package.json`
  - [ ] `"name": "@openwork/landing"` → `"@wwork/landing"`

### 1.8 Mobile 配置
- [ ] 修改 `packages/mobile/app.json`
  - [ ] `"name": "openwork"` → `"wwork"`
  - [ ] `"slug": "openwork"` → `"wwork"`

### 1.9 Agent Lab 包配置
- [ ] 修改 `packages/agent-lab/package.json`
  - [ ] `"name": "@openwork/agent-lab"` → `"@wwork/agent-lab"`

### 1.10 验证 Phase 1
- [ ] 运行 `grep -r '"@openwork' */package.json` 确认无残留
- [ ] 运行 `grep -r '"openwrk"' */package.json` 确认无残留
- [ ] 运行 `grep -r '"owpenbot"' */package.json` 确认无残留

---

## Phase 2: Tauri/Rust 配置 (20分钟)

### 2.1 Cargo.toml 修改
- [ ] 修改 `packages/desktop/src-tauri/Cargo.toml`
  - [ ] `name = "openwork"` → `name = "wwork"`
  - [ ] `description = "OpenWork"` → `description = "Wwork"`

### 2.2 Tauri 主配置
- [ ] 修改 `packages/desktop/src-tauri/tauri.conf.json`
  - [ ] `"productName": "OpenWork"` → `"Wwork"`
  - [ ] `"identifier": "com.differentai.openwork"` → `"com.winninghealth.wwork"`
  - [ ] `"title": "OpenWork"` → `"Wwork"`
  - [ ] `bundle.externalBin`:
    - [ ] `"sidecars/openwork-server"` → `"sidecars/wwork-server"`
    - [ ] `"sidecars/owpenbot"` → `"sidecars/wwbot"`
    - [ ] `"sidecars/openwrk"` → `"sidecars/wwork"`

### 2.3 Tauri 开发配置
- [ ] 修改 `packages/desktop/src-tauri/tauri.dev.conf.json`
  - [ ] 同步所有 2.2 的修改

### 2.4 Capabilities 配置
- [ ] 修改 `packages/desktop/src-tauri/capabilities/default.json`
  - [ ] `"identifier": "openwork"` → `"wwork"`

### 2.5 验证 Phase 2
- [ ] `cargo check` 在 `src-tauri` 目录执行成功
- [ ] JSON 配置文件语法正确

---

## Phase 3: 构建脚本与 Sidecars (30分钟)

### 3.1 Headless 构建脚本
- [ ] 修改 `packages/headless/scripts/build-bin.ts`
  - [ ] `openwork-server` 输出名 → `wwork-server`
  - [ ] `owpenbot` 输出名 → `wwbot`
  - [ ] 更新 `versions.json` 中的 key

### 3.2 Headless 构建配置
- [ ] 修改 `packages/headless/package.json` 中的脚本
  - [ ] `build:bin` 中的 `--filename openwrk` → `--filename wwork`

### 3.3 Desktop Sidecar 准备脚本
- [ ] 修改 `packages/desktop/scripts/prepare-sidecar.mjs`
  - [ ] 更新 sidecar 文件名引用

### 3.4 Desktop 构建脚本
- [ ] 修改 `packages/desktop/src-tauri/build.rs`
  - [ ] 更新 sidecar 文件名与产物名

### 3.5 Owpenbot 构建脚本
- [ ] 修改 `packages/headless/scripts/build-owpenbot.mjs`
  - [ ] 更新产物名与输出路径

### 3.6 Headless 依赖引用
- [ ] 修改 `packages/headless/package.json`
  - [ ] `"openwork-server": "x.x.x"` → `"wwork-server": "x.x.x"`
  - [ ] `"owpenwork": "x.x.x"` → `"wwbot": "x.x.x"`

### 3.7 Server CLI 名称
- [ ] 修改 `packages/server/src/cli.ts`
  - [ ] 检查 CLI 名称和帮助文本

### 3.8 验证 Phase 3
- [ ] 检查所有构建脚本可执行
- [ ] Sidecar 文件名映射正确

---

## Phase 4: TypeScript/JavaScript 代码 (40分钟)

### 4.1 i18n 语言文件
- [ ] 修改 `packages/app/src/i18n/locales/en.ts`
  - [ ] `"OpenWork"` → `"Wwork"`
- [ ] 修改 `packages/app/src/i18n/locales/zh.ts`
  - [ ] `"OpenWork"` → `"Wwork"`

### 4.2 App 工具库
- [ ] 修改 `packages/app/src/app/lib/tauri.ts`
  - [ ] 检查窗口标题等常量
- [ ] 重命名 `packages/app/src/app/lib/openwork-server.ts` → `wwork-server.ts`
  - [ ] 更新所有导入引用

### 4.3 Headless CLI
- [ ] 修改 `packages/headless/src/cli.ts`
  - [ ] `openwrk` → `wwork`
  - [ ] 更新帮助文本和命令名

### 4.4 Headless TUI
- [ ] 修改 `packages/headless/src/tui/app.tsx`
  - [ ] 品牌显示名更新

### 4.5 Owpenbot 源码
- [ ] 修改 `packages/owpenbot/src/config.ts`
  - [ ] 常量 `owpenbot` → `wwbot`
- [ ] 修改 `packages/owpenbot/src/bridge.ts`
  - [ ] 品牌引用更新
- [ ] 修改 `packages/owpenbot/src/cli.ts`
  - [ ] CLI 名称和帮助文本

### 4.6 App 系统状态
- [ ] 修改 `packages/app/src/app/system-state.ts`
  - [ ] 检查品牌常量

### 4.7 Mobile 常量
- [ ] 修改 `packages/mobile/src/constants/index.ts`
  - [ ] 检查品牌引用

### 4.8 Mobile 存储
- [ ] 修改 `packages/mobile/src/utils/storage.ts`
  - [ ] Storage key: `openwork` → `wwork`

### 4.9 验证 Phase 4
- [ ] `grep -r "openwork" packages/*/src --include="*.ts" --include="*.tsx"` 无结果
- [ ] `grep -r "openwrk" packages/*/src --include="*.ts"` 无结果
- [ ] `grep -r "owpenbot" packages/*/src --include="*.ts"` 无结果

---

## Phase 5: Rust 代码 (30分钟)

### 5.1 openwork_server 模块重命名
- [ ] 重命名 `packages/desktop/src-tauri/src/commands/openwork_server.rs` → `wwork_server.rs`
- [ ] 重命名 `packages/desktop/src-tauri/src/openwork_server/` → `wwork_server/`

### 5.2 模块文件重命名
- [ ] 重命名 `packages/desktop/src-tauri/src/commands/openwrk.rs` → `wwork.rs`
- [ ] 重命名 `packages/desktop/src-tauri/src/commands/owpenbot.rs` → `wwbot.rs`
- [ ] 如存在 `packages/desktop/src-tauri/src/openwrk/`，重命名为 `wwork/`

### 5.3 模块声明更新
- [ ] 修改 `packages/desktop/src-tauri/src/commands/mod.rs`
  - [ ] `pub mod openwrk;` → `pub mod wwork;`
  - [ ] `pub mod owpenbot;` → `pub mod wwbot;`
  - [ ] `pub mod openwork_server;` → `pub mod wwork_server;`

### 5.4 lib.rs 更新
- [ ] 修改 `packages/desktop/src-tauri/src/lib.rs`
  - [ ] `openwrk_status` → `wwork_status`
  - [ ] `OpenwrkManager` → `WworkManager`
  - [ ] `openwrk` 变量名 → `wwork`
  - [ ] `OwpenbotManager` → `WwbotManager`
  - [ ] `owpenbot` 变量名 → `wwbot`
  - [ ] `openwork_server` → `wwork_server`

### 5.5 类型定义
- [ ] 修改 `packages/desktop/src-tauri/src/types.rs`
  - [ ] 检查并更新相关类型名

### 5.6 验证 Phase 5
- [ ] `cargo check` 成功
- [ ] `cargo build` 成功

---

## Phase 6: 脚本与工具 (20分钟)

### 6.1 开发脚本
- [ ] 修改 `scripts/dev-headless-web.ts`
  - [ ] `openwork` → `wwork`

### 6.2 发布脚本
- [ ] 修改 `scripts/release/*.mjs`
  - [ ] 更新品牌引用

### 6.3 AUR 打包
- [ ] 修改 `packaging/aur/PKGBUILD`
  - [ ] 包名 `openwork` → `wwork`
  - [ ] 更新描述和链接

### 6.4 Docker 配置
- [ ] 检查 `packaging/docker/*`
  - [ ] 镜像名和容器名

### 6.5 验证 Phase 6
- [ ] 脚本可正常执行

---

## Phase 7: Logo 与资源 (需设计，单独安排)

### 7.1 Logo 组件
- [ ] 重命名 `packages/app/src/app/components/openwork-logo.tsx` → `wwork-logo.tsx`
  - [ ] 更新组件内部的 SVG/文本
  - [ ] 更新所有导入引用

### 7.2 Tauri 图标
- [ ] 准备新的图标集（多尺寸 PNG + ICO + ICNS）
- [ ] 替换 `packages/desktop/src-tauri/icons/*`

### 7.3 应用公共资源
- [ ] 替换 `packages/app/public/logo.*`
- [ ] 替换 `packages/app/public/favicon.*`
- [ ] 替换 `packages/app/public/openwork-logo*.svg`

### 7.4 Landing 页面
- [ ] 替换 `packages/landing/public/` 中的 logo

### 7.5 验证 Phase 7
- [ ] 所有图标格式齐全
- [ ] 应用内显示正确

---

## Phase 8: 文档更新 (1小时)

### 8.1 根目录文档
- [ ] 修改 `README.md`
  - [ ] 标题 `# OpenWork` → `# Wwork`
  - [ ] 描述文本
  - [ ] 安装命令 `npm install -g openwrk` → `wwork`
  - [ ] 使用命令示例
- [ ] 修改 `VISION.md`
  - [ ] 所有 "OpenWork" → "Wwork"
- [ ] 修改 `PRODUCT.md`
  - [ ] 所有 "OpenWork" → "Wwork"
- [ ] 修改 `AGENTS.md`
  - [ ] 所有 "OpenWork" → "Wwork"
- [ ] 修改 `ARCHITECTURE.md`
  - [ ] 所有 "OpenWork" → "Wwork"
- [ ] 修改 `PRINCIPLES.md`
  - [ ] 所有 "OpenWork" → "Wwork"
- [ ] 修改 `RELEASE.md`
  - [ ] 所有 "OpenWork" → "Wwork"

### 8.2 包级文档
- [ ] 修改 `packages/headless/README.md`
  - [ ] `openwrk` → `wwork`
  - [ ] 所有命令示例
- [ ] 修改 `packages/owpenbot/README.md`
  - [ ] `owpenbot` → `wwbot`
  - [ ] 安装和使用说明
- [ ] 修改 `packages/owpenbot/USAGE.md`
  - [ ] 所有命令 `owpenbot` → `wwbot`
- [ ] 修改 `packages/server/README.md`
  - [ ] `openwork-server` → `wwork-server`
- [ ] 修改 `packages/landing/README.md`
  - [ ] 品牌引用

### 8.3 其他文档
- [ ] 检查 `docs/**/*.md`
- [ ] 检查 `pr/*.md`（保留历史，但更新关键引用）

### 8.4 验证 Phase 8
- [ ] `grep -r "OpenWork" *.md` 无结果（根目录）
- [ ] `grep -r "openwrk" */README.md` 无结果

---

## Phase 9: 验证与测试 (30分钟)

### 9.1 全局搜索验证
- [ ] `grep -ri "openwork" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.toml` .`
  - [ ] 确认只有保留项（GitHub URL、opencode 引用）
- [ ] `grep -ri "openwrk" --include="*.ts" --include="*.json` .`
  - [ ] 确认无残留
- [ ] `grep -ri "owpenbot" --include="*.ts" --include="*.json` .`
  - [ ] 确认无残留（除历史文档）

### 9.2 构建验证
- [ ] `pnpm install` 成功
- [ ] `pnpm typecheck` 通过
- [ ] `cd packages/desktop/src-tauri && cargo check` 成功

### 9.3 配置验证
- [ ] 所有 `package.json` 语法正确
- [ ] 所有 JSON 配置文件语法正确
- [ ] 所有 TOML 文件语法正确

### 9.4 保留项确认
- [ ] GitHub URL 仍为 `github.com/different-ai/openwork`
- [ ] `opencode` 引用未改变
- [ ] API 端点路径未改变
- [ ] 数据库表名未改变

---

## Phase 10: 迁移文档 (30分钟)

### 10.1 用户迁移指南
- [ ] 创建 `docs/migration/wwork-rebrand.md`
  - [ ] CLI 命令变更说明
  - [ ] npm 包重新安装指南
  - [ ] 数据目录变更说明

### 10.2 CHANGELOG 更新
- [ ] 添加改名记录到 `CHANGELOG.md` 或版本发布说明

### 10.3 发布检查清单
- [ ] npm 包名检查：`@wwork/*` scope 可用
- [ ] 发布流程确认

---

## 依赖关系

```
Phase 1 (包名配置)
    │
    ├──→ Phase 2 (Tauri/Rust)
    │       │
    │       └──→ Phase 5 (Rust代码)
    │
    ├──→ Phase 3 (构建脚本)
    │       │
    │       └──→ Phase 4 (TS代码)
    │               │
    │               └──→ Phase 6 (脚本)
    │
    └──→ Phase 7 (Logo) - 可并行

Phase 8 (文档) - 最后执行
Phase 9 (验证) - 最终检查
Phase 10 (迁移文档) - 收尾
```

---

## 关键里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1 | 1小时 | 包名和配置完成 |
| M2 | 2小时 | 代码修改完成 |
| M3 | 3小时 | 构建验证通过 |
| M4 | 4小时 | 文档更新完成 |
| M5 | 4.5小时 | 全部验证通过 |

---

## 风险与缓解

| 风险 | 可能性 | 缓解措施 |
|------|--------|----------|
| 遗漏文件 | 中 | 多轮全局搜索验证 |
| 构建失败 | 中 | 每阶段后执行构建检查 |
| npm 包名冲突 | 低 | 提前检查 `@wwork` scope |
| 用户配置丢失 | 中 | 提供详细迁移指南 |

---

## 成功标准检查清单

- [ ] 所有 package.json 名称已改为 @wwork/*
- [ ] Tauri 配置已更新（productName, identifier, title）
- [ ] Cargo.toml 已更新
- [ ] 所有 sidecar 名称已改（wwork-server, wwbot, wwork）
- [ ] 代码常量已更新
- [ ] 文档已更新
- [ ] 全局搜索无残留（除保留项）
- [ ] pnpm install 成功
- [ ] cargo check 成功
- [ ] 迁移文档已准备
