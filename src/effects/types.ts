/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared types for the WebGL effect layer. The public surface
 * (EffectKind, EffectLayerOptions, EffectLayer, EFFECT_SPELL_MAP,
 * createEffectLayer) is exported from index.ts; the shapes below are the
 * cross-module contracts used by the renderer, registry and slot manager.
 */

/** Every spell kind the shader layer can play. */
export type EffectKind =
  | 'fire'
  | 'snow'
  | 'plant'
  | 'tornado'
  | 'portal'
  | 'radiance'
  | 'mist'
  | 'shimmer'
  | 'barrier'
  | 'petrify'
  | 'abomination';

/** All known kinds, used for validation and compile caching. */
export const EFFECT_KINDS: readonly EffectKind[] = [
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
] as const;

/**
 * A CSS-pixel box measured against the effect container. `x`/`y` is the
 * cast centroid, `width`/`height` the canvas CSS size. Shaders receive
 * this via `iResolution` (size), `iMouse.xy` (x/y, z = 0) and
 * `u_castPos` (x/width, y/height, normalised to 0..1).
 */
export interface CastBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Constructor options for {@link createEffectLayer}. */
export interface EffectLayerOptions {
  /** Total burst duration in ms, including the end fade (default 4500). */
  burstMs?: number;
  /** Maximum simultaneous bursts (default 2). Further calls return false. */
  maxConcurrent?: number;
}

/**
 * The framework-agnostic facade a React canvas agent drives:
 * `createEffectLayer(container)` then `request(...)` per cast.
 */
export interface EffectLayer {
  /**
   * False when WebGL is unavailable, the user prefers reduced motion, the
   * container had zero size at construction, or the layer was disposed.
   */
  readonly supported: boolean;
  /**
   * Start a shader burst. Returns true when the burst is playing (the
   * caller must NOT spawn its legacy 2D effect) and false when the layer
   * is unsupported/saturated/compile-failed (the caller falls back).
   */
  request(spellId: string, kind: EffectKind, at: CastBox): boolean;
  /** Tear down every live burst and free all resources. */
  dispose(): void;
}

/** Effective settings after applying defaults. */
export interface ResolvedLayerOptions {
  readonly burstMs: number;
  readonly maxConcurrent: number;
}

/** Defaults locked with the spec. */
export const DEFAULT_BURST_MS = 4500;
export const DEFAULT_MAX_CONCURRENT = 2;
