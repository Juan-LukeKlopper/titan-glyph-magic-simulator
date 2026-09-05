// radiance.glsl - Glyph Magic Simulator shader burst (light spell).
//
// A single radiant golden sun anchored on the cast point: a white-hot core
// wrapped in layered warm halos, a few slowly rotating god-ray spokes that
// sweep around the star, and a sprinkle of tiny twinkling motes drifting
// inside the inner halo. Everything is one focal burst, not a tiled pattern
// and not a flat disc - the core, halo shells, spokes and motes stack to
// give it depth.
//
// Radial coordinates are measured in canvas-height units so the burst stays a
// true circle on any aspect ratio. The glow fades to fully transparent outside
// its radius, so the burst overlays the canvas instead of blacking it out.
//
// Palette: light #FFEAA7 with warm white. Plain ASCII only.
//
// SPDX-License-Identifier: MIT  (authored for the Glyph Magic Simulator;
// repo LICENSE: MIT)

precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform vec2 u_castPos;
uniform float u_alpha;

const float PI = 3.14159265358979323846;

const vec3 COL_LIGHT = vec3(1.0000, 0.9176, 0.6549);     // #FFEAA7
const vec3 COL_WARMWHITE = vec3(1.0000, 0.9800, 0.9000); // warm white core

// Two-tap value hash: used for the mote placement and their twinkle phase.
vec2 hash2(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 34.23);
	return fract(vec2(p.x * p.y, p.x + p.y));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;

	// Aspect-correct local coordinates centred on the cast point, measured in
	// canvas-height units.
	vec2 uv = fragCoord.xy / iResolution.xy;
	float aspect = iResolution.x / max(iResolution.y, 1.0);
	vec2 p = vec2((uv.x - u_castPos.x) * aspect, uv.y - u_castPos.y);

	float r = length(p);
	float ang = atan(p.y, p.x);

	// Slow, gentle breathing so the star feels alive rather than frozen.
	float breathe = 0.92 + 0.08 * sin(time * 1.7);

	vec3 col = vec3(0.0);

	// ---- layered soft halo -------------------------------------------------
	// Three overlapping gaussian shells at growing radius give the glow a
	// soft, stepped falloff instead of a single flat disc. Colour warms from
	// golden at the rim toward warm white near the core.
	float halo = 0.90 * exp(-pow(r / 0.110, 2.0))
	           + 0.50 * exp(-pow(r / 0.200, 2.0))
	           + 0.26 * exp(-pow(r / 0.310, 2.0));
	vec3 haloCol = mix(COL_WARMWHITE, COL_LIGHT, clamp(r / 0.30, 0.0, 1.0));
	col += haloCol * halo * breathe;

	// ---- slowly rotating god-ray spokes ------------------------------------
	// Two counter-rotating sets: a few broad primary rays plus a finer
	// secondary fan. Both fade in from the core and taper out with radius.
	float spokeFall = exp(-pow(r / 0.340, 2.0)) * smoothstep(0.010, 0.070, r);

	float raysA = pow(max(0.0, cos(ang * 6.0 + time * 0.18)), 6.0);
	float raysB = pow(max(0.0, cos(ang * 10.0 - time * 0.11 + 1.3)), 8.0);
	col += COL_LIGHT * (raysA * 0.85 + raysB * 0.35) * spokeFall;

	// ---- white-hot core ----------------------------------------------------
	float core = exp(-pow(r / 0.052, 2.0));
	float seed = exp(-pow(r / 0.020, 2.0));
	col += COL_WARMWHITE * core * 1.70 * breathe;
	col += vec3(1.0) * seed * 1.10;

	// ---- tiny twinkling motes inside the halo ------------------------------
	// A sparse hash grid, masked to the inner halo so motes only dust the
	// glow and never leak onto the rest of the canvas.
	float scale = 13.0;
	vec2 cell = floor(p * scale);
	vec2 hp = hash2(cell);
	vec2 local = p * scale - cell;
	vec2 center = 0.5 + (hp - 0.5) * 0.72;
	float moteD = length(local - center);
	float mote = exp(-moteD * moteD * 90.0);

	float twinkle = 0.5 + 0.5 * sin(time * 3.0 + hp.x * 38.0 + hp.y * 61.0);
	float moteMask = 1.0 - smoothstep(0.16, 0.34, r);
	col += COL_WARMWHITE * mote * twinkle * twinkle * (0.35 + 0.65 * hp.y) * moteMask * 1.10;

	// Guard the write range so the brightest pixels never clip harshly.
	col = clamp(col, 0.0, 1.0);

	// ---- coverage ----------------------------------------------------------
	// Fully opaque at the core, easing to fully transparent at the rim so
	// nothing is drawn outside the glow radius.
	float coverage = 1.0 - smoothstep(0.34, 0.56, r);
	fragColor = vec4(col, coverage);
}

// Shadertoy-style wrapper (coverage folded into rgb before the fade).
void main() {
	vec4 c;
	mainImage(c, gl_FragCoord.xy);
	c.rgb *= c.a;
	c *= u_alpha;
	gl_FragColor = c;
}
