/**
 * 这部分代码需要插入到 C:\Users\Lenovo\Desktop\bot\server.js 的第 609-610 行之间
 * 
 * 插入位置：在 const server = http.createServer(...) 之后
 *           在 server.listen(...) 之前
 * 
 * 步骤：
 * 1. 在文件顶部添加 require：
 *    const WebSocket = require('ws');
 *    const { v4: uuidv4 } = require('uuid');
 * 
 * 2. 在 server 创建后（第609行后）粘贴以下代码
 */

// ========== OpenWork WebSocket 认证集成（开始）==========

// 内存存储
const authSessions = new Map();
const wsConnections = new Map();

// WebSocket 支持
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let sessionId = null;
  
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'init') {
        sessionId = data.sessionId;
        wsConnections.set(sessionId, ws);
        console.log(`[auth] Session connected: ${sessionId}`);
        
        // 检查是否有等待的授权码
        const session = authSessions.get(sessionId);
        if (session?.code) {
          ws.send(JSON.stringify({
            type: 'auth_code',
            code: session.code,
            state: sessionId,
          }));
          console.log(`[auth] Pushed pending code to: ${sessionId}`);
        }
      }
    } catch (e) {
      console.error('[auth] WebSocket message error:', e);
    }
  });
  
  ws.on('close', () => {
    if (sessionId) {
      wsConnections.delete(sessionId);
      console.log(`[auth] Session disconnected: ${sessionId}`);
    }
  });
  
  ws.on('error', (err) => {
    console.error('[auth] WebSocket error:', err);
  });
});

// 修改 server 处理函数以支持新路由
const originalHandler = server.listeners('request')[0];
server.removeAllListeners('request');

server.on('request', async (req, res) => {
  const baseUrl = `http://${req.headers.host || "0.0.0.0"}`;
  const url = new URL(req.url, baseUrl);
  
  // OpenWork 认证路由
  if (url.pathname === '/api/login-url') {
    const sessionId = uuidv4();
    authSessions.set(sessionId, { 
      id: sessionId, 
      status: 'pending', 
      code: null,
      createdAt: Date.now()
    });
    
    // 5分钟后过期
    setTimeout(() => {
      if (authSessions.get(sessionId)?.status === 'pending') {
        authSessions.delete(sessionId);
        console.log(`[auth] Session expired: ${sessionId}`);
      }
    }, 5 * 60 * 1000);
    
    const loginUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?` +
      `appid=${WECOM_CORP_ID}&` +
      `redirect_uri=${encodeURIComponent('https://your-domain.com/auth/callback')}&` +
      `response_type=code&` +
      `scope=snsapi_base&` +
      `state=${sessionId}` +
      `#wechat_redirect`;
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      data: { sessionId, loginUrl, expiresIn: 300 }
    }));
    return;
  }
  
  if (url.pathname === '/auth/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    console.log('[auth] Callback received:', { code: code ? '***' : null, state });
    
    if (!code || !state) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/html');
      res.end('<h1>Missing code or state</h1>');
      return;
    }
    
    const session = authSessions.get(state);
    if (!session) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html');
      res.end('<h1>Session expired</h1>');
      return;
    }
    
    session.code = code;
    session.status = 'authorized';
    authSessions.set(state, session);
    
    // 推送到客户端
    const ws = wsConnections.get(state);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'auth_code', code, state }));
      console.log(`[auth] Code pushed to client: ${state}`);
      
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>登录成功 - OpenWork</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
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
              backdrop-filter: blur(10px);
            }
            .success-icon {
              width: 80px;
              height: 80px;
              background: rgba(34, 197, 94, 0.2);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              font-size: 40px;
            }
            h1 { margin: 0 0 16px; font-size: 28px; }
            p { margin: 0; opacity: 0.8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>授权成功！</h1>
            <p>已推送授权信息到 OpenWork 桌面应用</p>
            <p style="margin-top: 16px; font-size: 14px; opacity: 0.6;">请返回桌面应用查看</p>
          </div>
        </body>
        </html>
      `);
    } else {
      console.log(`[auth] Client not connected, waiting: ${state}`);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>等待连接 - OpenWork</title>
          <meta http-equiv="refresh" content="5">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
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
              width: 60px;
              height: 60px;
              border: 4px solid rgba(255,255,255,0.2);
              border-top-color: #3b82f6;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 24px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            h1 { margin: 0 0 16px; font-size: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>等待桌面应用连接</h1>
            <p>授权信息已保存，正在等待应用连接...</p>
            <p style="margin-top: 16px; font-size: 12px; opacity: 0.5;">页面将在 5 秒后自动刷新</p>
          </div>
        </body>
        </html>
      `);
    }
    return;
  }
  
  // 原有的路由处理
  await originalHandler(req, res);
});

console.log('[auth] OpenWork WebSocket认证服务已集成');
console.log(`[auth] WebSocket endpoint: ws://0.0.0.0:${PORT}`);
console.log('[auth] API endpoints:');
console.log('  - GET /api/login-url    获取登录URL');
console.log('  - GET /auth/callback    企业微信回调');

// ========== OpenWork WebSocket 认证集成（结束）==========
