// The « Nouveautés » of the game (changes/, see agents/docs/changes.md): the data of whatsNew() written into the page
// as a JSON script, read by src/monde/nouveautes/. In dev, with the version in preparation, and the images served from
// changes/ under /whats-new/ (whats-new.json too, to look at). At build, the page is one file opened without a server:
// the published versions only, each entry with its first image shrunk to a small JPEG in a data: URL, the newest
// versions first within a budget.
//
// JavaScript for Node without @types/node, like agents/release/changes.mjs; its types are in whatsNewPlugin.d.mts.
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { CHANGES_DIR, loadChanges, repoRoot, whatsNew } from './agents/release/changes.mjs';

export const BASE = '/whats-new/';
// The id of the script that holds the data (also in src/monde/nouveautes/data.ts).
export const DATA_ID = 'whats-new-data';
// The embedded images: at most `width` pixels wide, JPEG at `quality`, and `budget` bytes in all (fitImages). An entry
// whose image does not fit any more keeps its text only, and so do the older ones.
export const EMBED = { width: 720, quality: 70, budget: 400_000 };

const FOLDER = /^(unreleased|v\d+\.\d+\.\d+(-nightly\.\d{8}\.\d+)?)$/;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const extension = (file) => file.split('.').pop()?.toLowerCase() ?? '';

// The file of changes/ that a path under BASE names, or null: an image of a task folder, never outside.
export function changesFile(changesDir, path) {
  let parts;
  try {
    parts = decodeURIComponent(path).split('/');
  } catch {
    return null;
  }
  const [folder, task, ...rest] = parts;
  if (!folder || !FOLDER.test(folder) || !task || rest.length === 0 || parts.some((part) => part === '' || part === '.' || part === '..')) return null;
  if (!TYPES[extension(rest[rest.length - 1])]) return null;
  const root = resolve(changesDir);
  const file = resolve(root, ...parts);
  return file.startsWith(root + sep) ? file : null;
}

// The panel is for the players: the entries for admins and developers stay in the changelog.
export function playersOnly(data) {
  return {
    ...data,
    releases: data.releases
      .map((release) => ({ ...release, entries: release.entries.filter((entry) => entry.audience === 'players') }))
      .filter((release) => release.entries.length),
  };
}

// Markdown without its images (those of the body are not embedded).
export function stripImages(markdown) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)\s]*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// JSON that a <script> keeps whole: no `</script>` nor `<!--` inside.
export function scriptJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

let magick;
// ImageMagick (`magick`, or `convert` before version 7), found once; null without it.
function imageMagick() {
  if (magick === undefined) {
    magick = ['magick', 'convert'].find((command) => spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0) ?? null;
  }
  return magick;
}

// The bytes to embed for an image, and their type: a small JPEG, or the file as it is (an SVG, without ImageMagick, or
// when it cannot read the image).
async function shrink(file) {
  const type = TYPES[extension(file)];
  const command = type === 'image/svg+xml' ? null : imageMagick();
  const args = [file + '[0]', '-resize', `${EMBED.width}x>`, '-strip', '-quality', String(EMBED.quality), 'jpg:-'];
  const bytes = command
    ? await new Promise((done) => execFile(command, args, { encoding: 'buffer', maxBuffer: 64 << 20 }, (error, stdout) => done(error ? null : stdout)))
    : null;
  return bytes?.length ? { type: 'image/jpeg', bytes } : { type, bytes: readFileSync(file) };
}

// The images that fit in `budget` bytes, by entry id: the newest version first, its entries in the order of the panel.
// From the first image that does not fit, the entries keep their text: the newest version keeps the images that fit
// even when they do not all fit, and the images of the older versions are not even made.
export async function fitImages(releases, imageOf, budget) {
  const images = new Map();
  let spent = 0;
  for (const release of releases) {
    const found = await Promise.all(release.entries.map(imageOf));
    for (const [i, image] of found.entries()) {
      if (!image) continue;
      if (spent + image.bytes.length > budget) return { images, spent };
      spent += image.bytes.length;
      images.set(release.entries[i].id, image);
    }
  }
  return { images, spent };
}

// The data of the built page: published versions, players' entries, first images in data: URLs within the budget.
export async function embeddedData(root = repoRoot, log = () => {}, budget = EMBED.budget) {
  const changesDir = join(root, CHANGES_DIR);
  const data = playersOnly(whatsNew(loadChanges(root), { base: BASE, includeUnreleased: false }));
  const { images, spent } = await fitImages(data.releases, (entry) => {
    const url = entry.images[0];
    const file = url?.startsWith(BASE) ? changesFile(changesDir, url.slice(BASE.length)) : null;
    return file && existsSync(file) ? shrink(file) : null;
  }, budget);
  const releases = data.releases.map((release) => ({
    ...release,
    entries: release.entries.map((entry) => {
      const image = images.get(entry.id);
      return { ...entry, images: image ? [`data:${image.type};base64,${image.bytes.toString('base64')}`] : [], body: stripImages(entry.body) };
    }),
  }));
  const shown = releases
    .map((release) => ({ version: release.version, n: release.entries.filter((entry) => entry.images.length).length, of: release.entries.length }))
    .filter(({ n }) => n)
    .map(({ version, n, of }) => `v${version}${n < of ? ` (${n} sur ${of})` : ''}`)
    .join(', ') || 'aucune';
  log(`nouveautés : ${releases.length} version(s), images de ${shown} (${Math.round(spent / 1024)} Ko${imageMagick() ? '' : ', sans ImageMagick : images telles quelles'})`);
  return { ...data, releases };
}

export function whatsNewPlugin(root = repoRoot) {
  const changesDir = join(root, CHANGES_DIR);
  let command = 'serve';
  let logger = null;
  return {
    name: 'lignee-whats-new',
    configResolved(config) {
      command = config.command;
      logger = config.logger;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (!path.startsWith(BASE)) return next();
        const rest = path.slice(BASE.length);
        if (rest === 'whats-new.json') {
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.setHeader('cache-control', 'no-store');
          response.end(JSON.stringify(devData(root)));
          return;
        }
        const file = changesFile(changesDir, rest);
        if (!file || !existsSync(file) || !statSync(file).isFile()) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader('content-type', TYPES[extension(file)] ?? 'application/octet-stream');
        response.end(readFileSync(file));
      });
    },
    async transformIndexHtml() {
      const data = command === 'build' ? await embeddedData(root, (line) => logger?.info(line)) : devData(root);
      return [{ tag: 'script', attrs: { type: 'application/json', id: DATA_ID }, children: scriptJson(data), injectTo: 'head' }];
    },
  };
}

// In dev: the version in preparation too, the images from the files of changes/.
function devData(root) {
  return playersOnly(whatsNew(loadChanges(root), { base: BASE, includeUnreleased: true }));
}
