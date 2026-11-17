// Blessings of the Shrine: when its feet stay dry through a flood, dawn
// offers a choice of three. Each blessing is a small, permanent rule change
// the rest of the game honours — stronger walls, wider channels, deeper
// ponds, more hands at dawn. blessings.js is only the catalogue and the
// dealing; main.js applies what is chosen.

export const BLESSINGS = [
  { id: 'stone', name: 'Stone Foundations', glyph: '◆',
    desc: 'Walls and gates are built half again as strong.' },
  { id: 'wide', name: 'Wide Channels', glyph: '≈',
    desc: 'Dug channels and ponds carry water away far faster.' },
  { id: 'hands', name: 'Many Hands', glyph: '✋',
    desc: 'The village rallies: +9 Labor at every dawn.' },
  { id: 'calm', name: 'Calm Skies', glyph: '☾',
    desc: 'The first swell of every night arrives weakened.' },
  { id: 'deep', name: 'Deep Ponds', glyph: '⬣',
    desc: 'Reservoir ponds store half again as much harvested rain.' },
  { id: 'reeds', name: 'Rooted Reeds', glyph: '🌾',
    desc: 'Rice terraces endure deeper water and still bear at dawn.' },
  { id: 'lantern', name: 'Lantern Watch', glyph: '✦',
    desc: 'Houses shrug off shallow flooding that would otherwise bite.' },
  { id: 'swift', name: 'Swift Crew', glyph: '➤',
    desc: 'Every work costs a fifth less Labor, in calm or in flood.' },
];

// Deal three distinct blessings the player does not already hold.
export function dealBlessings(rng, held) {
  const pool = BLESSINGS.filter((b) => !held[b.id]);
  const dealt = [];
  while (dealt.length < 3 && pool.length > 0) {
    const pick = Math.floor(rng() * pool.length);
    dealt.push(pool.splice(pick, 1)[0]);
  }
  return dealt;
}
