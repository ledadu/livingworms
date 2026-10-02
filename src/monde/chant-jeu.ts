// The song in the game (chant.ts). The note of each chapter is learned by the generation there, once the chapter's
// opening has been told; the circle of notes (chant-cercle.ts) traces a song, the voice (chant-son.ts) sings it, and
// the animals around answer: a ring of light in the colour of the note, its echo an octave up, and they come a little
// toward the singer. The lights are drawn on a canvas of their own over the sea, and over its dark.

import type { Creature3 } from '../engine3/creature3';
import type { Proj, View } from '../engine3/view';
import { biomeIndex, type ChapterId } from './biomes';
import { GAP, HEARD, NOTES, answersTo, learnedNotes, noteColour, noteOf, type Answer, type Note } from './chant';
import { initCercle } from './chant-cercle';
import { createVoice } from './chant-son';
import { hear, panOnScreen } from './ecoute';
import { glowOf } from './fosse';
import type { LearnedNote } from './partie';

/** what the song needs of an animal of the sea (main.ts) */
export interface Hearer { cr: Creature3; kind: string; z: number; hx: number; tx: number; ty: number; next: number }

export interface ChantDeps {
  partie: { readonly saved: { chapter: string; notes?: LearnedNote[] }; learn(chapter: string): void };
  /** the chapters of the map, in order */
  order: readonly ChapterId[];
  view: View;
  /** words on the sea, a scene or a panel over it: a note waits to be learned */
  busy(): boolean;
  /** an animal busy elsewhere (leading the parade) does not come */
  held?(a: Hearer): boolean;
}

/** how much light an animal must carry to answer any song (glowOf: a lantern ≈ 30, a glowing tip ≈ 10) */
const GLOWS = 8;
/** how long the sea stays quiet before a note is learned (s) */
const SETTLE = 1.4;

/** a light of the song in the sea, on a creature (the singer, or an animal that answers) */
interface Light { kind: 'song' | 'answer' | 'learn'; note: Note; at: Creature3; t0: number; dur: number; size: number }
interface Song { notes: number[]; t0: number; sung: number; singer: Creature3; answers: (Answer & { a: Hearer; done: boolean })[]; end: number }

export function initChant(d: ChantDeps) {
  const voice = createVoice();
  const known = () => learnedNotes(d.partie.saved, d.order);
  const knows = (i: number) => known().includes(NOTES[i].chapter);
  const cercle = initCercle({
    known: knows,
    touch: (i) => voice.note(NOTES[i].chapter, NOTES[i].freq, { gain: 0.55 }),
    sing: (song) => sing(song),
    centre: () => {
      if (!singer) return null;
      const r = singer.root;
      d.view.project(r.x[0], r.y[0], r.z[0], P);
      return { x: P.x, y: P.y };
    }
  });
  cercle.refresh();

  const canvas = document.createElement('canvas');
  canvas.id = 'chantSea';
  canvas.hidden = true;
  (document.getElementById('vig') ?? document.getElementById('sea'))?.after(canvas);
  const g = canvas.getContext('2d')!;
  const glyphs = new Map<Note, Path2D>();
  const P: Proj = { x: 0, y: 0, s: 1, d: 1 };

  let now = 0, waitFor: ChapterId | null = null, quietAt = 0;
  let singer: Creature3 | null = null, sea: readonly Hearer[] = [];
  let song: Song | null = null, lights: Light[] = [];
  const noteListeners: ((chapter: ChapterId, k: number) => void)[] = [];
  const lightListeners: ((kind: Light['kind'], chapter: ChapterId, at: Creature3) => void)[] = [];
  /** a light of the song starts in the sea */
  function shine(l: Light): void {
    lights.push(l);
    for (const f of lightListeners) f(l.kind, l.note.chapter, l.at);
  }

  function learn(chapter: ChapterId): void {
    const n = noteOf(chapter);
    if (!n || known().includes(chapter)) return;
    d.partie.learn(chapter);
    cercle.learned(n);
    voice.note(chapter, n.freq, { gain: 0.8 });
    if (singer) shine({ kind: 'learn', note: n, at: singer, t0: now, dur: 3.6, size: 200 });
  }

  /** the song (ranks in NOTES) sung by the swimmer now: who hears it answers */
  function sing(notes: number[]): void {
    const me = singer;
    notes = notes.filter(knows);
    if (!me || !notes.length) return;
    const x = me.root.x[0], y = me.root.y[0];
    // (the sisters of the first larva swim with the singer: they do not answer it; a friend sings with it, amis-jeu.ts)
    const near = sea.filter((a) => a.cr !== me && a.kind !== 'sib' && a.kind !== 'ami' && Math.abs(a.cr.root.x[0] - x) < HEARD);
    const ls = near.map((a) => ({
      x: a.cr.root.x[0], y: a.cr.root.y[0], z: a.cr.root.z[0], chapter: biomeIndex(a.hx), glows: glowOf(a.cr.list) > GLOWS
    }));
    const answers = answersTo(notes.map((i) => d.order.indexOf(NOTES[i].chapter)), { x, y }, ls).map((an) => ({ ...an, a: near[an.who], done: false }));
    const t0 = now + 0.15;
    song = { notes, t0, sung: 0, singer: me, answers, end: t0 + Math.max(notes.length * GAP, ...answers.map((an) => an.at)) + 3 };
  }

  /** an animal that answered comes a little toward the singer, then goes back to its life */
  function come(a: Hearer, to: Creature3): void {
    if ((a.kind !== 'swim' && a.kind !== 'floor') || d.held?.(a)) return;
    const x = a.cr.root.x[0], y = a.cr.root.y[0], dx = to.root.x[0] - x, dy = to.root.y[0] - y, dd = Math.hypot(dx, dy) || 1;
    if (dd < 180) return;
    a.tx = to.root.x[0] - (dx / dd) * 150;
    if (a.kind === 'swim') a.ty = to.root.y[0] - (dy / dd) * 150;
    a.next = now + 7;
  }

  function step(t: number, me: Creature3, actors: readonly Hearer[], shown: number): void {
    now = t;
    singer = me;
    sea = actors;
    // the chapter's note, once the sea is quiet a moment after its opening
    const id = shown >= 0 ? d.order[shown] : null;
    if (id && noteOf(id) && !known().includes(id)) {
      if (waitFor !== id || d.busy() || cercle.isOpen) { waitFor = id; quietAt = t + SETTLE; }
      else if (t >= quietAt) learn(id);
    }
    const s = song;
    if (!s) return;
    while (s.sung < s.notes.length && t >= s.t0 + s.sung * GAP) {
      const n = NOTES[s.notes[s.sung]];
      voice.note(n.chapter, n.freq, { gain: 0.9 });
      shine({ kind: 'song', note: n, at: s.singer, t0: t, dur: 2.4, size: 250 });
      for (const f of noteListeners) f(n.chapter, s.sung);
      s.sung++;
    }
    for (const an of s.answers) {
      if (an.done || t < s.t0 + an.at) continue;
      an.done = true;
      const n = NOTES[s.notes[an.k]], cr = an.a.cr, r = cr.root;
      d.view.project(r.x[0], r.y[0], r.z[0], P);
      // near, loud and clear; far, quieter, duller, in the reverb; from its side of the screen
      const h = hear(r.x[0] - s.singer.root.x[0], r.y[0] - s.singer.root.y[0], r.z[0], undefined, panOnScreen(P.x, d.view.W));
      voice.note(n.chapter, n.freq, { gain: 0.5 * h.g, pan: h.pan, octave: 1, far: h });
      shine({ kind: 'answer', note: n, at: cr, t0: t, dur: 2.8, size: 90 + r.rad[0] * 4 });
      come(an.a, s.singer);
    }
    if (t > s.end) song = null;
  }

  // ----- the lights ----- //

  let drawn = false;
  function glyph(n: Note, x: number, y: number, px: number, a: number): void {
    let p = glyphs.get(n);
    if (!p) glyphs.set(n, (p = new Path2D(n.glyph)));
    const k = px / 24;
    g.save();
    g.translate(x - 12 * k, y - 12 * k);
    g.scale(k, k);
    g.lineWidth = 1.7 / Math.min(1.6, k);
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = noteColour(n, a);
    g.stroke(p);
    g.restore();
  }
  function ring(x: number, y: number, r: number, w: number, n: Note, a: number): void {
    g.beginPath();
    g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    g.lineWidth = w;
    g.strokeStyle = noteColour(n, a);
    g.stroke();
  }
  function halo(x: number, y: number, r: number, n: Note, a: number): void {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, noteColour(n, a));
    gr.addColorStop(1, noteColour(n, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function draw(): void {
    lights = lights.filter((l) => now - l.t0 < l.dur);
    if (!lights.length) {
      if (drawn) { g.clearRect(0, 0, canvas.width, canvas.height); canvas.hidden = true; drawn = false; }
      return;
    }
    const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(1.5, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    }
    canvas.hidden = false;
    drawn = true;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const u = (now - l.t0) / l.dur, o = l.at.root;
      d.view.project(o.x[0], o.y[0], o.z[0], P);
      const grow = 1 - Math.pow(1 - u, 3), fade = Math.pow(1 - u, 1.6), s = P.s;
      if (l.kind === 'song') {
        ring(P.x, P.y, l.size * s * (0.1 + 0.9 * grow), 1.5 + 3 * (1 - u), l.note, 0.7 * fade);
        if (u < 0.45) glyph(l.note, P.x, P.y - 58 * s - 30 * u, 30, 1 - u / 0.45);
      } else if (l.kind === 'answer') {
        const on = Math.sin(Math.PI * Math.min(1, u * 1.6));
        halo(P.x, P.y, (30 + l.size * 0.35) * s, l.note, 0.32 * on);
        ring(P.x, P.y, l.size * s * (0.2 + 0.8 * grow), 1 + 2.5 * (1 - u), l.note, 0.85 * fade);
        glyph(l.note, P.x, P.y - (l.size * 0.55 + 20 * u) * s - 12, Math.max(14, 26 * s), 0.9 * on);
      } else {
        // a note learned: it blooms around the swimmer, twice, and its shape rises
        const on = Math.min(1, u * 6) * (1 - u);
        halo(P.x, P.y, 120 * s, l.note, 0.35 * on);
        ring(P.x, P.y, l.size * s * (0.15 + 0.85 * grow), 2 + 3 * (1 - u), l.note, 0.9 * fade);
        if (u > 0.2) ring(P.x, P.y, l.size * s * (1 - Math.pow(1 - (u - 0.2) / 0.8, 3)), 1.5, l.note, 0.6 * Math.pow(1 - (u - 0.2) / 0.8, 1.6));
        glyph(l.note, P.x, P.y - 70 * s - 26 * u, 44, on);
      }
    }
    g.globalCompositeOperation = 'source-over';
  }

  return {
    get isOpen() { return cercle.isOpen; },
    open: () => cercle.open(),
    close: () => cercle.close(),
    button: cercle.button,
    /** the chapters whose note is known, in the order of the descent */
    get learned(): ChapterId[] { return known(); },
    /** learn the note of a chapter now (tests) */
    learn,
    /** sing these notes, by chapter (tests); only those learned are sung */
    sing: (chapters: ChapterId[]) => sing(chapters.map((c) => NOTES.findIndex((n) => n.chapter === c)).filter((i) => i >= 0)),
    /** called for each note as it is sung into the sea: its chapter and its rank in the song */
    onNote(f: (chapter: ChapterId, k: number) => void) { noteListeners.push(f); },
    /** called as each light of the song starts: its kind (a note sung, an answer, a note learned), its note, its creature */
    onLight(f: (kind: Light['kind'], chapter: ChapterId, at: Creature3) => void) { lightListeners.push(f); },
    /** the answers to the song being sung (tests): the animal, the chapter of the note it answers, when (s after the song starts) */
    get answers() { return (song?.answers ?? []).map((an) => ({ name: an.a.cr.spec.name, chapter: NOTES[song!.notes[an.k]].chapter, at: an.at, done: an.done })); },
    get voice() { return voice; },
    /** an animal sings this note, an octave up, with its light (a friend, amis-jeu.ts) */
    echo(cr: Creature3, chapter: ChapterId): void {
      const n = noteOf(chapter);
      if (!n) return;
      const r = cr.root;
      d.view.project(r.x[0], r.y[0], r.z[0], P);
      voice.note(n.chapter, n.freq, { gain: 0.4, octave: 1, pan: panOnScreen(P.x, d.view.W) });
      shine({ kind: 'answer', note: n, at: cr, t0: now, dur: 2.4, size: 80 + r.rad[0] * 4 });
    },
    step,
    draw
  };
}

export type Chant = ReturnType<typeof initChant>;
