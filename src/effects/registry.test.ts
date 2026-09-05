/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Registry tests. The module is import-safe under node: GLSL arrives via
 * vite `?raw` (transformed to plain strings) and the WebGLRenderer helpers
 * it imports only touch the DOM inside functions, never at module scope.
 * Compile probing itself needs a WebGL context, so it is NOT exercised here.
 */
import { describe, expect, it } from 'vitest';
import { getShaderSource, isKnownKind } from './registry';
import { EFFECT_KINDS } from './types';

describe('isKnownKind', () => {
  it('accepts every kind in EFFECT_KINDS', () => {
    for (const kind of EFFECT_KINDS) {
      expect(isKnownKind(kind)).toBe(true);
    }
  });

  it('rejects unknown spell ids, empty strings and junk', () => {
    expect(isKnownKind('ice')).toBe(false); // 'ice' is a spell id, not a kind
    expect(isKnownKind('wind_vortex')).toBe(false);
    expect(isKnownKind('')).toBe(false);
    expect(isKnownKind('tornadoes')).toBe(false);
    expect(isKnownKind('portal!')).toBe(false);
  });
});

describe('getShaderSource', () => {
  it('returns a non-trivial GLSL source for every known kind', () => {
    for (const kind of EFFECT_KINDS) {
      const source = getShaderSource(kind);
      expect(typeof source).toBe('string');
      expect(source.length).toBeGreaterThan(200);
    }
  });

  it('is stable across repeated lookups', () => {
    for (const kind of EFFECT_KINDS) {
      expect(getShaderSource(kind)).toBe(getShaderSource(kind));
    }
  });
});
