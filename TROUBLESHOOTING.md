# Troubleshooting Guide

## Installation stuck at 1%

### Check if Docker image exists
```bash
# On your Umbrel
ssh umbrel@umbrel.local
docker pull pitcentr/telegram-vault:latest
```

If this fails, the image is not available yet. Wait for GitHub Actions to finish building.

### Check GitHub Actions build status
Visit: https://github.com/Pitcentr/telegram-vault-store/actions

Look for "Build and Push Docker Image" workflow. It should be green (✓).

### Check Umbrel logs
```bash
ssh umbrel@umbrel.local

# Umbrel manager logs
sudo journalctl -u umbrel-manager -f

# Docker logs
cd ~/umbrel
docker-compose logs -f | grep vault

# Check if container exists
docker ps -a | grep vault
```

### Manual installation test
```bash
ssh umbrel@umbrel.local
cd ~/umbrel/app-data/vault-telegram-vault

# Try to start manually
docker-compose up -d

# Check logs
docker-compose logs -f
```

## Container starts but shows "Waiting for configuration"

This is normal! You need to configure the .env file:

```bash
ssh umbrel@umbrel.local
cd ~/umbrel/app-data/vault-telegram-vault
nano .env
```

Fill in your values and restart:
```bash
cd ~/umbrel
docker-compose restart
```

## Common errors

### "Empty token!" error
- You didn't fill TG_TOKEN in .env file
- Edit .env and add your bot token from @BotFather

### "Failed to authenticate with PocketBase"
- PocketBase is not running or URL is wrong
- Check PB_URL in .env (default: http://pocketbase_server:8090)
- Make sure PocketBase app is installed and running

### "Unauthorized access attempt"
- Your Telegram ID is not in ALLOWED_USERS
- Get your ID from @userinfobot
- Add it to ALLOWED_USERS in .env (comma-separated for multiple users)

## Still having issues?

1. Check GitHub Actions: https://github.com/Pitcentr/telegram-vault-store/actions
2. Verify Docker image exists: https://hub.docker.com/r/pitcentr/telegram-vault
3. Open an issue: https://github.com/pitcentr/telegram-vault/issues
