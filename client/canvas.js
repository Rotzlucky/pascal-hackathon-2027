// Phone page for the pixel canvas: pick a field, pick a colour, set the pixel.
// The server keeps the picture and the cooldown; this page only shows and asks.

import { connect } from "./transport.js";
import { renderTabs } from "./nav.js";

const $ = (id) => document.getElementById(id);
const board = $("board");
const ctx = board.getContext("2d");
const OFF = "#161d33";

let size = 32;
let pixels = [];
let selected = null; // index of the chosen field
let color = null; // chosen colour, null = off
let readyAt = 0; // performance.now() when this phone may paint again
let connected = false;

renderTabs($("tabs"), "canvas.html");

const conn = connect({
  room: "canvas",
  onMessage(msg) {
    if (msg.type === "canvas") {
      size = msg.size;
      pixels = msg.pixels.slice();
      if (!$("palette").children.length) buildPalette(msg.colors);
      $("painters").textContent = paintersText(msg.painters);
    } else if (msg.type === "pixel") {
      pixels[msg.cell] = msg.color;
    } else if (msg.type === "you") {
      readyAt = performance.now() + msg.paintReadyIn;
    } else if (msg.type === "painters") {
      $("painters").textContent = paintersText(msg.count);
    }
    render();
  },
  onStatus(status) {
    connected = status === "online";
    $("connection").textContent = connected ? "verbunden" : "keine Verbindung";
    $("connection").classList.toggle("online", connected);
    render();
  },
});

const paintersText = (n) => (n === 1 ? "Gerade malt nur du." : `Gerade malen ${n} Handys mit.`);

function buildPalette(colors) {
  [...colors, null].forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (c ? "" : " off");
    b.style.background = c ?? "";
    b.textContent = c ? "" : "Aus";
    b.dataset.color = String(c);
    b.setAttribute("aria-label", c ? `Farbe ${i + 1}` : "Pixel ausschalten");
    b.onclick = () => {
      color = c;
      render();
    };
    $("palette").appendChild(b);
  });
  color = colors[0];
}

// Tap on the board selects a field.
board.addEventListener("click", (e) => {
  const rect = board.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * size);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * size);
  if (x >= 0 && y >= 0 && x < size && y < size) {
    selected = y * size + x;
    render();
  }
});

$("btn-paint").onclick = () => {
  if (selected === null || performance.now() < readyAt) return;
  conn.send({ type: "paint", cell: selected, color });
  readyAt = performance.now() + 1000; // until the server answers with the real wait time
  render();
};

function fitCanvas() {
  const px = Math.round(board.clientWidth * (window.devicePixelRatio || 1));
  if (px && board.width !== px) board.width = board.height = px;
}

function draw() {
  fitCanvas();
  const W = board.width;
  const cell = W / size;
  const gap = Math.max(1, Math.round(cell * 0.08));
  ctx.fillStyle = "#0b1122";
  ctx.fillRect(0, 0, W, W);
  pixels.forEach((c, i) => {
    const x = (i % size) * cell;
    const y = Math.floor(i / size) * cell;
    ctx.fillStyle = c ?? OFF;
    ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
  });
  if (selected !== null) {
    const x = (selected % size) * cell;
    const y = Math.floor(selected / size) * cell;
    ctx.fillStyle = color ?? OFF;
    ctx.fillRect(x, y, cell, cell);
    ctx.lineWidth = Math.max(2, cell * 0.15);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, cell - ctx.lineWidth, cell - ctx.lineWidth);
  }
}

function render() {
  draw();
  document.querySelectorAll("#palette button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === String(color))));
  const wait = Math.ceil((readyAt - performance.now()) / 1000);
  let text;
  if (!connected) text = "Keine Verbindung zur Leinwand.";
  else if (wait > 0) text = `Danke! Du kannst in ${wait} s wieder malen.`;
  else if (selected === null) text = "Tippe auf ein Feld, wähle eine Farbe und setze dein Pixel.";
  else text = `Feld ${(selected % size) + 1}/${Math.floor(selected / size) + 1} ausgewählt. Farbe wählen, dann „Pixel setzen“.`;
  $("status").textContent = text;
  $("btn-paint").disabled = !connected || selected === null || wait > 0;
}

setInterval(() => readyAt > performance.now() - 1000 && render(), 500);
addEventListener("resize", draw);
