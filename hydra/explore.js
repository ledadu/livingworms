// HYDRA — la balade : exploration without combat in procedural worlds.
//
// The world is an endless strip cut in chunks. A seed drives everything:
// the sea floor profile, the biomes (from the shallow lagoon to the abyssal
// plain), the scenery (kelp, corals, sea fans… anchored whips) and the fauna,
// which mixes bestiary species with species generated for this world only.
// Get close to an animal, or tap it, and become it.

(function () {
'use strict';

var E = HydraEngine, G = HydraGame, $ = G.$;
var TAU = Math.PI * 2, STEP = 1 / 60;
var CH = 700;   // chunk width

// ----- biomes, ordered from shallow to deep ----- //

var BIOMES = [
  { id: 'lagon', name: 'Lagon d\'anémones', floor: 480, tint: { h: 172, s: 55 }, sand: [46, 42, 60],
    fauna: ['poissonClown', 'etoile', 'oursin', 'verPlat', 'axolotl', 'tardigrade', 'copepode', 'krill', 'larve', 'ophiure', 'hippocampe'],
    gen: { arch: ['radial', 'worm', 'fish'], mood: 'pastel', glow: 0.1 },
    scenery: { grass: 6, anemone: 3, rock: 1, coral: 1 } },
  { id: 'recif', name: 'Récif corallien', floor: 720, tint: { h: 186, s: 65 }, sand: [40, 38, 55],
    fauna: ['poissonClown', 'koi', 'poissonLion', 'crevette', 'crabe', 'nudibranche', 'tortue', 'hippocampe', 'crevetteMante', 'etoile'],
    gen: { arch: ['fish', 'crustacean', 'worm'], mood: 'reef', glow: 0.1 },
    scenery: { coral: 5, fan: 2, anemone: 2, rock: 2, grass: 1 } },
  { id: 'kelp', name: 'Forêt de kelp', floor: 1050, tint: { h: 150, s: 40 }, sand: [60, 22, 32],
    fauna: ['dragonFeuillu', 'hippocampe', 'poulpe', 'seiche', 'crabe', 'homard', 'tortue', 'anguille', 'combattant'],
    gen: { arch: ['fish', 'cephalopod', 'chimera'], mood: 'wild', glow: 0.15 },
    scenery: { kelp: 7, rock: 3, grass: 2 } },
  { id: 'sources', name: 'Sources hydrothermales', floor: 2300, tint: { h: 18, s: 30 }, sand: [16, 18, 20],
    fauna: ['verDeFeu', 'plumeau', 'crevette', 'crabe', 'serpentCilie', 'ophiure', 'nudibranche', 'homard'],
    gen: { arch: ['worm', 'crustacean'], mood: 'abyss', glow: 0.5 },
    scenery: { vent: 2, tubes: 4, rock: 3 } },
  { id: 'meduses', name: 'Jardin de méduses', floor: 2700, tint: { h: 252, s: 45 }, sand: [240, 14, 22],
    fauna: ['meduse', 'chrysaora', 'ctenophore', 'physalie', 'siphonophore', 'meduseBoite', 'clione', 'manta'],
    gen: { arch: ['jelly', 'jelly', 'cephalopod'], mood: 'pastel', glow: 0.6 },
    scenery: { rock: 1, seapen: 2 } },
  { id: 'abysses', name: 'Plaine abyssale', floor: 3400, tint: { h: 230, s: 50 }, sand: [228, 14, 12],
    fauna: ['baudroie', 'grandGosier', 'dragonAbyssal', 'nautile', 'calmar', 'siphonophore', 'hydre', 'requinBaleine'],
    gen: { arch: ['fish', 'worm', 'chimera', 'cephalopod', 'jelly'], mood: 'abyss', glow: 0.8 },
    scenery: { seapen: 4, rock: 3, tubes: 1 } }
];

// bottom dwellers stay close to the floor, small fish swim in schools
var BENTHIC = { etoile: 1, oursin: 1, ophiure: 1, crabe: 1, homard: 1, tardigrade: 1, verPlat: 1, nudibranche: 1, verDeFeu: 1, plumeau: 1 };
var SCHOOL = { poissonClown: 5, koi: 3, krill: 6, copepode: 6, crevette: 4, larve: 4, poissonLion: 2, hippocampe: 2, meduse: 3, ctenophore: 3, clione: 3, anguille: 3, combattant: 2 };

// ----- noise ----- //

function hash1(i, s) {
  var h = Math.imul((i | 0) ^ (s | 0), 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function noise1(x, s) {
  var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = hash1(i, s);
  return a + (hash1(i + 1, s) - a) * u;
}
function seedOf(a, b) { return (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0; }

// ----- state ----- //

var ex = {
  seed: 1, t: 0, acc: 0, chunks: {}, free: [], endemic: {}, player: null,
  selected: null, near: null, biome: -1, carnet: {}, carnetList: [], bubbles: [], hudT: 0, scanT: 0
};

function biomePos(x) {
  var v = noise1(x / 6000, ex.seed) * 0.8 + noise1(x / 1700, ex.seed + 11) * 0.2;
  return G.clamp(v * 1.4 - 0.2, 0, 0.9999) * BIOMES.length;
}
function biomeIndex(x) { return Math.floor(biomePos(x)); }

function weights(x) {
  var p = biomePos(x), out = [], sum = 0;
  for (var k = 0; k < BIOMES.length; k++) {
    var w = Math.max(0, 1 - Math.abs(p - (k + 0.5)));
    out.push(w); sum += w;
  }
  return out.map(function (w) { return w / (sum || 1); });
}

function floorY(x) {
  var w = weights(x), base = 0;
  for (var k = 0; k < BIOMES.length; k++) base += w[k] * BIOMES[k].floor;
  return base + (noise1(x / 650, ex.seed + 3) - 0.5) * 260 + (noise1(x / 160, ex.seed + 5) - 0.5) * 60;
}

function mixed(x, fn) {
  var w = weights(x), v = 0;
  for (var k = 0; k < BIOMES.length; k++) v += w[k] * fn(BIOMES[k]);
  return v;
}

// ----- scenery: anchored whips ----- //

function plantSpec(kind, R, b) {
  function r(a, c) { return a + R() * (c - a); }
  function ri(a, c) { return Math.floor(r(a, c + 1)); }
  var abyss = b.id === 'abysses' || b.id === 'sources' || b.id === 'meduses';
  if (kind === 'kelp') {
    return E.spec({ name: 'Kelp', palette: { hue: r(62, 100), harmony: 'analog', sat: r(40, 60), light: r(28, 40) }, eyes: { on: false },
      body: { name: 'Stipe', links: ri(28, 42), len: 12, width: 1.3, shape: 'constant', style: 'ribbon', flex: 0.2, spring: 0.02, drag: 0.88, gravity: -0.07,
        color: { slot: 0, grad: 12 }, motion: { type: 'wave', amp: 0.1, freq: r(0.15, 0.3) },
        attach: [{ node: { name: 'Fronde', links: 4, len: 6, width: 3.4, shape: 'leaf', style: 'ribbon', flex: 0.3, spring: 0.08, curl: 0.6, gravity: -0.03, drag: 0.88, color: { slot: 1, alpha: 0.92, grad: 10 } },
          pattern: 'series', at: 0.12, to: 1, count: ri(9, 14), angle: 0.8, alternate: true, jitter: 0.6, edge: 0.5 }] } });
  }
  if (kind === 'grass') {
    return E.spec({ name: 'Herbier', palette: { hue: r(120, 175), harmony: 'analog', sat: r(35, 60), light: r(30, 45) }, eyes: { on: false },
      body: { name: 'Souche', links: 1, len: 1, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0 },
        attach: [{ node: { name: 'Brin', links: 7, len: 5, width: 1.1, shape: 'linear', style: 'ribbon', flex: 0.35, spring: 0.06, gravity: -0.04, drag: 0.85,
          color: { slot: 1, grad: 12 }, motion: { type: 'wave', amp: 0.12, freq: 0.35 } }, pattern: 'fan', at: 1, count: ri(4, 8), spread: 0.9, angle: 0, jitter: 0.7, phaseStep: 0.8 }] } });
  }
  if (kind === 'coral') {
    var glow = abyss ? 'tip' : 'none';
    return E.spec({ name: 'Corail', palette: { hue: r(0, 360), harmony: 'analog', sat: r(65, 90), light: abyss ? r(30, 45) : r(50, 62) }, eyes: { on: false },
      body: { name: 'Tronc', links: 3, len: 7, width: 3.2, shape: 'worm', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, grad: 10 },
        attach: [{ node: { name: 'Branche', links: 3, len: 6, width: 2.4, shape: 'worm', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, grad: 15 },
          attach: [{ node: { name: 'Rameau', links: 2, len: 5, width: 1.6, shape: 'bulb', style: 'ribbon', flex: 0.03, spring: 0.9, color: { slot: 1, glow: glow } },
            pattern: 'fan', at: 1, count: 2, spread: 0.8, angle: 0, jitter: 0.6 }] },
          pattern: 'fan', at: 1, count: ri(2, 3), spread: 1, angle: 0, jitter: 0.6 }] } });
  }
  if (kind === 'fan') {
    return E.spec({ name: 'Gorgone', palette: { hue: r(270, 390) % 360, harmony: 'analog', sat: r(55, 80), light: r(42, 55) }, eyes: { on: false },
      body: { name: 'Pied', links: 2, len: 6, width: 1.5, shape: 'constant', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0 },
        attach: [{ node: { name: 'Rayon', links: 7, len: 7, width: 0.6, shape: 'linear', style: 'line', flex: 0.05, spring: 0.7, curl: 0.3, color: { slot: 0 }, motion: { type: 'wave', amp: 0.04, freq: 0.3 } },
          pattern: 'fan', at: 1, count: ri(6, 9), spread: 1.6, angle: 0, web: 0.85, jitter: 0.4 }] } });
  }
  if (kind === 'seapen') {
    return E.spec({ name: 'Plume de mer', palette: { hue: r(260, 320), harmony: 'split', sat: 60, light: 38 }, eyes: { on: false },
      body: { name: 'Tige', links: 8, len: 7, width: 1.4, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.3, gravity: -0.03, color: { slot: 0 },
        attach: [{ node: { name: 'Pinnule', links: 3, len: 4, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.2, spring: 0.2, curl: 0.5, color: { slot: 1, glow: 'tip' }, motion: { type: 'wave', amp: 0.15, freq: 0.5 } },
          pattern: 'series', at: 0.3, to: 1, count: 8, angle: 1.1, alternate: true, hueStep: 10, phaseStep: 0.4 }] } });
  }
  if (kind === 'tubes') {
    return E.spec({ name: 'Vers tubicoles', palette: { hue: r(350, 370) % 360, harmony: 'mono', sat: 80, light: 48 }, eyes: { on: false },
      body: { name: 'Souche', links: 1, len: 1, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 3, light: 30 },
        attach: [{ node: { name: 'Tube', links: 5, len: 6, width: 1.8, shape: 'constant', style: 'plates', flex: 0.05, spring: 0.7, color: { slot: 3, light: 35, grad: -10 },
          attach: [{ node: { name: 'Panache', links: 3, len: 3, width: 0.5, shape: 'linear', style: 'line', flex: 0.3, spring: 0.2, color: { slot: 0 }, motion: { type: 'wave', amp: 0.2, freq: 0.6 } },
            pattern: 'fan', at: 1, count: 6, spread: 1.6, angle: 0 }] },
          pattern: 'fan', at: 1, count: ri(3, 6), spread: 0.7, angle: 0, jitter: 0.5 }] } });
  }
  if (kind === 'anemone') {
    var a = E.SPECIES.anemone();
    a.palette.hue = Math.round(r(0, 360));
    return a;
  }
  return null;
}

// ----- species of this world ----- //

function endemicSpecies(bi, k) {
  var key = bi + ':' + k;
  if (!ex.endemic[key]) {
    var b = BIOMES[bi], R = E.rng(seedOf(ex.seed, 1000 + bi * 10 + k));
    ex.endemic[key] = E.generate({
      seed: Math.floor(R() * 1e9), archetype: b.gen.arch[Math.floor(R() * b.gen.arch.length)], mood: b.gen.mood,
      complexity: 0.3 + R() * 0.6, glow: Math.min(1, b.gen.glow + R() * 0.3)
    });
  }
  return ex.endemic[key];
}

function schoolSize(id, sp, R) {
  if (id && SCHOOL[id]) return 1 + Math.floor(R() * SCHOOL[id]);
  if (sp.gen && (sp.gen.archetype === 'fish' || sp.gen.archetype === 'jelly')) return 2 + Math.floor(R() * 4);
  return 1 + Math.floor(R() * 2);
}

// ----- chunks ----- //

function makeChunk(i) {
  var R = E.rng(seedOf(ex.seed, i)), x0 = i * CH, bi = biomeIndex(x0 + CH / 2), b = BIOMES[bi];
  var ch = { i: i, biome: bi, plants: [], rocks: [], vents: [], fauna: [] };
  Object.keys(b.scenery).forEach(function (kind) {
    var n = Math.round(b.scenery[kind] * (0.5 + R()));
    for (var k = 0; k < n; k++) {
      var x = x0 + R() * CH, y = floorY(x);
      if (kind === 'rock') {
        var pts = [];
        for (var q = 0; q < 9; q++) pts.push(0.7 + R() * 0.4);
        ch.rocks.push({ x: x, y: y, r: 20 + R() * 45, pts: pts });
      } else if (kind === 'vent') {
        ch.vents.push({ x: x, y: y, h: 60 + R() * 90, w: 14 + R() * 10, t: 0 });
      } else {
        var sp = plantSpec(kind, R, b);
        var tilt = (R() - 0.5) * 0.5;
        var p = new E.Creature(sp, x, y + 4, { dir: -Math.PI / 2 + tilt, anchor: -Math.PI / 2 + tilt, phase: R() * TAU });
        ch.plants.push(p);
      }
    }
  });
  var groups = 2 + (R() < 0.6 ? 1 : 0) + (R() < 0.3 ? 1 : 0);
  for (var g = 0; g < groups; g++) spawnGroup(ch, R, bi, x0 + R() * CH);
  return ch;
}

function spawnGroup(ch, R, bi, x) {
  var b = BIOMES[bi], id = null, sp;
  if (R() < 0.4) sp = endemicSpecies(bi, Math.floor(R() * 3));
  else {
    id = b.fauna[Math.floor(R() * b.fauna.length)];
    sp = E.mutate(E.SPECIES[id](), 0.25);
  }
  var benthic = (id && BENTHIC[id]) || (sp.gen && sp.gen.archetype === 'radial');
  // open-water animals live around the depth where the player swims
  var fy = floorY(x), py = ex.player ? ex.player.root.y[0] : 300;
  var y = benthic ? fy - 30 : G.clamp(py + (R() - 0.5) * 700, 80, fy - 60);
  var group = { members: [], leader: null, benthic: !!benthic, home: x, homeY: y, tx: x, ty: y, timer: 0 };
  var n = schoolSize(id, sp, R);
  for (var k = 0; k < n; k++) {
    var c = G.makeCreature(sp, x + (R() - 0.5) * 60, y + (R() - 0.5) * 40, { dir: R() * TAU });
    c.group = group;
    c.offset = { x: (R() - 0.5) * 110, y: (R() - 0.5) * 60 };
    c.bestiaryId = id;
    c.biome = bi;
    group.members.push(c);
    ch.fauna.push(c);
  }
  group.leader = group.members[0];
}

function manageChunks() {
  var ci = Math.floor(ex.player.root.x[0] / CH);
  for (var i = ci - 1; i <= ci + 1; i++) if (!ex.chunks[i]) ex.chunks[i] = makeChunk(i);
  Object.keys(ex.chunks).forEach(function (k) {
    if (Math.abs(k - ci) > 2) delete ex.chunks[k];
  });
}

function eachChunk(fn) { Object.keys(ex.chunks).forEach(function (k) { fn(ex.chunks[k]); }); }

function allFauna() {
  var out = [];
  eachChunk(function (ch) { for (var i = 0; i < ch.fauna.length; i++) out.push(ch.fauna[i]); });
  for (var j = 0; j < ex.free.length; j++) out.push(ex.free[j]);
  return out;
}

// ----- behaviour ----- //

function clampFloor(c) {
  var r = c.root, fy = floorY(r.x[0]) - 8;
  if (r.y[0] > fy) { r.y[0] = fy; if (c.vy > 0) c.vy = 0; }
}

function wanderTarget(o, home, benthic) {
  o.tx = home + (Math.random() - 0.5) * 700;
  var fy = floorY(o.tx), hy = o.homeY === undefined ? fy - 200 : o.homeY;
  o.ty = benthic ? fy - 25 : G.clamp(hy + (Math.random() - 0.5) * 400, 80, fy - 60);
  o.timer = 3 + Math.random() * 4;
}

function aiStep(c, t) {
  var r = c.root, g = c.group, sp = c.speed * 0.75, tx, ty;
  if (g && g.leader !== c && g.leader) {
    tx = g.leader.root.x[0] + c.offset.x;
    ty = g.leader.root.y[0] + c.offset.y;
  } else {
    var o = g || c;
    if (!o.home) o.home = r.x[0];
    o.timer = (o.timer || 0) - STEP;
    if (o.timer <= 0 || Math.hypot(o.tx - r.x[0], o.ty - r.y[0]) < 40) wanderTarget(o, o.home, g ? g.benthic : false);
    tx = o.tx; ty = o.ty;
  }
  // the player: prey keep their distance, hunters come and look
  var p = ex.player.root, dx = p.x[0] - r.x[0], dy = p.y[0] - r.y[0], d = Math.hypot(dx, dy) || 1;
  if (c.spec.ai === 'prey' && d < 130) {
    tx = r.x[0] - dx / d * 200; ty = r.y[0] - dy / d * 200; sp *= 1.7;
  } else if (c.spec.ai === 'hunter' && d < 280 && d > 110) {
    tx = p.x[0] + Math.cos(t * 0.5 + c.phase) * 90; ty = p.y[0] + Math.sin(t * 0.5 + c.phase) * 60;
  }
  var mx = tx - r.x[0], my = ty - r.y[0], m = Math.hypot(mx, my) || 1;
  var f = E.swimFactor(c, t) * Math.min(1, m / 80);
  c.update(t, mx / m * sp * f, my / m * sp * f, 0.05, 24);
  clampFloor(c);
}

// ----- becoming another animal ----- //

function speciesKey(c) { return c.spec.name; }

function removeFromWorld(c) {
  eachChunk(function (ch) {
    var i = ch.fauna.indexOf(c);
    if (i >= 0) ch.fauna.splice(i, 1);
  });
  var j = ex.free.indexOf(c);
  if (j >= 0) ex.free.splice(j, 1);
  if (c.group) {
    var g = c.group, k = g.members.indexOf(c);
    if (k >= 0) g.members.splice(k, 1);
    if (g.leader === c) g.leader = g.members[0] || null;
    c.group = null;
  }
}

function possess(c) {
  var old = ex.player;
  if (!c || c === old) return;
  removeFromWorld(c);
  old.isPlayer = false;
  old.home = old.root.x[0];
  old.homeY = old.root.y[0];
  old.timer = 0;
  old.speed = old.spec.swim.speed;
  ex.free.push(old);
  c.isPlayer = true;
  ex.player = c;
  ex.selected = null;
  ex.near = null;
  G.ring(c.root.x[0], c.root.y[0], c.root.hue, 60);
  G.sparks(c.root.x[0], c.root.y[0], c.root.hue, 20, 3);
  G.sfx('graft');
  G.vibrate([10, 30, 10]);
  G.toast('Tu es maintenant : ' + c.spec.name, 'good');
  G.store('hydra.player', JSON.stringify(c.spec));
  discover(c);
  renderCard();
}

function replaceCreature(c, sp) {
  var isP = c === ex.player;
  var n = G.makeCreature(E.spec(sp), c.root.x[0], c.root.y[0], { dir: c.root.ang[1], player: isP });
  n.vx = c.vx; n.vy = c.vy;
  n.biome = c.biome;
  removeFromWorld(c);
  if (isP) {
    ex.player = n;
    G.store('hydra.player', JSON.stringify(n.spec));
    discover(n);
  } else {
    ex.free.push(n);
  }
  return n;
}

function summon(sp) {
  var p = ex.player.root;
  var c = G.makeCreature(E.spec(E.clone(sp)), p.x[0] + 70, p.y[0] - 20, { dir: Math.PI });
  c.speed = c.spec.swim.speed;
  ex.free.push(c);
  possess(c);
}

// ----- logbook ----- //

function loadCarnet() {
  ex.carnet = {};
  try { ex.carnetList = JSON.parse(G.store('hydra.carnet') || '[]'); } catch (e) { ex.carnetList = []; }
  ex.carnetList.forEach(function (it) { ex.carnet[it.key] = it; });
}

function discover(c) {
  var key = speciesKey(c);
  if (ex.carnet[key]) return;
  var info = c.bestiaryId && E.INFO[c.bestiaryId];
  var it = {
    key: key, name: c.spec.name, spec: c.spec,
    where: BIOMES[c.biome !== undefined ? c.biome : biomeIndex(c.root.x[0])].name,
    desc: info ? info[1] : (c.spec.gen ? 'Espèce propre à ce monde.' : 'Espèce façonnée à l\'atelier.'),
    endemic: !!c.spec.gen, t: Date.now()
  };
  ex.carnet[key] = it;
  ex.carnetList.unshift(it);
  if (ex.carnetList.length > 120) delete ex.carnet[ex.carnetList.pop().key];
  G.store('hydra.carnet', JSON.stringify(ex.carnetList));
  if (c !== ex.player) {
    G.toast('Nouvelle espèce : ' + it.name + (it.endemic ? ' · endémique' : ''), 'good');
    G.sfx('eat');
  }
  $('exCount').textContent = ex.carnetList.length;
}

// ----- simulation ----- //

function inActive(b) {
  var v = G.view, m = 350;
  return !(b[2] < v[0] - m || b[0] > v[2] + m || b[3] < v[1] - m || b[1] > v[3] + m);
}

function tick() {
  var t = (ex.t += STEP), i;
  manageChunks();

  var p = ex.player;
  G.playerControl(p, t);
  clampFloor(p);

  var fauna = allFauna();
  for (i = 0; i < fauna.length; i++) if (inActive(fauna[i].box)) aiStep(fauna[i], t);
  eachChunk(function (ch) {
    ch.plants.forEach(function (pl) { if (inActive(pl.box)) pl.update(t, 0, 0, 1); });
    ch.vents.forEach(function (v) {
      v.t -= STEP;
      if (v.t <= 0 && inActive([v.x - 20, v.y - v.h, v.x + 20, v.y]) && ex.bubbles.length < 160) {
        ex.bubbles.push({ x: v.x + (Math.random() - 0.5) * v.w * 0.6, y: v.y - v.h, vx: (Math.random() - 0.5) * 0.3, vy: -0.6 - Math.random() * 0.6, r: 1 + Math.random() * 2.5, life: 3 + Math.random() * 2 });
        v.t = 0.08 + Math.random() * 0.12;
      }
    });
  });
  for (i = ex.bubbles.length - 1; i >= 0; i--) {
    var bb = ex.bubbles[i];
    bb.x += bb.vx + Math.sin(t * 3 + i) * 0.15; bb.y += bb.vy; bb.life -= STEP;
    if (bb.life <= 0 || bb.y < 10) ex.bubbles.splice(i, 1);
  }
  // old bodies that wandered too far are forgotten
  for (i = ex.free.length - 1; i >= 0; i--) {
    if (Math.abs(ex.free[i].root.x[0] - p.root.x[0]) > 2600) ex.free.splice(i, 1);
  }
  var st = G.state;
  for (i = st.sparks.length - 1; i >= 0; i--) {
    var s = st.sparks[i];
    s.x += s.vx; s.y += s.vy; s.vx *= 0.92; s.vy *= 0.92; s.life -= STEP;
    if (s.life <= 0) st.sparks.splice(i, 1);
  }
  for (i = st.rings.length - 1; i >= 0; i--) {
    var rg = st.rings[i];
    rg.life -= STEP * 2; rg.r += (rg.max - rg.r) * 0.15;
    if (rg.life <= 0) st.rings.splice(i, 1);
  }

  // camera
  var cam = st.cam;
  cam.x += (p.root.x[0] + p.vx * 18 - cam.x) * 0.08;
  cam.y += (p.root.y[0] + p.vy * 18 - cam.y) * 0.08;
  cam.y = Math.max(cam.y, G.H / 2 / G.zoom - 90);
  cam.shake *= 0.86;

  // who is around?
  if ((ex.scanT -= STEP) <= 0) {
    ex.scanT = 0.25;
    var best = null, bd = 140, px = p.root.x[0], py = p.root.y[0];
    fauna.forEach(function (c) {
      var d = Math.hypot(c.root.x[0] - px, c.root.y[0] - py);
      if (d < 260 && !ex.carnet[speciesKey(c)]) discover(c);
      if (d < bd) { bd = d; best = c; }
    });
    ex.near = best;
    if (ex.selected && (ex.selected === p || Math.hypot(ex.selected.root.x[0] - px, ex.selected.root.y[0] - py) > 1200)) {
      ex.selected = null;
      renderCard();
    }
    var bi = biomeIndex(px);
    if (bi !== ex.biome) {
      if (ex.biome >= 0) G.toast(BIOMES[bi].name);
      ex.biome = bi;
    }
  }
}

// ----- rendering ----- //

function hsl(a, dl, alpha) {
  return 'hsla(' + a[0].toFixed(0) + ',' + a[1].toFixed(0) + '%,' + Math.max(2, a[2] + (dl || 0)).toFixed(1) + '%,' + (alpha === undefined ? 1 : alpha) + ')';
}

// circular mean of the biomes' hues
function sandLike(x, key) {
  var w = weights(x), sx = 0, sy = 0;
  for (var k = 0; k < BIOMES.length; k++) {
    var h = (key === 'tint' ? BIOMES[k].tint.h : BIOMES[k].sand[0]) * Math.PI / 180;
    sx += w[k] * Math.cos(h); sy += w[k] * Math.sin(h);
  }
  return (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
}

function sandAt(x) {
  var w = weights(x), h = 0, s = 0, l = 0, sx = 0, sy = 0;
  for (var k = 0; k < BIOMES.length; k++) {
    var c = BIOMES[k].sand, a = c[0] * Math.PI / 180;
    sx += w[k] * Math.cos(a); sy += w[k] * Math.sin(a);
    s += w[k] * c[1]; l += w[k] * c[2];
  }
  h = (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
  return [h, s, l];
}

function drawFloor(ctx) {
  var v = G.view, step = 18, x, x0 = Math.floor((v[0] - 40) / step) * step, x1 = v[2] + 40;
  var minY = Infinity;
  for (x = x0; x <= x1; x += step) minY = Math.min(minY, floorY(x));
  if (minY > v[3] + 10) return;
  var sand = sandAt(G.state.cam.x);
  var g = ctx.createLinearGradient(0, minY, 0, minY + 400);
  g.addColorStop(0, hsl(sand));
  g.addColorStop(1, hsl(sand, -sand[2] * 0.7));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, floorY(x0));
  for (x = x0 + step; x <= x1; x += step) ctx.lineTo(x, floorY(x));
  ctx.lineTo(x1, v[3] + 60);
  ctx.lineTo(x0, v[3] + 60);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hsl(sand, 14, 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, floorY(x0));
  for (x = x0 + step; x <= x1; x += step) ctx.lineTo(x, floorY(x));
  ctx.stroke();
}

function drawRocks(ctx, ch) {
  var sand = BIOMES[ch.biome].sand;
  ch.rocks.forEach(function (r) {
    if (r.x + r.r < G.view[0] || r.x - r.r > G.view[2] || r.y - r.r > G.view[3] || r.y + r.r < G.view[1]) return;
    ctx.fillStyle = hsl(sand, -8);
    ctx.beginPath();
    for (var q = 0; q <= r.pts.length; q++) {
      var a = Math.PI + q / r.pts.length * Math.PI, rr = r.r * r.pts[q % r.pts.length];
      var px = r.x + Math.cos(a) * rr * 1.3, py = r.y + 6 + Math.sin(a) * rr;
      if (q === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hsl(sand, 10, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  ch.vents.forEach(function (v) {
    if (v.x + 40 < G.view[0] || v.x - 40 > G.view[2]) return;
    ctx.fillStyle = hsl(sand, -6);
    ctx.beginPath();
    ctx.moveTo(v.x - v.w, v.y + 6);
    ctx.lineTo(v.x - v.w * 0.35, v.y - v.h);
    ctx.lineTo(v.x + v.w * 0.35, v.y - v.h);
    ctx.lineTo(v.x + v.w, v.y + 6);
    ctx.closePath();
    ctx.fill();
  });
}

function drawSelection(ctx) {
  var t = ex.t;
  function ringAround(c, col, dash) {
    var b = c.box, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, r = Math.max(20, Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 6);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6 / G.zoom;
    ctx.setLineDash(dash ? [6 / G.zoom, 6 / G.zoom] : []);
    ctx.lineDashOffset = -t * 20 / G.zoom;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (ex.selected) ringAround(ex.selected, 'rgba(255,214,110,0.9)', false);
  if (ex.near && ex.near !== ex.selected) ringAround(ex.near, 'rgba(94,242,214,0.55)', true);
}

function render() {
  var ctx = G.ctx, cam = G.state.cam, p = ex.player;
  var m = G.depthM(cam.y), f = G.clamp(m / 520, 0, 1);
  var tint = { h: sandLike(cam.x, 'tint'), s: mixed(cam.x, function (b) { return b.tint.s; }) };
  G.drawWater(m, f, tint);
  G.drawRaysAndSnow(cam, m, ex.t);
  var off = G.worldTransform(cam);
  G.drawSurface(ex.t);

  var o = { view: G.view };
  eachChunk(function (ch) {
    drawRocks(ctx, ch);
    ch.plants.forEach(function (pl) { if (G.inView(pl.box)) E.draw(ctx, pl, o); });
  });
  drawFloor(ctx);
  var fauna = allFauna(), i;
  for (i = 0; i < fauna.length; i++) if (G.inView(fauna[i].box)) E.draw(ctx, fauna[i], o);
  o.bright = true;
  E.draw(ctx, p, o);
  drawSelection(ctx);

  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(200,240,255,0.35)';
  ex.bubbles.forEach(function (bb) {
    ctx.beginPath();
    ctx.arc(bb.x, bb.y, bb.r, 0, TAU);
    ctx.fill();
  });
  var st = G.state;
  st.sparks.forEach(function (s) {
    ctx.fillStyle = 'hsla(' + s.hue + ',100%,70%,' + Math.min(1, s.life * 2).toFixed(2) + ')';
    ctx.fillRect(s.x - 1, s.y - 1, 2.2, 2.2);
  });
  ctx.lineWidth = 2;
  st.rings.forEach(function (rg) {
    ctx.strokeStyle = 'hsla(' + rg.hue + ',100%,70%,' + rg.life.toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(rg.x, rg.y, rg.r, 0, TAU);
    ctx.stroke();
  });
  ctx.globalCompositeOperation = 'source-over';

  G.bloomPass(f);

  // the dark is gentler than in survival: this is a stroll
  var dark = G.clamp((m - 60) / 420, 0, 0.9);
  var vision = Math.max(190, 480 - m * 0.3) + Math.min(3, p.stats.light) * 110;
  G.drawDarkness((p.root.x[0] - cam.x) * G.zoom + G.W / 2, (p.root.y[0] - cam.y) * G.zoom + G.H / 2, vision, dark);

  ctx.setTransform(G.dpr * G.zoom, 0, 0, G.dpr * G.zoom, G.dpr * off[0], G.dpr * off[1]);
  ctx.globalCompositeOperation = 'lighter';
  var ga = 0.35 + 0.65 * f;
  function glowAt(x, y, size, hue, a) {
    ctx.globalAlpha = a * ga;
    ctx.drawImage(G.glowSprite(hue), x - size / 2, y - size / 2, size, size);
  }
  eachChunk(function (ch) {
    ch.plants.forEach(function (pl) { if (G.inView(pl.box)) E.eachGlow(pl.list, glowAt, G.view); });
    ch.vents.forEach(function (v) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(G.glowSprite(20), v.x - 30, v.y - v.h - 30, 60, 60);
    });
  });
  for (i = 0; i < fauna.length; i++) if (G.inView(fauna[i].box)) E.eachGlow(fauna[i].list, glowAt, G.view);
  ga = 1;
  E.eachGlow(p.list, glowAt, G.view);
  ctx.globalAlpha = 0.3 + 0.3 * f;
  ctx.drawImage(G.glowSprite(p.root.hue), p.root.x[0] - 40, p.root.y[0] - 40, 80, 80);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  if (G.state.mode === 'explore') G.drawTouchControls();
}

// ----- HUD ----- //

function updateHud() {
  var p = ex.player;
  $('exBiome').textContent = BIOMES[Math.max(0, ex.biome)].name;
  $('exDepth').textContent = Math.round(G.depthM(p.root.y[0]));
  $('exWho').textContent = p.spec.name;
  var near = $('exNear');
  var show = ex.near && !ex.selected && G.state.mode === 'explore';
  near.hidden = !show;
  if (show) near.querySelector('b').textContent = ex.near.spec.name;
}

function renderCard() {
  var card = $('exCard'), c = ex.selected;
  card.hidden = !c;
  if (!c) return;
  var it = ex.carnet[speciesKey(c)];
  $('exCardName').textContent = c.spec.name;
  $('exCardInfo').textContent = it ? it.desc + ' · ' + it.where : '';
  E.snapshot(c.spec, card.querySelector('canvas'), { pad: 4 });
}

function tap(e) {
  // right half (or mouse): tapping an animal selects it instead of dashing
  if (e.pointerType !== 'mouse' && e.clientX < G.W * 0.5) return false;
  var w = G.screenToWorld(e.clientX, e.clientY), tol = 18 / G.zoom, best = null, bd = Infinity;
  allFauna().forEach(function (c) {
    var b = c.box;
    if (w.x < b[0] - tol || w.x > b[2] + tol || w.y < b[1] - tol || w.y > b[3] + tol) return;
    var s = E.pick(c, w.x, w.y, tol);
    if (!s) return;
    var d = Math.hypot(c.root.x[0] - w.x, c.root.y[0] - w.y);
    if (d < bd) { bd = d; best = c; }
  });
  if (!best) return false;
  ex.selected = best;
  discover(best);
  renderCard();
  G.sfx('eat');
  return true;
}

// ----- screens ----- //

function setExMode(m) {
  G.setMode(m);
  $('exMenu').hidden = m !== 'explore-menu';
  $('exCarnet').hidden = m !== 'explore-carnet';
  if (m === 'explore') updateHud();
}

function openEditor(c) {
  var target = c || ex.player;
  $('exCard').hidden = true;
  setExMode('atelier');
  HydraAtelier.open(target.spec, {
    playLabel: 'Nager',
    onClose: function () { setExMode('explore'); },
    onPlay: function (sp) {
      var n = replaceCreature(target, sp);
      if (n !== ex.player) possess(n);
      else G.toast('Tu nages avec ta nouvelle version', 'good');
    }
  });
}

function openEditorSpec(sp) {
  setExMode('atelier');
  HydraAtelier.open(sp, {
    playLabel: 'Nager',
    onClose: function () { setExMode('explore'); },
    onPlay: function (edited) { summon(edited); }
  });
}

function renderCarnet() {
  var grid = $('exCarnetGrid');
  grid.innerHTML = '';
  $('exCarnetTitle').textContent = 'Carnet · ' + ex.carnetList.length + ' espèce' + (ex.carnetList.length > 1 ? 's' : '');
  if (!ex.carnetList.length) {
    grid.innerHTML = '<p class="hint">Approche-toi des animaux pour les noter ici.</p>';
    return;
  }
  ex.carnetList.forEach(function (it) {
    var card = document.createElement('div');
    card.className = 'pick-card';
    card.innerHTML = '<canvas></canvas><b></b><small></small><div class="btn-row"><button type="button" class="ghost">Devenir</button><button type="button" class="ghost">Atelier</button><button type="button" class="ghost">Garder</button></div>';
    card.querySelector('b').textContent = it.name + (it.endemic ? ' ✦' : '');
    card.querySelector('small').textContent = it.where;
    var btns = card.querySelectorAll('button');
    btns[0].addEventListener('click', function () { setExMode('explore'); summon(it.spec); });
    btns[1].addEventListener('click', function () { openEditorSpec(it.spec); });
    btns[2].addEventListener('click', function () {
      var lib;
      try { lib = JSON.parse(G.store('hydra.lib') || '[]'); } catch (e) { lib = []; }
      lib = lib.filter(function (s) { return s.name !== it.spec.name; });
      lib.unshift(it.spec);
      G.store('hydra.lib', JSON.stringify(lib.slice(0, 30)));
      btns[2].textContent = 'Gardée';
    });
    grid.appendChild(card);
    requestAnimationFrame(function () { E.snapshot(E.spec(it.spec), card.querySelector('canvas'), { pad: 4 }); });
  });
}

// ----- lifecycle ----- //

function newSeed() { return 1 + Math.floor(Math.random() * 999999); }

function buildWorld(sp) {
  ex.chunks = {};
  ex.free = [];
  ex.endemic = {};
  ex.bubbles = [];
  ex.t = 0;
  ex.selected = null;
  ex.near = null;
  ex.biome = -1;
  // start above the lagoon or the reef, where there is something to see
  var x = 0;
  for (var k = 0; k < 120; k++) {
    var cand = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 500;
    if (biomeIndex(cand) <= 1) { x = cand; break; }
  }
  var y = Math.min(260, floorY(x) - 120);
  ex.player = G.makeCreature(sp, x, y, { player: true, dir: Math.PI / 2 });
  G.state.cam.x = x;
  G.state.cam.y = y;
  G.state.sparks.length = 0;
  G.state.rings.length = 0;
  $('exSeed').textContent = ex.seed;
  manageChunks();
}

function start() {
  G.immersive();
  loadCarnet();
  ex.seed = parseInt(G.store('hydra.seed') || '0', 10) || newSeed();
  G.store('hydra.seed', String(ex.seed));
  buildWorld(G.playerSpec());
  discover(ex.player);
  $('exCount').textContent = ex.carnetList.length;
  renderCard();
  setExMode('explore');
  G.toast('Touche un animal pour le voir, approche-toi pour devenir lui');
}

function frame(dt) {
  if (G.state.mode === 'explore') {
    ex.acc += dt;
    var steps = 0;
    while (ex.acc >= STEP && steps < 4) { tick(); ex.acc -= STEP; steps++; }
    if (steps === 4) ex.acc = 0;
  }
  render();
  if ((ex.hudT += dt) > 0.15) { ex.hudT = 0; updateHud(); }
}

function menu() {
  if (G.state.mode === 'explore') setExMode('explore-menu');
  else if (G.state.mode === 'explore-menu') setExMode('explore');
}

$('exBtnMenu').addEventListener('click', menu);
$('exBtnAtelier').addEventListener('click', function () { openEditor(ex.player); });
$('exBtnCarnet').addEventListener('click', function () { renderCarnet(); setExMode('explore-carnet'); });
$('exCarnetClose').addEventListener('click', function () { setExMode('explore'); });
$('exNear').addEventListener('click', function () { if (ex.near) possess(ex.near); });
$('exCardPossess').addEventListener('click', function () { if (ex.selected) possess(ex.selected); });
$('exCardEdit').addEventListener('click', function () { if (ex.selected) openEditor(ex.selected); });
$('exCardClose').addEventListener('click', function () { ex.selected = null; renderCard(); });
$('exResume').addEventListener('click', function () { setExMode('explore'); });
$('exNewWorld').addEventListener('click', function () {
  ex.seed = newSeed();
  G.store('hydra.seed', String(ex.seed));
  buildWorld(ex.player.spec);
  setExMode('explore');
  G.toast('Nouveau monde n° ' + ex.seed);
});
$('exQuit').addEventListener('click', function () {
  $('exMenu').hidden = true;
  $('exCarnet').hidden = true;
  G.toTitle();
});

window.HydraExplore = { start: start, frame: frame, tap: tap, menu: menu, get state() { return ex; }, floorY: floorY, BIOMES: BIOMES };

})();
