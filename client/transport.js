// Connection to the game session.
//   - normally a WebSocket to the server (Raspberry Pi or laptop): /ws
//   - with ?demo in the URL a BroadcastChannel to the in-browser session in demo.html
// Both look the same to the pages: connect({ room, role, onMessage, onStatus }) -> { send }
// room: "rathaus" (the window puzzle) or "canvas" (the pixel canvas).

const DEMO_CHANNEL = "rathaus-lichtspiel-demo";

export const isDemo = () => new URLSearchParams(location.search).has("demo");

export function connect({ room = "rathaus", role = "player", onMessage, onStatus = () => {} }) {
  return isDemo() ? connectDemo(room, role, onMessage, onStatus) : connectSocket(room, role, onMessage, onStatus);
}

function connectSocket(room, role, onMessage, onStatus) {
  let ws;
  const open = () => {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${scheme}://${location.host}/ws?room=${room}&role=${role}`);
    ws.onopen = () => onStatus("online");
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      onStatus("offline");
      setTimeout(open, 2000);
    };
  };
  open();
  return { send: (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg)) };
}

function connectDemo(room, role, onMessage, onStatus) {
  const id = crypto.randomUUID();
  const channel = new BroadcastChannel(DEMO_CHANNEL);
  let connected = false;
  channel.onmessage = (e) => {
    if (e.data?.to !== id) return;
    if (!connected) {
      connected = true;
      onStatus("online");
    }
    onMessage(e.data.msg);
  };
  // The hub may load after this page, so say hello until it answers.
  const hello = () => {
    if (connected) return;
    channel.postMessage({ from: id, kind: "hello", room, role });
    setTimeout(hello, 400);
  };
  hello();
  addEventListener("pagehide", () => channel.postMessage({ from: id, kind: "bye" }));
  return { send: (msg) => channel.postMessage({ from: id, kind: "msg", msg }) };
}

// Used by demo.html: runs the sessions ({ rathaus, canvas }) and connects them to all demo pages.
export function hostDemo(rooms) {
  const channel = new BroadcastChannel(DEMO_CHANNEL);
  const clientRoom = new Map(); // client id -> session
  channel.onmessage = (e) => {
    const { from, kind, room, role, msg } = e.data ?? {};
    if (!from) return;
    if (kind === "hello" && !clientRoom.has(from)) {
      const session = rooms[room] ?? rooms.rathaus;
      clientRoom.set(from, session);
      session.addClient(from, (out) => channel.postMessage({ to: from, msg: out }), role);
    } else if (kind === "msg") {
      clientRoom.get(from)?.handle(from, msg);
    } else if (kind === "bye") {
      clientRoom.get(from)?.removeClient(from);
      clientRoom.delete(from);
    }
  };
  setInterval(() => Object.values(rooms).forEach((s) => s.tick()), 250);
}
