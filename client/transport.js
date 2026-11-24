// Connection to the game session.
//   - normally a WebSocket to the server (Raspberry Pi or laptop): /ws
//   - with ?demo in the URL a BroadcastChannel to the in-browser session in demo.html
// Both look the same to the pages: connect({ role, onMessage, onStatus }) -> { send }

const DEMO_CHANNEL = "rathaus-lichtspiel-demo";

export const isDemo = () => new URLSearchParams(location.search).has("demo");

export function connect({ role = "player", onMessage, onStatus = () => {} }) {
  return isDemo() ? connectDemo(role, onMessage, onStatus) : connectSocket(role, onMessage, onStatus);
}

function connectSocket(role, onMessage, onStatus) {
  let ws;
  const open = () => {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${scheme}://${location.host}/ws?role=${role}`);
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

function connectDemo(role, onMessage, onStatus) {
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
    channel.postMessage({ from: id, kind: "hello", role });
    setTimeout(hello, 400);
  };
  hello();
  addEventListener("pagehide", () => channel.postMessage({ from: id, kind: "bye" }));
  return { send: (msg) => channel.postMessage({ from: id, kind: "msg", msg }) };
}

// Used by demo.html: runs a Session and connects it to all demo pages.
export function hostDemo(session) {
  const channel = new BroadcastChannel(DEMO_CHANNEL);
  channel.onmessage = (e) => {
    const { from, kind, role, msg } = e.data ?? {};
    if (!from) return;
    if (kind === "hello" && !session.clients.has(from)) {
      session.addClient(from, (out) => channel.postMessage({ to: from, msg: out }), role);
    } else if (kind === "msg") {
      session.handle(from, msg);
    } else if (kind === "bye") {
      session.removeClient(from);
    }
  };
  setInterval(() => session.tick(), 250);
}
