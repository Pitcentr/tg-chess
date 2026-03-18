# Telegram Vault for Umbrel

Encrypted password manager using Telegram bot with AES-256 encryption.

## Installation

1. Add this app store to Umbrel
2. Install "Telegram Vault" app
3. Configure via SSH (see below)

## Configuration

After installation, configure via SSH:

```bash
ssh umbrel@umbrel.local
cd ~/umbrel/app-data/vault-telegram-vault
nano docker-compose.yml
```

Edit the environment variables:

```yaml
environment:
  TG_TOKEN: "YOUR_BOT_TOKEN_FROM_BOTFATHER"
  PB_URL: "http://pocketbase_server:8090"
  PB_ADMIN: "admin@vault.local"
  PB_PASSWORD: "YourSecurePassword123"
  MASTER_PASSWORD: "YourVeryLongMasterPassword"
  ALLOWED_USERS: "123456789,987654321"
```

Save and restart:

```bash
cd ~/umbrel
docker-compose restart
```

## Getting Bot Token

1. Open Telegram
2. Search for @BotFather
3. Send `/newbot`
4. Follow instructions
5. Copy the token

## Getting Your Telegram ID

1. Open Telegram
2. Search for @userinfobot
3. Send `/start`
4. Copy your ID

## Usage

Send to your bot:
- `website.com login password` - Save password
- `website` - Search and retrieve password
- Click "Delete" button - Remove password

Messages auto-delete after 2 minutes.
