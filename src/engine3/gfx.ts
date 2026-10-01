// A small immediate-mode 2D renderer on WebGL2, for the 2.5D line. On an
// accelerated 2D canvas every path has a fixed price (measured: about 40 µs on
// an Intel Iris Xe, whatever its size); here the shapes are turned into
// triangles by us and go to the GPU in a few draw calls per frame.
//
// Painter's order is kept by the order of submission; every shape also gets its
// own depth, decreasing along the frame, with the depth test on: a pixel is
// painted at most once per shape, so a translucent ribbon that folds over
// itself looks like a canvas fill (one coverage), not darker at the fold.
//
// Coordinates are in the user space of the current transform (like a canvas);
// colours are premultiplied, packed in 4 bytes per vertex.

type Canvas = HTMLCanvasElement | OffscreenCanvas;

const VS = `#version 300 es
in vec3 aPos; in vec4 aCol; in vec2 aUV; in float aMode;
uniform vec2 uSize;
out vec4 vCol; out vec2 vUV; out float vY; flat out int vMode;
void main() {
  vec2 c = aPos.xy / uSize * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, aPos.z * 2.0 - 1.0, 1.0);
  vCol = aCol; vUV = aUV; vY = aPos.y; vMode = int(aMode + 0.5);
}`;

const FS = `#version 300 es
precision mediump float;
in vec4 vCol; in vec2 vUV; in float vY; flat in int vMode;
uniform sampler2D uTex;
out vec4 o;
void main() {
  if (vMode == 1) o = texture(uTex, vUV) * vCol;
  else if (vMode == 2) {
    // light from above over a body: the canvas gradient of shadeBody, on the screen height of its box (uv = y0, y1)
    float t = clamp((vY - vUV.x) / max(1.0, vUV.y - vUV.x), 0.0, 1.0);
    vec4 a = vec4(1.0, 1.0, 1.0, 0.34), b = vec4(1.0, 1.0, 1.0, 0.0), c = vec4(6.0 / 255.0, 18.0 / 255.0, 40.0 / 255.0, 0.36);
    vec4 g = t < 0.42 ? mix(a, b, t / 0.42) : mix(b, c, (t - 0.42) / 0.58);
    o = vec4(g.rgb * g.a, g.a) * vCol.a;
  } else o = vCol;
}`;

const STRIDE = 28; // x y z (f32) · rgba (u8) · u v (f32) · mode (u8, 3 spare)
const ZSTEP = 1 / (1 << 22);

export type Blend = 'over' | 'add';

interface Tex { tex: WebGLTexture; w: number; h: number; stamp: number; used: number; }

export class Gfx {
  gl: WebGL2RenderingContext;
  /** device pixels */
  W = 1; H = 1;
  /** current transform, user space → device pixels */
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  /** multiplies the alpha of everything drawn */
  alpha = 1;
  /** colours are pulled toward this one (r, g, b in 0..1) by `tintAmt` (a water wash) */
  tintR = 0; tintG = 0; tintB = 0; tintAmt = 0;
  /** draw calls and triangles in the last frame */
  calls = 0; tris = 0; shapes = 0;

  private prog!: WebGLProgram;
  private uSize!: WebGLUniformLocation;
  private vao!: WebGLVertexArrayObject;
  private vbo!: WebGLBuffer;
  private ibo!: WebGLBuffer;
  private buf: ArrayBuffer;
  private fv: Float32Array;
  private uv32: Uint32Array;
  private u8: Uint8Array;
  private idx: Uint32Array;
  private nv = 0;
  private ni = 0;
  private z = 1;
  private blend: Blend = 'over';
  private tex: Tex | null = null;
  private texs = new Map<Canvas, Tex>();
  private frame = 0;
  private white!: Tex;
  private cols = new Map<string, Float32Array>();
  /** the GPU took the context away (a phone under memory pressure, a driver reset): nothing is drawn until it is back */
  lost = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.buf = new ArrayBuffer(0); this.fv = new Float32Array(0); this.uv32 = new Uint32Array(0); this.u8 = new Uint8Array(0); this.idx = new Uint32Array(0);
    this.grow(1 << 16, 1 << 18);
    this.init();
    const cv = gl.canvas as HTMLCanvasElement;
    if (cv.addEventListener) {
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
      // everything on the GPU is gone: program, buffers, textures; made again
      cv.addEventListener('webglcontextrestored', () => { this.texs.clear(); this.tex = null; this.init(); this.lost = false; });
    }
  }

  private init(): void {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aCol'); gl.bindAttribLocation(p, 2, 'aUV'); gl.bindAttribLocation(p, 3, 'aMode');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    this.prog = p;
    this.uSize = gl.getUniformLocation(p, 'uSize')!;
    this.vao = gl.createVertexArray()!;
    this.vbo = gl.createBuffer()!;
    this.ibo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, STRIDE, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, false, STRIDE, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bindVertexArray(null);
    const one = document.createElement('canvas');
    one.width = one.height = 1;
    const c2 = one.getContext('2d')!;
    c2.fillStyle = '#fff'; c2.fillRect(0, 0, 1, 1);
    this.white = this.texture(one, false);
  }

  private grow(nv: number, ni: number): void {
    const buf = new ArrayBuffer(nv * STRIDE);
    new Uint8Array(buf).set(new Uint8Array(this.buf, 0, Math.min(this.buf.byteLength, this.nv * STRIDE)));
    this.buf = buf; this.fv = new Float32Array(buf); this.uv32 = new Uint32Array(buf); this.u8 = new Uint8Array(buf);
    const idx = new Uint32Array(ni);
    idx.set(this.idx.subarray(0, this.ni));
    this.idx = idx;
  }

  resize(w: number, h: number): void { this.W = w; this.H = h; }

  /** start a frame: clear to this colour (0..1) */
  begin(r: number, g: number, b: number): void {
    const gl = this.gl;
    this.frame++;
    this.nv = this.ni = 0;
    this.calls = this.tris = this.shapes = 0;
    this.z = 1 - ZSTEP;
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(r, g, b, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.enable(gl.BLEND);
    gl.useProgram(this.prog);
    gl.uniform2f(this.uSize, this.W, this.H);
    this.applyBlend();
    this.tex = null;
    this.alpha = 1; this.tintAmt = 0;
    this.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** end a frame: draw what is left, forget the textures unused for a while (not the white one, bound without a lookup) */
  end(): void {
    this.flush();
    for (const [k, t] of this.texs) if (t !== this.white && this.frame - t.used > 240) { this.gl.deleteTexture(t.tex); this.texs.delete(k); }
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
  }

  /** the uniform scale of the current transform (device px per user unit) */
  get scale(): number { return Math.sqrt(Math.abs(this.a * this.d - this.b * this.c)); }

  setBlend(b: Blend): void {
    if (b === this.blend) return;
    this.flush();
    this.blend = b;
    this.applyBlend();
  }

  private applyBlend(): void {
    const gl = this.gl;
    if (this.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** a new shape: it gets its own depth (one coverage per pixel), nearer than all before */
  shape(): void { this.z -= ZSTEP; this.shapes++; }

  // ----- colours ----- //

  /** a css colour parsed once: r, g, b, a in 0..1 (not premultiplied) */
  css(s: string): Float32Array {
    let c = this.cols.get(s);
    if (c) return c;
    c = parseColor(s);
    if (this.cols.size > 20000) this.cols.clear();
    this.cols.set(s, c);
    return c;
  }

  /** pack a colour with the current alpha and tint, premultiplied */
  pack(r: number, g: number, b: number, a: number): number {
    const t = this.tintAmt;
    if (t > 0) { r += (this.tintR - r) * t; g += (this.tintG - g) * t; b += (this.tintB - b) * t; }
    a *= this.alpha;
    if (a <= 0) return 0;
    if (a > 1) a = 1;
    const k = a * 255;
    return ((r * k + 0.5) | 0) | (((g * k + 0.5) | 0) << 8) | (((b * k + 0.5) | 0) << 16) | (((k + 0.5) | 0) << 24);
  }
  packCss(s: string, alpha = 1): number { const c = this.css(s); return this.pack(c[0], c[1], c[2], c[3] * alpha); }

  // ----- geometry ----- //

  /** make room for nv vertices and ni indices (flushes when the buffer is full) */
  reserve(nv: number, ni: number): void {
    if (this.nv + nv <= this.fv.length * 4 / STRIDE && this.ni + ni <= this.idx.length) return;
    if (nv * 2 > this.fv.length * 4 / STRIDE || ni * 2 > this.idx.length) { this.flush(); this.grow(Math.max(nv * 2, this.fv.length * 4 / STRIDE), Math.max(ni * 2, this.idx.length)); return; }
    this.flush();
  }

  /** one vertex at user (x, y): its index */
  v(x: number, y: number, col: number, u = 0, w = 0, mode = 0): number {
    const i = this.nv++, o = i * 7;
    const fv = this.fv;
    fv[o] = this.a * x + this.c * y + this.e;
    fv[o + 1] = this.b * x + this.d * y + this.f;
    fv[o + 2] = this.z;
    this.uv32[o + 3] = col;
    fv[o + 4] = u; fv[o + 5] = w;
    this.u8[o * 4 + 24] = mode;
    return i;
  }

  /** a vertex already in device pixels */
  vd(x: number, y: number, col: number, u = 0, w = 0, mode = 0): number {
    const i = this.nv++, o = i * 7;
    const fv = this.fv;
    fv[o] = x; fv[o + 1] = y; fv[o + 2] = this.z;
    this.uv32[o + 3] = col;
    fv[o + 4] = u; fv[o + 5] = w;
    this.u8[o * 4 + 24] = mode;
    return i;
  }

  tri(i: number, j: number, k: number): void {
    const o = this.ni; this.ni += 3;
    this.idx[o] = i; this.idx[o + 1] = j; this.idx[o + 2] = k;
  }

  // ----- textures ----- //

  /** the texture of a canvas; `stamp` tells when its pixels changed (re-uploaded when it differs) */
  texture(cv: Canvas, repeat = false, stamp = 0): Tex {
    const gl = this.gl;
    if (this.lost) return this.white;
    let t = this.texs.get(cv);
    if (!t) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      t = { tex, w: 0, h: 0, stamp: stamp - 1, used: this.frame };
      this.texs.set(cv, t);
    }
    if (t.stamp !== stamp || t.w !== cv.width || t.h !== cv.height) {
      if (this.tex === t) this.flush();
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv as TexImageSource);
      t.w = cv.width; t.h = cv.height; t.stamp = stamp;
      if (this.tex) gl.bindTexture(gl.TEXTURE_2D, this.tex.tex);
    }
    t.used = this.frame;
    return t;
  }

  private bind(t: Tex): void {
    if (this.tex === t) return;
    if (this.tex && this.ni) this.flush();
    this.tex = t;
    this.gl.bindTexture(this.gl.TEXTURE_2D, t.tex);
  }

  /**
   * drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh) in the current transform,
   * multiplied by the current alpha; `stamp` changes when the canvas is redrawn.
   */
  image(cv: Canvas, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, stamp = 0, repeat = false): void {
    const t = this.texture(cv, repeat, stamp);
    this.bind(t);
    this.shape();
    this.reserve(4, 6);
    const col = this.pack(1, 1, 1, 1);
    const u0 = sx / t.w, v0 = sy / t.h, u1 = (sx + sw) / t.w, v1 = (sy + sh) / t.h;
    const i = this.v(dx, dy, col, u0, v0, 1);
    this.v(dx + dw, dy, col, u1, v0, 1);
    this.v(dx + dw, dy + dh, col, u1, v1, 1);
    this.v(dx, dy + dh, col, u0, v1, 1);
    this.tri(i, i + 1, i + 2); this.tri(i, i + 2, i + 3);
  }

  /** bind a texture for vertices in mode 1 that the caller makes (a repeated pattern) */
  useTexture(cv: Canvas, repeat = false, stamp = 0): Tex {
    const t = this.texture(cv, repeat, stamp);
    this.bind(t);
    return t;
  }

  /** send what is batched */
  flush(): void {
    if (!this.ni || this.lost) { this.nv = 0; this.ni = 0; return; }
    const gl = this.gl;
    if (!this.tex) this.bind(this.white);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.u8.subarray(0, this.nv * STRIDE), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.idx.subarray(0, this.ni), gl.STREAM_DRAW);
    gl.drawElements(gl.TRIANGLES, this.ni, gl.UNSIGNED_INT, 0);
    this.calls++; this.tris += this.ni / 3;
    this.nv = 0; this.ni = 0;
  }

  /** wait for the GPU (measures: the time of a frame includes its drawing) */
  finish(): void {
    this.flush();
    const px = new Uint8Array(4);
    this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px);
  }
}

// ----- css colours ----- //

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 30; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}

export function parseColor(s: string): Float32Array {
  const out = new Float32Array([0, 0, 0, 1]);
  s = s.trim();
  if (s[0] === '#') {
    const hex = s.length === 4 ? s.slice(1).split('').map((c) => c + c).join('') : s.slice(1, 7);
    const n = parseInt(hex, 16);
    out[0] = ((n >> 16) & 255) / 255; out[1] = ((n >> 8) & 255) / 255; out[2] = (n & 255) / 255;
    return out;
  }
  const m = /^(rgba?|hsla?)\(([^)]*)\)/.exec(s);
  if (!m) return out;
  const p = m[2].split(',').map((x) => parseFloat(x));
  if (m[1][0] === 'r') { out[0] = p[0] / 255; out[1] = p[1] / 255; out[2] = p[2] / 255; }
  else { const c = hslToRgb(p[0], p[1], p[2]); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; }
  out[3] = p.length > 3 ? p[3] : 1;
  return out;
}

/** hsl (h 0..360, s and l 0..100) to r, g, b in 0..1 */
export function hsl01(h: number, s: number, l: number): [number, number, number] { return hslToRgb(h, s, Math.max(0, Math.min(100, l))); }
