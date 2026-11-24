// Virtual facade: shows exactly what the real lamps show.
// Use it on a laptop or projector when there are no lamps, or to watch the Pi remotely.
// URL options: ?log shows the lamp commands, ?demo connects to the browser demo.

import { changedWindows, payloadFor, topicFor } from "./shared/zigbee.js";
import { createFacade } from "./facade-view.js";
import { connect, isDemo } from "./transport.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const facade = createFacade($("facade"));
let previous = null;
const log = [];

// QR code to the phone page (not in the demo: there the phones are on the same page).
if (!isDemo()) showJoinCode();

async function showJoinCode() {
  let url = new URL(".", location.href).href;
  try {
    url = (await (await fetch("info")).json()).joinUrl;
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
    $("qr").hidden = true; // offline: the URL text is still there
  }
}

$("log-box").hidden = !params.has("log");

connect({
  role: "facade",
  onMessage(msg) {
    if (msg.type !== "state") return;
    facade.show(msg);
    $("mode").textContent = msg.mode === "puzzle"
      ? msg.game.won ? "Gelöst! 🎉" : `Rätsel läuft · Level ${msg.game.level} · ${msg.game.moves} Tipps`
      : "Malmodus: Jeder darf ein Fenster einfärben";
    $("queue").textContent = msg.waiting ? `${msg.waiting} warten auf ihre Runde` : "";
    if (params.has("log") && previous) {
      for (const { id, color } of changedWindows(previous, msg)) {
        log.unshift(`${topicFor(id)} ${JSON.stringify(payloadFor(color))}`);
      }
      log.length = Math.min(log.length, 12);
      $("log").replaceChildren(...log.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
    }
    previous = msg;
  },
  onStatus(status) {
    $("connection").textContent = status === "online" ? "verbunden" : "keine Verbindung";
    $("connection").classList.toggle("online", status === "online");
  },
});
