// The lens of the water that bends (ondes.ts), in two passes of one shader over the regions of the screen where the
// water bends. Bend: in the middle of the frame, once what lies behind the swimming plane is painted, those regions
// are copied into a texture and drawn again with each pixel moved (the rings, the flows, the field of waves of
// ondes-champ.ts); what is painted after, the swimmer and what swims near it, stays sharp. Shine: at the end of the
// frame, the light the crests catch is added over everything, the dark of the deep included. With nothing to bend,
// nothing is done: the frame costs what it cost.
//
// The copy reads the screen itself (copyTexSubImage2D from the drawing buffer, multisampled or not): the scene is
// drawn as before, with its antialiasing. The page's canvas has no alpha, so the texture is RGB (an RGBA one cannot
// be copied into from it, nor blitted into from a multisampled buffer).

import type { Flow, Rect, Ripple } from './ondes';

/** the most rings and flows bent at once */
export const MAX_RINGS = 12, MAX_FLOWS = 8;

/** the field of waves as the lens reads it: its texture (slope, curvature) and where it lies in the world */
export interface FieldView {
  /** packed by ondes-champ.ts: r, g the slope, b the curvature (128 is flat) */
  data: Uint8Array; nx: number; ny: number;
  /** world px per cell, the first cell of its window (world cells) */
  cell: number; ox: number; oy: number;
  /** how far a slope of 1 moves the scene (css px), how much light its crests catch, in this colour */
  amp: number; glint: number; rgb: readonly number[];
}

/** the camera, for the point of the swimming plane under each pixel (engine3/view.ts) */
export interface Cam { W: number; H: number; f: number; cx: number; cy: number; cz: number; pitch: number; }

/** what a pass draws: the regions (device px, ondes.regions), the ripples and flows (css px), the field if any */
export interface Scene { rects: readonly Rect[]; ripples: readonly Ripple[]; flows: readonly Flow[]; field: FieldView | null; cam: Cam; dpr: number; t: number; }

const VS = `#version 300 es
in vec2 aPos;
uniform vec2 uSize;
void main() { gl_Position = vec4(aPos.x / uSize.x * 2.0 - 1.0, 1.0 - aPos.y / uSize.y * 2.0, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
#define MAXR ${MAX_RINGS}
#define MAXF ${MAX_FLOWS}
uniform sampler2D uSrc;
uniform vec2 uSize;
uniform float uDpr, uT;
uniform vec4 uBox;
uniform int uPass, uNR, uNF, uField;
uniform vec4 uRa[MAXR], uRb[MAXR];
uniform vec3 uRc[MAXR];
uniform vec4 uFa[MAXF], uFb[MAXF], uFc[MAXF], uFd[MAXF], uFe[MAXF];
uniform sampler2D uH;
uniform vec4 uHa, uHb, uHc, uVa, uVb;
out vec4 o;
float soft(float u, float e) { float k = clamp(min(u, 1.0 - u) / max(e, 1e-4), 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }
void main() {
  // css px, from the top left
  vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uDpr;
  vec2 d = vec2(0.0);
  vec3 light = vec3(0.0), glow = vec3(0.0);
  float shade = 0.0;
  // rings: a packet of crests around the radius, moving the scene along it; brighter where it gathers the light,
  // darker where it spreads it
  for (int i = 0; i < MAXR; i++) {
    if (i >= uNR) break;
    vec2 v = p - uRa[i].xy;
    float r = length(v), x = (r - uRa[i].z) / uRa[i].w;
    if (abs(x) > 2.4) continue;
    float k = 1.2566 * uRb[i].z, e = exp(-1.2 * x * x), s = sin(k * x), c = cos(k * x);
    float g = clamp(-(k * c - 2.4 * x * s) * e / k, -1.0, 1.0);
    d += v / max(r, 1.0) * (s * e * uRb[i].x);
    glow += uRc[i] * (max(g, 0.0) * uRb[i].y);
    shade += g * uRb[i].w;
  }
  if (uPass == 1) { o = vec4(glow, 0.0); return; }
  // flows: a band where the pattern streams along, in puffs, moving the scene mostly across it; where it squeezes
  // the scene, the light gathers in streaks (as over hot water)
  for (int i = 0; i < MAXF; i++) {
    if (i >= uNF) break;
    vec2 u = uFa[i].zw, n = vec2(-u.y, u.x), q = p - uFa[i].xy;
    float a = dot(q, u), b = dot(q, n), a01 = a / uFb[i].x;
    if (a01 < 0.0 || a01 > 1.0) continue;
    float hw = uFb[i].y * mix(1.0, uFb[i].z, a01), b01 = b / hw * 0.5 + 0.5;
    if (b01 < 0.0 || b01 > 1.0) continue;
    float ramp = uFc[i].w, m = soft(a01, uFd[i].y) * soft(b01, uFd[i].z) * mix(1.0, 1.0 - a01, uFb[i].w) * mix(1.0, ramp >= 0.0 ? b01 : 1.0 - b01, abs(ramp));
    float L = uFc[i].y, a1 = a - uFc[i].z * uT, ph = 6.2832 * a1 / L, sd = uFd[i].x, kb = 6.2832 / (L * 2.3), kc = 6.2832 / (L * 1.1);
    m *= 0.3 + 0.35 * (1.0 + sin(6.2832 * (a1 + 0.4 * uFc[i].z * uT) / (L * 6.0) + 2.0 * sin(6.2832 * b / (L * 5.0) + sd)));
    float pb = kb * b + uT * 1.3 + sd, pc = kc * b - uT * 0.7 + sd * 1.7, p1 = ph + 1.7 * sin(pb), p2 = 1.93 * ph + 0.9 * sin(pc);
    float w1 = sin(p1) + 0.45 * sin(p2), w2 = cos(0.71 * ph + 6.2832 * b / (L * 1.6) + sd);
    float g = clamp(-(cos(p1) * 1.7 * kb * cos(pb) + 0.405 * kc * cos(p2) * cos(pc)) * uFc[i].x * m, -1.0, 1.0);
    d += (n * w1 + u * (0.35 * w2)) * (uFc[i].x * m);
    light += uFe[i].rgb * (max(g, 0.0) * uFe[i].a);
    shade += g * uFd[i].w;
  }
  // the field of waves on the swimming plane, read under the pixel
  if (uField == 1) {
    float xn = (p.x - uVa.x) / uVa.z, yn = (p.y - uVa.y) / uVa.z, dz = uHb.z - yn * uHb.w;
    if (dz > 0.001) {
      float t = -uVb.z / dz;
      vec2 w = vec2(uVb.x + xn * t, uVb.y + t * (yn * uHb.z + uHb.w)) / uHa.x, rel = (w - uHa.yz) / uHb.xy;
      float edge = smoothstep(0.0, 0.08, min(min(rel.x, 1.0 - rel.x), min(rel.y, 1.0 - rel.y)));
      vec4 g = texture(uH, w / uHb.xy);
      float bend = clamp(1.0 - g.b * 2.0, -1.0, 1.0) * edge;
      d += (g.rg * 2.0 - 1.0) * (uHa.w * edge);
      light += uHc.rgb * (max(bend, 0.0) * uHc.a);
      shade += bend * uHc.a * 0.5;
    }
  }
  vec2 sp = clamp((p + d) * uDpr, uBox.xy + 0.5, uBox.zw - 0.5);
  o = vec4(texture(uSrc, vec2(sp.x, uSize.y - sp.y) / uSize).rgb * (1.0 + shade) + light, 1.0);
}`;

export function createLens(gl: WebGL2RenderingContext) {
  let prog: WebGLProgram | null = null, vao: WebGLVertexArrayObject | null = null, vbo: WebGLBuffer | null = null;
  let src: WebGLTexture | null = null, srcFb: WebGLFramebuffer | null = null, fieldTex: WebGLTexture | null = null, blit = true, checked = false;
  let srcW = 0, srcH = 0, fieldW = 0, fieldH = 0, broken = false;
  const U: Record<string, WebGLUniformLocation | null> = {};
  const quad = new Float32Array(8);
  const ra = new Float32Array(MAX_RINGS * 4), rb = new Float32Array(MAX_RINGS * 4), rc = new Float32Array(MAX_RINGS * 3);
  const fa = new Float32Array(MAX_FLOWS * 4), fb = new Float32Array(MAX_FLOWS * 4), fc = new Float32Array(MAX_FLOWS * 4), fd = new Float32Array(MAX_FLOWS * 4), fe = new Float32Array(MAX_FLOWS * 4);
  // the time the GPU spends in each pass (EXT_disjoint_timer_query_webgl2), when measured
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const pending: [WebGLQuery, 0 | 1][] = [];

  function init(): void {
    const sh = (type: number, s: string) => {
      const o = gl.createShader(type)!;
      gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'shader');
      return o;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    prog = p;
    for (const n of ['uSrc', 'uSize', 'uDpr', 'uT', 'uBox', 'uPass', 'uNR', 'uNF', 'uField', 'uRa', 'uRb', 'uRc', 'uFa', 'uFb', 'uFc', 'uFd', 'uFe', 'uH', 'uHa', 'uHb', 'uHc', 'uVa', 'uVb']) U[n] = gl.getUniformLocation(p, n);
    vao = gl.createVertexArray(); vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    src = fieldTex = srcFb = null; srcW = srcH = fieldW = fieldH = 0;
    pending.length = 0;
  }
  try { init(); } catch (e) { console.warn('the water stays still', e); broken = true; }
  (gl.canvas as HTMLCanvasElement).addEventListener?.('webglcontextrestored', () => { try { init(); broken = false; } catch { broken = true; } });

  function texture(repeat: boolean): WebGLTexture {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  function readTimer(): void {
    while (pending.length) {
      const [q, pass] = pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ms = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6;
      if (!gl.getParameter(timer!.GPU_DISJOINT_EXT)) lens.gpu[pass] = lens.gpu[pass] * 0.9 + ms * 0.1;
      gl.deleteQuery(q);
      pending.shift();
    }
  }

  /** the uniforms of a scene, the field's texture bound to unit 1 (uploaded when `upload`) */
  function setup(s: Scene, pass: 0 | 1, w: number, h: number, upload: boolean): void {
    gl.useProgram(prog);
    gl.uniform1i(U.uSrc, 0);
    gl.uniform2f(U.uSize, w, h);
    gl.uniform1f(U.uDpr, s.dpr);
    gl.uniform1f(U.uT, s.t % 600);
    gl.uniform1i(U.uPass, pass);
    const nr = Math.min(MAX_RINGS, s.ripples.length), nf = Math.min(MAX_FLOWS, s.flows.length);
    for (let i = 0; i < nr; i++) {
      const p = s.ripples[i];
      ra.set([p.x, p.y, p.r, Math.max(1, p.w)], i * 4); rb.set([p.amp, p.glint, p.crests, p.shade], i * 4); rc.set([p.rgb[0], p.rgb[1], p.rgb[2]], i * 3);
    }
    for (let i = 0; i < nf; i++) {
      const f = s.flows[i];
      fa.set([f.x, f.y, f.ux, f.uy], i * 4); fb.set([Math.max(1, f.len), Math.max(1, f.hw), f.widen, f.fade], i * 4);
      fc.set([f.amp, Math.max(1, f.lambda), f.speed, f.ramp], i * 4); fd.set([f.seed, f.softA, f.softB, f.shade], i * 4);
      fe.set([f.rgb[0], f.rgb[1], f.rgb[2], f.glint], i * 4);
    }
    gl.uniform1i(U.uNR, nr); gl.uniform1i(U.uNF, nf);
    if (nr) { gl.uniform4fv(U.uRa, ra); gl.uniform4fv(U.uRb, rb); gl.uniform3fv(U.uRc, rc); }
    if (nf) { gl.uniform4fv(U.uFa, fa); gl.uniform4fv(U.uFb, fb); gl.uniform4fv(U.uFc, fc); gl.uniform4fv(U.uFd, fd); gl.uniform4fv(U.uFe, fe); }
    const f = s.field;
    gl.uniform1i(U.uField, f ? 1 : 0);
    if (!f) return;
    gl.activeTexture(gl.TEXTURE1);
    if (!fieldTex || fieldW !== f.nx || fieldH !== f.ny) {
      if (fieldTex) gl.deleteTexture(fieldTex);
      fieldTex = texture(true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.nx, f.ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      fieldW = f.nx; fieldH = f.ny; upload = true;
    } else gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    if (upload) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.nx, f.ny, gl.RGBA, gl.UNSIGNED_BYTE, f.data);
    }
    gl.uniform1i(U.uH, 1);
    gl.uniform4f(U.uHa, f.cell, f.ox, f.oy, f.amp);
    gl.uniform4f(U.uHb, f.nx, f.ny, Math.cos(s.cam.pitch), Math.sin(s.cam.pitch));
    gl.uniform4f(U.uHc, f.rgb[0], f.rgb[1], f.rgb[2], f.glint);
    gl.uniform4f(U.uVa, s.cam.W / 2, s.cam.H / 2, s.cam.f, 0);
    gl.uniform4f(U.uVb, s.cam.cx, s.cam.cy, s.cam.cz, 0);
    gl.activeTexture(gl.TEXTURE0);
  }

  function quads(rects: readonly Rect[]): void {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    for (const r of rects) {
      quad.set([r.x0, r.y0, r.x1, r.y0, r.x0, r.y1, r.x1, r.y1]);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, quad);
      gl.uniform4f(U.uBox, r.x0, r.y0, r.x1, r.y1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindVertexArray(null);
  }

  function query(pass: 0 | 1): WebGLQuery | null {
    if (!timer || !lens.timing) return null;
    readTimer();
    if (pending.length > 6) return null;
    const q = gl.createQuery()!;
    gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    pending.push([q, pass]);
    return q;
  }

  const lens = {
    /** while `timing` is on, the GPU time of each pass (bend, shine; ms, averaged); the pixels bent in the last frame */
    gpu: [0, 0], timing: false, pixels: 0,
    get ok() { return !broken; },
    /**
     * Bends the screen (device w × h) over the regions of the scene: in the middle of a frame (the painter's batch
     * sent first), its state put back as it was.
     */
    bend(s: Scene, w: number, h: number): void {
      lens.pixels = 0;
      if (broken || !prog || gl.isContextLost() || !s.rects.length) return;
      const prevProg = gl.getParameter(gl.CURRENT_PROGRAM), prevActive = gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0);
      const prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D);
      const q = query(0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      if (!src || srcW !== w || srcH !== h) {
        if (src) gl.deleteTexture(src);
        if (srcFb) gl.deleteFramebuffer(srcFb);
        src = texture(false);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB8, w, h);
        srcFb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, srcFb);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, src, 0);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        srcW = w; srcH = h;
      } else gl.bindTexture(gl.TEXTURE_2D, src);
      // every region is read before any is drawn: where two effects meet, each reads the scene, not the other. A blit
      // where it is allowed (cheaper than a copy from a multisampled screen, measured), else a copy
      if (blit) {
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, srcFb);
        for (const r of s.rects) gl.blitFramebuffer(r.x0, h - r.y1, r.x1, h - r.y0, r.x0, h - r.y1, r.x1, h - r.y0, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // the first time only: a screen whose format differs refuses it
        if (!checked) { checked = true; if (gl.getError()) blit = false; }
      }
      if (!blit) for (const r of s.rects) gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, r.x0, h - r.y1, r.x0, h - r.y1, r.x1 - r.x0, r.y1 - r.y0);
      for (const r of s.rects) lens.pixels += (r.x1 - r.x0) * (r.y1 - r.y0);
      setup(s, 0, w, h, true);
      quads(s.rects);
      if (q) gl.endQuery(timer!.TIME_ELAPSED_EXT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
      gl.useProgram(prevProg);
      gl.bindTexture(gl.TEXTURE_2D, prevTex);
      gl.activeTexture(prevActive);
    },
    /** adds the light the crests of the rings catch, over the whole frame drawn (after the painter's last batch) */
    shine(s: Scene, w: number, h: number): void {
      if (broken || !prog || gl.isContextLost() || !s.rects.length) return;
      const q = query(1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      setup(s, 1, w, h, false);
      quads(s.rects);
      if (q) gl.endQuery(timer!.TIME_ELAPSED_EXT);
      // as the painter (engine3/gfx.ts) left them; it sets the rest again at the start of each frame
      gl.enable(gl.DEPTH_TEST);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  };
  return lens;
}

export type Lens = ReturnType<typeof createLens>;
