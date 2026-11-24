// Start picture for the pixel canvas: four original characters in retro 8-bit style
// (robot, slime, cat, rocket) and a few stars. Used when no saved picture exists yet.
//
// Each character is drawn as text. One letter = one pixel:
//   . off   W white   g grey   R red   O orange   Y yellow   l light green   G green
//   T teal  C light blue   B blue   P purple   K pink   N brown   S skin   D dark grey

import { CANVAS_COLORS, CANVAS_SIZE } from "./canvas.js";

const LEGEND = {
  W: CANVAS_COLORS[0], g: CANVAS_COLORS[1], R: CANVAS_COLORS[2], O: CANVAS_COLORS[3],
  Y: CANVAS_COLORS[4], l: CANVAS_COLORS[5], G: CANVAS_COLORS[6], T: CANVAS_COLORS[7],
  C: CANVAS_COLORS[8], B: CANVAS_COLORS[9], P: CANVAS_COLORS[10], K: CANVAS_COLORS[11],
  N: CANVAS_COLORS[12], S: CANVAS_COLORS[13], D: CANVAS_COLORS[14],
};

export const SPRITES = {
  robot: [
    "....YY....",
    ".....g....",
    ".gggggggg.",
    ".gCCggCCg.",
    ".gCDggCDg.",
    ".gggggggg.",
    ".ggRRRRgg.",
    ".gggggggg.",
    "..BBBBBB..",
    "gBBYBBYBBg",
    "g.BBBBBB.g",
    "..BB..BB..",
    "..gg..gg..",
  ],
  slime: [
    "....GGGG....",
    "..GGllllGG..",
    ".GllllllllG.",
    ".GlWDllWDlG.",
    "GllWDllWDllG",
    "GllllllllllG",
    "GllllKKllllG",
    "GllllllllllG",
    ".GGGGGGGGGG.",
  ],
  cat: [
    ".O........O.",
    ".OO......OO.",
    ".OKO....OKO.",
    ".OOOOOOOOOO.",
    "OOOOOOOOOOOO",
    "OOCDOOOOCDOO",
    "OOOOOOOOOOOO",
    "WOOOOKKOOOOW",
    "OWOOOOOOOOWO",
    ".OOOODDOOOO.",
    "..OOOOOOOO..",
  ],
  rocket: [
    "...RR...",
    "..RRRR..",
    "..WWWW..",
    "..WCCW..",
    "..WCCW..",
    "..WWWW..",
    "..WPPW..",
    ".RWWWWR.",
    "RRWWWWRR",
    "RR.WW.RR",
    "...OO...",
    "..OYYO..",
    "...OO...",
    "...Y....",
  ],
};

const STARS = [[1, 1], [14, 2], [30, 4], [16, 15], [2, 17], [29, 18], [15, 30], [31, 28], [8, 15], [23, 14]];

// Draws a sprite with its centre at (cx, cy).
function place(pixels, size, rows, cx, cy) {
  const x0 = Math.round(cx - rows[0].length / 2);
  const y0 = Math.round(cy - rows.length / 2);
  rows.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      const x = x0 + dx;
      const y = y0 + dy;
      if (LEGEND[ch] && x >= 0 && y >= 0 && x < size && y < size) pixels[y * size + x] = LEGEND[ch];
    }),
  );
}

export function starterPicture(size = CANVAS_SIZE) {
  const pixels = Array(size * size).fill(null);
  for (const [x, y] of STARS) if (x < size && y < size) pixels[y * size + x] = LEGEND.Y;
  const q = size / 4; // centres of the four quarters
  place(pixels, size, SPRITES.robot, q, q);
  place(pixels, size, SPRITES.slime, 3 * q, q + 1);
  place(pixels, size, SPRITES.cat, q, 3 * q);
  place(pixels, size, SPRITES.rocket, 3 * q, 3 * q);
  return pixels;
}
