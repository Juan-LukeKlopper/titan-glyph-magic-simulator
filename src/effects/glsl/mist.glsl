// mist.glsl - Glyph Magic Simulator shader burst (sleep mist spell).
//
// Authored for this project (no reference): a slow, dreamy indigo-lavender
// vapor cloud that billows and curls around the cast point. Layered
// domain-warped fbm builds soft, low-contrast pillows of vapour that drift
// and rotate drowsily, densest at the centre and thinning to nothing at the
// outer edge. A few pale, pale-lavender sparkles drift slowly through the
// haze. Palette: mist #A29BFE lifted over deep indigo #2E2459.
//
// Design notes: radial coordinates are in "half the box height" units so the
// cloud is a true circle regardless of aspect. Everything lives on a soft
// ~1.1-unit disc; the surrounding canvas fades to fully transparent so the
// burst overlays the existing surface instead of blacking it out.
//
// SPDX-License-Identifier: MIT  (authored for the Glyph Magic Simulator;
// repo LICENSE: MIT)

precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform vec2 u_castPos;
uniform float u_alpha;

const float TWO_PI = 6.28318530717958647692;

const vec3 COL_MIST = vec3(0.6353, 0.6078, 0.9961);   // #A29BFE
const vec3 COL_INDIGO = vec3(0.1804, 0.1412, 0.3490); // #2E2459 deep indigo
const vec3 COL_PALE = vec3(0.9098, 0.9020, 1.0000);   // #E8E6FF pale lavender

// Two-tap hash for the drifting drowsy sparkles.
vec2 hash2(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 34.23);
	return fract(vec2(p.x * p.y, p.x + p.y));
}

// Scalar hash for the value-noise / fbm stack.
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Smooth value noise on a unit lattice.
float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = hash(i + vec2(0.0, 0.0));
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Five-octave fbm (constant loop bound - WebGL1 safe).
float fbm(vec2 p) {
	float v = 0.0;
	float amp = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 5; i++) {
		v += amp * vnoise(p);
		p = m * p;
		amp *= 0.5;
	}
	return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;

	// Aspect-correct coordinates anchored on the cast point.
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 p = vec2((uv.x - u_castPos.x) * (iResolution.x / max(iResolution.y, 1.0)),
		uv.y - u_castPos.y);

	float r = length(p);

	// Slow drowsy rotation of the whole vapour mass.
	float spin = time * 0.05;
	float cs = cos(spin);
	float sn = sin(spin);
	vec2 q = mat2(cs, -sn, sn, cs) * p;

	// Radial envelope: dense at the centre, gone by the outer edge.
	float env = 1.0 - smoothstep(0.06, 1.15, r);

	// Domain-warped layered fbm -> soft curling billows.
	vec2 wp = q * 1.8;
	vec2 warp = vec2(
		fbm(wp + vec2(0.0, -time * 0.10)),
		fbm(wp + vec2(5.2, 1.3) + vec2(time * 0.07, 0.0))
	);
	float billow = fbm(wp + warp * 1.7 + vec2(0.0, -time * 0.06));
	float curlLayer = fbm(q * 3.6 + warp * 1.2 + vec2(time * 0.10, -time * 0.07));

	// Soft, low-contrast density field, denser toward the middle of the cloud.
	float density = env * (0.30 + 0.55 * billow + 0.30 * curlLayer);
	density += 0.35 * env * env * exp(-r * r * 1.4);

	// Dreamy palette: deep indigo in the thin wisps lifting to mist lavender
	// where the vapour is dense.
	vec3 col = mix(COL_INDIGO, COL_MIST, smoothstep(0.10, 0.85, density));
	col = mix(col, COL_MIST, 0.30 * exp(-r * r * 1.8));
	col += COL_PALE * 0.08 * (0.5 + 0.5 * sin(warp.x * TWO_PI + time * 0.3)) * env;

	// A few pale, drowsy sparkles drifting slowly through the vapour.
	vec2 sc = q * 6.0 + vec2(time * 0.08, time * 0.04);
	vec2 cell = floor(sc);
	vec2 hp = hash2(cell);
	float starD = length((sc - cell) - (0.5 + (hp - 0.5) * 0.7));
	float spark = exp(-starD * starD * 190.0);
	float twinkle = 0.5 + 0.5 * sin(time * 1.1 + hp.x * 41.0 + hp.y * 17.0);
	float sparkAmp = twinkle * twinkle * (0.3 + 0.7 * hp.y) * env;
	col += COL_PALE * spark * sparkAmp * 0.55;

	col = clamp(col, 0.0, 1.0);

	// Coverage: only where the cloud is, fading smoothly to fully transparent.
	float coverage = env * smoothstep(0.14, 0.72, density);
	coverage = clamp(coverage + 0.45 * env * env * exp(-r * r * 2.6), 0.0, 1.0);

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
