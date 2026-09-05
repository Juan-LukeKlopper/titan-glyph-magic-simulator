// barrier.glsl - Glyph Magic Simulator shader burst (safety hover spell).
//
// A protective anti-gravity energy dome anchored at the cast point: a
// glowing cyan hemisphere / shield bubble with a bright fresnel rim, a
// slowly pulsing hexagonal energy grid across its curved surface, and a
// faint drift of upward anti-gravity motes lifting inside it. Palette:
// portal cyan #81ECEC and safety teal #00CEC9.
//
// Design notes: radial coordinates are in "half the box height" units so
// the dome is a true circle regardless of aspect. Only the rim, the hex
// grid lines and the motes carry any coverage - the interior stays mostly
// transparent so the canvas behind the bubble shows through, and nothing
// is drawn beyond the dome silhouette.
//
// SPDX-License-Identifier: MIT  (authored for the Glyph Magic Simulator;
// repo LICENSE: MIT)

precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform vec2 u_castPos;
uniform float u_alpha;

const vec3 COL_CYAN = vec3(0.5059, 0.9255, 0.9255); // #81ECEC
const vec3 COL_TEAL = vec3(0.0000, 0.8078, 0.7882); // #00CEC9

// Procedural hash for the mote field.
vec2 hash2(vec2 p) {
	return fract(sin(vec2(dot(p, vec2(127.1, 311.7)),
	                      dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// Distance from the centre of a hex cell to its edge (0 = centre, 0.5 = edge).
float hexDist(vec2 p) {
	p = abs(p);
	return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}

// Local position inside the nearest hex cell of the honeycomb lattice.
vec2 hexLocal(vec2 uv) {
	vec2 h = vec2(0.5, 0.8660254);
	vec2 a = mod(uv, vec2(1.0, 1.7320508)) - h;
	vec2 b = mod(uv - h, vec2(1.0, 1.7320508)) - h;
	return dot(a, a) < dot(b, b) ? a : b;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;

	// Aspect-correct coordinates centred on the cast point.
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 p = vec2((uv.x - u_castPos.x) * (iResolution.x / max(iResolution.y, 1.0)),
	              uv.y - u_castPos.y);
	float r = length(p);
	float ang = atan(p.y, p.x);

	float domeR = 0.62;

	// Soft interior mask: 1 well inside the dome, 0 at / after the rim.
	float inside = 1.0 - smoothstep(domeR - 0.015, domeR, r);

	// ---- pulsing hexagonal energy grid across the dome surface --------------
	vec2 gv = hexLocal(p * 6.2);
	float edgeDist = 0.5 - hexDist(gv);
	float line = 1.0 - smoothstep(0.0, 0.045, edgeDist);
	// The grid rides the curved shell, so it fades out towards the rim.
	float surf = smoothstep(0.0, 0.24, domeR - r);
	float pulse = 0.55 + 0.45 * sin(time * 2.2 - r * 9.0);
	float grid = line * surf * inside * pulse;
	vec3 gridCol = mix(COL_TEAL, COL_CYAN, 0.5 + 0.5 * sin(time * 1.3 + ang * 2.0));

	// ---- bright fresnel rim (the dome silhouette) ---------------------------
	float rimD = (r - domeR) / 0.018;
	float rim = exp(-rimD * rimD);
	float fres = 0.78 + 0.22 * sin(time * 3.0 + ang * 3.0);
	vec3 rimCol = mix(COL_CYAN, vec3(1.0, 1.0, 1.0), 0.5);

	// ---- soft inner halo plus a thin inner energy film ----------------------
	float glowD = (r - domeR) / 0.090;
	float glow = exp(-glowD * glowD) * inside;
	float rim2D = (r - domeR * 0.94) / 0.006;
	float rim2 = exp(-rim2D * rim2D) * inside;

	// ---- upward anti-gravity motes lifting inside the dome ------------------
	vec2 q = vec2(p.x + 0.03 * sin(time * 0.8 + p.y * 5.0), p.y - time * 0.16);
	vec2 cell = floor(q * 7.5);
	vec2 hp = hash2(cell);
	vec2 centre = (cell + 0.55 + (hp - 0.5) * 0.6) / 7.5;
	float md = length(q - centre);
	float mote = exp(-md * md * 900.0) * step(0.45, hp.x);
	float twinkle = 0.4 + 0.6 * sin(time * 3.0 + hp.x * 40.0);
	float moteMask = inside * (1.0 - smoothstep(domeR * 0.35, domeR * 0.95, r));
	float moteTerm = mote * twinkle * moteMask;
	vec3 moteCol = mix(COL_CYAN, vec3(0.85, 1.0, 1.0), hp.y);

	// ---- assemble -----------------------------------------------------------
	vec3 col = vec3(0.0);
	col += gridCol * grid * 0.80;
	col += rimCol * rim * 1.25 * fres;
	col += COL_CYAN * glow * 0.20;
	col += COL_CYAN * rim2 * 0.30 * (0.6 + 0.4 * sin(time * 2.0));
	col += moteCol * moteTerm * 0.90;

	col = min(col, vec3(1.2));
	col = clamp(col, 0.0, 1.0);

	// Only the rim, the grid lines and the motes cover the canvas; the rest of
	// the dome is left fully transparent.
	float coverage = clamp(rim + 0.80 * glow + 0.70 * rim2 + grid + moteTerm, 0.0, 1.0);
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
