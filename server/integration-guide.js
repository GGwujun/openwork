/**
 * OpenWork 企业微信登录 - 服务端集成指南
 * 
 * 将此代码集成到您的 server.js 中，不要删除原有功能
 */

// =====================================================
// 第1步：添加依赖（在 require 区域）
// =====================================================
// 如果已有这些依赖，请跳过
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// =====================================================
// 第2步：添加配置（在配置文件区域）
// =====================================================
const AUTH_CONFIG = {
  WECOM_CORP_ID: process.env.WECOM_CORP_ID || 'wxcebe114cab473881',
  WECOM_AGENT_ID: process.env.WECOM_AGENT_ID || '1000002',
  REDIRECT_URI: process.env.REDIRECT_URI || 'https://your-domain.com/auth/callback',
  SESSION_TIMEOUT: 5 * 60 * 1000, // 5分钟
};

// 内存存储（生产环境建议使用 Redis）
const authSessions = new Map();
const wsConnections = new Map();

// =====================================================
// 第3步：添加 WebSocket 支持（在创建 server 后）
// =====================================================
// 假设您已有：const server = http.createServer(app);
// 或：const server = app.listen(port);

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    let sessionId = null;
    let heartbeatInterval = null;
    
    // 心跳
    const startHeartbeat = () => {
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'init':
            sessionId = data.sessionId;
            if (sessionId) {
              wsConnections.set(sessionId, ws);
              console.log(`Session ${sessionId} connected`);
              
              // 检查是否有等待的授权码
              const session = authSessions.get(sessionId);
              if (session?.code) {
                ws.send(JSON.stringify({
                  type: 'auth_code',
                  code: session.code,
                  state: sessionId,
                }));
              }
            }
            break;
            
          case 'pong':
            break;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });
    
    ws.on('close', () => {
      if (sessionId) wsConnections.delete(sessionId);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    });
    
    ws.send(JSON.stringify({ type: 'connected' }));
    startHeartbeat();
  });
  
  return wss;
}

// =====================================================
// 第4步：添加 API 路由（在已有路由之后）
// =====================================================

/**
 * 获取企业微信登录 URL
 * GET /api/login-url
 */
function setupAuthRoutes(app) {
  
  app.get('/api/login-url', (req, res) => {
    const sessionId = uuidv4();
    
    authSessions.set(sessionId, {
      id: sessionId,
      status: 'pending',
      code: null,
      createdAt: Date.now(),
    });
    
    // 5分钟后过期
    setTimeout(() => {
      if (authSessions.get(sessionId)?.status === 'pending') {
        authSessions.delete(sessionId);
      }
    }, AUTH_CONFIG.SESSION_TIMEOUT);
    
    const loginUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?` +
      `appid=${AUTH_CONFIG.WECOM_CORP_ID}&` +
      `redirect_uri=${encodeURIComponent(AUTH_CONFIG.REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=snsapi_base&` +
      `state=${sessionId}` +
      `#wechat_redirect`;
    
    res.json({
      success: true,
      data: { sessionId, loginUrl, expiresIn: 300 }
    });
  });

  /**
   * 企业微信回调（必须是你配置的 redirect_uri）
   * GET /auth/callback
   */
  app.get('/auth/callback', (req, res) => {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }
    
    const session = authSessions.get(state);
    if (!session) {
      return res.status(404).send('Session expired');
    }
    
    // 保存授权码
    session.code = code;
    session.status = 'authorized';
    authSessions.set(state, session);
    
    // 推送给客户端
    const ws = wsConnections.get(state);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'auth_code', code, state }));
      
      // 返回成功页面
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>登录成功</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.1);
              border-radius: 16px;
            }
            .success-icon {
              width: 64px;
              height: 64px;
              background: rgba(34, 197, 94, 0.3);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              font-size: 32px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>授权成功</h1>
            <p>已推送到桌面应用，请返回查看</p>
          </div>
        </body>
        </html>
      `);
    } else {
      // 客户端未连接，显示等待页面
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>等待连接</title>
          <meta http-equiv="refresh" content="5">
          <style>
            body {
              font-family: system-ui, sans-serif;
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              color: white;
            }
            .container { text-align: center; }
            .spinner {
              width: 48px;
              height: 48px;
              border: 4px solid rgba(255,255,255,0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 24px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>等待应用连接</h1>
            <p>请确保 OpenWork 应用已打开</p>
            <p style="font-size: 12px; opacity: 0.6;">5秒后自动刷新</p>
          </div>
        </body>
        </html>
      `);
    }
  });
}

// =====================================================
// 第5步：初始化（在 server 启动后）
// =====================================================
function initAuthServer(server, app) {
  // 设置 WebSocket
  setupWebSocket(server);
  
  // 设置路由
  setupAuthRoutes(app);
  
  console.log('✅ OpenWork 认证服务已启动');
  console.log(`📡 WebSocket: ws://localhost:${server.address().port}`);
}

// =====================================================
// 导出供外部使用
// =====================================================
module.exports = {
  setupWebSocket,
  setupAuthRoutes,
  initAuthServer,
  AUTH_CONFIG,
};

/**
 * 使用方法：
 * 
 * 在你的 server.js 底部添加：
 * 
 * const { initAuthServer } = require('./integration-guide');
 * initAuthServer(server, app);
 * 
 * 或手动集成：
 * 
 * const http = require('http');
 * const server = http.createServer(app);
 * 
 * // 添加 WebSocket 支持（必须在 listen 之前）
 * const WebSocket = require('ws');
 * const wss = new WebSocket.Server({ server });
 * 
 * // ... 你的 WebSocket 处理代码 ...
 * 
 * server.listen(PORT, () => {
 *   console.log('Server started');
 * });
 */
