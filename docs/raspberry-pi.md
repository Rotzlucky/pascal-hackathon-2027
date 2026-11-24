# Running on the Raspberry Pi

Target setup: Raspberry Pi 5 (a Pi 4 works too) with Raspberry Pi OS Lite (64-bit), a Zigbee USB stick, Mosquitto, zigbee2mqtt and this server.

## 1. Basics

- Flash Raspberry Pi OS Lite with the Raspberry Pi Imager. Set user, Wi-Fi and SSH there.
- Plug the Zigbee stick in through a short USB extension cable, away from the USB 3 ports (they disturb 2.4 GHz radio).
- Install Node.js 20 or newer (for example from [NodeSource](https://github.com/nodesource/distributions)) and Git.

## 2. MQTT broker and zigbee2mqtt

```bash
sudo apt install -y mosquitto
```

Install zigbee2mqtt by following the official guide: https://www.zigbee2mqtt.io/guide/installation/01_linux.html

Then pair the lamps one by one and **rename them** in the zigbee2mqtt frontend to `fenster_01` … `fenster_17`, numbered from the top left dormer to the bottom right window:

```
 Roof        01  02  03
 2nd floor   04  05  06  07  08
 1st floor   09  10  11  12  13
 Ground      14  15  [door]  16  17
```

Put a sticker with the number on each lamp. Mains-powered Zigbee plugs placed between the floors strengthen the mesh.

Quick check that a lamp reacts:

```bash
mosquitto_pub -t zigbee2mqtt/fenster_01/set -m '{"state":"ON","color":{"hex":"#ffcf6e"}}'
```

## 3. The game server

```bash
git clone https://github.com/Rotzlucky/pascal-hackathon-2027.git
cd pascal-hackathon-2027
npm ci --omit=dev
LAMPS=mqtt npm start
```

Open `http://<pi-address>:8080/facade` on another device in the same network to see the virtual facade and the QR code.

### Start automatically

`deploy/rathaus-lichtspiel.service` starts the server on boot and restarts it after a crash. Adjust the user and path in the file, then:

```bash
sudo cp deploy/rathaus-lichtspiel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rathaus-lichtspiel
journalctl -u rathaus-lichtspiel -f   # watch the log
```

## 4. Reaching the Pi from phones on the market square

Phones on the square use mobile data, so the Pi has to be reachable from the internet. A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) does that without opening ports in the building's network: the Pi connects outwards, and the tunnel forwards visitors to it.

- **For testing:** `cloudflared tunnel --url http://localhost:8080` prints a temporary `https://….trycloudflare.com` address. It changes on every restart, so it is not suitable for a printed QR code.
- **For the exhibition:** set up a named tunnel with a fixed address (this needs a domain managed in Cloudflare) and run it as a service as described in the Cloudflare docs.

Put the fixed address into the service file as `PUBLIC_URL`, so the QR code on `/facade` shows it. Print the same QR code for the sign on the square.

The Pi needs internet access for this: the building's guest Wi-Fi or an LTE router.

## 5. While the exhibition runs

- `http://<pi-address>:8080/health` shows whether the server runs and how many phones are connected.
- After a power cut the Pi boots, zigbee2mqtt and the game start by themselves, and the lamps get their colours again.
- Keep the lamps permanently powered. Zigbee lamps behind a timer switch drop out of the network.
