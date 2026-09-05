/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Canonical simulation/behavior constants. Values are frozen from the original
// MagicCanvas monolith — do not tune.

/** Trace-mode auto-cast: minimum raw similarity to the practiced glyph. */
export const TRACE_CAST_THRESHOLD = 0.55;

/** Particle ceiling: non-essential spawns are skipped above this count. */
export const MAX_PARTICLES = 900;

/** Score above which the classifier's opinion is shown to the user on a fizzle. */
export const RECOGNIZE_THRESHOLD_DISPLAY = 0.45;

/** Casting-transition flash duration (ms). */
export const CAST_TRANSITION_MS = 800;

/** Invisibility breath gauge drain per 100 ms tick. */
export const BREATH_DRAIN_PER_TICK = 1.5;

/** Vortex pull radii (entities vs particles). */
export const VORTEX_ENTITY_RADIUS = 350;
export const VORTEX_PARTICLE_RADIUS = 360;
