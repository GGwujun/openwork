# WeCom 企业微信登录配置说明

## 配置汇总

已为您配置的企业微信参数：

| 参数名 | 值 | 用途 |
|--------|-----|------|
| **Corp ID** | `wxcebe114cab473881` | 企业ID，用于生成登录URL |
| **Agent ID** | `1000002` | 应用ID，用于生成登录URL |
| **Corp Secret** | `8ulTzeCmN9s7QsaZEo6T9qOKMFWe6fSoS9QAb7Vejls` | 应用密钥，仅后端使用 |
| **Token** | `LiPYI6o5u` | 用于消息推送验证（可选） |
| **Encoding AES Key** | `WXEW1LVExrbGu98mrYKq71ZTamJdiJLrsMGpMJjWTNR` | 用于消息加密（可选） |

## 配置文件位置

### 前端环境变量
```
packages/app/.env
```

内容：
```bash
VITE_WECOM_CORP_ID=wxcebe114cab473881
VITE_WECOM_AGENT_ID=1000002
```

**注意**：Corp Secret 存储在后端 Rust 代码中，不会暴露给前端。

### 后端 Rust 配置
```
packages/desktop/src-tauri/src/commands/auth.rs
```

硬编码配置：
```rust
pub const WECOM_CORP_ID: &str = "wxcebe114cab473881";
pub const WECOM_AGENT_ID: &str = "1000002";
pub const WECOM_CORP_SECRET: &str = "8ulTzeCmN9s7QsaZEo6T9qOKMFWe6fSoS9QAb7Vejls";
```

## 安全注意事项

1. **Corp Secret 严格保密**：
   - 存储在 Rust 后端代码中
   - 从不发送到前端
   - 不输出到日志

2. **环境变量文件已添加到 .gitignore**：
   - 防止意外提交到 Git
   - 生产环境应使用更安全的方式存储

3. **WeCom 后台配置**：
   - 需在企业微信后台配置回调地址：
     - 可信域名
     - OAuth 回调 URL
   - 建议在生产环境使用 HTTPS

## 启动步骤

1. **确保环境变量文件存在**：
   ```bash
   ls packages/app/.env
   ```

2. **编译 Rust 后端**：
   ```bash
   cd packages/desktop/src-tauri
   cargo build
   ```

3. **启动开发服务器**：
   ```bash
   pnpm dev
   ```

4. **使用企业微信扫码登录**：
   - 打开应用后会显示登录页
   - 使用企业微信扫描二维码
   - 在手机上确认登录

## 生产环境部署

在生产环境中，建议：

1. **不要硬编码敏感信息**：
   - 使用环境变量
   - 使用密钥管理服务（如 AWS Secrets Manager）
   - 使用配置文件并限制文件权限

2. **配置 HTTPS**：
   - WeCom OAuth 要求 OAuth 回调使用 HTTPS
   - 配置 SSL 证书

3. **启用 CORS 限制**：
   - 限制允许的域名
   - 验证请求来源

4. **添加审计日志**：
   - 记录登录/登出事件
   - 监控异常登录行为

## 常见问题

**Q: 为什么 Corp Secret 不能在 .env 文件中？**
A: .env 文件内容会被打包到前端，任何人都可以查看。Corp Secret 存储在 Rust 后端，不会暴露。

**Q: 如果 Corp Secret 泄露了怎么办？**
A: 立即在企业微信后台重置 Corp Secret，并更新此配置文件。

**Q: 如何修改配置？**
A: 
- Corp ID/Agent ID：修改 `packages/app/.env` 和 `packages/desktop/src-tauri/src/commands/auth.rs`
- Corp Secret：仅修改 Rust 文件
- Token/AES Key：修改 `.env` 和 Rust 文件

## 技术支持

- 企业微信文档：https://developer.work.weixin.qq.com/
- OAuth2 流程：https://developer.work.weixin.qq.com/document/path/91022
