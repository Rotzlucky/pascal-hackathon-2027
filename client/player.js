// Phone page. It does not know the game rules: it shows what the server sends
// and sends taps back. The server (or the demo session) decides everything.

import { CELLS } from "./shared/game.js";
import { PAINT_COLORS } from "./shared/session.js";
import { createFacade } from "./facade-view.js";
import { connect } from "./transport.js";
import { renderTabs } from "./nav.js";

const $ = (id) => document.getElementById(id);
let state = null;
let hint = null;
let notice = null;
let paintColor = PAINT_COLORS[0];
let paintReadyAt = 0;

renderTabs($("tabs"), "player.html");
const facade = createFacade($("facade"), { onTap });
const conn = connect({
  role: "player",
  onMessage(msg) {
    if (msg.type === "state") {
      state = msg;
      paintReadyAt = performance.now() + msg.you.paintReadyIn;
      if (msg.you.status !== "active") hint = null;
    } else if (msg.type === "hint") {
      hint = msg.cell;
    } else if (msg.type === "timeout") {
      notice = "Du hast eine Weile nichts getippt, deshalb ist jetzt jemand anderes dran.";
    }
    render();
  },
  onStatus(status) {
    $("connection").textContent = status === "online" ? "verbunden" : "keine Verbindung";
    $("connection").classList.toggle("online", status === "online");
  },
});

function onTap(cell) {
  if (!state) return;
  if (state.you.status === "active") {
    hint = null;
    conn.send({ type: "tap", cell });
  } else if (state.mode === "paint" && performance.now() >= paintReadyAt) {
    conn.send({ type: "paint", cell, color: paintColor });
  }
}

$("btn-join").onclick = () => {
  notice = null;
  conn.send({ type: "join" });
};
$("btn-leave").onclick = () => conn.send({ type: "leave" });
$("btn-new").onclick = () => conn.send({ type: "new" });
$("btn-reset").onclick = () => conn.send({ type: "reset" });
$("btn-hint").onclick = () => conn.send({ type: "hint" });
document.querySelectorAll("#rules button").forEach((b) => (b.onclick = () => conn.send({ type: "rule", rule: b.dataset.rule })));

[...PAINT_COLORS, null].forEach((color) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch" + (color ? "" : " off");
  b.style.background = color ?? "";
  b.textContent = color ? "" : "Aus";
  b.setAttribute("aria-label", color ? `Farbe ${color}` : "Fenster ausschalten");
  b.onclick = () => {
    paintColor = color;
    render();
  };
  b.dataset.color = String(color);
  $("palette").appendChild(b);
});

// "Zug" = one tap on a window. "Tipp" is only used for hints.
const moves = (n) => `${n} ${n === 1 ? "Zug" : "Zügen"}`;

function statusText() {
  const { you, mode, game, waiting } = state;
  if (you.status === "active") {
    if (game.won) {
      return game.moves <= game.best
        ? `Geschafft in ${moves(game.moves)}, das ist der Bestwert!`
        : `Geschafft in ${moves(game.moves)}. Es geht auch in ${moves(game.best)}.`;
    }
    const lit = state.windows.filter(Boolean).length;
    return `Du bist dran! ${lit} von ${CELLS.length} Fenstern leuchten.`;
  }
  if (you.status === "waiting") {
    return you.position === 1 ? "Du bist als Nächstes dran." : `Du bist Platz ${you.position} in der Schlange.`;
  }
  if (notice) return notice;
  if (mode === "puzzle") {
    return waiting ? `Gerade spielt jemand, ${waiting} warten. Schau zur Fassade!` : "Gerade spielt jemand. Schau zur Fassade!";
  }
  return "Niemand spielt gerade. Starte ein Rätsel oder male ein Fenster an.";
}

function render() {
  if (!state) return;
  const { you, mode, game } = state;
  const active = you.status === "active";
  facade.show(state);
  facade.highlight(hint);

  $("status").textContent = statusText();
  $("status").classList.toggle("won", active && game.won);

  $("game").hidden = !active;
  $("game-buttons").hidden = !active;
  $("rules").hidden = !active;
  if (active) {
    $("level").textContent = game.level;
    $("moves").textContent = game.moves;
    $("best").textContent = game.best;
    $("btn-new").textContent = game.won ? "Nächstes Level" : "Neues Rätsel";
    $("btn-reset").disabled = $("btn-hint").disabled = game.won;
    document.querySelectorAll("#rules button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.rule === game.rule)));
  }

  const canPaint = mode === "paint" && you.status === "watching";
  $("paint").hidden = !canPaint;
  if (canPaint) {
    const wait = Math.ceil((paintReadyAt - performance.now()) / 1000);
    $("paint-hint").textContent = wait > 0 ? `Du kannst in ${wait} s wieder malen.` : "Farbe wählen, dann auf ein Fenster tippen.";
    document.querySelectorAll("#palette button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === String(paintColor))));
  }

  $("btn-join").hidden = you.status !== "watching";
  $("btn-leave").hidden = !(active || you.status === "waiting");
}

// Keep the paint countdown ticking.
setInterval(() => state?.mode === "paint" && render(), 1000);
