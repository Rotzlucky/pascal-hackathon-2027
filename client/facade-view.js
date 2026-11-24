// Draws the Altes Rathaus facade as SVG and shows a frame from the session on it.
// Used by the phone page (small, tappable) and the virtual facade (big).

import { CELLS } from "./shared/game.js";

const NS = "http://www.w3.org/2000/svg";
const OFF = "#10162a";
const DOOR_OFF = "#4a3518";

// Drawing positions: column centres and window size per row (Dach, 2. OG, 1. OG, EG).
const COLS = [86, 178, 270, 362, 454];
const ROW_BOX = [
  { y: 88, w: 38, h: 34 },
  { y: 175, w: 54, h: 62 },
  { y: 258, w: 54, h: 76 },
  { y: 352, w: 54, h: 66 },
];

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

export function createFacade(container, { onTap } = {}) {
  const svg = el("svg", { viewBox: "0 0 540 470", class: "facade", role: "group", "aria-label": "Fassade des Alten Rathauses" }, container);
  const defs = el("defs", {}, svg);
  const glow = el("filter", { id: "glow", x: "-40%", y: "-40%", width: "180%", height: "180%" }, defs);
  el("feGaussianBlur", { stdDeviation: 5, result: "b" }, glow);
  const merge = el("feMerge", {}, glow);
  el("feMergeNode", { in: "b" }, merge);
  el("feMergeNode", { in: "SourceGraphic" }, merge);

  el("rect", { x: 0, y: 430, width: 540, height: 40, fill: "#262833" }, svg);
  el("polygon", { points: "46,150 494,150 442,50 98,50", fill: "#1a1c25" }, svg);
  for (const c of [1, 2, 3]) {
    el("rect", { x: COLS[c] - 31, y: 74, width: 62, height: 60, fill: "#5d5e6a" }, svg);
    el("rect", { x: COLS[c] - 35, y: 68, width: 70, height: 8, fill: "#2b2d38" }, svg);
  }
  el("rect", { x: 40, y: 150, width: 460, height: 280, fill: "#4b4c57" }, svg);
  el("rect", { x: 34, y: 146, width: 472, height: 9, fill: "#5d5e6a" }, svg);
  el("rect", { x: 226, y: 430, width: 88, height: 8, fill: "#3a3b45" }, svg);
  el("rect", { x: 216, y: 438, width: 108, height: 8, fill: "#3a3b45" }, svg);
  const door = el("path", { d: "M244 430 V372 A26 26 0 0 1 296 372 V430 Z", fill: DOOR_OFF, class: "door" }, svg);

  const windows = CELLS.map((cell) => {
    const box = ROW_BOX[cell.r];
    const x = COLS[cell.c] - box.w / 2;
    const { y, w, h } = box;
    const g = el("g", { class: "win", "aria-label": cell.label }, svg);
    if (onTap) {
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.addEventListener("click", () => onTap(cell.id));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap(cell.id);
        }
      });
    }
    el("rect", { class: "ring", x: x - 6, y: y - 6, width: w + 12, height: h + 12, rx: 4 }, g);
    const glass = el("rect", { class: "glass", x, y, width: w, height: h, rx: 2, fill: OFF }, g);
    el("path", { class: "bars", d: `M${x + w / 2} ${y} V${y + h} M${x} ${y + h * 0.42} H${x + w}` }, g);
    el("rect", { class: "frame", x, y, width: w, height: h, rx: 2 }, g);
    if (cell.r === 1 || cell.r === 2) el("rect", { x: x - 3, y: y + h + 2, width: w + 6, height: 7, rx: 2, fill: "#2c4a33" }, svg);
    return { g, glass };
  });

  return {
    show(frame) {
      frame.windows.forEach((color, id) => {
        windows[id].glass.setAttribute("fill", color ?? OFF);
        windows[id].g.classList.toggle("on", !!color);
      });
      door.setAttribute("fill", frame.door ?? DOOR_OFF);
      door.classList.toggle("on", !!frame.door);
    },
    highlight(id) {
      windows.forEach((w, i) => w.g.classList.toggle("hint", i === id));
    },
  };
}
