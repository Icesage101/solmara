// Solmara — sound, synthesized live with WebAudio. No audio files, no network:
// every effect is an oscillator or a burst of filtered noise, built when it is needed.
// The context starts on the first key press (browsers forbid sound before input), and
// everything stays quiet if the context never starts.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return !!ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    punch() { tone(110, 0.12, 'triangle', 0.35, 55); noise(0.08, 0.2, 500); },
    gunshot() { noise(0.16, 0.5, 2600); tone(180, 0.08, 'square', 0.18, 60); },
    crash() { noise(0.25, 0.4, 700); tone(70, 0.2, 'sawtooth', 0.2, 40); },
    pickup() { tone(660, 0.1, 'sine', 0.22); setTimeout(() => tone(880, 0.14, 'sine', 0.22), 90); },
    missionStart() { tone(440, 0.12, 'sine', 0.22); setTimeout(() => tone(554, 0.12, 'sine', 0.22), 110); setTimeout(() => tone(659, 0.2, 'sine', 0.22), 220); },
    missionComplete() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.25), i * 120)); },
    missionFail() { tone(330, 0.25, 'sawtooth', 0.18, 165); },
    thugDown() { tone(220, 0.15, 'triangle', 0.25, 110); },
    sirenBlip() { tone(880, 0.18, 'sine', 0.15, 660); },
    busted() { tone(392, 0.3, 'sawtooth', 0.2, 196); },
    // The engine hum follows the player's car speed; call it every frame.
    engine(speed, topSpeed) {
      if (!ensure()) return;
      if (Math.abs(speed) < 12) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const ratio = Math.abs(speed) / topSpeed;
      engineOsc.frequency.value = 55 + ratio * 130;
      engineGain.gain.value = 0.045 + ratio * 0.05;
    },
    // The two-tone police siren, on while the wanted level is high.
    siren(dt, wanted) {
      if (!ensure()) return;
      if (wanted < 2) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      }
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenPhase = sirenPhase === 0 ? 1 : 0;
      }
      sirenOsc.frequency.value = sirenPhase === 0 ? 715 : 960;
      sirenGain.gain.value = 0.035;
    },
  };
}

// Silence the loops (engine hum, siren) when the game pauses or the title returns.
export function stopLoops(audio) {
  if (audio && audio.engine) audio.engine(0, 1);
  if (audio && audio.siren) audio.siren(0, 0);
}
