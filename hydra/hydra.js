// HYDRA — la lignée des abysses
// Mobile port of the whip engine (whip.js): verlet chains with angle limits,
// sub-whips hanging on the nodes of their parent, easings for the body shape.
// Every creature is a tree of whips; cutting a node cuts its whole subtree.

(function () {
'use strict';

// ----- utils ----- //

var TAU = Math.PI * 2;
var STEP = 1 / 60;

function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function wrapAngle(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}
function weighted(list) {
  var total = 0, i;
  for (i = 0; i < list.length; i++) total += list[i][1];
  var r = Math.random() * total;
  for (i = 0; i < list.length; i++) {
    r -= list[i][1];
    if (r <= 0 && list[i][1] > 0) return list[i][0];
  }
  return list[0][0];
}
function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = a[i];
    a[i] = a[j]; a[j] = t;
  }
  return a;
}
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) { /* private mode */ }
  return null;
}

// ----- easings (from whip.js, nbPeriod = 1) ----- //

var EASE = {
  linear:        function (w, t) { return w * (1 - t); },
  worm:          function (w, t) { return w * (Math.sin(t * Math.PI) / 3 + 1); },
  sansueBigHead: function (w, t) { return w * (Math.sin(t * Math.PI * 1.5) + 1); },
  sansue:        function (w, t) { return w * (Math.sin(-0.5 + t * Math.PI * 1.5) + 1); },
  virgule:       function (w, t) { return w * (Math.cos(t * Math.PI) + 1); },
  bloby:         function (w, t) { return w * (Math.sin(t) / 3 + 1); },
  point:         function (w) { return w; }
};

// ----- kinds: the building blocks of every tree ----- //
// amax: max angle between two links (angleMax in whip.js)
// dmg/thr: damage multiplier and minimal relative speed to hurt
// inert: decorative sub-part, can't be hit nor grafted on

var KINDS = {
  // bodies
  anguille: { name: 'Anguille', links: 16, len: 7, w: 5.5, shape: 'worm', amax: 0.55, fr: 0.8, hp: 45, hs: 40 },
  ver:      { name: 'Larve', links: 10, len: 6, w: 4, shape: 'worm', amax: 0.5, fr: 0.8, hp: 16, hs: 30 },
  meduse:   { name: 'Méduse', links: 5, len: 6, w: 10, shape: 'bloby', amax: 0.3, fr: 0.8, hp: 34, hs: 25 },
  serpent:  { name: 'Serpent', links: 22, len: 6.5, w: 5, shape: 'sansueBigHead', amax: 0.42, fr: 0.8, hp: 55, hs: 60 },
  hydre:    { name: 'Hydre', links: 12, len: 9, w: 9, shape: 'sansue', amax: 0.45, fr: 0.8, hp: 120, hs: 70 },
  // limbs (genes)
  tentacule: { name: 'Tentacule', role: 'whip', links: 10, len: 6, w: 2.4, shape: 'virgule', amax: 2.4, fr: 0.88, hp: 14, dmg: 1, thr: 2.5, hs: 50 },
  dard:      { name: 'Dard', role: 'sting', links: 6, len: 2.6, w: 2.4, shape: 'linear', amax: 0.2, fr: 0.8, hp: 9, dmg: 2, thr: 1.5, glow: true, hs: 20 },
  nageoire:  { name: 'Nageoire', role: 'fin', links: 4, len: 5, w: 4.5, shape: 'sansue', amax: 0.9, fr: 0.8, hp: 12, wave: 0.55, dmg: 0.3, thr: 5, hs: 35 },
  pince:     { name: 'Pince', role: 'jaw', links: 3, len: 4.5, w: 3.2, shape: 'virgule', amax: 0.6, fr: 0.8, hp: 12, dmg: 1.4, thr: 2, hs: 25 },
  cils:      { name: 'Peigne de cils', role: 'cilia', links: 8, len: 4.5, w: 1.4, shape: 'worm', amax: 1.6, fr: 0.86, hp: 11, hs: 60 },
  lanterne:  { name: 'Lanterne', role: 'light', links: 6, len: 5, w: 1.3, shape: 'worm', amax: 1.4, fr: 0.86, hp: 10, hs: 20 },
  // decorative sub-parts
  cil:   { links: 2, len: 3.5, w: 0.9, shape: 'virgule', amax: 1, fr: 0.86, hp: 1, inert: true, hs: 30 },
  bulbe: { links: 1, len: 3, w: 4, shape: 'point', amax: 0, fr: 0.8, hp: 1, inert: true, glow: true, hs: 0 }
};

// attach slots of each body: node indices + angle of the mirrored pair
var SLOTS = {
  anguille: { at: [3, 6, 9, 12], a: 1.15 },
  ver:      { at: [4], a: 1.2 },
  meduse:   { at: [1, 2, 3], a: 0.35 },
  serpent:  { at: [3, 7, 11, 15, 19], a: 1.3 },
  hydre:    { at: [2, 4, 6, 8, 10], a: 1.1 }
};

var MAX_TREE_DEPTH = 4;   // root = 0
var MAX_GENES = 4;

// ----- genes ----- //
// gene = { k: kind, hue, ch: [{ at: node index, a: angle, g: gene }] }

function makeLimb(k, L, hue) {
  hue = (hue + 360) % 360;
  var g = { k: k, hue: hue, ch: [] }, i;
  if (k === 'tentacule') {
    var tip = null, n = KINDS.tentacule.links;
    if (L >= 3 && Math.random() < 0.25) tip = makeLimb('tentacule', L - 2, hue + 25);
    else if (L >= 1 && Math.random() < 0.25 + 0.15 * L) tip = { k: 'dard', hue: (hue + 40) % 360, ch: [] };
    else if (L >= 2 && Math.random() < 0.2) tip = makeLimb('pince', 0, hue + 20);
    if (tip) g.ch.push({ at: n, a: 0, g: tip });
  } else if (k === 'cils') {
    for (i = 1; i <= KINDS.cils.links; i++) {
      var side = i % 2 ? 1 : -1;
      g.ch.push({ at: i, a: side * Math.PI / 2, g: { k: 'cil', hue: hue, ch: [] } });
    }
  } else if (k === 'lanterne') {
    g.ch.push({ at: KINDS.lanterne.links, a: 0, g: { k: 'bulbe', hue: (hue + 50) % 360, ch: [] } });
  } else if (k === 'nageoire' && L >= 3 && Math.random() < 0.3) {
    g.ch.push({ at: KINDS.nageoire.links, a: 0, g: { k: 'dard', hue: (hue + 40) % 360, ch: [] } });
  }
  return g;
}

function cloneGene(g, mirror) {
  return {
    k: g.k, hue: g.hue,
    ch: g.ch.map(function (c) { return { at: c.at, a: mirror ? -c.a : c.a, g: cloneGene(c.g, mirror) }; })
  };
}

function addPair(g, at, a, limb) {
  g.ch.push({ at: at, a: a, g: limb });
  g.ch.push({ at: at, a: -a, g: cloneGene(limb, true) });
}

function geneDepth(g) {
  var d = 0;
  g.ch.forEach(function (c) { if (!KINDS[c.g.k].inert) d = Math.max(d, geneDepth(c.g)); });
  return 1 + d;
}

function geneName(g) {
  var names = [];
  (function walk(x, top) {
    var K = KINDS[x.k];
    if (!K.inert && !top && names.indexOf(K.name) < 0) names.push(K.name);
    x.ch.forEach(function (c) { walk(c.g, false); });
  })(g, true);
  return KINDS[g.k].name + (names.length ? ' + ' + names.join(' + ') : '');
}

function playerGene() {
  var g = { k: 'anguille', hue: 172, ch: [] };
  addPair(g, 6, SLOTS.anguille.a, { k: 'tentacule', hue: 190, ch: [] });
  return g;
}

function enemyGene(L) {
  var hue = rand(0, 360);
  var body = weighted([
    ['ver', L < 2 ? 5 : 1],
    ['anguille', 3],
    ['meduse', L >= 1 ? 3 : 1],
    ['serpent', L >= 1 ? 2 : 0],
    ['hydre', L >= 3 ? 1 + L * 0.3 : 0]
  ]);
  var g = { k: body, hue: hue, ch: [] };
  var slots = SLOTS[body];
  var pairs;
  if (body === 'ver') pairs = Math.random() < 0.6 ? 0 : 1;
  else if (body === 'meduse') pairs = randi(2, 3);
  else pairs = randi(L > 0 ? 1 : 0, Math.min(slots.at.length, 1 + L));
  var ats = shuffle(slots.at.slice()).slice(0, pairs);
  ats.forEach(function (at) {
    var k = body === 'meduse' ? 'tentacule' : weighted([
      ['tentacule', 6], ['nageoire', 3], ['pince', 2 + L * 0.5],
      ['cils', L >= 1 ? 2 : 0], ['lanterne', L >= 2 ? 2.5 : 0.3]
    ]);
    addPair(g, at, slots.a, makeLimb(k, L, hue + rand(-35, 35)));
  });
  return g;
}

// ----- Whip ----- //

function Whip(g, parent, at, a, x, y, baseAngle) {
  var K = KINDS[g.k], n = K.links, i;
  this.g = g;
  this.K = K;
  this.parent = parent;
  this.at = parent ? Math.min(at, parent.n) : 0;
  this.a = a;
  this.depth = parent ? parent.depth + 1 : 0;
  this.n = n;
  this.len = K.len;
  this.hue = g.hue;
  this.maxHp = this.hp = K.hp;
  this.cd = 0;
  this.flash = 0;
  this.phase = Math.random() * TAU;
  this.box = [x, y, x, y];
  this.x = new Float32Array(n + 1);
  this.y = new Float32Array(n + 1);
  this.ox = new Float32Array(n + 1);
  this.oy = new Float32Array(n + 1);
  this.ang = new Float32Array(n + 1);
  this.rad = new Float32Array(n + 1);
  this.col = [];
  for (i = 0; i <= n; i++) {
    var t = i / n;
    this.x[i] = this.ox[i] = x + Math.cos(baseAngle) * this.len * i;
    this.y[i] = this.oy[i] = y + Math.sin(baseAngle) * this.len * i;
    this.ang[i] = baseAngle;
    this.rad[i] = EASE[K.shape](K.w, t);
    var h = (g.hue + (K.hs || 0) * t) % 360,
        s = K.glow ? 100 : 62 + 25 * Math.sin(t * 6),
        l = K.glow ? 68 : 46 + 20 * (1 - t) + (K.inert ? 10 : 0);
    this.col[i] = 'hsl(' + h.toFixed(0) + ',' + s.toFixed(0) + '%,' + l.toFixed(0) + '%)';
  }
  var that = this;
  this.children = g.ch.map(function (c) {
    var at2 = Math.min(c.at, n);
    return new Whip(c.g, that, at2, c.a, that.x[at2], that.y[at2], baseAngle + c.a);
  });
}

Whip.prototype.addChild = function (g, at, a) {
  var w = new Whip(g, this, at, a, this.x[at], this.y[at], this.ang[at] + a);
  this.children.push(w);
  return w;
};

Whip.prototype.update = function (time) {
  var n = this.n, x = this.x, y = this.y, ox = this.ox, oy = this.oy, ang = this.ang, rad = this.rad,
      K = this.K, fixed = null, i;

  if (this.parent) {
    var p = this.parent, k = this.at;
    ox[0] = x[0]; oy[0] = y[0];
    x[0] = p.x[k]; y[0] = p.y[k];
    fixed = p.ang[k] + this.a;
    if (K.wave) fixed += Math.sin(time * 7 + this.phase) * K.wave * (this.a >= 0 ? 1 : -1);
  }

  var fr = K.fr, amax = K.amax, len = this.len, sink = this.sink || 0;
  var minx = x[0] - rad[0], maxx = x[0] + rad[0], miny = y[0] - rad[0], maxy = y[0] + rad[0];

  for (i = 1; i <= n; i++) {
    var px = x[i], py = y[i];
    var vx = (px - ox[i]) * fr, vy = (py - oy[i]) * fr;
    ox[i] = px; oy[i] = py;
    px += vx; py += vy + sink;

    var a;
    if (i === 1 && fixed !== null) {
      a = fixed;
    } else {
      a = Math.atan2(py - y[i - 1], px - x[i - 1]);
      if (i > 1) {
        // angleMax * ((len - i) / len) like whip.js: the tail gets stiffer
        var rel = wrapAngle(a - ang[i - 1]);
        var lim = amax * (n - i + 1) / n + 0.03;
        if (rel > lim) a = ang[i - 1] + lim;
        else if (rel < -lim) a = ang[i - 1] - lim;
      }
    }
    ang[i] = a;
    px = x[i - 1] + Math.cos(a) * len;
    py = y[i - 1] + Math.sin(a) * len;
    x[i] = px; y[i] = py;

    var r = rad[i];
    if (px - r < minx) minx = px - r;
    if (px + r > maxx) maxx = px + r;
    if (py - r < miny) miny = py - r;
    if (py + r > maxy) maxy = py + r;
  }
  ang[0] = ang[1];
  this.box[0] = minx; this.box[1] = miny; this.box[2] = maxx; this.box[3] = maxy;

  if (this.cd > 0) this.cd -= STEP;
  if (this.flash > 0) this.flash -= STEP;

  for (i = 0; i < this.children.length; i++) this.children[i].update(time);
};

Whip.prototype.walk = function (fn) {
  fn(this);
  for (var i = 0; i < this.children.length; i++) this.children[i].walk(fn);
};

Whip.prototype.serialize = function () {
  return {
    k: this.g.k, hue: this.hue,
    ch: this.children.map(function (c) { return { at: c.at, a: c.a, g: c.serialize() }; })
  };
};

// ----- Creature ----- //

function Creature(gene, x, y, opts) {
  opts = opts || {};
  this.isPlayer = !!opts.player;
  this.level = opts.level || 0;
  this.ai = opts.ai || null;
  this.speed = opts.speed || 2;
  this.dmgMult = opts.dmgMult || 1;
  this.root = new Whip(gene, null, 0, 0, x, y, opts.heading === undefined ? Math.PI / 2 : opts.heading);
  this.vx = 0; this.vy = 0;
  this.alive = true;
  this.list = [];
  this.box = [x, y, x, y];
  this.stats = {};
  this.refresh();
  if (this.isPlayer) this.root.maxHp = this.root.hp = 100;
  else this.root.maxHp = this.root.hp = KINDS[gene.k].hp * (1 + 0.25 * this.level);
}

Creature.prototype.refresh = function () {
  var list = this.list, s = { fin: 0, light: 0, cilia: 0, jaw: 0, weapons: 0, depth: 0, count: 0 };
  list.length = 0;
  this.root.walk(function (w) {
    list.push(w);
    s.count++;
    if (w.depth > s.depth) s.depth = w.depth;
    var r = w.K.role;
    if (r === 'fin') s.fin++;
    else if (r === 'cilia') s.cilia++;
    else if (r === 'jaw') s.jaw++;
    if (w.g.k === 'bulbe') s.light++;
    if (w.K.dmg && r !== 'fin') s.weapons++;
  });
  this.stats = s;
  this.dirty = false;
};

Creature.prototype.update = function (time, dvx, dvy, accel) {
  if (this.dirty) this.refresh();
  this.vx += (dvx - this.vx) * accel;
  this.vy += (dvy - this.vy) * accel;
  var r = this.root;
  r.ox[0] = r.x[0]; r.oy[0] = r.y[0];
  r.x[0] += this.vx; r.y[0] += this.vy;
  if (r.y[0] < 24) { r.y[0] = 24; if (this.vy < 0) this.vy *= -0.3; }
  r.update(time);
  var b = this.box, l = this.list;
  b[0] = b[1] = Infinity; b[2] = b[3] = -Infinity;
  for (var i = 0; i < l.length; i++) {
    var wb = l[i].box;
    if (wb[0] < b[0]) b[0] = wb[0];
    if (wb[1] < b[1]) b[1] = wb[1];
    if (wb[2] > b[2]) b[2] = wb[2];
    if (wb[3] > b[3]) b[3] = wb[3];
  }
};

Creature.prototype.heading = function () {
  return this.root.ang[1] + Math.PI;
};

// ----- DOM ----- //

var canvas = document.getElementById('c'),
    ctx = canvas.getContext('2d'),
    bloom = document.createElement('canvas'),
    bctx = bloom.getContext('2d'),
    $ = function (id) { return document.getElementById(id); };

var hasFilter = typeof bctx.filter === 'string';

var W = 0, H = 0, dpr = 1, zoom = 1;
var quality = { level: 2, glow: store('hydra.glow') !== '0' };
var touchUI = matchMedia('(pointer: coarse)').matches;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, quality.level >= 2 ? 2 : 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  bloom.width = Math.max(1, Math.round(W / 5));
  bloom.height = Math.max(1, Math.round(H / 5));
  zoom = clamp(Math.min(W, H) / 440, 0.6, 2.2);
}
window.addEventListener('resize', resize);
resize();

// ----- audio ----- //

var actx = null, noiseBuf = null, muted = store('hydra.mute') === '1', lastCrack = 0;

function ensureAudio() {
  if (actx || muted) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.2, actx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  } catch (e) { actx = null; }
}

function sfx(type) {
  if (!actx || muted) return;
  if (actx.state === 'suspended') actx.resume();
  var t = actx.currentTime, g = actx.createGain();
  g.connect(actx.destination);
  if (type === 'crack' || type === 'cut') {
    if (type === 'crack' && t - lastCrack < 0.06) return;
    lastCrack = t;
    var src = actx.createBufferSource(), f = actx.createBiquadFilter();
    src.buffer = noiseBuf;
    f.type = 'bandpass';
    f.frequency.value = type === 'cut' ? 900 : 2600;
    f.Q.value = 0.8;
    src.connect(f); f.connect(g);
    g.gain.setValueAtTime(type === 'cut' ? 0.5 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (type === 'cut' ? 0.2 : 0.07));
    src.start(t);
    return;
  }
  var o = actx.createOscillator();
  o.connect(g);
  if (type === 'hurt') {
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  } else if (type === 'eat') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.12);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  } else {
    o.type = 'sine';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(990, t + 0.35);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  }
  o.start(t);
  o.stop(t + 0.5);
}

function vibrate(p) {
  try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* not allowed */ }
}

// ----- game state ----- //

var state = {
  mode: 'title',
  t: 0,
  player: null,
  enemies: [],
  debris: [],
  sparks: [],
  rings: [],
  genes: [],
  cam: { x: 0, y: 300, shake: 0 },
  spawnTimer: 0,
  kills: 0, eaten: 0, grafts: 0, maxDepth: 0, maxTree: 1,
  dash: { t: 0, cd: 0, x: 0, y: 1 },
  deadTimer: 0,
  pendingGene: -1
};
var best = parseInt(store('hydra.best') || '0', 10) || 0;

var snow = [];
for (var si = 0; si < 90; si++) snow.push({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), r: rand(0.5, 1.6) });

function depthM(y) { return Math.max(0, y / 10); }
function levelAt(m) { return Math.floor(m / 120); }

function newGame(attract) {
  state.enemies = [];
  state.debris = [];
  state.sparks = [];
  state.rings = [];
  state.genes = [];
  state.kills = state.eaten = state.grafts = 0;
  state.maxDepth = 0;
  state.maxTree = 1;
  state.t = 0;
  state.dash.t = state.dash.cd = 0;
  state.player = new Creature(playerGene(), 0, 260, { player: true, heading: -Math.PI / 2 });
  state.cam.x = 0; state.cam.y = 300;
  for (var i = 0; i < (attract ? 5 : 3); i++) spawnEnemy(true);
  renderTray();
}

function spawnEnemy(near) {
  var p = state.player.root;
  var viewR = Math.hypot(W, H) / 2 / zoom;
  var a = Math.random() < 0.7 ? rand(0.15, 0.85) * Math.PI : rand(0, TAU);
  var dist = near ? rand(viewR * 0.6, viewR * 1.1) : viewR * 1.1 + rand(0, 220);
  var x = p.x[0] + Math.cos(a) * dist, y = Math.max(90, p.y[0] + Math.sin(a) * dist);
  var L = levelAt(depthM(y));
  var gene = enemyGene(L);
  var probe = new Creature(gene, x, y, { level: L });
  var type;
  if (gene.k === 'meduse') type = 'drifter';
  else if (probe.stats.weapons === 0) type = 'prey';
  else type = Math.random() < 0.45 + 0.12 * L ? 'hunter' : 'prey';
  probe.ai = { type: type, tx: x, ty: y, timer: 0, orb: rand(0, TAU), spin: Math.random() < 0.5 ? 1 : -1, lunge: rand(1.5, 3) };
  probe.speed = (type === 'drifter' ? 0.9 : 1.9) * (1 + 0.06 * Math.min(L, 8)) * (gene.k === 'hydre' ? 0.8 : 1);
  probe.dmgMult = 0.5 * (1 + 0.14 * L);
  state.enemies.push(probe);
}

// ----- effects ----- //

function sparks(x, y, hue, n, speed) {
  for (var i = 0; i < n && state.sparks.length < 260; i++) {
    var a = rand(0, TAU), s = rand(0.5, speed || 3);
    state.sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), hue: hue });
  }
}

function ring(x, y, hue, size) {
  state.rings.push({ x: x, y: y, hue: hue, r: 4, max: size || 40, life: 1 });
}

var toastEl = $('toasts');
function toast(text, kind) {
  var el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = text;
  toastEl.appendChild(el);
  while (toastEl.children.length > 3) toastEl.removeChild(toastEl.firstChild);
  setTimeout(function () { el.classList.add('out'); }, 2200);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2800);
}

// ----- combat ----- //

function boxHit(a, b, pad) {
  return a[0] - pad < b[2] && a[2] + pad > b[0] && a[1] - pad < b[3] && a[3] + pad > b[1];
}

function strike(A, D) {
  if (!A.alive || !D.alive || !boxHit(A.box, D.box, 4)) return;
  var al = A.list, dl = D.list;
  for (var wi = 0; wi < al.length; wi++) {
    var aw = al[wi], K = aw.K;
    if (!K.dmg || !boxHit(aw.box, D.box, 4)) continue;
    for (var i = 1; i <= aw.n; i++) {
      var ax = aw.x[i], ay = aw.y[i], ar = aw.rad[i] + 1.5;
      var avx = ax - aw.ox[i], avy = ay - aw.oy[i];
      for (var di = 0; di < dl.length; di++) {
        var dw = dl[di];
        if (dw.cd > 0 || dw.K.inert || dw.creatureCut) continue;
        var b = dw.box;
        if (ax < b[0] - ar || ax > b[2] + ar || ay < b[1] - ar || ay > b[3] + ar) continue;
        for (var j = 0; j <= dw.n; j++) {
          var dx = dw.x[j] - ax, dy = dw.y[j] - ay, rr = dw.rad[j] + ar;
          if (dx * dx + dy * dy > rr * rr) continue;
          var rvx = avx - (dw.x[j] - dw.ox[j]), rvy = avy - (dw.y[j] - dw.oy[j]);
          var s = Math.sqrt(rvx * rvx + rvy * rvy);
          if (s > K.thr) {
            hit(dw, D, Math.min(26, (1 + s - K.thr) * K.dmg * A.dmgMult * 1.3), ax, ay, avx, avy, A);
            if (!D.alive) return;
          }
          break;
        }
      }
    }
  }
}

function hit(dw, D, dmg, x, y, vx, vy, A) {
  dw.hp -= dmg;
  dw.cd = 0.18;
  dw.flash = 0.1;
  sparks(x, y, dw.hue, 3 + Math.min(10, dmg * 0.5), 2 + dmg * 0.15);
  D.vx += vx * 0.06;
  D.vy += vy * 0.06;
  if (D.isPlayer) {
    vibrate(dw.parent ? 20 : 45);
    sfx('hurt');
    state.cam.shake = Math.min(10, state.cam.shake + 2 + dmg * 0.3);
  } else if (A.isPlayer) {
    vibrate(10);
    sfx('crack');
    state.cam.shake = Math.min(6, state.cam.shake + 0.5 + dmg * 0.08);
  }
  if (dw.hp <= 0) {
    if (dw.parent) cut(dw, D, A);
    else killCreature(D);
  }
}

function cut(w, C, A) {
  var p = w.parent, idx = p.children.indexOf(w);
  if (idx >= 0) p.children.splice(idx, 1);
  var gene = w.serialize();
  w.walk(function (x) { x.creatureCut = true; x.cd = 0.5; });
  var vx = w.x[0] - w.ox[0], vy = w.y[0] - w.oy[0];
  w.parent = null;
  w.sink = 0.01;
  state.debris.push({ w: w, gene: w.K.inert ? null : gene, bio: 8, vx: vx, vy: vy, life: 16, age: 0 });
  C.dirty = true;
  ring(w.x[0], w.y[0], w.hue, 34);
  sfx('cut');
  if (C.isPlayer && !C.dying) {
    toast('Membre perdu : ' + geneName(gene), 'bad');
    vibrate([30, 40, 30]);
  } else if (A && A.isPlayer && !C.dying) {
    vibrate([15, 25, 15]);
  }
}

function killCreature(C) {
  C.alive = false;
  C.dying = true;
  var root = C.root;
  root.children.slice().forEach(function (c) { cut(c, C, null); });
  root.walk(function (x) { x.creatureCut = true; });
  root.sink = 0.015;
  state.debris.push({ w: root, gene: null, bio: 25, vx: C.vx, vy: C.vy, life: 14, age: 0 });
  ring(root.x[0], root.y[0], root.hue, 70);
  sparks(root.x[0], root.y[0], root.hue, 24, 5);
  if (C.isPlayer) {
    state.mode = 'dying';
    state.deadTimer = 1.6;
    sfx('hurt');
    vibrate([60, 50, 120]);
  } else {
    state.kills++;
    toast(KINDS[root.g.k].name + ' vaincue');
  }
}

function eat(d) {
  var p = state.player;
  d.life = 0;
  d.eaten = true;
  sfx('eat');
  vibrate(12);
  state.eaten++;
  var heal = d.bio + p.stats.jaw * 4;
  if (d.gene) {
    if (state.genes.length < MAX_GENES) {
      state.genes.push(d.gene);
      toast('Gène absorbé : ' + geneName(d.gene) + ' · niv. ' + geneDepth(d.gene), 'gene');
      renderTray();
    } else {
      heal += 12;
      toast('Réserve pleine : gène digéré');
    }
  }
  p.root.hp = Math.min(p.root.maxHp, p.root.hp + heal);
  ring(d.w.x[0], d.w.y[0], 50, 26);
}

// ----- grafting ----- //

function attachPoints() {
  var p = state.player, pts = [];
  if (!p || !p.alive || state.pendingGene < 0) return pts;
  var gene = state.genes[state.pendingGene], gd = geneDepth(gene);
  var root = p.root;
  SLOTS.anguille.at.forEach(function (k) {
    if (root.children.some(function (c) { return c.at === k; })) return;
    pts.push({ w: root, at: k, pair: true });
  });
  p.list.forEach(function (w) {
    if (w === root || w.K.inert || w.depth + gd > MAX_TREE_DEPTH) return;
    if (w.children.some(function (c) { return c.at === w.n && !c.K.inert; })) return;
    if (w.g.k === 'lanterne') return;
    pts.push({ w: w, at: w.n, pair: false });
  });
  pts.forEach(function (pt) { pt.x = pt.w.x[pt.at]; pt.y = pt.w.y[pt.at]; });
  return pts;
}

function graftAt(pt) {
  var p = state.player, gene = state.genes[state.pendingGene];
  if (pt.pair) {
    pt.w.addChild(gene, pt.at, SLOTS.anguille.a);
    pt.w.addChild(cloneGene(gene, true), pt.at, -SLOTS.anguille.a);
  } else {
    pt.w.addChild(gene, pt.at, 0);
  }
  state.genes.splice(state.pendingGene, 1);
  state.pendingGene = -1;
  p.refresh();
  state.grafts++;
  state.maxTree = Math.max(state.maxTree, p.stats.depth + 1);
  ring(pt.x, pt.y, 50, 50);
  sparks(pt.x, pt.y, 50, 18, 3);
  sfx('graft');
  vibrate([10, 30, 10]);
  toast('Greffe réussie · arbre de ' + (p.stats.depth + 1) + ' niveaux', 'gene');
  setMode('play');
  renderTray();
}

// ----- input ----- //

var input = { joy: null, swipe: null, mouse: null, keys: {} };

function screenToWorld(sx, sy) {
  return {
    x: state.cam.x + (sx - W / 2) / zoom,
    y: state.cam.y + (sy - H / 2) / zoom
  };
}

function requestDash(dx, dy) {
  var d = state.dash;
  if (d.cd > 0 || !state.player || !state.player.alive) return false;
  if (dx === undefined) {
    var p = state.player;
    if (input.joy && Math.hypot(input.joy.x - input.joy.ox, input.joy.y - input.joy.oy) > 8) {
      dx = input.joy.x - input.joy.ox; dy = input.joy.y - input.joy.oy;
    } else if (Math.hypot(p.vx, p.vy) > 0.6) {
      dx = p.vx; dy = p.vy;
    } else {
      var h = p.heading();
      dx = Math.cos(h); dy = Math.sin(h);
    }
  }
  var m = Math.hypot(dx, dy) || 1;
  d.x = dx / m; d.y = dy / m;
  d.t = 0.22;
  d.cd = 0.7;
  return true;
}

canvas.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  ensureAudio();
  if (state.mode === 'graft') {
    var w = screenToWorld(e.clientX, e.clientY), bestPt = null, bestD = 38 / zoom;
    attachPoints().forEach(function (pt) {
      var d = Math.hypot(pt.x - w.x, pt.y - w.y);
      if (d < bestD) { bestD = d; bestPt = pt; }
    });
    if (bestPt) graftAt(bestPt);
    return;
  }
  if (state.mode !== 'play') return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (e.pointerType === 'mouse') {
    input.mouse = { x: e.clientX, y: e.clientY };
    requestDash();
    return;
  }
  if (e.clientX < W * 0.5 && !input.joy) {
    input.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  } else {
    input.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), redirected: false };
    requestDash();
  }
}, { passive: false });

canvas.addEventListener('pointermove', function (e) {
  if (e.pointerType === 'mouse') {
    input.mouse = { x: e.clientX, y: e.clientY };
    return;
  }
  if (input.joy && e.pointerId === input.joy.id) {
    input.joy.x = e.clientX;
    input.joy.y = e.clientY;
  } else if (input.swipe && e.pointerId === input.swipe.id && !input.swipe.redirected) {
    var dx = e.clientX - input.swipe.x, dy = e.clientY - input.swipe.y;
    if (Math.hypot(dx, dy) > 22 && performance.now() - input.swipe.t < 260) {
      input.swipe.redirected = true;
      var m = Math.hypot(dx, dy);
      state.dash.x = dx / m; state.dash.y = dy / m;
      if (state.dash.t > 0) state.dash.t = 0.22;
    }
  }
});

function endPointer(e) {
  if (input.joy && e.pointerId === input.joy.id) input.joy = null;
  if (input.swipe && e.pointerId === input.swipe.id) input.swipe = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') input.mouse = null; });
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

window.addEventListener('keydown', function (e) {
  input.keys[e.key.toLowerCase()] = true;
  if (e.key === ' ' && state.mode === 'play') { requestDash(); e.preventDefault(); }
  if (e.key === 'Escape') {
    if (state.mode === 'graft') cancelGraft();
    else if (state.mode === 'play') setMode('pause');
    else if (state.mode === 'pause') setMode('play');
  }
});
window.addEventListener('keyup', function (e) { input.keys[e.key.toLowerCase()] = false; });

// ----- simulation ----- //

function wander(c, sp) {
  var ai = c.ai, r = c.root;
  ai.timer -= STEP;
  if (ai.timer <= 0 || Math.hypot(ai.tx - r.x[0], ai.ty - r.y[0]) < 30) {
    ai.tx = r.x[0] + rand(-320, 320);
    ai.ty = Math.max(80, r.y[0] + rand(-220, 260));
    ai.timer = rand(2, 5);
  }
  var dx = ai.tx - r.x[0], dy = ai.ty - r.y[0], m = Math.hypot(dx, dy) || 1;
  return [dx / m * sp, dy / m * sp];
}

function aiControl(e, t, playing) {
  var p = state.player, ai = e.ai, r = e.root, sp = e.speed;
  var engaged = playing && p && p.alive;
  var dx = engaged ? p.root.x[0] - r.x[0] : 0, dy = engaged ? p.root.y[0] - r.y[0] : 0;
  var d = Math.hypot(dx, dy) || 1;
  var v;
  if (ai.type === 'prey') {
    v = engaged && d < 230 ? [-dx / d * sp * 1.35, -dy / d * sp * 1.35] : wander(e, sp * 0.55);
  } else if (ai.type === 'drifter') {
    var pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 + ai.orb), 2);
    v = engaged && d < 200 ? [dx / d * sp * pulse, dy / d * sp * pulse] : wander(e, sp * pulse);
  } else {
    if (engaged && d < 380) {
      ai.lunge -= STEP;
      if (ai.lunge < 0) {
        v = [dx / d * sp * 2.2, dy / d * sp * 2.2];
        if (ai.lunge < -0.35) ai.lunge = rand(1.4, 3);
      } else if (d > 120) {
        v = [dx / d * sp * 1.1, dy / d * sp * 1.1];
      } else {
        ai.orb += 0.03 * ai.spin;
        var tx = p.root.x[0] + Math.cos(ai.orb) * 70 - r.x[0],
            ty = p.root.y[0] + Math.sin(ai.orb) * 70 - r.y[0],
            tm = Math.hypot(tx, ty) || 1;
        v = [tx / tm * sp * 1.25, ty / tm * sp * 1.25];
      }
    } else {
      v = wander(e, sp * 0.6);
    }
  }
  e.update(t, v[0], v[1], 0.06);
}

function playerControl(p, t) {
  var sp = 3 * (1 + Math.min(0.8, 0.12 * p.stats.fin)), dvx = 0, dvy = 0, acc = 0.09;
  if (state.mode === 'title') {
    if (!p.ai) p.ai = { tx: 0, ty: 300, timer: 0 };
    var w = wander(p, sp * 0.7);
    dvx = w[0]; dvy = w[1];
  } else if (input.joy) {
    var jx = input.joy.x - input.joy.ox, jy = input.joy.y - input.joy.oy, jm = Math.hypot(jx, jy);
    if (jm > 6) {
      var f = Math.min(1, jm / 60);
      dvx = jx / jm * sp * f; dvy = jy / jm * sp * f;
    }
  } else if (input.keys.w || input.keys.a || input.keys.s || input.keys.d ||
             input.keys.arrowup || input.keys.arrowdown || input.keys.arrowleft || input.keys.arrowright) {
    var kx = (input.keys.d || input.keys.arrowright ? 1 : 0) - (input.keys.a || input.keys.arrowleft ? 1 : 0),
        ky = (input.keys.s || input.keys.arrowdown ? 1 : 0) - (input.keys.w || input.keys.arrowup ? 1 : 0),
        km = Math.hypot(kx, ky) || 1;
    dvx = kx / km * sp; dvy = ky / km * sp;
  } else if (input.mouse && state.mode === 'play') {
    // like whip.js: the head follows the mouse
    var target = screenToWorld(input.mouse.x, input.mouse.y),
        mx = target.x - p.root.x[0], my = target.y - p.root.y[0], mm = Math.hypot(mx, my);
    if (mm > 8) {
      var mf = Math.min(1, mm / 120);
      dvx = mx / mm * sp * mf; dvy = my / mm * sp * mf;
    }
  }
  var d = state.dash;
  if (d.t > 0) {
    dvx = d.x * sp * 2.7; dvy = d.y * sp * 2.7;
    acc = 0.3;
    d.t -= STEP;
  }
  if (d.cd > 0) d.cd -= STEP;
  p.update(t, dvx, dvy, acc);
}

function tick() {
  var t = (state.t += STEP), p = state.player, i, j;
  var playing = state.mode === 'play' || state.mode === 'graft';

  if (p && p.alive) {
    playerControl(p, t);
    var regen = 0.6 + p.stats.cilia * 0.9;
    p.root.hp = Math.min(p.root.maxHp, p.root.hp + regen * STEP);
    var m = depthM(p.root.y[0]);
    if (state.mode !== 'title') state.maxDepth = Math.max(state.maxDepth, m);
  }

  for (i = 0; i < state.enemies.length; i++) aiControl(state.enemies[i], t, playing);

  if (playing && p && p.alive) {
    for (i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      strike(p, e);
      if (p.alive && e.alive) strike(e, p);
    }
    // eat what floats around
    var hx = p.root.x[0], hy = p.root.y[0], er = 10 + p.root.rad[0] + p.stats.jaw * 6;
    for (i = 0; i < state.debris.length; i++) {
      var d = state.debris[i];
      if (d.eaten || d.age < 0.4) continue;
      var b = d.w.box;
      if (hx < b[0] - er || hx > b[2] + er || hy < b[1] - er || hy > b[3] + er) continue;
      for (j = 0; j <= d.w.n; j++) {
        var dx = d.w.x[j] - hx, dy = d.w.y[j] - hy, rr = er + d.w.rad[j];
        if (dx * dx + dy * dy < rr * rr) { eat(d); break; }
      }
    }
  }

  // debris drift and sink
  for (i = state.debris.length - 1; i >= 0; i--) {
    var db = state.debris[i], w = db.w;
    db.age += STEP;
    db.life -= STEP;
    if (db.life <= 0) { state.debris.splice(i, 1); continue; }
    db.vx *= 0.95;
    db.vy = db.vy * 0.95 + 0.012;
    w.ox[0] = w.x[0]; w.oy[0] = w.y[0];
    w.x[0] += db.vx; w.y[0] += db.vy;
    w.update(t);
  }

  // enemies: remove dead / far, spawn new ones
  var viewR = Math.hypot(W, H) / 2 / zoom;
  var cx = p && p.alive ? p.root.x[0] : state.cam.x, cy = p && p.alive ? p.root.y[0] : state.cam.y;
  for (i = state.enemies.length - 1; i >= 0; i--) {
    var en = state.enemies[i];
    if (!en.alive || Math.hypot(en.root.x[0] - cx, en.root.y[0] - cy) > viewR * 3.2) state.enemies.splice(i, 1);
  }
  var L = levelAt(depthM(cy));
  var wanted = Math.min(10, 4 + Math.floor(L * 0.7));
  state.spawnTimer -= STEP;
  if (state.enemies.length < wanted && state.spawnTimer <= 0 && p) {
    spawnEnemy(false);
    state.spawnTimer = rand(0.8, 2.2);
  }

  for (i = state.sparks.length - 1; i >= 0; i--) {
    var s = state.sparks[i];
    s.x += s.vx; s.y += s.vy; s.vx *= 0.92; s.vy *= 0.92;
    s.life -= STEP;
    if (s.life <= 0) state.sparks.splice(i, 1);
  }
  for (i = state.rings.length - 1; i >= 0; i--) {
    var rg = state.rings[i];
    rg.life -= STEP * 2;
    rg.r += (rg.max - rg.r) * 0.15;
    if (rg.life <= 0) state.rings.splice(i, 1);
  }

  // camera
  var cam = state.cam;
  if (p && p.alive) {
    cam.x += (p.root.x[0] + p.vx * 18 - cam.x) * 0.08;
    cam.y += (p.root.y[0] + p.vy * 18 - cam.y) * 0.08;
  }
  // keep the surface near the top edge instead of filling the screen with air
  cam.y = Math.max(cam.y, H / 2 / zoom - 90);
  cam.shake *= 0.86;

  if (state.mode === 'dying') {
    state.deadTimer -= STEP;
    if (state.deadTimer <= 0) gameOver();
  }
}

// ----- rendering ----- //

var glowCache = {};
function glowSprite(hue) {
  var key = Math.round(hue / 15) % 24;
  if (glowCache[key]) return glowCache[key];
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d'), h = key * 15;
  var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'hsla(' + h + ',100%,85%,1)');
  grad.addColorStop(0.25, 'hsla(' + h + ',100%,65%,0.55)');
  grad.addColorStop(1, 'hsla(' + h + ',100%,50%,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return (glowCache[key] = c);
}

var view = [0, 0, 0, 0];

// limbs are drawn over their parent so they never hide behind the body
function drawWhip(w) {
  var b = w.box;
  if (!(b[2] < view[0] || b[0] > view[2] || b[3] < view[1] || b[1] > view[3])) drawLinks(w);
  for (var c = 0; c < w.children.length; c++) drawWhip(w.children[c]);
}

function drawLinks(w) {
  var fl = w.flash > 0, x = w.x, y = w.y, rad = w.rad, col = w.col;
  for (var i = w.n; i >= 0; i--) {
    var r = rad[i];
    if (r < 0.35) continue;
    ctx.fillStyle = fl ? '#ffffff' : col[i];
    ctx.beginPath();
    ctx.arc(x[i], y[i], r, 0, TAU);
    ctx.fill();
  }
}

function drawEyes(c, bright) {
  var r = c.root, h = c.heading(), rad = r.rad[0];
  var fx = Math.cos(h), fy = Math.sin(h), px = -fy, py = fx;
  for (var s = -1; s <= 1; s += 2) {
    var ex = r.x[0] + fx * rad * 0.35 + px * rad * 0.55 * s,
        ey = r.y[0] + fy * rad * 0.35 + py * rad * 0.55 * s;
    ctx.fillStyle = bright ? '#eafffb' : 'rgba(255,240,220,0.85)';
    ctx.beginPath();
    ctx.arc(ex, ey, Math.max(1, rad * 0.26), 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#02060c';
    ctx.beginPath();
    ctx.arc(ex + fx * rad * 0.08, ey + fy * rad * 0.08, Math.max(0.5, rad * 0.12), 0, TAU);
    ctx.fill();
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

function render() {
  var cam = state.cam, p = state.player;
  var m = depthM(cam.y), f = clamp(m / 520, 0, 1);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // water column: teal near the surface, ink at depth
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'hsl(' + lerp(192, 228, f).toFixed(0) + ',' + lerp(62, 55, f).toFixed(0) + '%,' + lerp(20, 3.2, f).toFixed(1) + '%)');
  g.addColorStop(1, 'hsl(' + lerp(200, 230, f).toFixed(0) + ',' + lerp(60, 60, f).toFixed(0) + '%,' + lerp(10, 1.6, f).toFixed(1) + '%)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // light shafts close to the surface
  if (m < 110) {
    var ra = (1 - m / 110) * 0.09;
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 5; k++) {
      var sx = ((k * 0.23 + 0.1 - cam.x * 0.0004 + Math.sin(state.t * 0.2 + k) * 0.03) % 1 + 1) % 1 * W * 1.4 - W * 0.2;
      ctx.fillStyle = 'rgba(170,240,255,' + (ra * (0.6 + 0.4 * Math.sin(state.t * 0.7 + k * 2))).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(sx, -10);
      ctx.lineTo(sx + 50, -10);
      ctx.lineTo(sx + 50 + H * 0.35, H);
      ctx.lineTo(sx + H * 0.35 - 70, H);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // marine snow (parallax)
  ctx.fillStyle = 'rgba(200,235,240,0.28)';
  for (var si2 = 0; si2 < snow.length; si2++) {
    var sn = snow[si2];
    var sxp = ((sn.x * W - cam.x * zoom * sn.z * 0.5) % W + W) % W;
    var syp = ((sn.y * H - cam.y * zoom * sn.z * 0.5 - state.t * 6 * sn.z) % H + H) % H;
    ctx.fillRect(sxp, syp, sn.r * sn.z * 1.4, sn.r * sn.z * 1.4);
  }

  // world
  var shx = (Math.random() - 0.5) * cam.shake, shy = (Math.random() - 0.5) * cam.shake;
  var ox = W / 2 - (cam.x + shx) * zoom, oy = H / 2 - (cam.y + shy) * zoom;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
  view[0] = cam.x - W / 2 / zoom - 20; view[2] = cam.x + W / 2 / zoom + 20;
  view[1] = cam.y - H / 2 / zoom - 20; view[3] = cam.y + H / 2 / zoom + 20;

  if (view[1] < 0) {
    ctx.fillStyle = 'hsl(198,38%,24%)';
    ctx.fillRect(view[0], view[1], view[2] - view[0], -view[1]);
    ctx.strokeStyle = 'rgba(190,245,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var sxw = Math.floor(view[0] / 20) * 20; sxw <= view[2]; sxw += 20) {
      var syw = Math.sin(sxw * 0.03 + state.t * 1.5) * 3;
      if (sxw === Math.floor(view[0] / 20) * 20) ctx.moveTo(sxw, syw); else ctx.lineTo(sxw, syw);
    }
    ctx.stroke();
  }

  var i;
  for (i = 0; i < state.debris.length; i++) {
    var d = state.debris[i];
    ctx.globalAlpha = Math.min(1, d.life / 3) * 0.75;
    drawWhip(d.w);
  }
  ctx.globalAlpha = 1;
  for (i = 0; i < state.enemies.length; i++) {
    drawWhip(state.enemies[i].root);
    drawEyes(state.enemies[i], false);
  }
  if (p && p.alive) {
    drawWhip(p.root);
    drawEyes(p, true);
  }

  ctx.globalCompositeOperation = 'lighter';
  for (i = 0; i < state.sparks.length; i++) {
    var s = state.sparks[i];
    ctx.fillStyle = 'hsla(' + s.hue + ',100%,70%,' + Math.min(1, s.life * 2).toFixed(2) + ')';
    ctx.fillRect(s.x - 1, s.y - 1, 2.2, 2.2);
  }
  ctx.lineWidth = 2;
  for (i = 0; i < state.rings.length; i++) {
    var rg = state.rings[i];
    ctx.strokeStyle = 'hsla(' + rg.hue + ',100%,70%,' + rg.life.toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(rg.x, rg.y, rg.r, 0, TAU);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  // bloom: downscaled + blurred copy added on top
  if (quality.glow && quality.level > 0) {
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'copy';
    if (hasFilter) bctx.filter = 'blur(2px)';
    bctx.drawImage(canvas, 0, 0, bloom.width, bloom.height);
    if (hasFilter) bctx.filter = 'none';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + 0.4 * f;
    ctx.drawImage(bloom, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // darkness: the deeper, the smaller the light around you
  var dark = clamp((m - 40) / 380, 0, 0.94);
  var lights = p && p.alive ? p.stats.light : 0;
  var vision = Math.max(150, 430 - m * 0.3) + lights * 110;
  if (dark > 0.01) {
    var pcx = p && p.alive ? (p.root.x[0] - cam.x) * zoom + W / 2 : W / 2,
        pcy = p && p.alive ? (p.root.y[0] - cam.y) * zoom + H / 2 : H / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var dg = ctx.createRadialGradient(pcx, pcy, vision * zoom * 0.3, pcx, pcy, vision * zoom);
    dg.addColorStop(0, 'rgba(1,3,8,0)');
    dg.addColorStop(1, 'rgba(1,3,8,' + dark.toFixed(3) + ')');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, W, H);
  }

  // bioluminescence shows through the dark
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
  ctx.globalCompositeOperation = 'lighter';
  var glowA = 0.35 + 0.65 * f;
  function glowWhips(list, alpha) {
    for (var gi = 0; gi < list.length; gi++) {
      var w = list[gi];
      if (!w.K.glow) continue;
      var b = w.box;
      if (b[2] < view[0] || b[0] > view[2] || b[3] < view[1] || b[1] > view[3]) continue;
      var size = w.g.k === 'bulbe' ? 46 : 16;
      ctx.globalAlpha = alpha * (w.g.k === 'bulbe' ? 0.8 + 0.2 * Math.sin(state.t * 3 + w.phase) : 0.7);
      ctx.drawImage(glowSprite(w.hue), w.x[w.n] - size / 2, w.y[w.n] - size / 2, size, size);
    }
  }
  for (i = 0; i < state.enemies.length; i++) {
    var en = state.enemies[i];
    glowWhips(en.list, glowA);
    if (f > 0.3) {
      ctx.globalAlpha = (f - 0.3) * 0.5;
      ctx.drawImage(glowSprite(en.root.hue), en.root.x[0] - 10, en.root.y[0] - 10, 20, 20);
    }
  }
  for (i = 0; i < state.debris.length; i++) {
    var dd = state.debris[i];
    if (dd.gene) {
      ctx.globalAlpha = Math.min(1, dd.life / 3) * (0.35 + 0.25 * Math.sin(state.t * 5 + i));
      ctx.drawImage(glowSprite(48), dd.w.x[0] - 14, dd.w.y[0] - 14, 28, 28);
    }
  }
  if (p && p.alive) {
    var pl = [];
    p.root.walk(function (w) { pl.push(w); });
    glowWhips(pl, 1);
    ctx.globalAlpha = 0.3 + 0.3 * f;
    ctx.drawImage(glowSprite(p.root.hue), p.root.x[0] - 40, p.root.y[0] - 40, 80, 80);
  }
  ctx.globalAlpha = 1;

  // graft mode: glowing attach points
  if (state.mode === 'graft') {
    var pts = attachPoints(), pulse = 0.5 + 0.5 * Math.sin(state.t * 8 + performance.now() * 0.006);
    ctx.lineWidth = 1.6;
    pts.forEach(function (pt) {
      ctx.globalAlpha = 0.7 + 0.3 * pulse;
      ctx.drawImage(glowSprite(48), pt.x - 16, pt.y - 16, 32, 32);
      ctx.strokeStyle = 'rgba(255,214,110,0.9)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7 + pulse * 3, 0, TAU);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';

  // touch controls
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.mode === 'play' && touchUI) {
    var bottom = H - 120;
    ctx.lineWidth = 2;
    if (input.joy) {
      var j = input.joy, jx = j.x - j.ox, jy = j.y - j.oy, jm = Math.hypot(jx, jy), k2 = jm > 60 ? 60 / jm : 1;
      ctx.strokeStyle = 'rgba(94,242,214,0.35)';
      ctx.beginPath(); ctx.arc(j.ox, j.oy, 60, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(94,242,214,0.35)';
      ctx.beginPath(); ctx.arc(j.ox + jx * k2, j.oy + jy * k2, 22, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(94,242,214,0.16)';
      ctx.beginPath(); ctx.arc(90, bottom, 46, 0, TAU); ctx.stroke();
    }
    var ready = 1 - Math.max(0, state.dash.cd) / 0.7;
    ctx.strokeStyle = 'rgba(255,90,122,0.18)';
    ctx.beginPath(); ctx.arc(W - 90, bottom, 34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = ready >= 1 ? 'rgba(255,90,122,0.7)' : 'rgba(255,90,122,0.4)';
    ctx.beginPath(); ctx.arc(W - 90, bottom, 34, -Math.PI / 2, -Math.PI / 2 + TAU * ready); ctx.stroke();
  }
}

// ----- HUD ----- //

var hud = {
  depth: $('depth'), hp: $('hpbar'), kills: $('kills'), best: $('best'), tray: $('tray'), tree: $('tree')
};

function updateHud() {
  var p = state.player;
  if (!p) return;
  hud.depth.textContent = Math.round(depthM(p.root.y[0]));
  var hp = p.alive ? clamp(p.root.hp / p.root.maxHp, 0, 1) : 0;
  hud.hp.style.transform = 'scaleX(' + hp.toFixed(3) + ')';
  hud.hp.classList.toggle('low', hp < 0.3);
  hud.kills.textContent = state.kills;
  hud.best.textContent = Math.round(Math.max(best, state.maxDepth));
  hud.tree.textContent = p.alive ? p.stats.depth + 1 : 0;
}

function previewGene(g, cv) {
  var w = new Whip(g, null, 0, 0, 0, 0, 0);
  var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, all = [];
  w.walk(function (x) {
    all.push(x);
    for (var i = 0; i <= x.n; i++) {
      minx = Math.min(minx, x.x[i] - x.rad[i]); maxx = Math.max(maxx, x.x[i] + x.rad[i]);
      miny = Math.min(miny, x.y[i] - x.rad[i]); maxy = Math.max(maxy, x.y[i] + x.rad[i]);
    }
  });
  var r = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.clientWidth * r || 120;
  cv.height = cv.clientHeight * r || 60;
  var c = cv.getContext('2d');
  var s = Math.min(cv.width / (maxx - minx + 6), cv.height / (maxy - miny + 6), 3 * r);
  c.setTransform(s, 0, 0, s, cv.width / 2 - (minx + maxx) / 2 * s, cv.height / 2 - (miny + maxy) / 2 * s);
  all.forEach(function (x) {
    for (var i = x.n; i >= 0; i--) {
      if (x.rad[i] < 0.35) continue;
      c.fillStyle = x.col[i];
      c.beginPath();
      c.arc(x.x[i], x.y[i], x.rad[i], 0, TAU);
      c.fill();
    }
  });
}

function renderTray() {
  var tray = hud.tray;
  tray.innerHTML = '';
  state.genes.forEach(function (g, i) {
    var b = document.createElement('button'), depth = geneDepth(g);
    b.type = 'button';
    b.className = 'gene' + (i === state.pendingGene ? ' active' : '');
    b.setAttribute('aria-label', 'Greffer ' + geneName(g));
    b.innerHTML = '<canvas></canvas><span class="gname"></span><span class="glevel"></span>';
    b.querySelector('.gname').textContent = geneName(g);
    b.querySelector('.glevel').textContent = new Array(depth + 1).join('●') + ' niv. ' + depth;
    b.addEventListener('click', function () { selectGene(i); });
    tray.appendChild(b);
    previewGene(g, b.querySelector('canvas'));
  });
  if (!state.genes.length) {
    var hint = document.createElement('div');
    hint.className = 'tray-hint';
    hint.textContent = 'Gènes 0/' + MAX_GENES + ' · tranche un membre puis dévore-le';
    tray.appendChild(hint);
  }
}

function selectGene(idx) {
  if (state.mode !== 'play' && state.mode !== 'graft') return;
  if (state.mode === 'graft' && state.pendingGene === idx) { cancelGraft(); return; }
  state.pendingGene = idx;
  if (!attachPoints().length) {
    state.pendingGene = -1;
    toast('Aucun point d\'ancrage libre pour ce gène', 'bad');
    return;
  }
  setMode('graft');
  renderTray();
}

function cancelGraft() {
  state.pendingGene = -1;
  setMode('play');
  renderTray();
}

// ----- screens ----- //

var screens = { title: $('title'), pause: $('pause'), over: $('over') };

function setMode(mode) {
  state.mode = mode;
  screens.title.hidden = mode !== 'title';
  screens.pause.hidden = mode !== 'pause';
  screens.over.hidden = mode !== 'over';
  $('hud').hidden = mode === 'title' || mode === 'over';
  $('graftBar').hidden = mode !== 'graft';
  if (mode !== 'play') { input.joy = null; input.swipe = null; }
}

function gameOver() {
  var reached = Math.round(state.maxDepth);
  var record = reached > best;
  if (record) { best = reached; store('hydra.best', String(best)); }
  $('overDepth').textContent = reached;
  $('overRecord').hidden = !record;
  $('statKills').textContent = state.kills;
  $('statEaten').textContent = state.eaten;
  $('statGrafts').textContent = state.grafts;
  $('statTree').textContent = state.maxTree;
  setMode('over');
}

var wakeLock = null;
function startGame() {
  ensureAudio();
  if (actx && actx.state === 'suspended') actx.resume();
  try {
    var el = document.documentElement;
    if (touchUI && el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(function () {});
    }
  } catch (e) { /* optional */ }
  try {
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
  } catch (e) { /* optional */ }
  newGame(false);
  state.pendingGene = -1;
  setMode('play');
  toast('Fouette en changeant brusquement de direction');
}

$('btnStart').addEventListener('click', startGame);
$('btnRetry').addEventListener('click', startGame);
$('btnPause').addEventListener('click', function () { if (state.mode === 'play') setMode('pause'); });
$('btnResume').addEventListener('click', function () { setMode('play'); });
$('btnQuit').addEventListener('click', function () { newGame(true); setMode('title'); });
$('graftCancel').addEventListener('click', cancelGraft);

function syncToggles() {
  $('btnSound').setAttribute('aria-pressed', String(!muted));
  $('btnSound').classList.toggle('off', muted);
  $('optSound').checked = !muted;
  $('optGlow').checked = quality.glow;
}
function setMuted(v) {
  muted = v;
  store('hydra.mute', muted ? '1' : '0');
  if (!muted) ensureAudio();
  syncToggles();
}
$('btnSound').addEventListener('click', function () { setMuted(!muted); });
$('optSound').addEventListener('change', function (e) { setMuted(!e.target.checked); });
$('optGlow').addEventListener('change', function (e) {
  quality.glow = e.target.checked;
  store('hydra.glow', quality.glow ? '1' : '0');
});
syncToggles();

document.addEventListener('visibilitychange', function () {
  if (document.hidden && (state.mode === 'play' || state.mode === 'graft')) {
    state.pendingGene = -1;
    renderTray();
    setMode('pause');
  }
});

// ----- main loop ----- //

var last = performance.now(), acc = 0, hudTimer = 0, slowFrames = 0, frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // drop resolution / glow if the phone struggles
  frames++;
  if (dt > 0.024) slowFrames++;
  if (frames >= 90) {
    if (slowFrames > 45 && quality.level > 0) {
      quality.level--;
      resize();
    }
    frames = slowFrames = 0;
  }

  if (state.mode !== 'pause' && state.mode !== 'over') {
    acc += dt * (state.mode === 'graft' ? 0.12 : 1);
    var steps = 0;
    while (acc >= STEP && steps < 4) { tick(); acc -= STEP; steps++; }
    if (steps === 4) acc = 0;
  }
  render();
  if ((hudTimer += dt) > 0.1) { hudTimer = 0; updateHud(); }
}

if (/[?&]debug\b/.test(location.search)) window.__hydra = { state: state, spawnEnemy: spawnEnemy, attachPoints: attachPoints, Creature: Creature, enemyGene: enemyGene };

newGame(true);
setMode('title');
$('titleBest').textContent = best;
requestAnimationFrame(frame);

})();
