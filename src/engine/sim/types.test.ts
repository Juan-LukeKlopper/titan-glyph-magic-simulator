/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for the sim types' pure factory helpers. No type guards or
 * additional factories are exported yet — only what exists is tested.
 */
import { describe, expect, it } from 'vitest';
import { makeLeaf } from './types';

describe('makeLeaf', () => {
  it('builds a leaf particle carrying the required typed payload', () => {
    const leaf = makeLeaf(10, 20, '#55EFC4', 5, 60);
    expect(leaf.type).toBe('leaf');
    expect(leaf.x).toBe(10);
    expect(leaf.y).toBe(20);
    expect(leaf.color).toBe('#55EFC4');
    expect(leaf.size).toBe(5);
    expect(leaf.maxLife).toBe(60);
    expect(leaf.life).toBe(0);
    expect(leaf.alpha).toBe(1);
    // The leaf payload is mandatory and its spin angle is always finite.
    expect(Number.isFinite(leaf.data.angle)).toBe(true);
    expect(leaf.data.angle).toBeGreaterThanOrEqual(0);
    expect(leaf.data.angle).toBeLessThan(Math.PI + 1e-9);
  });

  it('gives every leaf a non-empty id and finite velocity', () => {
    const leaf = makeLeaf(0, 0, '#fff', 3, 10);
    expect(typeof leaf.id).toBe('string');
    expect(leaf.id.length).toBeGreaterThan(0);
    expect(Number.isFinite(leaf.vx)).toBe(true);
    expect(Number.isFinite(leaf.vy)).toBe(true);
  });
});
