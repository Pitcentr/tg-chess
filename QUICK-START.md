# Quick Start

## 1. Проверь сборку Docker образа

Открой: https://github.com/Pitcentr/telegram-vault-store/actions

Дождись зеленой галочки ✓ (примерно 5-10 минут)

## 2. Установи в Umbrel

```
Umbrel → App Store → Add Community App Store
URL: https://github.com/Pitcentr/telegram-vault-store
```

Найди "Telegram Vault" и нажми Install

## 3. Настрой через SSH

```bash
ssh umbrel@umbrel.local
cd ~/umbrel/app-data/vault-telegram-vault
nano docker-compose.yml
```

Заполни в секции environment:
```yaml
environment:
  TG_TOKEN: "твой_токен_от_BotFather"
  PB_URL: "http://pocketbase_server:8090"
  PB_ADMIN: "admin@vault.local"
  PB_PASSWORD: "твой_пароль"
  MASTER_PASSWORD: "длинный_мастер_пароль_32_символа"
  ALLOWED_USERS: "твой_telegram_id"
```

Сохрани (Ctrl+O, Enter, Ctrl+X)

## 4. Перезапусти

```bash
cd ~/umbrel
docker-compose restart
```

## 5. Проверь логи

```bash
docker-compose logs -f vault-telegram-vault_app_1
```

Должно быть:
```
Starting Telegram Vault bot...
Bot started successfully!
Waiting for messages...
```

## 6. Тестируй бота

Telegram → твой бот → отправь:
```
test.com mylogin mypassword
```

Бот ответит "saved"

Отправь:
```
test
```

Бот вернет пароль

## Готово! 🎉

---

## Получить токен бота

1. Telegram → @BotFather
2. `/newbot`
3. Следуй инструкциям
4. Скопируй токен

## Получить свой ID

1. Telegram → @userinfobot
2. `/start`
3. Скопируй ID

---

Подробнее: [INSTALLATION-GUIDE.md](INSTALLATION-GUIDE.md)
Проблемы: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
