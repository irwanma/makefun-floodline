// FLOODLINE — the keeper of the terraced valley.
//
// Steer the great rain: by calm you dig channels, raise levees, set sluice
// gates and pond basins; when the flood comes you work the gates and throw
// down sandbags while the water chooses its road. Keep the houses standing,
// the terraces bearing and the Shrine dry through seven named nights.
//
// main.js owns the run: the world state, the phase machine (title, build,
// flood, the water falling back, dawn), the mouse and keys, the fixed-step
// water clock, and the deterministic staging the screenshots are taken with.

import {
  VIEW_W, VIEW_H, COLS, ROWS, cellIndex, pixelToCell, clamp, mulberry32,
} from './config.js';
import { createTerrain, earthworkAt } from './terrain.js';
import { createWater, stepWater, resetWater, totalDepth, drawWater } from './water.js';
import {
  createDefenses, effectiveHeight, applyTool, toolById, drawDefenses,
  WALL_GATE, priceFor,
} from './tools.js';
import { createVillage, drawVillage, updateBuildings, housesStanding } from './buildings.js';
import { NIGHTS, surgeMultiplier, surgePhaseName } from './surges.js';
import { BLESSINGS, dealBlessings } from './blessings.js';
import { createWeather, updateWeather, drawClouds, drawRain, drawFireflies, updateFlotsam, drawFlotsam } from './weather.js';
import { createAudio } from './audio.js';
import { drawTopBar, drawPanel, drawBanner, drawFlash, toolCardRect, actionButtonRect } from './hud.js';
import { drawTitle, drawDawn, drawVictory, drawGameOver, drawPause, blessingCardRect, dawnContinueRect, bigButtonRect } from './screens.js';
import { drawTerrain } from './terrain.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 7);
const STEP = 1 / 30;

const vignette = document.createElement('canvas');
vignette.width = VIEW_W; vignette.height = VIEW_H;
{
  const v = vignette.getContext('2d');
  const g = v.createRadialGradient(640, 380, 320, 640, 380, 860);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(2,5,10,0.5)');
  v.fillStyle = g;
  v.fillRect(0, 0, VIEW_W, VIEW_H);
}

function loadBest() {
  try { return Number(localStorage.getItem('floodline-best') || 0) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem('floodline-best', String(v)); } catch { /* private mode */ }
}

const world = {
  phase: 'title',
  night: 1,
  nightDef: NIGHTS[0],
  nextNightDef: NIGHTS[0],
  terrain: createTerrain(SEED),
  defenses: createDefenses(),
  water: createWater(),
  village: createVillage(SEED),
  weather: createWeather(SEED),
  audio: createAudio(),
  labor: 70,
  score: 0,
  best: loadBest(),
  blessings: {},
  blessingCatalog: BLESSINGS,
  selectedTool: 'channel',
  hover: null,
  floodT: 0,
  bannerT: 0,
  bannerText: '',
  flash: null,
  flashT: 0,
  paused: false,
  muted: false,
  shotMode: Boolean(SHOT),
  activeSprings: [],
  channelBonus: new Float32Array(COLS * ROWS),
  harvestFrac: 0,
  shrineWet: false,
  granaryWet: false,
  shrineWetNight: false,
  granaryWetNight: false,
  paddyTotal: 0,
  stats: { built: 0, housesLost: 0 },
  totalHarvest: 0,
  dawn: null,
  dawnChoices: null,
  seasonGrades: [],
  seasonGrade: '',
  finalHouses: 0,
  rng: mulberry32(SEED * 31 + 5),
  simAcc: 0,
  damageAcc: 0,
  lastSurgeName: '',
  calmApplied: false,
};
world.onHouseLost = () => {
  world.audio.thud();
  setFlash('A house is lost to the water!', false);
  if (housesStanding(world.village) <= 0 && world.phase === 'flood') endRun(false);
};
world.onWallBroken = () => { world.audio.splashBig(); setFlash('A wall gives way!', false); };
world.onWallHit = () => world.audio.thud();

function setFlash(text, good) {
  world.flash = { text, good };
  world.flashT = 2.2;
}

function recomputeChannelBonus() {
  const mult = world.blessings.wide ? 2.1 : 1.5;
  for (let i = 0; i < COLS * ROWS; i++) {
    world.channelBonus[i] = (earthworkAt(world.terrain, i) < -0.4 || world.terrain.pond[i]) ? mult : 1;
  }
}

// --- run flow ----------------------------------------------------------------

function setupNight(n) {
  world.night = n;
  world.nightDef = NIGHTS[n - 1];
  world.nextNightDef = world.nightDef;
  world.phase = 'build';
  world.dawnChoices = null;
  world.selectedTool = 'channel';
  setFlash(`Night ${n} — ${world.nightDef.name}. Build while the valley is calm.`, true);
}

function startRun() {
  world.terrain = createTerrain(SEED);
  world.defenses = createDefenses();
  world.water = createWater();
  world.village = createVillage(SEED);
  world.weather = createWeather(SEED);
  world.labor = 70;
  world.score = 0;
  world.blessings = {};
  world.stats = { built: 0, housesLost: 0 };
  world.totalHarvest = 0;
  world.seasonGrades = [];
  world.harvestFrac = 0;
  recomputeChannelBonus();
  setupNight(1);
}

function beginFlood() {
  const def = world.nightDef;
  world.phase = 'flood';
  world.floodT = def.duration;
  world.activeSprings = def.springs.map((s) => {
    const sp = world.terrain.springs[s.s];
    return { x: sp.x, y: sp.y, rate: s.rate };
  });
  world.paddyTotal = world.terrain.paddy.reduce((a, b) => a + b, 0);
  world.housesAtFloodStart = housesStanding(world.village);
  world.housesDryAtFloodStart = world.village.houses.map((h) => h.hp);
  world.shrineWetNight = false;
  world.granaryWetNight = false;
  world.lastSurgeName = def.name.toUpperCase();
  world.bannerText = def.name.toUpperCase();
  world.bannerT = 3.6;
  world.calmApplied = Boolean(world.blessings.calm);
  recomputeChannelBonus();
  world.audio.thunder();
  setFlash('The flood is loosed.', true);
}

function gradeFor(points) { return points >= 92 ? 'S' : points >= 78 ? 'A' : points >= 58 ? 'B' : 'C'; }

function dawn() {
  const t = world.terrain;
  const standing = housesStanding(world.village);
  const dry = world.village.houses.filter((h) => h.hp > 0 && h.floodTime < 0.5).length;
  const damaged = standing - dry;
  const lostTonight = world.housesAtFloodStart - standing;
  const reedsTol = world.blessings.reeds ? 1.0 : 0.7;
  let paddiesSaved = 0;
  for (let i = 0; i < COLS * ROWS; i++) {
    if (t.paddy[i] && world.water.depth[i] < reedsTol) paddiesSaved += 1;
  }
  const paddyLossFrac = world.paddyTotal > 0 ? 1 - paddiesSaved / world.paddyTotal : 0;
  let pondCells = 0, harvestCells = 0;
  for (let i = 0; i < COLS * ROWS; i++) {
    if (t.pond[i]) { pondCells += 1; if (world.water.depth[i] > 0.35) harvestCells += 1; }
  }
  const harvestFrac = pondCells > 0 ? harvestCells / pondCells : 0;
  const harvestLabor = Math.round(harvestCells * 0.8 * (world.blessings.deep ? 1.5 : 1));
  const shrineDry = !world.shrineWetNight;
  const granaryDry = !world.granaryWetNight;
  const points = 100 - lostTonight * 34 - damaged * 9 - paddyLossFrac * 38 + harvestFrac * 10;
  const grade = gradeFor(points);
  const scoreGain = dry * 100 + damaged * 40 + paddiesSaved * 2 + harvestCells * 20 +
    (grade === 'S' ? 500 : grade === 'A' ? 300 : grade === 'B' ? 150 : 40);
  world.score += scoreGain;
  world.labor += 14 + standing * 5 + harvestLabor + (granaryDry ? 10 : 0) + (world.blessings.hands ? 9 : 0);
  world.totalHarvest += harvestCells;
  world.seasonGrades.push(grade);
  world.dawn = {
    grade, housesDry: dry, housesStanding: standing, housesTotal: world.village.houses.length,
    housesLost: lostTonight, paddiesSaved, paddiesTotal: world.paddyTotal,
    paddiesLost: world.paddyTotal - paddiesSaved, harvestCells, harvestLabor,
    granaryDry, shrineDry, scoreGain,
  };
  world.dawnChoices = shrineDry && world.night < 7 ? dealBlessings(world.rng, world.blessings) : null;
  if (world.dawnChoices && world.dawnChoices.length === 0) world.dawnChoices = null;
  resetWater(world.water);
  world.weather.logs = [];
  world.phase = 'dawn';
  world.audio.dawn();
  if (world.score > world.best) { world.best = world.score; saveBest(world.best); }
}

function continueDawn() {
  if (world.dawnChoices) return; // a blessing must be chosen first
  if (world.night >= 7) {
    const order = { S: 4, A: 3, B: 2, C: 1 };
    const avg = world.seasonGrades.reduce((a, g) => a + order[g], 0) / Math.max(1, world.seasonGrades.length);
    world.seasonGrade = avg >= 3.6 ? 'S' : avg >= 2.8 ? 'A' : avg >= 1.9 ? 'B' : 'C';
    world.finalHouses = housesStanding(world.village);
    world.phase = 'victory';
    world.audio.victory();
    if (world.score > world.best) { world.best = world.score; saveBest(world.best); }
    return;
  }
  setupNight(world.night + 1);
}

function endRun(won) {
  if (won) return;
  world.phase = 'gameover';
  world.audio.defeat();
  if (world.score > world.best) { world.best = world.score; saveBest(world.best); }
}

// --- simulation ---------------------------------------------------------------

function floodStep(dt) {
  const def = world.nightDef;
  const elapsed = def.duration - world.floodT;
  let mult = surgeMultiplier(def, elapsed);
  if (world.calmApplied && elapsed < def.duration * 0.37) mult *= 0.7;
  const sources = world.activeSprings.map((s) => ({ x: s.x, y: s.y, rate: s.rate * mult }));
  const eff = (x, y) => effectiveHeight(world.terrain, world.defenses, x, y);
  stepWater(world.water, eff, sources, dt, {
    rain: def.rain, infiltration: 0.03, channelBonus: world.channelBonus,
  });
  const name = surgePhaseName(def, elapsed);
  if (name !== world.lastSurgeName) {
    world.lastSurgeName = name;
    world.bannerText = name;
    world.bannerT = 3.2;
    if (name !== def.name.toUpperCase()) world.audio.thunder();
  }
}

function update(dt) {
  world.time = (world.time || 0) + dt;
  if (world.flashT > 0) world.flashT -= dt;
  if (world.bannerT > 0 && !world.shotMode) world.bannerT -= dt;
  if (world.paused || world.frozen) {
    // A staged screenshot holds its breath: the weather drifts, nothing else.
    if (world.frozen) updateWeather(world.weather, dt, 0.8);
    return;
  }

  const raining = world.phase === 'flood' ? 1 : world.phase === 'title' ? 0.55 : world.phase === 'build' ? 0.4 : 0.25;
  updateWeather(world.weather, dt, raining);
  world.audio.setRain(world.phase === 'flood' ? 0.9 : 0.4);

  if (world.phase === 'flood') {
    world.simAcc += dt;
    while (world.simAcc >= STEP) {
      world.simAcc -= STEP;
      floodStep(STEP);
      world.damageAcc += STEP;
      if (world.damageAcc >= 0.2) {
        updateBuildings(world, world.damageAcc);
        world.damageAcc = 0;
        world.shrineWetNight = world.shrineWetNight || world.shrineWet;
        world.granaryWetNight = world.granaryWetNight || world.granaryWet;
      }
    }
    updateFlotsam(world, dt);
    world.floodT -= dt;
    // HUD harvest gauge: how full the ponds ride right now.
    let pondCells = 0, filled = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
      if (world.terrain.pond[i]) { pondCells += 1; if (world.water.depth[i] > 0.35) filled += 1; }
    }
    world.harvestFrac = pondCells > 0 ? filled / pondCells : 0;
    let flow = 0;
    for (let i = 0; i < COLS * ROWS; i += 7) flow += Math.abs(world.water.flowX[i]) + Math.abs(world.water.flowY[i]);
    world.audio.setRush(clamp(flow * 0.6, 0, 1));
    if (world.floodT <= 0 && world.phase === 'flood') world.phase = 'recede';
  } else if (world.phase === 'recede') {
    world.simAcc += dt;
    while (world.simAcc >= STEP) {
      world.simAcc -= STEP;
      const eff = (x, y) => effectiveHeight(world.terrain, world.defenses, x, y);
      stepWater(world.water, eff, [], STEP, { rain: 0, infiltration: 0.05, channelBonus: world.channelBonus });
    }
    world.recedeT = (world.recedeT || 0) + dt;
    if (totalDepth(world.water) < 7 || world.recedeT > 14) { world.recedeT = 0; dawn(); }
  }
}

// --- drawing --------------------------------------------------------------------

function drawScene(time) {
  if (world.phase === 'title') {
    // The valley runs wider than the play field behind the title: the same
    // terrace bands continue to the right edge under the moon.
    for (let y = 0; y < ROWS; y++) {
      const b = world.terrain.band[cellIndex(COLS - 1, y)];
      ctx.fillStyle = ['#122e1e', '#173d24', '#1c4a2a', '#225831', '#2a6638', '#337540'][b] || '#173d24';
      ctx.fillRect(1016, 88 + y * 25, VIEW_W - 1016, 26);
      if (y + 1 < ROWS && world.terrain.band[cellIndex(COLS - 1, y + 1)] < b) {
        ctx.fillStyle = 'rgba(6, 20, 10, 0.55)';
        ctx.fillRect(1016, 88 + y * 25 + 21, VIEW_W - 1016, 4);
      }
    }
  }
  drawTerrain(ctx, world.terrain, time);
  drawWater(ctx, world.water, world.terrain, time);
  drawDefenses(ctx, world.terrain, world.defenses, time);
  drawVillage(ctx, world.village, time);
  drawFlotsam(ctx, world.weather);
  if (world.phase === 'build') drawFireflies(ctx, world.weather, time);
  drawRain(ctx, world.weather, world.phase === 'flood' ? 1 : 0.45);
  // Hover ghost: the cell the mouse is weighing up.
  if (world.hover && (world.phase === 'build' || world.phase === 'flood')) {
    const px = 16 + world.hover.x * 25, py = 88 + world.hover.y * 25;
    ctx.strokeStyle = 'rgba(255, 240, 190, 0.85)';
    ctx.strokeRect(px + 1.5, py + 1.5, 22, 22);
    ctx.fillStyle = 'rgba(255, 240, 190, 0.13)';
    ctx.fillRect(px, py, 25, 25);
  }
  ctx.drawImage(vignette, 0, 0);
  drawClouds(ctx, world.weather, time);
}

function draw(time) {
  ctx.fillStyle = '#060d18';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawScene(time);
  if (world.phase === 'title') { drawTitle(ctx, world, time); return; }
  drawTopBar(ctx, world);
  drawPanel(ctx, world);
  drawBanner(ctx, world);
  drawFlash(ctx, world);
  if (world.phase === 'dawn') drawDawn(ctx, world);
  if (world.phase === 'victory') drawVictory(ctx, world);
  if (world.phase === 'gameover') drawGameOver(ctx, world);
  if (world.paused) drawPause(ctx);
}

// --- input ------------------------------------------------------------------------

function canvasPos(evt) {
  const r = canvas.getBoundingClientRect();
  return { x: (evt.clientX - r.left) * (VIEW_W / r.width), y: (evt.clientY - r.top) * (VIEW_H / r.height) };
}
function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

let painting = false;

function tryToolAt(cell) {
  const tool = toolById(world.selectedTool);
  if (!tool) return;
  if (world.night < tool.night) { setFlash(`${tool.name} unlocks on Night ${tool.night}.`, false); world.audio.error(); return; }
  const result = applyTool(world, tool, cell.x, cell.y);
  if (result === 'ok') {
    recomputeChannelBonus();
    if (tool.id === 'channel' || tool.id === 'pond') world.audio.dig(); else world.audio.click();
  } else if (result === 'poor') { setFlash('Not enough Labor for that work.', false); world.audio.error(); }
  else if (result === 'blocked') { setFlash('That ground will not take it.', false); world.audio.error(); }
}

function gridClick(cell) {
  const i = cellIndex(cell.x, cell.y);
  if (world.phase === 'flood' && world.defenses.kind[i] === WALL_GATE) {
    world.defenses.gateOpen[i] = world.defenses.gateOpen[i] ? 0 : 1;
    world.audio.gate();
    setFlash(world.defenses.gateOpen[i] ? 'The gate swings open.' : 'The gate drops shut.', true);
    return;
  }
  if (world.phase === 'build' || world.phase === 'flood') tryToolAt(cell);
}

canvas.addEventListener('pointerdown', (evt) => {
  world.audio.unlock();
  const p = canvasPos(evt);
  if (evt.button === 2) { world.selectedTool = null; return; }
  if (world.phase === 'title') { startRun(); return; }
  if (world.phase === 'victory' || world.phase === 'gameover') {
    if (inRect(p, bigButtonRect())) startRun();
    return;
  }
  if (world.phase === 'dawn') {
    if (world.dawnChoices) {
      world.dawnChoices.forEach((b, i) => {
        if (inRect(p, blessingCardRect(i))) {
          world.blessings[b.id] = true;
          world.dawnChoices = null;
          recomputeChannelBonus();
          world.audio.click();
          setFlash(`Blessing taken: ${b.name}.`, true);
        }
      });
    } else if (inRect(p, dawnContinueRect())) continueDawn();
    return;
  }
  if (world.paused) return;
  // Panel first: tools, then the flood button.
  for (let i = 0; i < 8; i++) {
    const tool = toolById(['channel', 'levee', 'sandbag', 'gate', 'pond', 'dam', 'repair'][i]);
    if (tool && inRect(p, toolCardRect(i))) { world.selectedTool = tool.id; world.audio.click(); return; }
  }
  if (world.phase === 'build' && inRect(p, actionButtonRect())) { beginFlood(); return; }
  const cell = pixelToCell(p.x, p.y);
  if (cell) { painting = true; gridClick(cell); }
});
canvas.addEventListener('pointermove', (evt) => {
  const p = canvasPos(evt);
  world.hover = pixelToCell(p.x, p.y);
  if (painting && world.hover && ['channel', 'levee', 'sandbag', 'pond'].includes(world.selectedTool)) {
    tryToolAt(world.hover);
  }
});
window.addEventListener('pointerup', () => { painting = false; });
canvas.addEventListener('contextmenu', (evt) => evt.preventDefault());

window.addEventListener('keydown', (evt) => {
  if (evt.key === 'm' || evt.key === 'M') { world.muted = world.audio.toggleMute(); return; }
  if (evt.key === 'p' || evt.key === 'P') {
    if (world.phase === 'build' || world.phase === 'flood') world.paused = !world.paused;
    return;
  }
  if (evt.key === 'Escape') { world.selectedTool = null; return; }
  if (world.phase === 'build' && (evt.key === ' ' || evt.key === 'Enter')) { evt.preventDefault(); beginFlood(); return; }
  if (world.phase === 'dawn' && (evt.key === ' ' || evt.key === 'Enter')) { continueDawn(); return; }
  const tool = ['channel', 'levee', 'sandbag', 'gate', 'pond', 'dam', 'repair'].find((id) => toolById(id).key === evt.key);
  if (tool) world.selectedTool = tool;
});

// --- staging for screenshots ------------------------------------------------------

function stageLayout() {
  const t = world.terrain, def = world.defenses;
  const dig = (x, y, amt) => { const i = cellIndex(x, y); t.ground[i] = Math.max(0.2, t.ground[i] - amt); };
  const raise = (x, y, amt) => { const i = cellIndex(x, y); t.ground[i] += amt; };
  // A main channel falling from the Riverhead spring down the east side.
  let cx = t.riverX[0];
  for (let y = 0; y < 15; y++) { dig(cx, y, 1.7); dig(cx + 1, y, 1.2); if (y % 3 === 2) cx += 1; }
  // It bends west into a three-by-three reservoir pond above the village.
  for (let y = 12; y < 15; y++) for (let x = cx - 3; x < cx; x++) {
    const i = cellIndex(x, y);
    t.pond[i] = 1; t.paddy[i] = 0; t.ground[i] = Math.max(0.2, t.ground[i] - 2.6);
  }
  for (let x = cx - 3; x <= cx; x++) dig(x, 15, 1.4);
  // A levee arc shielding the village, sandbags at the gaps.
  for (let x = 4; x < 36; x++) if (x % 5 !== 0) raise(x, 19, 2.2);
  for (const gx of [9, 19, 29]) {
    const i = cellIndex(gx, 19);
    def.kind[i] = WALL_GATE; def.hp[i] = 70; def.gateOpen[i] = gx === 19 ? 1 : 0;
  }
  for (const sx of [13, 24]) { const i = cellIndex(sx, 18); def.kind[i] = 1; def.hp[i] = 26; }
  const damI = cellIndex(2, 10); def.kind[damI] = 2; def.hp[damI] = 90;
  const dam2 = cellIndex(37, 8); def.kind[dam2] = 2; def.hp[dam2] = 90;
  recomputeChannelBonus();
}

function stage() {
  if (!SHOT) return;
  if (SHOT === 'title') { world.phase = 'title'; return; }
  startRun();
  world.night = 4;
  world.nightDef = NIGHTS[3];
  world.nextNightDef = world.nightDef;
  world.score = 1450;
  world.labor = 26;
  world.blessings = { wide: true };
  stageLayout();
  if (SHOT === 'build') { world.phase = 'build'; setFlash('Night 4 — The Night of Debris. Build while the valley is calm.', true); return; }
  if (SHOT === 'flood') {
    beginFlood();
    const eff = (x, y) => effectiveHeight(world.terrain, world.defenses, x, y);
    const def = world.nightDef;
    for (let s = 0; s < 20 * 30; s++) {
      const sources = world.activeSprings.map((sp) => ({ x: sp.x, y: sp.y, rate: sp.rate * 1.9 }));
      stepWater(world.water, eff, sources, STEP, { rain: def.rain * 0.5, infiltration: 0.03, channelBonus: world.channelBonus });
    }
    // A settling breath: the sheet water drains off the terraces and gathers
    // into the channels, the pond and the river, where the eye should find it.
    for (let s = 0; s < 2 * 30; s++) {
      stepWater(world.water, eff, [], STEP, { rain: 0, infiltration: 0.05, channelBonus: world.channelBonus });
    }
    world.floodT = def.duration - 22;
    world.bannerText = 'THE NIGHT OF DEBRIS';
    world.bannerT = 99;
    world.flashT = 0;
    // Two logs ride the main channel where the water runs deepest.
    const t = world.terrain;
    world.weather.logs.push({ fx: t.riverX[0] + 3.5, fy: 6.5, rot: 0.7, age: 2, hitCd: 0 });
    world.weather.logs.push({ fx: t.riverX[0] + 5.2, fy: 11.4, rot: 2.1, age: 4, hitCd: 0 });
    let pondCells = 0, filled = 0;
    for (let i = 0; i < COLS * ROWS; i++) if (world.terrain.pond[i]) { pondCells += 1; if (world.water.depth[i] > 0.35) filled += 1; }
    world.harvestFrac = pondCells > 0 ? filled / pondCells : 0;
    world.frozen = true;
    return;
  }
  if (SHOT === 'dawn') {
    world.flashT = 0;
    world.phase = 'dawn';
    world.score = 2210;
    world.dawn = {
      grade: 'A', housesDry: 6, housesStanding: 6, housesTotal: 6, housesLost: 0,
      paddiesSaved: 512, paddiesTotal: 548, paddiesLost: 36, harvestCells: 8,
      harvestLabor: 10, granaryDry: true, shrineDry: true, scoreGain: 940,
    };
    world.dawnChoices = [BLESSINGS[0], BLESSINGS[3], BLESSINGS[4]];
    return;
  }
}

stage();

// Test hooks: the headless play-test drives the real game through these.
window.__floodline = {
  world,
  nights: NIGHTS,
  startRun, beginFlood, dawn, continueDawn, stageLayout,
  toolAt(id, x, y) { world.selectedTool = id; return applyTool(world, toolById(id), x, y); },
  priceFor: (id) => priceFor(world, toolById(id)),
};

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  update(dt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
