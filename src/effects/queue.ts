/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tiny slot manager enforcing the max-concurrent-bursts cap (default 2).
 * A slot is taken when a burst starts and released when the burst ends
 * (fade-out included) or is torn down early.
 */

export class BurstSlotManager {
  private readonly capacity: number;
  private used = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  /** True while at least one burst slot is still free. */
  get hasFreeSlot(): boolean {
    return this.used < this.capacity;
  }

  /** Claims a slot; returns false (no side effects) when saturated. */
  tryAcquire(): boolean {
    if (!this.hasFreeSlot) {
      return false;
    }
    this.used += 1;
    return true;
  }

  /** Releases a previously claimed slot (idempotent, clamped at zero). */
  release(): void {
    this.used = Math.max(0, this.used - 1);
  }
}
