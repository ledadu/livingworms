// @ts-nocheck
// The workshop, ported from Hydra's editor.js. The interface code (tree, property
// panels, models, generator, fusion) is the original, kept loosely typed because
// it is built around dynamic property paths; the stage is new: the creature is a
// 3D whip drawn by the same ribbons as the game, so what is edited here is what
// is played.

import { att, clamp, clone, palette, spec, stats, mutate, randomPalette, SHAPES, NAMES, ROLE_HELP, AI_HELP, TAU, STEP } from '../engine';
import { PARTS, part, SPECIES, INFO, CATS, generate, fuse, FAMILIES, MOODS, FUSIONS } from '../content';
import { Creature3, swimFactor3 } from '../engine3/creature3';
import { draw3, drawSkeleton3, eachGlow3, pick3 } from '../engine3/render3';
import { snapshot3 } from '../engine3/snapshot3';
import { TRAIT_LABELS, traitsOf } from '../content/traits';
import { View } from '../engine3/view';
import { glowSprite } from '../monde/sprites';

export interface AtelierContext { playLabel?: string; onPlay?: (spec: unknown) => void; onClose?: () => void; }
export interface Atelier { open(spec?: unknown, ctx?: AtelierContext): void; close(): void; readonly isOpen: boolean; }

const E = {
  spec, att, clone, clamp, palette, stats, mutate, randomPalette, SHAPES, NAMES, ROLE_HELP, TAU, STEP,
  PARTS, part, SPECIES, INFO, CATS, generate, fuse, FAMILIES, MOODS, FUSIONS, snapshot: snapshot3
};

export function createAtelier(): Atelier {
// La Lignée — l'Atelier : species editor built on the whip engine.
// The tree on the left of the panel is the structure (parts and their
// attachments), the properties below edit the selected part. Every change
// rebuilds the live creature in the aquarium above.

var DEG = 180 / Math.PI;
var $ = function (id) { return document.getElementById(id); };

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) { /* private mode */ }
  return null;
}

var ed = {
  open: false,
  spec: null,
  sel: null,          // { node, att, parent }
  undo: [], redo: [],
  last: '',
  mode: 'swim',
  skeleton: false,
  tab: 'parts',
  cr: null,
  t: 0,
  acc: 0,
  cam: { x: 0, y: 0, z: 1, ext: 200, dist: 600 },
  pointer: null,
  target: null,
  rebuildQueued: false,
  sections: { attach: true, shape: true, palette: true, swim: true },
  onPlay: null,
  onClose: null
};

var stage = $('atCanvas'), sctx = stage.getContext('2d');
var SW = 0, SH = 0, sdpr = 1;

// ----- selection helpers ----- //

function rows() {
  var out = [];
  (function rec(node, att, parent, depth) {
    out.push({ node: node, att: att, parent: parent, depth: depth });
    node.attach.forEach(function (a) { rec(a.node, a, node, depth + 1); });
  })(ed.spec.body, null, null, 0);
  return out;
}

function selectNode(node) {
  var r = rows().filter(function (x) { return x.node === node; })[0];
  ed.sel = r || rows()[0];
  renderTree();
  renderProps();
}

function patternBadge(a) {
  if (!a) return 'tronc';
  var mirrored = a.mirror && a.pattern !== 'pair' && a.pattern !== 'single';
  switch (a.pattern) {
    case 'pair': return 'paire';
    case 'fan': return 'éventail ×' + a.count + (mirrored && Math.abs(Math.sin(a.angle)) > 0.05 ? ' ×2' : '');
    case 'series': return 'série ×' + a.count + (a.mirror ? ' ×2' : '');
    default: return 'seul';
  }
}

// ----- history ----- //

function snapshotSpec() { return JSON.stringify(ed.spec); }

function commit() {
  var s = snapshotSpec();
  if (s === ed.last) return;
  ed.undo.push(ed.last);
  if (ed.undo.length > 80) ed.undo.shift();
  ed.redo.length = 0;
  ed.last = s;
  store('lignee.atelier', s);
  updateHistoryButtons();
}

function restore(json) {
  var path = ed.sel ? pathOf(ed.sel.node) : [];
  ed.spec = E.spec(JSON.parse(json));
  ed.last = json;
  store('lignee.atelier', json);
  var n = nodeAt(path) || ed.spec.body;
  rebuild(true);
  selectNode(n);
  syncName();
  renderSpecies();
  updateHistoryButtons();
}

function pathOf(node) {
  var found = null;
  (function rec(n, p) {
    if (n === node) { found = p; return; }
    n.attach.forEach(function (a, i) { if (!found) rec(a.node, p.concat(i)); });
  })(ed.spec.body, []);
  return found || [];
}
function nodeAt(path) {
  var n = ed.spec.body;
  for (var i = 0; i < path.length; i++) {
    if (!n.attach[path[i]]) return null;
    n = n.attach[path[i]].node;
  }
  return n;
}

function updateHistoryButtons() {
  $('atUndo').disabled = !ed.undo.length;
  $('atRedo').disabled = !ed.redo.length;
}

$('atUndo').addEventListener('click', function () {
  if (!ed.undo.length) return;
  ed.redo.push(ed.last);
  restore(ed.undo.pop());
});
$('atRedo').addEventListener('click', function () {
  if (!ed.redo.length) return;
  ed.undo.push(ed.last);
  restore(ed.redo.pop());
});

// ----- live creature ----- //

function rebuild(now) {
  if (!now) { ed.rebuildQueued = true; return; }
  ed.rebuildQueued = false;
  var old = ed.cr, x = 0, y = 0, phase = 0, yaw = 0;
  if (old) { x = old.root.x[0]; y = old.root.y[0]; phase = old.phase; yaw = old.yaw; }
  ed.cr = new Creature3(ed.spec, x, y, 0, { dir: { x: Math.cos(yaw) < 0 ? -1 : 1, y: 0, z: 0 }, phase: phase });
  if (old) { ed.cr.vx = old.vx; ed.cr.vy = old.vy; ed.cr.yaw = ed.cr.yawGoal = old.yaw; }
  // a few steps so that a fresh body is not a straight stick
  for (var i = 0; i < 24; i++) ed.cr.steer(ed.t + i * STEP, old ? old.vx : 0.6, old ? old.vy : 0, 0, 0.2);
  renderMeter();
}

function renderMeter() {
  var nodes = 0, depth = 0;
  ed.cr.list.forEach(function (s) { nodes += s.n + 1; if (s.depth > depth) depth = s.depth; });
  var chains = ed.cr.list.length, heavy = chains > 120 || nodes > 900;
  var m = $('atMeter');
  m.textContent = chains + ' chaînes · ' + nodes + ' nœuds · ' + (depth + 1) + ' niveaux' + (heavy ? ' · lourd pour le jeu' : '');
  m.classList.toggle('warn', heavy);
  var tr = traitsOf(ed.spec);
  $('atTraits').textContent = tr.length ? 'Traits : ' + tr.map(function (t) { return TRAIT_LABELS[t]; }).join(' · ') : 'Aucun trait';
}

// ----- controls ----- //

function get(path) {
  var parts = path.split('.'), o = parts[0] === 'spec' ? ed.spec : parts[0] === 'att' ? ed.sel.att : ed.sel.node;
  for (var i = 1; i < parts.length; i++) o = o[parts[i]];
  return o;
}
function set(path, v) {
  var parts = path.split('.'), o = parts[0] === 'spec' ? ed.spec : parts[0] === 'att' ? ed.sel.att : ed.sel.node;
  for (var i = 1; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = v;
}

var uid = 0;

function toDisplay(f, v) {
  if (v === null || v === undefined) v = f.fallback ? get(f.fallback) : 0;
  if (f.deg) return v * DEG;
  if (f.pct) return v * 100;
  return v;
}
function fromDisplay(f, d) {
  if (f.deg) return d / DEG;
  if (f.pct) return d / 100;
  return d;
}
function fmt(f, d) {
  var dec = f.dec !== undefined ? f.dec : (f.step < 1 && !f.deg && !f.pct ? (f.step < 0.1 ? 2 : 1) : 0);
  return d.toFixed(dec) + (f.deg ? '°' : f.pct ? ' %' : f.unit || '');
}

function rangeRow(f) {
  var id = 'at-f' + (uid++);
  var row = document.createElement('div');
  row.className = 'f-row';
  var dMin = f.deg ? f.min : f.pct ? f.min : f.min, dMax = f.max;
  var value = toDisplay(f, get(f.p));
  row.innerHTML = '<label></label><output></output><input type="range">' + (f.hint ? '<small class="hint"></small>' : '');
  var label = row.querySelector('label'), out = row.querySelector('output'), input = row.querySelector('input');
  label.textContent = f.label;
  label.htmlFor = id;
  input.id = id;
  input.min = dMin;
  input.max = dMax;
  input.step = f.dstep || f.step;
  input.value = value;
  out.textContent = fmt(f, value);
  if (f.hint) row.querySelector('.hint').textContent = f.hint;
  if (f.snaps) {
    var dl = document.createElement('datalist');
    dl.id = id + '-dl';
    f.snaps.forEach(function (s) { var o = document.createElement('option'); o.value = s; dl.appendChild(o); });
    row.appendChild(dl);
    input.setAttribute('list', dl.id);
  }
  input.addEventListener('input', function () {
    var d = parseFloat(input.value);
    if (f.snaps) {
      var tol = (dMax - dMin) * 0.018;
      f.snaps.forEach(function (s) { if (Math.abs(d - s) < tol) d = s; });
    }
    if (f.int) d = Math.round(d);
    out.textContent = fmt(f, d);
    set(f.p, fromDisplay(f, d));
    if (f.after) f.after(d);
    rebuild();
    if (f.tree) renderTreeSoon();
  });
  input.addEventListener('change', function () {
    input.value = toDisplay(f, get(f.p));
    commit();
    if (f.rerender) renderProps();
  });
  return row;
}

function chipsRow(f) {
  var row = document.createElement('div');
  row.className = 'f-row chips-row';
  if (f.label) {
    var lab = document.createElement('span');
    lab.className = 'f-label';
    lab.textContent = f.label;
    row.appendChild(lab);
  }
  var group = document.createElement('div');
  group.className = 'chips' + (f.icons ? ' with-icons' : '');
  group.setAttribute('role', 'group');
  if (f.label) group.setAttribute('aria-label', f.label);
  var cur = get(f.p);
  f.opts.forEach(function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(o[0] === cur));
    if (f.icons) {
      var ic = f.icons(o[0]);
      if (ic) b.appendChild(ic);
    }
    var t = document.createElement('span');
    t.textContent = o[1];
    b.appendChild(t);
    b.addEventListener('click', function () {
      set(f.p, o[0]);
      if (f.after) f.after(o[0]);
      rebuild(true);
      commit();
      if (f.tree) renderTree();
      if (f.species) renderSpecies(); else renderProps();
    });
    group.appendChild(b);
  });
  row.appendChild(group);
  if (f.help) {
    var h = document.createElement('small');
    h.className = 'hint';
    h.textContent = f.help(cur) || '';
    row.appendChild(h);
  }
  return row;
}

function toggleRow(f) {
  var row = document.createElement('label');
  row.className = 'f-row toggle-row';
  var input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!get(f.p);
  input.id = 'at-f' + (uid++);
  var span = document.createElement('span');
  span.textContent = f.label;
  row.appendChild(input);
  row.appendChild(span);
  input.addEventListener('change', function () {
    set(f.p, input.checked);
    rebuild(true);
    commit();
    if (f.species) renderSpecies(); else renderProps();
    renderTree();
  });
  return row;
}

function textRow(f) {
  var row = document.createElement('div');
  row.className = 'f-row';
  var id = 'at-f' + (uid++);
  row.innerHTML = '<label></label><input type="text" maxlength="32">';
  row.querySelector('label').textContent = f.label;
  row.querySelector('label').htmlFor = id;
  var input = row.querySelector('input');
  input.id = id;
  input.value = get(f.p);
  input.addEventListener('input', function () { set(f.p, input.value || 'Partie'); renderTreeSoon(); });
  input.addEventListener('change', commit);
  return row;
}

function buildField(f) {
  if (f.t === 'chips') return chipsRow(f);
  if (f.t === 'toggle') return toggleRow(f);
  if (f.t === 'text') return textRow(f);
  return rangeRow(f);
}

// ----- icons ----- //

var iconCache = {};
function shapeIcon(shape) {
  if (iconCache[shape]) return iconCache[shape].cloneNode();
  var c = document.createElement('canvas');
  c.width = 88; c.height = 36;
  var g = c.getContext('2d'), fn = E.SHAPES[shape];
  g.fillStyle = '#5ef2d6';
  g.beginPath();
  g.moveTo(6, 18);
  for (var i = 0; i <= 40; i++) g.lineTo(6 + i * 1.9, 18 - fn(14, i / 40));
  for (var j = 40; j >= 0; j--) g.lineTo(6 + j * 1.9, 18 + fn(14, j / 40));
  g.closePath();
  g.fill();
  var img = new Image();
  img.src = c.toDataURL();
  img.className = 'chip-icon';
  img.alt = '';
  iconCache[shape] = img;
  return img.cloneNode();
}

function swatch(color) {
  var s = document.createElement('i');
  s.className = 'swatch';
  s.style.background = color;
  return s;
}

function slotColor(k) {
  var p = E.palette(ed.spec.palette)[k];
  return 'hsl(' + p.h + ',' + p.s + '%,' + p.l + '%)';
}

// ----- property schema ----- //

var PATTERNS = objOpts(E.NAMES.pattern);
function objOpts(o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }); }
function isRow(att) { return att && (att.pattern === 'fan' || att.pattern === 'series' || att.pattern === 'ring'); }

function partSections() {
  var sel = ed.sel, a = sel.att, n = sel.node, isRoot = !a;
  var sections = [];
  if (a) {
    sections.push({ id: 'attach', title: 'Accroche', fields: [
      { p: 'att.pattern', t: 'chips', opts: PATTERNS, tree: true },
      { p: 'att.at', label: a.pattern === 'series' ? 'Départ' : 'Position', min: 0, max: 100, step: 1, pct: true, snaps: [0, 25, 50, 75, 100],
        hint: '0 % = tête du parent · 100 % = bout' },
      a.pattern === 'series' && { p: 'att.to', label: 'Arrivée', min: 0, max: 100, step: 1, pct: true, snaps: [0, 25, 50, 75, 100] },
      isRow(a) && { p: 'att.count', label: 'Nombre', min: 1, max: 24, step: 1, int: true, tree: true },
      { p: 'att.angle', label: a.pattern === 'series' ? 'Angle au départ' : a.pattern === 'fan' ? 'Direction' : a.pattern === 'ring' ? 'Rotation de l\'anneau' : 'Angle', min: -180, max: 180, step: 1, deg: true,
        snaps: [-180, -135, -90, -45, 0, 45, 90, 135, 180], hint: '0° = vers l\'arrière · 90° = sur le côté · 180° = vers l\'avant' },
      a.pattern === 'series' && { p: 'att.angleTo', fallback: 'att.angle', label: 'Angle à l\'arrivée', min: -180, max: 180, step: 1, deg: true, snaps: [-180, -135, -90, -45, 0, 45, 90, 135, 180] },
      a.pattern === 'fan' && { p: 'att.spread', label: 'Ouverture', min: 0, max: 360, step: 1, deg: true, snaps: [0, 45, 90, 180, 270, 360] },
      { p: 'att.edge', label: 'Vers le bord', min: -100, max: 100, step: 1, pct: true, snaps: [-100, -50, 0, 50, 100],
        hint: a.pattern === 'fan' ? 'Répartit les copies sur la largeur du parent' : 'Déplace l\'accroche de l\'axe vers le bord du parent' },
      { p: 'att.scale', label: 'Taille', min: 20, max: 250, step: 1, pct: true, snaps: [50, 100, 150, 200] },
      isRow(a) && { p: 'att.scaleTo', label: a.pattern === 'fan' ? 'Taille aux extrémités' : a.pattern === 'ring' ? 'Taille à l\'opposé' : 'Taille à l\'arrivée', min: 20, max: 250, step: 1, pct: true, snaps: [50, 100, 150] },
      isRow(a) && { p: 'att.phaseStep', label: 'Décalage de rythme', min: 0, max: 3.14, step: 0.02,
        hint: 'Décale le mouvement d\'une copie à la suivante : une vague parcourt la rangée' },
      isRow(a) && { p: 'att.web', label: 'Membrane', min: 0, max: 100, step: 1, pct: true, snaps: [0, 50, 100],
        hint: 'Tend une peau entre les copies voisines, jusqu\'à cette fraction de leur longueur (nageoires à rayons, bras palmés)' },
      isRow(a) && { p: 'att.jitter', label: 'Variation naturelle', min: 0, max: 100, step: 1, pct: true,
        hint: 'Chaque copie diffère un peu en angle, taille et rythme, toujours de la même façon' },
      isRow(a) && { p: 'att.hueStep', label: 'Arc-en-ciel', min: -60, max: 60, step: 1, unit: '°', snaps: [0], hint: 'Décale la teinte d\'une copie à la suivante' },
      a.pattern === 'series' && { p: 'att.alternate', t: 'toggle', label: 'Alterner gauche / droite', tree: true },
      (a.pattern === 'fan' || (a.pattern === 'series' && !a.alternate)) && { p: 'att.mirror', t: 'toggle', label: 'Miroir des deux côtés', tree: true },
      { p: 'att.front', t: 'toggle', label: 'Dessiné devant son parent' }
    ] });
  }
  sections.push({ id: 'shape', title: 'Forme', fields: [
    { p: 'node.name', t: 'text', label: 'Nom' },
    { p: 'node.style', t: 'chips', label: 'Rendu', opts: objOpts(E.NAMES.style) },
    { p: 'node.shape', t: 'chips', label: 'Profil', opts: objOpts(E.NAMES.shape), icons: shapeIcon },
    { p: 'node.links', label: 'Maillons', min: 1, max: 40, step: 1, int: true },
    { p: 'node.len', label: 'Longueur d\'un maillon', min: 0.5, max: 16, step: 0.1 },
    { p: 'node.lenTo', label: 'Maillons au bout', min: 10, max: 250, step: 1, pct: true, snaps: [25, 50, 100, 150, 200],
      hint: 'Des maillons qui raccourcissent + une courbure = une spirale de coquille' },
    { p: 'node.width', label: n.style === 'eye' ? 'Taille de l\'œil' : 'Largeur', min: 0.2, max: 30, step: 0.1 }
  ] });
  sections.push({ id: 'phys', title: 'Souplesse', fields: [
    { p: 'node.flex', label: 'Souplesse', min: 0, max: 100, step: 1, pct: true, hint: '0 % = rigide comme une carapace · 100 % = fouet' },
    { p: 'node.spring', label: 'Mémoire de forme', min: 0, max: 100, step: 1, pct: true, hint: 'Force qui ramène la partie à sa pose de repos' },
    { p: 'node.curl', label: 'Courbure de repos', min: -720, max: 720, step: 1, deg: true, snaps: [-360, -180, -90, 0, 90, 180, 360] },
    { p: 'node.curlBias', label: 'Répartition de la courbure', min: -100, max: 100, step: 1, pct: true, snaps: [-100, 0, 100],
      hint: '−100 % = pliée à la base · +100 % = enroulée au bout (queue d\'hippocampe)' },
    { p: 'node.drag', label: 'Glisse dans l\'eau', min: 60, max: 97, step: 1, pct: true, hint: 'Bas = eau épaisse, les parties suivent sagement' },
    { p: 'node.gravity', label: 'Poids', min: -0.15, max: 0.15, step: 0.005, snaps: [0], hint: 'Négatif = flotte vers le haut' }
  ] });
  var mt = n.motion.type;
  var dv = n.drive || 'none';
  sections.push({ id: 'drive', title: 'Déplacement', fields: [
    { p: 'node.drive', t: 'chips', label: 'Rôle de cette partie dans le déplacement', opts: objOpts(E.NAMES.drive), help: function (v) { return DRIVE_HELP[v]; } }
  ] });
  sections.push({ id: 'motion', title: dv === 'none' ? 'Mouvement' : 'Mouvement (rythme et amplitude du déplacement)', fields: [
    dv === 'none' && { p: 'node.motion.type', t: 'chips', opts: objOpts(E.NAMES.motion), help: function (v) { return MOTION_HELP[v]; } },
    mt !== 'none' && { p: 'node.motion.amp', label: 'Amplitude', min: 0, max: 1.5, step: 0.01 },
    mt !== 'none' && dv === 'none' && { p: 'node.motion.freq', label: 'Fréquence', min: 0.1, max: 4, step: 0.05, unit: ' Hz' },
    mt === 'undulate' && { p: 'node.motion.wave', label: 'Nombre de vagues', min: 0.25, max: 3, step: 0.05 }
  ] });
  sections.push({ id: 'color', title: 'Couleur', fields: [
    { p: 'node.color.slot', t: 'chips', label: 'Teinte de la palette', opts: [[0, 'Principale'], [1, 'Deuxième'], [2, 'Troisième'], [3, 'Accent']],
      icons: function (k) { return swatch(slotColor(k)); } },
    { p: 'node.color.shift', label: 'Nuance', min: -180, max: 180, step: 1, unit: '°', snaps: [0] },
    { p: 'node.color.light', label: 'Luminosité', min: -40, max: 40, step: 1, snaps: [0] },
    { p: 'node.color.grad', label: 'Dégradé vers le bout', min: -50, max: 50, step: 1, snaps: [0] },
    { p: 'node.color.alpha', label: 'Opacité', min: 5, max: 100, step: 1, pct: true },
    { p: 'node.color.fade', label: 'Fondu vers le bout', min: 0, max: 100, step: 1, pct: true },
    { p: 'node.color.glow', t: 'chips', label: 'Lueur', opts: objOpts(E.NAMES.glow) },
    { p: 'node.color.add', t: 'toggle', label: 'Lumière additive (effet translucide)' },
    { p: 'node.color.pattern', t: 'chips', label: 'Motif', opts: objOpts(E.NAMES.motif) },
    n.color.pattern !== 'none' && { p: 'node.color.pslot', t: 'chips', label: 'Couleur du motif', opts: [[0, 'Principale'], [1, 'Deuxième'], [2, 'Troisième'], [3, 'Accent']],
      icons: function (k) { return swatch(slotColor(k)); } },
    n.color.pattern !== 'none' && { p: 'node.color.plight', label: 'Luminosité du motif', min: -50, max: 50, step: 1, snaps: [0] },
    ['bands', 'spots', 'ocelli'].indexOf(n.color.pattern) >= 0 && { p: 'node.color.pdensity', label: MOTIF_COUNT[n.color.pattern], min: 1, max: 16, step: 1, int: true },
    ['spots', 'stripe', 'ocelli', 'edge'].indexOf(n.color.pattern) >= 0 && { p: 'node.color.pscale', label: 'Taille du motif', min: 20, max: 300, step: 1, pct: true, snaps: [100] }
  ] });
  var roles = objOpts(E.NAMES.role).filter(function (r) { return isRoot ? r[0] === 'body' : r[0] !== 'body'; });
  if (!isRoot) {
    sections.push({ id: 'role', title: 'Rôle en jeu', fields: [
      { p: 'node.role', t: 'chips', opts: roles, help: function (v) { return E.ROLE_HELP[v]; } }
    ] });
  }
  return sections;
}

var MOTIF_COUNT = { bands: 'Nombre de bandes', spots: 'Densité des taches', ocelli: 'Nombre d\'ocelles' };

var DRIVE_HELP = {
  none: 'La partie ne pousse pas l\'animal : elle peut bouger comme elle veut (saisir, parer, briller), sans rien à voir avec la nage.',
  pull: 'Les bras tirent ensemble vers l\'arrière : c\'est ce qui propulse par saccades, et le corps se contracte avec eux (poulpe, calmar).',
  paddle: 'Pagaies qui rament, un côté après l\'autre, au rythme de la nage (pattes natatoires, nageoires de tortue).',
  walk: 'Pattes qui avancent à tour de rôle : elles ne bougent que quand l\'animal marche, au rythme de ses pas.',
  ripple: 'Nageoire qui ondule à la cadence de la nage (seiche, raie).'
};

var MOTION_HELP = {
  none: 'La partie ne bouge que par la physique.',
  flutter: 'Bat nerveusement, sur un rythme irrégulier.',
  breathe: 'Gonfle et dégonfle en entier, comme une respiration.',
  wave: 'Bat de gauche à droite depuis sa base, comme une nageoire.',
  row: 'Coup rapide puis retour lent, comme une rame ou une patte.',
  pulse: 'Gonfle et se contracte, comme une ombrelle de méduse.',
  undulate: 'Une vague parcourt la partie, comme une anguille qui nage.',
  curl: 'S\'enroule et se déroule, comme un bras de poulpe.',
  recoil: 'Se rabat droit derrière le corps à chaque jet, et se détend entre deux (bras de poulpe ou de calmar en nage à réaction).'
};

function renderSections(container, sections, species) {
  container.innerHTML = '';
  sections.forEach(function (sec) {
    var d = document.createElement('details');
    d.className = 'sec';
    d.open = ed.sections[sec.id] !== undefined ? ed.sections[sec.id] : !species;
    d.addEventListener('toggle', function () { ed.sections[sec.id] = d.open; });
    var sum = document.createElement('summary');
    sum.textContent = sec.title;
    d.appendChild(sum);
    var body = document.createElement('div');
    body.className = 'sec-body';
    if (sec.render) sec.render(body);
    sec.fields && sec.fields.forEach(function (f) {
      if (!f) return;
      if (species) f.species = true;
      if (f.t === 'chips' && !f.species) f.rerender = true;
      body.appendChild(buildField(f));
    });
    d.appendChild(body);
    container.appendChild(d);
  });
}

function renderProps() {
  var box = $('atProps');
  var sel = ed.sel;
  var head = document.createElement('div');
  head.className = 'props-head';
  head.innerHTML = '<b></b><span></span>';
  head.querySelector('b').textContent = sel.node.name;
  head.querySelector('span').textContent = sel.att ? patternBadge(sel.att) + ' sur ' + sel.parent.name : 'tronc de l\'espèce';
  renderSections(box, partSections(), false);
  box.insertBefore(head, box.firstChild);
  $('atDup').disabled = !sel.att;
  $('atDel').disabled = !sel.att;
  $('atCut').disabled = !sel.att;
  $('atPaste').disabled = !ed.clip;
}

// ----- tree ----- //

var treeTimer = 0;
function renderTreeSoon() {
  clearTimeout(treeTimer);
  treeTimer = setTimeout(renderTree, 120);
}

function renderTree() {
  var box = $('atTree');
  box.innerHTML = '';
  rows().forEach(function (r) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tree-row' + (ed.sel && r.node === ed.sel.node ? ' on' : '');
    b.style.setProperty('--depth', r.depth);
    b.appendChild(swatch(slotColor(r.node.color.slot)));
    var name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = r.node.name;
    b.appendChild(name);
    var badge = document.createElement('span');
    badge.className = 'tree-badge';
    badge.textContent = patternBadge(r.att);
    b.appendChild(badge);
    b.addEventListener('click', function () {
      ed.sel = r;
      renderTree();
      renderProps();
    });
    box.appendChild(b);
  });
}

// ----- structure actions ----- //

function attachHere(a) {
  ed.sel.node.attach.push(a);
  rebuild(true);
  commit();
  selectNode(a.node);
}

function partsLibrary() {
  try { return JSON.parse(store('lignee.parts') || '[]'); } catch (e) { return []; }
}

function clipOfSelection() {
  var sel = ed.sel;
  // the trunk itself can be copied: it becomes a limb somewhere else
  return sel.att ? E.clone(sel.att) : E.clone(E.att({ node: sel.node, pattern: 'single', at: 0.5, angle: 1.2 }));
}

$('atCopy').addEventListener('click', function () {
  ed.clip = clipOfSelection();
  $('atPaste').disabled = false;
  flash('Copié : ' + ed.sel.node.name);
});
$('atCut').addEventListener('click', function () {
  if (!ed.sel.att) return;
  ed.clip = clipOfSelection();
  var parent = ed.sel.parent, i = parent.attach.indexOf(ed.sel.att);
  if (i >= 0) parent.attach.splice(i, 1);
  rebuild(true);
  commit();
  selectNode(parent);
  flash('Coupé : touche une partie puis « Coller »');
});
$('atPaste').addEventListener('click', function () {
  if (!ed.clip) return;
  attachHere(E.att(E.clone(ed.clip)));
});
$('atKeep').addEventListener('click', function () {
  var lib = partsLibrary(), c = clipOfSelection();
  lib.unshift({ name: ed.sel.node.name, att: c });
  store('lignee.parts', JSON.stringify(lib.slice(0, 40)));
  flash('Ajoutée à « Mes parties »');
});

$('atAdd').addEventListener('click', function () {
  openSheet('Ajouter une partie sur « ' + ed.sel.node.name + ' »', function (body) {
    var mine = partsLibrary();
    if (mine.length) {
      var h = document.createElement('h3');
      h.className = 'tab-title';
      h.textContent = 'Mes parties';
      body.appendChild(h);
      var mg = document.createElement('div');
      mg.className = 'card-grid';
      mine.forEach(function (it, i) {
        var b = document.createElement('div');
        b.className = 'pick-card';
        b.innerHTML = '<canvas></canvas><b></b><div class="btn-row"><button type="button" class="ghost">Ajouter</button><button type="button" class="ghost danger">Retirer</button></div>';
        b.querySelector('b').textContent = it.name;
        var btns = b.querySelectorAll('button');
        btns[0].addEventListener('click', function () { closeSheet(); attachHere(E.att(E.clone(it.att))); });
        btns[1].addEventListener('click', function () {
          var l = partsLibrary();
          l.splice(i, 1);
          store('lignee.parts', JSON.stringify(l));
          b.remove();
        });
        mg.appendChild(b);
        requestAnimationFrame(function () {
          E.snapshot(E.spec({ palette: ed.spec.palette, eyes: { on: false }, body: E.clone(it.att.node) }), b.querySelector('canvas'), { max: 5 });
        });
      });
      body.appendChild(mg);
      var h2 = document.createElement('h3');
      h2.className = 'tab-title';
      h2.textContent = 'Bibliothèque';
      body.appendChild(h2);
    }
    var grid = document.createElement('div');
    grid.className = 'card-grid';
    Object.keys(E.PARTS).forEach(function (id) {
      var p = E.PARTS[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick-card';
      b.innerHTML = '<canvas></canvas><b></b><small></small>';
      b.querySelector('b').textContent = p.node.name;
      b.querySelector('small').textContent = p.desc;
      b.addEventListener('click', function () {
        closeSheet();
        attachHere(E.part(id));
      });
      grid.appendChild(b);
      requestAnimationFrame(function () {
        E.snapshot(E.spec({ palette: ed.spec.palette, eyes: { on: false }, body: E.clone(p.node) }), b.querySelector('canvas'), { max: 5 });
      });
    });
    body.appendChild(grid);
  });
});

$('atDup').addEventListener('click', function () {
  var sel = ed.sel;
  if (!sel.att) return;
  var copy = E.att(E.clone(sel.att));
  if (copy.pattern !== 'fan') {
    copy.at = E.clamp(copy.at + 0.12, 0, 1);
    if (copy.pattern === 'series') copy.to = E.clamp(copy.to + 0.12, 0, 1);
  }
  sel.parent.attach.push(copy);
  rebuild(true);
  commit();
  selectNode(copy.node);
});

$('atDel').addEventListener('click', function () {
  var sel = ed.sel;
  if (!sel.att) return;
  var i = sel.parent.attach.indexOf(sel.att);
  if (i >= 0) sel.parent.attach.splice(i, 1);
  rebuild(true);
  commit();
  selectNode(sel.parent);
});

// ----- species tab ----- //

function renderSpecies() {
  var box = $('atTabSpecies');
  var sections = [
    { id: 'palette', title: 'Palette', render: function (body) {
      var sw = document.createElement('div');
      sw.className = 'palette-strip';
      [0, 1, 2, 3].forEach(function (k) { sw.appendChild(swatch(slotColor(k))); });
      body.appendChild(sw);
    }, fields: [
      { p: 'spec.palette.harmony', t: 'chips', label: 'Harmonie', opts: objOpts(E.NAMES.harmony) },
      { p: 'spec.palette.hue', label: 'Teinte', min: 0, max: 360, step: 1, unit: '°', after: paletteChanged },
      { p: 'spec.palette.sat', label: 'Saturation', min: 0, max: 100, step: 1, unit: ' %', after: paletteChanged },
      { p: 'spec.palette.light', label: 'Luminosité', min: 15, max: 85, step: 1, unit: ' %', after: paletteChanged }
    ] },
    { id: 'size', title: 'Taille', fields: [
      { p: 'spec.size', label: 'Taille de l\'espèce', min: 30, max: 250, step: 1, pct: true, snaps: [50, 100, 150, 200],
        hint: 'Agrandit ou réduit toute la créature, en gardant ses proportions' }
    ] },
    { id: 'swim', title: 'Nage', fields: [
      { p: 'spec.swim.mode', t: 'chips', opts: objOpts(E.NAMES.swim) },
      { p: 'spec.swim.speed', label: 'Vitesse', min: 0.5, max: 4, step: 0.1 },
      (ed.spec.swim.mode === 'pulse' || ed.spec.swim.mode === 'bell' || ed.spec.swim.mode === 'jet') && { p: 'spec.swim.freq', label: 'Rythme des pulsations', min: 0.2, max: 3, step: 0.05, unit: ' Hz',
        hint: 'Si le tronc a le mouvement « Pulsation », c\'est son rythme qui est utilisé' }
    ] },
    { id: 'ai', title: 'Comportement en jeu', fields: [
      { p: 'spec.ai', t: 'chips', opts: objOpts(E.NAMES.ai), help: function (v) { return AI_HELP[v]; } }
    ] },
    { id: 'eyes', title: 'Yeux sur la tête', fields: [
      { p: 'spec.eyes.on', t: 'toggle', label: 'Afficher deux yeux sur la tête du tronc' },
      ed.spec.eyes.on && { p: 'spec.eyes.size', label: 'Taille', min: 0.4, max: 2.2, step: 0.05 },
      ed.spec.eyes.on && { p: 'spec.eyes.spread', label: 'Écartement', min: 0, max: 1.2, step: 0.01 },
      ed.spec.eyes.on && { p: 'spec.eyes.fwd', label: 'Vers l\'avant', min: -0.6, max: 1, step: 0.01 }
    ] }
  ];
  renderSections(box, sections.map(function (s) {
    if (s.fields) s.fields = s.fields.filter(Boolean);
    return s;
  }), true);
}


function paletteChanged() {
  ed.cr.pal = E.palette(ed.spec.palette);
  ed.cr.list.forEach(function (s) { s.paint(ed.cr.pal); });
  var strip = document.querySelector('.palette-strip');
  if (strip) [].forEach.call(strip.children, function (el, k) { el.style.background = slotColor(k); });
}

// ----- models tab ----- //

function library() {
  try { return JSON.parse(store('lignee.lib') || '[]'); } catch (e) { return []; }
}

function loadSpec(sp) {
  ed.spec = E.spec(E.clone(sp));
  rebuild(true);
  commit();
  selectNode(ed.spec.body);
  syncName();
  renderSpecies();
}

var modelCanvases = {};

// portraits are drawn when their card scrolls into view
var lazy = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
  entries.forEach(function (en) {
    if (!en.isIntersecting || !en.target._draw) return;
    en.target._draw();
    en.target._draw = null;
    lazy.unobserve(en.target);
  });
}, { rootMargin: '200px' }) : null;

function lazyDraw(cv, fn) {
  if (lazy) { cv._draw = fn; lazy.observe(cv); } else requestAnimationFrame(fn);
}

function renderModels() {
  var box = $('atTabModels');
  box.innerHTML = '';

  var h = document.createElement('h3');
  h.className = 'tab-title';
  h.textContent = 'Bestiaire · ' + Object.keys(E.SPECIES).length + ' espèces';
  box.appendChild(h);

  var cat = ed.modelCat || 'all';
  var chips = document.createElement('div');
  chips.className = 'chips';
  [['all', 'Toutes']].concat(E.CATS).forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(c[0] === cat));
    b.textContent = c[1];
    b.addEventListener('click', function () { ed.modelCat = c[0]; renderModels(); });
    chips.appendChild(b);
  });
  box.appendChild(chips);

  var grid = document.createElement('div');
  grid.className = 'card-grid models';
  Object.keys(E.SPECIES).forEach(function (id) {
    var info = E.INFO[id] || ['autres', ''];
    if (cat !== 'all' && info[0] !== cat) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick-card';
    b.innerHTML = '<b></b><small></small>';
    var cv = modelCanvases[id];
    if (!cv) {
      cv = modelCanvases[id] = document.createElement('canvas');
      lazyDraw(cv, function () { E.snapshot(E.SPECIES[id](), cv); });
    }
    b.insertBefore(cv, b.firstChild);
    var sp0 = E.SPECIES[id]();
    b.querySelector('b').textContent = sp0.name;
    b.querySelector('small').textContent = info[1];
    b.addEventListener('click', function () {
      var sp = E.SPECIES[id]();
      loadSpec(sp);
      switchTab('parts');
    });
    grid.appendChild(b);
  });
  box.appendChild(grid);

  var h2 = document.createElement('h3');
  h2.className = 'tab-title';
  h2.textContent = 'Mes espèces';
  box.appendChild(h2);
  var lib = library();
  var list = document.createElement('div');
  list.className = 'lib-list';
  if (!lib.length) {
    var empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aucune espèce enregistrée sur cet appareil.';
    list.appendChild(empty);
  }
  lib.forEach(function (sp, i) {
    var row = document.createElement('div');
    row.className = 'lib-row';
    row.innerHTML = '<canvas></canvas><b></b><button type="button" class="ghost">Ouvrir</button><button type="button" class="ghost danger">Supprimer</button>';
    row.querySelector('b').textContent = sp.name;
    var btns = row.querySelectorAll('button');
    btns[0].addEventListener('click', function () { loadSpec(sp); switchTab('parts'); });
    btns[1].addEventListener('click', function () {
      var l = library();
      l.splice(i, 1);
      store('lignee.lib', JSON.stringify(l));
      renderModels();
    });
    list.appendChild(row);
    requestAnimationFrame(function () { E.snapshot(E.spec(sp), row.querySelector('canvas'), { pad: 2 }); });
  });
  box.appendChild(list);

  var actions = document.createElement('div');
  actions.className = 'btn-row';
  [['Enregistrer « ' + ed.spec.name + ' »', saveToLibrary], ['Exporter', exportSheet], ['Importer', importSheet]].forEach(function (a) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ghost';
    b.textContent = a[0];
    b.addEventListener('click', a[1]);
    actions.appendChild(b);
  });
  box.appendChild(actions);
}

function saveToLibrary() {
  var lib = library().filter(function (s) { return s.name !== ed.spec.name; });
  lib.unshift(E.clone(ed.spec));
  store('lignee.lib', JSON.stringify(lib.slice(0, 30)));
  renderModels();
  flash('Enregistrée dans « Mes espèces »');
}

function exportSheet() {
  openSheet('Exporter « ' + ed.spec.name + ' »', function (body) {
    var ta = document.createElement('textarea');
    ta.readOnly = true;
    ta.id = 'atExport';
    ta.value = JSON.stringify(ed.spec);
    body.appendChild(ta);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cta sm';
    b.textContent = 'Copier';
    b.addEventListener('click', function () {
      var done = function () { b.textContent = 'Copié'; };
      try {
        navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); });
      } catch (e) { ta.select(); }
    });
    body.appendChild(b);
  });
}

function importSheet() {
  openSheet('Importer une espèce', function (body) {
    var ta = document.createElement('textarea');
    ta.id = 'atImport';
    ta.placeholder = 'Colle ici le JSON d\'une espèce exportée';
    body.appendChild(ta);
    var err = document.createElement('p');
    err.className = 'hint danger';
    body.appendChild(err);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cta sm';
    b.textContent = 'Importer';
    b.addEventListener('click', function () {
      try {
        var o = JSON.parse(ta.value);
        if (!o || !o.body) throw new Error('pas de tronc');
        loadSpec(E.spec(o));
        closeSheet();
        switchTab('parts');
      } catch (e) {
        err.textContent = 'Ce texte n\'est pas une espèce valide (' + e.message + '). Colle le JSON complet copié depuis « Exporter ».';
      }
    });
    body.appendChild(b);
  });
}

// ----- invent tab: generator, variations, fusion ----- //
// every action proposes a litter of 4 candidates; tap one to take it

var inv = { family: 'any', mood: 'any', complexity: 0.5, glow: 0.3, partner: 'SPECIES:meduse', mode: 'mix', share: 0.5, palette: 'mix', litter: [], litterTitle: '' };

function carnetList() {
  try { return JSON.parse(store('lignee.carnet') || '[]'); } catch (e) { return []; }
}

function partnerSpec(key) {
  var i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1);
  if (kind === 'SPECIES' && E.SPECIES[id]) return E.SPECIES[id]();
  var list = kind === 'LIB' ? library() : kind === 'CARNET' ? carnetList().map(function (x) { return x.spec; }) : [];
  var sp = list[parseInt(id, 10)];
  return sp ? E.spec(E.clone(sp)) : E.SPECIES.meduse();
}

function chipGroup(label, opts, cur, onPick) {
  var row = document.createElement('div');
  row.className = 'f-row chips-row';
  var lab = document.createElement('span');
  lab.className = 'f-label';
  lab.textContent = label;
  row.appendChild(lab);
  var g = document.createElement('div');
  g.className = 'chips';
  opts.forEach(function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = o[1];
    b.setAttribute('aria-pressed', String(o[0] === cur));
    b.addEventListener('click', function () { onPick(o[0]); renderInvent(); });
    g.appendChild(b);
  });
  row.appendChild(g);
  return row;
}

function slider(label, value, fmtFn, onInput) {
  var row = document.createElement('div');
  row.className = 'f-row';
  var id = 'at-f' + (uid++);
  row.innerHTML = '<label></label><output></output><input type="range" min="0" max="100" step="1">';
  row.querySelector('label').textContent = label;
  row.querySelector('label').htmlFor = id;
  var input = row.querySelector('input'), out = row.querySelector('output');
  input.id = id;
  input.value = Math.round(value * 100);
  out.textContent = fmtFn(value);
  input.addEventListener('input', function () {
    var v = input.value / 100;
    out.textContent = fmtFn(v);
    onInput(v);
  });
  return row;
}

function button(label, cls, fn) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function pct(v) { return Math.round(v * 100) + ' %'; }

function setLitter(title, list) {
  inv.litter = list;
  inv.litterTitle = title;
  renderInvent();
  var el = document.getElementById('atLitter');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

function renderLitter(box) {
  if (!inv.litter.length) return;
  var wrap = document.createElement('div');
  wrap.id = 'atLitter';
  wrap.className = 'litter';
  var h = document.createElement('h3');
  h.className = 'tab-title';
  h.textContent = inv.litterTitle;
  wrap.appendChild(h);
  var grid = document.createElement('div');
  grid.className = 'card-grid';
  inv.litter.forEach(function (sp) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick-card';
    b.innerHTML = '<canvas></canvas><b></b><small></small>';
    b.querySelector('b').textContent = sp.name;
    var st = E.stats(sp);
    b.querySelector('small').textContent = (sp.gen ? 'graine ' + sp.gen.seed + ' · ' : '') + st.chains + ' chaînes';
    b.addEventListener('click', function () { loadSpec(sp); switchTab('parts'); });
    grid.appendChild(b);
    requestAnimationFrame(function () { E.snapshot(sp, b.querySelector('canvas')); });
  });
  wrap.appendChild(grid);
  var hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Touche une créature pour la prendre. Annuler (↶) ramène la précédente.';
  wrap.appendChild(hint);
  box.appendChild(wrap);
}

function section(box, id, title, fill) {
  var d = document.createElement('details');
  d.className = 'sec';
  d.open = ed.sections[id] !== undefined ? ed.sections[id] : true;
  d.addEventListener('toggle', function () { ed.sections[id] = d.open; });
  var sum = document.createElement('summary');
  sum.textContent = title;
  d.appendChild(sum);
  var body = document.createElement('div');
  body.className = 'sec-body';
  fill(body);
  d.appendChild(body);
  box.appendChild(d);
}

function renderInvent() {
  var box = $('atTabInvent');
  box.innerHTML = '';

  section(box, 'gen', 'Générateur', function (body) {
    body.appendChild(chipGroup('Famille', E.FAMILIES, inv.family, function (v) { inv.family = v; }));
    body.appendChild(chipGroup('Ambiance', E.MOODS, inv.mood, function (v) { inv.mood = v; }));
    body.appendChild(slider('Complexité', inv.complexity, pct, function (v) { inv.complexity = v; }));
    body.appendChild(slider('Bioluminescence', inv.glow, pct, function (v) { inv.glow = v; }));
    var row = document.createElement('div');
    row.className = 'btn-row';
    row.appendChild(button('Générer 4 créatures', 'cta sm', function () {
      var base = Math.floor(Math.random() * 0xFFFFFF), list = [];
      for (var k = 0; k < 4; k++) list.push(E.generate({ seed: base + k * 7919, archetype: inv.family, mood: inv.mood, complexity: inv.complexity, glow: inv.glow }));
      setLitter('Portée générée', list);
    }));
    if (ed.spec.gen) {
      row.appendChild(button('Régénérer « ' + ed.spec.name + ' »', 'ghost', function () {
        var g = ed.spec.gen;
        setLitter('Même graine, nouveaux réglages', [E.generate({ seed: g.seed, archetype: g.archetype, mood: g.mood, complexity: inv.complexity, glow: inv.glow })]);
      }));
    }
    body.appendChild(row);
    var h = document.createElement('small');
    h.className = 'hint';
    h.textContent = 'Une même graine avec les mêmes réglages redonne toujours la même créature.';
    body.appendChild(h);
  });

  section(box, 'vary', 'Variations de « ' + ed.spec.name + ' »', function (body) {
    var row = document.createElement('div');
    row.className = 'btn-row';
    [['4 nuances', 0.35], ['4 mutants', 1], ['4 mutants extrêmes', 2]].forEach(function (b) {
      row.appendChild(button(b[0], 'ghost', function () {
        var list = [];
        for (var k = 0; k < 4; k++) { var m = E.mutate(ed.spec, b[1]); m.gen = null; list.push(m); }
        setLitter(b[0], list);
      }));
    });
    row.appendChild(button('Palette au hasard', 'ghost', function () {
      var list = [];
      for (var k = 0; k < 4; k++) { var c = E.spec(E.clone(ed.spec)); c.palette = E.randomPalette(); list.push(c); }
      setLitter('4 palettes', list);
    }));
    body.appendChild(row);
    var h = document.createElement('small');
    h.className = 'hint';
    h.textContent = 'Les variations gardent la structure : tailles, courbures, angles, nombres et couleurs changent.';
    body.appendChild(h);
  });

  section(box, 'fuse', 'Fusion', function (body) {
    var row = document.createElement('div');
    row.className = 'f-row';
    var id = 'at-f' + (uid++);
    row.innerHTML = '<label>Avec l\'espèce B</label><select></select>';
    row.querySelector('label').htmlFor = id;
    var sel = row.querySelector('select');
    sel.id = id;
    function group(label, items) {
      if (!items.length) return;
      var g = document.createElement('optgroup');
      g.label = label;
      items.forEach(function (it) {
        var o = document.createElement('option');
        o.value = it[0];
        o.textContent = it[1];
        g.appendChild(o);
      });
      sel.appendChild(g);
    }
    group('Bestiaire', Object.keys(E.SPECIES).map(function (k) { return ['SPECIES:' + k, E.SPECIES[k]().name]; }));
    group('Mes espèces', library().map(function (s, i) { return ['LIB:' + i, s.name]; }));
    group('Carnet de balade', carnetList().map(function (it, i) { return ['CARNET:' + i, it.name]; }));
    sel.value = inv.partner;
    sel.addEventListener('change', function () { inv.partner = sel.value; });
    body.appendChild(row);
    body.appendChild(chipGroup('Mode', E.FUSIONS.map(function (f) { return [f[0], f[1]]; }), inv.mode, function (v) { inv.mode = v; }));
    var help = document.createElement('small');
    help.className = 'hint';
    help.textContent = E.FUSIONS.filter(function (f) { return f[0] === inv.mode; })[0][2];
    body.appendChild(help);
    body.appendChild(slider(inv.mode === 'graft' ? 'Position de la greffe' : 'Part de B', inv.share, pct, function (v) { inv.share = v; }));
    body.appendChild(chipGroup('Palette', [['a', 'De A'], ['mix', 'Mélange'], ['b', 'De B']], inv.palette, function (v) { inv.palette = v; }));
    var b = button('Fusionner (4 portées)', 'cta sm', function () {
      var partner = partnerSpec(inv.partner), list = [];
      for (var k = 0; k < 4; k++) list.push(E.fuse(ed.spec, partner, { mode: inv.mode, share: inv.share, palette: inv.palette }));
      setLitter('« ' + ed.spec.name + ' » × « ' + partner.name + ' »', list);
    });
    var r2 = document.createElement('div');
    r2.className = 'btn-row';
    r2.appendChild(b);
    body.appendChild(r2);
  });

  renderLitter(box);
}

// ----- sheet ----- //

function openSheet(title, fill) {
  $('atSheetTitle').textContent = title;
  var body = $('atSheetBody');
  body.innerHTML = '';
  fill(body);
  $('atSheet').hidden = false;
}
function closeSheet() { $('atSheet').hidden = true; }
$('atSheetClose').addEventListener('click', closeSheet);
$('atSheet').addEventListener('click', function (e) { if (e.target === $('atSheet')) closeSheet(); });

var flashTimer = 0;
function flash(text) {
  var el = $('atFlash');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(function () { el.hidden = true; }, 1800);
}

// ----- tabs ----- //

function switchTab(tab) {
  ed.tab = tab;
  [].forEach.call(document.querySelectorAll('.at-tabs button'), function (b) {
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  });
  $('atTabParts').hidden = tab !== 'parts';
  $('atTabSpecies').hidden = tab !== 'species';
  $('atTabModels').hidden = tab !== 'models';
  $('atTabInvent').hidden = tab !== 'invent';
  if (tab === 'invent') renderInvent();
  if (tab === 'species') renderSpecies();
  if (tab === 'models') renderModels();
  if (tab === 'parts') { renderTree(); renderProps(); }
}
[].forEach.call(document.querySelectorAll('.at-tabs button'), function (b) {
  b.addEventListener('click', function () { switchTab(b.dataset.tab); });
});

// ----- name ----- //

function syncName() { $('atName').value = ed.spec.name; }
$('atName').addEventListener('input', function () { ed.spec.name = $('atName').value || 'Espèce'; });
$('atName').addEventListener('change', commit);

// ----- stage ----- //

// ----- stage: the creature is drawn by the same 3D ribbons as the game ----- //

var view = new View();

function resizeStage() {
  var r = stage.getBoundingClientRect();
  SW = Math.max(1, r.width);
  SH = Math.max(1, r.height);
  sdpr = Math.min(2, window.devicePixelRatio || 1);
  stage.width = Math.round(SW * sdpr);
  stage.height = Math.round(SH * sdpr);
  view.resize(SW, SH, SW < SH ? 46 : 38);
}
window.addEventListener('resize', function () { if (ed.open) resizeStage(); });

[].forEach.call(document.querySelectorAll('#atelier .stage-tools [data-mode]'), function (b) {
  b.addEventListener('click', function () {
    ed.mode = b.dataset.mode;
    ed.target = null;
    [].forEach.call(document.querySelectorAll('#atelier .stage-tools [data-mode]'), function (x) {
      x.setAttribute('aria-pressed', String(x === b));
    });
  });
});
$('atNight').addEventListener('click', function () {
  ed.night = !ed.night;
  $('atNight').setAttribute('aria-pressed', String(ed.night));
});
$('atSkel').addEventListener('click', function () {
  ed.skeleton = !ed.skeleton;
  $('atSkel').setAttribute('aria-pressed', String(ed.skeleton));
});

function stageToWorld(x, y) { return view.unproject(x, y, 0); }

stage.addEventListener('pointerdown', function (e) {
  var r = stage.getBoundingClientRect();
  ed.pointer = { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, sx: e.clientX, sy: e.clientY, t: performance.now() };
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (ed.mode === 'follow') ed.target = stageToWorld(ed.pointer.x, ed.pointer.y);
});
stage.addEventListener('pointermove', function (e) {
  if (!ed.pointer || e.pointerId !== ed.pointer.id) return;
  var r = stage.getBoundingClientRect();
  ed.pointer.x = e.clientX - r.left;
  ed.pointer.y = e.clientY - r.top;
  if (ed.mode === 'follow') ed.target = stageToWorld(ed.pointer.x, ed.pointer.y);
});
stage.addEventListener('pointerup', function (e) {
  var p = ed.pointer;
  if (!p || e.pointerId !== p.id) return;
  ed.pointer = null;
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 8 && performance.now() - p.t < 400) {
    var s = pick3(ed.cr, p.x, p.y, 12);
    if (s) {
      if (ed.tab !== 'parts') switchTab('parts');
      selectNode(s.def);
      flash(s.def.name);
      var row = document.querySelector('#atelier .tree-row.on');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }
  }
});
stage.addEventListener('pointercancel', function () { ed.pointer = null; });

/** where the creature wants to go: null = stay put (pose) */
function wanted(t) {
  var cr = ed.cr, r = cr.root, sp = clamp(ed.spec.swim.speed, 0.3, 5) * 1.1;
  var tx, ty;
  if (ed.mode === 'pose') return null;
  if (ed.mode === 'follow') {
    if (!ed.target) return [0, 0];
    tx = ed.target.x; ty = ed.target.y;
  } else {
    // a slow loop that makes it turn round at both ends
    var u = t * 0.32 * sp / 2, R = 150 + ed.cam.ext * 0.2;
    tx = Math.cos(u) * R;
    ty = Math.sin(2 * u) * R * 0.3;
  }
  var dx = tx - r.x[0], dy = ty - r.y[0], d = Math.hypot(dx, dy) || 1;
  var f = swimFactor3(cr, t) * Math.min(1, d / 60);
  return [dx / d * sp * f, dy / d * sp * f];
}

var lastFrame = 0;
function frame(now) {
  if (!ed.open) return;
  requestAnimationFrame(frame);
  var dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  if (ed.rebuildQueued) rebuild(true);
  ed.acc += dt;
  var steps = 0;
  while (ed.acc >= STEP && steps < 4) {
    ed.t += STEP;
    var v = wanted(ed.t), r = ed.cr.root;
    if (v) ed.cr.steer(ed.t, v[0], v[1], clamp(-r.z[0] * 0.035, -0.5, 0.5), 0.08);
    else ed.cr.update(ed.t, 0, 0, 0, 0.1);
    ed.acc -= STEP;
    steps++;
  }
  if (steps === 4) ed.acc = 0;
  drawStage();
}

function aimStage() {
  var cr = ed.cr, b = cr.box, cam = ed.cam;
  var ext = Math.max(60, b[3] - b[0], b[4] - b[1]);
  cam.ext += (ext - cam.ext) * 0.04;
  // far enough that the creature fills about 70 % of the smaller side
  var dist = cam.ext * view.f / (Math.min(SW, SH) * 0.7);
  cam.dist += (dist - cam.dist) * 0.06;
  cam.x += ((b[0] + b[3]) / 2 - cam.x) * 0.08;
  cam.y += ((b[1] + b[4]) / 2 - cam.y) * 0.08;
  view.aim(cam.x, cam.y, cam.dist, 0.14);
}

var P = { x: 0, y: 0, s: 1, d: 1 };

function drawStage() {
  var cr = ed.cr;
  aimStage();
  var c = sctx;
  c.setTransform(sdpr, 0, 0, sdpr, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  var g = c.createRadialGradient(SW / 2, SH * 0.45, 10, SW / 2, SH / 2, Math.max(SW, SH) * 0.75);
  g.addColorStop(0, ed.night ? '#050c16' : '#0e2d38');
  g.addColorStop(1, ed.night ? '#000104' : '#03080e');
  c.fillStyle = g;
  c.fillRect(0, 0, SW, SH);

  // dotted water grid in the swimming plane, so you can see the creature move
  var step = 40, half = cam3().half;
  var x0 = Math.floor((ed.cam.x - half.x) / step) * step, y0 = Math.floor((ed.cam.y - half.y) / step) * step;
  c.fillStyle = 'rgba(160,230,240,0.12)';
  for (var gx = x0; gx < ed.cam.x + half.x + step; gx += step) {
    for (var gy = y0; gy < ed.cam.y + half.y + step; gy += step) {
      view.project(gx, gy, 0, P);
      c.fillRect(P.x - 1, P.y - 1, 2, 2);
    }
  }

  draw3(c, cr, view, { ink: true, water: ed.night ? 0 : 0.3 });
  if (ed.night) {
    // abyss: the body fades into the dark, only its own light remains
    c.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    c.fillStyle = 'rgba(0,2,6,0.72)';
    c.fillRect(0, 0, SW, SH);
    draw3(c, cr, view, { lit: true, water: 0 });
  }
  c.setTransform(sdpr, 0, 0, sdpr, 0, 0);
  c.globalCompositeOperation = 'lighter';
  var gk = ed.night ? 1.4 : 0.6;
  eachGlow3(cr, view, function (x, y, size, hue, a) {
    c.globalAlpha = Math.min(1, a * gk);
    c.drawImage(glowSprite(hue), x - size * gk / 2, y - size * gk / 2, size * gk, size * gk);
  });
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  drawSkeleton3(c, cr, ed.sel && ed.sel.node, ed.skeleton);

  if (ed.mode === 'follow' && ed.target) {
    view.project(ed.target.x, ed.target.y, 0, P);
    c.strokeStyle = 'rgba(94,242,214,0.5)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(P.x, P.y, 8, 0, TAU);
    c.stroke();
  }
}

/** half extent of the visible part of the swimming plane */
function cam3() {
  var a = view.unproject(0, 0, 0), b = view.unproject(SW, SH, 0);
  if (!a || !b) return { half: { x: 300, y: 200 } };
  return { half: { x: Math.abs(b.x - a.x) / 2 + 40, y: Math.abs(b.y - a.y) / 2 + 40 } };
}

// ----- open / close ----- //

function open(sp, ctx) {
  ed.ctx = ctx || null;
  $('atPlay').textContent = (ctx && ctx.playLabel) || 'Jouer';
  var saved = store('lignee.atelier');
  ed.spec = null;
  if (sp) ed.spec = E.spec(E.clone(sp));
  else if (saved) {
    try { ed.spec = E.spec(JSON.parse(saved)); } catch (e) { ed.spec = null; }
  }
  if (!ed.spec) ed.spec = E.SPECIES.meduse();
  ed.last = snapshotSpec();
  ed.undo.length = ed.redo.length = 0;
  ed.cr = null;
  ed.open = true;
  $('atelier').hidden = false;
  resizeStage();
  rebuild(true);
  ed.cam.x = ed.cr.root.x[0]; ed.cam.y = ed.cr.root.y[0]; ed.cam.dist = 600;
  syncName();
  ed.sel = null;
  selectNode(ed.spec.body);
  switchTab('parts');
  updateHistoryButtons();
  lastFrame = 0;
  requestAnimationFrame(frame);
}

function close() {
  ed.open = false;
  $('atelier').hidden = true;
  closeSheet();
  var c = ed.ctx;
  if (c && c.onClose) c.onClose();
  else if (ed.onClose) ed.onClose();
}

$('atBack').addEventListener('click', close);
$('atPlay').addEventListener('click', function () {
  commit();
  var sp = E.clone(ed.spec), c = ed.ctx;
  close();
  if (c && c.onPlay) c.onPlay(sp);
  else if (ed.onPlay) ed.onPlay(sp);
});

return {
  open: open,
  close: close,
  get isOpen() { return ed.open; }
};
}
