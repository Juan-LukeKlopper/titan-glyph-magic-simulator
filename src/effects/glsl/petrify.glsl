// petrify.glsl - Glyph Magic Simulator shader burst (petrification curse).
//
// One focal effect anchored on the cast point: a calcifying wave that creeps
// outward as a jagged grey stone crust (#636E72). The advancing rim burns hot
// amber, a polygonal crack network glows through the surface, and grey dust
// motes plus small stone shards flake off the edge as it spreads. Coverage
// falls to 0 ahead of the crust front so the canvas shows through instead of
// blacking out the surface.
//
// Everything is analytic (value-noise fbm + a 3x3 voronoi crack field) and
// measured in screen-height units, so the crust is a true circle whatever the
// canvas aspect. Fixed loop bounds only: fbm is 5 taps, the crack field is a
// constant 3x3 neighbourhood.
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

// Stone grey #636E72 with its shaded variants, plus the hot amber fissures.
const vec3 COL_STONE = vec3(0.3882, 0.4314, 0.4471);
const vec3 COL_STONE_DK = vec3(0.1350, 0.1600, 0.1750);
const vec3 COL_STONE_LT = vec3(0.6200, 0.6700, 0.6900);
const vec3 COL_AMBER = vec3(1.0000, 0.6196, 0.2353);
const vec3 COL_AMBER_HOT = vec3(1.0000, 0.9200, 0.6700);
const vec3 COL_FIRE = vec3(1.0000, 0.4627, 0.4588);

// Two-tap hashes (fire/portal style) for the value noise and flake grid.
float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
	vec2 q = fract(p * vec2(123.34, 456.21));
	q += dot(q, q + 45.32);
	return fract(vec2(q.x * q.y, q.x + q.y));
}

float vnoise(vec2 x) {
	vec2 i = floor(x);
	vec2 f = fract(x);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 5-octave value fbm, closed form (5 constant iterations).
float fbm(vec2 x) {
	float f = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		f += a * vnoise(x);
		x = x * 2.03 + vec2(1.7, 9.2);
		a *= 0.5;
	}
	return f;
}

// F2 - F1 voronoi distance: thin lines along the cell borders read as the
// polygonal crack network of a plate-like stone surface (constant 3x3
// neighbourhood, values in roughly 0..0.3).
float crackField(vec2 x) {
	vec2 n = floor(x);
	vec2 f = fract(x);
	float f1 = 8.0;
	float f2 = 8.0;
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 g = vec2(float(i), float(j));
			vec2 o = hash22(n + g);
			vec2 d = g + o - f;
			float dd = dot(d, d);
			if (dd < f1) {
				f2 = f1;
				f1 = dd;
			} else if (dd < f2) {
				f2 = dd;
			}
		}
	}
	return sqrt(f2) - sqrt(f1);
}

// One flake layer: every grid cell holds a grain that drifts radially away
// from the cast point. Grains sitting near the advancing crust front light
// up, so the layer reads as dust and shards spalling off the edge.
float flakeLayer(vec2 p, float t, float cell, vec2 off, float softK,
		float front, float band, float driftDist) {
	vec2 g = p / cell + off;
	vec2 id = floor(g);
	vec2 cc = (id - off + 0.5) * cell;
	vec2 h = hash22(id + off * 1.7 + 3.1);
	float r0 = length(cc);
	vec2 dir = r0 > 0.0001 ? cc / r0 : vec2(1.0, 0.0);
	float speed = 0.5 + 0.9 * h.x;
	float ph = fract(h.y * 7.13 + off.x * 0.37);
	float drift = fract(t * speed * 0.22 + ph);
	vec2 pos = cc + dir * (drift * driftDist)
		+ vec2(h.y - 0.5, h.x - 0.5) * cell * 0.9;
	vec2 d = p - pos;
	float life = 0.35 + 0.65 * sin(PI * drift);
	float glow = exp(-dot(d, d) * softK) * life;
	float rp = length(pos);
	float bd = (rp - front) / band;
	float nearFront = exp(-bd * bd);
	float outsideCrust = smoothstep(front - 0.050, front + 0.012, rp);
	return glow * nearFront * outsideCrust;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;

	// Aspect-correct local space centred on the cast point (screen height = 1).
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 p = vec2((uv.x - u_castPos.x) * (iResolution.x / max(iResolution.y, 1.0)),
		uv.y - u_castPos.y);
	float r = length(p);
	float ang = atan(p.y, p.x);

	// ---- advancing calcification front ------------------------------------
	// Ease-out growth: the curse races outward at first, then keeps creeping.
	float grow = clamp(time / 2.4, 0.0, 1.0);
	float creep = clamp((time - 2.4) * 0.04, 0.0, 0.10);
	float rad = mix(0.05, 0.46, 1.0 - pow(1.0 - grow, 2.4)) + creep;

	// Jagged, organic edge: two noise octaves gate the front radius plus a
	// low-order angular wobble, so the crust creeps out in blunt fingers.
	float jagN = fbm(p * 5.4 + vec2(0.0, time * 0.06));
	float jagN2 = fbm(p * 12.6 + vec2(5.3, 2.7));
	float jag = 0.70 * jagN + 0.30 * jagN2;
	float front = rad * (0.84 + 0.36 * jag) + 0.012 * sin(ang * 7.0 + jagN * 8.0);
	front = max(front, 0.004);

	// Crust interior mask, the hot rim riding exactly on the front, and a
	// 0..1 ramp that says how freshly the stone there was petrified.
	float crust = 1.0 - smoothstep(front - 0.020, front + 0.006, r);
	float rimD = (r - front) / 0.032;
	float rim = exp(-rimD * rimD);
	float fresh = smoothstep(0.0, front, r);

	// ---- stone body: chiselled relief lit from the upper left -------------
	float relief = fbm(p * 9.6 + vec2(2.0, 1.0));
	float micro = vnoise(p * 34.0);
	float mx = vnoise((p + vec2(0.02, 0.0)) * 34.0) - micro;
	float my = vnoise((p + vec2(0.0, 0.02)) * 34.0) - micro;
	vec3 nrm = normalize(vec3(-mx * 42.0, -my * 42.0, 1.0));
	vec3 ldir = normalize(vec3(-0.42, 0.70, 0.58));
	float diff = clamp(dot(nrm, ldir), 0.0, 1.0);
	float ao = 0.55 + 0.45 * (1.0 - fresh);

	vec3 stone = mix(COL_STONE_DK, COL_STONE, clamp((0.30 + 0.90 * diff) * ao, 0.0, 1.0));
	stone *= 0.72 + 0.60 * relief;
	stone += COL_STONE_LT * pow(clamp(relief, 0.0, 1.0), 3.0) * 0.30;

	// ---- crack network with glowing amber fissure veins -------------------
	float warp = fbm(p * 4.6 + vec2(0.0, time * 0.05));
	vec2 cq = p * 5.2 + vec2(warp * 1.2, warp * 0.9);
	float cd = crackField(cq);
	float cw = 0.018 + 0.036 * warp;
	float crack = 1.0 - smoothstep(0.0, cw, cd);
	float crackCore = 1.0 - smoothstep(0.0, cw * 0.40, cd);

	// Heat varies across the surface and pulses outward along the fissures;
	// the freshest stone near the rim burns brightest.
	float region = vnoise(p * 3.4 + vec2(3.4, 8.1));
	float heat = 0.30 + 0.95 * region;
	float pulse = 0.55 + 0.45 * sin(r * 34.0 - time * 3.0 + jagN * 9.0);
	pulse = clamp(pulse, 0.0, 1.4);
	float freshHeat = mix(0.40, 1.25, fresh);
	float crackGlow = crack * heat * pulse * freshHeat * crust;

	// Recess the stone along each crack, then pour the amber light in.
	stone = mix(stone, COL_STONE_DK, crack * 0.65 * crust);

	vec3 col = stone;
	col += COL_AMBER * crackGlow * 1.10;
	col += COL_AMBER_HOT * crackCore * heat * pulse * freshHeat * crust * 0.55;

	// ---- advancing rim: the curse burning its way outward -----------------
	col += COL_AMBER * rim * 1.30 * (0.70 + 0.55 * pulse);
	float rimCoreD = (r - front) / 0.014;
	col += COL_AMBER_HOT * exp(-rimCoreD * rimCoreD) * 0.95;
	float haloD = (r - front) / 0.085;
	col += COL_FIRE * exp(-haloD * haloD) * 0.22;

	// ---- dust motes and stone shards spalling off the edge ----------------
	float dust = flakeLayer(p, time, 0.170, vec2(0.0, 0.0), 9000.0, front, 0.10, 0.10);
	dust += flakeLayer(p, time, 0.130, vec2(7.3, 3.1), 15000.0, front, 0.12, 0.09);
	float shards = flakeLayer(p, time, 0.290, vec2(4.7, 9.2), 1500.0, front, 0.09, 0.13);
	dust = clamp(dust, 0.0, 1.0);
	shards = clamp(shards, 0.0, 1.0);

	col += COL_STONE_LT * dust * 0.34;
	col += COL_AMBER_HOT * dust * dust * 0.16;
	vec3 shardCol = mix(COL_STONE_LT, COL_AMBER, 0.35);
	col += shardCol * shards * 0.70;
	col += COL_AMBER_HOT * shards * shards * 0.30;

	// Gentle rolloff so the hottest crack pixels never clip harshly.
	col = clamp(col, 0.0, 6.0);
	col = 1.0 - exp(-1.35 * col);

	// Coverage tracks the crust, its rim and the flakes, and dies to 0 ahead
	// of the front so the canvas behind the burst keeps showing through.
	float coverage = crust * 0.95 + rim * 0.55 + dust * 0.40 + shards * 0.80;
	coverage = clamp(coverage, 0.0, 1.0);

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
