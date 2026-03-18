# Installation Guide for Umbrel

## Step 1: Wait for Docker Build

GitHub Actions is building the Docker image. Check status:
https://github.com/Pitcentr/telegram-vault-store/actions

Wait until the workflow "Build and Push Docker Image" shows ✓ (green checkmark).

## Step 2: Install App in Umbrel

1. Open Umbrel dashboard
2. Go to App Store
3. Add Community App Store (if not added):
   - Click "Add App Store"
   - Enter: `https://github.com/Pitcentr/telegram-vault-store`
4. Find "Telegram Vault" in the store
5. Click "Install"
6. Wait for installation to complete (should reach 100%)

## Step 3: Configure the App

After installation, the app will show "Waiting for configuration" in logs. This is normal!

### SSH into Umbrel:
```bash
ssh umbrel@umbrel.local
```

### Navigate to app directory:
```bash
cd ~/umbrel/app-data/vault-telegram-vault
```

### Edit docker-compose.yml:
```bash
nano docker-compose.yml
```

### Fill in your values in the environment section:
```yaml
environment:
  TG_TOKEN: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"  # From @BotFather
  PB_URL: "http://pocketbase_app_1:8090"  # Your existing PocketBase
  PB_ADMIN: "admin@vault.local"
  PB_PASSWORD: "SecurePassword123"
  MASTER_PASSWORD: "MyVeryLongAndSecureMasterPasswordForEncryption123456"
  ALLOWED_USERS: "123456789"  # From @userinfobot
```

### Save and exit:
- Press `Ctrl+O` to save
- Press `Enter` to confirm
- Press `Ctrl+X` to exit

### Restart the app:
```bash
cd ~/umbrel
docker-compose restart
```

### Check logs:
```bash
docker-compose logs -f vault-telegram-vault_app_1
```

You should see:
```
Starting Telegram Vault bot...
Successfully authenticated with PocketBase
Bot started successfully!
Waiting for messages...
```

## Step 4: Test the Bot

1. Open Telegram
2. Find your bot (search by username you gave to @BotFather)
3. Send a test message: `test.com mylogin mypassword`
4. Bot should reply "saved"
5. Send: `test`
6. Bot should return your password

## Troubleshooting

If installation fails, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Getting Bot Token

1. Open Telegram
2. Search for @BotFather
3. Send `/newbot`
4. Choose a name (e.g., "My Vault Bot")
5. Choose a username (e.g., "my_vault_bot")
6. Copy the token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Getting Your Telegram ID

1. Open Telegram
2. Search for @userinfobot
3. Send `/start`
4. Copy your ID (a number like: `123456789`)

## Security Notes

- Master password encrypts all data with AES-256-GCM
- If you lose master password, data cannot be recovered
- Only specified Telegram user IDs can access the bot
- Use strong, unique master password (32+ characters)
- Messages auto-delete after 2 minutes
- .env file contains sensitive data - keep it secure
