// Pixel canvas ("Pixel-Leinwand") for a shop window: a 32×32 picture the town paints together.
// Every phone may set one pixel, then waits for the cooldown.
//
// Same host interface as Session (addClient / removeClient / handle / tick), so the server
// and the browser demo can run it the same way.
//
// Hardware idea: 8 LED panels of 64×32 (P4), 2 wide and 4 high = 128×128 LEDs, about 51 × 51 cm.
// One canvas pixel = 4×4 LEDs.

export const CANVAS_SIZE = 32;
export const LEDS_PER_PIXEL = 4;

// 15 colours plus "off" (null). Chosen to look good on LEDs: no dark tones, since dark = off.
export const CANVAS_COLORS = [
  "#ffffff", "#a0a0a0", "#e8262b", "#ff8a1f", "#ffd51f",
  "#8ee04a", "#1f9e3a", "#1fb5a8", "#5cc8ff", "#2856e0",
  "#7b3fd1", "#ff6fae", "#8a4b23", "#f2b48a", "#505050",
];

export class CanvasSession {
  constructor({
    size = CANVAS_SIZE,
    now = () => Date.now(),
    cooldownMs = 30_000, // each phone may set one pixel per 30 s
    pixels = null, // saved picture to continue from
    onChange = null, // called with the pixel array after every change (saving, LED output)
  } = {}) {
    Object.assign(this, { size, now, cooldownMs, onChange });
    const count = size * size;
    this.pixels = Array.isArray(pixels) && pixels.length === count ? pixels.map((c) => (CANVAS_COLORS.includes(c) ? c : null)) : Array(count).fill(null);
    this.clients = new Map(); // id -> { send, role, readyAt }
  }

  get painters() {
    return [...this.clients.values()].filter((c) => c.role === "player").length;
  }

  addClient(id, send, role = "player") {
    this.clients.set(id, { send, role, readyAt: 0 });
    send({
      type: "canvas",
      size: this.size,
      colors: CANVAS_COLORS,
      pixels: this.pixels,
      painters: this.painters,
      you: { role, paintReadyIn: 0 },
    });
    this.broadcast({ type: "painters", count: this.painters });
  }

  removeClient(id) {
    if (this.clients.delete(id)) this.broadcast({ type: "painters", count: this.painters });
  }

  handle(id, msg) {
    const client = this.clients.get(id);
    if (!client || msg?.type !== "paint") return;
    const { cell, color } = msg;
    const valid =
      client.role === "player" &&
      Number.isInteger(cell) && cell >= 0 && cell < this.pixels.length &&
      (color === null || CANVAS_COLORS.includes(color));
    if (valid && this.now() >= client.readyAt) {
      this.pixels[cell] = color;
      client.readyAt = this.now() + this.cooldownMs;
      this.broadcast({ type: "pixel", cell, color });
      this.onChange?.(this.pixels);
    }
    // Always tell the phone when it may paint again, also after a refused paint.
    client.send({ type: "you", paintReadyIn: Math.max(0, client.readyAt - this.now()) });
  }

  tick() {}

  broadcast(msg) {
    for (const { send } of this.clients.values()) send(msg);
  }
}
