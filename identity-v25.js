// v25 recognition math. No DOM, no network — the page and the node tests share it.
//
// MindAR's target index is not an identity. At a distance the shared letter
// design locks the wrong teacher, and with maxTrack 1 the tracker then sticks
// to that plane. This module scores the portrait (and, on the parchment
// letters, the written name) against all four teachers and only accepts a
// winner that leads by a clear margin on several frames.

export const TEACHER_KEYS = ['stephanie', 'zelie', 'abigail', 'isin'];

export const SAMPLE = 96;
export const NAME_W = 72;
export const NAME_H = 36;
export const HP_DIV = 6;
export const SHIFT_RAD = 2;

// Tuned on the letter crops under warm light, blur, jpeg and downscale.
// A miss returns "not sure" — it does not start the other teacher's story.
export const PORTRAIT_MIN = 0.45;
export const PORTRAIT_STRONG = 0.55;
export const PORTRAIT_MARGIN = 0.16;
export const NAME_MIN = 0.45;
export const NAME_MARGIN = 0.20;

export const MIN_WIDTH = 80;
export const LARGE_WIDTH = 150;
export const CONFIRM_FRAMES = 3;
export const DROP_AFTER_MS = 2800;

const MED_W = 1003;
const MED_H = 1118;

// Normalized rects on each MindAR target. v is top-down.
// Parchment rects are measured on letter-target-*-face.jpg (the compiled target).
// Clean rect is the portrait window used by the v24 targets2 crops.
// Cartoon rect is the face on cartoon-target-*.jpg, which separates much
// more cleanly than the shared autumn border.
export const RECTS = {
  parchment: {
    portrait: [72 / MED_W, 41 / MED_H, 932 / MED_W, 901 / MED_H],
    name: [90 / MED_W, 905 / MED_H, 930 / MED_W, 1005 / MED_H],
  },
  clean: {
    portrait: [0.13, 0.03, 0.87, 0.66],
    name: null,
  },
  cartoon: {
    portrait: [0.20, 0.22, 0.80, 0.70],
    name: null,
  },
};

export const TARGET_ASPECT = {
  parchment: MED_H / MED_W,
  clean: 978 / 1095,
  cartoon: 1,
};

export function rankScores(scores) {
  let bestI = 0;
  let secondI = 1;
  if (scores[1] > scores[0]) { bestI = 1; secondI = 0; }
  for (let i = 2; i < scores.length; i++) {
    if (scores[i] > scores[bestI]) { secondI = bestI; bestI = i; }
    else if (scores[i] > scores[secondI]) secondI = i;
  }
  return {
    winner: bestI,
    second: secondI,
    best: scores[bestI],
    secondScore: scores[secondI],
    margin: scores[bestI] - scores[secondI],
    scores,
  };
}

export function judge(portraitScores, nameScores) {
  const p = rankScores(portraitScores);
  if (!(p.best >= PORTRAIT_MIN) || !(p.margin >= PORTRAIT_MARGIN)) {
    return { ok: false, reason: 'portrait', portrait: p, name: nameScores ? rankScores(nameScores) : null };
  }
  let name = null;
  if (nameScores) {
    name = rankScores(nameScores);
    const strong = name.best >= NAME_MIN && name.margin >= NAME_MARGIN;
    if (strong && name.winner !== p.winner) {
      return { ok: false, reason: 'name', portrait: p, name };
    }
  }
  return { ok: true, winner: p.winner, portrait: p, name };
}

export function createGate() {
  let streakW = -1;
  let streakN = 0;
  let largeMs = 0;
  let teacher = null;
  return {
    teacher: () => teacher,
    reset() { streakW = -1; streakN = 0; largeMs = 0; teacher = null; },
    step({ width, portraitScores, nameScores, dtMs, requireStrong }) {
      if (teacher !== null) return { phase: 'playing', teacher };
      if (!(width >= MIN_WIDTH)) {
        streakW = -1; streakN = 0; largeMs = 0;
        return { phase: 'closer' };
      }
      let j = judge(portraitScores, nameScores);
      // A modest score can be the right face seen through the wrong target
      // (a poster locking a letter target). Require a stronger score before
      // trusting that plane; a weaker pass is allowed only after one re-detect.
      if (j.ok && requireStrong && j.portrait.best < PORTRAIT_STRONG) {
        j = { ok: false, reason: 'weak', portrait: j.portrait, name: j.name };
      }
      if (!j.ok && width >= LARGE_WIDTH) largeMs += dtMs || 0;
      else largeMs = 0;
      if (!j.ok) {
        streakW = -1; streakN = 0;
        return { phase: 'hold', drop: largeMs >= DROP_AFTER_MS, judge: j };
      }
      if (streakW === j.winner) streakN += 1;
      else { streakW = j.winner; streakN = 1; }
      if (streakN >= CONFIRM_FRAMES) {
        teacher = j.winner;
        return { phase: 'confirm', teacher, judge: j };
      }
      return { phase: 'hold', count: streakN, judge: j };
    },
  };
}

function lumaAt(rgba, w, i) {
  const o = i * 4;
  return 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
}

export function resizeRGBA(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4);
  const xScale = sw / dw;
  const yScale = sh / dh;
  for (let y = 0; y < dh; y++) {
    const fy = (y + 0.5) * yScale - 0.5;
    let y0 = Math.floor(fy);
    let y1 = y0 + 1;
    let ty = fy - y0;
    if (y0 < 0) { y0 = 0; ty = 0; }
    if (y1 >= sh) y1 = sh - 1;
    if (y0 >= sh) y0 = sh - 1;
    for (let x = 0; x < dw; x++) {
      const fx = (x + 0.5) * xScale - 0.5;
      let x0 = Math.floor(fx);
      let x1 = x0 + 1;
      let tx = fx - x0;
      if (x0 < 0) { x0 = 0; tx = 0; }
      if (x1 >= sw) x1 = sw - 1;
      if (x0 >= sw) x0 = sw - 1;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * dw + x) * 4;
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      for (let c = 0; c < 4; c++) {
        out[o + c] = src[i00 + c] * w00 + src[i10 + c] * w10 + src[i01 + c] * w01 + src[i11 + c] * w11;
      }
    }
  }
  return out;
}

export function highpassLuma(rgba, w, h, div = HP_DIV) {
  const dw = Math.max(1, Math.floor(w / div));
  const dh = Math.max(1, Math.floor(h / div));
  const small = resizeRGBA(rgba, w, h, dw, dh);
  const blur = resizeRGBA(small, dw, dh, w, h);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = lumaAt(rgba, w, i) - lumaAt(blur, w, i);
  return out;
}

export function preparePortrait(rgba, w, h) {
  const small = resizeRGBA(rgba, w, h, SAMPLE, SAMPLE);
  return highpassLuma(small, SAMPLE, SAMPLE, HP_DIV);
}

function ncc(a, b, aOff, bOff, rowA, rowB, width, height, strideA, strideB) {
  let n = 0;
  let ma = 0;
  let mb = 0;
  for (let y = 0; y < height; y++) {
    const ia = aOff + y * strideA;
    const ib = bOff + y * strideB;
    for (let x = 0; x < width; x++) { ma += a[ia + x]; mb += b[ib + x]; n++; }
  }
  if (!n) return 0;
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let y = 0; y < height; y++) {
    const ia = aOff + y * strideA;
    const ib = bOff + y * strideB;
    for (let x = 0; x < width; x++) {
      const da = a[ia + x] - ma;
      const db = b[ib + x] - mb;
      sab += da * db; saa += da * da; sbb += db * db;
    }
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

export function shiftNcc(sample, ref, w, h, rad = SHIFT_RAD) {
  let best = -1;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      const y0 = Math.max(0, dy);
      const y1 = Math.min(h, h + dy);
      const x0 = Math.max(0, dx);
      const x1 = Math.min(w, w + dx);
      const height = y1 - y0;
      const width = x1 - x0;
      if (width < w * 0.7 || height < h * 0.7) continue;
      // sample[y, x] aligns with ref[y - dy, x - dx]
      const sOff = y0 * w + x0;
      const rOff = (y0 - dy) * w + (x0 - dx);
      const s = ncc(sample, ref, sOff, rOff, 0, 0, width, height, w, w);
      if (s > best) best = s;
    }
  }
  return best;
}

export function scoreAgainst(sample, refs) {
  const scores = refs.map((ref) => shiftNcc(sample, ref, SAMPLE, SAMPLE, SHIFT_RAD));
  return rankScores(scores);
}

// Dark strokes against the local paper color, then the right-hand part of the
// line (the given name). "Madame" is shared, so the full line does not separate
// the teachers; the given name does.
export function prepareName(rgba, w, h) {
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = lumaAt(rgba, w, i);
  const dw = Math.max(1, Math.floor(w / 8));
  const dh = Math.max(1, Math.floor(h / 8));
  const small = resizeRGBA(rgba, w, h, dw, dh);
  const blur = resizeRGBA(small, dw, dh, w, h);
  const ink = new Uint8Array(w * h);
  const yCut = Math.floor(h * 0.78);
  let minX = w, maxX = -1, minY = h, maxY = -1, count = 0;
  for (let y = 0; y < yCut; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dark = L[i] + 16 < lumaAt(blur, w, i) && L[i] < 175;
      if (!dark) continue;
      ink[i] = 1;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const out = new Float32Array(NAME_W * NAME_H);
  if (count < 12 || maxX <= minX) return out;
  const span = maxX - minX;
  const cut = minX + Math.floor(span * 0.40);
  const subW = maxX - cut + 1;
  const subH = maxY - minY + 1;
  if (subW < 4 || subH < 4) return out;
  const sub = new Uint8Array(subW * subH * 4);
  for (let y = 0; y < subH; y++) {
    for (let x = 0; x < subW; x++) {
      const v = ink[(y + minY) * w + (x + cut)] ? 255 : 0;
      const o = (y * subW + x) * 4;
      sub[o] = sub[o + 1] = sub[o + 2] = v;
      sub[o + 3] = 255;
    }
  }
  const scaled = resizeRGBA(sub, subW, subH, NAME_W, NAME_H);
  for (let i = 0; i < NAME_W * NAME_H; i++) out[i] = scaled[i * 4] / 255;
  return out;
}

export function scoreName(sample, refs) {
  const scores = refs.map((ref) => shiftNcc(sample, ref, NAME_W, NAME_H, 2));
  return rankScores(scores);
}

function solve8(A, b) {
  const n = 8;
  const M = A.map((row, i) => row.concat(b[i]));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-10) return null;
    const tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
    const div = M[c][c];
    for (let k = c; k <= n; k++) M[c][k] /= div;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row) => row[n]);
}

// Map the unit square onto the four source-image corners (TL TR BR BL)
// and resample. Perspective, not just a bilinear patch.
export function sampleQuad(src, sw, sh, corners, dw, dh) {
  const srcPts = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = srcPts[i];
    const [x, y] = corners[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  const h = solve8(A, b);
  const out = new Uint8Array(dw * dh * 4);
  if (!h) return out;
  const [h00, h01, h02, h10, h11, h12, h20, h21] = h;
  for (let j = 0; j < dh; j++) {
    const v = (j + 0.5) / dh;
    for (let i = 0; i < dw; i++) {
      const u = (i + 0.5) / dw;
      const den = h20 * u + h21 * v + 1;
      const x = (h00 * u + h01 * v + h02) / den;
      const y = (h10 * u + h11 * v + h12) / den;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const tx = x - x0;
      const ty = y - y0;
      const o = (j * dw + i) * 4;
      if (x0 < 0 || y0 < 0 || x0 + 1 >= sw || y0 + 1 >= sh) continue;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x0 + 1) * 4;
      const i01 = ((y0 + 1) * sw + x0) * 4;
      const i11 = ((y0 + 1) * sw + x0 + 1) * 4;
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      for (let c = 0; c < 4; c++) {
        out[o + c] = src[i00 + c] * w00 + src[i10 + c] * w10 + src[i01 + c] * w01 + src[i11 + c] * w11;
      }
    }
  }
  return out;
}

export function applyPhone(rgba, w, h, widthTarget) {
  // Warm indoor light, a smaller camera image, mild contrast loss.
  const scaledW = Math.max(8, widthTarget);
  const scaledH = Math.max(8, Math.round(h * (scaledW / w)));
  const small = resizeRGBA(rgba, w, h, scaledW, scaledH);
  for (let i = 0; i < scaledW * scaledH; i++) {
    const o = i * 4;
    small[o] = Math.min(255, small[o] * 1.12);
    small[o + 1] = Math.min(255, small[o + 1] * 1.0);
    small[o + 2] = Math.min(255, small[o + 2] * 0.82);
  }
  return { rgba: resizeRGBA(small, scaledW, scaledH, w, h), w, h };
}

export function cropRect(rgba, w, h, x0, y0, x1, y1) {
  const dw = x1 - x0;
  const dh = y1 - y0;
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      const o = (y * dw + x) * 4;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const s = (sy * w + sx) * 4;
      out[o] = rgba[s]; out[o + 1] = rgba[s + 1]; out[o + 2] = rgba[s + 2]; out[o + 3] = rgba[s + 3];
    }
  }
  return out;
}
