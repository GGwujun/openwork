use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

// WeCom Configuration - Hardcoded from user's config
// In production, these should come from environment variables or secure storage
pub const WECOM_CORP_ID: &str = "wxcebe114cab473881";
pub const WECOM_AGENT_ID: &str = "1000002";
pub const WECOM_CORP_SECRET: &str = "8ulTzeCmN9s7QsaZEo6T9qOKMFWe6fSoS9QAb7Vejls";

// WeCom API Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeComConfig {
    pub corp_id: String,
    pub corp_secret: String,
    pub agent_id: String,
}

impl WeComConfig {
    /// Load config from hardcoded values
    pub fn from_hardcoded() -> Self {
        Self {
            corp_id: WECOM_CORP_ID.to_string(),
            corp_secret: WECOM_CORP_SECRET.to_string(),
            agent_id: WECOM_AGENT_ID.to_string(),
        }
    }
    
    /// Load config from environment variables (fallback to hardcoded)
    pub fn from_env() -> Self {
        Self {
            corp_id: std::env::var("WECOM_CORP_ID").unwrap_or_else(|_| WECOM_CORP_ID.to_string()),
            corp_secret: std::env::var("WECOM_CORP_SECRET").unwrap_or_else(|_| WECOM_CORP_SECRET.to_string()),
            agent_id: std::env::var("WECOM_AGENT_ID").unwrap_or_else(|_| WECOM_AGENT_ID.to_string()),
        }
    }
    
    /// Validate that all required fields are present
    pub fn validate(&self) -> Result<(), String> {
        if self.corp_id.is_empty() {
            return Err("WeCom Corp ID is required".to_string());
        }
        if self.corp_secret.is_empty() {
            return Err("WeCom Corp Secret is required".to_string());
        }
        if self.agent_id.is_empty() {
            return Err("WeCom Agent ID is required".to_string());
        }
        Ok(())
    }
}

// In-memory store for login states
pub struct LoginStateStore {
    states: Mutex<HashMap<String, LoginState>>,
    access_tokens: Mutex<HashMap<String, AccessTokenInfo>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LoginState {
    pub state: String,
    pub created_at: u64,
    pub status: LoginStatus,
    pub user_info: Option<WeComUserInfo>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LoginStatus {
    Pending,
    Scanned,
    Confirmed,
    Expired,
    Cancelled,
}

// Access token storage
#[derive(Clone, Debug)]
struct AccessTokenInfo {
    token: String,
    expires_at: u64,
    corp_id: String,
}

impl Default for LoginStateStore {
    fn default() -> Self {
        Self {
            states: Mutex::new(HashMap::new()),
            access_tokens: Mutex::new(HashMap::new()),
        }
    }
}

// WeCom API Types
#[derive(Debug, Deserialize)]
struct WeComAccessTokenResponse {
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    expires_in: i64,
    #[serde(default)]
    errcode: i32,
    #[serde(default)]
    errmsg: String,
}

#[derive(Debug, Deserialize)]
struct WeComUserInfoResponse {
    #[serde(default)]
    userid: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    avatar: String,
    #[serde(default)]
    department: Vec<i64>,
    #[serde(default)]
    errcode: i32,
    #[serde(default)]
    errmsg: String,
}

#[derive(Debug, Deserialize)]
struct WeComUserIdByCodeResponse {
    #[serde(default)]
    userid: String,
    #[serde(default)]
    user_ticket: String,
    #[serde(default)]
    errcode: i32,
    #[serde(default)]
    errmsg: String,
}

// Public types for API
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeComUserInfo {
    pub user_id: String,
    pub name: String,
    pub avatar: Option<String>,
    pub department: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct LoginUrlResponse {
    pub login_url: String,
    pub state: String,
}

#[derive(Debug, Serialize)]
pub struct LoginStatusResponse {
    pub status: String,
    pub user_info: Option<WeComUserInfo>,
}

#[derive(Debug, Serialize)]
pub struct TokenValidationResponse {
    pub valid: bool,
    pub expires_in: Option<i64>,
}

// WeCom API Client
pub struct WeComClient;

impl WeComClient {
    /// Get access token from WeCom API
    /// https://developer.work.weixin.qq.com/document/path/91039
    pub fn get_access_token(corp_id: &str, corp_secret: &str) -> Result<(String, i64), String> {
        let url = format!(
            "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={}&corpsecret={}",
            corp_id, corp_secret
        );
        
        let response: WeComAccessTokenResponse = ureq::get(&url)
            .call()
            .map_err(|e| format!("Failed to fetch access token: {}", e))?
            .into_json()
            .map_err(|e| format!("Failed to parse access token response: {}", e))?;
        
        if response.errcode != 0 {
            return Err(format!(
                "WeCom API error (gettoken): {} - {}",
                response.errcode, response.errmsg
            ));
        }
        
        Ok((response.access_token, response.expires_in))
    }
    
    /// Get user ID from oauth2 code
    /// https://developer.work.weixin.qq.com/document/path/91023
    pub fn get_userid_by_code(
        access_token: &str,
        code: &str,
    ) -> Result<String, String> {
        let url = format!(
            "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token={}&code={}",
            access_token, code
        );
        
        let response: WeComUserIdByCodeResponse = ureq::get(&url)
            .call()
            .map_err(|e| format!("Failed to get user info: {}", e))?
            .into_json()
            .map_err(|e| format!("Failed to parse user info response: {}", e))?;
        
        if response.errcode != 0 {
            return Err(format!(
                "WeCom API error (getuserinfo): {} - {}",
                response.errcode, response.errmsg
            ));
        }
        
        Ok(response.userid)
    }
    
    /// Get detailed user info
    /// https://developer.work.weixin.qq.com/document/path/90196
    pub fn get_user_detail(
        access_token: &str,
        user_id: &str,
    ) -> Result<WeComUserInfo, String> {
        let url = format!(
            "https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token={}&userid={}",
            access_token, user_id
        );
        
        let response: WeComUserInfoResponse = ureq::get(&url)
            .call()
            .map_err(|e| format!("Failed to get user details: {}", e))?
            .into_json()
            .map_err(|e| format!("Failed to parse user details: {}", e))?;
        
        if response.errcode != 0 {
            return Err(format!(
                "WeCom API error (user/get): {} - {}",
                response.errcode, response.errmsg
            ));
        }
        
        Ok(WeComUserInfo {
            user_id: response.userid,
            name: response.name,
            avatar: if response.avatar.is_empty() {
                None
            } else {
                Some(response.avatar)
            },
            department: Some(
                response.department.iter().map(|d| d.to_string()).collect()
            ),
        })
    }
}

/// Get or refresh access token for a corp
async fn get_valid_access_token(
    corp_id: &str,
    corp_secret: &str,
    store: &State<'_, LoginStateStore>,
) -> Result<String, String> {
    // Check if we have a valid cached token
    {
        let tokens = store.access_tokens.lock().map_err(|e| e.to_string())?;
        if let Some(token_info) = tokens.get(corp_id) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            // Return cached token if not expired (with 5 min buffer)
            if token_info.expires_at > now + 300 {
                return Ok(token_info.token.clone());
            }
        }
    }
    
    // Fetch new token
    let (token, expires_in) = WeComClient::get_access_token(corp_id, corp_secret)?;
    
    // Cache the token
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    {
        let mut tokens = store.access_tokens.lock().map_err(|e| e.to_string())?;
        tokens.insert(
            corp_id.to_string(),
            AccessTokenInfo {
                token: token.clone(),
                expires_at: now + expires_in as u64,
                corp_id: corp_id.to_string(),
            },
        );
    }
    
    Ok(token)
}

// Tauri Commands

/// Generate WeCom login URL
#[tauri::command]
pub async fn generate_wecom_login_url(
    corp_id: String,
    _agent_id: String,
    store: State<'_, LoginStateStore>,
) -> Result<LoginUrlResponse, String> {
    let state = Uuid::new_v4().to_string();
    
    let login_state = LoginState {
        state: state.clone(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        status: LoginStatus::Pending,
        user_info: None,
    };
    
    {
        let mut states = store.states.lock().map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        states.retain(|_, s| now - s.created_at < 1800);
        states.insert(state.clone(), login_state);
    }
    
    // Use custom protocol for desktop app callback
    // This avoids needing a public domain for OAuth redirect
    let redirect_uri = format!("openwork://auth/callback");
    let login_url = format!(
        "https://open.weixin.qq.com/connect/oauth2/authorize?appid={}&redirect_uri={}&response_type=code&scope=snsapi_base&state={}#wechat_redirect",
        corp_id,
        urlencoding::encode(&redirect_uri),
        state
    );
    
    Ok(LoginUrlResponse {
        login_url,
        state,
    })
}

/// Check login status
#[tauri::command]
pub async fn check_login_status(
    state: String,
    store: State<'_, LoginStateStore>,
) -> Result<LoginStatusResponse, String> {
    let states = store.states.lock().map_err(|e| e.to_string())?;
    
    if let Some(login_state) = states.get(&state) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if now - login_state.created_at > 1800 {
            return Ok(LoginStatusResponse {
                status: "expired".to_string(),
                user_info: None,
            });
        }
        
        let status_str = match login_state.status {
            LoginStatus::Pending => "pending",
            LoginStatus::Scanned => "scanned",
            LoginStatus::Confirmed => "confirmed",
            LoginStatus::Expired => "expired",
            LoginStatus::Cancelled => "cancelled",
        };
        
        Ok(LoginStatusResponse {
            status: status_str.to_string(),
            user_info: login_state.user_info.clone(),
        })
    } else {
        Err("Invalid state".to_string())
    }
}

/// Update login status (scanned)
#[tauri::command]
pub async fn set_login_scanned(
    state: String,
    store: State<'_, LoginStateStore>,
) -> Result<(), String> {
    let mut states = store.states.lock().map_err(|e| e.to_string())?;
    
    if let Some(login_state) = states.get_mut(&state) {
        login_state.status = LoginStatus::Scanned;
        Ok(())
    } else {
        Err("Invalid state".to_string())
    }
}

/// Confirm login by exchanging code for user info
/// Uses hardcoded or environment-based WeCom configuration
#[tauri::command]
pub async fn confirm_login(
    state: String,
    code: String,
    store: State<'_, LoginStateStore>,
) -> Result<WeComUserInfo, String> {
    // Load WeCom config (hardcoded or from env)
    let config = WeComConfig::from_env();
    config.validate()?;
    
    // Get access token
    let access_token = get_valid_access_token(&config.corp_id, &config.corp_secret, &store).await?;
    
    // Exchange code for user ID
    let user_id = WeComClient::get_userid_by_code(&access_token, &code)?;
    
    // Get detailed user info
    let user_info = WeComClient::get_user_detail(&access_token, &user_id)?;
    
    // Update login state
    {
        let mut states = store.states.lock().map_err(|e| e.to_string())?;
        if let Some(login_state) = states.get_mut(&state) {
            login_state.status = LoginStatus::Confirmed;
            login_state.user_info = Some(user_info.clone());
        }
    }
    
    Ok(user_info)
}

/// Verify user is authenticated
#[tauri::command]
pub async fn validate_token(
    corp_id: String,
    store: State<'_, LoginStateStore>,
) -> Result<TokenValidationResponse, String> {
    let tokens = store.access_tokens.lock().map_err(|e| e.to_string())?;
    
    if let Some(token_info) = tokens.get(&corp_id) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if token_info.expires_at > now {
            return Ok(TokenValidationResponse {
                valid: true,
                expires_in: Some((token_info.expires_at - now) as i64),
            });
        }
    }
    
    Ok(TokenValidationResponse {
        valid: false,
        expires_in: None,
    })
}

/// Cleanup old states
#[tauri::command]
pub async fn cleanup_login_state(
    state: String,
    store: State<'_, LoginStateStore>,
) -> Result<(), String> {
    let mut states = store.states.lock().map_err(|e| e.to_string())?;
    states.remove(&state);
    Ok(())
}

/// Clear all cached tokens (call on logout)
#[tauri::command]
pub async fn clear_auth_cache(
    corp_id: Option<String>,
    store: State<'_, LoginStateStore>,
) -> Result<(), String> {
    let mut tokens = store.access_tokens.lock().map_err(|e| e.to_string())?;
    
    if let Some(id) = corp_id {
        tokens.remove(&id);
    } else {
        tokens.clear();
    }
    
    Ok(())
}

/// Parse deep link URL for auth callback
/// URL format: openwork://auth/callback?code=xxx&state=xxx
#[tauri::command]
pub fn parse_auth_deep_link(url: String) -> Result<(String, String), String> {
    // Parse the URL
    let url_parts: Vec<&str> = url.split('?').collect();
    if url_parts.len() != 2 {
        return Err("Invalid deep link URL format".to_string());
    }
    
    let query_string = url_parts[1];
    let params: std::collections::HashMap<String, String> = query_string
        .split('&')
        .filter_map(|pair| {
            let parts: Vec<&str> = pair.split('=').collect();
            if parts.len() == 2 {
                Some((parts[0].to_string(), urlencoding::decode(parts[1]).ok()?.to_string()))
            } else {
                None
            }
        })
        .collect();
    
    let code = params.get("code").ok_or("Missing code parameter")?.clone();
    let state = params.get("state").ok_or("Missing state parameter")?.clone();
    
    Ok((code, state))
}

/// Handle deep link for auth callback
/// This command is called by the frontend when a deep link is received
#[tauri::command]
pub async fn handle_auth_deep_link(
    url: String,
    store: State<'_, LoginStateStore>,
) -> Result<WeComUserInfo, String> {
    let (code, state) = parse_auth_deep_link(url)?;
    
    // Confirm the login using the code and state
    confirm_login(state, code, store).await
}
