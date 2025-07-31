# Bot Credentials Configuration

This directory contains bot credential configurations for XOB CAT. **These files contain sensitive information and should NEVER be committed to version control.**

## File Structure

```
backend/config/
├── README.md               # This documentation
├── bots.example.yaml       # Template for multi-bot configuration (safe to commit)
├── bots.yaml              # Actual bot credentials (NEVER COMMIT)
└── optum-bot.yaml         # Legacy single-bot config (NEVER COMMIT)
```

## Setting Up Bot Credentials

### Option 1: Multi-Bot Configuration (Recommended)

1. Copy the example file:
   ```bash
   cp backend/config/bots.example.yaml backend/config/bots.yaml
   ```

2. Edit `bots.yaml` with your actual bot credentials:
   ```yaml
   bots:
     default: "optum"  # Which bot to use by default
     
     configs:
       optum:
         name: "Optum Bot"
         kore:
           bot_id: "your-optum-bot-id"
           client_id: "your-optum-client-id"
           client_secret: "your-optum-client-secret"
           base_url: "https://bots.kore.ai"
           
       yourbot:
         name: "Your New Bot"
         kore:
           bot_id: "your-new-bot-id"
           client_id: "your-new-client-id"
           client_secret: "your-new-client-secret"
           base_url: "https://bots.kore.ai"
   ```

### Option 2: Environment Variables

Set these environment variables in your `backend/.env` file:
```env
KORE_BOT_ID=your-bot-id
KORE_CLIENT_ID=your-client-id
KORE_CLIENT_SECRET=your-client-secret
KORE_BASE_URL=https://bots.kore.ai
```

### Option 3: Legacy Single-Bot Config

Keep using the existing `optum-bot.yaml` format for backward compatibility.

## Adding a New Bot

To add credentials for a new bot:

1. Edit `backend/config/bots.yaml`
2. Add a new entry under `configs`:
   ```yaml
   configs:
     # ... existing bots ...
     
     newbot:
       name: "New Bot Name"
       kore:
         bot_id: "st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
         client_id: "cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
         client_secret: "your-client-secret"
         base_url: "https://bots.kore.ai"
   ```

3. Optionally, update the `default` bot if needed

## Usage in Code

```typescript
import { multiBotConfigManager } from '../utils/multiBotConfigManager';

// Get default bot config
const defaultConfig = multiBotConfigManager.getKoreConfig();

// Get specific bot config
const optumConfig = multiBotConfigManager.getKoreConfig('optum');
const newBotConfig = multiBotConfigManager.getKoreConfig('newbot');

// List available bots
const availableBots = multiBotConfigManager.getAvailableBots();

// Check if a bot exists
const exists = multiBotConfigManager.botExists('optum');
```

## Security Notes

- ✅ All credential files are excluded from git via `.gitignore`
- ✅ Only `.example.yaml` files are committed to the repository
- ❌ **NEVER** commit actual credential files
- ❌ **NEVER** include credentials in commit messages or code
- ✅ Use environment variables for CI/CD deployment

## Kore.ai Credential Format

Your Kore.ai credentials should look like:
- **Bot ID**: `st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Client ID**: `cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Client Secret**: Base64-encoded secret string
- **Base URL**: Usually `https://bots.kore.ai`

## Troubleshooting

- **Configuration not found**: Ensure `bots.yaml` exists and is properly formatted
- **Invalid credentials**: Check that bot_id, client_id, and client_secret are correct
- **Permission denied**: Verify the credentials have proper API access permissions