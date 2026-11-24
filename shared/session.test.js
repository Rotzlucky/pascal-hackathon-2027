import { test } from "node:test";
import assert from "node:assert/strict";
import { Session, PAINT_COLORS, COLORS } from "./session.js";

function setup(options = {}) {
  let time = 0;
  const frames = [];
  const session = new Session({ now: () => time, lamps: { show: (f) => frames.push(f) }, ...options });
  const inbox = {};
  const join = (id, role = "player") => {
    inbox[id] = [];
    session.addClient(id, (msg) => inbox[id].push(msg), role);
  };
  const last = (id) => inbox[id].filter((m) => m.type === "state").at(-1);
  return { session, frames, inbox, join, last, advance: (ms) => (time += ms) };
}

test("starts in paint mode with all windows off", () => {
  const { session, frames } = setup();
  assert.equal(session.mode, "paint");
  assert.deepEqual(frames.at(-1).windows, Array(17).fill(null));
});

test("first player to join plays, the second waits", () => {
  const { session, join, last } = setup();
  join("a");
  join("b");
  session.handle("a", { type: "join" });
  session.handle("b", { type: "join" });
  assert.equal(session.mode, "puzzle");
  assert.equal(last("a").you.status, "active");
  assert.equal(last("b").you.status, "waiting");
  assert.equal(last("b").you.position, 1);
});

test("only the active player can tap", () => {
  const { session, join, last } = setup();
  join("a");
  join("b");
  session.handle("a", { type: "join" });
  session.handle("b", { type: "tap", cell: 3 });
  assert.equal(last("a").game.moves, 0);
  session.handle("a", { type: "tap", cell: 3 });
  assert.equal(last("a").game.moves, 1);
});

test("solving the puzzle lights everything and turns the door green", () => {
  const { session, join, last, frames } = setup();
  join("a");
  session.handle("a", { type: "join" });
  for (const cell of [...session.game.solution]) session.handle("a", { type: "tap", cell });
  assert.equal(last("a").game.won, true);
  assert.equal(frames.at(-1).door, COLORS.doorWon);
});

test("an idle player is replaced by the next one in line", () => {
  const { session, join, last, inbox, advance } = setup({ idleMs: 1000 });
  join("a");
  join("b");
  session.handle("a", { type: "join" });
  session.handle("b", { type: "join" });
  advance(1500);
  session.tick();
  assert.ok(inbox.a.some((m) => m.type === "timeout"));
  assert.equal(last("b").you.status, "active");
  assert.equal(last("a").you.status, "watching");
});

test("when the last player leaves, paint mode returns", () => {
  const { session, join } = setup();
  join("a");
  session.handle("a", { type: "join" });
  session.handle("a", { type: "leave" });
  assert.equal(session.mode, "paint");
});

test("painting has a cooldown per phone and only allows known colours", () => {
  const { session, join, frames, advance } = setup({ paintCooldownMs: 1000 });
  join("a");
  session.handle("a", { type: "paint", cell: 0, color: "#123456" });
  assert.equal(frames.at(-1).windows[0], null);
  session.handle("a", { type: "paint", cell: 0, color: PAINT_COLORS[1] });
  session.handle("a", { type: "paint", cell: 1, color: PAINT_COLORS[1] });
  assert.equal(frames.at(-1).windows[0], PAINT_COLORS[1]);
  assert.equal(frames.at(-1).windows[1], null, "second paint is blocked by the cooldown");
  advance(1000);
  session.handle("a", { type: "paint", cell: 1, color: PAINT_COLORS[2] });
  assert.equal(frames.at(-1).windows[1], PAINT_COLORS[2]);
});

test("the facade display cannot join or play", () => {
  const { session, join, last } = setup();
  join("wall", "facade");
  session.handle("wall", { type: "join" });
  assert.equal(session.mode, "paint");
  assert.equal(last("wall").you.status, "facade");
});
