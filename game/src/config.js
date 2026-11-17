// FLOODLINE shared constants: the canvas, the valley grid, the palette and
// small helpers every other module leans on. Nothing here knows about the
// game's rules; it only fixes the stage the rules play out on.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// The valley field: a grid of square cells on the left of the screen, with a
// tool palette panel on the right and a status bar across the top.
export const CELL = 25;
export const COLS = 40;
export const ROWS = 24;
export const FIELD_X = 16;
export const FIELD_Y = 88;
export const FIELD_W = COLS * CELL;
export const FIELD_H = ROWS * CELL;
export const PANEL_X = 1032;
export const PANEL_W = VIEW_W - PANEL_X - 12;
export const TOP_H = 80;

export const NIGHT_COUNT = 7;

export function cellIndex(x, y) { return y * COLS + x; }
export function cellX(i) { return i % COLS; }
export function cellY(i) { return (i / COLS) | 0; }
export function inGrid(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
export function cellCenterX(x) { return FIELD_X + x * CELL + CELL / 2; }
export function cellCenterY(y) { return FIELD_Y + y * CELL + CELL / 2; }
export function pixelToCell(px, py) {
  const x = Math.floor((px - FIELD_X) / CELL);
  const y = Math.floor((py - FIELD_Y) / CELL);
  return inGrid(x, y) ? { x, y } : null;
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(t) { return t * t * (3 - 2 * t); }

// Deterministic random source (mulberry32): the valley, its weather and its
// staging all grow from one seed so a screenshot can be taken twice.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const INK = '#f3e9d2';        // parchment text
export const INK_DIM = '#b8ab8d';
export const GOLD = '#e8b34b';
export const PANEL_BG = 'rgba(7, 16, 29, 0.88)';
export const PANEL_EDGE = 'rgba(217, 164, 65, 0.55)';

export const FONT_DISPLAY = '"Palatino Linotype", Palatino, Georgia, serif';
export const FONT_BODY = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
