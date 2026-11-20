#!/usr/bin/env python3
"""Crop the v25 identity references out of images already in the repo.

Parchment medallion and name band: letter-target-*-face.jpg (these are also
the MindAR parchment targets, 1003x1118).
Cartoon face: cartoon-target-*.jpg, same rectangle the page samples.
The clean/scroll portraits are the existing portrait-*-clean.jpg files;
this script does not regenerate those.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEACHERS = ['stephanie', 'zelie', 'abigail', 'isin']
# Pixel rects on the 1003x1118 face crops. Kept in sync with identity-v25.js.
MED = (72, 41, 932, 901)
NAME = (90, 905, 930, 1005)
CARTOON = (0.20, 0.22, 0.80, 0.70)

def main():
    for t in TEACHERS:
        face = Image.open(ROOT / f'letter-target-{t}-face.jpg').convert('RGB')
        face.crop(MED).save(ROOT / f'idref-v25-medallion-{t}.jpg', quality=90)
        face.crop(NAME).save(ROOT / f'idref-v25-name-{t}.jpg', quality=92)
        cartoon = Image.open(ROOT / f'cartoon-target-{t}.jpg').convert('RGB')
        w, h = cartoon.size
        x0, y0, x1, y1 = CARTOON
        box = (int(w * x0), int(h * y0), int(w * x1), int(h * y1))
        cartoon.crop(box).save(ROOT / f'idref-v25-cartoon-{t}.jpg', quality=90)
        print(t, 'medallion', face.crop(MED).size, 'name', face.crop(NAME).size, 'cartoon', box)

if __name__ == '__main__':
    main()
