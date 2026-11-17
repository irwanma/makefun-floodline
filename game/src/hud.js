// The frame around the valley: a top bar carrying the night, the score and
// the village's hearts; a right-hand panel with the tool palette, the works
// in hand, the blessings held and the night's orders; and the great banner
// that names a surge when it arrives. hud.js draws all of it and owns the
// rectangles the mouse needs to find the palette and buttons again.

import {
  VIEW_W, TOP_H, PANEL_X, PANEL_W, FIELD_X, FIELD_W, INK, INK_DIM, GOLD,
  PANEL_BG, PANEL_EDGE, FONT_DISPLAY, FONT_BODY, clamp,
} from './config.js';
import { TOOLS, priceFor } from './tools.js';
import { housesStanding } from './buildings.js';

export function panelRect() { return { x: PANEL_X, y: 88, w: PANEL_W, h: 600 }; }
export function toolCardRect(i) { return { x: PANEL_X + 10, y: 110 + i * 52, w: PANEL_W - 20, h: 47 }; }
export function actionButtonRect() { return { x: PANEL_X + 10, y: 632, w: PANEL_W - 20, h: 44 }; }

function heartRow(ctx, world, x, y) {
  const total = world.village.houses.length;
  const standing = housesStanding(world.village);
  ctx.font = '15px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < standing ? '#ff7d6b' : 'rgba(120, 110, 100, 0.4)';
    ctx.fillText('♥', x + i * 17, y);
  }
  return standing;
}

export function drawTopBar(ctx, world) {
  ctx.fillStyle = 'rgba(5, 11, 21, 0.92)';
  ctx.fillRect(0, 0, VIEW_W, TOP_H);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, TOP_H - 2, VIEW_W, 2);

  const def = world.nightDef;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `bold 21px ${FONT_DISPLAY}`;
  ctx.fillText(`NIGHT ${world.night} / 7`, 18, 32);
  ctx.fillStyle = GOLD;
  ctx.font = `italic 15px ${FONT_DISPLAY}`;
  ctx.fillText(def ? def.name : '', 18, 56);
  ctx.fillStyle = INK_DIM;
  ctx.font = `11px ${FONT_BODY}`;
  const phaseText = world.phase === 'build' ? 'BUILD — the valley is calm'
    : world.phase === 'flood' ? `FLOOD — ${Math.max(0, Math.ceil(world.floodT))}s of water`
    : world.phase === 'recede' ? 'THE WATER FALLS BACK' : '';
  ctx.fillText(phaseText, 18, 72);

  // Flood clock: a draining ribbon while the surge runs.
  if (world.phase === 'flood' || world.phase === 'recede') {
    const frac = world.phase === 'recede' ? 0 : clamp(world.floodT / def.duration, 0, 1);
    ctx.fillStyle = 'rgba(120, 170, 220, 0.25)';
    ctx.fillRect(330, 52, 300, 7);
    ctx.fillStyle = '#57b7e8';
    ctx.fillRect(330, 52, 300 * frac, 7);
  }

  ctx.fillStyle = INK_DIM;
  ctx.font = `11px ${FONT_BODY}`;
  ctx.fillText('SCORE', 330, 26);
  ctx.fillText('LABOR', 470, 26);
  ctx.fillText('RAIN HARVESTED', 580, 26);
  ctx.fillStyle = INK;
  ctx.font = `bold 20px ${FONT_BODY}`;
  ctx.fillText(String(world.score), 330, 48);
  ctx.fillText(String(world.labor), 470, 48);
  ctx.fillText(`${Math.round(world.harvestFrac * 100)}%`, 580, 48);
  ctx.fillStyle = INK_DIM;
  ctx.font = `11px ${FONT_BODY}`;
  ctx.fillText('VILLAGE', 730, 26);
  heartRow(ctx, world, 730, 48);
  ctx.fillStyle = INK_DIM;
  ctx.font = `11px ${FONT_BODY}`;
  ctx.fillText(world.muted ? 'SOUND OFF (M)' : 'SOUND ON (M)', 880, 26);
  ctx.fillText(`BEST ${world.best}`, 880, 48);
  if (world.paused) {
    ctx.fillStyle = GOLD;
    ctx.font = `bold 13px ${FONT_BODY}`;
    ctx.fillText('PAUSED', 880, 68);
  }
}

const TOOL_GLYPHS = { channel: '≋', levee: '▲', sandbag: '▦', gate: '⊓', pond: '⬣', dam: '⫯', repair: '✚' };

export function drawPanel(ctx, world) {
  const p = panelRect();
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = PANEL_EDGE;
  ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
  ctx.fillStyle = GOLD;
  ctx.font = `bold 13px ${FONT_BODY}`;
  ctx.textAlign = 'left';
  ctx.fillText('THE KEEPER’S WORKS', p.x + 12, p.y + 16);

  TOOLS.forEach((tool, i) => {
    const r = toolCardRect(i);
    const locked = world.night < tool.night;
    const price = priceFor(world, tool);
    const afford = world.labor >= price;
    const selected = world.selectedTool === tool.id;
    ctx.fillStyle = selected ? 'rgba(232, 179, 75, 0.22)' : 'rgba(20, 34, 54, 0.75)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = selected ? GOLD : 'rgba(140, 160, 190, 0.25)';
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = locked ? 'rgba(160,160,160,0.5)' : GOLD;
    ctx.font = '19px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(TOOL_GLYPHS[tool.id], r.x + 20, r.y + 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = locked ? INK_DIM : INK;
    ctx.font = `bold 12.5px ${FONT_BODY}`;
    ctx.fillText(tool.name, r.x + 38, r.y + 19);
    ctx.font = `11px ${FONT_BODY}`;
    ctx.fillStyle = locked ? INK_DIM : afford ? '#9fd48a' : '#ff9d8a';
    ctx.fillText(locked ? `unlocks Night ${tool.night}` : `${price} Labor · key ${tool.key}`, r.x + 38, r.y + 36);
  });

  // The selected work, explained; then the blessings the Shrine has granted.
  const infoY = 110 + TOOLS.length * 52 + 6;
  ctx.fillStyle = 'rgba(12, 22, 38, 0.8)';
  ctx.fillRect(p.x + 10, infoY, p.w - 20, 56);
  ctx.fillStyle = INK_DIM;
  ctx.font = `11px ${FONT_BODY}`;
  const sel = TOOLS.find((t) => t.id === world.selectedTool);
  wrapText(ctx, sel ? sel.desc : 'Choose a work, then click the valley. Drag to lay a line of it. Right-click to put it down.', p.x + 18, infoY + 16, p.w - 36, 13.5);

  const blessY = infoY + 70;
  ctx.fillStyle = GOLD;
  ctx.font = `bold 11px ${FONT_BODY}`;
  ctx.fillText('SHRINE BLESSINGS', p.x + 12, blessY);
  ctx.font = `11px ${FONT_BODY}`;
  const held = Object.keys(world.blessings).filter((k) => world.blessings[k]);
  if (held.length === 0) {
    ctx.fillStyle = INK_DIM;
    ctx.fillText('Keep the Shrine dry to earn one.', p.x + 12, blessY + 15);
  } else {
    ctx.fillStyle = INK;
    const names = held.map((id) => {
      const b = world.blessingCatalog.find((c) => c.id === id);
      return b ? `${b.glyph} ${b.name}` : id;
    }).join('   ');
    wrapText(ctx, names, p.x + 12, blessY + 15, p.w - 24, 13.5);
  }

  // The night's orders: what comes tonight, above the one big button.
  const next = world.nextNightDef;
  ctx.fillStyle = INK_DIM;
  ctx.font = `italic 11.5px ${FONT_DISPLAY}`;
  if (world.phase === 'build' && next) {
    wrapText(ctx, `TONIGHT: ${next.preview}`, p.x + 12, 600, p.w - 24, 13.5);
  }
  const btn = actionButtonRect();
  if (world.phase === 'build') {
    ctx.fillStyle = '#1d5f8a';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = GOLD;
    ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = `bold 15px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText('BEGIN THE FLOOD  ▸', btn.x + btn.w / 2, btn.y + 28);
    ctx.textAlign = 'left';
  } else if (world.phase === 'flood') {
    ctx.fillStyle = 'rgba(29, 95, 138, 0.25)';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = INK_DIM;
    ctx.font = `12px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Click a gate to open or close it', btn.x + btn.w / 2, btn.y + 27);
    ctx.textAlign = 'left';
  }
}

export function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

// The surge banner: the night's name, shouted across the valley when the
// water comes and again when it swells. In screenshot mode it never blinks.
export function drawBanner(ctx, world) {
  if (world.bannerT <= 0) return;
  const a = world.shotMode ? 1 : clamp(world.bannerT / 1.2, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  const cx = FIELD_X + FIELD_W / 2;
  ctx.fillStyle = 'rgba(4, 10, 18, 0.72)';
  ctx.fillRect(cx - 330, 118, 660, 74);
  ctx.strokeStyle = GOLD;
  ctx.strokeRect(cx - 330 + 0.5, 118.5, 659, 73);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = `11px ${FONT_BODY}`;
  ctx.fillText(`— NIGHT ${world.night} —`, cx, 140);
  ctx.fillStyle = '#f6ecd4';
  ctx.font = `bold 27px ${FONT_DISPLAY}`;
  ctx.fillText(world.bannerText, cx, 172);
  ctx.restore();
  ctx.textAlign = 'left';
}

// A one-line flash under the top bar: "Not enough Labor", "The gate swings".
export function drawFlash(ctx, world) {
  if (!world.flash || world.flashT <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(world.flashT, 0, 1);
  ctx.fillStyle = world.flash.good ? '#bfe8a8' : '#ffb59d';
  ctx.font = `bold 13.5px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText(world.flash.text, FIELD_X + FIELD_W / 2, 108);
  ctx.restore();
  ctx.textAlign = 'left';
}
