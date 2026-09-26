// HYDRA — la lignée des abysses
// The game: creatures are trees of whips built by engine.js (the same species
// format as the Atelier editor). Cutting a node cuts its whole subtree, the
// part floats away and, once eaten, becomes a gene you can graft on yourself.

(function () {
'use strict';

// ----- utils ----- //

var TAU = Math.PI * 2;
var STEP = 1 / 60;

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
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
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) { /* private mode */ }
  return null;
}

// ----- game model on top of the engine ----- //

var E = HydraEngine;

// damage multiplier and minimal relative speed (px/step) per role
var ROLES = {
  whip:  { dmg: 1, thr: 2.5 },
  sting: { dmg: 2, thr: 1.5 },
  jaw:   { dmg: 1.4, thr: 2 },
  fin:   { dmg: 0.3, thr: 5 }
};
var MAX_TREE_DEPTH = 4;   // levels, root included
var MAX_GENES = 4;
var BODY_SLOTS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];

// species met at each depth level: [id, first level, weight] (from the bestiary)
var ENEMIES = Object.keys(E.INFO).map(function (id) { return [id, E.INFO[id][2], E.INFO[id][3]]; });

function playerSpec() {
  try {
    var s = store('hydra.player');
    if (s) return E.spec(JSON.parse(s));
  } catch (e) { /* broken save: fall back */ }
  return E.SPECIES.anguille();
}

function prepSeg(s, level) {
  s.inert = s.def.style === 'eye' || (s.n * s.len < 8 && s.maxRad < 1);
  s.maxHp = s.hp = 3 + s.n * s.len * Math.max(0.8, s.maxRad) * 0.08 * (1 + 0.2 * level);
}

function computeStats(c) {
  var st = { fin: 0, light: 0, cilia: 0, jaw: 0, sense: 0, weapons: 0, depth: 0 };
  c.list.forEach(function (s) {
    if (s.creatureCut) return;
    var r = s.def.role;
    if (s.depth > st.depth) st.depth = s.depth;
    if (r === 'fin') st.fin++;
    else if (r === 'light') st.light++;
    else if (r === 'cilia') st.cilia++;
    else if (r === 'jaw') st.jaw++;
    else if (r === 'sense') st.sense++;
    if (ROLES[r] && r !== 'fin') st.weapons++;
  });
  c.stats = st;
}

function makeCreature(sp, x, y, o) {
  var c = new E.Creature(sp, x, y, o);
  c.isPlayer = !!o.player;
  c.level = o.level || 0;
  c.alive = true;
  c.dmgMult = 1;
  c.speed = sp.swim.speed;
  c.list.forEach(function (s) { prepSeg(s, c.level); });
  var r = c.root;
  r.maxHp = r.hp = c.isPlayer ? 100 : (10 + r.n * r.len * r.maxRad * 0.06) * (1 + 0.25 * c.level);
  computeStats(c);
  return c;
}

function refreshCreature(c) {
  c.refresh();
  computeStats(c);
  c.needsRefresh = false;
}

// deeper species grow stings at the tip of their whips
function enrich(sp, L) {
  if (L < 2) return;
  E.walkNodes(sp.body, function (n) {
    if (n.role !== 'whip' || n.attach.some(function (a) { return a.at > 0.9; })) return;
    if (Math.random() < 0.2 + 0.1 * L) n.attach.push(E.part('dard'));
  });
}

// ----- DOM ----- //

var canvas = document.getElementById('c'),
    ctx = canvas.getContext('2d'),
    bloom = document.createElement('canvas'),
    bctx = bloom.getContext('2d'),
    $ = function (id) { return document.getElementById(id); };

var hasFilter = typeof bctx.filter === 'string';

var W = 0, H = 0, dpr = 1, zoom = 1, baseZoom = 1, zoomMul = 1;
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
  baseZoom = clamp(Math.min(W, H) / 440, 0.6, 2.2);
  zoom = baseZoom * zoomMul;
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
  state.player = makeCreature(playerSpec(), 0, 260, { player: true, dir: Math.PI / 2 });
  state.maxTree = state.player.stats.depth + 1;
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
  var id = weighted(ENEMIES.filter(function (e) { return L >= e[1]; }).map(function (e) {
    return [e[0], e[2] * (e[0] === 'hydre' ? 1 + L * 0.2 : 1)];
  }));
  var sp = E.mutate(E.SPECIES[id](), 0.6);
  if (id === 'larve' || id === 'anguille') sp.palette.hue = Math.round(rand(0, 360));
  enrich(sp, L);
  var c = makeCreature(sp, x, y, { level: L, scale: 1 + 0.04 * Math.min(L, 8), dir: rand(0, TAU) });
  var type = sp.ai;
  if (type === 'hunter' && c.stats.weapons === 0) type = 'prey';
  c.ai = { type: type, tx: x, ty: y, timer: 0, orb: rand(0, TAU), spin: Math.random() < 0.5 ? 1 : -1, lunge: rand(1.5, 3) };
  c.speed = sp.swim.speed * (1 + 0.06 * Math.min(L, 8));
  c.dmgMult = 0.5 * (1 + 0.14 * L);
  state.enemies.push(c);
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
  var prev = toastEl.lastElementChild;
  if (prev && prev.textContent === text && !prev.classList.contains('out')) return;
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

// every weapon node of A against every node of D; damage grows with the
// relative speed, so a cracking whip tip hurts much more than a touch
function strike(A, D) {
  if (!A.alive || !D.alive || !boxHit(A.box, D.box, 4)) return;
  var al = A.list, dl = D.list;
  for (var wi = 0; wi < al.length; wi++) {
    var aw = al[wi], K = ROLES[aw.def.role];
    if (!K || aw.creatureCut || !boxHit(aw.box, D.box, 4)) continue;
    for (var i = 1; i <= aw.n; i++) {
      var ax = aw.x[i], ay = aw.y[i], ar = aw.rad[i] + 1.5;
      var avx = ax - aw.ox[i], avy = ay - aw.oy[i];
      for (var di = 0; di < dl.length; di++) {
        var dw = dl[di];
        if (dw.cd > 0 || dw.inert || dw.creatureCut) continue;
        var b = dw.box;
        if (ax < b[0] - ar || ax > b[2] + ar || ay < b[1] - ar || ay > b[3] + ar) continue;
        for (var j = 0; j <= dw.n; j++) {
          var dx = dw.x[j] - ax, dy = dw.y[j] - ay, rr = dw.rad[j] + ar;
          if (dx * dx + dy * dy > rr * rr) continue;
          var rvx = avx - (dw.x[j] - dw.ox[j]), rvy = avy - (dw.y[j] - dw.oy[j]);
          var sp = Math.sqrt(rvx * rvx + rvy * rvy);
          if (sp > K.thr) {
            hit(dw, D, Math.min(26, (1 + sp - K.thr) * K.dmg * A.dmgMult * 1.3), ax, ay, avx, avy, A);
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
  var gene = w.inert ? null : E.geneFromSeg(w);
  w.walk(function (x) { x.creatureCut = true; x.cd = 0.5; });
  var vx = w.x[0] - w.ox[0], vy = w.y[0] - w.oy[0];
  w.parent = null;
  w.sink = 0.01;
  state.debris.push({ w: w, gene: gene, bio: 6 + w.n, vx: vx, vy: vy, life: 16, age: 0 });
  C.needsRefresh = true;
  ring(w.x[0], w.y[0], w.hue, 34);
  sfx('cut');
  if (C.isPlayer && !C.dying) {
    toast('Membre perdu : ' + w.def.name, 'bad');
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
    toast(C.spec.name + ' vaincue');
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
      toast('Gène absorbé : ' + E.nodeTitle(d.gene) + ' · niv. ' + E.nodeDepth(d.gene), 'good');
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
// a graft is added to the part's definition, so every symmetric copy of
// that part receives it: the structure stays clean

function occupies(a, f) {
  if (a.pattern === 'series') return f >= a.at - 0.06 && f <= a.to + 0.06;
  return Math.abs(a.at - f) < 0.08;
}

function attachPoints() {
  var p = state.player, pts = [];
  if (!p || !p.alive || state.pendingGene < 0) return pts;
  var gd = E.nodeDepth(state.genes[state.pendingGene]);
  var root = p.root;
  BODY_SLOTS.forEach(function (f) {
    if (root.def.attach.some(function (a) { return occupies(a, f); })) return;
    var k = Math.round(f * root.n);
    pts.push({ seg: root, t: f, body: true, x: root.x[k], y: root.y[k] });
  });
  p.list.forEach(function (s) {
    if (s === root || s.creatureCut || s.inert || s.n < 3 || s.def.role === 'light') return;
    if (s.depth + 1 + gd > MAX_TREE_DEPTH) return;
    if (s.def.attach.some(function (a) { return a.at > 0.9 && a.pattern !== 'series'; })) return;
    pts.push({ seg: s, t: 1, body: false, x: s.x[s.n], y: s.y[s.n] });
  });
  return pts;
}

function graftAt(pt) {
  var p = state.player, gene = state.genes[state.pendingGene];
  var a = pt.body ?
    E.att({ node: gene, pattern: 'pair', at: pt.t, angle: 1.2, edge: 0.7 }) :
    E.att({ node: gene, pattern: 'single', at: 1, angle: 0 });
  var def = pt.seg.def;
  def.attach.push(a);
  p.list.slice().forEach(function (s) {
    if (s.def !== def || s.creatureCut) return;
    s.instantiate(a).forEach(function (ns) { ns.walk(function (x) { prepSeg(x, 0); }); });
  });
  refreshCreature(p);
  state.genes.splice(state.pendingGene, 1);
  state.pendingGene = -1;
  state.grafts++;
  state.maxTree = Math.max(state.maxTree, p.stats.depth + 1);
  ring(pt.x, pt.y, 50, 50);
  sparks(pt.x, pt.y, 50, 18, 3);
  sfx('graft');
  vibrate([10, 30, 10]);
  toast('Greffe réussie · arbre de ' + (p.stats.depth + 1) + ' niveaux', 'good');
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
  if (state.mode === 'explore' && window.HydraExplore) { ensureAudio(); HydraExplore.pointer('down', e); return; }
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
  if (state.mode !== 'play' && state.mode !== 'explore') return;
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
  if (state.mode === 'explore' && window.HydraExplore) { HydraExplore.pointer('move', e); return; }
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
  if (state.mode === 'explore' && window.HydraExplore) HydraExplore.pointer('up', e);
  if (input.joy && e.pointerId === input.joy.id) input.joy = null;
  if (input.swipe && e.pointerId === input.swipe.id) input.swipe = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') input.mouse = null; });
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
canvas.addEventListener('wheel', function (e) {
  if (state.mode !== 'explore' || !window.HydraExplore) return;
  e.preventDefault();
  HydraExplore.wheel(e.deltaY);
}, { passive: false });

// extra zoom on top of the screen-fitted one (pinch in the exploration mode)
function setZoomMul(k) {
  zoomMul = clamp(k, 0.45, 2.6);
  zoom = baseZoom * zoomMul;
  return zoomMul;
}

window.addEventListener('keydown', function (e) {
  input.keys[e.key.toLowerCase()] = true;
  if (e.key === ' ' && (state.mode === 'play' || state.mode === 'explore')) { requestDash(); e.preventDefault(); }
  if (e.key === 'Escape' && state.mode.indexOf('explore') === 0 && window.HydraExplore) { HydraExplore.menu(); return; }
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
  var f = E.swimFactor(e, t);
  e.update(t, v[0] * f, v[1] * f, 0.06, 24);
}

function playerControl(p, t) {
  var sp = 3 * (1 + Math.min(0.8, 0.06 * p.stats.fin)), dvx = 0, dvy = 0, acc = 0.09;
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
  } else if (input.mouse && (state.mode === 'play' || state.mode === 'explore')) {
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
  p.update(t, dvx, dvy, acc, 24);
}

var flow = new E.Flow(32);

function tick() {
  var t = (state.t += STEP), p = state.player, i, j;
  var playing = state.mode === 'play' || state.mode === 'graft';

  if (p && p.needsRefresh) refreshCreature(p);
  for (i = 0; i < state.enemies.length; i++) if (state.enemies[i].needsRefresh) refreshCreature(state.enemies[i]);

  if (p && p.alive) {
    playerControl(p, t);
    var regen = 0.6 + Math.min(4, p.stats.cilia * 0.15);
    p.root.hp = Math.min(p.root.maxHp, p.root.hp + regen * STEP);
    var m = depthM(p.root.y[0]);
    if (state.mode !== 'title') state.maxDepth = Math.max(state.maxDepth, m);
  }

  for (i = 0; i < state.enemies.length; i++) aiControl(state.enemies[i], t, playing);

  // water: bodies push and drag each other
  flow.clear();
  if (p && p.alive) flow.add(p);
  for (i = 0; i < state.enemies.length; i++) flow.add(state.enemies[i]);
  for (i = 0; i < state.enemies.length; i++) flow.apply(state.enemies[i], { push: 0.35, wake: 0.02, body: 0.01 });
  if (p && p.alive) flow.apply(p, { push: 0.3, wake: 0.015, body: 0.008 });

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

function inView(b) {
  return !(b[2] < view[0] || b[0] > view[2] || b[3] < view[1] || b[1] > view[3]);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHue(a, b, t) { var d = ((b - a) % 360 + 540) % 360 - 180; return (a + d * t + 360) % 360; }

// ----- shared layers (also used by the exploration mode) ----- //

// water column: teal near the surface, ink at depth; tint = { h, s } of a biome
function drawWater(m, f, tint) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  var h1 = lerp(192, 228, f), h2 = lerp(200, 230, f), sa = lerp(62, 55, f);
  if (tint) { h1 = lerpHue(tint.h, h1, f * 0.7); h2 = lerpHue(tint.h, h2, f * 0.7); sa = lerp(tint.s, sa, f); }
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'hsl(' + h1.toFixed(0) + ',' + sa.toFixed(0) + '%,' + lerp(20, 3.2, f).toFixed(1) + '%)');
  g.addColorStop(1, 'hsl(' + h2.toFixed(0) + ',' + sa.toFixed(0) + '%,' + lerp(10, 1.6, f).toFixed(1) + '%)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawRaysAndSnow(cam, m, t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (m < 110) {
    var ra = (1 - m / 110) * 0.09;
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 5; k++) {
      var sx = ((k * 0.23 + 0.1 - cam.x * 0.0004 + Math.sin(t * 0.2 + k) * 0.03) % 1 + 1) % 1 * W * 1.4 - W * 0.2;
      ctx.fillStyle = 'rgba(170,240,255,' + (ra * (0.6 + 0.4 * Math.sin(t * 0.7 + k * 2))).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(sx, -10);
      ctx.lineTo(sx + 50, -10);
      ctx.lineTo(sx + 50 + H * 0.35, H);
      ctx.lineTo(sx + H * 0.35 - 70, H);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'rgba(200,235,240,0.28)';
  for (var si2 = 0; si2 < snow.length; si2++) {
    var sn = snow[si2];
    var sxp = ((sn.x * W - cam.x * zoom * sn.z * 0.5) % W + W) % W;
    var syp = ((sn.y * H - cam.y * zoom * sn.z * 0.5 - t * 6 * sn.z) % H + H) % H;
    ctx.fillRect(sxp, syp, sn.r * sn.z * 1.4, sn.r * sn.z * 1.4);
  }
}

// camera transform for world drawing; also sets the culling view
function worldTransform(cam) {
  var shx = (Math.random() - 0.5) * cam.shake, shy = (Math.random() - 0.5) * cam.shake;
  var ox = W / 2 - (cam.x + shx) * zoom, oy = H / 2 - (cam.y + shy) * zoom;
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
  view[0] = cam.x - W / 2 / zoom - 20; view[2] = cam.x + W / 2 / zoom + 20;
  view[1] = cam.y - H / 2 / zoom - 20; view[3] = cam.y + H / 2 / zoom + 20;
  return [ox, oy];
}

function drawSurface(t) {
  if (view[1] >= 0) return;
  ctx.fillStyle = 'hsl(198,38%,24%)';
  ctx.fillRect(view[0], view[1], view[2] - view[0], -view[1]);
  ctx.strokeStyle = 'rgba(190,245,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var sxw = Math.floor(view[0] / 20) * 20; sxw <= view[2]; sxw += 20) {
    var syw = Math.sin(sxw * 0.03 + t * 1.5) * 3;
    if (sxw === Math.floor(view[0] / 20) * 20) ctx.moveTo(sxw, syw); else ctx.lineTo(sxw, syw);
  }
  ctx.stroke();
}

// bloom: downscaled + blurred copy added on top
function bloomPass(f) {
  if (!quality.glow || quality.level <= 0) return;
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

// darkness around a screen point: the deeper, the smaller the light
function drawDarkness(pcx, pcy, vision, dark) {
  if (dark <= 0.01) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var dg = ctx.createRadialGradient(pcx, pcy, vision * zoom * 0.3, pcx, pcy, vision * zoom);
  dg.addColorStop(0, 'rgba(1,3,8,0)');
  dg.addColorStop(1, 'rgba(1,3,8,' + dark.toFixed(3) + ')');
  ctx.fillStyle = dg;
  ctx.fillRect(0, 0, W, H);
}

function drawTouchControls() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!touchUI) return;
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

function render() {
  var cam = state.cam, p = state.player;
  var m = depthM(cam.y), f = clamp(m / 520, 0, 1);

  drawWater(m, f);

  drawRaysAndSnow(cam, m, state.t);
  var off = worldTransform(cam), ox = off[0], oy = off[1];
  drawSurface(state.t);

  var i, o = { view: view };
  for (i = 0; i < state.debris.length; i++) {
    var d = state.debris[i];
    o.alpha = Math.min(1, d.life / 3) * 0.75;
    E.drawSeg(ctx, d.w, o);
  }
  o.alpha = 1;
  for (i = 0; i < state.enemies.length; i++) {
    var en0 = state.enemies[i];
    if (inView(en0.box)) E.draw(ctx, en0, o);
  }
  if (p && p.alive) {
    o.bright = true;
    E.draw(ctx, p, o);
    o.bright = false;
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

  bloomPass(f);

  // darkness: the deeper, the smaller the light around you
  var dark = clamp((m - 40) / 380, 0, 0.94);
  var lights = p && p.alive ? p.stats.light : 0;
  var vision = Math.max(150, 430 - m * 0.3) + Math.min(3, lights) * 110 + (p && p.alive ? Math.min(4, p.stats.sense) * 15 : 0);
  drawDarkness(p && p.alive ? (p.root.x[0] - cam.x) * zoom + W / 2 : W / 2,
    p && p.alive ? (p.root.y[0] - cam.y) * zoom + H / 2 : H / 2, vision, dark);

  // bioluminescence shows through the dark
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * ox, dpr * oy);
  ctx.globalCompositeOperation = 'lighter';
  var glowA = 0.35 + 0.65 * f;
  function glowAt(x, y, size, hue, a) {
    ctx.globalAlpha = a * glowAlpha;
    ctx.drawImage(glowSprite(hue), x - size / 2, y - size / 2, size, size);
  }
  var glowAlpha = glowA;
  for (i = 0; i < state.enemies.length; i++) {
    var en = state.enemies[i];
    if (!inView(en.box)) continue;
    E.eachGlow(en.list, glowAt, view);
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
    glowAlpha = 1;
    E.eachGlow(p.list, glowAt, view);
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

  if (state.mode === 'play') drawTouchControls();
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
  var p = state.player;
  E.snapshot(E.spec({ palette: p ? p.spec.palette : undefined, eyes: { on: false }, body: g }), cv, { pad: 3, max: 3 });
}

function renderTray() {
  var tray = hud.tray;
  tray.innerHTML = '';
  state.genes.forEach(function (g, i) {
    var b = document.createElement('button'), depth = E.nodeDepth(g);
    b.type = 'button';
    b.className = 'gene' + (i === state.pendingGene ? ' active' : '');
    b.setAttribute('aria-label', 'Greffer ' + E.nodeTitle(g));
    b.innerHTML = '<canvas></canvas><span class="gname"></span><span class="glevel"></span>';
    b.querySelector('.gname').textContent = E.nodeTitle(g);
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
  $('hud').hidden = !(mode === 'play' || mode === 'graft' || mode === 'pause');
  $('exHud').hidden = mode !== 'explore';
  $('graftBar').hidden = mode !== 'graft';
  if (mode !== 'play' && mode !== 'explore') { input.joy = null; input.swipe = null; }
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
function immersive() {
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
}

function startGame() {
  setZoomMul(1);
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

// ----- atelier (species editor) ----- //

function refreshTitle() {
  $('titleSpecies').textContent = playerSpec().name;
  $('titleBest').textContent = best;
}

function openAtelier() {
  setMode('atelier');
  HydraAtelier.open();
}
HydraAtelier.onPlay = function (sp) {
  store('hydra.player', JSON.stringify(sp));
  refreshTitle();
  startGame();
};
HydraAtelier.onClose = function () {
  if (state.mode === 'atelier') {
    newGame(true);
    setMode('title');
    refreshTitle();
  }
};
$('btnAtelier').addEventListener('click', openAtelier);
$('btnExplore').addEventListener('click', function () { HydraExplore.start(); });
$('btnAtelier2').addEventListener('click', openAtelier);

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
  if (document.hidden && state.mode === 'explore' && window.HydraExplore) HydraExplore.menu();
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
  if (state.mode === 'atelier') return;   // the editor has its own loop

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

  if (state.mode.indexOf('explore') === 0) {
    HydraExplore.frame(dt);
    return;
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

// what the exploration mode (explore.js) borrows from the game
window.HydraGame = {
  state: state, input: input, view: view, snow: snow, quality: quality,
  get W() { return W; }, get H() { return H; }, get zoom() { return zoom; }, get dpr() { return dpr; },
  get ctx() { return ctx; }, get touchUI() { return touchUI; },
  STEP: STEP, depthM: depthM, clamp: clamp, lerp: lerp, rand: rand, store: store, $: $,
  glowSprite: glowSprite, inView: inView, makeCreature: makeCreature, refreshCreature: refreshCreature,
  playerControl: playerControl, playerSpec: playerSpec, screenToWorld: screenToWorld,
  drawWater: drawWater, drawRaysAndSnow: drawRaysAndSnow, worldTransform: worldTransform, drawSurface: drawSurface,
  bloomPass: bloomPass, drawDarkness: drawDarkness, drawTouchControls: drawTouchControls,
  setZoomMul: setZoomMul, get zoomMul() { return zoomMul; },
  toast: toast, sfx: sfx, vibrate: vibrate, ring: ring, sparks: sparks, setMode: setMode, immersive: immersive,
  refreshTitle: function () { refreshTitle(); }, toTitle: function () { setZoomMul(1); newGame(true); setMode('title'); refreshTitle(); }
};

if (/[?&]debug\b/.test(location.search)) window.__hydra = { state: state, spawnEnemy: spawnEnemy, attachPoints: attachPoints, makeCreature: makeCreature };

newGame(true);
setMode('title');
refreshTitle();
requestAnimationFrame(frame);

})();
