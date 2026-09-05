/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Point, Stroke } from '../../core/types';

// ---------------------------------------------------------------------------
// Strongly-typed simulation state.
//
// Entities and particles are modeled as discriminated unions on `type`, with
// per-kind payloads carried in `data`. There are deliberately NO
// `Record<string, any>` custom-data bags anywhere in the engine: every field
// the simulation reads or writes is a named, typed property so strict
// type-checked linting (no-unsafe-*, no-explicit-any) stays enforceable on the
// hot path. The remaining mutable per-frame fields (positions, velocities,
// life, geometry) are plain properties on the union members.
// ---------------------------------------------------------------------------

// --- Entity payloads --------------------------------------------------------

/** Base fields shared by every simulated entity. */
interface EntityBase {
  id: string;
  x: number;
  y: number;
  /** Collision / interaction radius in CSS pixels. */
  size: number;
  vx?: number;
  vy?: number;
  life?: number;
  maxLife?: number;
  color: string;
}

/** A summoned floating sphere of light. */
export interface LightSphereData {
  /** Vortex funnel renderer (wind_vortex) rides the light_sphere entity. */
  isVortex?: boolean;
  /** Expanding activation shockwave ring (spawnActivationBurst). */
  isRing?: boolean;
  /** Expanding ring phase, 0..1; removes itself when >= 1. */
  age?: number;
  /** Ring start radius, grows every frame. */
  baseRadius?: number;
  /** Safety-hover anti-gravity bubble. */
  isGravityBubble?: boolean;
  /** True while the user is dragging this sphere. */
  isDragged?: boolean;
  /** Petrification flag (petrification curse). */
  isStone?: boolean;
}

/** A growing / settled ice crystal pillar anchored to the canvas floor. */
export interface IcePillarData {
  /** Current grown height (0..size-ish, overshoots 8% then springs back). */
  height: number;
  /** Growth / spring velocity accumulator. */
  velocity: number;
  /** True once growth has overshot and the spring settle phase runs. */
  settled?: boolean;
  /** Petrification flag: renders the pillar as grey stone. */
  isStone?: boolean;
}

/** A botanical vine / monster-arm made of chained joints. */
export interface PlantVineData {
  /**
   * Chain of joint positions from the anchor outward. Monster arms keep this
   * empty and instead drive `armJoints` via the IK solver in the RAF loop.
   */
  joints?: Point[];
  /** Monster-arm flag: the RAF loop then drives this entity via IK + claw. */
  isArm?: boolean;
  /** IK joint chain used only by the monster arm. */
  armJoints?: Point[];
  /** Petrification flag: renders the vine as grey stone. */
  isStone?: boolean;
}

/** Blazing fireball payload marker — fireballs carry no extra per-kind state. */
export type FireballData = Record<string, never>;

/** A persistent spatial-teleportation portal ring. */
export interface PortalData {
  /** id of the paired portal this one teleports to. */
  portalTarget?: string;
  /** Rotation phase of the internal spirals. */
  angle: number;
  /** True while the user is dragging this portal. */
  isDragged?: boolean;
}

/** Entity discriminated union — each member carries its own typed payload. */
export type EngineEntity =
  | (EntityBase & { type: 'light_sphere'; data: LightSphereData })
  | (EntityBase & { type: 'ice_pillar'; data: IcePillarData })
  | (EntityBase & { type: 'plant_vine'; data: PlantVineData })
  | (EntityBase & { type: 'fireball'; data?: FireballData })
  | (EntityBase & { type: 'portal'; data: PortalData });

/** A plant_vine that is the IK-driven monster arm (isArm === true). */
export type ArmVine = EngineEntity & { type: 'plant_vine' };

/** Narrowing predicate: true only for monster-arm vines (isArm === true). */
export function isArmVine(entity: EngineEntity): entity is ArmVine {
  return entity.type === 'plant_vine' && entity.data.isArm === true;
}

// --- Particle payloads ------------------------------------------------------

/** Base fields shared by every simulated particle. */
interface ParticleBase {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

/** Flame / smoke / spark / sparkle / portal dust payload marker — no extra state. */
export type VoidParticleData = Record<string, never>;

/** Frost diamonds payload marker — no extra state. */
export type FrostData = Record<string, never>;

/** Tumbling leaf — spins while it falls. */
export interface LeafData {
  /** Leaf spin angle. */
  angle: number;
}

/** Sleep-mist puffs payload marker — no extra state. */
export type MistData = Record<string, never>;

/** Frozen / petrified chunk payload marker — no extra state. */
export type GravityBubbleData = Record<string, never>;

/** Physics/material payloads keyed by particle type. */
export type EngineParticleData =
  | VoidParticleData
  | FrostData
  | LeafData
  | MistData
  | GravityBubbleData;

/**
 * Particle discriminated union — `type` selects both the update rule and the
 * renderer, and the optional per-kind `data` carries only typed state.
 */
export type EngineParticle =
  | (ParticleBase & { type: 'flame'; data?: VoidParticleData })
  | (ParticleBase & { type: 'smoke'; data?: VoidParticleData })
  | (ParticleBase & { type: 'spark'; data?: VoidParticleData })
  | (ParticleBase & { type: 'sparkle'; data?: VoidParticleData })
  | (ParticleBase & { type: 'portal_dust'; data?: VoidParticleData })
  | (ParticleBase & { type: 'frost'; data?: FrostData })
  | (ParticleBase & { type: 'leaf'; data: LeafData })
  | (ParticleBase & { type: 'mist'; data?: MistData });

// --- Factory helpers (pure object constructors for the unions) --------------

/** A leaf particle carrying its mandatory spin payload (makeLeaf's product). */
export type LeafParticle = EngineParticle & { type: 'leaf'; data: LeafData };

/** Builds a leaf particle with its mandatory typed angle payload. */
export function makeLeaf(
  x: number,
  y: number,
  color: string,
  size: number,
  maxLife: number
): LeafParticle {
  return {
    id: Math.random().toString(),
    type: 'leaf',
    x,
    y,
    vx: Math.random() * 0.4 - 0.2,
    vy: -0.1,
    size,
    color,
    alpha: 1,
    life: 0,
    maxLife,
    data: { angle: Math.random() * Math.PI },
  };
}

// --- Frame input for sim subsystems ----------------------------------------

/**
 * Aggregate world state handed to every sim subsystem. The loop reads the
 * mutable mirrors from `sim` and passes the resolved surface geometry `ctx` so
 * subsystems never query the DOM mid-frame.
 */
export interface FrameContext {
  /** 2D context with the dpr transform already applied (CSS-pixel space). */
  ctx: CanvasRenderingContext2D;
  /** Logical CSS-pixel drawing width (backing store / dpr). */
  w: number;
  /** Logical CSS-pixel drawing height. */
  h: number;
}

/**
 * Stroke snapshots the RAF loop renders every frame. `current` holds the
 * in-progress pointer path; `completed` holds finished strokes awaiting cast.
 */
export interface StrokeRenderState {
  completed: Stroke[];
  current: Point[];
}
