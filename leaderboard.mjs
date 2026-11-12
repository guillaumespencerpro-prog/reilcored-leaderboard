// REILCORED — live leaderboard
// Reads the public DraftBot leaderboard page and updates one Discord message
// in #🏆⟩leaderboard through a webhook. No dependencies (Node 20+).

import { readFile, writeFile } from "node:fs/promises";

const GUILD_ID = process.env.GUILD_ID || "1358558675660181524";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const MESSAGE_ID_FILE = process.env.MESSAGE_ID_FILE || "message_id.txt";
const TOP = Number(process.env.TOP || 10);
const PAGE_URL = `https://www.draftbot.fr/levels/${GUILD_ID}`;
const COLOR = 0xff2e4d; // neon red, same as the Moderator role
const LOGO = "https://img.draftbot.fr/1794500832340-41bf0a546f357c14.png";

// Rank roles: [level, label]
const RANKS = [
  [50, "👑 Nightmare"],
  [25, "👁️ Phantom"],
  [10, "⚡ Glitch"],
  [5, "📡 Signal"],
];

// ---------- 1. Read the leaderboard ----------

// Nuxt serialises its page data with "devalue": a flat array where objects
// and arrays point to other entries by index. This rebuilds the real object.
export function hydrate(flat) {
  const cache = new Map();
  const get = (i) => {
    if (typeof i !== "number") return i;
    if (i < 0) return undefined; // devalue special values (undefined, NaN…)
    if (cache.has(i)) return cache.get(i);
    const v = flat[i];
    if (v === null || typeof v !== "object") {
      cache.set(i, v);
      return v;
    }
    if (Array.isArray(v)) {
      if (typeof v[0] === "string") {
        // Tagged value: ["Reactive", idx], ["Ref", idx], ["Set", ...], ["Date", "..."]
        const [tag, ...rest] = v;
        if (tag === "Date") return new Date(rest[0]);
        if (tag === "Set" || tag === "Map") return rest.map(get);
        return rest.length ? get(rest[0]) : undefined;
      }
      const out = [];
      cache.set(i, out);
      for (const x of v) out.push(get(x));
      return out;
    }
    const out = {};
    cache.set(i, out);
    for (const [k, x] of Object.entries(v)) out[k] = get(x);
    return out;
  };
  return get(0);
}

export function parseLeaderboard(html) {
  const m = html.match(/id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Leaderboard data not found on the DraftBot page");
  const root = hydrate(JSON.parse(m[1]));
  const levels = root?.data?.levels;
  if (!levels || !Array.isArray(levels.users)) {
    throw new Error("Unexpected DraftBot page format (no levels.users)");
  }
  return levels;
}

async function fetchLeaderboard() {
  const res = await fetch(PAGE_URL, {
    headers: { "user-agent": "REILCORED-leaderboard/1.0 (+https://reilcored.com)" },
  });
  if (!res.ok) throw new Error(`DraftBot page returned HTTP ${res.status}`);
  return parseLeaderboard(await res.text());
}

// ---------- 2. Build the Discord message ----------

const MEDALS = ["🥇", "🥈", "🥉"];
const fmt = (n) => Number(n || 0).toLocaleString("fr-CH").replace(/\s/g, " ");

function rankOf(level) {
  const r = RANKS.find(([lv]) => level >= lv);
  return r ? r[1] : "—";
}

function bar(current, needed, size = 10) {
  const ratio = needed > 0 ? Math.min(current / needed, 1) : 0;
  const full = Math.round(ratio * size);
  return "▰".repeat(full) + "▱".repeat(size - full);
}

export function buildPayload(levels, now = new Date()) {
  const users = levels.users.slice(0, TOP);
  const ts = Math.floor(now.getTime() / 1000);

  let description;
  if (users.length === 0) {
    description =
      "🇬🇧 No XP yet — be the first on the board!\n" +
      "🇫🇷 Personne n'a encore d'XP — sois le premier au classement !";
  } else {
    description = users
      .map((u, i) => {
        const place = MEDALS[i] || `\`#${String(i + 1).padStart(2, "0")}\``;
        const name = u.id ? `<@${u.id}>` : (u.displayName || u.username || "?");
        const lvl = Number(u.level || 0);
        return (
          `${place} ${name} ⟩ **Lv.${lvl}** · ${rankOf(lvl)}\n` +
          `> ${bar(Number(u.currentLevelXp), Number(u.levelXp))} ${fmt(u.totalXp)} XP`
        );
      })
      .join("\n");
  }

  return {
    username: "REILCORED",
    avatar_url: LOGO,
    allowed_mentions: { parse: [] }, // never ping anyone
    embeds: [
      {
        title: "🏆 ⟦ NEON CITY // LIVE LEADERBOARD ⟧",
        url: PAGE_URL,
        color: COLOR,
        description,
        fields: [
          {
            name: "⟦ RANKS · RANGS ⟧",
            value: "Lv.5 📡 Signal · Lv.10 ⚡ Glitch · Lv.25 👁️ Phantom · Lv.50 👑 Nightmare",
          },
          {
            name: "⟦ HOW · COMMENT ⟧",
            value:
              "🇬🇧 Chat to earn XP · `/niveau` your level · `/topniveau` full ranking\n" +
              "🇫🇷 Discute pour gagner de l'XP · `/niveau` ton niveau · `/topniveau` classement complet\n" +
              `Updated · Mis à jour <t:${ts}:R>`,
          },
        ],
        footer: { text: "REILCORED · We create your nightmares." },
        timestamp: now.toISOString(),
      },
    ],
  };
}

// ---------- 3. Post or update the message ----------

async function readMessageId() {
  try {
    return (await readFile(MESSAGE_ID_FILE, "utf8")).trim() || null;
  } catch {
    return null;
  }
}

async function discord(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : null };
}

async function publish(payload) {
  const base = WEBHOOK_URL.split("?")[0];
  const id = await readMessageId();
  if (id) {
    const { username, avatar_url, ...edit } = payload; // name/avatar can't change on edit
    const r = await discord("PATCH", `${base}/messages/${id}`, edit);
    if (r.ok) return { action: "updated", id };
    if (r.status !== 404) throw new Error(`Discord edit failed: HTTP ${r.status}`);
    console.log("Previous message was deleted, posting a new one.");
  }
  const r = await discord("POST", `${base}?wait=true`, payload);
  if (!r.ok) throw new Error(`Discord post failed: HTTP ${r.status}`);
  await writeFile(MESSAGE_ID_FILE, r.json.id + "\n");
  return { action: "posted", id: r.json.id };
}

// ---------- main ----------

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!WEBHOOK_URL) {
    console.error("Missing WEBHOOK_URL secret.");
    process.exit(1);
  }
  const levels = await fetchLeaderboard();
  const result = await publish(buildPayload(levels));
  console.log(`Leaderboard ${result.action} (message ${result.id}), ${levels.users.length} members listed.`);
}
