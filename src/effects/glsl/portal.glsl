// portal.glsl - Glyph Magic Simulator shader burst (teleportation spell).
//
// Authored for this project (no reference): a grounded teleport-portal
// centred on the cast point - a swirling spiral of rings and streaks,
// radial ripple waves expanding outward in pulses, a hot core, and a
// sprinkle of twinkling stars. Palette from the existing portal colors:
// cyan #81ECEC, violet #9B59B6, pink #FD79A8.
//
// Design notes: radial coordinates are in "half the box height" units so
// the portal is a true circle regardless of aspect; everything lives on a
// ~1.6-unit disc and the surrounding canvas fades to transparent so the
// burst overlays rather than blacking out the whole surface.
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
const float TWO_PI = 6.28318530717958647692;

const vec3 COL_CYAN = vec3(0.5059, 0.9255, 0.9255);  // #81ECEC
const vec3 COL_VIOLET = vec3(0.6078, 0.3490, 0.7137); // #9B59B6
const vec3 COL_PINK = vec3(0.9922, 0.4745, 0.6588);   // #FD79A8

// Two-tap value hash for the sparkle stars / ring shimmer.
vec2 hash2(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 34.23);
	return fract(vec2(p.x * p.y, p.x + p.y));
}

float hash1(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 34.23);
	return fract(p.x * p.y);
}

float ringBand(float rad, float radius, float width) {
	return exp(-pow((rad - radius) / width, 2.0));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;

	// Radial, aspect-correct coordinates centred on the cast point.
	vec2 p = (fragCoord.xy - u_castPos * iResolution.xy)
		* (2.0 / max(iResolution.y, 1.0));
	float r = length(p);
	float ang = atan(p.y, p.x);

	// ---- faint nebula backdrop (violet <-> pink, slow rotate) ---------------
	float neb = clamp(0.5 + 0.5 * sin(ang * 3.0 + time * 0.5), 0.0, 1.0);
	vec3 col = mix(COL_VIOLET, COL_PINK, neb) * 0.055 * exp(-r * 0.9);

	// ---- sparkle stars (sparse, twinkling, inside the disc) ----------------
	vec2 cell = floor(p * 9.0);
	vec2 hp = hash2(cell);
	float starD = length((p * 9.0 - cell) - (0.5 + (hp - 0.5) * 0.85));
	float star = exp(-starD * starD * 170.0);
	float twinkle = 0.5 + 0.5 * sin(time * 2.2 + hp.x * 41.0 + hp.y * 17.0);
	float starAmp = twinkle * twinkle * (0.25 + 0.75 * hp.y);
	col += star * starAmp * mix(vec3(0.9, 0.95, 1.0), COL_PINK, hp.x) * 0.8;

	// ---- swirl streaks (spiral galaxy sheet across the mid band) ------------
	float swirlPhase = r * 13.0 - ang * 4.0 - time * 2.1;
	float swirl = pow(0.5 + 0.5 * sin(swirlPhase), 3.0);
	float midBand = ringBand(r, 0.55, 0.38);
	vec3 swirlCol = mix(COL_VIOLET, COL_CYAN, 0.5 + 0.5 * sin(ang * 2.0 - time * 1.2));
	col += swirlCol * swirl * midBand * 0.30;

	// ---- swirling rings (three principal bands, shimmering knots) ----------
	float knot1 = 0.5 + 0.5 * sin(ang * 6.0 - time * 1.6);
	col += mix(COL_PINK, COL_CYAN, 0.5 + 0.5 * sin(ang * 2.0 - time * 1.0))
		* ringBand(r, 0.46, 0.030) * (0.35 + 0.65 * knot1) * 1.05;

	float knot2 = 0.5 + 0.5 * sin(ang * 8.0 + time * 1.4);
	col += mix(COL_CYAN, COL_VIOLET, 0.5 + 0.5 * sin(ang * 3.0 + time * 0.8))
		* ringBand(r, 0.66, 0.022) * (0.40 + 0.60 * knot2) * 0.80;

	float knot3 = 0.5 + 0.5 * sin(ang * 5.0 - time * 0.9);
	col += mix(COL_VIOLET, COL_PINK, 0.5 + 0.5 * sin(ang * 4.0 - time * 0.6))
		* ringBand(r, 0.84, 0.016) * (0.45 + 0.55 * knot3) * 0.55;

	// ---- radial ripple / energy waves (staggered expanding pulses) ----------
	for (int i = 0; i < 4; i++) {
		float start = float(i) * 1.15;
		float period = 1.35;
		float ph = clamp((time - start) / period, 0.0, 1.0);
		float rad = 0.10 + ph * 0.92;
		float width = 0.016 + (1.0 - ph) * 0.012;
		float wave = ringBand(r, rad, width) * (1.0 - ph);
		vec3 waveCol = mix(COL_CYAN, COL_PINK, ph);
		col += waveCol * wave * 0.9;
	}

	// ---- hot core (cyan) ----------------------------------------------------
	float core = exp(-r * 2.4);
	col += COL_CYAN * core * (0.9 + 0.10 * sin(time * 6.0));
	col += vec3(1.0, 1.0, 1.0) * exp(-r * 6.0) * 0.4;
	col += COL_PINK * exp(-r * 4.2) * 0.12 * (0.6 + 0.4 * sin(time * 2.4 - ang * 2.0));

	// Guard the write range; clip gently at the top end.
	col = min(col, vec3(1.15));
	col = clamp(col, 0.0, 1.0);

	// Soft disc coverage - the burst blends with the canvas behind it.
	float disc = 1.0 - smoothstep(0.80, 1.60, r);
	float coverage = clamp(disc + 0.12, 0.0, 1.0);
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
