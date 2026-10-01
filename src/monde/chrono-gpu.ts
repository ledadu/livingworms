// The time the GPU spends on each frame, for the bench (?bench), where the
// browser lets us read it (EXT_disjoint_timer_query_webgl2: Chrome on a
// computer, some phones). A query runs from the start of one frame to the
// start of the next, so it holds everything the frame drew, the passes after
// the scene included; its result comes back a few frames later.

export class ChronoGpu {
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private free: WebGLQuery[] = [];
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  /** ms of GPU of the frames whose result came back, oldest first (the reader empties it) */
  readonly done: number[] = [];

  constructor(private gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  /** the browser gives the time of the GPU */
  get ok(): boolean { return !!this.ext; }

  /** a frame starts: the query of the one before ends, the results that are back are read */
  frame(): void {
    const gl = this.gl, ext = this.ext;
    if (!ext) return;
    this.close();
    this.read();
    const q = this.free.pop() ?? gl.createQuery();
    if (!q) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  /** the measure stops (the results still pending come with the next reads) */
  stop(): void {
    this.close();
    this.read();
  }

  private close(): void {
    if (!this.active || !this.ext) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  private read(): void {
    const gl = this.gl, ext = this.ext!;
    // the GPU was interrupted (power, another context): what is pending is not to be trusted
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = this.pending.shift()!;
      if (!disjoint) this.done.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      this.free.push(q);
    }
  }
}
