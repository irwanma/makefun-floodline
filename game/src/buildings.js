// The village at the valley floor: six lantern-lit houses whose survival is
// the game, the Shrine whose dry feet earn a blessing each dawn, and the
// Granary whose dry stores fatten the dawn payout. Buildings sample the
// water around their plots and take damage while the flood stands in them.

import { CELL, FIELD_X, FIELD_Y, cellIndex, mulberry32 } from './config.js';
import { VILLAGE_TOP } from './terrain.js';
import { depthAt } from './water.js';

const HOUSE_PLOTS = [
  { x: 3, y: VILLAGE_TOP + 1 }, { x: 10, y: VILLAGE_TOP + 2 },
  { x: 17, y: VILLAGE_TOP + 1 }, { x: 24, y: VILLAGE_TOP + 2 },
  { x: 31, y: VILLAGE_TOP + 1 }, { x: 36, y: VILLAGE_TOP + 2 },
];

export function createVillage(seed) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const houses = HOUSE_PLOTS.map((p, n) => ({
    ...p, w: 3, h: 2, hp: 100, maxHp: 100, floodTime: 0,
    roof: ['#8a3b26', '#7c4a21', '#93502a', '#84402a', '#7c4a21', '#8a3b26'][n],
    seed: rng(),
  }));
  return {
    houses,
    shrine: { x: 20, y: VILLAGE_TOP, w: 2, h: 2 },
    granary: { x: 6, y: VILLAGE_TOP, w: 3, h: 2 },
  };
}

export function housesStanding(v) { return v.houses.filter((h) => h.hp > 0).length; }
export function housesDry(v) { return v.houses.filter((h) => h.hp > 0 && h.floodTime <= 0.01).length; }

function plotDepth(water, b) {
  let worst = 0;
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) worst = Math.max(worst, depthAt(water, x, y));
  }
  return worst;
}

// Called a few times a second during the flood. A house tolerates a splash;
// standing water eats its integrity, deeper water eats it faster. The
// Lantern Watch blessing deepens the tolerance.
export function updateBuildings(world, dt) {
  const { village, water } = world;
  const tolerance = world.blessings.lantern ? 0.85 : 0.55;
  for (const h of village.houses) {
    if (h.hp <= 0) continue;
    const d = plotDepth(water, h);
    if (d > tolerance) {
      h.floodTime += dt;
      h.hp -= dt * (d - tolerance) * 26;
      if (h.hp <= 0) { h.hp = 0; world.stats.housesLost += 1; world.onHouseLost?.(h); }
    } else if (d < 0.15) {
      h.floodTime = Math.max(0, h.floodTime - dt * 0.5);
    }
  }
  world.shrineWet = plotDepth(water, village.shrine) > 0.5;
  world.granaryWet = plotDepth(water, village.granary) > 0.5;
}

// --- drawing ---------------------------------------------------------------

function drawHouse(ctx, h, time) {
  const px = FIELD_X + h.x * CELL;
  const py = FIELD_Y + h.y * CELL;
  const w = h.w * CELL;
  const hgt = h.h * CELL;
  const dead = h.hp <= 0;
  const hurt = h.hp < h.maxHp * 0.55;
  ctx.save();
  if (dead || hurt) ctx.translate(0, dead ? 3 : 1);
  // Lantern halo on the ground around a living house.
  if (!dead) {
    const glow = ctx.createRadialGradient(px + w / 2, py + hgt / 2, 4, px + w / 2, py + hgt / 2, 52);
    glow.addColorStop(0, 'rgba(255, 176, 71, 0.20)');
    glow.addColorStop(1, 'rgba(255, 176, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - 30, py - 26, w + 60, hgt + 56);
  }
  ctx.fillStyle = dead ? '#3a332a' : '#6e4a2c';
  ctx.fillRect(px + 5, py + 18, w - 10, hgt - 20);
  ctx.fillStyle = dead ? '#2c2620' : h.roof;
  ctx.beginPath();
  ctx.moveTo(px + 1, py + 20);
  ctx.lineTo(px + w / 2, py + 2);
  ctx.lineTo(px + w - 1, py + 20);
  ctx.closePath();
  ctx.fill();
  // Windows: two warm panes in a living house, dark in a lost one.
  const lit = dead ? '#241d14' : (0.75 + 0.25 * Math.sin(time * 2 + h.seed * 20) > 0.4 ? '#ffd98a' : '#f7c873');
  ctx.fillStyle = lit;
  ctx.fillRect(px + 13, py + 27, 9, 10);
  ctx.fillRect(px + w - 22, py + 27, 9, 10);
  ctx.fillStyle = dead ? '#1d1811' : '#4a2f1a';
  ctx.fillRect(px + w / 2 - 5, py + 30, 10, hgt - 32);
  ctx.restore();
  if (dead) {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.35)';
    ctx.fillRect(px + 2, py + hgt - 8, w - 4, 5);
  }
}

export function drawVillage(ctx, v, time) {
  // Granary: a stout storehouse on stilts with a pale thatch roof.
  const g = v.granary;
  const gx = FIELD_X + g.x * CELL, gy = FIELD_Y + g.y * CELL;
  ctx.fillStyle = '#59462a';
  ctx.fillRect(gx + 4, gy + 16, g.w * CELL - 8, g.h * CELL - 14);
  ctx.fillStyle = '#c9b078';
  ctx.beginPath();
  ctx.moveTo(gx, gy + 18); ctx.lineTo(gx + (g.w * CELL) / 2, gy + 2); ctx.lineTo(gx + g.w * CELL, gy + 18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(gx + 30, gy + 26, 10, 10);
  ctx.fillStyle = '#e8b34b';
  ctx.font = 'bold 9px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRANARY', gx + (g.w * CELL) / 2, gy + g.h * CELL + 10);

  for (const h of v.houses) drawHouse(ctx, h, time);

  // The Shrine: stone steps, two pillars and a floating lantern flame.
  const s = v.shrine;
  const sx = FIELD_X + s.x * CELL, sy = FIELD_Y + s.y * CELL;
  ctx.fillStyle = '#8f96a3';
  ctx.fillRect(sx + 2, sy + 38, s.w * CELL - 4, 8);
  ctx.fillRect(sx + 6, sy + 30, s.w * CELL - 12, 8);
  ctx.fillStyle = '#aab2bf';
  ctx.fillRect(sx + 8, sy + 8, 7, 24);
  ctx.fillRect(sx + s.w * CELL - 15, sy + 8, 7, 24);
  ctx.fillStyle = '#7c4a21';
  ctx.fillRect(sx + 2, sy + 2, s.w * CELL - 4, 7);
  const flame = 0.8 + 0.2 * Math.sin(time * 5.3);
  const glow = ctx.createRadialGradient(sx + 25, sy + 20, 2, sx + 25, sy + 20, 26 * flame);
  glow.addColorStop(0, 'rgba(255, 214, 130, 0.85)');
  glow.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 4, sy - 6, s.w * CELL + 8, 52);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(sx + 25, sy + 20, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b34b';
  ctx.font = 'bold 9px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHRINE', sx + 25, sy + s.h * CELL + 10);
}
