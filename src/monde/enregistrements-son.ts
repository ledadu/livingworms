// The recordings of the ambience, loaded and decoded (enregistrements.ts says what each is). The files are inlined in
// the published page (a data: URL each, vite.config.ts) and served beside it in dev. Nothing is read before the page
// may sound: then they are decoded one after the other, without holding up the game, and kept decoded for as long as
// the audio context lives. Until a recording is ready (or if the browser cannot decode it), the sound made in the
// code plays in its place.

import { RECS, LOAD_ORDER, cues, dataBytes, loopable, type Cue, type RecName } from './enregistrements';

/** the files of src/monde/sons/, by name */
export const FILES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('./sons/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([path, url]) => [path.replace(/^.*\/|\.mp3$/g, ''), url])
);

/** a recording ready to play: its sound, and its noises if it holds several */
export interface Rec { name: RecName; buffer: AudioBuffer; cues: Cue[]; }

async function decode(c: BaseAudioContext, name: RecName): Promise<Rec | null> {
  const url = FILES[name];
  if (!url) return null;
  try {
    const bytes = dataBytes(url) ?? (await (await fetch(url)).arrayBuffer());
    const raw = await c.decodeAudioData(bytes), d = raw.getChannelData(0), k = RECS[name];
    if (k.loop) {
      const l = loopable(d, raw.sampleRate, k.loop), b = c.createBuffer(1, l.length, raw.sampleRate);
      b.getChannelData(0).set(l);
      return { name, buffer: b, cues: [] };
    }
    return { name, buffer: raw, cues: k.cues ? cues(d, raw.sampleRate, k.cues.rise, k.cues.max, k.cues.min) : [] };
  } catch {
    return null;
  }
}

export interface Recordings {
  /** a recording if it is ready, else null (the sound made in the code then) */
  get(name: RecName): Rec | null;
  /** once all have been tried */
  readonly ready: Promise<void>;
}

const all = new WeakMap<BaseAudioContext, Recordings>();

/** the recordings for this context: they start loading the first time they are asked for, then stay */
export function recordings(c: BaseAudioContext): Recordings {
  let r = all.get(c);
  if (r) return r;
  const got = new Map<RecName, Rec>();
  const ready = (async () => {
    for (const name of LOAD_ORDER) {
      const rec = await decode(c, name);
      if (rec) got.set(name, rec);
    }
  })();
  r = { get: (name) => got.get(name) ?? null, ready };
  all.set(c, r);
  return r;
}

/** no recordings at all: the sounds made in the code only (the report, to compare) */
export const NO_RECORDINGS: Recordings = { get: () => null, ready: Promise.resolve() };
