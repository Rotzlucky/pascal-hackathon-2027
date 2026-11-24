// Lamp adapters. Each one has show(frame), where frame = { windows: [17 × "#rrggbb" | null], door }.
// Pick one with the LAMPS environment variable.

import { ConsoleLamps } from "./console.js";
import { MqttLamps } from "./mqtt.js";
import { WledLamps } from "./wled.js";

export function createLamps(env) {
  switch (env.LAMPS ?? "none") {
    case "none":
      return { description: "keine (nur virtuelle Fassade unter /facade)", show() {} };
    case "console":
      return new ConsoleLamps();
    case "mqtt":
      return new MqttLamps({
        url: env.MQTT_URL ?? "mqtt://localhost:1883",
        baseTopic: env.Z2M_BASE_TOPIC ?? "zigbee2mqtt",
        doorLamp: env.DOOR_LAMP || null,
      });
    case "wled":
      if (!env.WLED_URL) throw new Error("LAMPS=wled braucht WLED_URL, z. B. http://192.168.1.50");
      return new WledLamps({ url: env.WLED_URL, ledMap: env.WLED_LED_MAP });
    default:
      throw new Error(`Unbekannter Wert für LAMPS: ${env.LAMPS} (erlaubt: none, console, mqtt, wled)`);
  }
}
