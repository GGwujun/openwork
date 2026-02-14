import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { Loader2, QrCode, RefreshCw, UserCheck, Wifi, WifiOff } from "lucide-solid";
import Button from "../components/button";
import OpenWorkLogo from "../components/openwork-logo";
import { useAuth } from "../stores/auth";
import { isTauriRuntime } from "../utils";

// Server Configuration
const SERVER_URL = import.meta.env.VITE_AUTH_SERVER_URL || "wss://your-domain.com";
const API_BASE = import.meta.env.VITE_AUTH_API_URL || "https://your-domain.com";

// Types for WeCom integration
interface WeComUserInfo {
  user_id: string;
  name: string;
  avatar?: string;
  department?: string[];
}

interface ServerAuthSuccessMessage {
  type: "auth_success";
  state: string;
  user_info: WeComUserInfo;
}

// Generate QR code as data URL
async function generateQRCode(url: string, size = 200): Promise<string> {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

export default function LoginPage() {
  const { actions } = useAuth();
  
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [qrUrl, setQrUrl] = createSignal<string | null>(null);
  const [qrImage, setQrImage] = createSignal<string | null>(null);
  const [sessionId, setSessionId] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<"connecting" | "waiting" | "scanned" | "confirmed" | "expired" | null>(null);
  const [wsConnected, setWsConnected] = createSignal(false);
  
  let ws: WebSocket | null = null;
  let heartbeatInterval: number | null = null;
  let sessionTimeout: number | null = null;

  // Connect to WebSocket and get login URL
  const connectAndStartLogin = async () => {
    if (!isTauriRuntime()) {
      setError("企业微信登录需要桌面应用");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("connecting");
    
    try {
      // Step 1: Get login URL from server
      const response = await fetch(`${API_BASE}/api/login-url`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to get login URL");
      }
      
      const { sessionId: sid, loginUrl, expiresIn } = result.data;
      setSessionId(sid);
      setQrUrl(loginUrl);
      
      // Generate QR code
      const qrDataUrl = await generateQRCode(loginUrl);
      setQrImage(qrDataUrl);
      
      // Step 2: Connect WebSocket
      connectWebSocket(sid);
      
      // Set session timeout
      if (sessionTimeout) {
        window.clearTimeout(sessionTimeout);
      }
      sessionTimeout = window.setTimeout(() => {
        setStatus("expired");
        disconnectWebSocket();
      }, expiresIn * 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接服务器失败");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection
  const connectWebSocket = (sid: string) => {
    try {
      ws = new WebSocket(SERVER_URL);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
        
        // Send init message
        ws?.send(JSON.stringify({
          type: "init",
          sessionId: sid,
        }));
        
        // Start heartbeat
        if (heartbeatInterval) {
          window.clearInterval(heartbeatInterval);
        }
        heartbeatInterval = window.setInterval(() => {
          ws?.send(JSON.stringify({ type: "ping" }));
        }, 30000);
        
        setStatus("waiting");
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message:", data);
          
          switch (data.type) {
            case "auth_code":
              // Legacy server protocol fallback
              setError("登录协议版本不匹配，请升级认证服务后重试");
              break;
               
            case "auth_success":
              handleAuthSuccess(data as ServerAuthSuccessMessage);
              break;
              
            case "ping":
              ws?.send(JSON.stringify({ type: "pong" }));
              break;
              
            case "connected":
              console.log("Server:", data.message);
              break;
              
            case "error":
              setError(data.message || "连接错误");
              break;
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket closed");
        setWsConnected(false);
        if (heartbeatInterval) {
          window.clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket 连接失败");
        setWsConnected(false);
      };
      
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setError("无法连接到服务器");
    }
  };

  const handleAuthSuccess = (message: ServerAuthSuccessMessage) => {
    const userInfo = message.user_info;

    actions.login(
      {
        userId: userInfo.user_id,
        name: userInfo.name,
        avatar: userInfo.avatar,
        department: userInfo.department,
      },
      {
        accessToken: `server-${message.state}`,
        expiresAt: Date.now() / 1000 + 7200,
      }
    );

    setStatus("confirmed");
    disconnectWebSocket();
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (heartbeatInterval) {
      window.clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (sessionTimeout) {
      window.clearTimeout(sessionTimeout);
      sessionTimeout = null;
    }
    setWsConnected(false);
  };

  // Cleanup on unmount
  onCleanup(() => {
    disconnectWebSocket();
  });

  // Generate QR code on mount
  onMount(() => {
    connectAndStartLogin();
  });

  const handleRefresh = () => {
    disconnectWebSocket();
    connectAndStartLogin();
  };

  const statusMessage = () => {
    switch (status()) {
      case "connecting":
        return "正在连接服务器...";
      case "waiting":
        return "请使用企业微信扫描二维码登录";
      case "scanned":
        return "已扫描，正在验证...";
      case "confirmed":
        return "登录成功，正在跳转...";
      case "expired":
        return "二维码已过期，请刷新";
      default:
        return "正在初始化...";
    }
  };

  const statusColor = () => {
    switch (status()) {
      case "connecting":
        return "text-blue-300";
      case "waiting":
        return "text-slate-300";
      case "scanned":
        return "text-blue-400";
      case "confirmed":
        return "text-green-400";
      case "expired":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div class="w-full max-w-md rounded-2xl p-6">
        {/* Header */}
        <div class="text-center mb-4">
          <div class="flex justify-center mb-2">
            <OpenWorkLogo class="w-14 h-14" />
          </div>
          <h1 class="text-2xl font-bold text-white mb-1">欢迎回来</h1>
          <p class="text-slate-400">使用企业微信扫码登录 OpenWork</p>
        </div>

        {/* QR Code */}
        <div class="flex flex-col items-center mb-4">
          <div class="bg-white rounded-lg p-4 mb-3 shadow-lg">
            <Show
              when={qrImage() && !loading()}
              fallback={
                <div class="w-[200px] h-[200px] flex items-center justify-center bg-slate-100">
                  <Show
                    when={loading()}
                    fallback={<QrCode class="w-16 h-16 text-slate-400" />}
                  >
                    <Loader2 class="w-12 h-12 text-blue-500 animate-spin" />
                  </Show>
                </div>
              }
            >
              <img
                src={qrImage()!}
                alt="WeCom Login QR Code"
                class="w-[200px] h-[200px]"
              />
            </Show>
          </div>

          {/* Status */}
          <div class={`text-sm font-medium ${statusColor()}`}>
            {statusMessage()}
          </div>

          {/* Scanned indicator */}
          <Show when={status() === "scanned" || status() === "confirmed"}>
            <div class="mt-2 flex items-center gap-2 text-sm text-green-400">
              <UserCheck class="w-4 h-4" />
              <span>已识别</span>
            </div>
          </Show>
        </div>

        {/* Refresh button */}
        <div class="flex justify-center mb-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading()}
            class="text-sm py-1.5 px-3"
          >
            <RefreshCw class={`w-4 h-4 mr-2 ${loading() ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error()}
          </div>
        </Show>

        {/* Instructions */}
        <div class="mt-4 p-3 bg-slate-800/30 rounded-lg border border-slate-600/30">
          <h3 class="text-xs font-medium text-slate-300 mb-1.5">如何登录：</h3>
          <ol class="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>打开企业微信 App</li>
            <li>点击右上角 + 号</li>
            <li>选择"扫一扫"</li>
            <li>扫描上方二维码</li>
          </ol>
        </div>

        {/* Footer */}
        <div class="mt-5 text-center text-xs text-slate-500">
          OpenWork Desktop • v{import.meta.env.VITE_APP_VERSION || "0.1.0"}
        </div>
      </div>
    </div>
  );
}
