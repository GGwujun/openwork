# Owpenbot Usage Guide

> **Owpenbot** is a Slack + Telegram + WeCom bridge for a running OpenCode server. It allows you to interact with OpenCode agents through messaging platforms.

## Table of Contents

1. [Installation](#installation)
2. [CLI Commands & Subcommands](#cli-commands--subcommands)
3. [Configuration Options](#configuration-options)
4. [Integration Workflows](#integration-workflows)
5. [Setup & Deployment](#setup--deployment)
6. [Real Usage Examples](#real-usage-examples)

---

## Installation

### One-Command Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/different-ai/openwork/dev/packages/owpenbot/install.sh | bash
```

### Install from npm

```bash
npm install -g owpenwork
```

### Quick Run Without Install

```bash
npx owpenwork
```

### From Source (Development)

```bash
# Clone and setup
git clone https://github.com/different-ai/openwork.git
cd openwork

# One-command setup (installs deps, builds, creates `.env` if missing)
pnpm -C packages/owpenbot setup

# Or manual setup
pnpm install
cd packages/owpenbot
pnpm build
```

---

## CLI Commands & Subcommands

### Global Options

```bash
owpenbot [command] [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format (useful for scripting) |
| `--version` | Show version number |
| `--help` | Show help |

### Core Commands

#### `start` / `serve`

Start the bridge process (connect to messaging platforms).

```bash
# Start with default configuration
owpenbot start

# Start with specific workspace
owpenbot start /path/to/workspace

# Start with custom OpenCode server URL
owpenbot start --opencode-url http://localhost:4096

# Both options
owpenbot start /path/to/workspace --opencode-url http://localhost:4096
```

**Aliases:** `start` and `serve` are equivalent (`serve` is for headless mode).

#### `health`

Check OpenCode server health status.

```bash
# Check health (exit 0 if healthy, 1 if not)
owpenbot health

# JSON output
owpenbot health --json
```

**JSON Output Example:**
```json
{
  "healthy": true,
  "opencodeUrl": "http://127.0.0.1:4096",
  "identities": {
    "telegram": [{ "id": "default", "enabled": true }],
    "slack": [{ "id": "default", "enabled": true }],
    "wecom": [{ "id": "default", "mode": "ai-bot", "enabled": true }]
  }
}
```

#### `status`

Show current identity and OpenCode status.

```bash
# Show status
owpenbot status

# JSON output
owpenbot status --json
```

**Output:**
```
Config: /home/user/.openwork/owpenbot/owpenbot.json
Health port: 3005
Telegram bots: 1
Slack apps: 1
WeCom apps: 0
OpenCode URL: http://127.0.0.1:4096
```

---

### Telegram Commands

Manage Telegram bot identities.

#### `telegram list`

List all Telegram bot identities.

```bash
owpenbot telegram list
owpenbot telegram list --json
```

#### `telegram add`

Add or update a Telegram bot identity.

```bash
# Add with default ID
owpenbot telegram add <bot-token>

# Add with custom ID
owpenbot telegram add <bot-token> --id production

# Add disabled
owpenbot telegram add <bot-token> --id test --disabled
```

| Option | Description | Default |
|--------|-------------|---------|
| `--id <id>` | Identity identifier | `default` |
| `--disabled` | Add identity but disable it | `false` |

#### `telegram remove`

Remove a Telegram bot identity.

```bash
owpenbot telegram remove <id>
```

---

### Slack Commands

Manage Slack app identities.

#### `slack list`

List all Slack app identities.

```bash
owpenbot slack list
owpenbot slack list --json
```

#### `slack add`

Add or update a Slack app identity.

```bash
# Add with default ID
owpenbot slack add <bot-token> <app-token>

# Add with custom ID
owpenbot slack add xoxb-... xapp-... --id marketing

# Add disabled
owpenbot slack add xoxb-... xapp-... --id dev --disabled
```

| Option | Description | Default |
|--------|-------------|---------|
| `--id <id>` | Identity identifier | `default` |
| `--disabled` | Add identity but disable it | `false` |

#### `slack remove`

Remove a Slack app identity.

```bash
owpenbot slack remove <id>
```

---

### WeCom Commands

Manage WeCom (WeChat Work) identities.

#### `wecom list`

List all WeCom identities.

```bash
owpenbot wecom list
owpenbot wecom list --json
```

#### `wecom add`

Add or update a WeCom identity.

```bash
# AI Bot mode
owpenbot wecom add <token> <encoding-aes-key>

# AI Bot mode with custom ID
owpenbot wecom add <token> <encoding-aes-key> --id support

# App mode (requires corp credentials)
owpenbot wecom add - - \
  --mode app \
  --corp-id <corp-id> \
  --agent-id <agent-id> \
  --secret <secret>

# Full example with webhook path
owpenbot wecom add <token> <encoding-aes-key> \
  --id bot1 \
  --webhook-path /wecom/webhook/bot1
```

| Option | Description | Default |
|--------|-------------|---------|
| `--id <id>` | Identity identifier | `default` |
| `--mode <mode>` | `ai-bot` or `app` | `ai-bot` |
| `--corp-id <id>` | Corp ID (required for app mode) | - |
| `--agent-id <id>` | Agent ID (required for app mode) | - |
| `--secret <secret>` | App secret (required for app mode) | - |
| `--webhook-path <path>` | Custom webhook path | `/wecom/<id>` |
| `--disabled` | Add identity but disable it | `false` |

#### `wecom remove`

Remove a WeCom identity.

```bash
owpenbot wecom remove <id>
```

---

### Bindings Commands

Manage message routing bindings (maps `(channel, identityId, peerId)` → `directory`).

#### `bindings list`

List all bindings.

```bash
# List all bindings
owpenbot bindings list

# Filter by channel
owpenbot bindings list --channel telegram

# Filter by identity
owpenbot bindings list --channel telegram --identity default

# JSON output
owpenbot bindings list --json
```

#### `bindings set`

Create or update a binding.

```bash
owpenbot bindings set \
  --channel telegram \
  --identity default \
  --peer <chat-id> \
  --dir /path/to/workspace
```

| Option | Required | Description |
|--------|----------|-------------|
| `--channel` | Yes | `telegram`, `slack`, or `wecom` |
| `--identity` | Yes | Identity ID |
| `--peer` | Yes | Peer ID (chat ID, user ID, etc.) |
| `--dir` | Yes | Workspace directory path |

#### `bindings clear`

Remove a binding.

```bash
owpenbot bindings clear \
  --channel telegram \
  --identity default \
  --peer <chat-id>
```

---

### Config Commands

Manage configuration file directly.

#### `config get`

Get configuration values.

```bash
# Get entire config
owpenbot config get

# Get specific key (dot notation)
owpenbot config get opencodeUrl
owpenbot config get channels.telegram.bots

# JSON output
owpenbot config get --json
```

#### `config set`

Set configuration values.

```bash
# Set simple value
owpenbot config set opencodeUrl http://localhost:4096

# Set nested value
owpenbot config set channels.telegram.enabled false

# Set JSON value
owpenbot config set channels.telegram.bots '[{"id":"default","token":"xxx","enabled":true}]'
```

---

### Send Commands

Send test messages via CLI (useful for testing).

```bash
# Send to Telegram
owpenbot send \
  --channel telegram \
  --identity default \
  --to <chat-id> \
  --message "Hello from owpenbot"

# Send to Slack
owpenbot send \
  --channel slack \
  --identity default \
  --to <channel-id> \
  --message "Hello from owpenbot"

# Send to WeCom (app mode only)
owpenbot send \
  --channel wecom \
  --identity default \
  --to <user-id> \
  --message "Hello from owpenbot"
```

---

## Configuration Options

### Environment Variables

All configuration can be set via environment variables. Create a `.env` file or export them directly.

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENCODE_URL` | OpenCode server URL | `http://127.0.0.1:4096` |
| `OPENCODE_DIRECTORY` | Default workspace directory | `/home/user/projects/my-app` |

#### Authentication

| Variable | Description |
|----------|-------------|
| `OPENCODE_SERVER_USERNAME` | Username for OpenCode server auth |
| `OPENCODE_SERVER_PASSWORD` | Password for OpenCode server auth |

#### Telegram

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | - |
| `TELEGRAM_ENABLED` | Enable Telegram adapters | `true` |

#### Slack

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Bot token (starts with `xoxb-`) | - |
| `SLACK_APP_TOKEN` | App token for Socket Mode (starts with `xapp-`) | - |
| `SLACK_ENABLED` | Enable Slack adapters | `true` |

#### WeCom (WeChat Work)

| Variable | Description | Default |
|----------|-------------|---------|
| `WECOM_MODE` | Connection mode: `ai-bot` or `app` | `ai-bot` |
| `WECOM_TOKEN` | Token (required for `ai-bot` mode) | - |
| `WECOM_ENCODING_AES_KEY` | Encoding AES key (43 chars, required for `ai-bot`) | - |
| `WECOM_CORP_ID` | Corp ID (required for `app` mode) | - |
| `WECOM_AGENT_ID` | Agent ID (required for `app` mode) | - |
| `WECOM_SECRET` | App secret (required for `app` mode) | - |
| `WECOM_WEBHOOK_HOST` | Webhook bind host | `127.0.0.1` |
| `WECOM_WEBHOOK_PORT` | Webhook bind port | `3010` |
| `WECOM_WEBHOOK_PATH` | Custom webhook path | `/wecom/<id>` |
| `WECOM_ENABLED` | Enable WeCom adapters | `true` |

#### Data & Paths

| Variable | Description | Default |
|----------|-------------|---------|
| `OWPENBOT_DATA_DIR` | Data directory | `~/.openwork/owpenbot` |
| `OWPENBOT_DB_PATH` | SQLite database path | `~/.openwork/owpenbot/owpenbot.db` |
| `OWPENBOT_CONFIG_PATH` | Config file path | `~/.openwork/owpenbot/owpenbot.json` |
| `OWPENBOT_LOG_FILE` | Log file path | `~/.openwork/owpenbot/logs/owpenbot.log` |

#### Health Server

| Variable | Description | Default |
|----------|-------------|---------|
| `OWPENBOT_HEALTH_PORT` | Health HTTP server port | `3005` |
| `OWPENBOT_HEALTH_HOST` | Health server bind host | `127.0.0.1` |

#### Behavior

| Variable | Description | Default |
|----------|-------------|---------|
| `GROUPS_ENABLED` | Allow group chat handling | `false` |
| `TOOL_UPDATES_ENABLED` | Send tool execution updates | `false` |
| `TOOL_OUTPUT_LIMIT` | Max tool output characters in updates | `1200` |
| `PERMISSION_MODE` | Permission handling: `allow` or `deny` | `allow` |
| `LOG_LEVEL` | Logging level | `info` |

#### Advanced

| Variable | Description | Example |
|----------|-------------|---------|
| `OWPENBOT_MODEL` | Default model override (format: `provider/model`) | `anthropic/claude-opus-4` |

---

### Configuration File (owpenbot.json)

The config file is stored at `~/.openwork/owpenbot/owpenbot.json` by default.

#### Structure

```json
{
  "version": 1,
  "opencodeUrl": "http://127.0.0.1:4096",
  "opencodeDirectory": "/path/to/workspace",
  "groupsEnabled": false,
  "channels": {
    "telegram": {
      "enabled": true,
      "bots": [
        {
          "id": "default",
          "token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
          "enabled": true,
          "directory": "/path/to/workspace"
        }
      ]
    },
    "slack": {
      "enabled": true,
      "apps": [
        {
          "id": "default",
          "botToken": "xoxb-...",
          "appToken": "xapp-...",
          "enabled": true,
          "directory": "/path/to/workspace"
        }
      ]
    },
    "wecom": {
      "enabled": true,
      "webhookHost": "0.0.0.0",
      "webhookPort": 3010,
      "apps": [
        {
          "id": "default",
          "mode": "ai-bot",
          "token": "...",
          "encodingAesKey": "...",
          "enabled": true
        }
      ]
    }
  }
}
```

#### Field Reference

**Top-level:**
- `version` (required): Config file version (currently `1`)
- `opencodeUrl`: Default OpenCode server URL
- `opencodeDirectory`: Default workspace directory
- `groupsEnabled`: Allow group chats

**Channel Configs:**
- `channels.telegram.enabled`: Enable Telegram globally
- `channels.telegram.bots`: Array of bot configurations
  - `id`: Unique identifier
  - `token`: Bot token from @BotFather
  - `enabled`: Whether this bot is active
  - `directory`: (optional) Default workspace for this bot

- `channels.slack.enabled`: Enable Slack globally
- `channels.slack.apps`: Array of app configurations
  - `id`: Unique identifier
  - `botToken`: OAuth bot token (xoxb-...)
  - `appToken`: Socket mode token (xapp-...)
  - `enabled`: Whether this app is active
  - `directory`: (optional) Default workspace for this app

- `channels.wecom.enabled`: Enable WeCom globally
- `channels.wecom.webhookHost`: Bind host for webhook server
- `channels.wecom.webhookPort`: Port for webhook server
- `channels.wecom.apps`: Array of app configurations
  - `id`: Unique identifier
  - `mode`: `ai-bot` or `app`
  - `token`: (ai-bot) Token
  - `encodingAesKey`: (ai-bot) 43-char AES key
  - `corpId`: (app) Corp ID
  - `agentId`: (app) Agent ID
  - `secret`: (app) App secret
  - `webhookPath`: (ai-bot) Custom webhook path
  - `enabled`: Whether this identity is active
  - `directory`: (optional) Default workspace for this app

---

## Integration Workflows

### Message Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│  Telegram/   │────▶│  owpenbot   │────▶│  OpenCode   │
│ (Messaging) │     │  Slack/      │     │   Bridge    │     │   Server    │
│             │◀────│  WeCom       │◀────│             │◀────│             │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               │ (bindings)
                                               ▼
                                        ┌─────────────┐
                                        │  Bindings   │
                                        │    DB       │
                                        └─────────────┘
```

### Session Management

1. **New Chat:** When a user first messages the bot, owpenbot checks bindings for a workspace directory
2. **Existing Chat:** Uses cached session ID from the database
3. **Session Binding:** OpenCode sessions are mapped to `(channel, identityId, peerId)`

### Routing Logic

Owpenbot uses a binding system to route messages to the correct workspace:

```
(channel, identityId, peerId) → directory
```

**Priority order for directory resolution:**
1. Explicit binding in database (set via `owpenbot bindings set`)
2. Identity-level default directory (from config)
3. `OPENCODE_DIRECTORY` environment variable
4. Current working directory

### Event Subscription

Owpenbot subscribes to OpenCode server events for real-time updates:
- `message.updated`: Model selection changes
- `session.status`: Track busy/idle states
- `message.part.updated`: Tool execution updates (if enabled)
- `permission.asked`: Auto-respond to permission requests

### Health Server Endpoints

When running, owpenbot exposes a health HTTP server:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /health` | GET | Health status |
| `GET /config` | GET | Current configuration snapshot |
| `POST /config/groups` | POST | Toggle groups enabled |
| `GET /identities/telegram` | GET | List Telegram identities |
| `POST /identities/telegram` | POST | Add/update Telegram identity |
| `DELETE /identities/telegram/:id` | DELETE | Remove Telegram identity |
| `GET /identities/slack` | GET | List Slack identities |
| `POST /identities/slack` | POST | Add/update Slack identity |
| `DELETE /identities/slack/:id` | DELETE | Remove Slack identity |
| `GET /identities/wecom` | GET | List WeCom identities |
| `POST /identities/wecom` | POST | Add/update WeCom identity |
| `DELETE /identities/wecom/:id` | DELETE | Remove WeCom identity |
| `GET /bindings` | GET | List bindings |
| `POST /bindings` | POST | Create binding |
| `POST /bindings/clear` | POST | Remove binding |
| `POST /send` | POST | Send message via HTTP |

---

## Setup & Deployment

### Basic Setup (Single Platform)

#### Telegram Setup

1. Create a bot with [@BotFather](https://t.me/botfather):
   ```
   /newbot
   # Follow prompts, get token (123456789:ABCdef...)
   ```

2. Configure:
   ```bash
   owpenbot telegram add <token>
   ```

3. Start:
   ```bash
   owpenbot start
   ```

#### Slack Setup

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)

2. Enable Socket Mode and generate an app token (`xapp-...`)

3. Add bot token scopes:
   - `chat:write`
   - `app_mentions:read`
   - `im:history`
   - `users:read`

4. Subscribe to bot events:
   - `app_mention`
   - `message.im`

5. Install to workspace and get bot token (`xoxb-...`)

6. Configure:
   ```bash
   owpenbot slack add <xoxb-token> <xapp-token>
   ```

7. Start:
   ```bash
   owpenbot start
   ```

#### WeCom Setup (AI Bot Mode)

1. Create a WeCom AI Bot in [WeCom Admin](https://work.weixin.qq.com/wework_admin)

2. Get token and encoding AES key

3. Configure:
   ```bash
   owpenbot wecom add <token> <encoding-aes-key>
   ```

4. Set webhook URL in WeCom admin: `http://your-server:3010/wecom/default`

5. Start:
   ```bash
   owpenbot start
   ```

### Multi-Identity Setup

Configure multiple identities for different teams:

```bash
# Add multiple Telegram bots
owpenbot telegram add <token-dev> --id dev
owpenbot telegram add <token-support> --id support

# Add multiple Slack apps
owpenbot slack add <xoxb-dev> <xapp-dev> --id dev
owpenbot slack add <xoxb-prod> <xapp-prod> --id prod

# Set default directories for each
owpenbot config set 'channels.telegram.bots[0].directory' /home/user/dev
owpenbot config set 'channels.slack.apps[0].directory' /home/user/sales
```

### Production Deployment

#### Systemd Service

Create `/etc/systemd/system/owpenbot.service`:

```ini
[Unit]
Description=Owpenbot - OpenCode Messaging Bridge
After=network.target

[Service]
Type=simple
User=owpenbot
WorkingDirectory=/opt/owpenbot
ExecStart=/usr/local/bin/owpenbot start
Restart=always
RestartSec=10

Environment="OPENCODE_URL=http://localhost:4096"
Environment="OPENCODE_DIRECTORY=/opt/workspaces"
Environment="LOG_LEVEL=info"
Environment="OWPENBOT_HEALTH_PORT=3005"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable owpenbot
sudo systemctl start owpenbot
sudo systemctl status owpenbot
```

#### Docker Deployment

```dockerfile
FROM node:20-alpine

RUN npm install -g owpenwork

ENV OPENCODE_URL=http://opencode:4096
ENV OWPENBOT_HEALTH_PORT=3005

EXPOSE 3005

CMD ["owpenbot", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  opencode:
    image: your/opencode:latest
    ports:
      - "4096:4096"
    volumes:
      - ./workspaces:/workspaces

  owpenbot:
    image: your/owpenbot:latest
    environment:
      - OPENCODE_URL=http://opencode:4096
      - OPENCODE_DIRECTORY=/workspaces
      - OWPENBOT_HEALTH_PORT=3005
      - OWPENBOT_DATA_DIR=/data
    volumes:
      - ./data:/data
    ports:
      - "3005:3005"
    depends_on:
      - opencode
```

---

## Real Usage Examples

### Example 1: Development Team Chatbot

**Scenario:** Engineering team wants a Slack bot for quick code assistance.

```bash
# 1. Setup Slack app (see Slack Setup section)

# 2. Configure
owpenbot slack add xoxb-your-bot-token xapp-your-app-token --id engineering

# 3. Set default workspace
owpenbot bindings set \
  --channel slack \
  --identity engineering \
  --peer "@your-user-id" \
  --dir /home/devteam/project

# 4. Start
owpenbot start /home/devteam/project
```

**Usage in Slack:**
```
@owpenbot review this PR: https://github.com/...
@owpenbot create a React component for user profiles
```

### Example 2: Support Ticketing via Telegram

**Scenario:** Support team receives tickets via Telegram bot.

```bash
# 1. Configure Telegram bot
owpenbot telegram add <bot-token> --id support

# 2. Create binding when new user messages (or pre-configure)
owpenbot bindings set \
  --channel telegram \
  --identity support \
  --peer "123456789" \
  --dir /home/support/tickets

# 3. Start with specific model
OWPENBOT_MODEL=anthropic/claude-opus-4-5 owpenbot start
```

### Example 3: Multi-Workspace Support

**Scenario:** Different teams have different workspaces.

```bash
# Configure identities
owpenbot telegram add <token-team-a> --id team-a
owpenbot telegram add <token-team-b> --id team-b
owpenbot slack add <xoxb-a> <xapp-a> --id sales
owpenbot slack add <xoxb-b> <xapp-b> --id engineering

# Set default workspaces in config
owpenbot config set 'channels.telegram.bots[0].directory' /workspaces/team-a
owpenbot config set 'channels.telegram.bots[1].directory' /workspaces/team-b
owpenbot config set 'channels.slack.apps[0].directory' /workspaces/sales
owpenbot config set 'channels.slack.apps[1].directory' /workspaces/engineering

# Bind specific users
owpenbot bindings set --channel slack --identity sales --peer "U12345" --dir /workspaces/sales/special

# Start
owpenbot start
```

### Example 4: Scripting with JSON Output

**Scenario:** CI/CD pipeline needs to check owpenbot health.

```bash
#!/bin/bash

# Check if owpenbot is healthy
if ! owpenbot health --json | jq -e '.healthy == true' > /dev/null; then
  echo "Owpenbot is not healthy, restarting..."
  systemctl restart owpenbot
  exit 1
fi

# List active identities
echo "Active Telegram bots:"
owpenbot status --json | jq '.telegram[] | select(.enabled) | .id'

# Send notification through all bound channels
curl -sS "http://127.0.0.1:3005/send" \
  -H 'Content-Type: application/json' \
  -d '{
    "channel": "telegram",
    "directory": "/workspaces/main",
    "text": "Deployment complete!"
  }'
```

### Example 5: Temporary Binding

**Scenario:** Contractor needs temporary access for a specific project.

```bash
# Add contractor's Telegram chat
owpenbot bindings set \
  --channel telegram \
  --identity default \
  --peer "987654321" \
  --dir /projects/contractor-work

# When done, clear binding
owpenbot bindings clear \
  --channel telegram \
  --identity default \
  --peer "987654321"
```

### Example 6: Health Monitoring Integration

```bash
# Check health and get detailed info
owpenbot health --json | jq '{
  healthy: .healthy,
  opencode_url: .opencodeUrl,
  telegram_bots: (.identities.telegram | length),
  slack_apps: (.identities.slack | length)
}'

# Output:
# {
#   "healthy": true,
#   "opencode_url": "http://127.0.0.1:4096",
#   "telegram_bots": 2,
#   "slack_apps": 1
# }
```

### Example 7: Automated Backup & Restore

```bash
# Backup current configuration
owpenbot config get --json > owpenbot-backup-$(date +%Y%m%d).json

# Backup bindings
owpenbot bindings list --json > owpenbot-bindings-$(date +%Y%m%d).json

# Restore from backup
cp owpenbot-backup-20240214.json ~/.openwork/owpenbot/owpenbot.json

# Restore bindings (script)
```

---

## Troubleshooting

### Common Issues

**"OpenCode server not reachable"**
- Verify `OPENCODE_URL` is correct
- Check if OpenCode server is running: `curl http://localhost:4096/health`

**"Telegram bot not responding"**
- Verify token: `owpenbot telegram list`
- Check bot is started with bot token owner
- Ensure webhook is not set (delete with BotFather if needed)

**"Slack app connection fails"**
- Verify bot token starts with `xoxb-`
- Verify app token starts with `xapp-`
- Ensure Socket Mode is enabled in Slack app settings

**"Permission denied errors"**
- Set `PERMISSION_MODE=allow` or configure specific permissions
- Check OpenCode server credentials

### Debug Mode

```bash
# Increase logging
LOG_LEVEL=debug owpenbot start

# Check detailed status
owpenbot status --json

# Monitor logs
tail -f ~/.openwork/owpenbot/logs/owpenbot.log
```

### Test Commands

```bash
# Test Telegram
owpenbot send --channel telegram --identity default --to <chat-id> --message "Test"

# Test Slack
owpenbot send --channel slack --identity default --to "#general" --message "Test"

# Test OpenCode connection
owpenbot health --json
```

---

## References

- **Package:** `owpenwork` on npm
- **Config:** `~/.openwork/owpenbot/owpenbot.json`
- **Database:** `~/.openwork/owpenbot/owpenbot.db`
- **Logs:** `~/.openwork/owpenbot/logs/owpenbot.log`
- **Source:** [github.com/different-ai/openwork](https://github.com/different-ai/openwork)

---

*Last updated: Documentation based on owpenbot v0.11.55*
