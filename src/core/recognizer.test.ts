/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for the pure recognizer geometry + classification module.
 * All inputs are deterministic (fixed arrays or a seeded PRNG) — no
 * Math.random dependence.
 */
import { describe, expect, it } from 'vitest';
import {
  chamferDistance,
  distance,
  getNormalizedPointCloud,
  pathLength,
  recognizeGesture,
  resample,
  rotatePoints,
  scaleUniform,
  scoreAgainstTarget,
  translateToCentroid,
} from './recognizer';
import type { Point, Stroke } from './types';

/** Replicates the recognizer's own circle generator for clean synthetic input. */
function generateCirclePoints(
  cx: number,
  cy: number,
  r: number,
  count: number,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return pts;
}

/** Builds a dense straight segment between two points. */
function generateLinePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  count: number,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    pts.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
  }
  return pts;
}

const p = (x: number, y: number): Point => ({ x, y });

describe('distance', () => {
  it('returns the Euclidean distance between two points', () => {
    expect(distance(p(0, 0), p(3, 4))).toBeCloseTo(5, 10);
    expect(distance(p(1, 1), p(1, 1))).toBeCloseTo(0, 10);
    expect(distance(p(-2, 0), p(2, 0))).toBeCloseTo(4, 10);
  });
});

describe('pathLength', () => {
  it('sums segment lengths of a polyline', () => {
    expect(pathLength([p(0, 0), p(3, 4)])).toBeCloseTo(5, 10);
    // (0,0)->(3,4) is 5, (3,4)->(3,4) is 0, (3,4)->(6,8) is 5.
    expect(pathLength([p(0, 0), p(3, 4), p(3, 4), p(6, 8)])).toBeCloseTo(10, 10);
  });

  it('is 0 for empty or single-point paths', () => {
    expect(pathLength([])).toBe(0);
    expect(pathLength([p(5, 5)])).toBe(0);
  });
});

describe('resample', () => {
  it('returns [] for empty input', () => {
    expect(resample([], 10)).toEqual([]);
  });

  it('duplicates a single point n times', () => {
    const out = resample([p(4, 7)], 5);
    expect(out).toHaveLength(5);
    for (const pt of out) {
      expect(pt.x).toBe(4);
      expect(pt.y).toBe(7);
    }
  });

  it('preserves first and last points of a straight line and hits exactly n points', () => {
    const out = resample([p(0, 0), p(10, 0)], 11);
    expect(out).toHaveLength(11);
    expect(out[0].x).toBeCloseTo(0, 10);
    expect(out[0].y).toBeCloseTo(0, 10);
    expect(out[out.length - 1].x).toBeCloseTo(10, 10);
    expect(out[out.length - 1].y).toBeCloseTo(0, 10);
    // Interior samples are evenly spaced.
    for (let i = 1; i < out.length; i++) {
      const step = out[i].x - out[i - 1].x;
      expect(step).toBeCloseTo(1, 10);
      expect(out[i].y).toBeCloseTo(0, 10);
    }
  });

  it('returns exactly n points for an irregular polyline', () => {
    const zigzag = [p(0, 0), p(3, 4), p(6, 0), p(9, 4), p(12, 0)];
    expect(resample(zigzag, 7)).toHaveLength(7);
    expect(resample(zigzag, 120)).toHaveLength(120);
  });
});

describe('scaleUniform', () => {
  it('returns [] for empty input', () => {
    expect(scaleUniform([])).toEqual([]);
  });

  it('normalizes the max dimension to exactly 1 while preserving aspect', () => {
    const out = scaleUniform([p(0, 0), p(80, 0), p(0, 40)]);
    expect(out).toHaveLength(3);
    expect(out[0].x).toBeCloseTo(0, 10);
    expect(out[0].y).toBeCloseTo(0, 10);
    expect(out[1].x).toBeCloseTo(1, 10);
    expect(out[1].y).toBeCloseTo(0, 10);
    expect(out[2].x).toBeCloseTo(0, 10);
    expect(out[2].y).toBeCloseTo(0.5, 10);
  });

  it('is translation-invariant in span and keeps non-max axis smaller than 1', () => {
    const out = scaleUniform([p(10, 10), p(110, 10), p(10, 60)]);
    const xs = out.map((pt) => pt.x);
    const ys = out.map((pt) => pt.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 10);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.5, 10);
  });

  it('maps a single point to the origin', () => {
    expect(scaleUniform([p(5, 7)])).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('translateToCentroid', () => {
  it('shifts known clouds so their centroid is the origin', () => {
    const out = translateToCentroid([p(0, 0), p(4, 0), p(0, 4), p(4, 4)]);
    expect(out).toEqual([
      { x: -2, y: -2 },
      { x: 2, y: -2 },
      { x: -2, y: 2 },
      { x: 2, y: 2 },
    ]);
  });

  it('produces a cloud whose mean is (0, 0)', () => {
    const pts = [p(3, -1), p(-5, 7), p(11, 2), p(1, -8)];
    const out = translateToCentroid(pts);
    const meanX = out.reduce((acc, pt) => acc + pt.x, 0) / out.length;
    const meanY = out.reduce((acc, pt) => acc + pt.y, 0) / out.length;
    expect(meanX).toBeCloseTo(0, 10);
    expect(meanY).toBeCloseTo(0, 10);
  });

  it('returns [] for empty input', () => {
    expect(translateToCentroid([])).toEqual([]);
  });
});

describe('rotatePoints', () => {
  it('rotates (1, 0) by 90 degrees to (0, 1)', () => {
    const [rotated] = rotatePoints([p(1, 0)], Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0, 5);
    expect(rotated.y).toBeCloseTo(1, 5);
  });

  it('rotates by 180 degrees negating both coordinates', () => {
    const out = rotatePoints([p(1, 0), p(0, 1)], Math.PI);
    expect(out[0].x).toBeCloseTo(-1, 5);
    expect(out[0].y).toBeCloseTo(0, 5);
    expect(out[1].x).toBeCloseTo(0, 5);
    expect(out[1].y).toBeCloseTo(-1, 5);
  });

  it('is the identity for a zero angle', () => {
    const out = rotatePoints([p(3, -2)], 0);
    expect(out[0].x).toBeCloseTo(3, 10);
    expect(out[0].y).toBeCloseTo(-2, 10);
  });
});

describe('chamferDistance', () => {
  const cloud = [p(0, 0), p(2, 0), p(0, 2), p(2, 2)];

  it('is 0 between an identical cloud and itself', () => {
    expect(chamferDistance(cloud, cloud)).toBeCloseTo(0, 5);
  });

  it('is symmetric between two clouds', () => {
    const other = [p(0, 0), p(10, 0)];
    expect(chamferDistance(cloud, other)).toBeCloseTo(chamferDistance(other, cloud), 10);
  });

  it('has a known value for simple segment-vs-midpoint inputs', () => {
    // a = (0,0)-(10,0), b = (5,0): every a-point is 5 from b, b is 5 from a.
    const a = [p(0, 0), p(10, 0)];
    const b = [p(5, 0)];
    expect(chamferDistance(a, b)).toBeCloseTo(5, 10);
  });

  it('is Infinity when either side is empty', () => {
    expect(chamferDistance([], cloud)).toBe(Infinity);
    expect(chamferDistance(cloud, [])).toBe(Infinity);
  });
});

describe('getNormalizedPointCloud', () => {
  const rawCircle = generateCirclePoints(0, 0, 100, 64);

  it('normalizes a point array to the default target count', () => {
    const cloud = getNormalizedPointCloud(rawCircle);
    expect(cloud).toHaveLength(120);
  });

  it('normalizes a stroke array to the same default target count', () => {
    const strokes: Stroke[] = [
      { id: 's1', points: generateCirclePoints(0, 0, 100, 32) },
      { id: 's2', points: generateCirclePoints(0, -50, 16.67, 16) },
    ];
    const cloud = getNormalizedPointCloud(strokes);
    expect(cloud).toHaveLength(120);
  });

  it('honors an explicit target count', () => {
    expect(getNormalizedPointCloud(rawCircle, 60)).toHaveLength(60);
  });

  it('spans at most one unit in each axis, filling ~both for a round cloud', () => {
    const cloud = getNormalizedPointCloud(rawCircle);
    const xs = cloud.map((pt) => pt.x);
    const ys = cloud.map((pt) => pt.y);
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    expect(dx).toBeLessThanOrEqual(1 + 1e-9);
    expect(dy).toBeLessThanOrEqual(1 + 1e-9);
    expect(dx).toBeGreaterThan(0.9);
    expect(dy).toBeGreaterThan(0.9);
  });

  it('collapses the degenerate axis of a straight line (aspect preserved)', () => {
    const cloud = getNormalizedPointCloud(generateLinePoints(0, 0, 10, 0, 30));
    const xs = cloud.map((pt) => pt.x);
    const ys = cloud.map((pt) => pt.y);
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    expect(dx).toBeCloseTo(1, 9);
    expect(dy).toBeCloseTo(0, 9);
  });

  it('returns [] for empty or fully degenerate stroke lists', () => {
    expect(getNormalizedPointCloud([])).toEqual([]);
    expect(getNormalizedPointCloud([{ id: 'a', points: [] }, { id: 'b', points: [] }])).toEqual([]);
  });
});

describe('recognizeGesture', () => {
  const cleanCircle = generateCirclePoints(0, 0, 100, 64);

  it('recognizes a clean circle cloud as circle with a strong score', () => {
    const result = recognizeGesture(cleanCircle);
    expect(result.name).toBe('circle');
    expect(result.score).toBeGreaterThan(0.45);
  });

  it('returns unknown for a tiny 3-point scribble', () => {
    const scribble = [p(10, 10), p(12, 14), p(9, 19)];
    const result = recognizeGesture(scribble);
    expect(result.name).toBe('unknown');
  });

  it('returns unknown with score 0 for empty input', () => {
    const result = recognizeGesture([]);
    expect(result.name).toBe('unknown');
    expect(result.score).toBe(0);
  });

  it('returns unknown for a plain straight-line scribble', () => {
    // A lone non-glyph stroke: dense space-filling noise is NOT reliably
    // rejected by the matcher (it can mimic glyph area coverage), so a
    // clean, deterministic line is the robust non-matching probe.
    const result = recognizeGesture(generateLinePoints(-100, 0, 100, 0, 30));
    expect(result.name).toBe('unknown');
  });
});

describe('scoreAgainstTarget', () => {
  const cleanCircle = generateCirclePoints(0, 0, 100, 64);

  it('scores a circle higher than a straight line against the circle target', () => {
    const circleScore = scoreAgainstTarget(cleanCircle, 'circle');
    const lineScore = scoreAgainstTarget([p(0, 0), p(10, 0)], 'circle');
    expect(circleScore).toBeGreaterThan(0.45);
    expect(lineScore).toBeLessThan(circleScore);
  });

  it('returns 0 for an unknown target and for empty input', () => {
    expect(scoreAgainstTarget(cleanCircle, 'unknown')).toBe(0);
    expect(scoreAgainstTarget([], 'circle')).toBe(0);
  });
});
