// The seven nights of the great rain. Each night wakes different springs at
// a different strength, and the later nights add their own cruelties: debris
// in the current, a river that changes its mind. `springs` indexes into
// terrain.springs; `preview` is the warning the build phase shows.

export const NIGHTS = [
  {
    name: 'The First Rain', duration: 42, rain: 0.010, debris: false,
    springs: [{ s: 0, rate: 2.6 }],
    preview: 'A kind beginning: the Riverhead wakes. Learn the water.',
  },
  {
    name: 'The Swelling River', duration: 48, rain: 0.014, debris: false,
    springs: [{ s: 0, rate: 3.4 }, { s: 3, rate: 1.6 }],
    preview: 'The High Hollow Spring joins the Riverhead. Sluice Gates unlock.',
  },
  {
    name: 'The East Ridge Breaks', duration: 54, rain: 0.018, debris: false,
    springs: [{ s: 0, rate: 3.6 }, { s: 2, rate: 2.6 }, { s: 3, rate: 1.4 }],
    preview: 'The East Ridge Spring bursts open. Reservoir Ponds unlock.',
  },
  {
    name: 'The Night of Debris', duration: 58, rain: 0.020, debris: true,
    springs: [{ s: 0, rate: 3.8 }, { s: 2, rate: 2.6 }, { s: 4, rate: 1.8 }],
    preview: 'Fallen logs ride the current and batter walls. Bamboo Dams unlock.',
  },
  {
    name: 'The Cloudburst', duration: 52, rain: 0.034, debris: true,
    springs: [{ s: 0, rate: 4.2 }, { s: 1, rate: 2.4 }, { s: 2, rate: 2.8 }, { s: 3, rate: 1.8 }],
    preview: 'The sky opens: heavy rain on every terrace, four springs awake.',
  },
  {
    name: 'The River Changes Course', duration: 62, rain: 0.024, debris: true,
    springs: [{ s: 0, rate: 3.4 }, { s: 1, rate: 2.8 }, { s: 2, rate: 2.8 }, { s: 5, rate: 2.2 }],
    preview: 'A new seep tears open on the East Cliff. Old plans may drown.',
  },
  {
    name: 'The Great Deluge', duration: 78, rain: 0.030, debris: true,
    springs: [
      { s: 0, rate: 4.6 }, { s: 1, rate: 2.8 }, { s: 2, rate: 3.2 },
      { s: 3, rate: 2.2 }, { s: 4, rate: 2.0 }, { s: 5, rate: 2.4 },
    ],
    preview: 'Every spring, every cliff, all night. Hold the valley, Keeper.',
  },
];

// The flood does not run at one strength: it swells twice, and the banner
// names the swell when it comes.
export function surgeMultiplier(nightDef, t) {
  const d = nightDef.duration;
  let m = 0.72;
  if (t > d * 0.28 && t < d * 0.28 + 9) m = 1.55;
  if (t > d * 0.66 && t < d * 0.66 + 11) m = 1.9;
  return m;
}

export function surgePhaseName(nightDef, t) {
  const d = nightDef.duration;
  if (t > d * 0.66 && t < d * 0.66 + 11) return 'THE RIVER ROARS';
  if (t > d * 0.28 && t < d * 0.28 + 9) return 'THE RIVER SWELLS';
  return nightDef.name.toUpperCase();
}
