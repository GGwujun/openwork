/**
 * OpenWork 企业微信登录服务端
 * 
 * 功能：
 * 1. 接收企业微信 OAuth 回调
 * 2. 与桌面客户端建立 WebSocket 连接
 * 3. 将授权码推送给客户端完成登录
 * 
 * 部署：
 * 1. 修改 WECOM_CORP_ID 和 WECOM_AGENT_ID
 * 2. 配置 Nginx 反向代理到 3000 端口
 * 3. 配置 HTTPS（推荐使用 Let's Encrypt）
 * 4. 配置企业微信可信域名
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// ==================== 配置 ====================
const CONFIG = {
  // 替换为您的企业微信配置
  WECOM_CORP_ID: process.env.WECOM_CORP_ID || 'wxcebe114cab473881',
  WECOM_AGENT_ID: process.env.WECOM_AGENT_ID || '1000002',
  
  // 服务端口号
  PORT: process.env.PORT || 3000,
  
  // 回调 URL（您的外网域名）
  REDIRECT_URI: process.env.REDIRECT_URI || 'https://your-domain.com/auth/callback',
  
  // WebSocket 心跳间隔（毫秒）
  HEARTBEAT_INTERVAL: 30000,
  
  // 登录状态过期时间（毫秒）
  SESSION_TIMEOUT: 5 * 60 * 1000, // 5分钟
};

// ==================== 数据存储 ====================
// 存储登录会话
const sessions = new Map();

// 存储 WebSocket 连接（按 session ID）
const connections = new Map();

// ==================== Express 应用 ====================
const app = express();
const server = http.createServer(app);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==================== WebSocket 服务 ====================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  let sessionId = null;
  let heartbeatInterval = null;
  
  // 心跳检测
  const startHeartbeat = () => {
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, CONFIG.HEARTBEAT_INTERVAL);
  };
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'init':
          // 客户端初始化，关联 session
          sessionId = data.sessionId;
          if (sessionId) {
            connections.set(sessionId, ws);
            
            // 检查是否有待处理的登录结果
            const session = sessions.get(sessionId);
            if (session && session.status === 'pending' && session.code) {
              // 推送登录结果
              ws.send(JSON.stringify({
                type: 'auth_success',
                code: session.code,
                state: sessionId,
              }));
              
              // 更新状态
              session.status = 'completed';
              sessions.set(sessionId, session);
            }
            
            console.log(`Session ${sessionId} connected`);
          }
          break;
          
        case 'pong':
          // 收到心跳响应
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (sessionId) {
      connections.delete(sessionId);
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to OpenWork auth server',
  }));
  
  startHeartbeat();
});

// ==================== API 路由 ====================

/**
 * 生成登录 URL
 * GET /api/login-url
 */
app.get('/api/login-url', (req, res) => {
  const sessionId = uuidv4();
  
  // 创建登录会话
  sessions.set(sessionId, {
    id: sessionId,
    status: 'pending',
    code: null,
    createdAt: Date.now(),
  });
  
  // 设置过期清理
  setTimeout(() => {
    if (sessions.get(sessionId)?.status === 'pending') {
      sessions.delete(sessionId);
    }
  }, CONFIG.SESSION_TIMEOUT);
  
  // 生成企业微信登录 URL
  const loginUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?` +
    `appid=${CONFIG.WECOM_CORP_ID}&` +
    `redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=snsapi_base&` +
    `state=${sessionId}` +
    `#wechat_redirect`;
  
  res.json({
    success: true,
    data: {
      sessionId,
      loginUrl,
      expiresIn: CONFIG.SESSION_TIMEOUT / 1000,
    },
  });
});

/**
 * 企业微信 OAuth 回调
 * GET /auth/callback
 */
app.get('/auth/callback', (req, res) => {
  const { code, state, error: wecomError } = req.query;
  
  console.log('WeCom callback:', { code, state, error: wecomError });
  
  if (wecomError) {
    return res.status(400).json({
      success: false,
      error: `WeCom error: ${wecomError}`,
    });
  }
  
  if (!code || !state) {
    return res.status(400).json({
      success: false,
      error: 'Missing code or state',
    });
  }
  
  const session = sessions.get(state);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired',
    });
  }
  
  // 更新会话状态
  session.code = code;
  session.status = 'authorized';
  sessions.set(state, session);
  
  // 推送授权码给客户端
  const ws = connections.get(state);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'auth_code',
      code,
      state,
    }));
    
    console.log(`Auth code pushed to client: ${state}`);
    
    // 返回成功页面
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>登录成功 - OpenWork</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            color: #f8fafc;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(30, 41, 59, 0.8);
            border-radius: 16px;
            border: 1px solid rgba(148, 163, 184, 0.2);
          }
          .success-icon {
            width: 64px;
            height: 64px;
            background: rgba(34, 197, 94, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 32px;
          }
          h1 { margin: 0 0 16px; font-size: 24px; }
          p { color: #94a3b8; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>授权成功</h1>
          <p>已推送授权信息到 OpenWork 应用<br>请返回桌面应用查看</p>
        </div>
        <script>
          // 尝试通过 opener 通知父窗口（如果是嵌入窗口）
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth-callback',
              code: '${code}',
              state: '${state}'
            }, '*');
          }
        </script>
      </body>
      </html>
    `);
  } else {
    // 客户端未连接，存储等待
    console.log(`Client not connected, storing code: ${state}`);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>等待连接 - OpenWork</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            color: #f8fafc;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(30, 41, 59, 0.8);
            border-radius: 16px;
            border: 1px solid rgba(148, 163, 184, 0.2);
          }
          .waiting-icon {
            width: 64px;
            height: 64px;
            border: 4px solid rgba(59, 130, 246, 0.3);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 24px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          h1 { margin: 0 0 16px; font-size: 24px; }
          p { color: #94a3b8; margin: 0; }
        </style>
        <meta http-equiv="refresh" content="5">
      </head>
      <body>
        <div class="container">
          <div class="waiting-icon"></div>
          <h1>等待应用连接</h1>
          <p>授权信息已保存，等待桌面应用连接...<br>请确保 OpenWork 应用已打开</p>
          <p style="margin-top: 16px; font-size: 12px;">页面将在 5 秒后自动刷新</p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * 查询登录状态
 * GET /api/login-status/:sessionId
 */
app.get('/api/login-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
    });
  }
  
  res.json({
    success: true,
    data: {
      status: session.status,
      code: session.status === 'authorized' ? session.code : null,
    },
  });
});

/**
 * 健康检查
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connections: connections.size,
    sessions: sessions.size,
  });
});

// ==================== 启动服务 ====================
server.listen(CONFIG.PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║                                                ║
║   OpenWork 企业微信登录服务                     ║
║                                                ║
╠════════════════════════════════════════════════╣
║  服务地址: http://localhost:${CONFIG.PORT}              ║
║  WebSocket: ws://localhost:${CONFIG.PORT}             ║
║                                                ║
║  API 端点:                                     ║
║  - GET  /api/login-url    获取登录 URL         ║
║  - GET  /auth/callback    企业微信回调         ║
║  - GET  /api/login-status 查询登录状态         ║
║  - GET  /health          健康检查             ║
║                                                ║
╚════════════════════════════════════════════════╝

配置信息:
- Corp ID: ${CONFIG.WECOM_CORP_ID}
- Agent ID: ${CONFIG.WECOM_AGENT_ID}
- Redirect URI: ${CONFIG.REDIRECT_URI}
  `);
  
  console.log('\n请确保：');
  console.log('1. 配置 Nginx 反向代理到本服务');
  console.log('2. 配置 HTTPS 证书');
  console.log('3. 在企业微信后台配置可信域名');
  console.log('4. 回调 URL 设置为:', CONFIG.REDIRECT_URI);
  console.log('\n');
});

// ==================== 错误处理 ====================
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
