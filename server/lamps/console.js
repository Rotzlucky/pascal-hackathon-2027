// Prints the MQTT messages that would go to zigbee2mqtt, without sending anything.
// Handy for testing on a laptop without lamps.

import { changedWindows, payloadFor, topicFor } from "../../shared/zigbee.js";

export class ConsoleLamps {
  description = "console (zeigt die Zigbee-Befehle im Terminal)";
  previous = null;

  show(frame) {
    for (const { id, color } of changedWindows(this.previous, frame)) {
      console.log(`${topicFor(id)} ${JSON.stringify(payloadFor(color))}`);
    }
    this.previous = frame;
  }
}
