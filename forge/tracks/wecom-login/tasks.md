# Tasks: WeCom Enterprise Login

## Phase 1: Setup & Infrastructure

### Task 1.1: Install Dependencies
- [x] Install `solid-qr-code` in packages/app (Note: Using API QR generation for prototyping)
- [x] Add `urlencoding` to Tauri Cargo.toml (Note: Using existing `ureq` instead of `reqwest`)
- [x] Verify all dependencies compile

**Verification:** `pnpm install && pnpm typecheck` passes

### Task 1.2: Create AuthStore
- [x] Create `packages/app/src/stores/auth.ts`
- [x] Define AuthState interface
- [x] Implement login/logout/checkAuth actions
- [x] Add token persistence hooks

**Verification:** Store can be imported and compiles

### Task 1.3: Create Tauri Auth Commands (Rust)
- [x] Create `packages/desktop/src-tauri/src/commands/auth.rs`
- [x] Implement `generate_wecom_login_url` command
- [x] Implement `check_login_status` / `confirm_login` commands
- [x] Register commands in lib.rs

**Verification:** `cargo check` succeeds with 1 minor warning

---

## Phase 2: UI Components

### Task 2.1: Create AuthGuard Component
- [x] Create `packages/app/src/components/AuthGuard.tsx`
- [x] Check auth state on mount
- [x] Redirect to /login if not authenticated
- [x] Render children if authenticated

**Verification:** Component created and integrated

### Task 2.2: Create LoginPage
- [x] Create `packages/app/src/app/pages/login.tsx`
- [x] Build centered layout with branding
- [x] Integrate QRCode component (using API for now)
- [x] Add status display area
- [x] Add refresh button

**Verification:** Page renders with TypeScript compilation

### Task 2.3: Create UserProfile Component
- [x] Create `packages/app/src/app/components/UserProfile.tsx`
- [x] Display user avatar and name
- [x] Add logout button

**Verification:** Component created and ready for integration

---

## Phase 3: Authentication Flow

### Task 3.1: Implement QR Code Generation
- [ ] Call Tauri command to get WeCom login URL
- [ ] Generate QR code from URL
- [ ] Handle loading and error states
- [ ] Display appropriate status messages

**Verification:** QR code displays (even with mock URL)

### Task 3.2: Implement Polling Logic
- [ ] Set up interval to poll login status
- [ ] Call backend every 2 seconds
- [ ] Handle QR expiration (30 min default)
- [ ] Stop polling on success or error

**Verification:** Polling starts/stops correctly, handles cleanup on unmount

### Task 3.3: Implement Token Exchange
- [ ] Backend: Exchange auth code for access token
- [ ] Backend: Fetch user info from WeCom
- [ ] Frontend: Store user in AuthStore
- [ ] Frontend: Persist tokens securely

**Verification:** Can simulate login flow with mock data

---

## Phase 4: Integration & Routing

### Task 4.1: Set Up Protected Routes
- [ ] Wrap main app routes with AuthGuard
- [ ] Add /login route
- [ ] Add /logout route handler
- [ ] Handle auth state on app startup

**Verification:** Opening app shows login first, successful login shows main app

### Task 4.2: Handle Auth Callback
- [ ] Create callback handling logic
- [ ] Parse URL parameters for auth code
- [ ] Validate state parameter
- [ ] Complete login flow

**Verification:** Simulating callback with code completes login

### Task 4.3: Implement Logout
- [ ] Clear AuthStore state
- [ ] Remove persisted tokens
- [ ] Redirect to login
- [ ] Handle logout errors gracefully

**Verification:** Logout button clears session and shows login screen

---

## Phase 5: WeCom Integration

### Task 5.1: Configure WeCom Credentials
- [ ] Add WeCom config struct (corp_id, agent_id, secret)
- [ ] Load from environment or config file
- [ ] Add validation on startup

**Verification:** App validates config on startup, warns if missing

### Task 5.2: Implement WeCom API Client
- [ ] Create WeCom client module
- [ ] Implement get_login_url
- [ ] Implement get_access_token
- [ ] Implement get_user_info
- [ ] Add error handling and retries

**Verification:** Can make test calls with real WeCom credentials

### Task 5.3: Handle Token Refresh
- [ ] Implement refresh token logic
- [ ] Schedule automatic refresh before expiry
- [ ] Handle refresh failures (re-login required)

**Verification:** Token refresh test passes

---

## Phase 6: Polish & Testing

### Task 6.1: Add Loading States
- [ ] Show skeleton/loading on QR generation
- [ ] Show progress on login attempt
- [ ] Disable buttons during async operations
- [ ] Add error retry UI

**Verification:** UI shows loading states appropriately

### Task 6.2: Add Error Handling UI
- [ ] Toast notifications for errors
- [ ] Inline error messages on login page
- [ ] Network error recovery
- [ ] Session expiry handling

**Verification:** All error scenarios show user-friendly messages

### Task 6.3: Manual Testing
- [ ] Full login flow with real WeCom account
- [ ] QR expiration handling
- [ ] App restart with valid session
- [ ] Logout and re-login
- [ ] Network failure scenarios

**Verification:** All test scenarios documented with results

---

## Verification Checklist

Before marking complete:
- [ ] All TypeScript compiles without errors
- [ ] Rust compiles without warnings
- [ ] Login flow works end-to-end
- [ ] Session persists after app restart
- [ ] Logout clears all auth data
- [ ] UI is responsive and accessible
- [ ] Error handling covers all edge cases

## Time Estimate

- Phase 1: 2 hours
- Phase 2: 2 hours  
- Phase 3: 3 hours
- Phase 4: 2 hours
- Phase 5: 2 hours
- Phase 6: 2 hours

**Total: ~13 hours** (excluding WeCom account setup time)
