// The game session: who is playing, who is waiting, what the facade shows.
// It has no network or timer code of its own, so the same class runs
//   - on the Raspberry Pi (server/index.js, connected via WebSocket), and
//   - in the browser for the demo (client/demo.html, connected via BroadcastChannel).
//
// A host calls addClient / removeClient / handle for messages and tick() a few times per second.

import { CELLS, RULES, applyTap, createPuzzle, isSolved } from "./game.js";

export const COLORS = {
  lit: "#ffcf6e",
  doorPlaying: "#b07a35",
  doorWon: "#4fd68f",
};

export const PAINT_COLORS = ["#ffcf6e", "#ff5a5f", "#4fd68f", "#4d8dff", "#b06bff", "#ffffff"];

// Colours for the victory effect, one per facade column.
const RAINBOW = ["#ff5a5f", "#ffa14a", "#ffe14d", "#4fd68f", "#4d8dff"];

export class Session {
  constructor({
    lamps = null, // { show(frame) } – real or virtual lamps, optional
    now = () => Date.now(),
    random = Math.random,
    idleMs = 90_000, // active player is dropped after this long without a tap
    paintCooldownMs = 60_000, // each phone may paint one window per minute
    celebrateMs = 3_000,
  } = {}) {
    Object.assign(this, { lamps, now, random, idleMs, paintCooldownMs, celebrateMs });
    this.clients = new Map(); // id -> { send, role, lastSent, paintReadyAt }
    this.queue = []; // player ids; queue[0] is the active player
    this.game = null; // the active player's game, null in paint mode
    this.paint = CELLS.map(() => null);
    this.lastFrame = "";
    this.update();
  }

  get mode() {
    return this.game ? "puzzle" : "paint";
  }

  get activeId() {
    return this.queue[0] ?? null;
  }

  // ---- connections ----

  addClient(id, send, role = "player") {
    this.clients.set(id, { send, role, lastSent: "", paintReadyAt: 0 });
    this.update();
  }

  removeClient(id) {
    this.clients.delete(id);
    this.leaveQueue(id);
    this.update();
  }

  handle(id, msg) {
    const client = this.clients.get(id);
    if (!client || !msg || typeof msg.type !== "string") return;
    const isActive = id === this.activeId && this.game;

    switch (msg.type) {
      case "join":
        if (client.role === "player" && !this.queue.includes(id)) {
          this.queue.push(id);
          if (this.queue.length === 1) this.startGame();
        }
        break;
      case "leave":
        this.leaveQueue(id);
        break;
      case "tap":
        if (isActive) this.tap(msg.cell);
        break;
      case "new":
        if (isActive) {
          if (this.game.won) this.game.level++;
          this.newPuzzle();
        }
        break;
      case "reset":
        if (isActive) this.resetPuzzle();
        break;
      case "rule":
        if (isActive && RULES[msg.rule]) {
          this.game.rule = msg.rule;
          this.newPuzzle();
        }
        break;
      case "hint":
        if (isActive && !this.game.won) {
          const options = [...this.game.solution];
          const cell = options[Math.floor(this.random() * options.length)];
          this.game.lastActivity = this.now();
          client.send({ type: "hint", cell });
        }
        break;
      case "paint":
        this.paintCell(client, msg.cell, msg.color);
        break;
    }
    this.update();
  }

  tick() {
    if (this.game && this.now() - this.game.lastActivity > this.idleMs) {
      const id = this.activeId;
      this.clients.get(id)?.send({ type: "timeout" });
      this.leaveQueue(id);
    }
    this.update();
  }

  // ---- game ----

  startGame() {
    this.game = { level: 1, rule: "plus", lastActivity: this.now() };
    this.newPuzzle();
  }

  newPuzzle() {
    const { on, solution, best } = createPuzzle(this.game.level, this.game.rule, this.random);
    Object.assign(this.game, {
      on,
      solution,
      best,
      start: { on, solution: new Set(solution) },
      moves: 0,
      won: false,
      celebrateUntil: 0,
      lastActivity: this.now(),
    });
  }

  resetPuzzle() {
    const { start } = this.game;
    Object.assign(this.game, {
      on: start.on.slice(),
      solution: new Set(start.solution),
      moves: 0,
      won: false,
      lastActivity: this.now(),
    });
  }

  tap(cell) {
    const g = this.game;
    if (g.won || !Number.isInteger(cell) || !CELLS[cell]) return;
    g.on = applyTap(g.on, cell, g.rule);
    g.solution.has(cell) ? g.solution.delete(cell) : g.solution.add(cell);
    g.moves++;
    g.lastActivity = this.now();
    if (isSolved(g.on)) {
      g.won = true;
      g.celebrateUntil = this.now() + this.celebrateMs;
    }
  }

  leaveQueue(id) {
    const wasActive = id === this.activeId;
    this.queue = this.queue.filter((q) => q !== id);
    if (wasActive) {
      this.game = null;
      if (this.queue.length) this.startGame();
    }
  }

  paintCell(client, cell, color) {
    if (this.game || !CELLS[cell]) return;
    if (color !== null && !PAINT_COLORS.includes(color)) return;
    if (this.now() < client.paintReadyAt) return;
    this.paint[cell] = color;
    client.paintReadyAt = this.now() + this.paintCooldownMs;
  }

  // ---- output ----

  // What the facade shows right now: 17 window colours (null = off) and the door.
  frame() {
    const g = this.game;
    if (!g) return { windows: this.paint.slice(), door: null };
    const celebrating = g.won && this.now() < g.celebrateUntil;
    return {
      windows: CELLS.map((cell) => (celebrating ? RAINBOW[cell.c] : g.on[cell.id] ? COLORS.lit : null)),
      door: g.won ? COLORS.doorWon : COLORS.doorPlaying,
    };
  }

  stateFor(id, client, frame) {
    const g = this.game;
    const position = this.queue.indexOf(id);
    let status = "watching";
    if (client.role === "facade") status = "facade";
    else if (position === 0) status = "active";
    else if (position > 0) status = "waiting";
    return {
      type: "state",
      mode: this.mode,
      ...frame,
      waiting: Math.max(0, this.queue.length - 1),
      game: g ? { level: g.level, moves: g.moves, best: g.best, won: g.won, rule: g.rule } : null,
      you: {
        status,
        position, // 0 = playing, 1 = next, …, -1 = not in line
        paintReadyIn: Math.max(0, client.paintReadyAt - this.now()),
      },
    };
  }

  update() {
    const frame = this.frame();
    const frameKey = JSON.stringify(frame);
    if (frameKey !== this.lastFrame) {
      this.lastFrame = frameKey;
      this.lamps?.show(frame);
    }
    for (const [id, client] of this.clients) {
      const state = this.stateFor(id, client, frame);
      // Round the cooldown so the state only changes once per second.
      const key = JSON.stringify({ ...state, you: { ...state.you, paintReadyIn: Math.ceil(state.you.paintReadyIn / 1000) } });
      if (key !== client.lastSent) {
        client.lastSent = key;
        client.send(state);
      }
    }
  }
}
