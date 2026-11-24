// Game rules for "Licht an im Rathaus" (Lights Out on the Altes Rathaus facade).
// Pure functions only: this file runs on the Raspberry Pi (Node.js) and in the browser demo.

// The facade: rows from top to bottom, columns from left to right.
// Column 2 on the ground floor is the entrance door, so it has no window.
export const ROWS = [
  { name: "Dach", cols: [1, 2, 3] },
  { name: "2. OG", cols: [0, 1, 2, 3, 4] },
  { name: "1. OG", cols: [0, 1, 2, 3, 4] },
  { name: "EG", cols: [0, 1, 3, 4] },
];

// One entry per window. id 0 = top left dormer, id 16 = bottom right window.
export const CELLS = [];
ROWS.forEach((row, r) =>
  row.cols.forEach((c, i) => {
    CELLS.push({ id: CELLS.length, r, c, label: `${row.name}, Fenster ${i + 1}` });
  }),
);

const byPosition = new Map(CELLS.map((cell) => [`${cell.r},${cell.c}`, cell.id]));
const cellAt = (r, c) => byPosition.get(`${r},${c}`);

// Lamp names as configured in zigbee2mqtt: fenster_01 ... fenster_17.
export const lampName = (id) => `fenster_${String(id + 1).padStart(2, "0")}`;

// Which windows does one tap switch? Every rule includes the tapped window itself.
export const RULES = {
  plus: { label: "Kreuz", offsets: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] },
  x: { label: "Diagonal", offsets: [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] },
  col: { label: "Ganze Spalte", column: true },
};

export function affected(id, rule = "plus") {
  const cell = CELLS[id];
  const def = RULES[rule];
  if (!cell || !def) return [];
  if (def.column) return CELLS.filter((o) => o.c === cell.c).map((o) => o.id);
  return def.offsets.map(([dr, dc]) => cellAt(cell.r + dr, cell.c + dc)).filter((x) => x !== undefined);
}

// Returns a new array; `on` is an array of booleans, one per window.
export function applyTap(on, id, rule = "plus") {
  const next = on.slice();
  for (const i of affected(id, rule)) next[i] = !next[i];
  return next;
}

export const isSolved = (on) => on.every(Boolean);

export const tapsForLevel = (level) => Math.min(2 + level, 12);

// Build a puzzle that is always solvable: start with every window lit and
// tap backwards at random. Tapping the same windows again solves it.
export function createPuzzle(level = 1, rule = "plus", random = Math.random) {
  const taps = tapsForLevel(level);
  for (;;) {
    const ids = CELLS.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const solution = ids.slice(0, taps);
    let on = CELLS.map(() => true);
    for (const id of solution) on = applyTap(on, id, rule);
    if (!isSolved(on)) return { on, solution: new Set(solution), best: solution.length };
  }
}
