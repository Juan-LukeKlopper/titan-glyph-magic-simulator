/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Freeze-checks for the canonical engine constants.
 */
import { describe, expect, it } from 'vitest';
import {
  BREATH_DRAIN_PER_TICK,
  CAST_TRANSITION_MS,
  MAX_PARTICLES,
  RECOGNIZE_THRESHOLD_DISPLAY,
  TRACE_CAST_THRESHOLD,
  VORTEX_ENTITY_RADIUS,
  VORTEX_PARTICLE_RADIUS,
} from './constants';

describe('engine constants', () => {
  it('keeps the spec-locked thresholds', () => {
    expect(TRACE_CAST_THRESHOLD).toBe(0.55);
    expect(MAX_PARTICLES).toBe(900);
    expect(RECOGNIZE_THRESHOLD_DISPLAY).toBe(0.45);
    expect(CAST_TRANSITION_MS).toBe(800);
  });

  it('keeps the remaining frozen behavior constants', () => {
    expect(BREATH_DRAIN_PER_TICK).toBe(1.5);
    expect(VORTEX_ENTITY_RADIUS).toBe(350);
    expect(VORTEX_PARTICLE_RADIUS).toBe(360);
  });
});
