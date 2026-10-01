import { describe, expect, it } from 'vitest';
import { gpuBound } from './qualite';

describe('who keeps the frames waiting', () => {
  it('is the GPU when the processor is done well before the frame', () => {
    expect(gpuBound(33, 12)).toBe(true);
    expect(gpuBound(50, 30)).toBe(true);
  });

  it('is the processor when it takes most of the frame (a lower resolution would gain nothing)', () => {
    expect(gpuBound(33, 30)).toBe(false);
    expect(gpuBound(50, 45)).toBe(false);
    expect(gpuBound(40, 30)).toBe(false);
  });
});
