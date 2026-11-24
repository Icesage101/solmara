// audio.js — all sound is synthesized with WebAudio: no audio files, no
// network. One job: turn game events (a punch, a shot, a siren, cash)
// into short noises, and keep an engine hum under driving.

let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    ctx = null; // no audio available: the game plays silently
  }
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noiseBurst(dur, vol, freq) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
}

export function sfx(name) {
  if (!ctx) return;
  if (name === 'punch') noiseBurst(0.08, 0.5, 500);
  else if (name === 'shot') { noiseBurst(0.12, 0.6, 2400); blip(160, 0.08, 'square', 0.2, 60); }
  else if (name === 'crash') noiseBurst(0.25, 0.7, 700);
  else if (name === 'cash') { blip(880, 0.09, 'sine', 0.25); setTimeout(() => blip(1320, 0.12, 'sine', 0.25), 70); }
  else if (name === 'door') blip(220, 0.07, 'triangle', 0.3, 140);
  else if (name === 'fail') blip(300, 0.3, 'sawtooth', 0.2, 110);
  else if (name === 'win') { blip(660, 0.1, 'sine', 0.25); setTimeout(() => blip(990, 0.16, 'sine', 0.25), 90); }
}

// Engine hum and police siren are loops whose pitch follows the game:
// engine pitch tracks the player's car speed, the siren wails while the
// wanted level is up. Both are created lazily and parked at zero gain.
export function updateAudioLoops(drivingSpeed, wantedStars) {
  if (!ctx) return;
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain).connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'triangle';
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(ctx.destination);
    sirenOsc.start();
  }
  const speed = Math.abs(drivingSpeed || 0);
  engineGain.gain.value = speed > 4 ? 0.05 : 0;
  engineOsc.frequency.value = 55 + speed * 0.35;
  const t = ctx.currentTime;
  sirenGain.gain.value = wantedStars > 0 ? 0.028 : 0;
  sirenOsc.frequency.value = 720 + Math.sin(t * 5.2) * 190;
}
