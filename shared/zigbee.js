// Lamp commands in zigbee2mqtt format. Shared by the server adapters and the browser demo log.

import { lampName } from "./game.js";

export const topicFor = (id, baseTopic = "zigbee2mqtt") => `${baseTopic}/${lampName(id)}/set`;

export const payloadFor = (color) =>
  color ? { state: "ON", brightness: 254, color: { hex: color }, transition: 0.3 } : { state: "OFF", transition: 0.3 };

// Only the windows whose colour changed since the last frame.
export function changedWindows(previous, frame) {
  return frame.windows
    .map((color, id) => ({ id, color }))
    .filter(({ id, color }) => !previous || previous.windows[id] !== color);
}
