// The living sky: monsoon rain with splashes, fireflies that come out while
// the valley is calm, moonlit clouds, and the flood's flotsam — fallen logs
// that ride the current and batter whatever wall they strike. All particles
// are seeded and recycled; nothing here allocates in the frame loop.

import { CELL, FIELD_X, FIELD_Y, FIELD_W, FIELD_H, cellIndex, clamp, mulberry32 } from './config.js';
import { depthAt } from './water.js';
import { WALL_NONE, damageWall } from './tools.js';

const RAIN_MAX = 240;

export function createWeather(seed) {
  const rng = mulberry32(seed ^ 0x51ab3);
  const drops = [];
  for (let i = 0; i < RAIN_MAX; i++) {
    drops.push({ x: rng() * FIELD_W, y: rng() * FIELD_H, v: 620 + rng() * 380, len: 9 + rng() * 12 });
  }
  const splashes = [];
  for (let i = 0; i < 90; i++) splashes.push({ x: 0, y: 0, r: 0, life: 0 });
  const flies = [];
  for (let i = 0; i < 26; i++) {
    flies.push({ x: rng() * FIELD_W, y: FIELD_H * 0.45 + rng() * FIELD_H * 0.5, ph: rng() * 9, sp: 0.3 + rng() * 0.7 });
  }
  const clouds = [];
  for (let i = 0; i < 6; i++) clouds.push({ x: rng() * 1300 - 100, y: rng() * 46, w: 180 + rng() * 260, sp: 4 + rng() * 7 });
  return { drops, splashes, flies, clouds, splashIdx: 0, logs: [], logTimer: 3 };
}

export function updateWeather(wth, dt, intensity) {
  const active = Math.floor(RAIN_MAX * clamp(intensity, 0, 1));
  for (let i = 0; i < active; i++) {
    const d = wth.drops[i];
    d.y += d.v * dt;
    d.x += 60 * dt; // the wind leans the rain
    if (d.y > FIELD_H) {
      d.y = -12; d.x = Math.random() * FIELD_W;
      const s = wth.splashes[wth.splashIdx++ % wth.splashes.length];
      s.x = d.x; s.y = FIELD_H - Math.random() * 26; s.r = 1; s.life = 0.32;
    }
  }
  for (const s of wth.splashes) if (s.life > 0) { s.life -= dt; s.r += 26 * dt; }
  for (const c of wth.clouds) { c.x += c.sp * dt; if (c.x - c.w > 1320) c.x = -c.w - 40; }
}

export function drawClouds(ctx, wth, time) {
  // The moon, half-veiled, and the cloud bellies sliding under it.
  const mx = 1150, my = 34;
  const glow = ctx.createRadialGradient(mx, my, 4, mx, my, 60);
  glow.addColorStop(0, 'rgba(240, 244, 210, 0.5)');
  glow.addColorStop(1, 'rgba(240, 244, 210, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(mx - 60, my - 60, 120, 120);
  ctx.fillStyle = '#e9edd6';
  ctx.beginPath(); ctx.arc(mx, my, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160, 175, 190, 0.16)';
  for (const c of wth.clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 8, c.w / 2, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.22, c.y, c.w / 3, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawRain(ctx, wth, intensity) {
  const active = Math.floor(RAIN_MAX * clamp(intensity, 0, 1));
  ctx.strokeStyle = 'rgba(174, 205, 235, 0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < active; i++) {
    const d = wth.drops[i];
    const x = FIELD_X + d.x, y = FIELD_Y + d.y;
    ctx.moveTo(x, y);
    ctx.lineTo(x - d.len * 0.24, y + d.len);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200, 228, 250, 0.25)';
  ctx.beginPath();
  for (const s of wth.splashes) {
    if (s.life <= 0) continue;
    ctx.moveTo(FIELD_X + s.x + s.r, FIELD_Y + s.y);
    ctx.ellipse(FIELD_X + s.x, FIELD_Y + s.y, s.r, s.r * 0.36, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}

export function drawFireflies(ctx, wth, time) {
  for (const f of wth.flies) {
    const x = FIELD_X + f.x + Math.sin(time * f.sp + f.ph) * 16;
    const y = FIELD_Y + f.y + Math.cos(time * f.sp * 0.8 + f.ph * 2) * 10;
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.7 + f.ph * 3));
    ctx.fillStyle = `rgba(255, 232, 140, ${a.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}

// --- flotsam: debris logs ---------------------------------------------------

export function updateFlotsam(world, dt) {
  const { weather, water, defenses, terrain } = world;
  weather.logTimer -= dt;
  const def = world.nightDef;
  if (def.debris && weather.logTimer <= 0 && world.activeSprings.length > 0) {
    weather.logTimer = 3.4 + Math.random() * 2.4;
    const s = world.activeSprings[Math.floor(Math.random() * world.activeSprings.length)];
    weather.logs.push({ fx: s.x + 0.5, fy: s.y + 0.5, rot: Math.random() * 3, age: 0, hitCd: 0 });
    if (weather.logs.length > 7) weather.logs.shift();
  }
  const kept = [];
  for (const log of weather.logs) {
    log.age += dt;
    log.hitCd -= dt;
    const cx = Math.floor(log.fx), cy = Math.floor(log.fy);
    const d = depthAt(water, cx, cy);
    if (log.age > 16 || (log.age > 3 && d < 0.12)) continue;
    // Ride the current: follow the cell's flow, else lean downhill.
    const i = cellIndex(cx, cy);
    let vx = water.flowX[i] * 2.4, vy = water.flowY[i] * 2.4 + 0.25;
    const sp = Math.hypot(vx, vy);
    const maxSp = 2.6;
    if (sp > maxSp) { vx = vx / sp * maxSp; vy = vy / sp * maxSp; }
    const nx = log.fx + vx * dt, ny = log.fy + vy * dt;
    const tx = Math.floor(nx), ty = Math.floor(ny);
    const ti = cellIndex(tx, ty);
    if (defenses.kind[ti] !== WALL_NONE && !(defenses.kind[ti] === 3 && defenses.gateOpen[ti])) {
      if (log.hitCd <= 0) {
        log.hitCd = 0.5;
        if (damageWall(defenses, ti, 9)) world.onWallBroken?.(tx, ty);
        else world.onWallHit?.(tx, ty);
      }
      log.rot += dt * 2;
    } else {
      log.fx = clamp(nx, 0.4, 39.6); log.fy = clamp(ny, 0.4, 23.6);
      log.rot += dt * (0.4 + sp * 0.3);
    }
    kept.push(log);
  }
  weather.logs = kept;
}

export function drawFlotsam(ctx, weather) {
  for (const log of weather.logs) {
    const x = FIELD_X + log.fx * CELL, y = FIELD_Y + log.fy * CELL;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(log.rot);
    ctx.fillStyle = 'rgba(230, 244, 255, 0.35)';
    ctx.beginPath(); ctx.ellipse(0, 3, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d4126';
    ctx.fillRect(-14, -3.4, 28, 6.8);
    ctx.fillStyle = '#77572f';
    ctx.fillRect(-14, -3.4, 28, 2.4);
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath(); ctx.arc(13, 0, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
