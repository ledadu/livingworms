// HYDRA engine — trees of whips (v2), shared by the game and the editor.
//
// A species is a tree of part definitions. Each part is a whip (verlet chain
// with an angle limit, like whip.js) and carries attachments. An attachment
// places copies of a child part on its parent with a pattern:
//   single · pair (mirrored) · fan (spread around one node) · series (along the parent)
// Positions are fractions of the parent (0 = head, 1 = tip) so a structure
// stays clean when the number of links changes.

(function (global) {
'use strict';

var TAU = Math.PI * 2;
var STEP = 1 / 60;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function wrapAngle(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function assign(target) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (src) for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
  }
  return target;
}

// ----- profiles: radius along the chain, t = 0 (base) → 1 (tip), max ≈ 1 ----- //
// the first ones come from whip.js, normalised so that "width" is the max radius

var SHAPES = {
  constant:      function (w) { return w; },
  linear:        function (w, t) { return w * (1 - t * 0.9); },
  worm:          function (w, t) { return w * (Math.sin(t * Math.PI) / 3 + 1) / 1.334; },
  virgule:       function (w, t) { return w * (Math.cos(t * Math.PI) + 1) / 2; },
  sansue:        function (w, t) { return w * (Math.sin(-0.5 + t * Math.PI * 1.5) + 1) / 2; },
  sansueBigHead: function (w, t) { return w * (Math.sin(t * Math.PI * 1.5) + 1) / 2; },
  bloby:         function (w, t) { return w * (Math.sin(t) / 3 + 1) / 1.281; },
  spindle:       function (w, t) { return w * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * t)), 0.7); },
  tadpole:       function (w, t) { return w * Math.max(0.1, 1 - 0.9 * Math.pow(t, 0.8)); },
  leaf:          function (w, t) { return w * Math.sin(Math.PI * (0.1 + 0.9 * t)); },
  bell:          function (w, t) { return w * (0.3 + 0.7 * Math.sqrt(t)); },
  carapace:      function (w, t) {
    return t < 0.35 ? w * (0.8 + 0.2 * Math.sin(t / 0.35 * Math.PI / 2)) : w * (1 - 0.62 * (t - 0.35) / 0.65);
  },
  frill:         function (w, t) { return w * (0.62 + 0.38 * Math.sin(t * Math.PI * 7)) * (1 - 0.5 * t); },
  club:          function (w, t) { return w * (0.3 + 0.8 * Math.exp(-Math.pow((t - 0.86) / 0.1, 2))); },
  bulb:          function (w, t) { return w * (0.22 + 0.9 * Math.exp(-Math.pow((1 - t) / 0.16, 2))); },
  gourd:         function (w, t) {
    return w * Math.max(0.12, 0.7 * Math.exp(-Math.pow(t / 0.09, 2)) + 0.9 * Math.exp(-Math.pow((t - 0.32) / 0.15, 2)) + 0.25 * (1 - t));
  }
};

var NAMES = {
  shape: {
    constant: 'Constant', linear: 'Pointe', worm: 'Ver', virgule: 'Virgule', sansue: 'Sangsue',
    sansueBigHead: 'Grosse tête', bloby: 'Blob', spindle: 'Fuseau', tadpole: 'Têtard', leaf: 'Feuille',
    bell: 'Cloche', carapace: 'Carapace', frill: 'Volant', club: 'Massue', bulb: 'Bulbe', gourd: 'Gourde'
  },
  style: { ribbon: 'Ruban', plates: 'Plaques', line: 'Trait', disc: 'Perles', eye: 'Œil' },
  motion: {
    none: 'Aucun', wave: 'Battement', row: 'Rame', flutter: 'Frémissement', pulse: 'Pulsation',
    breathe: 'Respiration', undulate: 'Ondulation', curl: 'Enroulement'
  },
  pattern: { single: 'Seul', pair: 'Paire', fan: 'Éventail', series: 'Série', ring: 'Anneau' },
  motif: { none: 'Uni', bands: 'Bandes', spots: 'Taches', stripe: 'Ligne', ocelli: 'Ocelles', edge: 'Liseré' },
  harmony: { analog: 'Analogue', complement: 'Complément', triad: 'Triade', split: 'Divisée', mono: 'Mono' },
  swim: { steady: 'Régulière', pulse: 'Par pulsations', dart: 'Par à-coups' },
  ai: { hunter: 'Chasseur', prey: 'Proie', drifter: 'Dériveur' },
  glow: { none: 'Aucune', tip: 'Au bout', body: 'Partout' },
  role: {
    body: 'Corps', whip: 'Fouet', sting: 'Dard', jaw: 'Pince', fin: 'Nageoire',
    cilia: 'Cils', light: 'Lanterne', sense: 'Antenne', deco: 'Décor'
  }
};

var ROLE_HELP = {
  body: 'Le tronc : ses points de vie sont ceux de la créature.',
  whip: 'Frappe quand il claque : plus le bout va vite, plus ça fait mal.',
  sting: 'Pique au moindre contact.',
  jaw: 'Mord de près et agrandit la bouche.',
  fin: 'Chaque copie augmente la vitesse de nage.',
  cilia: 'Chaque copie régénère un peu de vie.',
  light: 'Éclaire les abysses autour de toi.',
  sense: 'Élargit un peu la vision.',
  deco: 'Pour la beauté : aucun effet en jeu.'
};

// ----- definitions ----- //

var NODE_DEFAULTS = {
  name: 'Partie', role: 'deco', links: 8, len: 6, width: 3, shape: 'worm', style: 'ribbon',
  flex: 0.5, spring: 0.1, curl: 0, curlBias: 0, drag: 0.84, gravity: 0, lenTo: 1
};
var COLOR_DEFAULTS = {
  slot: 0, shift: 0, light: 0, grad: 0, alpha: 1, fade: 0, glow: 'none', add: false,
  pattern: 'none', pslot: 3, plight: 0, pdensity: 6, pscale: 1
};
var MOTION_DEFAULTS = { type: 'none', amp: 0.3, freq: 1, wave: 1 };
var ATT_DEFAULTS = {
  pattern: 'single', at: 0.5, to: 0.9, count: 4, angle: 1.2, angleTo: null, spread: 0.8,
  edge: 0, scale: 1, scaleTo: 1, phaseStep: 0.5, mirror: true, front: false,
  alternate: false, jitter: 0, web: 0, hueStep: 0
};
var SPEC_DEFAULTS = {
  palette: { hue: 180, harmony: 'analog', sat: 70, light: 55 },
  swim: { mode: 'steady', speed: 2, freq: 1 },
  ai: 'hunter',
  eyes: { on: true, size: 1, spread: 0.55, fwd: 0.35 }
};

function node(o) {
  o = o || {};
  var n = assign({}, NODE_DEFAULTS, o);
  n.color = assign({}, COLOR_DEFAULTS, o.color);
  n.motion = assign({}, MOTION_DEFAULTS, o.motion);
  n.attach = (o.attach || []).map(att);
  n.links = clamp(Math.round(n.links), 1, 60);
  return n;
}

function att(o) {
  o = o || {};
  var a = assign({}, ATT_DEFAULTS, o);
  a.node = node(o.node);
  if (a.angleTo === undefined) a.angleTo = null;
  a.count = clamp(Math.round(a.count), 1, 40);
  return a;
}

function spec(o) {
  o = o || {};
  var s = { v: 2, name: o.name || 'Espèce', size: o.size || 1 };
  s.palette = assign({}, SPEC_DEFAULTS.palette, o.palette);
  s.swim = assign({}, SPEC_DEFAULTS.swim, o.swim);
  s.ai = o.ai || SPEC_DEFAULTS.ai;
  s.eyes = assign({}, SPEC_DEFAULTS.eyes, o.eyes);
  s.body = node(assign({ role: 'body' }, o.body));
  if (o.gen) s.gen = assign({}, o.gen);
  return s;
}

function walkNodes(n, fn, depth, parentAtt) {
  depth = depth || 0;
  fn(n, depth, parentAtt || null);
  n.attach.forEach(function (a) { walkNodes(a.node, fn, depth + 1, a); });
}

// ----- palette: 4 harmonious slots per species ----- //

var HARMONIES = {
  analog: [0, 28, -28, 56],
  complement: [0, 180, 24, 204],
  triad: [0, 120, 240, 60],
  split: [0, 150, 210, 30],
  mono: [0, 0, 0, 0]
};

function palette(p) {
  var off = HARMONIES[p.harmony] || HARMONIES.analog, mono = p.harmony === 'mono';
  return off.map(function (o, i) {
    return {
      h: ((p.hue + o) % 360 + 360) % 360,
      s: clamp(p.sat - (mono ? 0 : i * 5), 0, 100),
      l: clamp(p.light + (mono ? [0, 14, -14, 26] : [0, 6, -6, 10])[i], 4, 96)
    };
  });
}

function hsla(h, s, l, a) {
  return 'hsla(' + h.toFixed(0) + ',' + s.toFixed(0) + '%,' + l.toFixed(1) + '%,' + a.toFixed(3) + ')';
}

// ----- patterns → copies ----- //

// stable pseudo-random value in [0, 1) for copy k
function hash(k, salt) {
  var v = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function expand(a, n) {
  var out = [], c = Math.max(1, a.count), k, f;
  var angleTo = a.angleTo === null ? a.angle : a.angleTo, j = a.jitter || 0;
  function push(t, angle, scale, phase, side, edge, k) {
    if (j) {
      // natural variation, identical on both sides of a mirror
      angle += side * (hash(k, 1) - 0.5) * 0.7 * j;
      scale *= 1 + (hash(k, 2) - 0.5) * 0.5 * j;
      phase += hash(k, 3) * TAU * j;
    }
    out.push({
      at: clamp(Math.round(t * n), 0, n), angle: angle, scale: scale, phase: phase, side: side, edge: edge,
      k: k, hue: k * (a.hueStep || 0), radial: a.pattern === 'ring'
    });
  }
  if (a.pattern === 'pair') {
    push(a.at, a.angle, a.scale, 0, 1, a.edge, 0);
    push(a.at, -a.angle, a.scale, 0, -1, -a.edge, 0);
  } else if (a.pattern === 'fan') {
    for (k = 0; k < c; k++) {
      f = c === 1 ? 0.5 : k / (c - 1);
      var sc = lerp(a.scale, a.scaleTo, Math.abs(f - 0.5) * 2);
      var an = a.angle + a.spread * (f - 0.5), ed = a.edge * (f - 0.5) * 2;
      push(a.at, an, sc, k * a.phaseStep, 1, ed, k);
      if (a.mirror && Math.abs(Math.sin(a.angle)) > 0.05) push(a.at, -an, sc, k * a.phaseStep, -1, -ed, k);
    }
  } else if (a.pattern === 'ring') {
    for (k = 0; k < c; k++) {
      var ra = k * TAU / c;
      push(a.at, a.angle + ra, lerp(a.scale, a.scaleTo, (1 - Math.cos(ra)) / 2), k * a.phaseStep, 1, a.edge, k);
    }
  } else if (a.pattern === 'series') {
    for (k = 0; k < c; k++) {
      f = c === 1 ? 0 : k / (c - 1);
      var t = lerp(a.at, a.to, f), s = lerp(a.scale, a.scaleTo, f), g = lerp(a.angle, angleTo, f);
      if (a.alternate) {
        var sd = k % 2 ? -1 : 1;
        push(t, sd * g, s, k * a.phaseStep, sd, sd * a.edge, k);
      } else {
        push(t, g, s, k * a.phaseStep, 1, a.edge, k);
        if (a.mirror) push(t, -g, s, k * a.phaseStep, -1, -a.edge, k);
      }
    }
  } else {
    push(a.at, a.angle, a.scale, 0, 1, a.edge, 0);
  }
  return out;
}

// ----- Seg: one live whip ----- //

var ROOT_SLOT = { at: 0, angle: 0, scale: 1, phase: 0, side: 1, edge: 0, k: 0, hue: 0, radial: false };

function Seg(def, a, parent, slot, flip, scale, x, y, dir, creature) {
  var n = Math.max(1, def.links), i;
  this.def = def;
  this.att = a;
  this.parent = parent;
  this.creature = creature;
  this.depth = parent ? parent.depth + 1 : 0;
  this.n = n;
  this.at = parent ? Math.min(slot.at, parent.n) : 0;
  var pf = parent ? parent.flip : 1;
  this.rel = slot.angle * pf;
  this.edge = slot.edge * pf;
  this.phase = slot.phase;
  this.k = slot.k;
  this.side = slot.side;
  this.hueOff = slot.hue || 0;
  this.radial = slot.radial;
  this.flip = flip;
  this.scale = scale;
  this.len = def.len * scale;
  this.amax = 0.03 + def.flex * 2.6;
  this.bend = def.curl * flip / n;
  this.pulse = 0;
  this.cd = 0;
  this.flash = 0;
  this.x = new Float32Array(n + 1);
  this.y = new Float32Array(n + 1);
  this.ox = new Float32Array(n + 1);
  this.oy = new Float32Array(n + 1);
  this.ang = new Float32Array(n + 1);
  this.rad = new Float32Array(n + 1);
  this.lens = new Float32Array(n + 1);
  this.box = [x, y, x, y];
  // link length can shrink or grow toward the tip (spiral shells, tapering tails)
  var lt = def.lenTo === undefined ? 1 : def.lenTo;
  for (i = 1; i <= n; i++) this.lens[i] = this.len * lerp(1, lt, n > 1 ? (i - 1) / (n - 1) : 0);
  this.pulseU = def.motion.type === 'breathe';
  // rest curvature per link: -1 = gathered at the base, +1 = gathered at the tip
  this.bends = new Float32Array(n + 1);
  var cb = def.curlBias || 0;
  for (i = 2; i <= n; i++) this.bends[i] = this.bend * (1 + cb * (n > 2 ? (i - 2) / (n - 2) * 2 - 1 : 0));

  var shape = SHAPES[def.shape] || SHAPES.worm, w = def.width * scale;
  this.maxRad = 0;
  for (i = 0; i <= n; i++) {
    this.rad[i] = Math.max(0.15, shape(w, i / n));
    if (this.rad[i] > this.maxRad) this.maxRad = this.rad[i];
  }
  // start in the rest pose
  var an = dir;
  this.x[0] = this.ox[0] = x;
  this.y[0] = this.oy[0] = y;
  for (i = 1; i <= n; i++) {
    if (i > 1) an += this.bends[i];
    this.ang[i] = an;
    this.x[i] = this.ox[i] = this.x[i - 1] + Math.cos(an) * this.lens[i];
    this.y[i] = this.oy[i] = this.y[i - 1] + Math.sin(an) * this.lens[i];
  }
  this.ang[0] = this.ang[1];
  this.paint(creature.pal);

  this.children = [];
  for (i = 0; i < def.attach.length; i++) this.instantiate(def.attach[i]);
}

Seg.prototype.instantiate = function (a) {
  var slots = expand(a, this.n), out = [];
  for (var k = 0; k < slots.length; k++) {
    var s = slots[k], at = s.at;
    var c = new Seg(a.node, a, this, s, this.flip * s.side, this.scale * s.scale,
      this.x[at], this.y[at], this.ang[at] + s.angle * this.flip, this.creature);
    this.children.push(c);
    out.push(c);
  }
  return out;
};

Seg.prototype.paint = function (pal) {
  var c = this.def.color, sl = pal[c.slot] || pal[0], n = this.n, i;
  var h = ((sl.h + c.shift + this.hueOff) % 360 + 360) % 360;
  var ps = pal[c.pslot] || pal[3], ph = ((ps.h + c.shift + this.hueOff) % 360 + 360) % 360;
  this.hue = h;
  this.cols = [];
  // bands are baked in the colours for styles drawn link by link
  var bake = c.pattern === 'bands' && this.def.style !== 'ribbon', nb = Math.max(1, Math.round(c.pdensity));
  for (i = 0; i <= n; i++) {
    var t = i / n, al = clamp(c.alpha * (1 - c.fade * t), 0, 1);
    if (bake && Math.floor(t * nb * 2 - 0.001) % 2 === 1) this.cols[i] = hsla(ph, ps.s, clamp(ps.l + c.plight, 3, 97), al);
    else this.cols[i] = hsla(h, sl.s, clamp(sl.l + c.light + c.grad * t, 3, 97), al);
  }
  var lm = clamp(sl.l + c.light + c.grad * 0.5, 3, 97);
  this.edgeCol = hsla(h, sl.s, Math.max(2, lm - 24), clamp(c.alpha * 0.8, 0, 1));
  this.shineCol = hsla(h, Math.max(0, sl.s - 30), Math.min(97, lm + 30), clamp(c.alpha * 0.28, 0, 1));
  this.patCol = hsla(ph, ps.s, clamp(ps.l + c.plight, 3, 97), clamp(c.alpha, 0, 1));
  this.webCol = hsla(h, sl.s, Math.min(95, lm + 8), clamp(c.alpha * 0.42, 0, 1));
};

function rowCurve(w) {
  // quick power stroke, slow recovery
  var f = ((w / TAU) % 1 + 1) % 1, u;
  if (f < 0.3) { u = f / 0.3; return 1 - 2 * u * u * (3 - 2 * u); }
  u = (f - 0.3) / 0.7;
  return -1 + 2 * u * u * (3 - 2 * u);
}

Seg.prototype.update = function (time) {
  var d = this.def, m = d.motion, n = this.n, x = this.x, y = this.y, ox = this.ox, oy = this.oy,
      ang = this.ang, rad = this.rad, i;
  var w = TAU * m.freq * time + this.phase, fixed = null;

  this.pulse = m.type === 'pulse' || m.type === 'breathe' ? m.amp * (0.5 + 0.5 * Math.sin(w)) : 0;

  if (this.parent) {
    var p = this.parent, k = this.at, pa = p.ang[k], px = p.x[k], py = p.y[k];
    fixed = pa + this.rel;
    if (this.edge) {
      var pr = p.rad[k] * (1 + p.pulse * (p.pulseU ? 1 : k / p.n)) * this.edge;
      if (this.radial) {
        // ring: pushed outward along its own direction (starfish arms on the disc rim)
        px += Math.cos(fixed) * pr;
        py += Math.sin(fixed) * pr;
      } else {
        px -= Math.sin(pa) * pr;
        py += Math.cos(pa) * pr;
      }
    }
    ox[0] = x[0]; oy[0] = y[0];
    x[0] = px; y[0] = py;
  } else if (this.anchor !== undefined) {
    // rooted in the sea floor (kelp, coral): the base keeps its direction
    fixed = this.anchor;
  }
  if (fixed !== null) {
    if (m.type === 'wave') fixed += m.amp * Math.sin(w) * this.flip;
    else if (m.type === 'row') fixed += m.amp * rowCurve(w) * this.flip;
    else if (m.type === 'flutter') fixed += m.amp * (0.6 * Math.sin(w) + 0.4 * Math.sin(w * 2.7 + 1.3)) * this.flip;
  }

  var drag = d.drag, grav = d.gravity + (this.sink || 0), amax = this.amax, keep = 1 - d.spring,
      lens = this.lens, bends = this.bends, soak = 0.2 + 0.4 * d.flex, extra = 0;
  if (m.type === 'curl') extra = m.amp * (0.5 + 0.5 * Math.sin(w)) * this.flip / n * 2;
  var und = m.type === 'undulate' ? m.amp * 0.5 : 0, wk = TAU * m.wave / n;
  var minx = x[0] - rad[0], maxx = x[0] + rad[0], miny = y[0] - rad[0], maxy = y[0] + rad[0];

  for (i = 1; i <= n; i++) {
    var px2 = x[i], py2 = y[i];
    var vx = (px2 - ox[i]) * drag, vy = (py2 - oy[i]) * drag;
    ox[i] = px2; oy[i] = py2;
    px2 += vx; py2 += vy + grav;

    var a = Math.atan2(py2 - y[i - 1], px2 - x[i - 1]);
    if (i === 1) {
      if (fixed !== null) a = fixed;
    } else {
      // shape memory: pulled toward the rest bend, never further than amax from it
      var tgt = bends[i] + extra + (und ? und * Math.sin(w - i * wk) : 0);
      var dd = wrapAngle(a - ang[i - 1]) - tgt;
      if (dd > amax) dd = amax;
      else if (dd < -amax) dd = -amax;
      a = ang[i - 1] + tgt + dd * keep;
    }
    ang[i] = a;
    var nx2 = x[i - 1] + Math.cos(a) * lens[i], ny2 = y[i - 1] + Math.sin(a) * lens[i];
    // like deltaScale in whip.js: part of the correction is not turned into speed,
    // otherwise long soft chains fold into zig-zags
    ox[i] += (nx2 - px2) * soak;
    oy[i] += (ny2 - py2) * soak;
    px2 = nx2; py2 = ny2;
    x[i] = px2; y[i] = py2;

    var r = rad[i] * (1 + this.pulse);
    if (px2 - r < minx) minx = px2 - r;
    if (px2 + r > maxx) maxx = px2 + r;
    if (py2 - r < miny) miny = py2 - r;
    if (py2 + r > maxy) maxy = py2 + r;
  }
  ang[0] = ang[1];
  this.box[0] = minx; this.box[1] = miny; this.box[2] = maxx; this.box[3] = maxy;

  if (this.cd > 0) this.cd -= STEP;
  if (this.flash > 0) this.flash -= STEP;

  for (i = 0; i < this.children.length; i++) this.children[i].update(time);
};

Seg.prototype.walk = function (fn) {
  fn(this);
  for (var i = 0; i < this.children.length; i++) this.children[i].walk(fn);
};

// ----- Creature ----- //

function Creature(sp, x, y, o) {
  o = o || {};
  this.spec = sp;
  this.pal = palette(sp.palette);
  this.phase = o.phase === undefined ? rand(0, TAU) : o.phase;
  this.vx = 0;
  this.vy = 0;
  this.list = [];
  this.box = [x, y, x, y];
  var slot = assign({}, ROOT_SLOT, { phase: this.phase });
  this.root = new Seg(sp.body, null, null, slot, 1, (o.scale || 1) * (sp.size || 1), x, y, o.dir === undefined ? Math.PI / 2 : o.dir, this);
  if (o.anchor !== undefined) this.root.anchor = o.anchor;
  this.refresh();
}

Creature.prototype.refresh = function () {
  var list = this.list;
  list.length = 0;
  this.root.walk(function (s) { list.push(s); });
  this.dirty = false;
};

Creature.prototype.update = function (time, dvx, dvy, accel, minY) {
  if (this.dirty) this.refresh();
  this.vx += (dvx - this.vx) * accel;
  this.vy += (dvy - this.vy) * accel;
  var r = this.root;
  r.ox[0] = r.x[0]; r.oy[0] = r.y[0];
  r.x[0] += this.vx; r.y[0] += this.vy;
  if (minY !== undefined && r.y[0] < minY) { r.y[0] = minY; if (this.vy < 0) this.vy *= -0.3; }
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

Creature.prototype.heading = function () { return this.root.ang[1] + Math.PI; };

// speed multiplier given by the way the species swims
function swimFactor(cr, t) {
  var s = cr.spec.swim;
  if (s.mode === 'pulse') {
    var m = cr.root.def.motion, f = m.type === 'pulse' ? m.freq : s.freq;
    var c = -Math.cos(TAU * f * t + cr.phase);   // the bell contracts
    return 0.2 + 2.2 * (c > 0 ? c * c : 0);
  }
  if (s.mode === 'dart') {
    cr.dartT = (cr.dartT || 0) - STEP;
    if (cr.dartT < -(cr.dartWait || 1)) { cr.dartT = 0.22; cr.dartWait = rand(0.5, 1.6); }
    return cr.dartT > 0 ? 3 : 0.45;
  }
  return 1;
}

// ----- rendering ----- //

var L = { x: new Float32Array(64), y: new Float32Array(64) },
    R = { x: new Float32Array(64), y: new Float32Array(64) },
    C = { x: new Float32Array(64), y: new Float32Array(64), r: new Float32Array(64), a: new Float32Array(64) };

function hull(s, k, off) {
  var n = s.n, x = s.x, y = s.y, ang = s.ang, rad = s.rad, pl = s.pulse;
  for (var i = 0; i <= n; i++) {
    var a = i === 0 ? ang[1] : i === n ? ang[n] : ang[i] + wrapAngle(ang[i + 1] - ang[i]) * 0.5;
    var nx = -Math.sin(a), ny = Math.cos(a), r0 = rad[i] * (1 + pl * (s.pulseU ? 1 : i / n)), r = r0 * k;
    var cx = x[i] + nx * r0 * off, cy = y[i] + ny * r0 * off;
    C.x[i] = cx; C.y[i] = cy; C.r[i] = r; C.a[i] = a;
    L.x[i] = cx + nx * r; L.y[i] = cy + ny * r;
    R.x[i] = cx - nx * r; R.y[i] = cy - ny * r;
  }
}

function ribbonPath(ctx, s, k, off, flatTail) {
  var n = s.n, i;
  hull(s, k, off);
  ctx.beginPath();
  ctx.moveTo(L.x[0], L.y[0]);
  for (i = 1; i < n; i++) ctx.quadraticCurveTo(L.x[i], L.y[i], (L.x[i] + L.x[i + 1]) / 2, (L.y[i] + L.y[i + 1]) / 2);
  ctx.lineTo(L.x[n], L.y[n]);
  if (flatTail) ctx.lineTo(R.x[n], R.y[n]);
  else ctx.arc(C.x[n], C.y[n], C.r[n], C.a[n] + Math.PI / 2, C.a[n] - Math.PI / 2, true);
  for (i = n - 1; i > 0; i--) ctx.quadraticCurveTo(R.x[i], R.y[i], (R.x[i] + R.x[i - 1]) / 2, (R.y[i] + R.y[i - 1]) / 2);
  ctx.lineTo(R.x[0], R.y[0]);
  ctx.arc(C.x[0], C.y[0], C.r[0], C.a[0] - Math.PI / 2, C.a[0] + Math.PI / 2, true);
  ctx.closePath();
}

function drawRibbon(ctx, s, flash) {
  var n = s.n, flat = s.def.shape === 'bell';
  ribbonPath(ctx, s, 1, 0, flat);
  if (flash) {
    ctx.fillStyle = '#ffffff';
  } else if (n > 1) {
    var g = ctx.createLinearGradient(s.x[0], s.y[0], s.x[n], s.y[n]);
    g.addColorStop(0, s.cols[0]);
    g.addColorStop(0.5, s.cols[n >> 1]);
    g.addColorStop(1, s.cols[n]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = s.cols[0];
  }
  ctx.fill();
  if (s.maxRad > 1.2) {
    ctx.lineWidth = Math.max(0.3, s.maxRad * 0.07);
    ctx.strokeStyle = s.edgeCol;
    ctx.stroke();
    if (!flash) drawMotif(ctx, s, flat);
    ribbonPath(ctx, s, 0.36, 0.34, flat);
    ctx.fillStyle = s.shineCol;
    ctx.fill();
  }
}

function drawPlates(ctx, s, flash) {
  var n = s.n, x = s.x, y = s.y, rad = s.rad, pl = s.pulse;
  ctx.lineWidth = Math.max(0.3, s.maxRad * 0.08);
  ctx.strokeStyle = s.edgeCol;
  for (var i = n; i >= 1; i--) {
    var r = Math.max(rad[i - 1], rad[i]) * (1 + pl * (s.pulseU ? 1 : i / n));
    ctx.beginPath();
    ctx.ellipse((x[i - 1] + x[i]) / 2, (y[i - 1] + y[i]) / 2, s.lens[i] * 0.62 + r * 0.2, r, s.ang[i], 0, TAU);
    ctx.fillStyle = flash ? '#ffffff' : s.cols[i];
    ctx.fill();
    ctx.stroke();
  }
  if (!flash && s.def.color.pattern !== 'bands') drawMotif(ctx, s, false);
  if (s.maxRad > 1.5) {
    ribbonPath(ctx, s, 0.3, 0.38, false);
    ctx.fillStyle = s.shineCol;
    ctx.fill();
  }
}

function minWidth(ctx) {
  // at least ~1 device pixel, so thin filaments stay visible when zoomed out
  var m = ctx.getTransform ? ctx.getTransform() : null;
  return m ? 1.1 / Math.max(0.01, Math.abs(m.a)) : 0.35;
}

function drawLine(ctx, s, flash, thin) {
  var n = s.n, x = s.x, y = s.y, rad = s.rad, c = s.def.color, i, mw = minWidth(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (c.alpha < 1 || c.add || c.fade > 0) {
    // translucent: one stroke, otherwise every joint shows as a dot
    ctx.lineWidth = Math.max(mw, thin || s.maxRad * 1.5);
    if (flash) ctx.strokeStyle = '#ffffff';
    else {
      var g = ctx.createLinearGradient(x[0], y[0], x[n], y[n]);
      g.addColorStop(0, s.cols[0]);
      g.addColorStop(1, s.cols[n]);
      ctx.strokeStyle = g;
    }
    ctx.beginPath();
    ctx.moveTo(x[0], y[0]);
    for (i = 1; i < n; i++) ctx.quadraticCurveTo(x[i], y[i], (x[i] + x[i + 1]) / 2, (y[i] + y[i + 1]) / 2);
    ctx.lineTo(x[n], y[n]);
    ctx.stroke();
    return;
  }
  for (i = 1; i <= n; i++) {
    ctx.lineWidth = Math.max(mw, thin || rad[i - 1] + rad[i]);
    ctx.strokeStyle = flash ? '#ffffff' : s.cols[i];
    ctx.beginPath();
    ctx.moveTo(x[i - 1], y[i - 1]);
    ctx.lineTo(x[i], y[i]);
    ctx.stroke();
  }
}

function drawDiscs(ctx, s, flash) {
  for (var i = s.n; i >= 0; i--) {
    ctx.fillStyle = flash ? '#ffffff' : s.cols[i];
    ctx.beginPath();
    ctx.arc(s.x[i], s.y[i], s.rad[i] * (1 + s.pulse * (s.pulseU ? 1 : i / s.n)), 0, TAU);
    ctx.fill();
  }
}

// point of an outline at a fractional node index
function hx(side, u) { var i = Math.floor(u), f = u - i; return f ? side.x[i] + (side.x[i + 1] - side.x[i]) * f : side.x[i]; }
function hy(side, u) { var i = Math.floor(u), f = u - i; return f ? side.y[i] + (side.y[i + 1] - side.y[i]) * f : side.y[i]; }

// body patterns drawn over a ribbon or plates
function drawMotif(ctx, s, flat) {
  var c = s.def.color, p = c.pattern, n = s.n, i, q;
  if (!p || p === 'none' || s.maxRad < 1) return;
  hull(s, 1, 0);
  ctx.fillStyle = s.patCol;
  if (p === 'bands') {
    // band q covers t in [(2q+1)/2nb, (2q+2)/2nb], cut along the outline
    var nb = Math.max(1, Math.round(c.pdensity));
    ctx.beginPath();
    for (q = 0; q < nb; q++) {
      var u0 = (2 * q + 1) / (2 * nb) * n, u1 = (2 * q + 2) / (2 * nb) * n, u;
      ctx.moveTo(hx(L, u0), hy(L, u0));
      for (u = Math.floor(u0) + 1; u < u1; u++) ctx.lineTo(L.x[u], L.y[u]);
      ctx.lineTo(hx(L, u1), hy(L, u1));
      ctx.lineTo(hx(R, u1), hy(R, u1));
      for (u = Math.ceil(u1) - 1; u > u0; u--) ctx.lineTo(R.x[u], R.y[u]);
      ctx.lineTo(hx(R, u0), hy(R, u0));
      ctx.closePath();
    }
    ctx.fill();
  } else if (p === 'spots') {
    ctx.beginPath();
    for (i = 0; i <= n; i++) {
      for (q = 0; q < 3; q++) {
        var id = i * 3 + q;
        if (hash(id, 7) * 12 > c.pdensity) continue;
        var u = (hash(id, 9) * 2 - 1) * 0.62, r = C.r[i] * (0.13 + 0.14 * hash(id, 11)) * c.pscale;
        if (r < 0.2) continue;
        var cx = C.x[i] + (L.x[i] - C.x[i]) * u, cy = C.y[i] + (L.y[i] - C.y[i]) * u;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, TAU);
      }
    }
    ctx.fill();
  } else if (p === 'stripe') {
    ribbonPath(ctx, s, 0.2 * c.pscale, 0, flat);
    ctx.fill();
  } else if (p === 'ocelli') {
    var no = Math.max(1, Math.round(c.pdensity / 2));
    for (q = 0; q < no; q++) {
      i = clamp(Math.round((q + 0.5) / no * n), 1, Math.max(1, n - 1));
      var rr = C.r[i] * 0.3 * c.pscale;
      for (var sd = -1; sd <= 1; sd += 2) {
        var ex = C.x[i] + (L.x[i] - C.x[i]) * 0.5 * sd, ey = C.y[i] + (L.y[i] - C.y[i]) * 0.5 * sd;
        ctx.fillStyle = s.edgeCol;
        ctx.beginPath(); ctx.arc(ex, ey, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = s.patCol;
        ctx.beginPath(); ctx.arc(ex, ey, rr * 0.68, 0, TAU); ctx.fill();
        ctx.fillStyle = s.edgeCol;
        ctx.beginPath(); ctx.arc(ex, ey, rr * 0.26, 0, TAU); ctx.fill();
      }
    }
  } else if (p === 'edge') {
    ribbonPath(ctx, s, 1, 0, flat);
    ctx.lineWidth = s.maxRad * 0.2 * c.pscale;
    ctx.strokeStyle = s.patCol;
    ctx.stroke();
  }
}

// membrane between two neighbour copies (fins with rays, webbed arms)
function webPair(ctx, A, B, f) {
  var ma = Math.max(1, Math.round(A.n * f)), mb = Math.max(1, Math.round(B.n * f)), i;
  ctx.beginPath();
  ctx.moveTo(A.x[0], A.y[0]);
  for (i = 1; i <= ma; i++) ctx.lineTo(A.x[i], A.y[i]);
  // scalloped trailing edge, pulled toward the base
  var mx = (A.x[ma] + B.x[mb]) / 2, my = (A.y[ma] + B.y[mb]) / 2;
  var bx = (A.x[0] + B.x[0]) / 2, by = (A.y[0] + B.y[0]) / 2;
  ctx.quadraticCurveTo(mx + (bx - mx) * 0.3, my + (by - my) * 0.3, B.x[mb], B.y[mb]);
  for (i = mb - 1; i >= 0; i--) ctx.lineTo(B.x[i], B.y[i]);
  ctx.closePath();
  ctx.fillStyle = A.webCol;
  ctx.fill();
}

function drawWebs(ctx, s, front, o) {
  var atts = s.def.attach, ch = s.children;
  for (var ai = 0; ai < atts.length; ai++) {
    var a = atts[ai];
    if (!(a.web > 0) || !!a.front !== front || (o.lit && !a.node.color.add)) continue;
    var pos = [], neg = [], i;
    for (i = 0; i < ch.length; i++) {
      if (ch[i].att !== a) continue;
      (ch[i].side < 0 ? neg : pos).push(ch[i]);
    }
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.globalCompositeOperation = a.node.color.add ? 'lighter' : 'source-over';
    [pos, neg].forEach(function (g) {
      g.sort(function (p, q) { return p.k - q.k; });
      var ring = a.pattern === 'ring' && g.length > 2;
      for (var j = 0; j < g.length - (ring ? 0 : 1); j++) {
        var A = g[j], B = g[(j + 1) % g.length];
        // a torn membrane stays torn
        if (B.k - A.k === 1 || (ring && A.k === a.count - 1 && B.k === 0)) webPair(ctx, A, B, a.web);
      }
    });
  }
}

function drawEye(ctx, s, flash) {
  var n = s.n, er = s.def.width * s.scale;
  drawLine(ctx, s, flash, Math.max(0.35, er * 0.45));
  var ex = s.x[n], ey = s.y[n];
  ctx.fillStyle = '#05060c';
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
  ctx.lineWidth = er * 0.3;
  ctx.strokeStyle = flash ? '#ffffff' : s.cols[n];
  ctx.beginPath(); ctx.arc(ex, ey, er * 0.78, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(ex - er * 0.3, ey - er * 0.3, er * 0.26, 0, TAU); ctx.fill();
}

function inView(b, v) {
  return !v || !(b[2] < v[0] || b[0] > v[2] || b[3] < v[1] || b[1] > v[3]);
}

function drawSelf(ctx, s, o) {
  var d = s.def, flash = s.flash > 0;
  // "lit" pass: only what makes its own light (translucent additive parts, glowing parts)
  if (o.lit && !(d.color.add || d.color.glow !== 'none')) return;
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  ctx.globalCompositeOperation = d.color.add ? 'lighter' : 'source-over';
  switch (d.style) {
    case 'ribbon': drawRibbon(ctx, s, flash); break;
    case 'plates': drawPlates(ctx, s, flash); break;
    case 'line': drawLine(ctx, s, flash); break;
    case 'eye': drawEye(ctx, s, flash); break;
    default: drawDiscs(ctx, s, flash);
  }
}

// parts attached "behind" are drawn before their parent, the others after
function drawSeg(ctx, s, o) {
  o = o || {};
  var ch = s.children, i;
  drawWebs(ctx, s, false, o);
  for (i = 0; i < ch.length; i++) if (!ch[i].att.front) drawSeg(ctx, ch[i], o);
  if (inView(s.box, o.view)) drawSelf(ctx, s, o);
  drawWebs(ctx, s, true, o);
  for (i = 0; i < ch.length; i++) if (ch[i].att.front) drawSeg(ctx, ch[i], o);
  if (!s.parent) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawEyes(ctx, cr, bright) {
  var e = cr.spec.eyes;
  if (!e.on) return;
  var r = cr.root, h = cr.heading(), rad = r.rad[0] * (1 + r.pulse * 0);
  var fx = Math.cos(h), fy = Math.sin(h), px = -fy, py = fx, er = Math.max(0.8, rad * 0.27 * e.size);
  var sp = e.spread === undefined ? 0.55 : e.spread, fw = e.fwd === undefined ? 0.35 : e.fwd;
  for (var sd = -1; sd <= 1; sd += 2) {
    var ex = r.x[0] + fx * rad * fw + px * rad * sp * sd,
        ey = r.y[0] + fy * rad * fw + py * rad * sp * sd;
    ctx.fillStyle = bright ? '#eafffb' : 'rgba(255,244,228,0.9)';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = '#02060c';
    ctx.beginPath(); ctx.arc(ex + fx * er * 0.3, ey + fy * er * 0.3, er * 0.5, 0, TAU); ctx.fill();
  }
}

function draw(ctx, cr, o) {
  o = o || {};
  drawSeg(ctx, cr.root, o);
  if (o.lit) return;
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  drawEyes(ctx, cr, o.bright);
  ctx.globalAlpha = 1;
}

// calls fn(x, y, size, hue, alpha) for every glowing point
function eachGlow(list, fn, view) {
  for (var i = 0; i < list.length; i++) {
    var s = list[i], g = s.def.color.glow;
    if (g === 'none' || !g || !inView(s.box, view)) continue;
    if (g === 'tip') {
      fn(s.x[s.n], s.y[s.n], 8 + s.rad[s.n] * 8, s.hue, 0.85);
    } else {
      var step = Math.max(1, Math.round(s.n / 5));
      for (var k = 0; k <= s.n; k += step) fn(s.x[k], s.y[k], 6 + s.rad[k] * 3, s.hue, 0.14);
    }
  }
}

// editor overlay: thin skeleton + highlighted part
function drawSkeleton(ctx, cr, selected, zoom, full) {
  var lw = 1 / zoom;
  cr.list.forEach(function (s) {
    var sel = s.def === selected;
    if (!full && !sel) return;
    ctx.lineWidth = sel ? 1.6 * lw : lw;
    ctx.strokeStyle = sel ? 'rgba(255,214,110,0.95)' : 'rgba(220,255,250,0.35)';
    ctx.beginPath();
    ctx.moveTo(s.x[0], s.y[0]);
    for (var i = 1; i <= s.n; i++) ctx.lineTo(s.x[i], s.y[i]);
    ctx.stroke();
    ctx.fillStyle = sel ? 'rgba(255,214,110,0.95)' : 'rgba(220,255,250,0.5)';
    for (var j = 0; j <= s.n; j++) {
      ctx.beginPath();
      ctx.arc(s.x[j], s.y[j], (j === 0 ? 2.4 : 1.3) * lw * (sel ? 1.4 : 1), 0, TAU);
      ctx.fill();
    }
  });
}

// part under a point, preferring small / deep parts
function pick(cr, x, y, tol) {
  var best = null, bs = Infinity;
  cr.list.forEach(function (s) {
    var b = s.box;
    if (x < b[0] - tol || x > b[2] + tol || y < b[1] - tol || y > b[3] + tol) return;
    for (var i = 0; i <= s.n; i++) {
      var d = Math.hypot(s.x[i] - x, s.y[i] - y) - s.rad[i];
      if (d < tol) {
        var score = Math.max(0, d) - s.depth * 1.5 + s.maxRad * 0.2;
        if (score < bs) { bs = score; best = s; }
      }
    }
  });
  return best;
}

function stats(sp) {
  var cr = new Creature(sp, 0, 0, { phase: 0 }), nodes = 0, depth = 0;
  cr.list.forEach(function (s) { nodes += s.n + 1; if (s.depth > depth) depth = s.depth; });
  return { chains: cr.list.length, nodes: nodes, depth: depth + 1 };
}

// static portrait: swims a moment so that parts trail, then fits the canvas
function snapshot(sp, canvas, o) {
  o = o || {};
  var cr = new Creature(sp, 0, 0, { dir: 0, phase: 0 });
  for (var t = 0; t < 80; t++) cr.update(t * STEP, -1.3, 0, 0.25);
  var b = cr.box, dpr = Math.min(2, global.devicePixelRatio || 1);
  var w = canvas.clientWidth || o.w || 120, h = canvas.clientHeight || o.h || 80;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  var ctx = canvas.getContext('2d'), pad = o.pad === undefined ? 6 : o.pad;
  var k = Math.min((w - pad * 2) / (b[2] - b[0] || 1), (h - pad * 2) / (b[3] - b[1] || 1), o.max || 4);
  ctx.setTransform(k * dpr, 0, 0, k * dpr, dpr * (w / 2 - (b[0] + b[2]) / 2 * k), dpr * (h / 2 - (b[1] + b[3]) / 2 * k));
  ctx.clearRect(b[0] - 50, b[1] - 50, b[2] - b[0] + 100, b[3] - b[1] + 100);
  draw(ctx, cr, {});
}

// ----- genes (game): a live part becomes a definition again ----- //

function scaleNode(d, k) {
  d.len *= k;
  d.width *= k;
  d.attach.forEach(function (a) { scaleNode(a.node, k); });
}

function geneFromSeg(s) {
  var alive = s.children.map(function (c) { return c.att; });
  var d = clone(s.def);
  d.attach = d.attach.filter(function (a, i) { return alive.indexOf(s.def.attach[i]) >= 0; });
  scaleNode(d, s.scale);
  return node(d);
}

function nodeDepth(d) {
  var m = 0;
  d.attach.forEach(function (a) { m = Math.max(m, nodeDepth(a.node)); });
  return 1 + m;
}

function nodeTitle(d) {
  var names = [];
  d.attach.forEach(function (a) {
    walkNodes(a.node, function (x) { if (names.indexOf(x.name) < 0) names.push(x.name); });
  });
  return d.name + (names.length ? ' + ' + names.join(' + ') : '');
}

// ----- variations that keep the structure ----- //

function mutate(sp, amt) {
  var s = spec(clone(sp));
  amt = amt === undefined ? 1 : amt;
  s.palette.hue = ((s.palette.hue + rand(-30, 30) * amt) % 360 + 360) % 360;
  s.palette.light = clamp(s.palette.light + rand(-6, 6) * amt, 25, 80);
  walkNodes(s.body, function (n, depth, a) {
    n.len *= 1 + rand(-0.14, 0.14) * amt;
    n.width *= 1 + rand(-0.14, 0.14) * amt;
    n.curl += rand(-0.25, 0.25) * amt;
    if (Math.random() < 0.2 * amt) n.links = Math.max(1, n.links + (Math.random() < 0.5 ? -1 : 1));
    n.color.shift += rand(-10, 10) * amt;
    if (a) {
      a.angle += rand(-0.12, 0.12) * amt;
      if ((a.pattern === 'fan' || a.pattern === 'series') && Math.random() < 0.3 * amt) {
        a.count = Math.max(1, a.count + (Math.random() < 0.5 ? -1 : 1));
      }
    }
  });
  return s;
}

function randomPalette() {
  var h = Object.keys(HARMONIES);
  return { hue: Math.round(rand(0, 360)), harmony: h[Math.floor(Math.random() * h.length)], sat: Math.round(rand(55, 85)), light: Math.round(rand(45, 65)) };
}

// ----- water: bodies push the water and each other ----- //
// Every moving node leaves a wake (nearby nodes are dragged along with its
// speed) and pushes away what it touches. Nodes are sorted in a grid so only
// neighbours are compared.

function Flow(cell) {
  this.cell = cell || 32;
  this.cells = new Map();
  this.pool = [];
  this.used = 0;
}

Flow.prototype.clear = function () {
  this.cells.clear();
  this.used = 0;
};

Flow.prototype.key = function (cx, cy) { return cx * 73856093 ^ cy * 19349663; };

Flow.prototype.add = function (cr) {
  var list = cr.list, c = this.cell;
  for (var si = 0; si < list.length; si++) {
    var s = list[si];
    if (s.creatureCut) continue;
    var step = s.n > 12 ? 2 : 1;
    for (var i = 0; i <= s.n; i += step) {
      var e = this.pool[this.used] || (this.pool[this.used] = {});
      this.used++;
      e.x = s.x[i]; e.y = s.y[i];
      e.vx = s.x[i] - s.ox[i]; e.vy = s.y[i] - s.oy[i];
      e.r = s.rad[i] * (1 + s.pulse) + (step > 1 ? s.len * 0.5 : 0);
      e.owner = cr;
      var k = this.key(Math.floor(e.x / c), Math.floor(e.y / c)), b = this.cells.get(k);
      if (!b) { b = []; this.cells.set(k, b); }
      b.push(e);
    }
  }
};

// o.push: contact strength, o.wake: how much the water drags along,
// o.body: how much contacts on the trunk move the whole creature.
// The wake is a weighted average of the neighbours' speeds (never a sum,
// or a school crossing kelp would add up dozens of pushes), and the contact
// correction is capped: nothing can gain energy from the water.
Flow.prototype.apply = function (cr, o) {
  var list = cr.list, c = this.cell, push = o.push, wake = o.wake, body = o.body || 0;
  var reachW = o.reach || 14;
  for (var si = 0; si < list.length; si++) {
    var s = list[si];
    if (s.creatureCut) continue;
    for (var i = 1; i <= s.n; i++) {
      var x = s.x[i], y = s.y[i], r = s.rad[i];
      var cx = Math.floor(x / c), cy = Math.floor(y / c);
      var W = 0, wvx = 0, wvy = 0, px = 0, py = 0;
      for (var gx = cx - 1; gx <= cx + 1; gx++) {
        for (var gy = cy - 1; gy <= cy + 1; gy++) {
          var b = this.cells.get(this.key(gx, gy));
          if (!b) continue;
          for (var j = 0; j < b.length; j++) {
            var e = b[j];
            if (e.owner === cr) continue;
            var dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy, reach = e.r + r + reachW;
            if (d2 > reach * reach) continue;
            var d = Math.sqrt(d2) || 0.001, f = 1 - d / reach;
            W += f; wvx += e.vx * f; wvy += e.vy * f;
            var over = e.r + r - d;
            if (over > 0) { px += dx / d * over; py += dy / d * over; }
          }
        }
      }
      if (!W) continue;
      var vx = x - s.ox[i], vy = y - s.oy[i], k = wake * Math.min(1, W);
      var mx = (wvx / W - vx) * k, my = (wvy / W - vy) * k;
      var pm = Math.hypot(px, py), cap = r + 2;
      if (pm > cap) { px *= cap / pm; py *= cap / pm; }
      mx += px * push; my += py * push;
      if (body && s.depth === 0 && pm) { cr.vx += px * body; cr.vy += py * body; }
      s.x[i] = x + mx; s.y[i] = y + my;
    }
  }
};

// let a freshly built creature settle in its rest pose before it is shown
function settle(cr, steps) {
  for (var t = 0; t < (steps || 420); t++) cr.update(t * STEP, 0, 0, 1);
  cr.list.forEach(function (s) {
    for (var i = 0; i <= s.n; i++) { s.ox[i] = s.x[i]; s.oy[i] = s.y[i]; }
  });
}

global.HydraEngine = {
  TAU: TAU, STEP: STEP,
  clamp: clamp, lerp: lerp, rand: rand, clone: clone, wrapAngle: wrapAngle,
  SHAPES: SHAPES, NAMES: NAMES, ROLE_HELP: ROLE_HELP, HARMONIES: HARMONIES,
  node: node, att: att, spec: spec, walkNodes: walkNodes, palette: palette, expand: expand, hash: hash, assign: assign,
  Seg: Seg, Creature: Creature, swimFactor: swimFactor,
  draw: draw, drawSeg: drawSeg, eachGlow: eachGlow, drawSkeleton: drawSkeleton, pick: pick,
  stats: stats, snapshot: snapshot, mutate: mutate, randomPalette: randomPalette,
  geneFromSeg: geneFromSeg, nodeDepth: nodeDepth, nodeTitle: nodeTitle,
  Flow: Flow, settle: settle
};

})(window);
