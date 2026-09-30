import { beforeAll, describe, expect, it } from 'vitest';
import type * as Plugin from '../../../whatsNewPlugin.mjs';
import { DATA_ID } from './data';

// The plugin reads the changes of the game: not those of the framework's tests, whose settings may still be in the
// environment of this worker (agents/test/env.mjs).
let plugin: typeof Plugin;
let root: string;
beforeAll(async () => {
  delete (globalThis as unknown as { process: { env: Record<string, string> } }).process.env.AGENTS_CONFIG;
  plugin = await import('../../../whatsNewPlugin.mjs');
  root = (await import('../../../agents/release/changes.mjs')).repoRoot;
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

  it('embeds the published versions only, each entry with its first image, small', async () => {
    const lines: string[] = [];
    const data = await plugin.embeddedData(root, (line) => lines.push(line));
    expect(data.releases.length).toBeGreaterThan(0);
    expect(data.releases.every((release) => !release.unreleased)).toBe(true);
    const v02 = data.releases.find((release) => release.version === '0.2.0')!;
    expect(v02.entries).toHaveLength(8);
    let bytes = 0;
    for (const release of data.releases) {
      for (const e of release.entries) {
        expect(e.images.length).toBeLessThanOrEqual(1);
        for (const src of e.images) {
          expect(src).toMatch(/^data:image\/(jpeg|png|webp|gif|svg\+xml);base64,/);
          bytes += (src.length - src.indexOf(',') - 1) * 0.75;
        }
        expect(e.body).not.toMatch(/!\[/);
      }
    }
    expect(v02.entries.every((e) => e.images.length === 1)).toBe(true);
    expect(bytes).toBeLessThanOrEqual(plugin.EMBED.budget);
    expect(lines.join('\n')).toMatch(/v0\.2\.0/);
  });

  it('keeps the text only when the images do not fit the budget', async () => {
    const data = await plugin.embeddedData(root, () => {}, 1000);
    expect(data.releases.flatMap((release) => release.entries).every((e) => e.images.length === 0)).toBe(true);
  });
});
