const assert = require('node:assert/strict');
const test = require('node:test');
const { makeMap, newShift, fogIntent, move, countDeliveries, scoreShift } = require('../web/game.js');
const chapters = require('../web/chapters.js');

function findRoute(map, lanterns = map.lanterns) {
  const initial = { ...newShift(map), lanterns };
  const queue = [{ state: initial, path: [] }];
  const visited = new Set();
  for (const { state, path } of queue) {
    for (const destination of map.links[state.player]) {
      if (destination < 0) continue;
      for (const light of state.lanterns ? [false, true] : [false]) {
        const next = move(map, state, destination, light);
        if (next.phase === 'lost') continue;
        const nextPath = [...path, { destination, light }];
        if (next.phase === 'won') return nextPath;
        // Breadth-first order means reaching the same board state later cannot improve the limit.
        const key = [next.player, next.fog, next.delivered, next.lanterns, next.decoy?.cell, next.decoy?.turns].join(':');
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ state: next, path: nextPath });
      }
    }
  }
  return null;
}

test('forecast respects walls and resolves ties deterministically', () => {
  const map = makeMap({ rows: ['.....', 'P.#.F', '.....'], limit: 10, lanterns: 1 });
  const state = newShift(map);
  assert.equal(map.distances[map.home][map.startFog], 6);
  assert.deepEqual(fogIntent(map, state), { target: 5, next: 4 });
  assert.equal(move(map, state, 10).fog, 4);
  assert.strictEqual(move(map, state, 7), state);
});

test('placing a decoy redirects the fog for exactly three turns', () => {
  const map = makeMap({ rows: ['P....', '...M.', '....F'], limit: 10, lanterns: 1 });
  let state = move(map, newShift(map), 1, true);
  assert.deepEqual(state.decoy, { cell: 0, turns: 2 });
  assert.equal(state.lanterns, 0);
  assert.equal(fogIntent(map, state).target, 0);
  assert.equal(fogIntent(map, state, true).target, 0);
  state = move(map, state, 2);
  assert.deepEqual(state.decoy, { cell: 0, turns: 1 });
  assert.equal(fogIntent(map, state).target, 0);
  state = move(map, state, 1);
  assert.equal(state.decoy, null);
  assert.equal(fogIntent(map, state).target, 1);
});

test('a new decoy replaces active light and immediately changes the forecast', () => {
  const map = makeMap({ rows: ['P....', '...M.', '....F'], limit: 10, lanterns: 2 });
  const first = move(map, newShift(map), 5, true);
  assert.deepEqual(fogIntent(map, first), { target: 0, next: 4 });
  assert.deepEqual(fogIntent(map, first, true), { target: 5, next: 8 });
  const second = move(map, first, 10, true);
  assert.deepEqual(second.decoy, { cell: 5, turns: 2 });
  assert.equal(second.fog, 8);
  assert.equal(second.lanterns, 0);
});

test('entering the fog or its forecast ends the run before delivering any letter there', () => {
  const map = makeMap({ rows: ['PMF', '...'], limit: 5, lanterns: 1 });
  const initial = newShift(map);
  assert.equal(fogIntent(map, initial).next, 1);
  const forecastCollision = move(map, initial, 1);
  assert.equal(forecastCollision.reason, 'caught');
  assert.equal(forecastCollision.delivered, 0);
  assert.strictEqual(move(map, forecastCollision, 0), forecastCollision);
  const fogOnLetter = { ...initial, fog: 1 };
  assert.equal(fogIntent(map, fogOnLetter).next, 0);
  const currentCollision = move(map, fogOnLetter, 1);
  assert.equal(currentCollision.reason, 'caught');
  assert.equal(currentCollision.delivered, 0);
});

test('win takes priority on the final move and score rewards distinct deliveries and reserves', () => {
  const map = makeMap({ rows: ['PM...', '.....', '....F'], limit: 2, lanterns: 1 });
  const initial = newShift(map);
  const delivered = move(map, initial, 1);
  assert.equal(countDeliveries(map, delivered), 1);
  assert.equal(scoreShift(map, delivered), 100);
  const won = move(map, delivered, map.home);
  assert.equal(won.phase, 'won');
  assert.equal(scoreShift(map, won), 330);
  const late = move(map, delivered, 6);
  assert.equal(late.reason, 'time');
  assert.equal(scoreShift(map, late), 100);
});

test('all four districts can be cleared within their limits and escalate decoy requirements', () => {
  const maps = chapters.map(makeMap);
  assert.deepEqual(maps.map(map => findRoute(map).length), [10, 16, 18, 20]);
  assert.deepEqual(maps.map(map => findRoute(map, 0)?.length ?? null), [10, 20, null, null]);
  assert.equal(findRoute(maps[3], 1), null);
});
