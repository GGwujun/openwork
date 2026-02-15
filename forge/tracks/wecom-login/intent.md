# Intent: WeCom Enterprise Login

## Why

OpenWork currently has no authentication mechanism. As a multi-user capable agent workspace, it needs:
1. **User identity** - Track who is using the app and their preferences
2. **Access control** - Different users may have different permissions
3. **Security** - Prevent unauthorized access to sensitive AI operations
4. **Audit trail** - Know who initiated which agent sessions

WeCom (企业微信) is chosen because:
- Common in Chinese enterprises (matches target market)
- QR code login provides seamless mobile-to-desktop experience
- Enterprise directory integration for team management
- No password management required

## Scope

**In Scope:**
- Login screen with WeCom QR code
- QR code generation via WeCom OAuth 2.0
- Token exchange and session management
- Route guards requiring authentication
- Token persistence (secure storage)
- Logout functionality

**Out of Scope:**
- Multiple login methods (only WeCom for now)
- User profile management UI
- Role-based permissions (tokens only)
- SSO with other providers

## Success Criteria

1. [x] User sees login screen if not authenticated
2. [x] QR code displays (using external API for prototyping)
3. [ ] Login completes within 30 seconds of scan (requires WeCom account setup)
4. [x] Session persists across app restarts (localStorage implementation)
5. [x] Logout clears session and returns to login
6. [ ] All existing app functionality still works after login (requires manual testing)

## Implementation Summary

### Created Files:
- `packages/app/src/app/stores/auth.ts` - Global authentication state management
- `packages/desktop/src-tauri/src/commands/auth.rs` - Rust backend commands for WeCom API
- `packages/app/src/app/pages/login.tsx` - Login page with QR code display
- `packages/app/src/app/components/AuthGuard.tsx` - Route protection wrapper
- `packages/app/src/app/components/UserProfile.tsx` - User info and logout button

### Modified Files:
- `packages/app/src/index.tsx` - Added login route and auth guard
- `packages/desktop/src-tauri/src/lib.rs` - Registered auth commands
- `packages/desktop/src-tauri/src/commands/mod.rs` - Exported auth module

### Next Steps for Production:
1. Set up WeCom Corp ID and Agent ID in environment variables
2. Implement actual WeCom API integration (currently uses placeholder)
3. Add secure token storage using Tauri's secure storage instead of localStorage
4. Integrate UserProfile component into app header/sidebar
5. Test full E2E flow with real WeCom account
