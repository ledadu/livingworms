import type { EntryType, WhatsNew, WhatsNewEntry } from './data';

// What the panel shows, as plain data: one version at a time, the newest first (in dev, the one in preparation before
// it), its entries in the order of the engine (novelties, improvements, then fixes).
export interface VersionView {
  // `v0.2.0`, or `unreleased`.
  key: string;
  // « Version 0.2 »
  label: string;
  // « 0.2 », for the tabs.
  short: string;
  // « 30 septembre 2026 », or « en préparation ».
  note: string;
  unreleased: boolean;
  title: string;
  intro: string;
  entries: EntryView[];
}

export interface EntryView {
  id: string;
  type: EntryType;
  // « Nouveauté », without the emoji of the changelog.
  badge: string;
  title: string;
  pitch: string;
  images: string[];
  // Markdown.
  body: string;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// 2026-09-30 → « 30 septembre 2026 » (« 1er » for the first of the month).
export function dateLabel(iso: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return '';
  const day = Number(match[3]);
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${day === 1 ? '1er' : day} ${month} ${match[1]}` : '';
}

// 0.2.0 → 0.2, 0.2.1 → 0.2.1 (as releaseName does in the framework).
export function shortVersion(version: string | null): string {
  if (!version) return '';
  return version.replace(/^(\d+\.\d+)\.0$/, '$1');
}

// « ✨ Nouveauté » → « Nouveauté »: the colour of the type says the rest.
export function badgeLabel(badge: string | undefined, type: EntryType): string {
  const text = (badge ?? '').replace(/^[^\p{L}]+/u, '').trim();
  return text || { new: 'Nouveauté', improved: 'Amélioration', fixed: 'Correction' }[type];
}

export function versionsOf(data: WhatsNew): VersionView[] {
  return data.releases
    .filter((release) => release.entries.length)
    .map((release) => ({
      key: release.unreleased ? 'unreleased' : `v${release.version}`,
      label: release.generation || (release.version ? `Version ${shortVersion(release.version)}` : 'Version à venir'),
      short: shortVersion(release.version) || '…',
      note: release.unreleased ? 'en préparation' : dateLabel(release.date),
      unreleased: release.unreleased,
      title: release.title ?? '',
      intro: release.intro ?? '',
      entries: release.entries.map((entry) => entryView(data, entry)),
    }));
}

function entryView(data: WhatsNew, entry: WhatsNewEntry): EntryView {
  return {
    id: entry.id,
    type: entry.type,
    badge: badgeLabel(data.badges?.[entry.type], entry.type),
    title: entry.title,
    pitch: entry.pitch,
    images: entry.images,
    body: entry.body,
  };
}
