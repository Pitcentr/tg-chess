// PocketBase schema setup - runs once on first start
import PocketBase from "pocketbase";

export async function setupPocketBase(pb) {
  console.log("[SETUP] Checking PocketBase collections...");

  const collections = [
    {
      name: "users",
      type: "base",
      schema: [
        { name: "telegram_id", type: "text", required: true },
        { name: "username", type: "text", required: false },
        { name: "first_name", type: "text", required: false },
      ],
    },
    {
      name: "games",
      type: "base",
      schema: [
        { name: "player_white", type: "text", required: true },
        { name: "player_black", type: "text", required: false },
        { name: "status", type: "select", required: true,
          options: { values: ["waiting", "active", "finished"] } },
        { name: "fen", type: "text", required: true },
        { name: "turn", type: "select", required: true,
          options: { values: ["white", "black"] } },
        { name: "winner", type: "text", required: false },
        { name: "white_message_id", type: "number", required: false },
        { name: "black_message_id", type: "number", required: false },
      ],
    },
    {
      name: "moves",
      type: "base",
      schema: [
        { name: "game_id", type: "text", required: true },
        { name: "player_id", type: "text", required: true },
        { name: "move", type: "text", required: true },
        { name: "fen_after", type: "text", required: true },
      ],
    },
  ];

  for (const col of collections) {
    try {
      await pb.collections.getOne(col.name);
      console.log(`[SETUP] Collection '${col.name}' already exists`);
    } catch {
      try {
        await pb.collections.create(col);
        console.log(`[SETUP] Created collection '${col.name}'`);
      } catch (err) {
        console.error(`[SETUP] Failed to create '${col.name}':`, err.message);
      }
    }
  }

  console.log("[SETUP] Done.");
}
