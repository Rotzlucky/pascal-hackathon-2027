import { test } from "node:test";
import assert from "node:assert/strict";
import { CELLS, RULES, affected, applyTap, createPuzzle, isSolved, lampName } from "./game.js";

test("the facade has 17 windows and no window in the door", () => {
  assert.equal(CELLS.length, 17);
  assert.ok(!CELLS.some((c) => c.r === 3 && c.c === 2));
});

test("lamp names count from fenster_01 to fenster_17", () => {
  assert.equal(lampName(0), "fenster_01");
  assert.equal(lampName(16), "fenster_17");
});

test("cross rule switches the window and its direct neighbours", () => {
  // 1. OG, middle window (id 10): up 2. OG middle (5), down = door (none), left 9, right 11
  assert.deepEqual(affected(10, "plus").sort((a, b) => a - b), [5, 9, 10, 11]);
});

test("tapping the same window twice changes nothing", () => {
  for (const rule of Object.keys(RULES)) {
    const start = CELLS.map((c) => c.id % 2 === 0);
    assert.deepEqual(applyTap(applyTap(start, 4, rule), 4, rule), start);
  }
});

test("every puzzle is solvable by tapping its solution", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const rule of Object.keys(RULES)) {
    for (let level = 1; level <= 12; level++) {
      const { on, solution } = createPuzzle(level, rule, random);
      assert.ok(!isSolved(on), "a new puzzle is never already solved");
      let state = on;
      for (const id of solution) state = applyTap(state, id, rule);
      assert.ok(isSolved(state), `rule ${rule}, level ${level}`);
    }
  }
});
