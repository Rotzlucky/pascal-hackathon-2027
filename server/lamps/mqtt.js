// Real lamps: publishes to zigbee2mqtt via an MQTT broker (Mosquitto on the Pi).
// Lamps must be named fenster_01 … fenster_17 in zigbee2mqtt (top left to bottom right).

import mqtt from "mqtt";
import { changedWindows, payloadFor, topicFor } from "../../shared/zigbee.js";

export class MqttLamps {
  constructor({ url, baseTopic, doorLamp }) {
    this.baseTopic = baseTopic;
    this.doorLamp = doorLamp;
    this.description = `mqtt (${url}, Topic ${baseTopic}/fenster_XX/set)`;
    this.previous = null;
    this.latest = null;
    this.client = mqtt.connect(url, { reconnectPeriod: 2000 });
    this.client.on("connect", () => {
      console.log("MQTT verbunden");
      // After a (re)connect, send the full picture again.
      this.previous = null;
      if (this.latest) this.show(this.latest);
    });
    this.client.on("error", (err) => console.error("MQTT-Fehler:", err.message));
  }

  show(frame) {
    this.latest = frame;
    if (!this.client.connected) return; // sent again on connect
    for (const { id, color } of changedWindows(this.previous, frame)) {
      this.client.publish(topicFor(id, this.baseTopic), JSON.stringify(payloadFor(color)));
    }
    if (this.doorLamp && this.previous?.door !== frame.door) {
      this.client.publish(`${this.baseTopic}/${this.doorLamp}/set`, JSON.stringify(payloadFor(frame.door)));
    }
    this.previous = frame;
  }
}
