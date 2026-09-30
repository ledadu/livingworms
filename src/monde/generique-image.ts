// The keepsake image (generique.ts): the lineage tree drawn in a canvas, as a slice of the sea it went down. The water
// behind each generation is that of the chapter where it was born, lighter at the top where the first larva was born,
// darker down to the last; the thread of light, the portraits, the names and the partners as in the tree.

import { css, type HSL } from './palette';
import { generationLabel, bornWords, type Generation } from './arbre';
import type { Mate } from './partie';
import { bandColour, souvenirLayout, type SouvenirLayout } from './generique';

export interface SouvenirInput {
  gens: Generation[];
  chapters: readonly { id: string; name: string; top: HSL; deep: HSL }[];
  /** the portrait of a generation, and the small one of a partner (null: none) */
  portrait(g: Generation): HTMLCanvasElement | null;
  mate(m: Mate): HTMLCanvasElement | null;
  /** the notes of the song it learned, in words (« a appris l’éclat »), or '' */
  notes?(g: Generation): string;
  title: string;
  /** the words at the bottom, one per line */
  foot: string[];
}

const SERIF = "'Cormorant Garamond', Georgia, serif";
const INK = '#f4efe2', GOLD = '246,217,138', MATE_BLUE = '143,216,232';
/** the thread, the portraits' sizes, where the words start */
const TX = 250, PR = [118, 88] as const, MR = [60, 44] as const, TEXT_X = 400, RIGHT = 1030;

/** the fonts of the game, once loaded (the canvas does not wait for them), or the fallback after a while */
export function fontsReady(ms = 1500): Promise<unknown> {
  const f = document.fonts;
  if (!f?.load) return Promise.resolve();
  const all = Promise.all([`300 64px ${SERIF}`, `500 52px ${SERIF}`, `italic 400 32px ${SERIF}`].map((s) => f.load(s).catch(() => null)));
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}

/** a line of text shrunk until it fits */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, px: number, max: number): void {
  ctx.font = font(px);
  while (px > 18 && ctx.measureText(text).width > max) ctx.font = font((px -= 2));
}

function spaced(ctx: CanvasRenderingContext2D, px: number): void {
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
}

/** a medallion: an oval of the chapter's water, the creature inside, a ring of light */
function medallion(ctx: CanvasRenderingContext2D, x: number, y: number, [rx, ry]: readonly [number, number], water: HSL, img: HTMLCanvasElement | null, ring: string, width: number, glow = 0): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x, y - ry * 0.1, 0, x, y, rx);
  g.addColorStop(0, css({ ...water, l: Math.min(40, water.l + 16) }, 0.97));
  g.addColorStop(0.72, css({ ...water, l: Math.max(4, water.l - 6) }, 0.98));
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,10,16,0.5)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  if (img && img.width) {
    const k = Math.min((rx * 2) / img.width, (ry * 2) / img.height);
    ctx.drawImage(img, x - (img.width * k) / 2, y - (img.height * k) / 2, img.width * k, img.height * k);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = width;
  if (glow) { ctx.shadowColor = `rgba(${GOLD},0.55)`; ctx.shadowBlur = glow; }
  ctx.stroke();
  ctx.restore();
}

/** the image, drawn now (the portraits must be ready, and the fonts too: fontsReady) */
export function drawSouvenir(inp: SouvenirInput): { canvas: HTMLCanvasElement; layout: SouvenirLayout } {
  const { gens, chapters } = inp;
  const L = souvenirLayout(gens, inp.foot.length);
  const cv = document.createElement('canvas');
  cv.width = L.w;
  cv.height = L.h;
  const ctx = cv.getContext('2d')!;
  ctx.scale(L.scale, L.scale);
  const W = L.w / L.scale, H = L.full;
  const chapter = (id: string) => chapters.find((c) => c.id === id) ?? chapters[0];
  const water = (g: Generation) => bandColour(chapter(g.bornIn));

  // the water: from under the surface, down each generation's chapter, into the dark
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  const first = water(gens[0]);
  bg.addColorStop(0, css({ ...first, l: first.l + 12 }));
  gens.forEach((g, i) => bg.addColorStop(Math.min(1, L.gens[i] / H), css(water(g))));
  const last = water(gens[gens.length - 1]);
  bg.addColorStop(1, css({ ...last, l: Math.max(3, last.l * 0.45) }));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // light coming down from the surface, and the marine snow
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, w, a] of [[180, 140, 0.07], [520, 220, 0.06], [860, 160, 0.05]] as const) {
    const ray = ctx.createLinearGradient(0, 0, 0, Math.min(H, 1500));
    ray.addColorStop(0, `rgba(255,248,220,${a})`);
    ray.addColorStop(1, 'rgba(255,248,220,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, 0);
    ctx.lineTo(x + w / 2, 0);
    ctx.lineTo(x + w * 0.9 + 160, Math.min(H, 1500));
    ctx.lineTo(x - w * 0.2 + 160, Math.min(H, 1500));
    ctx.fill();
  }
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0, n = Math.round(H / 9); i < n; i++) {
    ctx.fillStyle = `rgba(230,240,235,${0.04 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,20,30,0.75)';
  ctx.shadowBlur = 14;
  // the title
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.6;
  spaced(ctx, 9);
  ctx.font = `500 26px ${SERIF}`;
  ctx.fillText('LA LIGNÉE', W / 2 + 4.5, 150);
  spaced(ctx, 0);
  ctx.globalAlpha = 1;
  fit(ctx, inp.title, (px) => `300 ${px}px ${SERIF}`, 70, W - 120);
  ctx.fillText(inp.title, W / 2, 232);
  ctx.shadowColor = 'transparent';

  // the thread of light, from the first portrait to the last
  if (gens.length > 1) {
    const top = L.gens[0], bottom = L.gens[L.gens.length - 1];
    const th = ctx.createLinearGradient(0, top, 0, bottom);
    th.addColorStop(0, `rgba(${GOLD},0.3)`);
    th.addColorStop(1, `rgba(${GOLD},0.75)`);
    ctx.save();
    ctx.strokeStyle = th;
    ctx.lineWidth = 3;
    ctx.shadowColor = `rgba(${GOLD},0.4)`;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(TX, top);
    ctx.lineTo(TX, bottom);
    ctx.stroke();
    ctx.restore();
  }

  gens.forEach((g, i) => {
    const y = L.gens[i], notes = inp.notes?.(g), ty = notes ? y - 18 : y;
    medallion(ctx, TX, y, PR, water(g), inp.portrait(g), g.current ? `rgba(${GOLD},0.95)` : `rgba(${GOLD},0.4)`, g.current ? 4 : 2, g.current ? 30 : 0);
    // the words beside the portrait, a little higher when a line of notes follows them
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.shadowColor = 'rgba(0,20,30,0.8)';
    ctx.shadowBlur = 12;
    ctx.globalAlpha = g.current ? 0.9 : 0.62;
    spaced(ctx, 4);
    ctx.font = `500 25px ${SERIF}`;
    ctx.fillText(generationLabel(g.rank).toUpperCase(), TEXT_X, ty - 44);
    spaced(ctx, 0);
    ctx.globalAlpha = 1;
    fit(ctx, g.name, (px) => `500 ${px}px ${SERIF}`, 62, RIGHT - TEXT_X);
    ctx.fillText(g.name, TEXT_X, ty + 14);
    ctx.globalAlpha = 0.82;
    fit(ctx, bornWords(chapter(g.bornIn).name), (px) => `italic 400 ${px}px ${SERIF}`, 38, RIGHT - TEXT_X);
    ctx.fillText(bornWords(chapter(g.bornIn).name), TEXT_X, ty + 60);
    if (notes) {
      ctx.fillStyle = `rgb(${GOLD})`;
      fit(ctx, notes, (px) => `italic 400 ${px}px ${SERIF}`, 32, RIGHT - TEXT_X);
      ctx.fillText(notes, TEXT_X, ty + 100);
    }
    ctx.restore();

    const my = L.mates[i], m = g.partner;
    if (my == null || !m) return;
    // the partner, on a branch of the thread between the parent and the child
    const mx = TX + 178;
    ctx.save();
    const br = ctx.createLinearGradient(TX, 0, mx - MR[0], 0);
    br.addColorStop(0, `rgba(${MATE_BLUE},0.75)`);
    br.addColorStop(1, `rgba(${MATE_BLUE},0.25)`);
    ctx.strokeStyle = br;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TX, my);
    ctx.lineTo(mx - MR[0], my);
    ctx.stroke();
    ctx.restore();
    medallion(ctx, mx, my, MR, water(gens[i + 1] ?? g), inp.mate(m), `rgba(${MATE_BLUE},0.5)`, 1.5);
    ctx.save();
    ctx.beginPath();
    ctx.arc(TX, my, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(6,34,48)';
    ctx.shadowColor = `rgba(${MATE_BLUE},0.7)`;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = `rgb(${MATE_BLUE})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowColor = 'rgba(0,20,30,0.8)';
    ctx.fillStyle = `rgb(${MATE_BLUE})`;
    ctx.textAlign = 'left';
    const words = `avec ${m.name}`;
    fit(ctx, words, (px) => `italic 400 ${px}px ${SERIF}`, 37, RIGHT - (mx + MR[0] + 22));
    ctx.fillText(words, mx + MR[0] + 22, my + 12);
    ctx.restore();
  });

  // the words of the end
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.shadowColor = 'rgba(0,20,30,0.8)';
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.85;
  inp.foot.forEach((line, k) => {
    fit(ctx, line, (px) => `italic 400 ${px}px ${SERIF}`, 38, W - 120);
    ctx.fillText(line, W / 2, L.foot + 36 + k * 50);
  });
  ctx.globalAlpha = 0.5;
  spaced(ctx, 9);
  ctx.font = `500 22px ${SERIF}`;
  ctx.fillText('LA LIGNÉE', W / 2 + 4.5, H - 70);
  ctx.restore();
  return { canvas: cv, layout: L };
}
