/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data-integrity tests for the spell database, plus cross-checks against the
 * WebGL effect layer's spell→shader map (pure constants, import-safe).
 */
import { describe, expect, it } from 'vitest';
import { EFFECT_SPELL_MAP } from '../effects/index';
import { EFFECT_KINDS } from '../effects/types';
import { SPELLS_DATABASE } from './spells';
import type { Spell } from './types';

/** The four elemental primitives; the only valid glyph ingredients. */
const PRIMITIVE_ELEMENTS = ['light', 'ice', 'plant', 'fire'] as const;

describe('SPELLS_DATABASE', () => {
  it('exports an array of exactly 11 spells', () => {
    expect(Array.isArray(SPELLS_DATABASE)).toBe(true);
    expect(SPELLS_DATABASE).toHaveLength(11);
  });

  it('gives every spell a unique id', () => {
    const ids = SPELLS_DATABASE.map((spell) => spell.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every spell a valid type and a non-unknown elemental primary', () => {
    for (const spell of SPELLS_DATABASE) {
      expect(['primitive', 'combinatory']).toContain(spell.type);
      expect(PRIMITIVE_ELEMENTS).toContain(spell.primaryElement);
    }
  });

  it('fills every required prose/color field with a non-empty string', () => {
    const stringFields: (keyof Spell)[] = [
      'name',
      'description',
      'lore',
      'discovery',
      'visualDescription',
      'color',
      'shadowColor',
    ];
    for (const spell of SPELLS_DATABASE) {
      for (const field of stringFields) {
        const value = spell[field];
        expect(typeof value).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
      expect(spell.color).toMatch(/^#/);
      expect(spell.shadowColor.length).toBeGreaterThan(0);
    }
  });

  it('lists exactly the four primitives: light, ice, plant, fire', () => {
    const primitiveIds = SPELLS_DATABASE.filter((s) => s.type === 'primitive')
      .map((s) => s.id)
      .sort();
    expect(primitiveIds).toEqual(['fire', 'ice', 'light', 'plant']);
    // A primitive's id is its own primary element.
    for (const spell of SPELLS_DATABASE) {
      if (spell.type === 'primitive') {
        expect(spell.primaryElement).toBe(spell.id);
      }
    }
  });

  it('gives every combinatory spell a recipe of valid elements and a layout', () => {
    const combinatory = SPELLS_DATABASE.filter((s) => s.type === 'combinatory');
    expect(combinatory.length).toBeGreaterThan(0);
    for (const spell of combinatory) {
      expect(spell.recipe).toBeDefined();
      const recipe = spell.recipe;
      if (recipe === undefined) {
        continue;
      }
      expect(recipe.elements.length).toBeGreaterThan(0);
      for (const element of recipe.elements) {
        expect(PRIMITIVE_ELEMENTS).toContain(element);
      }
      expect(recipe.layout.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('EFFECT_SPELL_MAP ↔ SPELLS_DATABASE', () => {
  it('maps each shader spell to its exact EffectKind', () => {
    expect(EFFECT_SPELL_MAP).toEqual({
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
    });
  });

  it('only references spell ids that exist in the database', () => {
    const spellIds = new Set(SPELLS_DATABASE.map((s) => s.id));
    for (const spellId of Object.keys(EFFECT_SPELL_MAP)) {
      expect(spellIds.has(spellId)).toBe(true);
    }
  });

  it('only references kinds the effect layer knows about', () => {
    for (const kind of Object.values(EFFECT_SPELL_MAP)) {
      expect(EFFECT_KINDS).toContain(kind);
    }
  });
});
