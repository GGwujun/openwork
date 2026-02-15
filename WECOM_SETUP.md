# 企业微信登录配置指南

## 🔧 当前回调地址

应用使用的回调地址是：
```
http://127.0.0.1:4096/auth/callback
```

## ⚠️ 问题说明

企业微信要求 `redirect_uri` 必须使用**外网可信域名**，不支持 `localhost` 或 `127.0.0.1`。

## 💡 解决方案

### 方案 1：配置外网域名（推荐生产环境）

1. **准备域名**：
   - 准备一个您拥有的域名，例如：`openwork.yourdomain.com`
   - 该域名需要备案（如果是国内服务器）

2. **DNS 配置**：
   ```
   openwork.yourdomain.com  A记录 指向 您的服务器IP
   ```

3. **服务器转发**：
   在服务器上配置 Nginx 转发到本地：
   ```nginx
   server {
       listen 80;
       server_name openwork.yourdomain.com;
       
       location /auth/callback {
           # 选项A: 直接返回成功页面，用户手动复制 code
           return 200 'Login successful. Please close this window.';
           
           # 选项B: 使用 WebSocket 或轮询通知桌面应用
           # proxy_pass http://127.0.0.1:4096/auth/callback;
       }
   }
   ```

4. **企业微信后台配置**：
   - 登录 https://work.weixin.qq.com/wework_admin/frame
   - 进入「应用管理」→ 选择您的应用
   - 「网页授权及JS-SDK」→ 设置可信域名
   - 添加：`openwork.yourdomain.com`

5. **修改应用配置**：
   ```rust
   // packages/desktop/src-tauri/src/commands/auth.rs
   let redirect_uri = format!("https://openwork.yourdomain.com/auth/callback");
   ```

### 方案 2：临时内网穿透（仅开发测试）

使用 ngrok 临时暴露本地端口：

```bash
# 安装 ngrok
npm install -g ngrok

# 暴露本地 4096 端口
ngrok http 4096
```

会得到一个临时域名如：`https://a1b2c3d4.ngrok.io`

1. 将该域名配置到企业微信可信域名
2. 修改代码中的 redirect_uri：
   ```rust
   let redirect_uri = format!("https://a1b2c3d4.ngrok.io/auth/callback");
   ```

**注意**：ngrok 域名每次重启都会变，适合临时测试。

### 方案 3：手动完成登录（最简单，但不自动）

1. **修改回调为简单页面**：
   ```rust
   let redirect_uri = format!("https://your-static-page.com/wecom-callback.html");
   ```

2. **创建简单的回调页面** (`wecom-callback.html`)：
   ```html
   <!DOCTYPE html>
   <html>
   <head>
       <title>登录成功</title>
   </head>
   <body>
       <h1>登录成功！</h1>
       <p>请复制下方的授权码，粘贴到 OpenWork 应用中：</p>
       <textarea id="code" readonly style="width: 300px; height: 50px;"></textarea>
       <script>
           const params = new URLSearchParams(window.location.search);
           const code = params.get('code');
           document.getElementById('code').value = code;
           document.getElementById('code').select();
       </script>
   </body>
   </html>
   ```

3. **用户流程**：
   - 用户扫码后看到成功页面
   - 复制页面上的 code
   - 在 OpenWork 应用中粘贴 code 完成登录

## 🔐 自定义协议方案（未来优化）

使用 `openwork://auth/callback` 自定义协议是桌面应用的最佳实践，但需要：

1. **Windows**: 注册表配置 URL Scheme
2. **macOS**: Info.plist 配置 CFBundleURLTypes
3. **Linux**: .desktop 文件配置 MimeType

该方案已实现（见 `src/commands/auth.rs`），但需要用户安装应用后才能注册协议。由于企业微信不信任自定义协议，仍需结合方案1或方案2使用。

## 📝 建议

- **开发测试**：使用方案2（ngrok）
- **内部使用**：使用方案1（配置公司内网域名）
- **快速体验**：使用方案3（手动复制 code）

## ❓ 需要帮助？

配置企业微信可信域名遇到问题？可以：
1. 查看企业微信官方文档：https://developer.work.weixin.qq.com/document/path/90546
2. 检查域名备案状态
3. 确认 DNS 解析已生效（使用 `nslookup` 或 `dig` 检查）
