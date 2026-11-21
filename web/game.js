const directions = [
  { id: 'up',   dx: 0,  dy: -1, symbol: '↑' },
  { id: 'left', dx: -1, dy: 0,  symbol: '←' },
  { id: 'down', dx: 0,  dy: 1,  symbol: '↓' },
  { id: 'right',dx: 1,  dy: 0,  symbol: '→' },
];

function makeMap({ rows, limit, lanterns }) {
  const width = rows[0].length;
  const tiles = rows.join('').split('');
  const home = tiles.indexOf('P');
  const startFog = tiles.indexOf('F');
  const stops = tiles.flatMap((tile, index) => tile === 'M' ? [index] : []);
  const links = tiles.map((tile, index) => directions.map(({ dx, dy }) => {
    const x = index % width + dx;
    const y = Math.floor(index / width) + dy;
    const next = y * width + x;
    return tile !== '#' && x >= 0 && x < width && y >= 0 && y < rows.length && tiles[next] !== '#'
      ? next : -1;
  }));

  // The route planner treats walls as solid and plans over the same links as the player.
  const distances = tiles.map((_, start) => {
    const distance = Array(tiles.length).fill(Infinity);
    const queue = [start];
    distance[start] = 0;
    for (const current of queue) {
      for (const next of links[current]) {
        if (next >= 0 && distance[next] === Infinity) {
          distance[next] = distance[current] + 1;
          queue.push(next);
        }
      }
    }
    return distance;
  });
  return { width, height: rows.length, tiles, home, startFog, stops, links, distances, limit, lanterns };
}

function newShift(map) {
  return {
    player: map.home, fog: map.startFog, decoy: null, lanterns: map.lanterns,
    delivered: 0, turn: 0, phase: 'playing', reason: null,
  };
}

function fogIntent(map, state, placeLantern = false) {
  const target = placeLantern && state.lanterns > 0 ? state.player : (state.decoy?.cell ?? state.player);
  const distance = map.distances[target];
  const next = map.links[state.fog].find(cell => cell >= 0 && distance[cell] < distance[state.fog]);
  return { target, next: next ?? state.fog };
}

function move(map, state, destination, placeLantern = false) {
  if (state.phase !== 'playing' || destination < 0 || !map.links[state.player].includes(destination)) {
    return state;
  }
  const lightsLantern = placeLantern && state.lanterns > 0;
  const decoy = lightsLantern ? { cell: state.player, turns: 3 } : state.decoy;
  const { next } = fogIntent(map, state, lightsLantern);
  const caught = destination === state.fog || destination === next;
  const stop = map.stops.indexOf(destination);
  const delivered = !caught && stop >= 0 ? state.delivered | (1 << stop) : state.delivered;
  const turn = state.turn + 1;
  const won = !caught && destination === map.home && delivered === (1 << map.stops.length) - 1;
  const reason = caught ? 'caught' : (!won && turn >= map.limit ? 'time' : null);
  return {
    player: destination,
    fog: destination === state.fog ? state.fog : next,
    decoy: decoy?.turns > 1 ? { cell: decoy.cell, turns: decoy.turns - 1 } : null,
    lanterns: state.lanterns - Number(lightsLantern),
    delivered, turn,
    phase: won ? 'won' : reason ? 'lost' : 'playing',
    reason,
  };
}

function countDeliveries(map, state) {
  return map.stops.filter((_, index) => state.delivered & (1 << index)).length;
}

function scoreShift(map, state) {
  const mail = countDeliveries(map, state) * 100;
  if (state.phase !== 'won') return mail;
  return mail + 200 + (map.limit - state.turn) * 20 + state.lanterns * 30;
}

const MothGame = { directions, makeMap, newShift, fogIntent, move, countDeliveries, scoreShift };
if (typeof module !== 'undefined') module.exports = MothGame;
