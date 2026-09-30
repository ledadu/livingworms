// The changes of the project: one entry per delivered task under changes/ (see docs/changes.md), from which come the
// « what's new » data of the game (whatsNew), the changelog and the versions tabs of the agents' dashboard. The folder,
// the changelog file and the words of the releases (a « version », a « génération »…) come from agents.config.mjs.
//
//   node release/changes.mjs check            validates every entry
//   node release/changes.mjs build            writes the changelog
//   node release/changes.mjs next             prints the version the unreleased entries call for
//   node release/changes.mjs release [x.y.z]  freezes changes/unreleased into changes/vX.Y.Z, bumps the versions;
//                                             a version planned in changes/planned.json freezes its entries only
//   node release/changes.mjs plan             prints the releases in preparation (changes/planned.json)
//   node release/changes.mjs assign <name> <x.y.z|->  assigns an entry to a planned release, or takes it back
//   node release/changes.mjs new <name>       starts changes/unreleased/<name>/entry.md
//
// No dependency: a Vite config, the dashboard and the tests import it as it is.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { project, projectRoot, releaseName } from '../config.mjs';

export const TYPES = ['new', 'improved', 'fixed'];
export const AUDIENCES = ['players', 'admins', 'developers'];
// The project's words: labels and badges of the three types of entries, title of the changelog and of the what's new.
const { release: WORDS } = project;
export const TYPE_LABELS = Object.fromEntries(TYPES.map((type) => [type, WORDS.types[type].label]));
export const TYPE_BADGES = Object.fromEntries(TYPES.map((type) => [type, WORDS.types[type].badge]));
export const TITLE = WORDS.title;
// The folder of the changes, from the root.
export const CHANGES_DIR = project.paths.changes;

// « Version 0.2 » for 0.2.0, « Version 0.2.1 » for a patch (config.mjs).
export { releaseName };
export const UNRELEASED = 'unreleased';
// The generations in preparation: which unreleased entries each one will publish, with its title and intro.
export const PLAN_FILE = 'planned.json';
const VERSION_DIR = /^v(\d+)\.(\d+)\.(\d+)$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export const repoRoot = projectRoot;

// --- Parsing -----------------------------------------------------------------------------------------------------------

// Front matter: `key: value` lines and `key:` followed by `  - item` lines; # starts a comment outside quotes.
export function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: text.trim(), hasFrontMatter: false };
  const data = {};
  let listKey = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      data[listKey].push(unquote(item[1].trim()));
      continue;
    }
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, value] = pair;
    if (value.trim() === '') {
      data[key] = [];
      listKey = key;
    } else {
      data[key] = unquote(value.trim());
      listKey = null;
    }
  }
  return { data, body: match[2].trim(), hasFrontMatter: true };
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

function unquote(value) {
  const quoted = /^(["'])([\s\S]*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

export function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// --- Loading -----------------------------------------------------------------------------------------------------------

function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

// One task folder: its entry (front matter + text for the players), whether it has a report, its images and errors.
export function loadEntry(dir, slug) {
  const errors = [];
  const entryFile = join(dir, 'entry.md');
  const reportFile = join(dir, 'report.md');
  const images = listFiles(join(dir, 'img'));
  const entry = { slug, dir, report: existsSync(reportFile), images, errors };
  if (!SLUG.test(slug)) errors.push(`nom de dossier invalide « ${slug} » (minuscules, chiffres, tirets)`);
  if (!existsSync(entryFile)) {
    errors.push('entry.md manquant');
    return entry;
  }
  const { data, body, hasFrontMatter } = parseFrontMatter(readFileSync(entryFile, 'utf8'));
  if (!hasFrontMatter) errors.push("entry.md : pas d'en-tête --- … ---");
  entry.type = data.type;
  entry.title = data.title;
  entry.pitch = data.pitch;
  entry.audience = data.audience ?? 'players';
  entry.order = Number(data.order) || 0;
  entry.featured = Array.isArray(data.images) ? data.images : data.images ? [data.images] : [];
  entry.body = body;
  if (!TYPES.includes(entry.type)) errors.push(`type « ${entry.type ?? ''} » : attendu ${TYPES.join(', ')}`);
  if (!entry.title) errors.push('title manquant');
  if (!entry.pitch) errors.push('pitch manquant');
  if (!AUDIENCES.includes(entry.audience)) errors.push(`audience « ${entry.audience} » : attendu ${AUDIENCES.join(', ')}`);
  if (!body) errors.push(`texte pour ${WORDS.reader} manquant, sous l’en-tête`);
  for (const image of entry.featured) {
    if (!existsSync(join(dir, image))) errors.push(`image introuvable : ${image}`);
  }
  for (const [, image] of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (!/^https?:/.test(image) && !existsSync(join(dir, image))) errors.push(`image introuvable dans le texte : ${image}`);
  }
  return entry;
}

function listFiles(dir) {
  try {
    return readdirSync(dir).filter((file) => statSync(join(dir, file)).isFile()).sort();
  } catch {
    return [];
  }
}

const TYPE_ORDER = Object.fromEntries(TYPES.map((type, index) => [type, index]));
const byImportance = (a, b) =>
  (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || b.order - a.order || String(a.title).localeCompare(String(b.title), 'fr');

function loadRelease(dir, version) {
  const entries = listDirs(dir).map((slug) => loadEntry(join(dir, slug), slug)).sort(byImportance);
  const releaseFile = join(dir, 'release.md');
  const { data, body } = existsSync(releaseFile) ? parseFrontMatter(readFileSync(releaseFile, 'utf8')) : { data: {}, body: '' };
  return { version, date: data.date || null, title: data.title || null, intro: body, dir, entries };
}

// Every version, newest first, then the unreleased one (version null) in front when it has entries.
export function loadChanges(root = repoRoot) {
  const changesDir = join(root, CHANGES_DIR);
  const released = listDirs(changesDir)
    .filter((name) => VERSION_DIR.test(name))
    .map((name) => loadRelease(join(changesDir, name), name.slice(1)))
    .sort((a, b) => compareVersions(b.version, a.version));
  const unreleased = loadRelease(join(changesDir, UNRELEASED), null);
  const current = currentVersion(root);
  const changes = {
    current,
    next: nextVersion(released[0]?.version ?? current, unreleased.entries),
    unreleased,
    released,
    plan: { versions: [], errors: [] },
    errors: [unreleased, ...released].flatMap((release) =>
      release.entries.flatMap((entry) => entry.errors.map((error) => `${release.version ? 'v' + release.version : UNRELEASED}/${entry.slug} : ${error}`)),
    ),
  };
  changes.plan = checkPlan(changes, readPlan(root));
  return changes;
}

// --- The releases in preparation (changes/planned.json) -------------------------------------------------------------
//
// { "versions": [{ "version": "0.3.0", "title": "…", "intro": "…", "entries": ["nid", "soleil"] }] }
// Entries stay in changes/unreleased until their release is published; an entry in no release waits to be
// assigned. The file is written by the agents' dashboard and read by `make release VERSION=x.y.z`.

export function readPlan(root = repoRoot) {
  const file = join(root, CHANGES_DIR, PLAN_FILE);
  if (!existsSync(file)) return { versions: [], errors: [] };
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { versions: [], errors: [`${PLAN_FILE} illisible : ${error.message}`] };
  }
  const versions = (Array.isArray(raw?.versions) ? raw.versions : []).map((planned) => ({
    version: String(planned?.version ?? ''),
    title: String(planned?.title ?? ''),
    intro: String(planned?.intro ?? ''),
    entries: Array.isArray(planned?.entries) ? planned.entries.map(String) : [],
  }));
  return { versions, errors: [] };
}

const byVersion = (a, b) => (parseVersion(a.version) && parseVersion(b.version) ? compareVersions(a.version, b.version) : 0);

// Each planned generation with its problems (version, missing or doubly assigned entries), sorted by version. An
// invalid entry is already in changes.errors, and blocks the publication of its generation only (selectRelease).
function checkPlan(changes, plan) {
  const errors = [...plan.errors];
  const seen = new Map();
  const versions = plan.versions.map((planned) => {
    const problems = [];
    const invalid = checkVersion(changes, planned.version);
    if (invalid) problems.push(invalid);
    if (plan.versions.filter((other) => other.version === planned.version).length > 1) problems.push(`${planned.version} est planifiée deux fois`);
    for (const slug of planned.entries) {
      const entry = changes.unreleased.entries.find((candidate) => candidate.slug === slug);
      if (!changes.unreleased.entries.some((entry) => entry.slug === slug)) problems.push(`${slug} n'est pas dans ${CHANGES_DIR}/${UNRELEASED}`);
      if (seen.has(slug) && seen.get(slug) !== planned.version) problems.push(`${slug} est aussi dans la ${seen.get(slug)}`);
      seen.set(slug, planned.version);
    }
    errors.push(...problems.map((problem) => `${PLAN_FILE} ${planned.version} : ${problem}`));
    return { ...planned, problems };
  });
  return { versions: versions.sort(byVersion), errors };
}

export function writePlan(root, versions) {
  const file = join(root, CHANGES_DIR, PLAN_FILE);
  const kept = versions.map(({ version, title = '', intro = '', entries = [] }) => ({ version, title, intro, entries })).sort(byVersion);
  if (!kept.length) {
    rmSync(file, { force: true });
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ versions: kept }, null, 2)}\n`);
}

const planOf = (changes) => changes.plan.versions.map(({ problems, ...planned }) => ({ ...planned, entries: [...planned.entries] }));

// The planned generation `slug` is assigned to, or null.
export function assignedTo(changes, slug) {
  return changes.plan.versions.find((planned) => planned.entries.includes(slug))?.version ?? null;
}

// The number a new generation of `entries` would take, after the published and the planned ones.
export function proposeVersion(changes, entries = []) {
  const latest = [changes.current, changes.released[0]?.version, ...changes.plan.versions.map((planned) => planned.version)]
    .filter((version) => parseVersion(version))
    .sort(compareVersions)
    .pop();
  return nextVersion(latest ?? '0.0.0', entries.length ? entries : [{ type: 'new' }]);
}

// Why `version` cannot be planned (checkVersion, or already planned), or null. `except`: the version being renamed.
export function checkPlannedVersion(changes, version, except = null) {
  const invalid = checkVersion(changes, version);
  if (invalid) return invalid;
  if (version !== except && changes.plan.versions.some((planned) => planned.version === version)) return `la ${releaseName(version)} est déjà en préparation`;
  return null;
}

function plannedOrNew(changes, versions, version) {
  let planned = versions.find((candidate) => candidate.version === version);
  if (!planned) {
    const invalid = checkPlannedVersion(changes, version);
    if (invalid) throw new Error(invalid);
    planned = { version, title: '', intro: '', entries: [] };
    versions.push(planned);
  }
  return planned;
}

// Creates a planned generation, or changes its number (`to`), title or intro.
export function planVersion(root, version, { to, title, intro } = {}) {
  const changes = loadChanges(root);
  const versions = planOf(changes);
  const planned = plannedOrNew(changes, versions, version);
  if (to && to !== version) {
    const invalid = checkPlannedVersion(changes, to, version);
    if (invalid) throw new Error(invalid);
    planned.version = to;
  }
  if (title !== undefined) planned.title = String(title).trim();
  if (intro !== undefined) planned.intro = String(intro).trim();
  writePlan(root, versions);
  return planned;
}

// Drops a planned generation: its entries wait to be assigned again.
export function unplanVersion(root, version) {
  const changes = loadChanges(root);
  if (!changes.plan.versions.some((planned) => planned.version === version)) throw new Error(`aucune ${WORDS.word} ${version} en préparation`);
  writePlan(root, planOf(changes).filter((planned) => planned.version !== version));
}

// Assigns an unreleased entry to a planned generation (created when needed), or to none when `version` is null.
export function assignEntry(root, slug, version) {
  const changes = loadChanges(root);
  if (!changes.unreleased.entries.some((entry) => entry.slug === slug)) throw new Error(`${slug} n'est pas dans ${CHANGES_DIR}/${UNRELEASED}`);
  const versions = planOf(changes).map((planned) => ({ ...planned, entries: planned.entries.filter((other) => other !== slug) }));
  if (version) plannedOrNew(changes, versions, version).entries.push(slug);
  writePlan(root, versions);
  return version;
}

// Assigns several entries to one planned generation (created when needed), by default the one proposed for them. An
// invalid entry cannot be published: none is assigned then.
export function assignEntries(root, slugs, version) {
  const changes = loadChanges(root);
  const entries = slugs.map((slug) => changes.unreleased.entries.find((entry) => entry.slug === slug));
  if (!slugs.length) throw new Error('aucune entrée choisie');
  const missing = slugs.filter((slug, index) => !entries[index]);
  if (missing.length) throw new Error(`pas dans ${CHANGES_DIR}/${UNRELEASED} : ${missing.join(', ')}`);
  const invalid = entries.filter((entry) => entry.errors.length);
  if (invalid.length) throw new Error(`entrées invalides, non publiables : ${invalid.map((entry) => `${entry.slug} (${entry.errors[0]})`).join(', ')}`);
  const target = version || proposeVersion(changes, entries);
  const versions = planOf(changes).map((planned) => ({ ...planned, entries: planned.entries.filter((slug) => !slugs.includes(slug)) }));
  plannedOrNew(changes, versions, target).entries.push(...slugs);
  writePlan(root, versions);
  return target;
}

export function currentVersion(root = repoRoot) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// SemVer 0.x: a new feature or an improvement bumps the minor, fixes alone the patch.
export function nextVersion(from, entries) {
  const [major, minor, patch] = parseVersion(from) ?? [0, 0, 0];
  if (!entries.length) return null;
  const feature = entries.some((entry) => entry.type !== 'fixed');
  return feature ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

// --- Outputs -----------------------------------------------------------------------------------------------------------

// The data of the « Quoi de neuf » panel and page: text and image URLs under `base` (the folder served as /whats-new/).
export function whatsNew(changes, { base = '/whats-new/', includeUnreleased = false } = {}) {
  const releases = [...(includeUnreleased && changes.unreleased.entries.length ? [changes.unreleased] : []), ...changes.released];
  return {
    title: TITLE,
    labels: TYPE_LABELS,
    badges: TYPE_BADGES,
    current: changes.current,
    next: changes.next,
    releases: releases.map((release) => {
      const folder = release.version ? `v${release.version}` : UNRELEASED;
      const url = (entry, path) => `${base}${folder}/${entry.slug}/${path}`;
      return {
        version: release.version ?? changes.next,
        generation: releaseName(release.version ?? changes.next),
        unreleased: !release.version,
        date: release.date,
        title: release.title,
        intro: release.intro,
        entries: release.entries
          .filter((entry) => !entry.errors.length)
          .map((entry) => ({
            id: `${folder}/${entry.slug}`,
            type: entry.type,
            audience: entry.audience,
            title: entry.title,
            pitch: entry.pitch,
            images: entry.featured.map((image) => url(entry, image)),
            body: entry.body.replace(/(!?\[[^\]]*\]\()(?!https?:|\/)([^)\s]+)\)/g, (_, head, path) => `${head}${url(entry, path)})`),
          })),
      };
    }),
  };
}

export function changelog(changes) {
  const lines = [
    `# ${TITLE}`,
    '',
    WORDS.changelogIntro ?? `Le changelog de ${project.name}, ${WORDS.word} après ${WORDS.word}. Généré depuis [\`${CHANGES_DIR}/\`](${CHANGES_DIR}/) par \`make whats-new\` : ne pas modifier à la main.`,
    '',
  ];
  const sections = [...(changes.unreleased.entries.length ? [changes.unreleased] : []), ...changes.released];
  for (const release of sections) {
    const folder = release.version ? `v${release.version}` : UNRELEASED;
    const heading = release.version
      ? `## ${releaseName(release.version)} (v${release.version}${release.date ? `, ${release.date}` : ''})`
      : `## ${WORDS.unreleased}${changes.next ? ` : ${releaseName(changes.next)} (v${changes.next})` : ''}`;
    lines.push(heading, '');
    if (release.title) lines.push(`**${release.title}**`, '');
    if (release.intro) lines.push(release.intro, '');
    for (const type of TYPES) {
      const entries = release.entries.filter((entry) => entry.type === type);
      if (!entries.length) continue;
      lines.push(`### ${TYPE_BADGES[type].split(' ')[0]} ${TYPE_LABELS[type]}`, '');
      for (const entry of entries) {
        const audience = entry.audience === 'players' ? '' : ` _(${WORDS.audiences[entry.audience] ?? entry.audience})_`;
        const report = entry.report ? ` — [rapport](${CHANGES_DIR}/${folder}/${entry.slug}/report.md)` : '';
        lines.push(`- **${entry.title}**${audience} : ${entry.pitch}${report}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function writeChangelog(root = repoRoot, changes = loadChanges(root)) {
  const file = join(root, project.paths.changelog);
  writeFileSync(file, changelog(changes));
  return file;
}

// --- Actions -----------------------------------------------------------------------------------------------------------

export function scaffold(root, name) {
  if (!SLUG.test(name)) throw new Error(`nom invalide « ${name} » (minuscules, chiffres, tirets)`);
  const dir = join(root, CHANGES_DIR, UNRELEASED, name);
  if (existsSync(join(dir, 'entry.md'))) throw new Error(`${dir}/entry.md existe déjà`);
  mkdirSync(join(dir, 'img'), { recursive: true });
  writeFileSync(
    join(dir, 'entry.md'),
    `---
type: new            # new | improved | fixed
title: Un titre court qui donne envie
pitch: Une phrase enthousiaste qui dit ce qui change pour ${WORDS.reader}.
audience: players    # players | admins | developers
images:
  # - img/capture.jpg
---
Deux à six phrases pour ${WORDS.reader} : ce qui change, comment en profiter. Voir le ton dans ${CHANGES_DIR}/README.md.
`,
  );
  return dir;
}

// Why `version` cannot be the next generation, or null: SemVer, after the latest released one, not taken yet.
export function checkVersion(changes, version) {
  if (!parseVersion(version)) return `version invalide « ${version ?? ''} » : attendu X.Y.Z`;
  const latest = changes.released[0]?.version;
  if (latest && compareVersions(version, latest) <= 0) return `${version} doit venir après ${latest}, la dernière ${WORDS.word} publiée`;
  return null;
}

// What a publication takes: the entries of the planned generation `version`, or `slugs`, or else every unreleased
// entry; the version (proposed when not given), and the title and intro of the plan unless given.
export function selectRelease(changes, { version, slugs, title, intro } = {}) {
  const planned = version ? changes.plan.versions.find((candidate) => candidate.version === version) : undefined;
  const chosen = slugs ?? planned?.entries ?? null;
  const entries = chosen
    ? chosen.map((slug) => changes.unreleased.entries.find((entry) => entry.slug === slug) ?? { slug, missing: true, errors: [`absente de ${CHANGES_DIR}/${UNRELEASED}`] })
    : changes.unreleased.entries;
  const from = changes.released[0]?.version ?? changes.current;
  const target = version || (chosen ? nextVersion(from, entries) : changes.next);
  const problems = [];
  if (!entries.length) problems.push(chosen ? `rien à publier : aucune entrée affectée à la ${releaseName(target)}` : `rien à publier dans ${CHANGES_DIR}/${UNRELEASED}`);
  for (const entry of entries) for (const error of entry.errors) problems.push(`entrée invalide ${UNRELEASED}/${entry.slug} : ${error}`);
  const invalid = target ? checkVersion(changes, target) : 'aucune version proposée';
  if (invalid) problems.push(invalid);
  return {
    version: target,
    planned: Boolean(planned),
    all: !chosen,
    entries,
    title: title || planned?.title || '',
    intro: intro || planned?.intro || '',
    problems,
  };
}

// The changes as they will be once the selected entries (selectRelease) are published as their version: for a preview
// of the changelog and of the « Nouvelles mutations » before publishing. The other entries stay unreleased.
export function previewRelease(changes, { version, slugs, date = today(), title, intro } = {}) {
  const selection = selectRelease(changes, { version: version ?? (slugs ? undefined : changes.next), slugs, title, intro });
  // An invalid entry would stop the publication: the preview shows the valid ones.
  const entries = selection.entries.filter((entry) => !entry.missing && !entry.errors.length);
  if (!entries.length || !selection.version) return changes;
  const rest = changes.unreleased.entries.filter((entry) => !entries.includes(entry));
  const frozen = { ...changes.unreleased, version: selection.version, date, title: selection.title || null, intro: selection.intro, entries };
  return {
    ...changes,
    current: selection.version,
    next: nextVersion(selection.version, rest),
    unreleased: { ...changes.unreleased, entries: rest },
    released: [frozen, ...changes.released].sort((a, b) => compareVersions(b.version, a.version)),
    plan: { ...changes.plan, versions: changes.plan.versions.filter((planned) => planned.version !== selection.version) },
  };
}

const today = () => new Date().toISOString().slice(0, 10);
// A front matter value on one line, quoted so that a # or a colon in it survive.
const frontValue = (text) => `"${String(text).replace(/\s+/g, ' ').trim()}"`;

// Freezes the selected entries (selectRelease: a planned generation, `slugs`, or every unreleased entry) into
// changes/vX.Y.Z, takes them out of the plan and sets the version of every package.json. The other entries stay in
// changes/unreleased. Returns the version and the paths it changed, for a commit of these paths only (publish.mjs).
export function release(root, version, { date = today(), title, intro, slugs } = {}) {
  const changes = loadChanges(root);
  const selection = selectRelease(changes, { version, slugs, title, intro });
  if (selection.problems.length) throw new Error(selection.problems.join('\n'));
  const target = selection.version;
  const from = join(root, CHANGES_DIR, UNRELEASED);
  const to = join(root, CHANGES_DIR, `v${target}`);
  if (existsSync(to)) throw new Error(`${to} existe déjà`);
  mkdirSync(to);
  const moved = selection.entries.map((entry) => entry.slug);
  for (const slug of moved) renameSync(join(from, slug), join(to, slug));
  const text = selection.intro.trim();
  writeFileSync(join(to, 'release.md'), `---\ndate: ${date}\ntitle: ${frontValue(selection.title)}\n---\n${text ? `${text}\n` : ''}`);
  const plan = planOf(changes);
  const kept = plan
    .filter((planned) => planned.version !== target)
    .map((planned) => ({ ...planned, entries: planned.entries.filter((slug) => !moved.includes(slug)) }));
  const planChanged = JSON.stringify(kept) !== JSON.stringify(plan);
  if (planChanged) writePlan(root, kept);
  const packages = packageFiles(root);
  for (const file of packages) {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    json.version = target;
    writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  }
  writeChangelog(root);
  return {
    version: target,
    title: selection.title,
    slugs: moved,
    paths: [
      `${CHANGES_DIR}/v${target}`,
      ...moved.map((slug) => `${CHANGES_DIR}/${UNRELEASED}/${slug}`),
      ...(planChanged ? [`${CHANGES_DIR}/${PLAN_FILE}`] : []),
      project.paths.changelog,
      ...packages.map((file) => relative(root, file)),
    ],
  };
}

export function packageFiles(root) {
  // The patterns of paths.packages: a path, or dir/*/file with one level of folders.
  const files = [];
  for (const pattern of project.paths.packages) {
    const [before, after] = pattern.split('/*/');
    const found = after === undefined ? [join(root, pattern)] : listDirs(join(root, before)).map((name) => join(root, before, name, after));
    for (const file of found) if (existsSync(file) && !files.includes(file)) files.push(file);
  }
  return files;
}

// --- CLI ---------------------------------------------------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command = 'check', argument] = process.argv.slice(2);
  const fail = (message) => {
    console.error(message);
    process.exit(1);
  };
  try {
    if (command === 'check') {
      const changes = loadChanges();
      const errors = [...changes.errors, ...changes.plan.errors];
      if (errors.length) fail(`✖ ${errors.length} problème(s) :\n  ${errors.join('\n  ')}`);
      const count = changes.unreleased.entries.length;
      const planned = changes.plan.versions.map((planned) => `${planned.version} (${planned.entries.length})`).join(', ');
      console.log(`✔ ${count} entrée(s) en préparation${count ? ` pour la ${changes.next}` : ''}${planned ? `, planifiées : ${planned}` : ''}, ${changes.released.length} version(s) publiée(s)`);
    } else if (command === 'build') {
      console.log(`Changelog : ${writeChangelog()}`);
    } else if (command === 'next') {
      console.log(loadChanges().next ?? '');
    } else if (command === 'release') {
      console.log(release(repoRoot, argument || undefined, { title: process.env.TITLE ?? '' }).version);
    } else if (command === 'plan') {
      const changes = loadChanges();
      for (const planned of changes.plan.versions) {
        console.log(`${releaseName(planned.version)} (v${planned.version})${planned.title ? ` : ${planned.title}` : ''}`);
        for (const slug of planned.entries) console.log(`  - ${slug}`);
        for (const problem of planned.problems) console.log(`  ✖ ${problem}`);
      }
      const waiting = changes.unreleased.entries.filter((entry) => !assignedTo(changes, entry.slug)).map((entry) => entry.slug);
      console.log(`À publier, sans ${WORDS.word} : ${waiting.join(', ') || 'aucune'}`);
    } else if (command === 'assign') {
      const version = process.argv[4];
      if (!argument || !version) fail('usage : changes.mjs assign <nom> <x.y.z|->');
      assignEntry(repoRoot, argument, version === '-' ? null : version);
      console.log(version === '-' ? `${argument} : sans ${WORDS.word}` : `${argument} → ${releaseName(version)}`);
    } else if (command === 'new') {
      if (!argument) fail('usage : changes.mjs new <nom>');
      console.log(scaffold(repoRoot, argument));
    } else {
      fail(`commande inconnue « ${command} » (check, build, next, release, plan, assign, new)`);
    }
  } catch (error) {
    fail(`✖ ${error.message}`);
  }
}
