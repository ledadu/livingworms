// A creature drawn by the 2D renderer (the same look as the 2D version), shown
// in the 3D world as a card standing in its own vertical plane. The card is
// redrawn when the creature moves; the canvas only grows, the texture shows
// the part in use.

import * as THREE from 'three';
import { draw, type Creature } from '../engine';

const MAX = 1024;

export class Card {
  cr: Creature;
  z: number;
  mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private k = 0;
  /** resolution the card was last drawn at (px per world unit) */
  drawnK = 0;
  alive = false;

  constructor(cr: Creature, z: number, geo: THREE.PlaneGeometry) {
    this.cr = cr;
    this.z = z;
    this.canvas.width = this.canvas.height = 4;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    // the swimming plane stays crisp; planes further back fade into the water
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, fog: z < -60, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** draw the creature at k px per world unit and place the card */
  paint(k: number): void {
    const b = this.cr.box, pad = 6;
    const x0 = b[0] - pad, y0 = b[1] - pad, w = b[2] - b[0] + pad * 2, h = b[3] - b[1] + pad * 2;
    k = Math.min(k, MAX / Math.max(w, h));
    const cw = Math.max(2, Math.ceil(w * k)), ch = Math.max(2, Math.ceil(h * k));
    const c = this.canvas;
    if (cw > c.width || ch > c.height) {
      // grow in steps so the texture is not reallocated every frame
      c.width = Math.min(MAX, Math.max(c.width, Math.ceil((cw * 1.25) / 32) * 32));
      c.height = Math.min(MAX, Math.max(c.height, Math.ceil((ch * 1.25) / 32) * 32));
      this.tex.dispose();
      this.tex.image = c;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, Math.min(c.width, cw + 2), Math.min(c.height, ch + 2));
    ctx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    draw(ctx, this.cr, { ink: true });
    this.tex.repeat.set(cw / c.width, ch / c.height);
    this.tex.offset.set(0, 1 - ch / c.height);
    this.tex.needsUpdate = true;
    // engine y grows downward, world y upward
    this.mesh.position.set(x0 + w / 2, -(y0 + h / 2), this.z);
    this.mesh.scale.set(cw / k, ch / k, 1);
    this.mesh.visible = true;
    this.k = k;
    this.drawnK = k;
    this.alive = true;
  }

  /** free the canvas memory when the card is far away */
  sleep(): void {
    if (!this.alive) return;
    this.canvas.width = this.canvas.height = 4;
    this.tex.dispose();
    this.tex.image = this.canvas;
    this.mesh.visible = false;
    this.alive = false;
    this.drawnK = 0;
  }

  get resolution(): number { return this.k; }
}

export const cardGeometry = new THREE.PlaneGeometry(1, 1);
