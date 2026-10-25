import { describe, expect, it } from 'vitest';
import { minDistanceForScale, wheelZoomSpeed } from './viewScale';

describe('wheelZoomSpeed', () => {
  it('scales with the scrolled distance', () => {
    expect(wheelZoomSpeed({ deltaY: 100 })).toBeCloseTo(1);
    expect(wheelZoomSpeed({ deltaY: -10 })).toBeCloseTo(0.1);
  });

  it('adds up to the same zoom for one big or many small events', () => {
    const one = 0.95 ** wheelZoomSpeed({ deltaY: 100 });
    const many = (0.95 ** wheelZoomSpeed({ deltaY: 10 })) ** 10;
    expect(many).toBeCloseTo(one);
  });

  it('normalises line and page deltas to pixels', () => {
    expect(wheelZoomSpeed({ deltaY: 3, deltaMode: 1 })).toBeCloseTo(0.48);
    expect(wheelZoomSpeed({ deltaY: 1, deltaMode: 2 })).toBeCloseTo(1);
  });

  it('caps a single event', () => {
    expect(wheelZoomSpeed({ deltaY: 5000 })).toBe(2);
  });
});

describe('minDistanceForScale', () => {
  it('keeps an object at the target at the requested pixels per millimetre', () => {
    const fov = 35;
    const height = 1200;
    const d = minDistanceForScale(fov, height, 6);
    const visibleMm = 2 * d * Math.tan((fov * Math.PI) / 360);
    expect(height / visibleMm).toBeCloseTo(6);
  });
});
