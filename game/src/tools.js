// Everything the player builds: dug channels and reservoir ponds that move
// the land itself, and walls — sandbags, bamboo dams, sluice gates — that
// stand on it and can be battered down. tools.js owns the defense grid, the
// tool palette's prices and rules, and how each work is drawn.

import { COLS, ROWS, CELL, FIELD_X, FIELD_Y, cellIndex, inGrid, clamp } from './config.js';
import { VILLAGE_TOP } from './terrain.js';

export const WALL_NONE = 0;
export const WALL_SANDBAG = 1;
export const WALL_DAM = 2;
export const WALL_GATE = 3;

const WALL_HEIGHT = [0, 2.6, 6.5, 6.0];
const WALL_HP = [0, 26, 90, 70];

export function createDefenses() {
  return {
    kind: new Uint8Array(COLS * ROWS),
    hp: new Float32Array(COLS * ROWS),
    gateOpen: new Uint8Array(COLS * ROWS),
  };
}

// The height water must climb to pass a cell: land plus whatever stands on it.
export function wallHeightAt(def, i) {
  const k = def.kind[i];
  if (k === WALL_NONE) return 0;
  if (k === WALL_GATE && def.gateOpen[i]) return 0.2;
  return WALL_HEIGHT[k];
}

export function effectiveHeight(terrain, def, x, y) {
  if (!inGrid(x, y)) return 99;
  const i = cellIndex(x, y);
  return terrain.ground[i] + wallHeightAt(def, i);
}

export function damageWall(def, i, amount) {
  if (def.kind[i] === WALL_NONE) return false;
  def.hp[i] -= amount;
  if (def.hp[i] > 0) return false;
  def.kind[i] = WALL_NONE;
  def.hp[i] = 0;
  return true; // the wall gave way
}

// The palette. `night` is the first night the tool is available; `floodCost`
// (where set) is the emergency price for using it mid-surge.
export const TOOLS = [
  { id: 'channel', name: 'Dig Channel', key: '1', cost: 4, night: 1, floodCost: 9,
    desc: 'Dig a cell deeper so water chooses it. Drag to carve a course.' },
  { id: 'levee', name: 'Raise Levee', key: '2', cost: 6, night: 1, floodCost: 12,
    desc: 'Heap a cell up into a bank the flood must climb.' },
  { id: 'sandbag', name: 'Sandbag Wall', key: '3', cost: 3, night: 1, floodCost: 5,
    desc: 'Cheap and quick, but deep fast water can wash it away.' },
  { id: 'gate', name: 'Sluice Gate', key: '4', cost: 12, night: 2,
    desc: 'A gate on a channel. Click it during the flood to open or close it.' },
  { id: 'pond', name: 'Reservoir Pond', key: '5', cost: 5, night: 3,
    desc: 'Dig a basin that stores floodwater. Stored rain becomes Labor at dawn.' },
  { id: 'dam', name: 'Bamboo Dam', key: '6', cost: 16, night: 4,
    desc: 'A lashed bamboo wall: tall, strong, and stubborn against debris.' },
  { id: 'repair', name: 'Repair Crew', key: '7', cost: 10, night: 1,
    desc: 'Send the crew to a damaged house and make it whole again.' },
];

export function toolById(id) { return TOOLS.find((t) => t.id === id); }

// What a work costs right now: the flood price mid-surge where the tool has
// one, less a fifth while the Swift Crew blessing holds.
export function priceFor(world, tool) {
  const base = world.phase === 'flood' && tool.floodCost ? tool.floodCost : tool.cost;
  return world.blessings && world.blessings.swift ? Math.max(1, Math.round(base * 0.8)) : base;
}

// Try to do a tool's work on one cell. Returns a short result string the HUD
// can flash ('ok', 'poor', 'blocked', 'na'...). Mutates terrain/defenses.
export function applyTool(world, tool, x, y) {
  const { terrain, defenses } = world;
  if (!inGrid(x, y)) return 'na';
  const i = cellIndex(x, y);
  const price = priceFor(world, tool);
  if (world.labor < price) return 'poor';

  switch (tool.id) {
    case 'channel': {
      if (defenses.kind[i] !== WALL_NONE || terrain.pond[i]) return 'blocked';
      if (terrain.ground[i] <= 0.4) return 'blocked';
      terrain.ground[i] = Math.max(0.2, terrain.ground[i] - 1.6);
      break;
    }
    case 'levee': {
      if (defenses.kind[i] !== WALL_NONE || terrain.pond[i]) return 'blocked';
      terrain.ground[i] = Math.min(17, terrain.ground[i] + 2.2);
      break;
    }
    case 'sandbag':
    case 'dam': {
      if (defenses.kind[i] !== WALL_NONE) return 'blocked';
      defenses.kind[i] = tool.id === 'dam' ? WALL_DAM : WALL_SANDBAG;
      defenses.hp[i] = WALL_HP[defenses.kind[i]] * (world.blessings.stone ? 1.5 : 1);
      break;
    }
    case 'gate': {
      if (defenses.kind[i] !== WALL_NONE) return 'blocked';
      defenses.kind[i] = WALL_GATE;
      defenses.hp[i] = WALL_HP[WALL_GATE] * (world.blessings.stone ? 1.5 : 1);
      defenses.gateOpen[i] = 0;
      break;
    }
    case 'pond': {
      if (terrain.pond[i] || defenses.kind[i] !== WALL_NONE) return 'blocked';
      if (y >= VILLAGE_TOP) return 'blocked';
      terrain.pond[i] = 1;
      terrain.paddy[i] = 0;
      terrain.ground[i] = Math.max(0.2, terrain.ground[i] - 2.6);
      break;
    }
    case 'repair': {
      const house = world.village.houses.find((h) => h.hp > 0 && h.hp < h.maxHp &&
        x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
      if (!house) return 'na';
      house.hp = house.maxHp;
      house.floodTime = 0;
      break;
    }
    default: return 'na';
  }
  world.labor -= price;
  world.stats.built += 1;
  return 'ok';
}

// --- drawing ---------------------------------------------------------------

export function drawDefenses(ctx, terrain, def, time) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = cellIndex(x, y);
      const k = def.kind[i];
      if (k === WALL_NONE) continue;
      const px = FIELD_X + x * CELL;
      const py = FIELD_Y + y * CELL;
      const hurt = 1 - clamp(def.hp[i] / (WALL_HP[k] * 1.5), 0, 1);
      if (k === WALL_SANDBAG) {
        ctx.fillStyle = hurt > 0.45 ? '#8a7648' : '#c9b078';
        ctx.fillRect(px + 2, py + 9, CELL - 4, 12);
        ctx.fillStyle = 'rgba(70, 56, 28, 0.8)';
        ctx.fillRect(px + 2, py + 14, CELL - 4, 2);
        ctx.fillRect(px + 11, py + 9, 2, 12);
      } else if (k === WALL_DAM) {
        ctx.fillStyle = '#7d5a30';
        for (let s = 0; s < 4; s++) ctx.fillRect(px + 2 + s * 6, py + 3, 3, CELL - 6);
        ctx.fillStyle = '#a87f42';
        ctx.fillRect(px + 1, py + 8, CELL - 2, 3);
        ctx.fillRect(px + 1, py + 16, CELL - 2, 3);
        if (hurt > 0.45) { ctx.fillStyle = 'rgba(30,20,8,0.7)'; ctx.fillRect(px + 6, py + 4, 3, CELL - 8); }
      } else if (k === WALL_GATE) {
        const open = def.gateOpen[i] === 1;
        ctx.fillStyle = '#4c3a22';
        ctx.fillRect(px + 1, py + 2, 4, CELL - 4);
        ctx.fillRect(px + CELL - 5, py + 2, 4, CELL - 4);
        ctx.fillStyle = open ? '#8a6a34' : '#b98d4a';
        const lift = open ? 12 : 2;
        ctx.fillRect(px + 5, py + lift, CELL - 10, CELL - 4 - lift);
        ctx.fillStyle = open ? '#7fe3ff' : '#5a4326';
        ctx.fillRect(px + 5, py + 1, CELL - 10, 2);
      }
    }
  }
}
