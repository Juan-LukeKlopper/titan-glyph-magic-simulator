/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kind → GLSL source registry. Sources are imported raw via Vite's `?raw`
 * suffix (see glsl.d.ts for the ambient typing). Compile success/failure is
 * checked once per kind on the shared probe context and cached, so a shader
 * that cannot compile on this GPU falls back to the legacy 2D effect and is
 * only ever warned about a single time.
 */

import type { EffectKind } from './types';
import { EFFECT_KINDS } from './types';
import { checkFragmentShaderCompiles } from './WebGLRenderer';

import fireSource from './glsl/fire.glsl?raw';
import tornadoSource from './glsl/tornado.glsl?raw';
import snowSource from './glsl/snow.glsl?raw';
import plantSource from './glsl/plant.glsl?raw';
import portalSource from './glsl/portal.glsl?raw';
import radianceSource from './glsl/radiance.glsl?raw';
import mistSource from './glsl/mist.glsl?raw';
import shimmerSource from './glsl/shimmer.glsl?raw';
import barrierSource from './glsl/barrier.glsl?raw';
import petrifySource from './glsl/petrify.glsl?raw';
import abominationSource from './glsl/abomination.glsl?raw';

const SOURCES: Readonly<Record<EffectKind, string>> = {
  fire: fireSource,
  tornado: tornadoSource,
  snow: snowSource,
  plant: plantSource,
  portal: portalSource,
  radiance: radianceSource,
  mist: mistSource,
  shimmer: shimmerSource,
  barrier: barrierSource,
  petrify: petrifySource,
  abomination: abominationSource,
};

/** True for kinds the layer knows about. */
export function isKnownKind(kind: string): kind is EffectKind {
  return EFFECT_KINDS.includes(kind as EffectKind);
}

/** Raw final GLSL for a kind (uniforms, helpers, mainImage, main). */
export function getShaderSource(kind: EffectKind): string {
  return SOURCES[kind];
}

const compileCache = new Map<EffectKind, boolean>();
const warned = new Set<EffectKind>();

/**
 * Whether the kind's fragment shader compiled on this device. Compiles on
 * first use, caches the verdict, and warns (once per kind) on failure.
 */
export function isShaderCompilable(kind: EffectKind): boolean {
  const cached = compileCache.get(kind);
  if (cached !== undefined) {
    return cached;
  }
  const ok = checkFragmentShaderCompiles(SOURCES[kind]);
  compileCache.set(kind, ok);
  if (!ok && !warned.has(kind)) {
    warned.add(kind);
    console.warn(
      `[effects] ${kind} shader failed to compile — falling back to the legacy 2D effect for this kind.`,
    );
  }
  return ok;
}
