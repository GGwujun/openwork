# Intent: OpenWork → Wwork 品牌改名

## Why

项目需要从"OpenWork"改名为"Wwork"，融入"卫宁(Winning)"公司品牌元素：
- **W** = Winning（胜利）+ Work（工作）+ Weining（卫宁）
- 与公司名称和愿景保持一致
- 类似 Cwork 的简洁现代风格

## Scope

### In Scope - 必须修改

#### 1. 包名与 npm 包
- 所有 `package.json` 中的 `name` 字段
- npm scope: `@openwork/*` → `@wwork/*`
- CLI 包名: `openwrk` → `wwork`

#### 2. 应用标识
- Tauri `productName`: "OpenWork" → "Wwork"
- Tauri `identifier`: `com.differentai.openwork` → `com.winninghealth.wwork`
- Rust crate name: `openwork` → `wwork`
- 窗口标题: "OpenWork" → "Wwork"

#### 3. Sidecar 名称
- `openwork-server` → `wwork-server`
- `owpenbot` → `wwbot`
- `openwrk` → `wwork`

#### 4. 代码与常量
- TypeScript/JavaScript 常量与字符串
- Rust 代码中的标识符
- i18n 语言文件

#### 5. 文档
- README.md
- VISION.md, PRODUCT.md 等根目录文档
- 各包的 README

#### 6. 构建脚本
- 构建脚本中的包名引用
- Docker/AUR 打包配置

### Out of Scope - 暂不修改

- GitHub 仓库地址（保持 `different-ai/openwork`）
- `opencode` 上游项目引用
- 数据库表名/字段（保留兼容性）
- API 端点路径（避免客户端不兼容）
- 用户历史会话数据

## Technical Approach

### 命名映射表

| 类型 | 旧名称 | 新名称 | 影响范围 |
|------|--------|--------|----------|
| 根项目 | `openwork` | `wwork` | package.json |
| npm scope | `@openwork/*` | `@wwork/*` | 所有子包 |
| CLI 工具 | `openwrk` | `wwork` | headless 包 |
| 桌面应用 | `OpenWork` | `Wwork` | Tauri 配置 |
| 应用 ID | `com.differentai.openwork` | `com.winninghealth.wwork` | Tauri |
| Rust crate | `openwork` | `wwork` | Cargo.toml |
| 服务器 | `openwork-server` | `wwork-server` | sidecar |
| 机器人 | `owpenbot` | `wwbot` | sidecar, npm |

### 执行策略

1. **批量文本替换** - 使用 AST-grep 和 grep 精确替换
2. **文件重命名** - Logo 组件、Rust 模块文件
3. **验证检查** - 全局搜索确保无遗漏
4. **破坏性变更记录** - 记录需要用户注意的变化

## Target

**输入**: 当前 OpenWork 代码库

**输出**: 
- 所有包名改为 Wwork
- 所有品牌引用更新
- 构建产物名称更新
- 完整的变更清单

## Success Criteria

### 功能要求
- [ ] 所有 package.json 名称已改
- [ ] Tauri 配置已更新
- [ ] Cargo.toml 已更新
- [ ] 所有 sidecar 名称已改
- [ ] 代码常量已更新
- [ ] 文档已更新

### 验证要求
- [ ] 全局搜索无 "OpenWork"/"openwork"/"openwrk" 残留（除保留项）
- [ ] `pnpm install` 成功
- [ ] `cargo build` 成功
- [ ] 构建产物名称正确

### 兼容性要求
- [ ] 记录数据目录变更（影响用户配置）
- [ ] 记录 CLI 命令变更（影响用户使用习惯）
- [ ] 准备迁移说明文档

## Timeline

- **Phase 1**: 包名与配置（1小时）
- **Phase 2**: 代码与常量（1.5小时）
- **Phase 3**: 构建脚本与 sidecars（1小时）
- **Phase 4**: 文档更新（1小时）
- **Phase 5**: 验证与测试（30分钟）

## Dependencies

- **工具**: AST-grep, grep, sed
- **环境**: Node.js, pnpm, Rust toolchain

## Key Design Decision

**保守修改原则**: 只改标识符和名称，不改：
- 代码逻辑
- API 契约
- 数据格式
- 配置文件键名

确保功能零变化，仅品牌更新。

## Related Work

- **前置**: 确定新品牌名 "Wwork"
- **后续**: 发布新版本时同步更新 npm 包
- **后续**: 更新官网 landing 页面

## Notes

### 破坏性变更记录

1. **数据目录迁移**
   - macOS: `~/Library/Application Support/OpenWork` → `Wwork`
   - Windows: `%APPDATA%/OpenWork` → `Wwork`
   - Linux: `~/.config/OpenWork` → `Wwork`

2. **CLI 命令变更**
   - `openwrk` → `wwork`
   - `owpenbot` → `wwbot`

3. **npm 包重新安装**
   - 用户需要卸载 `openwrk` 并安装 `wwork`

### 保留项清单

这些保持不变：
- GitHub 仓库: `different-ai/openwork`
- GitHub Releases 路径
- `opencode` 引用
- 数据库表名
- API 端点
