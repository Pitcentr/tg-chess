import { Bot, InlineKeyboard } from "grammy";
import { Chess } from "chess.js";
import PocketBase from "pocketbase";
import dotenv from "dotenv";
import { setupPocketBase } from "./setup.js";

dotenv.config();

// ── Config ──────────────────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PB_URL = process.env.POCKETBASE_URL || "http://pocketbase:8090";
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@chess.local";
const PB_PASS = process.env.POCKETBASE_ADMIN_PASSWORD || "changeme123";

if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const bot = new Bot(TOKEN);
const pb = new PocketBase(PB_URL);

// ── ASCII Board ──────────────────────────────────────────────────────────────
function renderBoard(fen, perspective = "white") {
  const chess = new Chess(fen);
  const board = chess.board();

  const pieces = {
    p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
  };

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  let rows = perspective === "white" ? [...board].reverse() : board;
  let fileLabels = perspective === "white" ? files : [...files].reverse();

  let out = "```\n";
  out += "  " + fileLabels.join(" ") + "\n";

  rows.forEach((row, i) => {
    const rankNum = perspective === "white" ? 8 - i : i + 1;
    const displayRow = perspective === "white" ? row : [...row].reverse();
    const cells = displayRow.map((sq) => {
      if (!sq) return "·";
      return pieces[sq.color === "w" ? sq.type.toUpperCase() : sq.type] || "·";
    });
    out += `${rankNum} ${cells.join(" ")} ${rankNum}\n`;
  });

  out += "  " + fileLabels.join(" ") + "\n";
  out += "```";
  return out;
}

// ── Game status text ─────────────────────────────────────────────────────────
function gameStatusText(chess) {
  if (chess.isCheckmate()) return "♟ Шах и мат!";
  if (chess.isStalemate()) return "🤝 Пат — ничья!";
  if (chess.isDraw()) return "🤝 Ничья!";
  if (chess.isCheck()) return "⚠️ Шах!";
  return null;
}

// ── DB helpers ───────────────────────────────────────────────────────────────
async function getOrCreateUser(telegramId, username, firstName) {
  try {
    const res = await pb.collection("users").getFirstListItem(
      `telegram_id="${telegramId}"`, { requestKey: null }
    );
    return res;
  } catch {
    return await pb.collection("users").create({
      telegram_id: String(telegramId),
      username: username || "",
      first_name: firstName || "",
    }, { requestKey: null });
  }
}

async function getActiveGame(userId) {
  try {
    return await pb.collection("games").getFirstListItem(
      `(player_white="${userId}" || player_black="${userId}") && (status="active" || status="waiting")`,
      { requestKey: null }
    );
  } catch {
    return null;
  }
}

async function getGameById(gameId) {
  try {
    return await pb.collection("games").getOne(gameId, { requestKey: null });
  } catch {
    return null;
  }
}

// ── Player display name ──────────────────────────────────────────────────────
async function getPlayerName(userId) {
  try {
    const u = await pb.collection("users").getFirstListItem(
      `telegram_id="${userId}"`, { requestKey: null }
    );
    return u.username ? `@${u.username}` : u.first_name || `User ${userId}`;
  } catch {
    return `User ${userId}`;
  }
}

// ── Board message ────────────────────────────────────────────────────────────
async function sendBoardMessage(ctx, game, chess, extraText = "") {
  const whiteName = await getPlayerName(game.player_white);
  const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
  const turnName = game.turn === "white" ? whiteName : blackName;

  const status = gameStatusText(chess);
  const board = renderBoard(game.fen, "white");

  const text =
    `♟ <b>Шахматная партия</b>\n\n` +
    `⬜ Белые: ${whiteName}\n` +
    `⬛ Чёрные: ${blackName}\n\n` +
    `${board}\n\n` +
    (status ? `${status}\n` : `🎯 Ход: ${turnName} (${game.turn === "white" ? "⬜" : "⬛"})\n`) +
    (extraText ? `\n${extraText}` : "");

  const kb = new InlineKeyboard().text("📋 Показать доску", `board_${game.id}`);

  return await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
}

// ── /start ───────────────────────────────────────────────────────────────────
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

// ── /newgame ─────────────────────────────────────────────────────────────────
bot.command("newgame", async (ctx) => {
  const user = await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);

  const existing = await getActiveGame(String(ctx.from.id));
  if (existing) {
    return ctx.reply(
      `⚠️ У вас уже есть активная игра (ID: <code>${existing.id}</code>).\n` +
      `Сначала завершите её командой /resign.`,
      { parse_mode: "HTML" }
    );
  }

  const chess = new Chess();
  const game = await pb.collection("games").create({
    player_white: String(ctx.from.id),
    player_black: "",
    status: "waiting",
    fen: chess.fen(),
    turn: "white",
    winner: "",
  }, { requestKey: null });

  const kb = new InlineKeyboard().text("✅ Присоединиться", `join_${game.id}`);

  await ctx.reply(
    `♟ <b>Новая игра создана!</b>\n\n` +
    `Вы играете белыми ⬜\n\n` +
    `ID игры: <code>${game.id}</code>\n\n` +
    `Отправьте другу:\n` +
    `<code>/join ${game.id}</code>\n\n` +
    `Или пусть нажмёт кнопку ниже 👇`,
    { parse_mode: "HTML", reply_markup: kb }
  );
});

// ── /join ────────────────────────────────────────────────────────────────────
bot.command("join", async (ctx) => {
  const user = await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const gameId = ctx.match?.trim();

  if (!gameId) {
    // Show list of waiting games
    const waitingGames = await pb.collection("games").getList(1, 10, {
      filter: 'status="waiting"',
      requestKey: null,
    });

    if (waitingGames.items.length === 0) {
      return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
    }

    const kb = new InlineKeyboard();
    for (const g of waitingGames.items) {
      const whiteName = await getPlayerName(g.player_white);
      kb.text(`${whiteName} ищет соперника`, `join_${g.id}`).row();
    }

    return ctx.reply("🎮 Открытые игры:", { reply_markup: kb });
  }

  const game = await getGameById(gameId);
  if (!game) return ctx.reply("❌ Игра не найдена.");
  if (game.status !== "waiting") return ctx.reply("❌ Игра уже началась или завершена.");
  if (game.player_white === String(ctx.from.id)) return ctx.reply("❌ Нельзя играть с собой.");

  await pb.collection("games").update(gameId, {
    player_black: String(ctx.from.id),
    status: "active",
  }, { requestKey: null });

  const updatedGame = await getGameById(gameId);
  const chess = new Chess(updatedGame.fen);

  const whiteName = await getPlayerName(updatedGame.player_white);
  const blackName = await getPlayerName(updatedGame.player_black);

  // Notify white player
  try {
    await bot.api.sendMessage(
      updatedGame.player_white,
      `🎉 <b>${blackName}</b> присоединился к игре!\n\nВы ходите первыми ⬜\n\n` +
      renderBoard(updatedGame.fen, "white"),
      { parse_mode: "HTML" }
    );
  } catch {}

  await ctx.reply(
    `♟ <b>Игра началась!</b>\n\n` +
    `⬜ Белые: ${whiteName}\n` +
    `⬛ Чёрные: ${blackName}\n\n` +
    renderBoard(updatedGame.fen, "black") + "\n\n" +
    `Ждите хода белых...`,
    { parse_mode: "HTML" }
  );
});

// ── /move ────────────────────────────────────────────────────────────────────
bot.command("move", async (ctx) => {
  const moveStr = ctx.match?.trim();
  if (!moveStr) return ctx.reply("❌ Укажите ход. Пример: /move e2e4");

  const userId = String(ctx.from.id);
  const game = await getActiveGame(userId);

  if (!game) return ctx.reply("❌ У вас нет активной игры. Создайте: /newgame");
  if (game.status !== "active") return ctx.reply("❌ Игра ещё не началась. Ждите соперника.");

  // Check turn
  const isWhite = game.player_white === userId;
  const isBlack = game.player_black === userId;
  const myColor = isWhite ? "white" : "black";

  if (game.turn !== myColor) {
    return ctx.reply("⏳ Сейчас не ваш ход.");
  }

  const chess = new Chess(game.fen);

  // Try move (support both "e2e4" and "e2-e4" formats)
  const normalized = moveStr.replace("-", "");
  let result;
  try {
    result = chess.move({
      from: normalized.slice(0, 2),
      to: normalized.slice(2, 4),
      promotion: normalized[4] || "q",
    });
  } catch {
    result = null;
  }

  if (!result) {
    return ctx.reply(`❌ Недопустимый ход: <code>${moveStr}</code>\n\nПример: /move e2e4`, { parse_mode: "HTML" });
  }

  const newFen = chess.fen();
  const newTurn = chess.turn() === "w" ? "white" : "black";

  // Check game end
  let newStatus = "active";
  let winner = "";
  const statusText = gameStatusText(chess);

  if (chess.isGameOver()) {
    newStatus = "finished";
    if (chess.isCheckmate()) {
      winner = userId; // current player made the winning move
    }
  }

  // Save move
  await pb.collection("moves").create({
    game_id: game.id,
    player_id: userId,
    move: moveStr,
    fen_after: newFen,
  }, { requestKey: null });

  // Update game
  await pb.collection("games").update(game.id, {
    fen: newFen,
    turn: newTurn,
    status: newStatus,
    winner,
  }, { requestKey: null });

  const whiteName = await getPlayerName(game.player_white);
  const blackName = await getPlayerName(game.player_black);
  const moverName = isWhite ? whiteName : blackName;
  const opponentId = isWhite ? game.player_black : game.player_white;
  const opponentPerspective = isWhite ? "black" : "white";

  const moveInfo = `✅ Ход: <code>${moveStr}</code> (${moverName})`;

  // Send to current player
  await ctx.reply(
    `${moveInfo}\n\n` +
    renderBoard(newFen, myColor) + "\n\n" +
    (statusText ? `${statusText}\n` : `⏳ Ждём хода соперника...`),
    { parse_mode: "HTML" }
  );

  // Notify opponent
  if (opponentId) {
    let opponentMsg = `${moveInfo}\n\n` + renderBoard(newFen, opponentPerspective) + "\n\n";

    if (newStatus === "finished") {
      if (chess.isCheckmate()) {
        opponentMsg += `♟ Шах и мат! Победили ${moverName}!`;
      } else {
        opponentMsg += `🤝 Игра завершена: ${statusText}`;
      }
    } else {
      opponentMsg += chess.isCheck() ? `⚠️ Шах! Ваш ход.` : `🎯 Ваш ход!`;
    }

    try {
      await bot.api.sendMessage(opponentId, opponentMsg, { parse_mode: "HTML" });
    } catch {}
  }

  // Announce game over to both
  if (newStatus === "finished") {
    let endMsg = "";
    if (chess.isCheckmate()) {
      endMsg = `🏆 Игра завершена! Победитель: ${moverName}`;
    } else {
      endMsg = `🤝 Игра завершена: ${statusText}`;
    }
    await ctx.reply(endMsg);
  }
});

// ── /board ───────────────────────────────────────────────────────────────────
bot.command("board", async (ctx) => {
  const userId = String(ctx.from.id);
  const game = await getActiveGame(userId);

  if (!game) return ctx.reply("❌ У вас нет активной игры.");

  const chess = new Chess(game.fen);
  const isWhite = game.player_white === userId;
  const perspective = isWhite ? "white" : "black";

  const whiteName = await getPlayerName(game.player_white);
  const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
  const turnName = game.turn === "white" ? whiteName : blackName;
  const statusText = gameStatusText(chess);

  await ctx.reply(
    `♟ <b>Текущая позиция</b>\n\n` +
    `⬜ Белые: ${whiteName}\n` +
    `⬛ Чёрные: ${blackName}\n\n` +
    renderBoard(game.fen, perspective) + "\n\n" +
    (statusText ? statusText : `🎯 Ход: ${turnName} (${game.turn === "white" ? "⬜" : "⬛"})`),
    { parse_mode: "HTML" }
  );
});

// ── /resign ──────────────────────────────────────────────────────────────────
bot.command("resign", async (ctx) => {
  const userId = String(ctx.from.id);
  const game = await getActiveGame(userId);

  if (!game) return ctx.reply("❌ У вас нет активной игры.");

  const isWhite = game.player_white === userId;
  const opponentId = isWhite ? game.player_black : game.player_white;
  const winner = opponentId || "";

  await pb.collection("games").update(game.id, {
    status: "finished",
    winner,
  }, { requestKey: null });

  const myName = await getPlayerName(userId);
  await ctx.reply(`🏳 ${myName} сдался. Игра завершена.`);

  if (opponentId) {
    const opponentName = await getPlayerName(opponentId);
    try {
      await bot.api.sendMessage(
        opponentId,
        `🏆 ${myName} сдался! Вы победили, ${opponentName}!`
      );
    } catch {}
  }
});

// ── /games ───────────────────────────────────────────────────────────────────
bot.command("games", async (ctx) => {
  const waitingGames = await pb.collection("games").getList(1, 10, {
    filter: 'status="waiting"',
    requestKey: null,
  });

  if (waitingGames.items.length === 0) {
    return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
  }

  const kb = new InlineKeyboard();
  for (const g of waitingGames.items) {
    const whiteName = await getPlayerName(g.player_white);
    kb.text(`⬜ ${whiteName} ищет соперника`, `join_${g.id}`).row();
  }

  await ctx.reply(`🎮 Открытые игры (${waitingGames.items.length}):`, { reply_markup: kb });
});

// ── Inline callbacks ─────────────────────────────────────────────────────────
bot.callbackQuery(/^join_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1];
  const userId = String(ctx.from.id);

  await ctx.answerCallbackQuery();

  const game = await getGameById(gameId);
  if (!game) return ctx.reply("❌ Игра не найдена.");
  if (game.status !== "waiting") return ctx.reply("❌ Игра уже началась.");
  if (game.player_white === userId) return ctx.reply("❌ Нельзя играть с собой.");

  await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);

  await pb.collection("games").update(gameId, {
    player_black: userId,
    status: "active",
  }, { requestKey: null });

  const updatedGame = await getGameById(gameId);
  const whiteName = await getPlayerName(updatedGame.player_white);
  const blackName = await getPlayerName(updatedGame.player_black);

  try {
    await bot.api.sendMessage(
      updatedGame.player_white,
      `🎉 <b>${blackName}</b> присоединился!\n\nВы ходите первыми ⬜\n\n` +
      renderBoard(updatedGame.fen, "white"),
      { parse_mode: "HTML" }
    );
  } catch {}

  await ctx.reply(
    `♟ <b>Игра началась!</b>\n\n` +
    `⬜ Белые: ${whiteName}\n` +
    `⬛ Чёрные: ${blackName}\n\n` +
    renderBoard(updatedGame.fen, "black") + "\n\n" +
    `Ждите хода белых...`,
    { parse_mode: "HTML" }
  );
});

bot.callbackQuery(/^board_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1];
  await ctx.answerCallbackQuery();

  const game = await getGameById(gameId);
  if (!game) return ctx.reply("❌ Игра не найдена.");

  const userId = String(ctx.from.id);
  const isWhite = game.player_white === userId;
  const perspective = isWhite ? "white" : "black";

  const chess = new Chess(game.fen);
  const whiteName = await getPlayerName(game.player_white);
  const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
  const statusText = gameStatusText(chess);
  const turnName = game.turn === "white" ? whiteName : blackName;

  await ctx.reply(
    `♟ <b>Доска</b>\n\n` +
    `⬜ ${whiteName} vs ⬛ ${blackName}\n\n` +
    renderBoard(game.fen, perspective) + "\n\n" +
    (statusText ? statusText : `🎯 Ход: ${turnName}`),
    { parse_mode: "HTML" }
  );
});

// ── Bot commands menu ────────────────────────────────────────────────────────
bot.api.setMyCommands([
  { command: "start", description: "Главное меню" },
  { command: "newgame", description: "Создать новую игру" },
  { command: "join", description: "Присоединиться к игре" },
  { command: "move", description: "Сделать ход (напр. e2e4)" },
  { command: "board", description: "Показать текущую доску" },
  { command: "resign", description: "Сдаться" },
  { command: "games", description: "Список открытых игр" },
]);

// ── Start ────────────────────────────────────────────────────────────────────
async function main() {
  // Wait for PocketBase
  let retries = 0;
  while (retries < 30) {
    try {
      await pb.collection("_superusers").authWithPassword(PB_EMAIL, PB_PASS);
      console.log("[BOT] Connected to PocketBase");
      break;
    } catch (err) {
      retries++;
      console.log(`[BOT] Waiting for PocketBase... (${retries}/30)`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (!pb.authStore.isValid) {
    console.error("[BOT] Could not connect to PocketBase. Exiting.");
    process.exit(1);
  }

  await setupPocketBase(pb);

  bot.catch((err) => {
    console.error("[BOT] Error:", err.error?.message || err);
  });

  await bot.start();
  console.log("[BOT] Chess bot is running!");
}

main().catch((err) => {
  console.error("[BOT] Fatal:", err);
  process.exit(1);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
