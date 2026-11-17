// The game's framed moments: the title over a living valley, the dawn
// reckoning with its grade and its blessing choice, the victory after the
// seventh night, the fall of the village, and the pause. screens.js draws
// them all and owns the rectangles of their buttons and blessing cards.

import {
  VIEW_W, VIEW_H, INK, INK_DIM, GOLD, PANEL_BG, PANEL_EDGE,
  FONT_DISPLAY, FONT_BODY,
} from './config.js';

export function blessingCardRect(i) { return { x: 268 + i * 252, y: 448, w: 236, h: 104 }; }
export function dawnContinueRect() { return { x: 490, y: 580, w: 300, h: 46 }; }
export function bigButtonRect() { return { x: 490, y: 520, w: 300, h: 50 }; }

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(3, 7, 13, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panelBox(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.lineWidth = 1;
}

function goldButton(ctx, r, label) {
  ctx.fillStyle = '#1d5f8a';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = GOLD;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = `bold 16px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 6);
  ctx.textAlign = 'left';
}

// --- title -----------------------------------------------------------------

export function drawTitle(ctx, world, time) {
  const grad = ctx.createLinearGradient(0, 60, 0, 430);
  grad.addColorStop(0, 'rgba(4, 9, 17, 0.88)');
  grad.addColorStop(0.75, 'rgba(4, 9, 17, 0.35)');
  grad.addColorStop(1, 'rgba(4, 9, 17, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 60, VIEW_W, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd4ef';
  ctx.font = `italic 17px ${FONT_DISPLAY}`;
  ctx.fillText('— the monsoon comes to the terraced valley —', VIEW_W / 2, 128);
  // The word itself, drowned blue under a bright waterline.
  ctx.font = `bold 96px ${FONT_DISPLAY}`;
  ctx.fillStyle = 'rgba(10, 30, 52, 0.9)';
  ctx.fillText('FLOODLINE', VIEW_W / 2 + 3, 223);
  const titleGrad = ctx.createLinearGradient(0, 140, 0, 226);
  titleGrad.addColorStop(0, '#fdf6da');
  titleGrad.addColorStop(0.62, '#e8b34b');
  titleGrad.addColorStop(0.66, '#7fd0f2');
  titleGrad.addColorStop(1, '#2d7ab5');
  ctx.fillStyle = titleGrad;
  ctx.fillText('FLOODLINE', VIEW_W / 2, 220);
  ctx.fillStyle = INK;
  ctx.font = `17.5px ${FONT_DISPLAY}`;
  ctx.fillText('Steer the great rain: dig channels, raise levees, and hold a terraced', VIEW_W / 2, 262);
  ctx.fillText('rice village through seven nights of flood.', VIEW_W / 2, 286);
  ctx.fillStyle = INK_DIM;
  ctx.font = `13px ${FONT_BODY}`;
  ctx.fillText('Build by day-calm · open the sluices when the water comes · keep the Shrine dry', VIEW_W / 2, 316);
  const pulse = world.shotMode ? 1 : 0.65 + 0.35 * Math.sin(time * 2.6);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = GOLD;
  ctx.font = `bold 21px ${FONT_BODY}`;
  ctx.fillText('CLICK TO BEGIN', VIEW_W / 2, 372);
  ctx.restore();
  ctx.fillStyle = INK_DIM;
  ctx.font = `12.5px ${FONT_BODY}`;
  ctx.fillText('Mouse: choose works and lay them · drag to carve · Space: loose the flood · P pause · M sound', VIEW_W / 2, 690);
  if (world.best > 0) ctx.fillText(`Best score so far: ${world.best}`, VIEW_W / 2, 668);
  ctx.textAlign = 'left';
}

// --- dawn reckoning ----------------------------------------------------------

function statRow(ctx, label, value, x, y, good) {
  ctx.fillStyle = INK_DIM;
  ctx.font = `13px ${FONT_BODY}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.fillStyle = good === false ? '#ff9d8a' : INK;
  ctx.font = `bold 14px ${FONT_BODY}`;
  ctx.textAlign = 'right';
  ctx.fillText(value, x + 300, y);
  ctx.textAlign = 'left';
}

export function drawDawn(ctx, world) {
  dim(ctx, 0.45);
  panelBox(ctx, 240, 120, 800, 520);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = `13px ${FONT_BODY}`;
  ctx.fillText(`— DAWN AFTER NIGHT ${world.night} —`, 640, 158);
  ctx.fillStyle = INK;
  ctx.font = `bold 30px ${FONT_DISPLAY}`;
  ctx.fillText(world.nightDef.name, 640, 194);
  // The grade, large enough to argue with.
  ctx.font = `bold 92px ${FONT_DISPLAY}`;
  ctx.fillStyle = world.dawn.grade === 'S' ? '#ffd94d' : world.dawn.grade === 'A' ? '#9fd48a' : world.dawn.grade === 'B' ? '#7fd0f2' : '#ff9d8a';
  ctx.fillText(world.dawn.grade, 372, 316);
  ctx.fillStyle = INK_DIM;
  ctx.font = `12px ${FONT_BODY}`;
  ctx.fillText('FLOW GRADE', 372, 340);
  ctx.textAlign = 'left';
  const x = 500, y0 = 252;
  statRow(ctx, 'Houses standing', `${world.dawn.housesDry} dry · ${world.dawn.housesStanding} of ${world.dawn.housesTotal}`, x, y0, world.dawn.housesLost === 0);
  statRow(ctx, 'Rice terraces saved', `${world.dawn.paddiesSaved} of ${world.dawn.paddiesTotal}`, x, y0 + 30, world.dawn.paddiesLost <= world.dawn.paddiesTotal * 0.1);
  statRow(ctx, 'Rain harvested', `${world.dawn.harvestCells} pondfuls (+${world.dawn.harvestLabor} Labor)`, x, y0 + 60, true);
  statRow(ctx, 'Granary', world.dawn.granaryDry ? 'Dry — stores bonus paid' : 'Flooded — no bonus', x, y0 + 90, world.dawn.granaryDry);
  statRow(ctx, 'Shrine', world.dawn.shrineDry ? 'Dry — a blessing is offered' : 'Wet — no blessing tonight', x, y0 + 120, world.dawn.shrineDry);
  statRow(ctx, 'Score', `+${world.dawn.scoreGain}  →  ${world.score}`, x, y0 + 150, true);

  if (world.dawnChoices && world.dawnChoices.length > 0) {
    ctx.fillStyle = GOLD;
    ctx.font = `bold 13px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText('THE SHRINE OFFERS A BLESSING — CHOOSE ONE', 640, 436);
    world.dawnChoices.forEach((b, i) => {
      const r = blessingCardRect(i);
      ctx.fillStyle = 'rgba(23, 42, 66, 0.9)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = PANEL_EDGE;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.fillStyle = GOLD;
      ctx.font = '22px "Trebuchet MS", Verdana, sans-serif';
      ctx.fillText(b.glyph, r.x + r.w / 2, r.y + 32);
      ctx.fillStyle = INK;
      ctx.font = `bold 14px ${FONT_BODY}`;
      ctx.fillText(b.name, r.x + r.w / 2, r.y + 56);
      ctx.fillStyle = INK_DIM;
      ctx.font = `11px ${FONT_BODY}`;
      drawWrappedCentered(ctx, b.desc, r.x + r.w / 2, r.y + 74, r.w - 22, 13);
    });
    ctx.textAlign = 'left';
  } else {
    goldButton(ctx, dawnContinueRect(), world.night >= 7 ? 'FACE THE FINAL DAWN ▸' : 'BEGIN THE NEXT NIGHT ▸');
  }
}

function drawWrappedCentered(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  ctx.textAlign = 'center';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
  ctx.textAlign = 'left';
}

// --- victory, defeat, pause --------------------------------------------------

export function drawVictory(ctx, world) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = `14px ${FONT_BODY}`;
  ctx.fillText('— THE SEVENTH DAWN —', 640, 208);
  ctx.fillStyle = INK;
  ctx.font = `bold 54px ${FONT_DISPLAY}`;
  ctx.fillText('THE VALLEY HOLDS', 640, 268);
  ctx.font = `18px ${FONT_DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText(`Seven nights of the great rain, and the lanterns are still lit.`, 640, 312);
  ctx.fillStyle = INK_DIM;
  ctx.font = `15px ${FONT_BODY}`;
  ctx.fillText(`Final score ${world.score} · Season grade ${world.seasonGrade} · Houses standing ${world.finalHouses}`, 640, 348);
  ctx.fillText(`Rain harvested across the season: ${world.totalHarvest} pondfuls`, 640, 376);
  goldButton(ctx, bigButtonRect(), 'PLAY AGAIN ▸');
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx, world) {
  dim(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9d8a';
  ctx.font = `14px ${FONT_BODY}`;
  ctx.fillText(`— NIGHT ${world.night}: ${world.nightDef.name.toUpperCase()} —`, 640, 208);
  ctx.fillStyle = INK;
  ctx.font = `bold 54px ${FONT_DISPLAY}`;
  ctx.fillText('THE VILLAGE FALLS', 640, 268);
  ctx.font = `18px ${FONT_DISPLAY}`;
  ctx.fillText('The last lantern goes out beneath the water.', 640, 312);
  ctx.fillStyle = INK_DIM;
  ctx.font = `15px ${FONT_BODY}`;
  ctx.fillText(`You held ${world.night - 1} ${world.night - 1 === 1 ? 'night' : 'nights'} · Final score ${world.score} · Best ${world.best}`, 640, 348);
  goldButton(ctx, bigButtonRect(), 'TRY AGAIN ▸');
  ctx.textAlign = 'left';
}

export function drawPause(ctx) {
  dim(ctx, 0.5);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `bold 40px ${FONT_DISPLAY}`;
  ctx.fillText('HELD BREATH', 640, 330);
  ctx.fillStyle = INK_DIM;
  ctx.font = `14px ${FONT_BODY}`;
  ctx.fillText('The rain waits with you. Press P to go on.', 640, 366);
  ctx.textAlign = 'left';
}
