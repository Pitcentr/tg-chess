# Chess Telegram Bot for Umbrel

Play chess with friends via Telegram, fully self-hosted on Umbrel with PocketBase storage.

## Setup

1. Install the app in Umbrel
2. Set environment variables in `docker-compose.yml` or via Umbrel UI:
   - `TELEGRAM_BOT_TOKEN` — get from [@BotFather](https://t.me/BotFather)
   - `POCKETBASE_ADMIN_EMAIL` — admin email for PocketBase (default: admin@chess.local)
   - `POCKETBASE_ADMIN_PASSWORD` — admin password (default: changeme123, **change this!**)

3. Start the app — PocketBase collections are created automatically on first run.

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Register and show help |
| `/newgame` | Create a new game (you play white) |
| `/join <ID>` | Join a game by ID |
| `/join` | Show list of open games |
| `/move e2e4` | Make a move |
| `/board` | Show current board |
| `/resign` | Resign the game |
| `/games` | List open games |

## PocketBase Admin

Access PocketBase admin UI at `http://<umbrel-ip>:8090/_/`

## Collections

- `users` — telegram_id, username, first_name
- `games` — player_white, player_black, status, fen, turn, winner
- `moves` — game_id, player_id, move, fen_after
