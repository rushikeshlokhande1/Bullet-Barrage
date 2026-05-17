import type { WeaponDef } from "../types/game";

let ctx: AudioContext | null = null;
let menuAmbient: {
  bass: OscillatorNode;
  pulse: OscillatorNode;
  gain: GainNode;
} | null = null;

function getContext() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function envGain(audio: AudioContext, peak: number, attack: number, decay: number) {
  const gain = audio.createGain();
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  return gain;
}

function tone(freq: number, duration: number, peak: number, type: OscillatorType, destination: AudioNode) {
  const audio = getContext();
  const osc = audio.createOscillator();
  const gain = envGain(audio, peak, 0.004, duration);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.42), audio.currentTime + duration);
  osc.connect(gain).connect(destination);
  osc.start();
  osc.stop(audio.currentTime + duration + 0.03);
}

function noise(duration: number, peak: number, filterFreq: number, destination: AudioNode) {
  const audio = getContext();
  const buffer = audio.createBuffer(1, Math.max(1, audio.sampleRate * duration), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.1;
  const gain = envGain(audio, peak, 0.002, duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start();
  source.stop(audio.currentTime + duration + 0.02);
}

function masterBus(volume: number) {
  const audio = getContext();
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 9;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;
  const gain = audio.createGain();
  gain.gain.value = volume;
  compressor.connect(gain).connect(audio.destination);
  return compressor;
}

export function playWeaponFire(weapon: WeaponDef, aimed: boolean) {
  const bus = masterBus(aimed ? 0.22 : 0.28);
  const base = 150 * weapon.audio.pitch;
  const snap = 1200 * weapon.audio.pitch;
  const body = weapon.audio.thump;

  switch (weapon.audio.fire) {
    case "shotgun":
      noise(0.11, 0.55, 850, bus);
      tone(base * 0.72, 0.16, 0.5 * body, "sawtooth", bus);
      break;
    case "sniper":
      tone(base * 0.62, 0.23, 0.72 * body, "sawtooth", bus);
      noise(0.05, 0.34, 1800, bus);
      break;
    case "launcher":
      tone(base * 0.48, 0.28, 0.78 * body, "square", bus);
      noise(0.14, 0.36, 420, bus);
      break;
    case "minigun":
      tone(base * 1.3, 0.055, 0.22, "square", bus);
      noise(0.035, 0.18, 1400, bus);
      break;
    case "burst":
      tone(snap * 0.72, 0.045, 0.18, "square", bus);
      tone(base * 1.1, 0.075, 0.18, "sawtooth", bus);
      break;
    case "marksman":
      tone(base * 0.9, 0.14, 0.42 * body, "triangle", bus);
      noise(0.04, 0.22, 1200, bus);
      break;
    default:
      tone(base, 0.09, 0.3, "sawtooth", bus);
      noise(0.04, 0.2, 1800, bus);
      break;
  }
}

export function playHitMarker(kill = false) {
  const bus = masterBus(kill ? 0.22 : 0.15);
  tone(kill ? 720 : 540, 0.06, 0.16, "sine", bus);
  setTimeout(() => tone(kill ? 960 : 720, 0.05, 0.12, "sine", bus), kill ? 62 : 38);
}

export function playEliminationCue(streak = 1) {
  const bus = masterBus(0.24);
  const lift = Math.min(streak, 5) * 34;
  tone(520 + lift, 0.075, 0.14, "triangle", bus);
  setTimeout(() => tone(780 + lift, 0.07, 0.12, "sine", bus), 48);
  setTimeout(() => tone(1040 + lift, 0.08, 0.1, "sine", bus), 96);
  noise(0.08, 0.12, 2600, bus);
}

export function playExplosionCue(intensity = 1) {
  const bus = masterBus(0.24 + Math.min(intensity, 1) * 0.12);
  tone(94, 0.32, 0.46, "sawtooth", bus);
  tone(48, 0.42, 0.38, "square", bus);
  noise(0.22, 0.42, 360, bus);
  setTimeout(() => noise(0.12, 0.16, 1200, bus), 42);
}

export function playShieldHit(strength = 1) {
  const bus = masterBus(0.14 + Math.min(strength, 1) * 0.08);
  tone(920, 0.07, 0.12, "triangle", bus);
  tone(460, 0.11, 0.09, "sine", bus);
  noise(0.055, 0.11, 2400, bus);
}

export function playShieldRecharge() {
  const bus = masterBus(0.08);
  tone(360, 0.08, 0.07, "sine", bus);
  setTimeout(() => tone(540, 0.08, 0.055, "sine", bus), 58);
}

export function playReloadCue(stage = 0) {
  const bus = masterBus(0.12);
  const freq = [180, 260, 390][stage % 3];
  tone(freq, 0.055, 0.11, "triangle", bus);
  noise(0.035, 0.055, 900 + stage * 350, bus);
}

export function playUiWeaponCue(kind: "ads" | "inspect" | "empty" | "switch") {
  const bus = masterBus(0.11);
  const freq = kind === "ads" ? 240 : kind === "inspect" ? 330 : kind === "empty" ? 120 : 420;
  tone(freq, 0.045, 0.1, kind === "empty" ? "sawtooth" : "triangle", bus);
}

export function playUiClick(kind: "hover" | "confirm" | "deny" = "confirm") {
  const bus = masterBus(kind === "hover" ? 0.035 : 0.08);
  const freq = kind === "deny" ? 120 : kind === "hover" ? 520 : 420;
  tone(freq, 0.04, kind === "hover" ? 0.045 : 0.08, kind === "deny" ? "sawtooth" : "triangle", bus);
  if (kind === "confirm") setTimeout(() => tone(720, 0.035, 0.055, "sine", bus), 42);
}

export function startMenuAmbient() {
  if (menuAmbient) return;
  const audio = getContext();
  const gain = audio.createGain();
  gain.gain.value = 0.0001;

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 620;
  filter.Q.value = 0.7;

  const bass = audio.createOscillator();
  bass.type = "sawtooth";
  bass.frequency.value = 43;
  const pulse = audio.createOscillator();
  pulse.type = "triangle";
  pulse.frequency.value = 86;

  bass.connect(filter);
  pulse.connect(filter);
  filter.connect(gain).connect(audio.destination);
  bass.start();
  pulse.start();
  gain.gain.exponentialRampToValueAtTime(0.045, audio.currentTime + 0.65);
  menuAmbient = { bass, pulse, gain };
}

export function stopMenuAmbient() {
  if (!menuAmbient || !ctx) return;
  const ambient = menuAmbient;
  menuAmbient = null;
  ambient.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
  setTimeout(() => {
    ambient.bass.stop();
    ambient.pulse.stop();
    ambient.gain.disconnect();
  }, 240);
}
