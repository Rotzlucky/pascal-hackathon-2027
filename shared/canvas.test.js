import { test } from "node:test";
import assert from "node:assert/strict";
import { CanvasSession, CANVAS_COLORS } from "./canvas.js";

function setup(options = {}) {
  let time = 0;
  const changes = [];
  const canvas = new CanvasSession({ now: () => time, cooldownMs: 1000, onChange: (p) => changes.push(p.slice()), ...options });
  const inbox = {};
  const join = (id, role = "player") => {
    inbox[id] = [];
    canvas.addClient(id, (msg) => inbox[id].push(msg), role);
  };
  return { canvas, inbox, join, changes, advance: (ms) => (time += ms) };
}

test("a new phone gets the whole picture", () => {
  const { join, inbox } = setup();
  join("a");
  const first = inbox.a[0];
  assert.equal(first.type, "canvas");
  assert.equal(first.pixels.length, 32 * 32);
  assert.deepEqual(first.colors, CANVAS_COLORS);
});

test("painting a pixel reaches every phone and the display", () => {
  const { canvas, join, inbox, changes } = setup();
  join("a");
  join("panel", "display");
  canvas.handle("a", { type: "paint", cell: 5, color: CANVAS_COLORS[2] });
  assert.equal(canvas.pixels[5], CANVAS_COLORS[2]);
  assert.ok(inbox.panel.some((m) => m.type === "pixel" && m.cell === 5));
  assert.equal(changes.length, 1);
});

test("each phone has to wait for the cooldown", () => {
  const { canvas, join, inbox, advance } = setup();
  join("a");
  canvas.handle("a", { type: "paint", cell: 1, color: CANVAS_COLORS[0] });
  canvas.handle("a", { type: "paint", cell: 2, color: CANVAS_COLORS[0] });
  assert.equal(canvas.pixels[2], null);
  assert.equal(inbox.a.at(-1).paintReadyIn, 1000);
  advance(1000);
  canvas.handle("a", { type: "paint", cell: 2, color: CANVAS_COLORS[0] });
  assert.equal(canvas.pixels[2], CANVAS_COLORS[0]);
});

test("unknown colours, cells outside the canvas and the display itself are refused", () => {
  const { canvas, join } = setup();
  join("a");
  join("panel", "display");
  canvas.handle("a", { type: "paint", cell: 3, color: "#123456" });
  canvas.handle("a", { type: "paint", cell: 5000, color: CANVAS_COLORS[0] });
  canvas.handle("panel", { type: "paint", cell: 3, color: CANVAS_COLORS[0] });
  assert.deepEqual(canvas.pixels, Array(32 * 32).fill(null));
});

test("a saved picture is loaded again, invalid entries become off", () => {
  const saved = Array(32 * 32).fill(null);
  saved[0] = CANVAS_COLORS[4];
  saved[1] = "<script>";
  const { canvas } = setup({ pixels: saved });
  assert.equal(canvas.pixels[0], CANVAS_COLORS[4]);
  assert.equal(canvas.pixels[1], null);
});

test("the start picture fits the canvas and uses only canvas colours", async () => {
  const { starterPicture, SPRITES } = await import("./canvas-start.js");
  for (const [name, rows] of Object.entries(SPRITES)) {
    assert.ok(rows.every((r) => r.length === rows[0].length), `${name}: all rows same width`);
  }
  const pixels = starterPicture();
  assert.equal(pixels.length, 32 * 32);
  assert.ok(pixels.every((c) => c === null || CANVAS_COLORS.includes(c)));
  assert.ok(pixels.filter(Boolean).length > 200, "the picture is not empty");
});
