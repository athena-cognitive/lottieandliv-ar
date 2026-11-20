// Merge already-compiled MindAR targets into targets-v25.mind.
// Parchment letters + cartoons come from targets-letters-crop.mind
// (letter-target-*-face.jpg and cartoon-target-*.jpg).
// The clean/scroll letter is target 1 of each targets2-*.mind — those
// source crops were not saved as images, so the compiled target is reused.
//
// Order:
//   0-3 parchment  stephanie, zelie, abigail, isin
//   4-7 cartoon    stephanie, zelie, abigail, isin
//   8-11 clean     stephanie, zelie, abigail, isin
import { readFileSync, writeFileSync } from 'fs';
import { encode, decode } from '@msgpack/msgpack';

const letters = decode(readFileSync(new URL('../targets-letters-crop.mind', import.meta.url)));
if (letters.dataList.length !== 8) throw new Error('expected 8 targets in targets-letters-crop.mind');
const cleanOrder = ['stephanie', 'zelie', 'abigail', 'isin'];
const clean = cleanOrder.map((name) => {
  const file = decode(readFileSync(new URL(`../targets2-${name}.mind`, import.meta.url)));
  if (file.dataList.length !== 2) throw new Error('expected 2 targets in ' + name);
  return file.dataList[1];
});
const dataList = letters.dataList.concat(clean);
const dims = dataList.map((t) => `${t.targetImage.width}x${t.targetImage.height}`);
const expect = [
  '1003x1118', '1003x1118', '1003x1118', '1003x1118',
  '1600x1600', '1600x1600', '1600x1600', '1600x1600',
  '1095x978', '1095x978', '1095x978', '1095x978',
];
if (dims.join(',') !== expect.join(',')) throw new Error('unexpected dims ' + dims.join(','));
const buf = encode({ v: letters.v, dataList });
writeFileSync(new URL('../targets-v25.mind', import.meta.url), buf);
const back = decode(buf);
if (back.dataList.length !== 12 || back.v !== 2) throw new Error('roundtrip failed');
console.log('wrote targets-v25.mind', buf.length, 'bytes', dims.join(' '));
