// Types of whatsNewPlugin.mjs, for vite.config.ts and the tests.
import type { Plugin } from 'vite';
import type { WhatsNew } from './agents/release/changes.mjs';

export const BASE: string;
export const DATA_ID: string;
export const EMBED: { width: number; quality: number; budget: number };
export function changesFile(changesDir: string, path: string): string | null;
export function playersOnly(data: WhatsNew): WhatsNew;
export function stripImages(markdown: string): string;
export function scriptJson(data: unknown): string;
export function fitImages<E extends { id: string }, I extends { bytes: { length: number } }>(
  releases: readonly { entries: readonly E[] }[],
  imageOf: (entry: E) => I | null | Promise<I | null>,
  budget: number,
): Promise<{ images: Map<string, I>; spent: number }>;
export function embeddedData(root?: string, log?: (line: string) => void, budget?: number): Promise<WhatsNew>;
export function whatsNewPlugin(root?: string): Plugin;
