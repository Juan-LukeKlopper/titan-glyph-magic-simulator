/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for the burst slot manager (pure concurrency-cap logic, no DOM).
 */
import { describe, expect, it } from 'vitest';
import { BurstSlotManager } from './queue';

describe('BurstSlotManager', () => {
  it('allows up to maxConcurrent acquisitions', () => {
    const slots = new BurstSlotManager(2);
    expect(slots.hasFreeSlot).toBe(true);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.hasFreeSlot).toBe(false);
    expect(slots.tryAcquire()).toBe(false);
  });

  it('releases a slot and lets the next acquire succeed', () => {
    const slots = new BurstSlotManager(2);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.tryAcquire()).toBe(false);
    slots.release();
    expect(slots.hasFreeSlot).toBe(true);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.tryAcquire()).toBe(false);
  });

  it('clamps release at zero (idempotent, never negative)', () => {
    const slots = new BurstSlotManager(1);
    expect(slots.tryAcquire()).toBe(true);
    slots.release();
    slots.release();
    slots.release();
    expect(slots.hasFreeSlot).toBe(true);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.tryAcquire()).toBe(false);
  });

  it('enforces a minimum capacity of 1 even for degenerate configs', () => {
    expect(new BurstSlotManager(0).tryAcquire()).toBe(true);
    expect(new BurstSlotManager(-3).tryAcquire()).toBe(true);
  });

  it('floors fractional capacities', () => {
    const slots = new BurstSlotManager(2.9);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.tryAcquire()).toBe(true);
    expect(slots.tryAcquire()).toBe(false);
  });
});
