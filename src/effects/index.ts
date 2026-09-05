/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API of the WebGL effect layer — imperative, framework-agnostic.
 * A React canvas agent creates one layer per drawing surface and calls
 * `request()` when a spell is recognised:
 *
 * - `supported === false` ⇒ WebGL unavailable / prefers-reduced-motion /
 *   zero-size container at construction: every request returns false and
 *   the caller keeps its legacy 2D effects.
 * - Bursts are transient: they play `burstMs` (default 4500 ms) including
 *   a fast fade-in and a 0.5 s fade-out, then remove their own <canvas>.
 * - A burst canvas is appended to `container` (absolute, full-bleed,
 *   pointer-events: none) and replaced under it never happens — the caller
 *   skips its 2D effect when `request` returns true.
 * - Concurrency is capped at `maxConcurrent` (default 2); saturated calls
 *   return false so the caller falls back to legacy 2D.
 * - A kind whose shader does not compile on this device is refused (false)
 *   with a single console.warn.
 */

import { BurstSlotManager } from './queue';
import { getShaderSource, isKnownKind, isShaderCompilable } from './registry';
import { BurstRenderer, isWebGLAvailable } from './WebGLRenderer';
import type {
  CastBox,
  EffectKind,
  EffectLayer,
  EffectLayerOptions,
  ResolvedLayerOptions,
} from './types';
import { DEFAULT_BURST_MS, DEFAULT_MAX_CONCURRENT } from './types';

/** Spell database id → effect kind used to pick a shader. */
export const EFFECT_SPELL_MAP: Readonly<Record<string, EffectKind>> = {
  light: 'radiance',
  ice: 'snow',
  plant: 'plant',
  fire: 'fire',
  sleep_mist: 'mist',
  wind_vortex: 'tornado',
  invisibility: 'shimmer',
  safety_hover: 'barrier',
  petrification: 'petrify',
  monster_arm: 'abomination',
  teleportation: 'portal',
};

export type { EffectKind, EffectLayer, EffectLayerOptions, CastBox } from './types';

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resolveOptions(options?: EffectLayerOptions): ResolvedLayerOptions {
  return {
    // Keep the ~0.5 s fade-out meaningful: never allow a shorter burst.
    burstMs: Math.max(600, Math.round(options?.burstMs ?? DEFAULT_BURST_MS)),
    maxConcurrent: Math.max(1, Math.round(options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT)),
  };
}

function containerHasSize(container: HTMLElement): boolean {
  const rect = container.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

class EffectLayerImpl implements EffectLayer {
  readonly supported: boolean;
  private readonly container: HTMLElement;
  private readonly options: ResolvedLayerOptions;
  private readonly slots: BurstSlotManager;
  private readonly active = new Set<BurstRenderer>();
  private disposed = false;

  constructor(container: HTMLElement, options?: EffectLayerOptions) {
    this.container = container;
    this.options = resolveOptions(options);
    this.slots = new BurstSlotManager(this.options.maxConcurrent);
    this.supported =
      containerHasSize(container) &&
      !prefersReducedMotion() &&
      isWebGLAvailable();
  }

  request(spellId: string, kind: EffectKind, at: CastBox): boolean {
    if (this.disposed || !this.supported) {
      return false;
    }
    if (!isKnownKind(kind)) {
      return false;
    }
    if (at.width <= 0 || at.height <= 0 || !containerHasSize(this.container)) {
      return false;
    }
    if (!this.slots.tryAcquire()) {
      // Saturated: caller falls back to the legacy 2D effect.
      return false;
    }
    if (!isShaderCompilable(kind)) {
      this.slots.release();
      return false;
    }

    let burst: BurstRenderer | null = null;
    try {
      burst = new BurstRenderer({
        container: this.container,
        fragmentSource: getShaderSource(kind),
        cast: at,
        durationMs: this.options.burstMs,
        spellId,
        onEnded: () => {
          if (burst !== null) {
            this.handleBurstEnded(burst);
          }
        },
      });
    } catch {
      // Context creation / compile / link failed at burst time.
      this.slots.release();
      return false;
    }
    this.active.add(burst);
    return true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const burst of this.active) {
      burst.dispose();
    }
    this.active.clear();
  }

  private handleBurstEnded(burst: BurstRenderer): void {
    this.active.delete(burst);
    this.slots.release();
  }
}

/**
 * Create the effect layer for `container`. `supported` is resolved at
 * construction time (WebGL probe + prefers-reduced-motion + container
 * size); when unsupported every `request` returns false.
 */
export function createEffectLayer(
  container: HTMLElement,
  options?: EffectLayerOptions,
): EffectLayer {
  return new EffectLayerImpl(container, options);
}
