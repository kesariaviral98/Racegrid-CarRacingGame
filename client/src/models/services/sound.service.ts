type EngineNodes = {
  ctx: AudioContext;
  osc: OscillatorNode;
  osc2: OscillatorNode;
  gain: GainNode;
  windGain: GainNode;
  windSrc: AudioBufferSourceNode | null;
};

let engine: EngineNodes | null = null;
let initialized = false;

const createWhiteNoiseBuffer = (ctx: AudioContext, duration: number): AudioBuffer => {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
};

const createLoopingNoise = (ctx: AudioContext, gainNode: GainNode): AudioBufferSourceNode => {
  const buf = createWhiteNoiseBuffer(ctx, 2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.8;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(filter);
  filter.connect(gainNode);
  src.start();
  return src;
};

export const initSounds = (): void => {
  if (initialized) return;
  initialized = true;

  const ctx = new AudioContext();

  // Primary engine oscillator (sawtooth)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 60;
  gain.gain.value = 0.055;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  // Secondary engine oscillator (adds harmonic richness)
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = 90;
  const gain2 = ctx.createGain();
  gain2.gain.value = 0.018;
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start();

  // Wind/rush noise
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  windGain.connect(ctx.destination);
  const windSrc = createLoopingNoise(ctx, windGain);

  engine = { ctx, osc, osc2, gain, windGain, windSrc };
};

export const setEngineSpeed = (speed: number): void => {
  if (engine === null) return;
  const { ctx, osc, osc2, windGain } = engine;
  const now = ctx.currentTime;

  // Engine pitch
  const freq = 58 + speed * 2.4;
  osc.frequency.setTargetAtTime(freq, now, 0.06);
  osc2.frequency.setTargetAtTime(freq * 1.52, now, 0.06);

  // Wind grows from 60% max speed
  const windVol = Math.max(0, (speed / 80 - 0.55) * 0.22);
  windGain.gain.setTargetAtTime(windVol, now, 0.15);
};

export const muteEngine = (): void => {
  if (engine === null) return;
  const { ctx, gain, windGain } = engine;
  const now = ctx.currentTime;
  gain.gain.setTargetAtTime(0, now, 0.3);
  windGain.gain.setTargetAtTime(0, now, 0.2);
};

const playTone = (freq: number, startAt: number, duration: number, vol: number, ctx: AudioContext): void => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
};

export const playCountdownBeep = (): void => {
  if (engine === null) return;
  playTone(880, engine.ctx.currentTime, 0.18, 0.25, engine.ctx);
};

export const playGoSound = (): void => {
  if (engine === null) return;
  const { ctx } = engine;
  const now = ctx.currentTime;
  playTone(523, now, 0.22, 0.3, ctx);
  playTone(659, now + 0.1, 0.22, 0.3, ctx);
  playTone(784, now + 0.2, 0.35, 0.35, ctx);
  playTone(1047, now + 0.32, 0.3, 0.3, ctx);
};

export const playFinishSound = (): void => {
  if (engine === null) return;
  const { ctx } = engine;
  const now = ctx.currentTime;
  [523, 659, 784, 1047, 1319].forEach((freq, i): void => {
    playTone(freq, now + i * 0.12, 0.55, 0.22, ctx);
  });
};

export const playCoinSound = (): void => {
  if (engine === null) return;
  const { ctx } = engine;
  const now = ctx.currentTime;
  playTone(1318, now, 0.07, 0.2, ctx);
  playTone(1760, now + 0.06, 0.07, 0.16, ctx);
  playTone(2093, now + 0.1, 0.05, 0.12, ctx);
};

export const playTireScreech = (intensity: number): void => {
  if (engine === null || intensity < 0.5) return;
  const { ctx } = engine;
  const bufferSize = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.14 * intensity;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
};

export const playCrashSound = (): void => {
  if (engine === null) return;
  const { ctx } = engine;
  const now = ctx.currentTime;

  // Low thud
  const thudOsc = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(120, now);
  thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
  thudGain.gain.setValueAtTime(0.6, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  thudOsc.connect(thudGain);
  thudGain.connect(ctx.destination);
  thudOsc.start(now);
  thudOsc.stop(now + 0.4);

  // Noise burst (crunch)
  const bufferSize = Math.floor(ctx.sampleRate * 0.18);
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize) * 0.35;
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.8;
  noiseSrc.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSrc.start(now);
};
