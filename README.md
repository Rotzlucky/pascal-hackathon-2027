# Rathaus Lichtspiel

A Lights Out puzzle played on the windows of the **Altes Rathaus in Grevenbroich**. Each of the 17 windows holds a coloured Zigbee lamp. Passers-by scan a QR code and play from their phone until the whole facade is lit. When nobody is playing, everyone can paint the windows together.

Built by a parent–child team for the hackathon **„Pascal lights up the city“** (Pascal-Gymnasium Grevenbroich, February 2027). The game's interface is in German.

**▶ Try the demo:** https://rotzlucky.github.io/pascal-hackathon-2027/ (runs entirely in the browser, no Raspberry Pi needed)

## How it works

```
Phone (browser)  ──WebSocket──▶  Raspberry Pi  ──MQTT──▶  zigbee2mqtt  ──Zigbee──▶  17 lamps
  player.html                    server/index.js                                    fenster_01 … fenster_17
                                 shared/session.js  (all game logic)
```

- **The Pi decides everything.** Phones only show the state they receive and send taps back. So the lamps and every screen always match, several phones can be connected (one plays, the others queue or watch), and nobody can cheat by changing the web page.
- **Turn-based.** Lamps react within about half a second, which is fine for a puzzle.
- **Same code everywhere.** `shared/` contains the game rules and the session (who plays, who waits, what the facade shows). It runs on the Pi under Node.js and in the browser for the demo.

### The facade

```
 Roof        01  02  03
 2nd floor   04  05  06  07  08
 1st floor   09  10  11  12  13
 Ground      14  15  [door]  16  17
```

The door is the status light: amber while a game runs, green when it is solved.

### Game rules

- Goal: all 17 windows lit. A tap switches a window **and its direct neighbours**.
- Every puzzle is solvable: it is made by starting from "all lit" and tapping backwards at random. Those taps are also the best score.
- Each level adds one more random tap. The active player can switch the rule (cross, diagonal, whole column).
- One person plays at a time; others join the queue. After 90 s without a tap the next person gets their turn.
- **Paint mode** when nobody plays: every phone may colour one window per minute. Colours only, no text.

## Three ways to run it

| | What you need | Lamps |
|---|---|---|
| **1. Browser demo** | Just a browser | Virtual facade on the same page |
| **2. Laptop demo** | Laptop with Node.js 20+, phones in the same Wi-Fi | Virtual facade on a laptop/projector, optionally a cardboard model with WLED |
| **3. Raspberry Pi** | Pi, Zigbee stick, lamps | The real windows |

### 1. Browser demo (no server)

Open the [online demo](https://rotzlucky.github.io/pascal-hackathon-2027/), or locally:

```bash
npm install
npm start
```

and open http://localhost:8080/demo. One page shows the facade and two phones. `client/demo.html` runs the same `Session` the Pi runs and connects the phone frames through a `BroadcastChannel` instead of a WebSocket.

### 2. Laptop demo with real phones

```bash
npm install
npm start
```

- Open http://localhost:8080/facade on the laptop or projector. It shows a QR code with the laptop's address in the local network.
- Phones in the same Wi-Fi scan it and play.
- `npm run dev` does the same, prints every lamp command to the terminal and restarts on code changes.
- Add `?log` to the facade URL to see the lamp commands on screen.

**Cardboard model:** an ESP32 running [WLED](https://kno.wled.ge/) with one LED per window can stand in for the lamps:

```bash
LAMPS=wled WLED_URL=http://192.168.1.50 npm start
```

The WLED adapter has not been tested on real hardware yet.

### 3. Raspberry Pi with Zigbee lamps

See [docs/raspberry-pi.md](docs/raspberry-pi.md).

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | HTTP and WebSocket port |
| `LAMPS` | `none` | `none` (virtual facade only), `console` (print commands), `mqtt` (zigbee2mqtt), `wled` (ESP32 model) |
| `MQTT_URL` | `mqtt://localhost:1883` | MQTT broker for `LAMPS=mqtt` |
| `Z2M_BASE_TOPIC` | `zigbee2mqtt` | zigbee2mqtt base topic |
| `DOOR_LAMP` | – | Optional lamp name for the door status light |
| `WLED_URL` | – | Address of the WLED controller for `LAMPS=wled` |
| `WLED_LED_MAP` | `0,1,…,16` | LED number for each window, comma separated |
| `PUBLIC_URL` | LAN address | Address in the QR code, e.g. the tunnel URL |
| `IDLE_SECONDS` | `90` | Turn ends after this long without a tap |
| `PAINT_COOLDOWN_SECONDS` | `60` | Wait time between two paint taps per phone |

## Project layout

```
shared/game.js        Game rules: facade, tap rules, puzzle generator (pure functions)
shared/session.js     Players, queue, paint mode, what the facade shows
shared/zigbee.js      Lamp commands in zigbee2mqtt format
server/index.js       Web server + WebSocket for the Pi or a laptop
server/lamps/         Lamp adapters: console, mqtt (Zigbee), wled (cardboard model)
client/player.html    Phone page
client/facade.html    Virtual facade with QR code
client/demo.html      Everything on one page, without a server
deploy/               systemd service for the Pi
```

## Messages

Phone → server: `{"type":"join"}`, `{"type":"leave"}`, `{"type":"tap","cell":7}`, `{"type":"new"}`, `{"type":"reset"}`, `{"type":"hint"}`, `{"type":"rule","rule":"plus"}`, `{"type":"paint","cell":7,"color":"#ff5a5f"}`

Server → phone: `state` (facade colours, mode, game, queue, the phone's own status), `hint` (a useful window), `timeout` (turn ended because of inactivity).

## Tests

```bash
npm test
```

## License

MIT
