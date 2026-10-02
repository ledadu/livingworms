import { describe, expect, it } from 'vitest';
import type { WhatsNew, WhatsNewEntry } from './data';
import { readData } from './data';
import { badgeLabel, dateLabel, shortVersion, versionsOf } from './layout';
import { inlineMarkdown, renderMarkdown } from './markdown';

const entry = (id: string, type: WhatsNewEntry['type'] = 'new'): WhatsNewEntry =>
  ({ id, type, audience: 'players', title: `Titre ${id}`, pitch: `Accroche ${id}`, images: [`/whats-new/${id}/img/a.jpg`], body: 'Du texte.' });

const DATA: WhatsNew = {
  title: 'Nouveautés',
  labels: { new: 'Nouveautés', improved: 'Améliorations', fixed: 'Corrections' },
  badges: { new: '✨ Nouveauté', improved: '🔧 Amélioration', fixed: '🩹 Correction' },
  current: '0.2.0',
  next: '0.3.0',
  releases: [
    { version: '0.3.0', generation: 'Version 0.3', unreleased: true, date: null, title: null, intro: '', entries: [entry('unreleased/nid')] },
    { version: '0.2.0', generation: 'Version 0.2', unreleased: false, date: '2026-09-30', title: 'La descente', intro: 'Dix chapitres !', entries: [entry('v0.2.0/a'), entry('v0.2.0/b', 'improved')] },
    { version: '0.1.1', generation: 'Version 0.1.1', unreleased: false, date: '2026-08-01', title: null, intro: '', entries: [entry('v0.1.1/c', 'fixed')] },
    { version: '0.1.0', generation: 'Version 0.1', unreleased: false, date: '2026-07-14', title: null, intro: '', entries: [] },
  ],
};

describe('the versions of the panel', () => {
  it('keeps the order of the data, the newest first, and drops the empty versions', () => {
    const versions = versionsOf(DATA);
    expect(versions.map((v) => v.key)).toEqual(['unreleased', 'v0.2.0', 'v0.1.1']);
    expect(versions.map((v) => v.short)).toEqual(['0.3', '0.2', '0.1.1']);
  });

  it('marks the version in preparation as such', () => {
    const [prep, published] = versionsOf(DATA);
    expect(prep).toMatchObject({ unreleased: true, label: 'Version 0.3', note: 'en préparation' });
    expect(published).toMatchObject({ unreleased: false, label: 'Version 0.2', note: '30 septembre 2026', title: 'La descente', intro: 'Dix chapitres !' });
  });

  it('gives each entry its badge without the emoji, its images and its text', () => {
    const [, published, patch] = versionsOf(DATA);
    expect(published!.entries.map((e) => [e.id, e.badge])).toEqual([['v0.2.0/a', 'Nouveauté'], ['v0.2.0/b', 'Amélioration']]);
    expect(patch!.entries[0]).toMatchObject({ badge: 'Correction', title: 'Titre v0.1.1/c', pitch: 'Accroche v0.1.1/c', images: ['/whats-new/v0.1.1/c/img/a.jpg'], body: 'Du texte.' });
  });

  it('writes dates and versions the French way', () => {
    expect(dateLabel('2026-09-30')).toBe('30 septembre 2026');
    expect(dateLabel('2027-01-01')).toBe('1er janvier 2027');
    expect(dateLabel(null)).toBe('');
    expect(dateLabel('2026-13-01')).toBe('');
    expect(shortVersion('0.2.0')).toBe('0.2');
    expect(shortVersion('0.2.1')).toBe('0.2.1');
    expect(shortVersion('0.1.0-nightly.20261002.1')).toBe('2 oct.');
    expect(shortVersion('0.1.0-nightly.20261001.2')).toBe('1er oct. (2)');
    expect(shortVersion(null)).toBe('');
    expect(badgeLabel(undefined, 'fixed')).toBe('Correction');
    expect(badgeLabel('🩹', 'fixed')).toBe('Correction');
  });

  it('reads the data the page holds, and nothing from a broken one', () => {
    const doc = (text: string | null) => ({ getElementById: () => (text === null ? null : { textContent: text }) }) as unknown as Document;
    expect(readData(doc(JSON.stringify(DATA)))?.releases).toHaveLength(4);
    expect(readData(doc('{oops'))).toBeNull();
    expect(readData(doc('{}'))).toBeNull();
    expect(readData(doc(null))).toBeNull();
  });
});

describe('the Markdown of the entries', () => {
  it('escapes, then renders paragraphs, lists, emphasis and links', () => {
    expect(renderMarkdown('Un **nid** et *toi*.\n\n- un\n- deux')).toBe('<p>Un <strong>nid</strong> et <em>toi</em>.</p><ul><li>un</li><li>deux</li></ul>');
    expect(renderMarkdown('<b>non</b>')).toBe('<p>&lt;b&gt;non&lt;/b&gt;</p>');
    expect(inlineMarkdown('[là](https://example.org)')).toBe('<a href="https://example.org" target="_blank" rel="noopener">là</a>');
    expect(inlineMarkdown('[piège](javascript:void0)')).toBe('piège');
  });

  it('shows the images of changes/ and the embedded ones, nothing else', () => {
    expect(inlineMarkdown('![vue](/whats-new/v0.2.0/a/img/x.jpg)')).toBe('<img src="/whats-new/v0.2.0/a/img/x.jpg" alt="vue" loading="lazy">');
    expect(inlineMarkdown('![](data:image/jpeg;base64,AAAA)')).toBe('<img src="data:image/jpeg;base64,AAAA" alt="" loading="lazy">');
    expect(inlineMarkdown('![](data:image/svg+xml;base64,AAAA)')).not.toContain('<img');
    expect(inlineMarkdown('![](img/relative.jpg)')).not.toContain('<img');
  });
});
