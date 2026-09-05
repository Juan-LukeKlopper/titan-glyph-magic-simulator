/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sanity tests for the effect-layer shared constants and kinds list.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BURST_MS,
  DEFAULT_MAX_CONCURRENT,
  EFFECT_KINDS,
} from './types';

describe('effect kinds & defaults', () => {
  it('lists every canonical kind without duplicates', () => {
    expect(EFFECT_KINDS).toEqual([
      'fire',
      'snow',
      'plant',
      'tornado',
      'portal',
      'radiance',
      'mist',
      'shimmer',
      'barrier',
      'petrify',
      'abomination',
    ]);
    expect(new Set(EFFECT_KINDS).size).toBe(EFFECT_KINDS.length);
  });

  it('exposes the spec-locked defaults', () => {
    expect(DEFAULT_MAX_CONCURRENT).toBe(2);
    expect(DEFAULT_BURST_MS).toBe(4500);
  });
});
