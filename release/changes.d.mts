// Types of changes.mjs, for the TypeScript that imports it (the Vite config of the client).
export type EntryType = 'new' | 'improved' | 'fixed';

export interface Entry {
  slug: string;
  dir: string;
  report: boolean;
  images: string[];
  errors: string[];
  type?: string;
  title?: string;
  pitch?: string;
  audience?: string;
  order?: number;
  featured?: string[];
  body?: string;
}

export interface Release {
  version: string | null;
  date: string | null;
  title: string | null;
  intro: string;
  dir: string;
  entries: Entry[];
}

export interface PlannedVersion {
  version: string;
  title: string;
  intro: string;
  entries: string[];
  problems: string[];
}

export interface Changes {
  current: string;
  next: string | null;
  unreleased: Release;
  released: Release[];
  plan: { versions: PlannedVersion[]; errors: string[] };
  errors: string[];
}

export interface Selection {
  version: string | null;
  planned: boolean;
  all: boolean;
  entries: (Entry & { missing?: boolean })[];
  title: string;
  intro: string;
  problems: string[];
}

export interface WhatsNewEntry {
  id: string;
  type: EntryType;
  audience: string;
  title: string;
  pitch: string;
  images: string[];
  body: string;
}

export interface WhatsNewRelease {
  version: string | null;
  generation: string;
  unreleased: boolean;
  date: string | null;
  title: string | null;
  intro: string;
  entries: WhatsNewEntry[];
}

export interface WhatsNew {
  title: string;
  labels: Record<EntryType, string>;
  badges: Record<EntryType, string>;
  current: string;
  next: string | null;
  releases: WhatsNewRelease[];
}

export const TYPES: EntryType[];
export const AUDIENCES: string[];
export const TYPE_LABELS: Record<EntryType, string>;
export const TYPE_BADGES: Record<EntryType, string>;
export const TITLE: string;
export const UNRELEASED: string;
export const CHANGES_DIR: string;
export const PLAN_FILE: string;
export const repoRoot: string;
export function releaseName(version: string | null | undefined): string;
export function parseFrontMatter(text: string): { data: Record<string, string | string[]>; body: string; hasFrontMatter: boolean };
export function parseVersion(text: unknown): [number, number, number] | null;
export function compareVersions(a: string, b: string): number;
export function loadEntry(dir: string, slug: string): Entry;
export function loadChanges(root?: string): Changes;
export function currentVersion(root?: string): string;
export function nextVersion(from: string, entries: Entry[]): string | null;
export function whatsNew(changes: Changes, options?: { base?: string; includeUnreleased?: boolean }): WhatsNew;
export function changelog(changes: Changes): string;
export function writeChangelog(root?: string, changes?: Changes): string;
export function scaffold(root: string, name: string): string;
export function checkVersion(changes: Changes, version: string): string | null;
export function readPlan(root?: string): { versions: Omit<PlannedVersion, 'problems'>[]; errors: string[] };
export function writePlan(root: string, versions: Omit<PlannedVersion, 'problems'>[]): void;
export function assignedTo(changes: Changes, slug: string): string | null;
export function proposeVersion(changes: Changes, entries?: { type?: string }[]): string;
export function checkPlannedVersion(changes: Changes, version: string, except?: string | null): string | null;
export function planVersion(root: string, version: string, options?: { to?: string; title?: string; intro?: string }): Omit<PlannedVersion, 'problems'>;
export function unplanVersion(root: string, version: string): void;
export function assignEntry(root: string, slug: string, version: string | null): string | null;
export function assignEntries(root: string, slugs: string[], version?: string | null): string;
export function selectRelease(changes: Changes, options?: { version?: string; slugs?: string[]; title?: string; intro?: string }): Selection;
export function previewRelease(changes: Changes, options?: { version?: string; slugs?: string[]; date?: string; title?: string; intro?: string }): Changes;
export function release(
  root: string,
  version?: string,
  options?: { date?: string; title?: string; intro?: string; slugs?: string[] },
): { version: string; title: string; slugs: string[]; paths: string[] };
export function packageFiles(root: string): string[];
