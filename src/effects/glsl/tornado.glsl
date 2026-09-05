// tornado.glsl - Glyph Magic Simulator shader burst (wind_vortex spell).
//
// Authored for this project (no texture / sampler dependencies): a tall
// swirling wind-vortex funnel anchored at the cast point. The twister is a
// closed-form tapered cylinder - narrow at the base, flaring toward the top -
// whose axis wobbles gently side to side as it climbs. Fast-rotating spiral
// ribbons of pale dust and cyan wind wrap around and up the funnel, a faint
// bright rim catches one silhouette edge, thin darker teal bands sit between
// the ribbons, and a deep teal shadow fills the core. Everything is generated
// procedurally from a hash-based value noise (no textures), and the coverage
// is near zero away from the funnel so the canvas and UI behind stay visible.
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

// Palette anchors.
const vec3 COL_CYAN = vec3(0.5059, 0.9255, 0.9255); // #81ECEC wind cyan
const vec3 COL_DUST = vec3(0.90, 0.93, 0.95);       // pale grey-white dust
const vec3 COL_TEAL = vec3(0.07, 0.27, 0.31);       // deeper teal shadow

// Procedural hash-based value noise (no samplers, no textures).
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Short octave stack for the turbulent dust detail (constant loop bound).
float fbm(vec2 p) {
	float f = 0.0;
	float amp = 0.5;
	for (int i = 0; i < 3; i++) {
		f += amp * vnoise(p);
		p = p * 2.03 + vec2(17.3, 9.1);
		amp *= 0.5;
	}
	return f;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;

	// Aspect-correct coordinates centred on the cast point.
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 p = vec2((uv.x - u_castPos.x) * (iResolution.x / max(iResolution.y, 1.0)),
			uv.y - u_castPos.y);

	// ---- closed-form funnel silhouette (base at cast point, flares up) -----
	float H = 0.80; // funnel height in screen-height units
	float h = p.y / H;
	float hc = clamp(h, 0.0, 1.0);

	// The axis wobbles gently side to side as it climbs.
	float wobble = 0.018 * sin(p.y * 8.0 + time * 1.6)
			+ 0.030 * sin(p.y * 3.3 - time * 0.8);
	float dx = p.x - wobble;

	// Radius profile: narrow at the base, flaring toward the top.
	float radius = 0.030 + 0.21 * pow(hc, 0.85);

	// Lateral coordinate across the funnel (-1..1), then the visible wrapping
	// angle on the cylinder (asin gives natural foreshortening near the rim).
	float s = dx / max(radius, 0.0001);
	float theta = asin(clamp(s, -1.0, 1.0));

	// Vertical envelope: soft ignition at the base, soft cap at the top.
	float env = smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.80, 1.18, h));

	// Cross-section falloff and a soft silhouette edge.
	float inside = 1.0 - smoothstep(0.70, 1.02, abs(s));

	// ---- turbulence --------------------------------------------------------
	float turb = fbm(vec2(theta * 2.0 + time * 0.7, hc * 7.0 - time * 1.6));

	// ---- fast spiral ribbons wrapping and climbing the funnel --------------
	vec3 col = vec3(0.0);
	float coverage = 0.0;

	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		// Ribbon phase: wraps around the circumference, climbs with height,
		// and spins fast with time; turbulence breaks up the bands.
		float phase = theta * (3.0 + fi * 1.5)
				+ hc * (7.0 + fi * 2.5)
				- time * (4.2 + fi * 1.1)
				+ fi * 1.9;
		phase += turb * (2.2 + fi * 0.8);

		// Thin bright ribbons.
		float rib = pow(0.5 + 0.5 * sin(phase), 7.0 - fi);

		// Each layer hugs a slightly different shell of the funnel.
		float shell = 1.0 - smoothstep(0.55, 1.05, abs(s) / (0.90 + fi * 0.06));

		float layer = rib * shell * env;
		col += mix(COL_CYAN, COL_DUST, clamp(turb + fi * 0.2, 0.0, 1.0))
				* layer * (0.95 - fi * 0.20);
		coverage += layer * (0.75 - fi * 0.15);
	}

	// ---- deep teal shadow filling the funnel interior ----------------------
	float interior = inside * env;
	col += COL_TEAL * interior * (0.35 + 0.30 * turb);
	coverage += interior * 0.10;

	// ---- faint bright rim catching one silhouette edge ---------------------
	float rim = smoothstep(0.55, 1.0, clamp(-s, 0.0, 1.0)) * env;
	rim *= 0.6 + 0.4 * vnoise(vec2(hc * 9.0 - time * 2.2, 3.7));
	col += mix(COL_DUST, COL_CYAN, 0.45) * rim * 0.90;
	coverage += rim * 0.35;

	// Thin darker bands separating the ribbons (teal shadow wedges).
	float darkBand = 0.5 + 0.5 * sin(theta * 3.0 + hc * 5.0 - time * 1.4);
	col *= 1.0 - 0.45 * darkBand * inside;

	// Pale dust flecks kicked off the ribbon edges.
	float fleck = smoothstep(0.70, 0.98, fbm(vec2(theta * 4.0 - time * 2.4, hc * 12.0 + time * 0.5)));
	col += COL_DUST * fleck * interior * 0.55;
	coverage += fleck * interior * 0.22;

	// ---- tone map + coverage (transparent overlay) -------------------------
	col = 1.0 - exp(-1.6 * max(col, 0.0));
	col = clamp(col, 0.0, 1.0);

	coverage = clamp(coverage * 0.9, 0.0, 1.0);

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
