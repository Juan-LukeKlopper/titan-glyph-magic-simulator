/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for the pure sim-state factories and per-frame flag derivation.
 */
import { describe, expect, it } from 'vitest';
import { computeFrameFlags, createSimState, logicalBox } from './state';
import type { EngineEntity, EngineParticle, LightSphereData } from './types';

function makeLightSphere(id: string, data: LightSphereData): EngineEntity {
  return {
    id,
    type: 'light_sphere',
    x: 100,
    y: 100,
    size: 40,
    color: '#FFEAA7',
    data,
  };
}

function makeMist(id: string): EngineParticle {
  return {
    id,
    type: 'mist',
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    size: 6,
    color: '#A29BFE',
    alpha: 0.5,
    life: 10,
    maxLife: 20,
  };
}

describe('createSimState', () => {
  it('returns the documented empty world', () => {
    const sim = createSimState();
    expect(sim.entities).toEqual([]);
    expect(sim.particles).toEqual([]);
    expect(sim.strokes.completed).toEqual([]);
    expect(sim.strokes.current).toEqual([]);
    expect(sim.dragEntityId).toBeNull();
    expect(sim.lastPointer).toEqual({ x: 0, y: 0 });
    expect(sim.castingTrans).toBe(false);
    expect(sim.isInvisActive).toBe(false);
  });
});

describe('computeFrameFlags', () => {
  it('reports all-clear for an empty sim', () => {
    const flags = computeFrameFlags(createSimState());
    expect(flags.activeVortex).toBeNull();
    expect(flags.isSleepMistActive).toBe(false);
    expect(flags.isSafetyHoverActive).toBe(false);
  });

  it('flags a light sphere with isVortex as the active vortex', () => {
    const vortex = makeLightSphere('v1', { isVortex: true });
    const sim = createSimState();
    sim.entities.push(vortex);
    const flags = computeFrameFlags(sim);
    expect(flags.activeVortex).toBe(vortex);
  });

  it('ignores plain light spheres when looking for a vortex', () => {
    const plain = makeLightSphere('plain', {});
    const sim = createSimState();
    sim.entities.push(plain);
    const flags = computeFrameFlags(sim);
    expect(flags.activeVortex).toBeNull();
    expect(flags.isSafetyHoverActive).toBe(false);
  });

  it('flags sleep-mist activity when a mist particle is on screen', () => {
    const sim = createSimState();
    sim.particles.push(makeMist('m1'));
    const flags = computeFrameFlags(sim);
    expect(flags.isSleepMistActive).toBe(true);
  });

  it('flags the safety-hover bubble on a gravity-bubble light sphere', () => {
    const bubble = makeLightSphere('g1', { isGravityBubble: true });
    const sim = createSimState();
    sim.entities.push(bubble);
    const flags = computeFrameFlags(sim);
    expect(flags.isSafetyHoverActive).toBe(true);
    expect(flags.activeVortex).toBeNull();
  });

  it('resolves all three flags together for a busy world', () => {
    const vortex = makeLightSphere('v1', { isVortex: true });
    const bubble = makeLightSphere('g1', { isGravityBubble: true });
    const sim = createSimState();
    sim.entities.push(vortex, bubble);
    sim.particles.push(makeMist('m1'));
    const flags = computeFrameFlags(sim);
    expect(flags.activeVortex).toBe(vortex);
    expect(flags.isSleepMistActive).toBe(true);
    expect(flags.isSafetyHoverActive).toBe(true);
  });
});

describe('logicalBox', () => {
  it('divides the backing store by dpr and rounds', () => {
    const canvas = { width: 1600, height: 900 } as HTMLCanvasElement;
    expect(logicalBox(canvas, 2)).toEqual({ w: 800, h: 450 });
  });

  it('rounds half-integer results', () => {
    const canvas = { width: 1001, height: 999 } as HTMLCanvasElement;
    const box = logicalBox(canvas, 2);
    expect(box.w).toBe(501); // Math.round(500.5)
    expect(box.h).toBe(500); // Math.round(499.5)
  });

  it('is the identity for a dpr of 1', () => {
    const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
    expect(logicalBox(canvas, 1)).toEqual({ w: 800, h: 600 });
  });
});
