import { Bot, InlineKeyboard, InputFile } from "grammy";
import { Chess } from "chess.js";
import PocketBase from "pocketbase";
import dotenv from "dotenv";
import { createCanvas } from "@napi-rs/canvas";

dotenv.config();

const REQUIRED_ENV = ['TG_TOKEN', 'PB_URL', 'PB_ADMIN', 'PB_PASSWORD'];

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${message}`);
  if (data) console.dir(data, { depth: null });
}

// ── Board PNG ─────────────────────────────────────────────────────────────────
const PIECES = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};
const LIGHT = "#F0D9B5";
const DARK  = "#B58863";
const SQ    = 72;
const PAD   = 28;
const SIZE  = SQ * 8 + PAD * 2;

async function renderBoard(fen, perspective = "white") {
  const canvas  = createCanvas(SIZE, SIZE);
  const ctx     = canvas.getContext("2d");
  const flipped = perspective === "black";

  // Background
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Parse FEN position
  const position = fen.split(" ")[0];
  const rows = position.split("/");
  const board = rows.map(row => {
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });

  // Draw squares and pieces
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dispR = flipped ? 7 - r : r;
      const dispF = flipped ? 7 - f : f;
      const x = PAD + dispF * SQ;
      const y = PAD + dispR * SQ;

      ctx.fillStyle = (r + f) % 2 === 0 ? LIGHT : DARK;
      ctx.fillRect(x, y, SQ, SQ);

      const piece = board[r][f];
      if (piece) {
        const isWhitePiece = piece === piece.toUpperCase();
        ctx.font = `${SQ * 0.78}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Drop shadow for contrast
        ctx.fillStyle = isWhitePiece ? "#555" : "#000";
        ctx.fillText(PIECES[piece], x + SQ / 2 + 1, y + SQ / 2 + 2);
        ctx.fillStyle = isWhitePiece ? "#fff" : "#111";
        ctx.fillText(PIECES[piece], x + SQ / 2, y + SQ / 2);
      }
    }
  }

  // Rank labels (1-8)
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = 0; r < 8; r++) {
    const label = flipped ? r + 1 : 8 - r;
    const y = PAD + r * SQ + SQ / 2;
    ctx.fillStyle = "#ccc";
    ctx.fillText(String(label), PAD / 2, y);
    ctx.fillText(String(label), SIZE - PAD / 2, y);
  }

  // File labels (a-h)
  const files = flipped ? "hgfedcba" : "abcdefgh";
  for (let f = 0; f < 8; f++) {
    const x = PAD + f * SQ + SQ / 2;
    ctx.fillStyle = "#ccc";
    ctx.fillText(files[f], x, PAD / 2);
    ctx.fillText(files[f], x, SIZE - PAD / 2);
  }

  return canvas.toBuffer("image/png");
}

// chess.js v0.13 API
function gameStatusText(chess) {
  if (chess.in_checkmate()) return "♟ Шах и мат!";
  if (chess.in_stalemate()) return "🤝 Пат — ничья!";
  if (chess.in_draw())      return "🤝 Ничья!";
  if (chess.in_check())     return "⚠️ Шах!";
  return null;
}

function looksLikeMove(text) {
  const t = text.trim().toLowerCase();
  if (t === "o-o-o" || t === "0-0-0") return true;
  if (t === "o-o"   || t === "0-0")   return true;
  if (/^[a-h]\d-?[a-h]\d[qrbn]?$/.test(t)) return true;
  if (/^[NBRQK][a-h]?[1-8]?x?[a-h][1-8][+#]?$/.test(text.trim())) return true;
  if (/^[a-h]x?[a-h]?[1-8][+#]?$/.test(t)) return true;
  return false;
}

// ── Init ─────────────────────────────────────────────────────────────────────
const bot = new Bot(process.env.TG_TOKEN || "");
const pb  = new PocketBase(process.env.PB_URL || "");

async function main() {
  const missing = REQUIRED_ENV.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('⚠️ ОТСУТСТВУЮТ ПЕРЕМЕННЫЕ:', missing.join(', '));
    while (true) await new Promise(r => setTimeout(r, 60000));
  }

  log('INFO', 'Запуск Chess Bot');

  try {
    await pb.collection("_superusers").authWithPassword(process.env.PB_ADMIN, process.env.PB_PASSWORD);
    log('INFO', 'Успешная аутентификация в PocketBase');
  } catch (err) {
    log('ERROR', 'Не удалось авторизоваться в PocketBase', err.message);
    process.exit(1);
  }

  await ensureCollections();

  // ── DB helpers ──────────────────────────────────────────────────────────────
  async function getOrCreateUser(telegramId, username, firstName) {
    const id = String(telegramId);
    try {
      return await pb.collection("chess_users").getFirstListItem(`telegram_id="${id}"`, { requestKey: null });
    } catch {
      return await pb.collection("chess_users").create(
        { telegram_id: id, username: username || "", first_name: firstName || "" },
        { requestKey: null }
      );
    }
  }

  async function getActiveGame(userId) {
    try {
      return await pb.collection("chess_games").getFirstListItem(
        `(player_white="${userId}" || player_black="${userId}") && (status="active" || status="waiting")`,
        { requestKey: null }
      );
    } catch { return null; }
  }

  async function getGameById(id) {
    try { return await pb.collection("chess_games").getOne(id, { requestKey: null }); }
    catch { return null; }
  }

  async function getPlayerName(userId) {
    try {
      const u = await pb.collection("chess_users").getFirstListItem(`telegram_id="${userId}"`, { requestKey: null });
      return u.username ? `@${u.username}` : (u.first_name || `User ${userId}`);
    } catch { return `User ${userId}`; }
  }

  // ── Move logic ──────────────────────────────────────────────────────────────
  async function processMove(ctx, userId, moveStr) {
    log('INFO', `MOVE from ${userId}: ${moveStr}`);
    const game = await getActiveGame(userId);
    if (!game)                    return ctx.reply("❌ У вас нет активной игры. Создайте: /newgame");
    if (game.status !== "active") return ctx.reply("❌ Игра ещё не началась. Ждите соперника.");

    const isWhite = game.player_white === userId;
    const myColor = isWhite ? "white" : "black";
    if (game.turn !== myColor) return ctx.reply("⏳ Сейчас не ваш ход.");

    const chess      = new Chess(game.fen);
    const normalized = moveStr.replace(/-/g, "").toLowerCase();
    let result = null;
    try {
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) {
        result = chess.move({ from: normalized.slice(0,2), to: normalized.slice(2,4), promotion: normalized[4] || "q" });
      } else {
        result = chess.move(moveStr.trim());
      }
    } catch { result = null; }

    if (!result) {
      return ctx.reply(`❌ Недопустимый ход: <code>${moveStr}</code>\n\nПример: <code>e2e4</code>`, { parse_mode: "HTML" });
    }

    const newFen    = chess.fen();
    const newTurn   = chess.turn() === "w" ? "white" : "black";
    const statusTxt = gameStatusText(chess);
    const isOver    = chess.game_over();
    const newStatus = isOver ? "finished" : "active";
    const winner    = isOver && chess.in_checkmate() ? userId : "";

    await pb.collection("chess_moves").create(
      { game_id: game.id, player_id: userId, move: moveStr, fen_after: newFen },
      { requestKey: null }
    );
    await pb.collection("chess_games").update(game.id,
      { fen: newFen, turn: newTurn, status: newStatus, winner },
      { requestKey: null }
    );

    const whiteName  = await getPlayerName(game.player_white);
    const blackName  = await getPlayerName(game.player_black);
    const moverName  = isWhite ? whiteName : blackName;
    const opponentId = isWhite ? game.player_black : game.player_white;
    const oppColor   = isWhite ? "black" : "white";
    const moveInfo   = `✅ Ход: <code>${result.san}</code> (${moverName})`;
    const myCaption  = moveInfo + (statusTxt ? `\n\n${statusTxt}` : "\n\n⏳ Ждём хода соперника...");

    const myBoard = await renderBoard(newFen, myColor);
    await ctx.replyWithPhoto(new InputFile(myBoard, "board.png"), {
      caption: myCaption,
      parse_mode: "HTML",
    });

    if (opponentId) {
      const oppStatus = isOver
        ? (chess.in_checkmate() ? `\n\n♟ Шах и мат! Победили ${moverName}!` : `\n\n🤝 ${statusTxt}`)
        : (chess.in_check() ? "\n\n⚠️ Шах! Ваш ход." : "\n\n🎯 Ваш ход!");
      try {
        const oppBoard = await renderBoard(newFen, oppColor);
        await bot.api.sendPhoto(opponentId, new InputFile(oppBoard, "board.png"), {
          caption: moveInfo + oppStatus,
          parse_mode: "HTML",
        });
      } catch {}
    }

    if (isOver) {
      const endMsg = chess.in_checkmate() ? `🏆 Победитель: ${moverName}!` : `🤝 ${statusTxt}`;
      await ctx.reply(endMsg);
      if (opponentId) try { await bot.api.sendMessage(opponentId, endMsg); } catch {}
    }
  }

  // ── Join helper ─────────────────────────────────────────────────────────────
  async function doJoinGame(ctx, gameId, userId) {
    const game = await getGameById(gameId);
    if (!game)                        return ctx.reply("❌ Игра не найдена.");
    if (game.status !== "waiting")    return ctx.reply("❌ Игра уже началась или завершена.");
    if (game.player_white === userId) return ctx.reply("❌ Нельзя играть с собой.");

    await pb.collection("chess_games").update(gameId, { player_black: userId, status: "active" }, { requestKey: null });

    const updated   = await getGameById(gameId);
    const whiteName = await getPlayerName(updated.player_white);
    const blackName = await getPlayerName(updated.player_black);

    try {
      const whiteBoard = await renderBoard(updated.fen, "white");
      await bot.api.sendPhoto(updated.player_white, new InputFile(whiteBoard, "board.png"), {
        caption: `🎉 <b>${blackName}</b> присоединился!\n\nВы ходите первыми ⬜\n\n🎯 Ваш ход!`,
        parse_mode: "HTML",
      });
    } catch {}

    const blackBoard = await renderBoard(updated.fen, "black");
    await ctx.replyWithPhoto(new InputFile(blackBoard, "board.png"), {
      caption: `♟ <b>Игра началась!</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n⏳ Ждите хода белых...\n💡 Пишите ход прямо в чат: <code>e7e5</code>`,
      parse_mode: "HTML",
    });
  }

  // ── Commands ────────────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    log('INFO', `CMD /start from ${ctx.from.id}`);
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    await ctx.reply(
      `♟ <b>Chess Bot</b>\n\n` +
      `Играйте в шахматы прямо в Telegram!\n\n` +
      `<b>Команды:</b>\n` +
      `/newgame — создать новую игру\n` +
      `/join &lt;ID&gt; — присоединиться к игре\n` +
      `/move e2e4 — сделать ход\n` +
      `/board — показать текущую доску\n` +
      `/resign — сдаться\n` +
      `/games — список открытых игр\n\n` +
      `💡 Во время игры пишите ход прямо в чат: <code>e2e4</code>\n` +
      `💬 Любой другой текст пересылается сопернику`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("newgame", async (ctx) => {
    log('INFO', `CMD /newgame from ${ctx.from.id}`);
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const existing = await getActiveGame(String(ctx.from.id));
    if (existing) {
      return ctx.reply(`⚠️ У вас уже есть активная игра (ID: <code>${existing.id}</code>).\nСначала завершите её: /resign`, { parse_mode: "HTML" });
    }
    const chess = new Chess();
    const game  = await pb.collection("chess_games").create(
      { player_white: String(ctx.from.id), player_black: "", status: "waiting", fen: chess.fen(), turn: "white", winner: "" },
      { requestKey: null }
    );
    const kb = new InlineKeyboard().text("✅ Присоединиться", `join_${game.id}`);
    await ctx.reply(
      `♟ <b>Новая игра создана!</b>\n\nВы играете белыми ⬜\n\n` +
      `ID игры: <code>${game.id}</code>\n\n` +
      `Отправьте другу: <code>/join ${game.id}</code>\n\nИли пусть нажмёт кнопку 👇`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.command("join", async (ctx) => {
    log('INFO', `CMD /join from ${ctx.from.id}`);
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const gameId = ctx.match?.trim();
    if (!gameId) {
      const res = await pb.collection("chess_games").getList(1, 10, { filter: 'status="waiting"', requestKey: null });
      if (res.items.length === 0) return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
      const kb = new InlineKeyboard();
      for (const g of res.items) {
        kb.text(`⬜ ${await getPlayerName(g.player_white)} ищет соперника`, `join_${g.id}`).row();
      }
      return ctx.reply("🎮 Открытые игры:", { reply_markup: kb });
    }
    await doJoinGame(ctx, gameId, String(ctx.from.id));
  });

  bot.command("move", async (ctx) => {
    const moveStr = ctx.match?.trim();
    if (!moveStr) return ctx.reply("❌ Укажите ход. Пример: /move e2e4");
    await processMove(ctx, String(ctx.from.id), moveStr);
  });

  bot.command("board", async (ctx) => {
    log('INFO', `CMD /board from ${ctx.from.id}`);
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game) return ctx.reply("❌ У вас нет активной игры.");
    const chess     = new Chess(game.fen);
    const isWhite   = game.player_white === userId;
    const whiteName = await getPlayerName(game.player_white);
    const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
    const turnName  = game.turn === "white" ? whiteName : blackName;
    const statusTxt = gameStatusText(chess);
    const caption   =
      `♟ <b>Текущая позиция</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
      (statusTxt ? statusTxt : `🎯 Ход: ${turnName} (${game.turn === "white" ? "⬜" : "⬛"})`);
    const board = await renderBoard(game.fen, isWhite ? "white" : "black");
    await ctx.replyWithPhoto(new InputFile(board, "board.png"), { caption, parse_mode: "HTML" });
  });

  bot.command("resign", async (ctx) => {
    log('INFO', `CMD /resign from ${ctx.from.id}`);
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game) return ctx.reply("❌ У вас нет активной игры.");
    const isWhite    = game.player_white === userId;
    const opponentId = isWhite ? game.player_black : game.player_white;
    await pb.collection("chess_games").update(game.id, { status: "finished", winner: opponentId || "" }, { requestKey: null });
    const myName = await getPlayerName(userId);
    await ctx.reply(`🏳 ${myName} сдался. Игра завершена.`);
    if (opponentId) {
      const oppName = await getPlayerName(opponentId);
      try { await bot.api.sendMessage(opponentId, `🏆 ${myName} сдался! Вы победили, ${oppName}!`); } catch {}
    }
  });

  bot.command("games", async (ctx) => {
    const res = await pb.collection("chess_games").getList(1, 10, { filter: 'status="waiting"', requestKey: null });
    if (res.items.length === 0) return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
    const kb = new InlineKeyboard();
    for (const g of res.items) {
      kb.text(`⬜ ${await getPlayerName(g.player_white)} ищет соперника`, `join_${g.id}`).row();
    }
    await ctx.reply(`🎮 Открытые игры (${res.items.length}):`, { reply_markup: kb });
  });

  // ── Callbacks ───────────────────────────────────────────────────────────────
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
    const statusTxt = gameStatusText(chess);
    const turnName  = game.turn === "white" ? whiteName : blackName;
    const caption   =
      `♟ <b>Доска</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
      (statusTxt ? statusTxt : `🎯 Ход: ${turnName}`);
    const board = await renderBoard(game.fen, isWhite ? "white" : "black");
    await ctx.replyWithPhoto(new InputFile(board, "board.png"), { caption, parse_mode: "HTML" });
  });

  // ── Text messages ───────────────────────────────────────────────────────────
  bot.on("message:text", async (ctx) => {
    const text   = ctx.message.text.trim();
    const userId = String(ctx.from.id);
    log('INFO', `MSG from ${userId}: "${text.slice(0, 40)}"`);

    if (text.startsWith("/")) return;

    const game = await getActiveGame(userId);
    if (!game || game.status !== "active") return;

    const isWhite    = game.player_white === userId;
    const opponentId = isWhite ? game.player_black : game.player_white;

    if (looksLikeMove(text)) {
      return processMove(ctx, userId, text);
    }

    if (opponentId) {
      const myName = await getPlayerName(userId);
      try {
        await bot.api.sendMessage(opponentId, `💬 <b>${myName}:</b> ${text}`, { parse_mode: "HTML" });
        await ctx.reply("✉️ Отправлено сопернику");
      } catch {
        await ctx.reply("❌ Не удалось отправить сообщение сопернику.");
      }
    }
  });

  // ── Error handler ───────────────────────────────────────────────────────────
  bot.catch((err) => {
    log('ERROR', `Handler error: ${err.message}`, String(err.error));
    try { err.ctx.reply("❌ Внутренняя ошибка.").catch(() => {}); } catch {}
  });

  // ── Start polling ───────────────────────────────────────────────────────────
  log('INFO', 'Устанавливаем команды бота...');
  try {
    await bot.api.setMyCommands([
      { command: "start",   description: "Главное меню" },
      { command: "newgame", description: "Создать новую игру" },
      { command: "join",    description: "Присоединиться к игре" },
      { command: "move",    description: "Сделать ход (напр. e2e4)" },
      { command: "board",   description: "Показать текущую доску" },
      { command: "resign",  description: "Сдаться" },
      { command: "games",   description: "Список открытых игр" },
    ]);
    log('INFO', 'Команды установлены');
  } catch (err) {
    log('ERROR', 'Ошибка setMyCommands', err.message);
  }

  log('INFO', 'Удаляем вебхук...');
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    log('INFO', 'Вебхук удалён');
  } catch (err) {
    log('WARN', 'deleteWebhook error', err.message);
  }

  log('INFO', 'Запускаем polling...');
  await bot.start();
}

// ── Collections ──────────────────────────────────────────────────────────────
async function ensureCollections() {
  const cols = [
    { name: "chess_users", type: "base", fields: [
      { name: "telegram_id", type: "text", required: true },
      { name: "username",    type: "text", required: false },
      { name: "first_name",  type: "text", required: false },
    ]},
    { name: "chess_games", type: "base", fields: [
      { name: "player_white", type: "text", required: true },
      { name: "player_black", type: "text", required: false },
      { name: "status",       type: "text", required: true },
      { name: "fen",          type: "text", required: true },
      { name: "turn",         type: "text", required: true },
      { name: "winner",       type: "text", required: false },
    ]},
    { name: "chess_moves", type: "base", fields: [
      { name: "game_id",   type: "text", required: true },
      { name: "player_id", type: "text", required: true },
      { name: "move",      type: "text", required: true },
      { name: "fen_after", type: "text", required: true },
    ]},
  ];

  for (const col of cols) {
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

main().catch(err => {
  log('CRITICAL', 'Критическая ошибка', err);
  process.exit(1);
});

process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
