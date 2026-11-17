// All of FLOODLINE's sound is synthesised WebAudio: filtered noise for the
// rain and the river's rush, a low rumble for thunder when a surge is named,
// and pentatonic plucks — a nod to the gamelan — for dawns and victories.
// Nothing loads; the context wakes on the player's first click, and every
// call is safe before that (it simply stays silent).

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export function createAudio() {
  let ctx = null;
  let master = null;
  let rainGain = null;
  let rushGain = null;
  let muted = false;

  function noiseBuffer(c) {
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    const buf = noiseBuffer(ctx);
    const mkLoop = (freq, type, gainVal) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type; filter.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = gainVal;
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start();
      return g;
    };
    rainGain = mkLoop(900, 'lowpass', 0.05);
    rushGain = mkLoop(340, 'bandpass', 0.0);
  }

  function env(node, t0, peak, decay) {
    node.gain.setValueAtTime(0, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    node.gain.exponentialRampToValueAtTime(0.0008, t0 + decay);
  }

  function tone(freq, type, peak, decay, slideTo) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + decay);
    const g = ctx.createGain();
    env(g, t0, peak, decay);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + decay + 0.05);
  }

  return {
    unlock,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
      return muted;
    },
    setRain(level) { if (rainGain && ctx) rainGain.gain.setTargetAtTime(0.02 + level * 0.075, ctx.currentTime, 0.4); },
    setRush(level) { if (rushGain && ctx) rushGain.gain.setTargetAtTime(Math.min(0.22, level * 0.2), ctx.currentTime, 0.3); },
    click() { tone(660, 'square', 0.06, 0.07); },
    dig() { tone(180, 'triangle', 0.12, 0.12, 90); },
    thud() { tone(90, 'sine', 0.22, 0.2, 45); },
    gate() { tone(1150, 'square', 0.07, 0.05, 320); },
    error() { tone(140, 'sawtooth', 0.08, 0.14); },
    splashBig() { tone(300, 'triangle', 0.1, 0.3, 70); },
    thunder() {
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t0);
      filter.frequency.exponentialRampToValueAtTime(55, t0 + 1.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.5);
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + 1.6);
      tone(58, 'sine', 0.25, 1.1, 30);
    },
    pluckSeq(notes, gap = 0.13) {
      if (!ctx) return;
      notes.forEach((n, i) => {
        setTimeout(() => tone(PENTA[n % PENTA.length], 'triangle', 0.14, 0.5), i * gap * 1000);
      });
    },
    dawn() { this.pluckSeq([0, 2, 4, 3, 5], 0.12); },
    victory() { this.pluckSeq([0, 1, 2, 3, 4, 5, 4, 2], 0.11); },
    defeat() { this.pluckSeq([3, 2, 1, 0], 0.2); },
  };
}
