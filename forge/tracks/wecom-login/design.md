# Design: WeCom Enterprise Login

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenWork Desktop App                      │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │   Login Page    │ ───▶ │     Main App (Protected)    │  │
│  │   (SolidJS)     │      │   Sessions, Skills, etc.    │  │
│  └────────┬────────┘      └─────────────────────────────┘  │
│           │                                                 │
│           │ Renders                                         │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │   QR Code UI    │                                        │
│  │ (solid-qr-code) │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           │ Polls status                                    │
│           ▼                                                 │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │  Auth Store     │◀────▶│   auth.ts Tauri Commands    │  │
│  │  (SolidJS)      │      │   (Rust backend)            │  │
│  └─────────────────┘      └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP requests
                              ▼
                    ┌─────────────────────┐
                    │   WeCom API         │
                    │   - getloginurl     │
                    │   - getuserinfo     │
                    └─────────────────────┘
```

## Components

### 1. AuthStore (Global State)

Location: `packages/app/src/stores/auth.ts`

```typescript
// Auth state using SolidJS stores
interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  accessToken: string | null;
  expiresAt: number | null;
}

interface UserInfo {
  userId: string;
  name: string;
  avatar?: string;
  department?: string[];
}

// Actions
- login(code: string): Promise<void>
- logout(): void
- checkAuth(): boolean
- refreshToken(): Promise<void>
```

### 2. Route Guard Component

Location: `packages/app/src/components/AuthGuard.tsx`

Wraps protected routes. Redirects to `/login` if not authenticated.

### 3. Login Page

Location: `packages/app/src/pages/Login.tsx`

- Full-screen centered layout
- Company/app branding
- QR code display (qrcode.react library)
- Status messages ("Scan to login", "Scanning...", "Success!")
- Manual refresh button

### 4. QR Code Generation Flow

```
1. Login page mounts
2. Call Tauri command: generateWeComLoginUrl()
3. Backend calls WeCom API to get login URL with state parameter
4. Frontend generates QR code from URL
5. Start polling: checkLoginStatus(state)
6. When user scans and confirms, WeCom redirects with auth code
7. Backend exchanges code for access_token
8. Backend fetches user info
9. Frontend receives user data, stores in AuthStore
10. Redirect to main app
```

### 5. Tauri Commands (Rust Backend)

Location: `packages/desktop/src-tauri/src/commands/auth.rs`

```rust
#[tauri::command]
async fn generate_wecom_login_url(
    app_id: String,
    agent_id: String,
    redirect_uri: String,
) -> Result<String, String>

#[tauri::command]
async fn exchange_wecom_code(
    code: String,
) -> Result<WeComAuthResponse, String>

#[tauri::command]
async fn get_wecom_user_info(
    access_token: String,
    user_id: String,
) -> Result<WeComUserInfo, String>
```

## Data Flow

### Authentication Sequence

```
User              Frontend              Tauri               WeCom API
 │                   │                    │                    │
 │  Open App         │                    │                    │
 │────────────────▶│                    │                    │
 │                   │                    │                    │
 │  Show Login UI    │                    │                    │
 │◀────────────────│                    │                    │
 │                   │                    │                    │
 │                   │  generateLoginUrl() │                   │
 │                   │───────────────────▶│                    │
 │                   │                    │  GET /getloginurl  │
 │                   │                    │───────────────────▶│
 │                   │                    │                    │
 │  Display QR Code  │◀───────────────────│◀───────────────────│
 │◀────────────────│                    │  (login url)        │
 │                   │                    │                    │
 │  Scan with WeCom  │                    │                    │
 │────────────────────────────────────────────────────────────▶│
 │                   │                    │                    │
 │                   │  Poll status       │                    │
 │                   │  (every 2s)        │                    │
 │                   │◄──────────────────►│                    │
 │                   │                    │                    │
 │  Confirm on phone │                    │                    │
 │────────────────────────────────────────────────────────────▶│
 │                   │                    │  Redirect with code│
 │                   │                    │◀───────────────────│
 │                   │                    │                    │
 │                   │  Code received     │                    │
 │                   │◀───────────────────│                    │
 │                   │                    │                    │
 │                   │  exchangeCode()    │                    │
 │                   │───────────────────▶│                    │
 │                   │                    │ GET /getuserinfo   │
 │                   │                    │───────────────────▶│
 │                   │                    │                    │
 │  Welcome, User!   │◀───────────────────│◀───────────────────│
 │◀────────────────│                    │  (user info)        │
 │                   │                    │                    │
```

## Error Handling

| Error Scenario | User Message | Recovery |
|---------------|--------------|----------|
| Network error | "无法连接到服务器，请检查网络" | Retry button |
| QR expired | "二维码已过期，请刷新" | Auto-refresh QR |
| User denies | "登录已取消" | Show QR again |
| WeCom API error | "企业微信服务暂时不可用" | Retry after delay |
| Token expired | "会话已过期，请重新登录" | Redirect to login |

## Security Considerations

1. **Token Storage**
   - Access token stored in memory (AuthStore)
   - Refresh token stored in Tauri's secure storage (keychain/keyring)
   - Clear tokens on logout

2. **State Parameter**
   - Generate random state string for CSRF protection
   - Validate state matches on callback

3. **HTTPS Only**
   - All WeCom API calls must use HTTPS
   - Validate certificates

4. **Token Refresh**
   - Refresh token before expiry (using WeCom's refresh_token)
   - Graceful handling of refresh failures

## Testing Strategy

1. **Unit Tests**
   - AuthStore state transitions
   - QR code generation
   - Token validation

2. **Integration Tests**
   - Full login flow with mock WeCom API
   - Token refresh scenario
   - Logout cleanup

3. **E2E Tests**
   - Actual QR code scanning (manual)
   - Session persistence across restarts

## Dependencies

**Frontend (SolidJS):**
- `solid-qr-code` - QR code generation for SolidJS
- `@solidjs/router` - Already installed, for route guards

**Backend (Rust):**
- `reqwest` - HTTP client for WeCom API calls
- `serde` - JSON parsing (already present)
- `tauri-plugin-store` (optional) - Secure token persistence

## Configuration

Add to `packages/desktop/src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeBuildCommand": "pnpm install solid-qr-code"
  },
  "tauri": {
    "allowlist": {
      "shell": {
        "all": false,
        "open": true
      },
      "http": {
        "all": true,
        "request": true
      }
    }
  }
}
```

WeCom credentials should be configured via:
- Environment variables (dev)
- Config file (production)
- Not bundled in app for security
