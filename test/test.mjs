// Offline checks: parse a real DraftBot page and a page with members.
import assert from "node:assert/strict";
import { parseLeaderboard, buildPayload } from "../leaderboard.mjs";

const wrap = (flat) =>
  `<html><script type="application/json" id="__NUXT_DATA__">${JSON.stringify(flat)}</script></html>`;

// 1. Real page captured on 2026-11-12 (no member has XP yet).
const real = [["ShallowReactive",1],{"data":2,"state":32},["ShallowReactive",3],{"i-drft:panel":4,"levels":9},{"left":5},0,48,false,"svg",{"guild":10,"member":13,"users":14,"rewards":15,"page":5,"total":5},{"name":11,"icon":12},"REILCORED","icon.png",null,[],[16],{"id":17,"level":18,"reward":19},1329121,5,"Rôle 📡 Lv.5 · Signal"];
const empty = parseLeaderboard(wrap(real));
assert.equal(empty.guild.name, "REILCORED");
assert.deepEqual(empty.users, []);
assert.equal(empty.rewards[0].level, 5);
const p0 = buildPayload(empty, new Date("2026-11-12T21:30:00Z"));
assert.match(p0.embeds[0].description, /No XP yet/);

// 2. Same page with members (shape copied from the "member" object DraftBot returns).
const user = (i, id, name, level, cur, need, total) => [
  { id: i + 1, username: i + 2, displayName: i + 2, level: i + 3, currentLevelXp: i + 4, levelXp: i + 5, totalXp: i + 6 },
  id, name, level, cur, need, total,
];
const flat = [["ShallowReactive",1],{"data":2},["ShallowReactive",3],{"levels":4},{"users":5,"rewards":6,"guild":7},[8,15,22],[],{"name":-1}];
flat.push(...user(8, "111", "alice", 27, 340, 1200, 52000));
flat.push(...user(15, "222", "bob", 12, 900, 1000, 14000));
flat.push(...user(22, "333", "carol", 3, 50, 300, 900));
const lv = parseLeaderboard(wrap(flat));
assert.equal(lv.users.length, 3);
assert.equal(lv.users[0].displayName, "alice");
const p = buildPayload(lv, new Date("2026-11-12T21:30:00Z"));
const d = p.embeds[0].description;
assert.match(d, /🥇 <@111> ⟩ \*\*Lv\.27\*\* · 👁️ Phantom/);
assert.match(d, /🥈 <@222> ⟩ \*\*Lv\.12\*\* · ⚡ Glitch/);
assert.match(d, /🥉 <@333> ⟩ \*\*Lv\.3\*\* · —/);
assert.deepEqual(p.allowed_mentions, { parse: [] });
assert.ok(JSON.stringify(p).length < 6000, "embed under Discord limit");

console.log("All tests passed.\n");
console.log(d);
