// Virtual LED panels for the shop window: draws the canvas as 128 × 128 LED dots
// (8 panels of 64 × 32, one canvas pixel = 4 × 4 LEDs). Stands in for the real panels.

import { LEDS_PER_PIXEL } from "./shared/canvas.js";
import { connect, isDemo } from "./transport.js";

const $ = (id) => document.getElementById(id);
const leds = $("leds");
const ctx = leds.getContext("2d");
const PANEL = { w: 64, h: 32 };
const LED_OFF = "#14161d";

let size = 32;
let pixels = [];

const conn = connect({
  room: "canvas",
  role: "display",
  onMessage(msg) {
    if (msg.type === "canvas") {
      size = msg.size;
      pixels = msg.pixels.slice();
      drawAll();
      $("painters").textContent = paintersText(msg.painters);
    } else if (msg.type === "pixel") {
      pixels[msg.cell] = msg.color;
      drawPixel(msg.cell);
    } else if (msg.type === "painters") {
      $("painters").textContent = paintersText(msg.count);
    }
  },
  onStatus(status) {
    $("connection").textContent = status === "online" ? "verbunden" : "keine Verbindung";
    $("connection").classList.toggle("online", status === "online");
  },
});
void conn;

const paintersText = (n) => (n ? `${n} ${n === 1 ? "Handy malt" : "Handys malen"} gerade mit` : "Gerade malt niemand mit");

function ledSize() {
  return leds.width / (size * LEDS_PER_PIXEL);
}

function drawPixel(i) {
  const s = ledSize();
  const n = LEDS_PER_PIXEL;
  const px = (i % size) * n;
  const py = Math.floor(i / size) * n;
  for (let dy = 0; dy < n; dy++) {
    for (let dx = 0; dx < n; dx++) {
      const x = (px + dx) * s;
      const y = (py + dy) * s;
      ctx.fillStyle = "#050608";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = pixels[i] ?? LED_OFF;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawSeams();
}

// Thin lines where two LED panels meet.
function drawSeams() {
  const s = ledSize();
  const total = size * LEDS_PER_PIXEL;
  ctx.fillStyle = "#23262f"; // opaque, so repainting does not make the lines brighter
  for (let x = PANEL.w; x < total; x += PANEL.w) ctx.fillRect(x * s - 0.5, 0, 1, leds.height);
  for (let y = PANEL.h; y < total; y += PANEL.h) ctx.fillRect(0, y * s - 0.5, leds.width, 1);
}

function drawAll() {
  ctx.fillStyle = "#050608";
  ctx.fillRect(0, 0, leds.width, leds.height);
  pixels.forEach((_, i) => drawPixel(i));
}

// QR code to the phone page (not in the demo: there the phones are on the same page).
if (!isDemo()) showJoinCode();

async function showJoinCode() {
  let url = new URL("canvas", location.href).href;
  try {
    url = (await (await fetch("info")).json()).canvasUrl ?? url;
  } catch {
    // keep the page's own address
  }
  $("join").hidden = false;
  $("url").textContent = url;
  if (window.qrcode) {
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    $("qr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  } else {
    $("qr").hidden = true;
  }
}
