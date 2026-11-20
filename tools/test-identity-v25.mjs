// Run: NODE_PATH is not enough for ESM. This file imports jpeg-js from a
// path passed as the first argument, defaulting to the sandbox install.
//   node tools/test-identity-v25.mjs
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import {
  TEACHER_KEYS, preparePortrait, prepareName, scoreAgainst, scoreName, judge,
  createGate, sampleQuad, cropRect, applyPhone, resizeRGBA, RECTS, PORTRAIT_MARGIN,
} from '../identity-v25.js';

const pkgCandidates = [
  new URL('../package.json', import.meta.url).pathname,
  '/tmp/np/package.json',
];
let jpeg = null;
for (const pkg of pkgCandidates) {
  if (!existsSync(pkg)) continue;
  try { jpeg = createRequire(pkg)('jpeg-js'); break; } catch (e) { /* try the next */ }
}
if (!jpeg) {
  console.error('This test needs jpeg-js@0.4.4 on NODE_PATH. From a scratch folder: npm install jpeg-js@0.4.4');
  process.exit(1);
}

const root = new URL('..', import.meta.url);

function loadJpeg(name) {
  const buf = readFileSync(new URL(name, root));
  const dec = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { rgba: dec.data, w: dec.width, h: dec.height };
}

function rgbaOf(img) {
  return img.rgba;
}

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ok  ' + name + (detail ? '  ' + detail : ''));
  else { failed++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
}

const teachers = TEACHER_KEYS;

const medRefs = teachers.map((t) => {
  const im = loadJpeg(`idref-v25-medallion-${t}.jpg`);
  return preparePortrait(im.rgba, im.w, im.h);
});
const nameRefs = teachers.map((t) => {
  const im = loadJpeg(`idref-v25-name-${t}.jpg`);
  return prepareName(im.rgba, im.w, im.h);
});
const cartoonRefs = teachers.map((t) => {
  const im = loadJpeg(`idref-v25-cartoon-${t}.jpg`);
  return preparePortrait(im.rgba, im.w, im.h);
});
const cleanRefs = teachers.map((t) => {
  const im = loadJpeg(`portrait-${t}-clean.jpg`);
  return preparePortrait(im.rgba, im.w, im.h);
});

const MED = [72, 41, 932, 901];
const NAME = [90, 905, 930, 1005];

function cropBox(im, box) {
  return cropRect(im.rgba, im.w, im.h, box[0], box[1], box[2], box[3]);
}

console.log('pristine parchment portraits and names');
teachers.forEach((t, i) => {
  const im = loadJpeg(`letter-target-${t}-face.jpg`);
  const med = cropBox(im, MED);
  const nm = cropBox(im, NAME);
  const ps = scoreAgainst(preparePortrait(med, MED[2] - MED[0], MED[3] - MED[1]), medRefs);
  const ns = scoreName(prepareName(nm, NAME[2] - NAME[0], NAME[3] - NAME[1]), nameRefs);
  const j = judge(ps.scores, ns.scores);
  check(
    t + ' pristine',
    j.ok && j.winner === i,
    `hp ${ps.best.toFixed(3)} m ${ps.margin.toFixed(3)} name ${ns.best.toFixed(3)} nm ${ns.margin.toFixed(3)}`,
  );
});

console.log('phone-like downscale + warm light, still aligned');
for (const width of [80, 140, 280, 1003]) {
  teachers.forEach((t, i) => {
    const im = loadJpeg(`letter-target-${t}-face.jpg`);
    const phone = width === 1003 ? im : applyPhone(im.rgba, im.w, im.h, width);
    const src = width === 1003 ? im.rgba : phone.rgba;
    const med = cropRect(src, im.w, im.h, ...MED);
    const nm = cropRect(src, im.w, im.h, ...NAME);
    const ps = scoreAgainst(preparePortrait(med, MED[2] - MED[0], MED[3] - MED[1]), medRefs);
    const ns = scoreName(prepareName(nm, NAME[2] - NAME[0], NAME[3] - NAME[1]), nameRefs);
    const j = judge(ps.scores, ns.scores);
    check(
      `${t} @ ${width}px`,
      j.ok && j.winner === i && ps.margin >= PORTRAIT_MARGIN,
      `hp ${ps.best.toFixed(3)} m ${ps.margin.toFixed(3)} nameBest ${ns.best.toFixed(3)} nameM ${ns.margin.toFixed(3)}`,
    );
  });
}

console.log('name band resampled to 336x40, the size the page samples');
teachers.forEach((t, i) => {
  const im = loadJpeg(`letter-target-${t}-face.jpg`);
  const native = cropBox(im, NAME);
  const nw = NAME[2] - NAME[0], nh = NAME[3] - NAME[1];
  const small = resizeRGBA(native, nw, nh, 336, 40);
  const ns = scoreName(prepareName(small, 336, 40), nameRefs);
  const j = judge(
    scoreAgainst(preparePortrait(cropBox(im, MED), MED[2] - MED[0], MED[3] - MED[1]), medRefs).scores,
    ns.scores,
  );
  check(t + ' name 336x40', j.ok && j.winner === i, `name ${ns.best.toFixed(3)} m ${ns.margin.toFixed(3)}`);
});

console.log('misaligned crop must not confirm the wrong teacher');
teachers.forEach((t, i) => {
  const im = loadJpeg(`letter-target-${t}-face.jpg`);
  const shifted = cropRect(im.rgba, im.w, im.h, MED[0] + 70, MED[1] + 40, MED[2] + 70, MED[3] + 40);
  const ps = scoreAgainst(preparePortrait(shifted, MED[2] - MED[0], MED[3] - MED[1]), medRefs);
  const j = judge(ps.scores, null);
  const wrong = j.ok && j.winner !== i;
  check(t + ' shifted 70px', !wrong, `ok ${j.ok} winner ${teachers[ps.winner]} m ${ps.margin.toFixed(3)} best ${ps.best.toFixed(3)}`);
});

console.log('cartoons');
teachers.forEach((t, i) => {
  const im = loadJpeg(`cartoon-target-${t}.jpg`);
  const [u0, v0, u1, v1] = RECTS.cartoon.portrait;
  const x0 = Math.round(im.w * u0), y0 = Math.round(im.h * v0);
  const x1 = Math.round(im.w * u1), y1 = Math.round(im.h * v1);
  const face = cropRect(im.rgba, im.w, im.h, x0, y0, x1, y1);
  const phone = applyPhone(face, x1 - x0, y1 - y0, 120);
  const ps = scoreAgainst(preparePortrait(phone.rgba, x1 - x0, y1 - y0), cartoonRefs);
  const j = judge(ps.scores, null);
  check(t + ' cartoon', j.ok && j.winner === i, `hp ${ps.best.toFixed(3)} m ${ps.margin.toFixed(3)}`);
});

console.log('clean portrait references separate on their own');
teachers.forEach((t, i) => {
  const im = loadJpeg(`portrait-${t}-clean.jpg`);
  const ps = scoreAgainst(preparePortrait(im.rgba, im.w, im.h), cleanRefs);
  const j = judge(ps.scores, null);
  check(t + ' clean ref', j.ok && j.winner === i, `hp ${ps.best.toFixed(3)} m ${ps.margin.toFixed(3)}`);
});

console.log('homography sample matches an axis-aligned crop');
{
  const im = loadJpeg('letter-target-abigail-face.jpg');
  const corners = [[MED[0], MED[1]], [MED[2], MED[1]], [MED[2], MED[3]], [MED[0], MED[3]]];
  const sampled = sampleQuad(im.rgba, im.w, im.h, corners, 96, 96);
  const direct = preparePortrait(cropBox(im, MED), MED[2] - MED[0], MED[3] - MED[1]);
  const via = preparePortrait(sampled, 96, 96);
  // both already 96-wide highpass; compare by scoring via against a one-ref set built from direct's source
  const ref = preparePortrait(cropBox(im, MED), MED[2] - MED[0], MED[3] - MED[1]);
  const s = scoreAgainst(via, [ref, medRefs[0], medRefs[2], medRefs[3]]);
  check('quad sample still abigail-like', s.winner === 0 && s.best > 0.9, `best ${s.best.toFixed(3)}`);
  void direct;
}

console.log('gate: far approach must not confirm, close correct scores must');
{
  const gate = createGate();
  const good = [0.92, 0.40, 0.48, 0.33]; // stephanie leads
  const weak = [0.55, 0.52, 0.50, 0.49];
  let phase = null;
  for (let i = 0; i < 12; i++) {
    phase = gate.step({ width: 36, portraitScores: good, nameScores: null, dtMs: 160 });
  }
  check('small target never confirms', phase.phase === 'closer' && gate.teacher() === null, phase.phase);
  for (let i = 0; i < 20; i++) {
    phase = gate.step({ width: 220, portraitScores: weak, nameScores: null, dtMs: 160 });
  }
  check('ambiguous close target does not confirm', gate.teacher() === null, phase.phase);
  check('ambiguous large target eventually asks for a fresh match', phase.drop === true, 'drop ' + phase.drop);
  gate.reset();
  let confirmed = null;
  for (let i = 0; i < 3; i++) {
    phase = gate.step({ width: 200, portraitScores: good, nameScores: [0.2, 0.15, 0.1, 0.1], dtMs: 160 });
    if (phase.phase === 'confirm') confirmed = phase.teacher;
  }
  check('three agreeing close frames confirm stephanie', confirmed === 0, 'teacher ' + confirmed);
  const after = gate.step({ width: 200, portraitScores: [0.2, 0.2, 0.95, 0.2], nameScores: null, dtMs: 160 });
  check('a later frame cannot switch the story', after.phase === 'playing' && after.teacher === 0);
}

console.log('gate: strong name contradiction blocks a portrait lead');
{
  const gate = createGate();
  const portrait = [0.90, 0.30, 0.40, 0.25]; // stephanie
  const name = [0.20, 0.15, 0.80, 0.10]; // abigail, strong
  let phase = null;
  for (let i = 0; i < 5; i++) phase = gate.step({ width: 220, portraitScores: portrait, nameScores: name, dtMs: 160 });
  check('contradiction never confirms', gate.teacher() === null && phase.phase === 'hold', phase.judge && phase.judge.reason);
}

console.log('gate: a modest score re-detects before it commits');
{
  const gate = createGate();
  const modest = [0.10, 0.08, 0.48, 0.12]; // abigail leads, but under the strong bar
  let phase = null;
  for (let i = 0; i < 6; i++) phase = gate.step({ width: 300, portraitScores: modest, nameScores: null, dtMs: 160, requireStrong: true });
  check('modest score does not confirm while a stronger plane may exist', gate.teacher() === null, phase.phase + ' ' + (phase.judge && phase.judge.reason));
  gate.reset();
  for (let i = 0; i < 3; i++) phase = gate.step({ width: 300, portraitScores: modest, nameScores: null, dtMs: 160, requireStrong: false });
  check('after one re-detect the same modest score may confirm', phase.teacher === 2, 'teacher ' + phase.teacher);
}

console.log('gate: the stuck wrong MindAR index is ignored');
{
  // Abigail's letter, but the tracker index would have been stephanie.
  const gate = createGate();
  const portrait = [0.41, 0.28, 0.88, 0.30]; // abigail
  const name = [0.10, 0.12, 0.70, 0.08];
  let phase = null;
  for (let i = 0; i < 3; i++) phase = gate.step({ width: 210, portraitScores: portrait, nameScores: name, dtMs: 160 });
  check('confirms abigail from the picture, not the tracker index', phase.teacher === 2, 'teacher ' + phase.teacher);
}

if (failed) {
  console.log('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nall checks passed');
