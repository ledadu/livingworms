import { beforeAll, describe, expect, it } from 'vitest';
import type * as Changes from '../../../agents/release/changes.mjs';
import type * as Plugin from '../../../whatsNewPlugin.mjs';
import { DATA_ID } from './data';

// The plugin reads the changes of the game: not those of the framework's tests, whose settings may still be in the
// environment of this worker (agents/test/env.mjs).
let plugin: typeof Plugin;
let changes: typeof Changes;
beforeAll(async () => {
  delete (globalThis as unknown as { process: { env: Record<string, string> } }).process.env.AGENTS_CONFIG;
  plugin = await import('../../../whatsNewPlugin.mjs');
  changes = await import('../../../agents/release/changes.mjs');
});

const entry = (id: string, audience = 'players') =>
  ({ id, type: 'new' as const, audience, title: id, pitch: id, images: [], body: '' });

describe('the Vite plugin of the « Nouveautés »', () => {
  it('writes the data where the game reads it', () => {
    expect(plugin.DATA_ID).toBe(DATA_ID);
  });

  it('serves the images of changes/ and nothing outside', () => {
    const dir = '/repo/changes';
    expect(plugin.changesFile(dir, 'v0.2.0/decor-glacier/img/fond.jpg')).toBe(`${dir}/v0.2.0/decor-glacier/img/fond.jpg`);
    expect(plugin.changesFile(dir, 'unreleased/nid/img/a%20b.png')).toBe(`${dir}/unreleased/nid/img/a b.png`);
    expect(plugin.changesFile(dir, 'v0.2.0/decor-glacier/report.md')).toBeNull();
    expect(plugin.changesFile(dir, 'v0.2.0/../../secret.jpg')).toBeNull();
    expect(plugin.changesFile(dir, 'v0.2.0/%2e%2e/x.jpg')).toBeNull();
    expect(plugin.changesFile(dir, 'autre/nid/img/a.jpg')).toBeNull();
    expect(plugin.changesFile(dir, 'v0.2.0/nid')).toBeNull();
    expect(plugin.changesFile(dir, '%E0%A4%A')).toBeNull();
  });

  it('keeps the entries for the players, and the versions that still have some', () => {
    const release = (version: string, entries: ReturnType<typeof entry>[]) =>
      ({ version, generation: '', unreleased: false, date: null, title: null, intro: '', entries });
    const data = { title: '', labels: {}, badges: {}, current: '0.2.0', next: null, releases: [
      release('0.2.0', [entry('a'), entry('b', 'developers')]),
      release('0.1.0', [entry('c', 'admins')]),
    ] } as unknown as Parameters<typeof plugin.playersOnly>[0];
    const players = plugin.playersOnly(data);
    expect(players.releases.map((r) => [r.version, r.entries.map((e) => e.id)])).toEqual([['0.2.0', ['a']]]);
  });

  it('writes JSON that no </script> can cut, and bodies without their images', () => {
    const json = plugin.scriptJson({ body: '</script><!-- x' });
    expect(json).not.toMatch(/<\/script|<!--/);
    expect(JSON.parse(json)).toEqual({ body: '</script><!-- x' });
    expect(plugin.stripImages('Avant.\n\n![vue](/whats-new/v0.2.0/a/img/x.jpg)\n\nAprès, ![b](x.jpg) et **gras**.')).toBe('Avant.\n\nAprès,  et **gras**.');
  });

  // versions of entries with an image of n bytes each (0: none), the newest first: v3, v2, v1
  const versions = (...sizes: number[][]) =>
    sizes.map((entries, r) => ({ entries: entries.map((n, e) => ({ id: `v${sizes.length - r}/${e}`, n })) }));
  const image = (n: number) => (n ? { type: 'image/jpeg', bytes: { length: n } } : null);

  it('gives the budget to the newest entries first, in the order of the panel', async () => {
    const made: string[] = [];
    const { images, spent } = await plugin.fitImages(versions([100, 0, 100], [100, 100, 100], [10]), (entry) => {
      made.push(entry.id);
      return image(entry.n);
    }, 350);
    // the second entry of v3 has no image; the second one of v2 does not fit, and nothing after it gets one
    expect([...images.keys()]).toEqual(['v3/0', 'v3/2', 'v2/0']);
    expect(spent).toBe(300);
    // the images of an older version are not even made
    expect(made.filter((id) => id.startsWith('v1/'))).toEqual([]);
  });

  it('keeps the images of the newest version that fit, even when they do not all fit', async () => {
    const { images } = await plugin.fitImages(versions([300, 300], [10]), (entry) => image(entry.n), 400);
    expect([...images.keys()]).toEqual(['v2/0']);
  });

  // The versions of the game grow with each release: what holds whatever they become, not which ones have images.
  it('embeds the published versions only, the newest entries with their first image, small', async () => {
    const lines: string[] = [];
    const root = changes.repoRoot;
    const data = await plugin.embeddedData(root, (line) => lines.push(line));
    expect(data.releases.length).toBeGreaterThan(0);
    expect(data.releases.every((release) => !release.unreleased)).toBe(true);
    expect(data.releases.find((release) => release.version === '0.1.0-nightly.20260930.1')!.entries).toHaveLength(8);
    const entries = data.releases.flatMap((release) => release.entries);
    const source = plugin.playersOnly(changes.whatsNew(changes.loadChanges(root))).releases.flatMap((release) => release.entries);
    expect(entries.map((e) => e.id)).toEqual(source.map((e) => e.id));
    let bytes = 0;
    for (const e of entries) {
      expect(e.images.length).toBeLessThanOrEqual(1);
      for (const src of e.images) {
        expect(src).toMatch(/^data:image\/(jpeg|png|webp|gif|svg\+xml);base64,/);
        bytes += (src.length - src.indexOf(',') - 1) * 0.75;
      }
      expect(e.body).not.toMatch(/!\[/);
    }
    expect(bytes).toBeLessThanOrEqual(plugin.EMBED.budget);
    // of the entries that have an image, the newest keep it and the others their text
    const kept = entries.filter((_, i) => source[i].images.length).map((e) => e.images.length === 1);
    const n = kept.filter(Boolean).length;
    expect(n).toBeGreaterThan(0);
    expect(kept).toEqual(kept.map((_, i) => i < n));
    expect(lines.join('\n')).toContain(`v${data.releases[0].version}`);
  });

  it('keeps the text only when the images do not fit the budget', async () => {
    const data = await plugin.embeddedData(changes.repoRoot, () => {}, 1000);
    expect(data.releases.flatMap((release) => release.entries).every((e) => e.images.length === 0)).toBe(true);
  });
});
