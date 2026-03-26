import { Bot, InlineKeyboard, InputFile } from "grammy";
import { Chess } from "chess.js";
import PocketBase from "pocketbase";
import dotenv from "dotenv";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "fs";

// Register system font for coordinate labels
const FONT_PATHS = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
];
for (const p of FONT_PATHS) {
  if (existsSync(p)) { GlobalFonts.registerFromPath(p, "DejaVu"); break; }
}
const LABEL_FONT = "bold 18px DejaVu, sans-serif";

dotenv.config();

const REQUIRED_ENV = ['TG_TOKEN', 'PB_URL', 'PB_ADMIN', 'PB_PASSWORD'];

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${message}`);
  if (data) console.dir(data, { depth: null });
}

// ── Piece SVGs — Lichess CBurnett set, viewBox 0 0 45 45 ─────────────────────
const PIECE_SVG = {
  "b": `<g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zm6-4c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" fill="#000" stroke-linecap="butt"/><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="#fff" stroke-linejoin="miter"/></g>`,
  "k": `<g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#000" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#000"/><path d="M20 8h5" stroke-linejoin="miter"/><path d="M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5l.01 2.1-.01-2.1C20 18 9.906 14 6.997 19.85c-2.497 5.65 4.853 9 4.853 9M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke="#fff"/></g>`,
  "n": `<g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22,10C32.5,11 38.5,18 38,39L15,39C15,30 25,32.5 23,18" style="fill:#000;stroke:#000"/><path d="M24,18C24.38,20.91 18.45,25.37 16,27C13,29 13.18,31.34 11,31C9.958,30.06 12.41,27.96 11,28C10,28 11.19,29.23 10,30C9,30 5.997,31 6,26C6,24 12,14 12,14C12,14 13.89,12.1 14,10.5C13.27,9.506 13.5,8.5 13.5,7.5C14.5,6.5 16.5,10 16.5,10L18.5,10C18.5,10 19.28,8.008 21,7C22,7 22,10 22,10" style="fill:#000;stroke:#000"/><path d="M9.5 25.5A0.5 0.5 0 1 1 8.5,25.5A0.5 0.5 0 1 1 9.5 25.5z" style="fill:#ececec;stroke:#ececec"/><path d="M15 15.5A0.5 1.5 0 1 1 14,15.5A0.5 1.5 0 1 1 15 15.5z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#ececec;stroke:#ececec"/></g>`,
  "p": `<g><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></g>`,
  "q": `<g fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75" stroke="none"/><circle cx="14" cy="9" r="2.75" stroke="none"/><circle cx="22.5" cy="8" r="2.75" stroke="none"/><circle cx="31" cy="9" r="2.75" stroke="none"/><circle cx="39" cy="12" r="2.75" stroke="none"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/><path d="M11 38.5a35 35 1 0 0 23 0" fill="none" stroke-linecap="butt"/><path d="M11 29a35 35 1 0 1 23 0M12.5 31.5h20M11.5 34.5a35 35 1 0 0 22 0M10.5 37.5a35 35 1 0 0 24 0" fill="none" stroke="#fff"/></g>`,
  "r": `<g fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" stroke-linecap="butt"/><path d="M14 29.5v-13h17v13H14z" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" stroke-linecap="butt"/><path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" fill="none" stroke="#fff" stroke-width="1" stroke-linejoin="miter"/></g>`,
  "B": `<g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#fff" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linejoin="miter"/></g>`,
  "K": `<g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#fff" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#fff"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g>`,
  "N": `<g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22,10C32.5,11 38.5,18 38,39L15,39C15,30 25,32.5 23,18" style="fill:#fff;stroke:#000"/><path d="M24,18C24.38,20.91 18.45,25.37 16,27C13,29 13.18,31.34 11,31C9.958,30.06 12.41,27.96 11,28C10,28 11.19,29.23 10,30C9,30 5.997,31 6,26C6,24 12,14 12,14C12,14 13.89,12.1 14,10.5C13.27,9.506 13.5,8.5 13.5,7.5C14.5,6.5 16.5,10 16.5,10L18.5,10C18.5,10 19.28,8.008 21,7C22,7 22,10 22,10" style="fill:#fff;stroke:#000"/><path d="M9.5 25.5A0.5 0.5 0 1 1 8.5,25.5A0.5 0.5 0 1 1 9.5 25.5z" style="fill:#000;stroke:#000"/><path d="M15 15.5A0.5 1.5 0 1 1 14,15.5A0.5 1.5 0 1 1 15 15.5z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#000;stroke:#000"/></g>`,
  "P": `<g><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></g>`,
  "Q": `<g fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/><path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/></g>`,
  "R": `<g fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linecap="butt"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23" fill="none" stroke-linejoin="miter"/></g>`,
};

// Cache rendered piece images (built once on first use)
const pieceImageCache = {};
async function getPieceImage(piece) {
  if (pieceImageCache[piece]) return pieceImageCache[piece];
  const inner = PIECE_SVG[piece];
  if (!inner) return null;
  // Render SVG at 2× native size (90×90) for crisp pieces
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="90" height="90">${inner}</svg>`;
  const img = await loadImage(Buffer.from(svg));
  pieceImageCache[piece] = img;
  return img;
}

const LIGHT  = "#F0D9B5";
const DARK   = "#B58863";
const BORDER = "#2b2b2b";
const SQ     = 90;   // square size in px (2× = retina-ready)
const PAD    = 36;   // padding for coordinate labels
const SIZE   = SQ * 8 + PAD * 2;

async function renderBoard(fen, perspective = "white") {
  const canvas  = createCanvas(SIZE, SIZE);
  const ctx     = canvas.getContext("2d");
  const flipped = perspective === "black";

  // Border background
  ctx.fillStyle = BORDER;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Parse FEN position
  const position = fen.split(" ")[0];
  const board = position.split("/").map(row => {
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) cells.push(null);
      else cells.push(ch);
    }
    return cells;
  });

  // Draw squares
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dr = flipped ? 7 - r : r;
      const df = flipped ? 7 - f : f;
      ctx.fillStyle = (r + f) % 2 === 0 ? LIGHT : DARK;
      ctx.fillRect(PAD + df * SQ, PAD + dr * SQ, SQ, SQ);
    }
  }

  // ── Coordinate labels in the PAD border ──────────────────────────────────
  const files = flipped ? "hgfedcba" : "abcdefgh";
  ctx.font         = LABEL_FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign    = "center";
  ctx.fillStyle    = "#d0d0d0";

  // Rank numbers — left and right PAD strips
  for (let r = 0; r < 8; r++) {
    const rank = String(flipped ? r + 1 : 8 - r);
    const y    = PAD + r * SQ + SQ / 2;
    ctx.fillText(rank, PAD / 2, y);
    ctx.fillText(rank, SIZE - PAD / 2, y);
  }

  // File letters — top and bottom PAD strips
  for (let f = 0; f < 8; f++) {
    const x = PAD + f * SQ + SQ / 2;
    ctx.fillText(files[f], x, PAD / 2);
    ctx.fillText(files[f], x, SIZE - PAD / 2);
  }

  // Draw pieces (SVG already at 90×90, drawn 1:1)
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const dr  = flipped ? 7 - r : r;
      const df  = flipped ? 7 - f : f;
      const img = await getPieceImage(piece);
      if (img) ctx.drawImage(img, PAD + df * SQ, PAD + dr * SQ, SQ, SQ);
    }
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

// ── DeepSeek position evaluation ─────────────────────────────────────────────
async function evaluatePosition(fen, whiteName, blackName) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const prompt =
    `You are a chess grandmaster. Analyze this chess position (FEN notation) and estimate winning chances.\n\n` +
    `FEN: ${fen}\n\n` +
    `Players: White = ${whiteName}, Black = ${blackName}\n\n` +
    `Respond ONLY in this exact JSON format, no other text:\n` +
    `{"white": <0-100>, "black": <0-100>, "draw": <0-100>, "comment": "<one short sentence in Russian>"}\n\n` +
    `The three numbers must sum to 100. Be realistic based on material and position.`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.2,
      }),
    });

    if (!res.ok) { log('WARN', `DeepSeek API error: ${res.status}`); return null; }

    const data  = await res.json();
    const text  = data.choices?.[0]?.message?.content?.trim() || "";
    // Extract JSON even if wrapped in markdown code block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const eval_ = JSON.parse(match[0]);
    return eval_;
  } catch (err) {
    log('WARN', `DeepSeek eval failed: ${err.message}`);
    return null;
  }
}

function formatEval(eval_, whiteName, blackName) {
  if (!eval_) return "";
  const wBar = "█".repeat(Math.round(eval_.white / 10));
  const bBar = "█".repeat(Math.round(eval_.black / 10));
  return (
    `\n\n📊 <b>Оценка позиции:</b>\n` +
    `⬜ ${whiteName}: <b>${eval_.white}%</b> ${wBar}\n` +
    `⬛ ${blackName}: <b>${eval_.black}%</b> ${bBar}\n` +
    (eval_.draw > 5 ? `🤝 Ничья: <b>${eval_.draw}%</b>\n` : "") +
    (eval_.comment ? `💡 ${eval_.comment}` : "")
  );
}

async function main() {
  const missing = REQUIRED_ENV.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('⚠️ ОТСУТСТВУЮТ ПЕРЕМЕННЫЕ:', missing.join(', '));
    while (true) await new Promise(r => setTimeout(r, 60000));
  }

  log('INFO', 'Запуск Chess Bot');

  // ── PocketBase auth with auto-refresh ────────────────────────────────────
  async function ensurePBAuth() {
    try {
      if (!pb.authStore.isValid) {
        await pb.collection("_superusers").authWithPassword(process.env.PB_ADMIN, process.env.PB_PASSWORD);
        log('INFO', 'PocketBase auth refreshed');
      }
    } catch (err) {
      log('ERROR', 'PB auth failed', err.message);
      throw err;
    }
  }

  await ensurePBAuth();
  log('INFO', 'Успешная аутентификация в PocketBase');

  // Auto-refresh PB token every 30 minutes
  setInterval(async () => {
    try {
      await ensurePBAuth();
    } catch (err) {
      log('ERROR', 'Не удалось обновить PB токен', err.message);
    }
  }, 30 * 60 * 1000);

  await ensureCollections();

  async function getOrCreateUser(telegramId, username, firstName) {
    const id = String(telegramId);
    try {
      await ensurePBAuth();
      return await pb.collection("chess_users").getFirstListItem(`telegram_id="${id}"`, { requestKey: null });
    } catch (err) {
      log('DEBUG', `User not found, creating: ${id}`);
      try {
        await ensurePBAuth();
        return await pb.collection("chess_users").create(
          { telegram_id: id, username: username || "", first_name: firstName || "" },
          { requestKey: null }
        );
      } catch (createErr) {
        log('ERROR', `Failed to create user ${id}`, createErr.message);
        throw createErr;
      }
    }
  }

  async function getActiveGame(userId) {
    try {
      await ensurePBAuth();
      return await pb.collection("chess_games").getFirstListItem(
        `(player_white="${userId}" || player_black="${userId}") && (status="active" || status="waiting")`,
        { requestKey: null }
      );
    } catch (err) {
      if (err?.status !== 404) log('ERROR', `getActiveGame failed for ${userId}`, err.message);
      return null;
    }
  }

  async function getGameById(id) {
    try {
      await ensurePBAuth();
      return await pb.collection("chess_games").getOne(id, { requestKey: null });
    } catch (err) {
      if (err?.status !== 404) log('ERROR', `getGameById failed for ${id}`, err.message);
      return null;
    }
  }

  async function getPlayerName(userId) {
    try {
      await ensurePBAuth();
      const u = await pb.collection("chess_users").getFirstListItem(`telegram_id="${userId}"`, { requestKey: null });
      return u.username ? `@${u.username}` : (u.first_name || `User ${userId}`);
    } catch (err) {
      if (err?.status !== 404) log('ERROR', `getPlayerName failed for ${userId}`, err.message);
      return `User ${userId}`;
    }
  }

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
    const newMoveCount = (game.move_count || 0) + 1;

    try {
      await ensurePBAuth();
      await pb.collection("chess_moves").create(
        { game_id: game.id, player_id: userId, move: moveStr, fen_after: newFen },
        { requestKey: null }
      );
      await ensurePBAuth();
      await pb.collection("chess_games").update(game.id,
        { fen: newFen, turn: newTurn, status: newStatus, winner, move_count: newMoveCount },
        { requestKey: null }
      );
    } catch (err) {
      log('ERROR', `Failed to save move for game ${game.id}`, err.message);
      return ctx.reply("❌ Ошибка сохранения хода. Попробуйте ещё раз.");
    }

    const whiteName  = await getPlayerName(game.player_white);
    const blackName  = await getPlayerName(game.player_black);
    const moverName  = isWhite ? whiteName : blackName;
    const opponentId = isWhite ? game.player_black : game.player_white;
    const oppColor   = isWhite ? "black" : "white";
    const moveInfo   = `✅ Ход: <code>${result.san}</code> (${moverName})`;

    // DeepSeek eval every 3rd move (skip if game over)
    let evalText = "";

    const myCaption = moveInfo + (statusTxt ? `\n\n${statusTxt}` : "\n\n⏳ Ждём хода соперника...");

    const myBoard = await renderBoard(newFen, myColor);
    await ctx.replyWithPhoto(new InputFile(myBoard, "board.png"), { caption: myCaption, parse_mode: "HTML" });

    if (opponentId) {
      const oppStatus = isOver
        ? (chess.in_checkmate() ? `\n\n♟ Шах и мат! Победили ${moverName}!` : `\n\n🤝 ${statusTxt}`)
        : (chess.in_check() ? "\n\n⚠️ Шах! Ваш ход." : "\n\n🎯 Ваш ход!");
      try {
        const oppBoard = await renderBoard(newFen, oppColor);
        await bot.api.sendPhoto(opponentId, new InputFile(oppBoard, "board.png"), {
          caption: moveInfo + oppStatus + evalText, parse_mode: "HTML",
        });
      } catch {}
    }

    if (isOver) {
      const endMsg = chess.in_checkmate() ? `🏆 Победитель: ${moverName}!` : `🤝 ${statusTxt}`;
      await ctx.reply(endMsg);
      if (opponentId) try { await bot.api.sendMessage(opponentId, endMsg); } catch {}
    }
  }

  async function doJoinGame(ctx, gameId, userId) {
    const game = await getGameById(gameId);
    if (!game)                        return ctx.reply("❌ Игра не найдена.");
    if (game.status !== "waiting")    return ctx.reply("❌ Игра уже началась или завершена.");
    if (game.player_white === userId) return ctx.reply("❌ Нельзя играть с собой.");

    try {
      await ensurePBAuth();
      await pb.collection("chess_games").update(gameId, { player_black: userId, status: "active" }, { requestKey: null });
    } catch (err) {
      log('ERROR', `Failed to join game ${gameId}`, err.message);
      return ctx.reply("❌ Ошибка присоединения к игре. Попробуйте ещё раз.");
    }
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
      `♟ <b>Chess Bot</b>\n\nИграйте в шахматы прямо в Telegram!\n\n<b>Команды:</b>\n` +
      `/newgame — создать новую игру\n/join &lt;ID&gt; — присоединиться к игре\n` +
      `/move e2e4 — сделать ход\n/board — показать текущую доску\n` +
      `/resign — сдаться\n/games — список открытых игр\n\n` +
      `💡 Во время игры пишите ход прямо в чат: <code>e2e4</code>\n` +
      `💬 Любой другой текст пересылается сопернику\n` +
      `/eval — оценка позиции от AI`,
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
    let game;
    try {
      await ensurePBAuth();
      game = await pb.collection("chess_games").create(
        { player_white: String(ctx.from.id), player_black: "", status: "waiting", fen: chess.fen(), turn: "white", winner: "" },
        { requestKey: null }
      );
    } catch (err) {
      log('ERROR', `Failed to create game for ${ctx.from.id}`, err.message);
      return ctx.reply("❌ Ошибка создания игры. Попробуйте ещё раз.");
    }
    const kb = new InlineKeyboard().text("✅ Присоединиться", `join_${game.id}`);
    await ctx.reply(
      `♟ <b>Новая игра создана!</b>\n\nВы играете белыми ⬜\n\nID игры: <code>${game.id}</code>\n\n` +
      `Отправьте другу: <code>/join ${game.id}</code>\n\nИли пусть нажмёт кнопку 👇`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.command("join", async (ctx) => {
    log('INFO', `CMD /join from ${ctx.from.id}`);
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const gameId = ctx.match?.trim();
    if (!gameId) {
      try {
        await ensurePBAuth();
        const res = await pb.collection("chess_games").getList(1, 10, { filter: 'status="waiting"', requestKey: null });
        if (res.items.length === 0) return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
        const kb = new InlineKeyboard();
        for (const g of res.items) kb.text(`⬜ ${await getPlayerName(g.player_white)} ищет соперника`, `join_${g.id}`).row();
        return ctx.reply("🎮 Открытые игры:", { reply_markup: kb });
      } catch (err) {
        log('ERROR', `Failed to list games`, err.message);
        return ctx.reply("❌ Ошибка загрузки списка игр.");
      }
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
    const caption   = `♟ <b>Текущая позиция</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
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
    try {
      await ensurePBAuth();
      await pb.collection("chess_games").update(game.id, { status: "finished", winner: opponentId || "" }, { requestKey: null });
    } catch (err) {
      log('ERROR', `Failed to resign game ${game.id}`, err.message);
      return ctx.reply("❌ Ошибка завершения игры. Попробуйте ещё раз.");
    }
    const myName = await getPlayerName(userId);
    await ctx.reply(`🏳 ${myName} сдался. Игра завершена.`);
    if (opponentId) {
      const oppName = await getPlayerName(opponentId);
      try { await bot.api.sendMessage(opponentId, `🏆 ${myName} сдался! Вы победили, ${oppName}!`); } catch {}
    }
  });

  bot.command("games", async (ctx) => {
    try {
      await ensurePBAuth();
      const res = await pb.collection("chess_games").getList(1, 10, { filter: 'status="waiting"', requestKey: null });
      if (res.items.length === 0) return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
      const kb = new InlineKeyboard();
      for (const g of res.items) kb.text(`⬜ ${await getPlayerName(g.player_white)} ищет соперника`, `join_${g.id}`).row();
      await ctx.reply(`🎮 Открытые игры (${res.items.length}):`, { reply_markup: kb });
    } catch (err) {
      log('ERROR', `Failed to list games`, err.message);
      return ctx.reply("❌ Ошибка загрузки списка игр.");
    }
  });

  bot.command("eval", async (ctx) => {
    log('INFO', `CMD /eval from ${ctx.from.id}`);
    if (!process.env.DEEPSEEK_API_KEY) {
      return ctx.reply("❌ DeepSeek API не настроен. Укажите DEEPSEEK_API_KEY.");
    }
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game)                    return ctx.reply("❌ У вас нет активной игры.");
    if (game.status !== "active") return ctx.reply("❌ Игра ещё не началась.");

    const thinking = await ctx.reply("🤖 Анализирую позицию...");
    const whiteName = await getPlayerName(game.player_white);
    const blackName = await getPlayerName(game.player_black);
    const eval_     = await evaluatePosition(game.fen, whiteName, blackName);

    const text = eval_
      ? `🤖 <b>Оценка AI</b>\n` + formatEval(eval_, whiteName, blackName).trim()
      : "❌ Не удалось получить оценку. Попробуйте позже.";

    try { await bot.api.deleteMessage(ctx.chat.id, thinking.message_id); } catch {}
    await ctx.reply(text, { parse_mode: "HTML" });
  });

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
    const caption   = `♟ <b>Доска</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
      (statusTxt ? statusTxt : `🎯 Ход: ${turnName}`);
    const board = await renderBoard(game.fen, isWhite ? "white" : "black");
    await ctx.replyWithPhoto(new InputFile(board, "board.png"), { caption, parse_mode: "HTML" });
  });

  bot.on("message:text", async (ctx) => {
    const text   = ctx.message.text.trim();
    const userId = String(ctx.from.id);
    log('INFO', `MSG from ${userId}: "${text.slice(0, 40)}"`);
    if (text.startsWith("/")) return;
    const game = await getActiveGame(userId);
    if (!game || game.status !== "active") return;
    const isWhite    = game.player_white === userId;
    const opponentId = isWhite ? game.player_black : game.player_white;
    if (looksLikeMove(text)) return processMove(ctx, userId, text);
    if (opponentId) {
      const myName = await getPlayerName(userId);
      try {
        await bot.api.sendMessage(opponentId, `💬 <b>${myName}:</b> ${text}`, { parse_mode: "HTML" });
        await ctx.reply("✉️ Отправлено сопернику");
      } catch { await ctx.reply("❌ Не удалось отправить сообщение сопернику."); }
    }
  });

  bot.catch((err) => {
    log('ERROR', `Handler error: ${err.message}`);
    if (err.stack) log('ERROR', 'Stack trace:', err.stack);
    if (err.error) log('ERROR', 'Error details:', err.error);
    try { err.ctx.reply("❌ Внутренняя ошибка.").catch(() => {}); } catch {}
  });

  log('INFO', 'Устанавливаем команды бота...');
  try {
    await bot.api.setMyCommands([
      { command: "start",   description: "Главное меню" },
      { command: "newgame", description: "Создать новую игру" },
      { command: "join",    description: "Присоединиться к игре" },
      { command: "move",    description: "Сделать ход (напр. e2e4)" },
      { command: "board",   description: "Показать текущую доску" },
      { command: "eval",    description: "Оценка позиции AI (DeepSeek)" },
      { command: "resign",  description: "Сдаться" },
      { command: "games",   description: "Список открытых игр" },
    ]);
    log('INFO', 'Команды установлены');
  } catch (err) { log('ERROR', 'Ошибка setMyCommands', err.message); }

  log('INFO', 'Удаляем вебхук...');
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    log('INFO', 'Вебхук удалён');
  } catch (err) { log('WARN', 'deleteWebhook error', err.message); }

  log('INFO', 'Запускаем polling...');
  await bot.start();
}

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
      { name: "move_count",   type: "number", required: false },
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
          if (e.data) log('ERROR', 'Collection creation error details:', e.data);
        }
      } else {
        log('ERROR', `Error checking collection '${col.name}'`, err.message);
      }
    }
  }
}

main().catch(err => { log('CRITICAL', 'Критическая ошибка', err); process.exit(1); });
process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
