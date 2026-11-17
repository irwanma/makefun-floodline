// The flood itself: a shallow-water simulation on the valley grid. Every
// cell holds a depth; each step, water leans toward whichever neighbour's
// surface (ground + walls + depth) sits lower, dug channels pull it faster,
// and the south edge drains to the sea. Deliberately simple and stable —
// fixed substeps, movement capped per step — so a surge looks the same
// every time it is staged.

import { COLS, ROWS, cellIndex, inGrid } from './config.js';

export function createWater() {
  return {
    depth: new Float32Array(COLS * ROWS),
    flowX: new Float32Array(COLS * ROWS), // signed flow, for drawing shimmer
    flowY: new Float32Array(COLS * ROWS),
    scratch: new Float32Array(COLS * ROWS),
  };
}

export function resetWater(w) {
  w.depth.fill(0);
  w.flowX.fill(0);
  w.flowY.fill(0);
}

// One simulation step. `effHeight(x, y)` is the ground plus any wall the
// player has built; `sources` are the night's springs with their rates;
// `opts` carries rain, infiltration and the channel speed multiplier.
export function stepWater(w, effHeight, sources, dt, opts) {
  const { depth, scratch, flowX, flowY } = w;
  scratch.fill(0);

  for (const s of sources) {
    if (inGrid(s.x, s.y)) depth[cellIndex(s.x, s.y)] += s.rate * dt;
  }
  if (opts.rain > 0) {
    const add = opts.rain * dt;
    for (let i = 0; i < depth.length; i++) depth[i] += add;
  }

  // Water is loyal to the steepest fall: outflow is shared between lower
  // neighbours in proportion to the drop raised to a power, so a flood
  // gathers into channels and the river instead of sheeting everywhere.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = cellIndex(x, y);
      const d = depth[i];
      if (d <= 0.001) continue;
      const level = effHeight(x, y) + d;
      const diffs = [0, 0, 0, 0];
      let totalDiff = 0, weightSum = 0;
      for (let dir = 0; dir < 4; dir++) {
        const nx = x + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const ny = y + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (!inGrid(nx, ny)) continue;
        const diff = level - (effHeight(nx, ny) + depth[cellIndex(nx, ny)]);
        if (diff > 0) { diffs[dir] = diff; totalDiff += diff; weightSum += Math.pow(diff, 1.6); }
      }
      if (weightSum <= 0) continue;
      let totalOut = Math.min(d * 0.6, totalDiff * 0.3);
      if (opts.channelBonus && opts.channelBonus[i]) totalOut *= opts.channelBonus[i];
      // A channel hurries water; it must never mint it. Whatever the bonus,
      // a cell cannot send out more than it holds.
      totalOut = Math.min(totalOut, d * 0.9);
      for (let dir = 0; dir < 4; dir++) {
        if (diffs[dir] <= 0) continue;
        const nx = x + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const ny = y + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        const ni = cellIndex(nx, ny);
        const move = Math.min(totalOut * (Math.pow(diffs[dir], 1.6) / weightSum), diffs[dir] * 0.55);
        if (move <= 0) continue;
        scratch[i] -= move;
        scratch[ni] += move;
        if (dir === 0) flowX[i] += move; else if (dir === 1) flowX[i] -= move;
        else if (dir === 2) flowY[i] += move; else flowY[i] -= move;
      }
    }
  }
  for (let i = 0; i < depth.length; i++) {
    depth[i] += scratch[i];
    if (depth[i] < 0) depth[i] = 0;
    flowX[i] *= 0.82;
    flowY[i] *= 0.82;
  }

  // The sea gate: the bottom row drains away, and dry land drinks a little.
  const drain = 1 - Math.min(0.9, 2.2 * dt);
  for (let x = 0; x < COLS; x++) {
    const i = cellIndex(x, ROWS - 1);
    depth[i] *= drain;
  }
  if (opts.infiltration > 0) {
    const drink = opts.infiltration * dt;
    for (let i = 0; i < depth.length; i++) {
      if (depth[i] > 0 && depth[i] < 0.4) depth[i] = Math.max(0, depth[i] - drink);
    }
  }
}

export function totalDepth(w) {
  let s = 0;
  for (let i = 0; i < w.depth.length; i++) s += w.depth[i];
  return s;
}

export function depthAt(w, x, y) { return inGrid(x, y) ? w.depth[cellIndex(x, y)] : 0; }

// --- drawing ---------------------------------------------------------------
// Depth becomes colour: a skin of bright sky-blue over a deep river blue.
// Flow draws as short bright dashes leaning the way the water leans, foam
// gathers where the surface drops or a wall is being worried, and reservoir
// ponds carry a calmer, greener stillness than the flood that feeds them.

import { CELL, FIELD_X, FIELD_Y } from './config.js';

export function drawWater(ctx, w, terrain, time) {
  const { depth, flowX, flowY } = w;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = cellIndex(x, y);
      const d = depth[i];
      if (d <= 0.02) continue;
      const px = FIELD_X + x * CELL;
      const py = FIELD_Y + y * CELL;
      // Shallow water is a sheen the land shows through; deep water is a
      // river's dark blue. The eye reads the flood by that difference.
      const t = Math.min(1, d / 1.3);
      const r = Math.round(126 - 110 * t);
      const g = Math.round(196 - 118 * t);
      const b = Math.round(238 - 90 * t);
      ctx.fillStyle = terrain.pond[i]
        ? `rgba(${r - 12}, ${g + 14}, ${b - 14}, ${0.42 + 0.55 * t})`
        : `rgba(${r}, ${g}, ${b}, ${0.30 + 0.62 * t})`;
      ctx.fillRect(px, py, CELL + 1, CELL + 1);
      // Flow dash: only where the current truly runs, a bright fleck
      // leaning the way the water leans.
      const fx = flowX[i], fy = flowY[i];
      const sp = Math.abs(fx) + Math.abs(fy);
      if (sp > 0.09) {
        const ox = Math.max(-7, Math.min(7, fx * 30));
        const oy = Math.max(-7, Math.min(7, fy * 30));
        ctx.strokeStyle = 'rgba(230, 248, 255, 0.75)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px + CELL / 2 - ox, py + CELL / 2 - oy);
        ctx.lineTo(px + CELL / 2 + ox, py + CELL / 2 + oy);
        ctx.stroke();
      }
      // Foam where the surface falls away or worries a wall base.
      const drop = (depth[i] - (x + 1 < COLS ? depth[i + 1] : 0)) + (depth[i] - (y + 1 < ROWS ? depth[i + COLS] : 0));
      if (drop > 0.3 || sp > 0.22) {
        const tw = 0.5 + 0.5 * Math.sin(time * 6 + i * 1.7);
        ctx.fillStyle = `rgba(240, 250, 255, ${(0.25 + 0.4 * tw).toFixed(3)})`;
        ctx.fillRect(px + 3 + (i * 7) % 14, py + 4 + (i * 11) % 13, 5, 2.4);
        if (drop > 0.6) ctx.fillRect(px + 12 - (i * 5) % 10, py + 14, 6, 2.4);
      }
    }
  }
}
