import { Bot, InlineKeyboard, InputFile } from "grammy";
import { Chess } from "chess.js";
import PocketBase from "pocketbase";
import dotenv from "dotenv";
import { createCanvas, Path2D } from "@napi-rs/canvas";

dotenv.config();

const REQUIRED_ENV = ['TG_TOKEN', 'PB_URL', 'PB_ADMIN', 'PB_PASSWORD'];

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${message}`);
  if (data) console.dir(data, { depth: null });
}

// ── Board PNG ─────────────────────────────────────────────────────────────────
// CBurnett piece paths (Lichess set) — each defined on a 45x45 grid
// Source: https://github.com/lichess-org/lila/tree/master/public/piece/cburnett
const PIECE_PATHS = {
  // Pawn
  P: `M 22.5,9 C 19.8,9 17.5,10.6 17.5,13.5 C 17.5,15.3 18.5,16.8 20,17.7
      C 16.5,19.2 14,22.3 14,26 C 14,27.9 14.6,29.7 15.7,31.1
      C 13.1,32.3 11,35 11,38 L 34,38 C 34,35 31.9,32.3 29.3,31.1
      C 30.4,29.7 31,27.9 31,26 C 31,22.3 28.5,19.2 25,17.7
      C 26.5,16.8 27.5,15.3 27.5,13.5 C 27.5,10.6 25.2,9 22.5,9 Z`,
  // Rook
  R: `M 9,39 L 36,39 L 36,36 L 9,36 Z
      M 12,36 L 12,32 L 33,32 L 33,36 Z
      M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 Z
      M 34,14 Q 36,14 36,16 L 36,32 L 9,32 L 9,16 Q 9,14 11,14 Z`,
  // Knight
  N: `M 22,10 C 18,10 13,14 13,20 C 13,23 14,25.5 16,27.5
      C 14,28.5 11,31 11,35 L 34,35 C 34,31 31,28.5 29,27.5
      C 31,25.5 32,23 32,20 C 32,14 27,10 22,10 Z
      M 18,24 C 17,22 17,19 19,17 C 21,15 24,15 26,17 C 28,19 28,22 27,24 Z`,
  // Bishop
  B: `M 22.5,9 C 20,9 18,11 18,13.5 C 18,15 18.7,16.3 19.8,17.2
      C 16,19 13,22.5 13,27 C 13,29 13.7,30.8 15,32.2
      C 12.5,33.5 11,36 11,39 L 34,39 C 34,36 32.5,33.5 30,32.2
      C 31.3,30.8 32,29 32,27 C 32,22.5 29,19 25.2,17.2
      C 26.3,16.3 27,15 27,13.5 C 27,11 25,9 22.5,9 Z
      M 22.5,12 C 23.6,12 24.5,12.9 24.5,14 C 24.5,15.1 23.6,16 22.5,16 C 21.4,16 20.5,15.1 20.5,14 C 20.5,12.9 21.4,12 22.5,12 Z`,
  // Queen
  Q: `M 9,26 C 9,28.8 10.5,31.3 13,32.5 L 13,36 L 32,36 L 32,32.5
      C 34.5,31.3 36,28.8 36,26 C 36,22 33.5,18.5 30,17
      C 30,14 28,11 25,10 C 25,8 23.8,7 22.5,7 C 21.2,7 20,8 20,10
      C 17,11 15,14 15,17 C 11.5,18.5 9,22 9,26 Z
      M 22.5,7 C 23.3,7 24,7.7 24,8.5 C 24,9.3 23.3,10 22.5,10 C 21.7,10 21,9.3 21,8.5 C 21,7.7 21.7,7 22.5,7 Z
      M 13,17 C 14.1,17 15,17.9 15,19 C 15,20.1 14.1,21 13,21 C 11.9,21 11,20.1 11,19 C 11,17.9 11.9,17 13,17 Z
      M 32,17 C 33.1,17 34,17.9 34,19 C 34,20.1 33.1,21 32,21 C 30.9,21 30,20.1 30,19 C 30,17.9 30.9,17 32,17 Z
      M 9,39 L 36,39 L 36,36 L 9,36 Z`,
  // King
  K: `M 22.5,11.63 L 22.5,6 M 20,8 L 25,8
      M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25 Z
      M 12,36 C 12,36 12,32 13,30 C 14,28 16,27 18,26.5 C 20,26 22.5,26 22.5,26 C 22.5,26 25,26 27,26.5 C 29,27 31,28 32,30 C 33,32 33,36 33,36 Z
      M 11,38 L 34,38 L 34,36 L 11,36 Z
      M 34,14 L 34,11 L 11,11 L 11,14 Z`,
};

const LIGHT = "#F0D9B5";
const DARK  = "#B58863";
const SQ    = 72;
const PAD   = 24;
const SIZE  = SQ * 8 + PAD * 2;

// Scale factor: piece paths are on 45x45, we need SQ x SQ
const SCALE = SQ / 45;

function drawPiece(ctx, piece, x, y) {
  const isWhite = piece === piece.toUpperCase();
  const key     = piece.toUpperCase();
  const pathStr = PIECE_PATHS[key];
  if (!pathStr) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(SCALE, SCALE);

  const path = new Path2D(pathStr);

  ctx.lineWidth = 1.5;
  ctx.fillStyle = isWhite ? "#fff" : "#333";
  ctx.fill(path);
  ctx.strokeStyle = "#000";
  ctx.stroke(path);

  ctx.restore();
}

async function renderBoard(fen, perspective = "white") {
  const canvas  = createCanvas(SIZE, SIZE);
  const ctx     = canvas.getContext("2d");
  const flipped = perspective === "black";

  // Background border
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Parse FEN
  const position = fen.split(" ")[0];
  const rows     = position.split("/");
  const board    = rows.map(row => {
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

  // Draw squares
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dispR = flipped ? 7 - r : r;
      const dispF = flipped ? 7 - f : f;
      const x = PAD + dispF * SQ;
      const y = PAD + dispR * SQ;
      ctx.fillStyle = (r + f) % 2 === 0 ? LIGHT : DARK;
      ctx.fillRect(x, y, SQ, SQ);
    }
  }

  // Draw pieces
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const dispR = flipped ? 7 - r : r;
      const dispF = flipped ? 7 - f : f;
      const x = PAD + dispF * SQ;
      const y = PAD + dispR * SQ;
      drawPiece(ctx, piece, x, y);
    }
  }

  // Coordinate labels
  ctx.fillStyle   = "#999";
  ctx.font        = "bold 11px sans-serif";
  ctx.textAlign   = "center";
  ctx.textBaseline = "middle";
  const files = flipped ? "hgfedcba" : "abcdefgh";
  for (let i = 0; i < 8; i++) {
    const label = flipped ? i + 1 : 8 - i;
    const yPos  = PAD + i * SQ + SQ / 2;
    ctx.fillText(String(label), PAD / 2, yPos);
    const xPos  = PAD + i * SQ + SQ / 2;
    ctx.fillText(files[i], xPos, SIZE - PAD / 2);
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
