// Cardboard model: an ESP32 running WLED with one addressable LED per window.
// Uses WLED's JSON API (POST /json/state) to set single LEDs.
//
// WLED_LED_MAP optionally maps windows to LED numbers, e.g. "0,1,2,3,…" (17 numbers).
// Without it, window 1 is LED 0, window 2 is LED 1, and so on.
//
// Not tested against real hardware yet.

import { changedWindows } from "../../shared/zigbee.js";

export class WledLamps {
  constructor({ url, ledMap }) {
    this.url = url.replace(/\/$/, "");
    this.ledMap = ledMap ? ledMap.split(",").map(Number) : null;
    this.description = `wled (${this.url})`;
    this.previous = null;
    this.pending = Promise.resolve();
  }

  show(frame) {
    const changes = changedWindows(this.previous, frame);
    this.previous = frame;
    if (!changes.length) return;
    const leds = changes.flatMap(({ id, color }) => [this.ledMap?.[id] ?? id, (color ?? "#000000").slice(1)]);
    const body = JSON.stringify({ on: true, seg: { id: 0, i: leds } });
    // Send one request after another so the ESP32 is not overwhelmed.
    this.pending = this.pending
      .then(() => fetch(`${this.url}/json/state`, { method: "POST", headers: { "content-type": "application/json" }, body }))
      .catch((err) => console.error("WLED nicht erreichbar:", err.message));
  }
}
