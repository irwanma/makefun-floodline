// The valley itself: a terraced heightmap that steps down from a northern
// ridge to a flat village floor, with a river carved through it and rice
// paddies on every terrace tread. Terrain owns the ground heights; digging
// and levee-raising in tools.js change them, and water.js reads them.

import {
  COLS, ROWS, CELL, FIELD_X, FIELD_Y, cellIndex, inGrid, mulberry32, clamp, lerp,
} from './config.js';

export const VILLAGE_TOP = ROWS - 4; // rows at or below this are the village floor

const BAND_COLORS = ['#173d24', '#1c4a2a', '#225831', '#2a6638', '#337540', '#3f8a49'];
const FLAT_COLOR = '#27512e';

// Build one valley from a seed. `ground` is the live height array (tools dig
// into it); `natural` keeps the untouched heights so a dug channel and a
// raised levee can be recognised and drawn differently from the land itself.
export function createTerrain(seed) {
  const rng = mulberry32(seed);
  const ground = new Float32Array(COLS * ROWS);
  const band = new Uint8Array(COLS * ROWS);
  const paddy = new Uint8Array(COLS * ROWS);
  const pond = new Uint8Array(COLS * ROWS);
  const speckle = new Float32Array(COLS * ROWS);

  for (let y = 0; y < ROWS; y++) {
    const b = y >= VILLAGE_TOP ? 0 : Math.floor((VILLAGE_TOP - 1 - y) / 4);
    for (let x = 0; x < COLS; x++) {
      const i = cellIndex(x, y);
      band[i] = b;
      let h = y >= VILLAGE_TOP ? 2.0 : 3.1 + b * 2.1;
      // Each tread tilts gently toward its lip — more than the noise can
      // undo — so rain crosses open ground instead of pooling in a
      // thousand accidental basins, and gathers where the keeper digs.
      const rib = y >= VILLAGE_TOP ? 0 : y - (VILLAGE_TOP - 4 * (b + 1));
      h -= rib * 0.26;
      h += (rng() - 0.5) * 0.36;
      // A gentle cross-slope so water does not run in perfect straight lines.
      h += Math.sin((x / COLS) * Math.PI * 1.2 + b) * 0.22;
      ground[i] = h;
      speckle[i] = rng();
      if (y >= 3 && y < VILLAGE_TOP) paddy[i] = 1;
    }
  }

  // Carve the river: a low path that wanders as it falls, the route every
  // flood wants to take on its way to the sea gate at the bottom edge.
  const riverX = new Int16Array(ROWS);
  let rx = 12 + Math.floor(rng() * 14);
  for (let y = 0; y < ROWS; y++) {
    rx += Math.round((rng() - 0.5) * 3);
    rx = Math.max(3, Math.min(COLS - 4, rx));
    riverX[y] = rx;
    for (let dx = -1; dx <= 1; dx++) {
      const i = cellIndex(rx + dx, y);
      ground[i] -= dx === 0 ? 2.0 : 1.1;
      if (dx === 0) paddy[i] = 0;
    }
  }

  // Flatten house plots on the village floor so buildings sit level.
  for (let y = VILLAGE_TOP; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = cellIndex(x, y);
      ground[i] = 2.0 + (speckle[i] - 0.5) * 0.16;
      paddy[i] = 0;
    }
  }

  // Springs: the points on the ridge where floodwater enters. Different
  // nights wake different springs (see surges.js).
  const springs = [
    { x: riverX[0], y: 0, name: 'Riverhead' },
    { x: 5, y: 0, name: 'West Ridge Spring' },
    { x: COLS - 6, y: 0, name: 'East Ridge Spring' },
    { x: Math.floor(COLS / 2) + 6, y: 0, name: 'High Hollow Spring' },
    { x: 2, y: 6, name: 'West Cliff Seep' },
    { x: COLS - 3, y: 6, name: 'East Cliff Seep' },
  ];

  return { ground, natural: Float32Array.from(ground), band, paddy, pond, speckle, riverX, springs };
}

export function groundAt(t, x, y) { return inGrid(x, y) ? t.ground[cellIndex(x, y)] : 99; }

// How much of a cell is dug out or heaped up relative to the natural land:
// negative reads as a channel or pond, positive as a levee bank.
export function earthworkAt(t, i) { return t.ground[i] - t.natural[i]; }

// --- drawing ---------------------------------------------------------------

function cellShade(t, i) {
  const b = t.band[i];
  const s = t.speckle[i];
  return BAND_COLORS[b] || FLAT_COLOR;
}

// The whole valley floor: terrace treads with contour edges where one band
// steps down to the next, dug earth shown browner, ponds shown as basins.
export function drawTerrain(ctx, t, time) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = cellIndex(x, y);
      const px = FIELD_X + x * CELL;
      const py = FIELD_Y + y * CELL;
      ctx.fillStyle = cellShade(t, i);
      ctx.fillRect(px, py, CELL + 1, CELL + 1);
      const ew = earthworkAt(t, i);
      if (t.pond[i]) {
        ctx.fillStyle = '#3d3423';
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = 'rgba(70, 60, 30, 0.6)';
        ctx.fillRect(px + 4, py + 4, CELL - 8, CELL - 8);
      } else if (ew < -0.4) {
        ctx.fillStyle = 'rgba(58, 44, 26, 0.55)';
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      } else if (ew > 0.4) {
        ctx.fillStyle = 'rgba(214, 186, 130, 0.35)';
        ctx.fillRect(px, py, CELL + 1, 5);
      }
      // Speckle: a breath of variation so no two cells read as flat fill.
      if (t.speckle[i] > 0.72) {
        ctx.fillStyle = 'rgba(255, 246, 200, 0.05)';
        ctx.fillRect(px + (t.speckle[i] * 37) % 16, py + (t.speckle[i] * 53) % 16, 3, 3);
      }
      // Paddy sheen: young rice catches the moon in short strokes.
      if (t.paddy[i] && !t.pond[i]) {
        ctx.strokeStyle = 'rgba(168, 226, 150, 0.20)';
        ctx.beginPath();
        const off = (t.speckle[i] * 11) % 8;
        ctx.moveTo(px + 4 + off, py + 17);
        ctx.lineTo(px + 7 + off, py + 9);
        ctx.moveTo(px + 12 + off, py + 18);
        ctx.lineTo(px + 15 + off, py + 10);
        ctx.stroke();
      }
      // Contour: a darker riser line where the terrace steps down southward.
      if (y + 1 < ROWS && t.band[cellIndex(x, y + 1)] < t.band[i]) {
        ctx.fillStyle = 'rgba(6, 20, 10, 0.55)';
        ctx.fillRect(px, py + CELL - 4, CELL + 1, 4);
        ctx.fillStyle = 'rgba(230, 255, 210, 0.10)';
        ctx.fillRect(px, py + CELL - 6, CELL + 1, 2);
      }
    }
  }
  // Bamboo groves: dark clusters rooted along the terrace risers, placed by
  // the same speckle that breaks up the fields, so the valley has a texture
  // the eye can hold at thumbnail size.
  for (let y = 3; y < VILLAGE_TOP; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = cellIndex(x, y);
      if (t.speckle[i] < 0.9 || t.pond[i] || earthworkAt(t, i) < -0.4) continue;
      if (y + 1 < ROWS && t.band[cellIndex(x, y + 1)] >= t.band[i]) continue;
      const px = FIELD_X + x * CELL + 12;
      const py = FIELD_Y + y * CELL + 16;
      ctx.fillStyle = 'rgba(10, 34, 18, 0.85)';
      ctx.beginPath();
      ctx.arc(px - 6, py + 3, 7, 0, Math.PI * 2);
      ctx.arc(px + 6, py + 4, 6, 0, Math.PI * 2);
      ctx.arc(px, py - 3, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(140, 220, 150, 0.20)';
      ctx.beginPath();
      ctx.arc(px - 2, py - 6, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Village floor: packed-earth lanes between the house plots.
  ctx.fillStyle = 'rgba(96, 74, 44, 0.35)';
  const vy = FIELD_Y + (VILLAGE_TOP + 2) * CELL;
  ctx.fillRect(FIELD_X, vy, COLS * CELL, 7);
  const vy2 = FIELD_Y + (VILLAGE_TOP) * CELL + 4;
  ctx.fillRect(FIELD_X, vy2, COLS * CELL, 4);
}
