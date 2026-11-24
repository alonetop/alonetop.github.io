import type { Env, Frame, Piece } from "ascii.rest";

/**
 * Pads a coloured dot-matrix scene (built for misty-forest) with generated
 * rows above and below so a landscape screen can show the full panorama
 * edge to edge without empty letterbox bands.
 *
 *  - above: the sky keeps deepening overhead, with sparse twinkling stars
 *  - below: the dark mossy floor continues, with a few drifting patches of light
 *
 * Both bands start from the scene's own edge row so the seam is continuous.
 */

const DOTS = " ·•●";
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);

// misty-forest palette indices
const SKY_DEEP = [28, 29, 30, 31]; // #6f93a2 → #2b4a5a, deepening overhead
const STAR_COOL = 6; // #e4ebe6
const STAR_WARM = 1; // #fff0c8
const FLOOR_DARK = [17, 18, 19]; // #1f3c37 → #11231f
const MOSS = [22, 21, 20]; // #6d7440 → #a4a35a
const SUN_PATCH = [3, 4]; // #f2c97e, #e0a95e

function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const toStep = (level: number, x: number, r: number) =>
  Math.max(0, Math.min(3, Math.round(level * 3 + BAYER[(r & 3) * 4 + (x & 3)])));

export function extendPiece(mod: Piece, pad: number): Piece {
  const W = mod.meta.cols;
  const H = mod.meta.rows;
  const H2 = H + pad * 2;

  return {
    meta: { ...mod.meta, rows: H2 },
    default(options) {
      const inner: Frame = mod.default(options);
      const innerColor = new Uint8Array(W * H);

      return (t: number, env: Env = {}) => {
        const color = env.color;
        const text = inner(t, { ...env, color: color ? innerColor : undefined });
        const lines = text.split("\n");
        const firstRow = lines[0] ?? "";
        const lastRow = lines[H - 1] ?? "";
        const out: string[] = [];

        // ── sky above ──────────────────────────────────────────────
        for (let r = 0; r < pad; r++) {
          const u = (pad - r) / pad; // 0 at the seam → 1 at the top edge
          let row = "";
          for (let x = 0; x < W; x++) {
            const k = r * W + x;
            const seamStep = Math.max(0, DOTS.indexOf(firstRow[x] ?? " "));
            const base = (seamStep / 3) * Math.pow(1 - u, 1.1);
            const haze = 0.22 * Math.pow(1 - u, 0.8) * noise(x * 0.06 + t * 0.05, r * 0.2);
            let step = toStep(base + haze, x, r);
            let ci = SKY_DEEP[Math.min(3, Math.floor(u * 4))];
            if (u < 0.12 && color) ci = innerColor[x];

            // sparse twinkling stars, thinning toward the seam
            const hs = hash(x * 3 + 11, r * 7 + 5);
            if (u > 0.25 && hs < 0.014 * u) {
              const h2 = hash(x, r);
              const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + h2 * 1.6) + h2 * 40);
              const s = tw > 0.82 ? 2 : tw > 0.25 ? 1 : 0;
              if (s > step) {
                step = s;
                ci = h2 < 0.25 ? STAR_WARM : STAR_COOL;
              }
            }
            row += DOTS[step];
            if (color) color[k] = ci;
          }
          out.push(row);
        }

        // ── the scene itself ───────────────────────────────────────
        for (let r = 0; r < H; r++) out.push(lines[r] ?? "");
        if (color) color.set(innerColor, pad * W);

        // ── forest floor below ─────────────────────────────────────
        for (let r = 0; r < pad; r++) {
          const u = (r + 1) / pad; // 0 at the seam → 1 at the bottom edge
          const rr = H + pad + r;
          let row = "";
          for (let x = 0; x < W; x++) {
            const k = rr * W + x;
            const seamStep = Math.max(0, DOTS.indexOf(lastRow[x] ?? " "));
            const base = (seamStep / 3) * Math.pow(1 - u, 1.3);
            const moss = noise(x * 0.09, r * 0.35 + 3.1);
            const mossLevel = 0.32 * clamp((moss - 0.45) * 2.4) * (1 - 0.6 * u);
            let step = toStep(Math.max(base, mossLevel), x, rr);
            let ci =
              u < 0.1 && color
                ? innerColor[(H - 1) * W + x]
                : mossLevel > base
                  ? MOSS[Math.min(2, Math.floor(moss * 2.4))]
                  : FLOOR_DARK[Math.min(2, Math.floor(u * 3))];

            // a few patches of sunlight drifting across the floor
            const patch = noise(x * 0.05 + t * 0.04, r * 0.18 + 9.7);
            const flicker = 0.85 + 0.15 * Math.sin(t * 1.3 + x * 0.21 + r * 0.4);
            const light = clamp((patch - 0.74) * 4) * flicker * (1 - 0.5 * u);
            if (light > 0.15) {
              const s = toStep(0.25 + light * 0.55, x, rr);
              if (s >= step) {
                step = s;
                ci = light > 0.6 ? SUN_PATCH[0] : light > 0.35 ? SUN_PATCH[1] : MOSS[2];
              }
            }
            row += DOTS[step];
            if (color) color[k] = ci;
          }
          out.push(row);
        }

        return out.join("\n");
      };
    },
  };
}
