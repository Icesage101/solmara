// Synthesized sound for Solmara: no audio files, everything is built with WebAudio
// oscillators and filtered noise, so the game stays silent on the network.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = 0; if (sirenGain) sirenGain.gain.value = 0; },
    engine(speedRatio, driving) {
      if (!ctx || muted || !engineGain) return;
      const target = driving ? 0.045 + speedRatio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, ctx.currentTime, 0.08);
    },
    siren(on, dt) {
      if (!ctx || !sirenOsc || muted) return;
      if (on) {
        sirenTimer += dt;
        const f = Math.sin(sirenTimer * 5.2) > 0 ? 760 : 540;
        sirenOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.03);
        sirenGain.gain.setTargetAtTime(0.028, ctx.currentTime, 0.1);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    punch() { noise(0.09, 0.25, 900); tone(140, 0.08, 'square', 0.1, 70); },
    shoot() { noise(0.14, 0.4, 2400); tone(220, 0.1, 'square', 0.14, 60); },
    crash() { noise(0.3, 0.4, 700); tone(90, 0.25, 'sawtooth', 0.16, 40); },
    pickup() { tone(660, 0.09, 'sine', 0.14); setTimeout(() => tone(990, 0.12, 'sine', 0.14), 70); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 110));
    },
    missionFail() { tone(320, 0.4, 'sawtooth', 0.12, 140); },
    busted() { tone(440, 0.5, 'square', 0.1, 220); tone(330, 0.6, 'square', 0.1, 165); },
    click() { tone(800, 0.05, 'sine', 0.08); },
  };
}
