// The credits and the keepsake image (docs/mecaniques.md, « Le générique et l'image souvenir »): at the end of the
// story the whole lineage goes by, generation after generation, then becomes an image to keep. Pure: the screen is
// generique-ecran.ts, the image is drawn by generique-image.ts.

import { clamp, lerp, lerpHue } from '../engine';
import type { HSL } from './palette';

/** the keepsake's width (px); its height grows with the lineage, up to what a phone still keeps in a canvas */
export const SOUVENIR_W = 1080;
export const SOUVENIR_MAX_H = 12000;

/** the heights of the image, before its scale: the title, a generation, the join with a partner, the words at the end */
export const HEAD = 360, GEN = 220, MATE = 124, JOIN = 44, FOOT_TOP = 120, FOOT_LINE = 50, FOOT_END = 170;

export interface SouvenirLayout {
  /** the canvas, in pixels */
  w: number;
  h: number;
  /** everything below is before it: drawn under ctx.scale(scale) */
  scale: number;
  /** the centre of each generation's portrait */
  gens: number[];
  /** the centre of the join between a generation and the next, for those that have a partner (else null) */
  mates: (number | null)[];
  /** where the words at the end start */
  foot: number;
  /** the height before the scale */
  full: number;
}

/** the image, from the top: the title, then each generation and the partner of its child, then the words of the end */
export function souvenirLayout(gens: readonly { partner: unknown }[], footLines: number): SouvenirLayout {
  let y = HEAD;
  const at: number[] = [], mates: (number | null)[] = [];
  gens.forEach((g, i) => {
    at.push(y + GEN / 2);
    y += GEN;
    if (i === gens.length - 1) return;
    mates.push(g.partner ? y + MATE / 2 : null);
    y += g.partner ? MATE : JOIN;
  });
  const foot = y + FOOT_TOP, full = foot + Math.max(0, footLines) * FOOT_LINE + FOOT_END;
  const scale = Math.min(1, SOUVENIR_MAX_H / full);
  return { w: Math.round(SOUVENIR_W * scale), h: Math.round(full * scale), scale, gens: at, mates, foot, full };
}

/** the water behind a generation: the colour of its chapter, dark enough for pale letters */
export function bandColour(ch: { top: HSL; deep: HSL }): HSL {
  return { h: lerpHue(ch.deep.h, ch.top.h, 0.3), s: clamp(lerp(ch.deep.s, ch.top.s, 0.3), 0, 70), l: clamp(lerp(ch.deep.l, ch.top.l, 0.3), 6, 26) };
}

/** the file the image is kept as: « la-lignee-premiere.jpg », from the name of the last generation */
export function souvenirFileName(name: string): string {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
  return slug ? `la-lignee-${slug}.jpg` : 'la-lignee.jpg';
}

/** how long the credits take to go up, from below the screen until they have left it (ms): at this speed (px/s),
 * faster for a long lineage so that they never last more than about two minutes, and never less than a few seconds */
export function rollMs(contentH: number, viewH: number, speed = 52): number {
  const dist = Math.max(0, contentH) + Math.max(0, viewH);
  return Math.round(Math.max(8, dist / Math.max(speed, dist / 130)) * 1000);
}

/** what the page knows of where it is shown */
export interface Where {
  hostname: string;
  search: string;
  /** shown inside another page (an iframe) */
  framed: boolean;
  /** the pages around it, when the browser tells them (location.ancestorOrigins) */
  ancestors: readonly string[];
  referrer: string;
}

const CLAUDE = /(^|\.)(claude\.ai|claude\.site|claudeusercontent\.com)$/i;
const fromClaude = (url: string) => { try { return CLAUDE.test(new URL(url).hostname); } catch { return false; } };

/** the Artifact link of claude.ai shows the page in a frame that blocks downloads: no button to keep the image there.
 * `?artifact` in the address does the same, for the tests */
export function downloadsBlocked(w: Where): boolean {
  if (new URLSearchParams(w.search).has('artifact') || CLAUDE.test(w.hostname)) return true;
  return w.framed && [...w.ancestors, w.referrer].some(fromClaude);
}
