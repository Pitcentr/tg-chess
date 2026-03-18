import { Bot, InlineKeyboard } from "grammy";
import { Chess } from "chess.js";
import PocketBase from "pocketbase";
import dotenv from "dotenv";

// ====================== КОНФИГУРАЦИЯ ======================
dotenv.config();

const REQUIRED_ENV = ['TG_TOKEN', 'PB_URL', 'PB_ADMIN', 'PB_PASSWORD'];

// ====================== УТИЛИТЫ ======================
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
  if (data) console.dir(data, { depth: null });
}

// ====================== ASCII ДОСКА ======================
const PIECES = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function renderBoard(fen, perspective = "white") {
  const chess = new Chess(fen);
  const board = chess.board();
  const isWhite = perspective === "white";
  const rows   = isWhite ? [...board].reverse() : board;
  const labels = isWhite ? FILES : [...FILES].reverse();

  let out = "```\n  " + labels.join(" ") + "\n";
  rows.forEach((row, i) => {
    const rank = isWhite ? 8 - i : i + 1;
    const cells = (isWhite ? row : [...row].reverse()).map((sq) => {
      if (!sq) return "·";
      return PIECES[sq.color === "w" ? sq.type.toUpperCase() : sq.type] || "·";
    });
    out += `${rank} ${cells.join(" ")} ${rank}\n`;
  });
  out += "  " + labels.join(" ") + "\n```";
  return out;
}

function gameStatusText(chess) {
  if (chess.isCheckmate()) return "♟ Шах и мат!";
  if (chess.isStalemate()) return "🤝 Пат — ничья!";
  if (chess.isDraw())      return "🤝 Ничья!";
  if (chess.isCheck())     return "⚠️ Шах!";
  return null;
}

// ====================== ГЛАВНАЯ ФУНКЦИЯ ======================
const bot = new Bot(process.env.TG_TOKEN || "");
const pb  = new PocketBase(process.env.PB_URL || "");

async function main() {
  // Проверка переменных окружения
  const missing = REQUIRED_ENV.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('⚠️ ОТСУТСТВУЮТ ОБЯЗАТЕЛЬНЫЕ ПЕРЕМЕННЫЕ:');
    console.error(missing.join(', '));
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    while (true) await new Promise(r => setTimeout(r, 60000));
  }

  log('INFO', 'Запуск Chess Bot');

  // Аутентификация в PocketBase (точно как в vault)
  try {
    await pb.collection("_superusers").authWithPassword(process.env.PB_ADMIN, process.env.PB_PASSWORD);
    log('INFO', 'Успешная аутентификация в PocketBase');
  } catch (err) {
    log('ERROR', 'Не удалось авторизоваться в PocketBase', err.message);
    process.exit(1);
  }

  // Создание коллекций если не существуют
  await ensureCollections();

  // Глобальный обработчик ошибок
  bot.catch((err) => {
    log('ERROR', 'Ошибка при обработке обновления', err.error);
    err.ctx.reply("❌ Произошла ошибка. Попробуйте ещё раз.").catch(() => {});
  });

  // Меню команд
  await bot.api.setMyCommands([
    { command: "start",   description: "Главное меню" },
    { command: "newgame", description: "Создать новую игру" },
    { command: "join",    description: "Присоединиться к игре" },
    { command: "move",    description: "Сделать ход (напр. e2e4)" },
    { command: "board",   description: "Показать текущую доску" },
    { command: "resign",  description: "Сдаться" },
    { command: "games",   description: "Список открытых игр" },
  ]);

  // ==================== ФУНКЦИИ РАБОТЫ С БД ====================
  async function getOrCreateUser(telegramId, username, firstName) {
    const id = String(telegramId);
    try {
      return await pb.collection("chess_users").getFirstListItem(
        `telegram_id="${id}"`, { requestKey: null }
      );
    } catch {
      return await pb.collection("chess_users").create({
        telegram_id: id,
        username:    username   || "",
        first_name:  firstName  || "",
      }, { requestKey: null });
    }
  }

  async function getActiveGame(userId) {
    try {
      return await pb.collection("chess_games").getFirstListItem(
        `(player_white="${userId}" || player_black="${userId}") && (status="active" || status="waiting")`,
        { requestKey: null }
      );
    } catch {
      return null;
    }
  }

  async function getGameById(gameId) {
    try {
      return await pb.collection("chess_games").getOne(gameId, { requestKey: null });
    } catch {
      return null;
    }
  }

  async function getPlayerName(userId) {
    try {
      const u = await pb.collection("chess_users").getFirstListItem(
        `telegram_id="${userId}"`, { requestKey: null }
      );
      return u.username ? `@${u.username}` : (u.first_name || `User ${userId}`);
    } catch {
      return `User ${userId}`;
    }
  }

  // ==================== КОМАНДЫ ====================
  bot.command("start", async (ctx) => {
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    await ctx.reply(
      `♟ <b>Chess Bot</b>\n\n` +
      `Играйте в шахматы прямо в Telegram!\n\n` +
      `<b>Команды:</b>\n` +
      `/newgame — создать новую игру\n` +
      `/join &lt;ID&gt; — присоединиться к игре\n` +
      `/move &lt;ход&gt; — сделать ход (напр. <code>e2e4</code>)\n` +
      `/board — показать текущую доску\n` +
      `/resign — сдаться\n` +
      `/games — список открытых игр`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("newgame", async (ctx) => {
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);

    const existing = await getActiveGame(String(ctx.from.id));
    if (existing) {
      return ctx.reply(
        `⚠️ У вас уже есть активная игра (ID: <code>${existing.id}</code>).\nСначала завершите её: /resign`,
        { parse_mode: "HTML" }
      );
    }

    const chess = new Chess();
    const game = await pb.collection("chess_games").create({
      player_white: String(ctx.from.id),
      player_black: "",
      status:       "waiting",
      fen:          chess.fen(),
      turn:         "white",
      winner:       "",
    }, { requestKey: null });

    const kb = new InlineKeyboard().text("✅ Присоединиться", `join_${game.id}`);
    await ctx.reply(
      `♟ <b>Новая игра создана!</b>\n\n` +
      `Вы играете белыми ⬜\n\n` +
      `ID игры: <code>${game.id}</code>\n\n` +
      `Отправьте другу: <code>/join ${game.id}</code>\n\n` +
      `Или пусть нажмёт кнопку ниже 👇`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.command("join", async (ctx) => {
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const gameId = ctx.match?.trim();

    if (!gameId) {
      const res = await pb.collection("chess_games").getList(1, 10, {
        filter: 'status="waiting"', requestKey: null,
      });
      if (res.items.length === 0) {
        return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
      }
      const kb = new InlineKeyboard();
      for (const g of res.items) {
        const name = await getPlayerName(g.player_white);
        kb.text(`⬜ ${name} ищет соперника`, `join_${g.id}`).row();
      }
      return ctx.reply("🎮 Открытые игры:", { reply_markup: kb });
    }

    await doJoinGame(ctx, gameId, String(ctx.from.id));
  });

  bot.command("move", async (ctx) => {
    const moveStr = ctx.match?.trim();
    if (!moveStr) return ctx.reply("❌ Укажите ход. Пример: /move e2e4");

    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);

    if (!game)                    return ctx.reply("❌ У вас нет активной игры. Создайте: /newgame");
    if (game.status !== "active") return ctx.reply("❌ Игра ещё не началась. Ждите соперника.");

    const isWhite = game.player_white === userId;
    const myColor = isWhite ? "white" : "black";
    if (game.turn !== myColor) return ctx.reply("⏳ Сейчас не ваш ход.");

    const chess      = new Chess(game.fen);
    const normalized = moveStr.replace("-", "");
    let result;
    try {
      result = chess.move({
        from:      normalized.slice(0, 2),
        to:        normalized.slice(2, 4),
        promotion: normalized[4] || "q",
      });
    } catch { result = null; }

    if (!result) {
      return ctx.reply(
        `❌ Недопустимый ход: <code>${moveStr}</code>\n\nПример: /move e2e4`,
        { parse_mode: "HTML" }
      );
    }

    const newFen    = chess.fen();
    const newTurn   = chess.turn() === "w" ? "white" : "black";
    const statusTxt = gameStatusText(chess);
    const isOver    = chess.isGameOver();
    const newStatus = isOver ? "finished" : "active";
    const winner    = isOver && chess.isCheckmate() ? userId : "";

    await pb.collection("chess_moves").create({
      game_id:   game.id,
      player_id: userId,
      move:      moveStr,
      fen_after: newFen,
    }, { requestKey: null });

    await pb.collection("chess_games").update(game.id, {
      fen: newFen, turn: newTurn, status: newStatus, winner,
    }, { requestKey: null });

    const whiteName   = await getPlayerName(game.player_white);
    const blackName   = await getPlayerName(game.player_black);
    const moverName   = isWhite ? whiteName : blackName;
    const opponentId  = isWhite ? game.player_black : game.player_white;
    const oppColor    = isWhite ? "black" : "white";
    const moveInfo    = `✅ Ход: <code>${moveStr}</code> (${moverName})`;

    await ctx.reply(
      `${moveInfo}\n\n` + renderBoard(newFen, myColor) + "\n\n" +
      (statusTxt ? statusTxt : "⏳ Ждём хода соперника..."),
      { parse_mode: "HTML" }
    );

    if (opponentId) {
      let msg = `${moveInfo}\n\n` + renderBoard(newFen, oppColor) + "\n\n";
      if (isOver) {
        msg += chess.isCheckmate() ? `♟ Шах и мат! Победили ${moverName}!` : `🤝 ${statusTxt}`;
      } else {
        msg += chess.isCheck() ? "⚠️ Шах! Ваш ход." : "🎯 Ваш ход!";
      }
      try { await bot.api.sendMessage(opponentId, msg, { parse_mode: "HTML" }); } catch {}
    }

    if (isOver) {
      const endMsg = chess.isCheckmate()
        ? `🏆 Победитель: ${moverName}!`
        : `🤝 ${statusTxt}`;
      await ctx.reply(endMsg);
    }
  });

  bot.command("board", async (ctx) => {
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game) return ctx.reply("❌ У вас нет активной игры.");

    const chess     = new Chess(game.fen);
    const isWhite   = game.player_white === userId;
    const whiteName = await getPlayerName(game.player_white);
    const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
    const turnName  = game.turn === "white" ? whiteName : blackName;
    const statusTxt = gameStatusText(chess);

    await ctx.reply(
      `♟ <b>Текущая позиция</b>\n\n` +
      `⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
      renderBoard(game.fen, isWhite ? "white" : "black") + "\n\n" +
      (statusTxt ? statusTxt : `🎯 Ход: ${turnName} (${game.turn === "white" ? "⬜" : "⬛"})`),
      { parse_mode: "HTML" }
    );
  });

  bot.command("resign", async (ctx) => {
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game) return ctx.reply("❌ У вас нет активной игры.");

    const isWhite    = game.player_white === userId;
    const opponentId = isWhite ? game.player_black : game.player_white;

    await pb.collection("chess_games").update(game.id, {
      status: "finished",
      winner: opponentId || "",
    }, { requestKey: null });

    const myName = await getPlayerName(userId);
    await ctx.reply(`🏳 ${myName} сдался. Игра завершена.`);

    if (opponentId) {
      const oppName = await getPlayerName(opponentId);
      try {
        await bot.api.sendMessage(opponentId, `🏆 ${myName} сдался! Вы победили, ${oppName}!`);
      } catch {}
    }
  });

  bot.command("games", async (ctx) => {
    const res = await pb.collection("chess_games").getList(1, 10, {
      filter: 'status="waiting"', requestKey: null,
    });
    if (res.items.length === 0) {
      return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
    }
    const kb = new InlineKeyboard();
    for (const g of res.items) {
      const name = await getPlayerName(g.player_white);
      kb.text(`⬜ ${name} ищет соперника`, `join_${g.id}`).row();
    }
    await ctx.reply(`🎮 Открытые игры (${res.items.length}):`, { reply_markup: kb });
  });

  // ==================== CALLBACK QUERIES ====================
  bot.callbackQuery(/^join_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    await doJoinGame(ctx, ctx.match[1], String(ctx.from.id));
  });

  bot.callbackQuery(/^board_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const game = await getGameById(ctx.match[1]);
    if (!game) return ctx.reply("❌ Игра не найдена.");

    const userId    = String(ctx.from.id);
    const isWhite   = game.player_white === userId;
    const chess     = new Chess(game.fen);
    const whiteName = await getPlayerName(game.player_white);
    const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
    const turnName  = game.turn === "white" ? whiteName : blackName;
    const statusTxt = gameStatusText(chess);

    await ctx.reply(
      `♟ <b>Доска</b>\n\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
      renderBoard(game.fen, isWhite ? "white" : "black") + "\n\n" +
      (statusTxt ? statusTxt : `🎯 Ход: ${turnName}`),
      { parse_mode: "HTML" }
    );
  });

  // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================
  async function doJoinGame(ctx, gameId, userId) {
    const game = await getGameById(gameId);
    if (!game)                        return ctx.reply("❌ Игра не найдена.");
    if (game.status !== "waiting")    return ctx.reply("❌ Игра уже началась или завершена.");
    if (game.player_white === userId) return ctx.reply("❌ Нельзя играть с собой.");

    await pb.collection("chess_games").update(gameId, {
      player_black: userId,
      status: "active",
    }, { requestKey: null });

    const updated   = await getGameById(gameId);
    const whiteName = await getPlayerName(updated.player_white);
    const blackName = await getPlayerName(updated.player_black);

    try {
      await bot.api.sendMessage(
        updated.player_white,
        `🎉 <b>${blackName}</b> присоединился!\n\nВы ходите первыми ⬜\n\n` +
        renderBoard(updated.fen, "white"),
        { parse_mode: "HTML" }
      );
    } catch {}

    await ctx.reply(
      `♟ <b>Игра началась!</b>\n\n` +
      `⬜ Белые: ${whiteName}\n⬛ Чёрные: ${blackName}\n\n` +
      renderBoard(updated.fen, "black") + "\n\nЖдите хода белых...",
      { parse_mode: "HTML" }
    );
  }

  // ==================== ЗАПУСК ====================
  await bot.start();
  log('SUCCESS', 'Chess Bot успешно запущен!');
}

// ==================== СОЗДАНИЕ КОЛЛЕКЦИЙ ====================
async function ensureCollections() {
  const collections = [
    {
      name: "chess_users",
      type: "base",
      fields: [
        { name: "telegram_id", type: "text", required: true },
        { name: "username",    type: "text", required: false },
        { name: "first_name",  type: "text", required: false },
      ],
    },
    {
      name: "chess_games",
      type: "base",
      fields: [
        { name: "player_white", type: "text", required: true },
        { name: "player_black", type: "text", required: false },
        { name: "status",       type: "text", required: true },
        { name: "fen",          type: "text", required: true },
        { name: "turn",         type: "text", required: true },
        { name: "winner",       type: "text", required: false },
      ],
    },
    {
      name: "chess_moves",
      type: "base",
      fields: [
        { name: "game_id",   type: "text", required: true },
        { name: "player_id", type: "text", required: true },
        { name: "move",      type: "text", required: true },
        { name: "fen_after", type: "text", required: true },
      ],
    },
  ];

  for (const col of collections) {
    try {
      await pb.collections.getOne(col.name);
      log('INFO', `Коллекция '${col.name}' уже существует`);
    } catch (err) {
      if (err?.status === 404) {
        try {
          await pb.collections.create(col);
          log('INFO', `Создана коллекция '${col.name}'`);
        } catch (e) {
          log('ERROR', `Не удалось создать '${col.name}'`, e.message);
        }
      }
    }
  }
}

// ====================== ЗАПУСК ======================
main().catch(err => {
  log('CRITICAL', 'Критическая ошибка', err);
  process.exit(1);
});

process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
