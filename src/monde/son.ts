// The sound of the game: one audio context for the page, woken by the first touch or key (a browser lets a page sound
// only then) and asleep while the page is hidden. The music (musique-son.ts), the song's voice (chant-son.ts) and the
// noises of the sea (bruits-son.ts) each have their bus and their volume (the settings panel), and share one reverb
// made in the code. Under a note of the song, the music steps back a little.

import { clamp, rng } from '../engine';
import { volumeGain } from './musique';

export interface Volumes { musique: number; chant: number; bruits: number }
/** the volumes the mix is made for (0..1) */
export const VOLUMES: Volumes = { musique: 0.7, chant: 0.8, bruits: 0.7 };
const STORE = 'lignee.son';

/** the volumes kept in the browser's storage, each in 0..1; the defaults for what is missing or unreadable */
export function parseVolumes(raw: string | null): Volumes {
  const v = { ...VOLUMES };
  try {
    const o = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    for (const k of Object.keys(v) as (keyof Volumes)[]) {
      const x = o?.[k];
      if (typeof x === 'number' && Number.isFinite(x)) v[k] = clamp(x, 0, 1);
    }
  } catch { /* the defaults */ }
  return v;
}

/**
 * The response of the reverb, `seconds` long: a few early echoes off near walls, then a noise that fades and darkens
 * as it fades. One channel: a single convolution costs half of two, and the dry sound keeps its sides.
 */
export function impulse(rate: number, seconds: number, seed = 7): Float32Array {
  const n = Math.max(1, Math.floor(rate * seconds)), r = rng(seed), d = new Float32Array(n), pre = Math.floor(rate * 0.012);
  let lp = 0;
  for (let i = pre; i < n; i++) {
    const u = i / n, k = 0.95 - 0.8 * u;
    // a one-pole low-pass closing along the tail, its loss of loudness made up
    lp += (r() * 2 - 1 - lp) * k;
    d[i] = (lp / Math.sqrt(k / (2 - k))) * Math.pow(1 - u, 2.2) * 0.5;
  }
  for (let e = 0; e < 6; e++) {
    const i = pre + Math.floor(rate * (0.008 + 0.07 * r()));
    if (i < n) d[i] += (r() < 0.5 ? -1 : 1) * 0.4 * (1 - e * 0.12);
  }
  return d;
}

/** the nodes of the sound, on a live context or an offline one (tests, report) */
export interface Graph {
  c: BaseAudioContext;
  /** where the music comes in (its level is set here), then the water's low-pass */
  music: GainNode; musicCut: BiquadFilterNode;
  /** where the song's notes come in */
  voice: GainNode;
  /** where the noises come in, and where the far ones come in that are only heard in the reverb */
  fx: GainNode; far: GainNode;
  /** how much of each goes to the reverb */
  musicSend: GainNode; voiceSend: GainNode; fxSend: GainNode;
  /** the dip of the music under the song, its fade in, its volume; the song's volume; the noises' volume */
  duck: GainNode; fade: GainNode; musicVol: GainNode; voiceVol: GainNode; fxVol: GainNode; farVol: GainNode;
  /** a second of white noise (the breath of some notes) */
  noise: AudioBuffer;
  /** what comes out */
  meter: AnalyserNode;
}

/** the level of the music at its bus, so that it sits under the song */
export const MUSIC_LEVEL = 0.2;
/** the level of the noises at their bus, so that they sit under the music */
export const FX_LEVEL = 0.25;

export function buildGraph(c: BaseAudioContext, v: Volumes = VOLUMES): Graph {
  const master = c.createGain(), comp = c.createDynamicsCompressor(), meter = c.createAnalyser();
  master.gain.value = 0.6;
  comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.3;
  meter.fftSize = 2048;
  master.connect(comp).connect(c.destination);
  comp.connect(meter);
  const d = impulse(c.sampleRate, 2.4), ir = c.createBuffer(1, d.length, c.sampleRate), rev = c.createConvolver();
  ir.getChannelData(0).set(d);
  try { rev.channelCount = 1; rev.channelCountMode = 'explicit'; } catch { /* two convolutions then */ }
  rev.buffer = ir;
  rev.connect(master);
  // the music: the water's low-pass, the dip under the song, the fade in, the volume; then dry and into the reverb
  const music = c.createGain(), musicCut = c.createBiquadFilter(), duck = c.createGain(), fade = c.createGain(), musicVol = c.createGain();
  music.gain.value = MUSIC_LEVEL;
  musicCut.type = 'lowpass';
  musicCut.frequency.value = 16000;
  musicCut.Q.value = 0.5;
  fade.gain.value = 0;
  musicVol.gain.value = volumeGain(v.musique, VOLUMES.musique);
  music.connect(musicCut).connect(duck).connect(fade).connect(musicVol).connect(master);
  const musicSend = c.createGain();
  musicSend.gain.value = 0.4;
  musicVol.connect(musicSend).connect(rev);
  // the song
  const voice = c.createGain(), voiceVol = c.createGain(), voiceSend = c.createGain();
  voiceVol.gain.value = volumeGain(v.chant, VOLUMES.chant);
  voiceSend.gain.value = 0.42;
  voice.connect(voiceVol).connect(master);
  voiceVol.connect(voiceSend).connect(rev);
  // the noises (bruits-son.ts sets how much of them goes to the reverb, place by place)
  const fx = c.createGain(), fxVol = c.createGain(), fxSend = c.createGain(), far = c.createGain(), farVol = c.createGain();
  fx.gain.value = far.gain.value = FX_LEVEL;
  fxVol.gain.value = farVol.gain.value = volumeGain(v.bruits, VOLUMES.bruits);
  fxSend.gain.value = 0.3;
  fx.connect(fxVol).connect(master);
  fxVol.connect(fxSend).connect(rev);
  far.connect(farVol).connect(rev);
  const noise = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = noise.getChannelData(0), nr = rng(11);
  for (let i = 0; i < nd.length; i++) nd[i] = nr() * 2 - 1;
  return { c, music, musicCut, voice, fx, far, musicSend, voiceSend, fxSend, duck, fade, musicVol, voiceVol, fxVol, farVol, noise, meter };
}

/** the music steps back under a note of the song at t, and comes back after `hold` s */
export function duckAt(g: Graph, t: number, depth = 0.45, hold = 1.1): void {
  const p = g.duck.gain;
  p.cancelScheduledValues(t);
  p.setTargetAtTime(1 - depth, t, 0.05);
  p.setTargetAtTime(1, t + hold, 0.8);
}

/** these nodes let go once `src` has ended (and `then`, for what else held on to them) */
export function release(src: AudioScheduledSourceNode, nodes: AudioNode[], then?: () => void): void {
  src.onended = () => {
    for (const n of nodes) n.disconnect();
    then?.();
  };
}

export interface Son {
  /** the nodes, once the page has been touched */
  readonly graph: Graph | null;
  /** true while the page sounds */
  readonly awake: boolean;
  /** called once the nodes exist (at once if they do) */
  onWake(f: (g: Graph) => void): void;
  readonly volumes: Volumes;
  /** a volume of the settings (0..1), kept in the browser's storage */
  setVolume(k: keyof Volumes, v: number): void;
  /** the music steps back under a note of the song */
  duck(): void;
}

let one: Son | null = null;

/** the sound of the page, made the first time it is asked for */
export function son(): Son {
  return (one ??= createSon());
}

type AC = typeof AudioContext;

function createSon(): Son {
  let ac: AudioContext | null = null, graph: Graph | null = null;
  let stored: string | null = null;
  try { stored = localStorage.getItem(STORE); } catch { /* private mode */ }
  const volumes = parseVolumes(stored);
  const wakers: ((g: Graph) => void)[] = [];

  function wake(): void {
    if (!ac) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
      if (!Ctor) return;
      try { ac = new Ctor(); } catch { return; }
      graph = buildGraph(ac, volumes);
      // the music comes in slowly
      graph.fade.gain.setTargetAtTime(1, ac.currentTime + 0.2, 2.2);
      for (const f of wakers) f(graph);
    }
    if (ac.state !== 'running' && !document.hidden) void ac.resume().catch(() => { /* waits for the next touch */ });
  }
  // the gestures that let a page sound (a touch counts when the finger lifts); they stay, to wake it again after a
  // phone call or another app took the sound
  for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(ev, wake, true);
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) void ac.suspend().catch(() => { /* ignore */ });
    else void ac.resume().catch(() => { /* waits for the next touch */ });
  });

  const gainsOf = (k: keyof Volumes) => (!graph ? [] : k === 'musique' ? [graph.musicVol] : k === 'chant' ? [graph.voiceVol] : [graph.fxVol, graph.farVol]);
  return {
    get graph() { return graph; },
    get awake() { return ac?.state === 'running'; },
    onWake(f) { wakers.push(f); if (graph) f(graph); },
    get volumes() { return volumes; },
    setVolume(k, v) {
      volumes[k] = clamp(v, 0, 1);
      if (ac) for (const g of gainsOf(k)) g.gain.setTargetAtTime(volumeGain(volumes[k], VOLUMES[k]), ac.currentTime, 0.05);
      try { localStorage.setItem(STORE, JSON.stringify(volumes)); } catch { /* ignore */ }
    },
    duck() { if (graph && ac) duckAt(graph, ac.currentTime); }
  };
}
