# Teacher AR recognition — v25

The links already in the teachers' hands are unchanged. `stephanie.html`, `zelie.html`, `abigail.html`, `isin.html`, and the `teachers.html` they open are the live v23 pages and this branch does not edit them. The proposal is a new page, `teachers-v25.html`. It plays the same four stories, the same sprites, and the same dialogue. Only the decision of *whose* story may start is new.

## Why a phone still mixes the teachers up

The letters share one design. MindAR's features at a coarse scale are the parchment, the round medallion, and the script under it. Those are the same on every letter. With `maxTrack: 1`, the first target that matches becomes the only target: matching stops, and the tracker follows that plane. On a slow walk-in, Abigail's letter can sit on Stéphanie's target for many seconds. The lock is steady, so a "hold still for 1.2 seconds" gate treats it as success.

v24 (`teachers2.html`) then asks a one-class question: does this crop clear *this* teacher's threshold? The measured raw portrait scores are about 0.85 for the right teacher and 0.73 for the wrong one. Print color, warm room light, and the phone's white balance move both numbers. A single sample can land on the wrong side of a fixed threshold. If the reference image fails to load, that gate returns a pass.

A desktop rig that shows a large, sharp, correctly colored frame never stays in that coarse lock, so it can pass while the phone fails. The owner's iPhone is the case that matters. The approach has to be survived, not only the static frame.

## One page, or four links?

One page is the more reliable recognizer.

A page that knows only one teacher can ask "is this mine?" MindAR will say yes to a coarse match, because that teacher is the only target loaded. A page that knows all four can score the same portrait against Stéphanie, Zélie, Abigail, and Işın and keep the story off until one of them leads by a clear margin. An ambiguous frame plays nothing. That is the safe failure. The failure the teachers are seeing is the other one: the wrong story, confidently.

One link is also the simpler thing to hand someone: the same address works for every letter and every poster. Four links only help if each page can refuse the other three letters. v23 and v24 cannot do that reliably, which is why the separate links still mix the teachers up.

The four named pages stay exactly as they were sent this morning. `teachers-v25.html` is the single link to try, and to send later if you want it to replace them. Publishing this branch does not change the old addresses.

## What recognition should key on

The tracker and the identity check are different jobs.

MindAR's job is to stick a plane to the paper so the story sits on the page. It needs a compiled target. It is a poor judge of *which* teacher, because the shared design wins at a distance and the lock then sticks.

Identity is a comparison of the whole set:

| Cue | What the images actually do |
| --- | --- |
| Full letter | The shared parchment and poem dominate. Cross-matches, as already measured. |
| Portrait, raw color | Right about 0.85, wrong about 0.73. Too tight once a print and a phone white-balance are in the way. |
| Portrait, high-pass luminance | The structure of the face, with the paper color removed. On the letter crops, the right face stays ahead by about 0.39 even after a shrink to a tiny frame, warm light, and blur. Stéphanie and Abigail, the pair that collides, land at 1.00 against 0.57 when the crop is aligned. |
| Whole name line, raw pixels | About 0.80 true against 0.78 cross. "Madame", the parchment, and the shared poem line are most of the pixels. |
| Given name, ink only | The right-hand name with the paper subtracted. On these crops the cross-scores fall to about 0.22. Resampled to the size the page uses, true scores are about 0.82–0.89 with margins about 0.43–0.64. A strong name that votes for a different teacher blocks the portrait. A faint name (the line is small when the phone is far) is ignored. |
| Cartoon poster | Much more separable than the letters. Face, hair, glasses, and clothes differ; the autumn border is shared and is not what we score. |

Gray hair, red glasses, freckles, and the black shirt versus the blue one are inside that high-pass portrait. They do not need a second color model. The cartoons are the strongest single anchor, and they are in the target set. The letters still have to work when the poster is not in the room, so the letter path keys on the medallion, with the given name as a veto on the parchment design.

The clean scroll's full artwork was not saved as a file. Its compiled target is the one already in `targets2-*.mind`, and its reference is the existing `portrait-*-clean.jpg`. Those four clean portraits separate cleanly from each other (high-pass margin about 0.67). The scroll still has to be checked on paper.

## What v25 does

`teachers-v25.html` loads one target set, `targets-v25.mind`:

- 0–3 parchment letters (the `letter-target-*-face.jpg` crops already used in v23), Stéphanie, Zélie, Abigail, Işın
- 4–7 cartoon posters
- 8–11 clean/scroll letters, taken from each `targets2-*.mind`

The target index is only which plane was found. The story is chosen like this:

1. While the portrait is under 80 pixels wide, nothing starts. The hint says to come closer. This is the coarse-scale part of a walk-in.
2. The portrait is lifted off the camera frame with the plane's corners and scored, high-pass, against all four references for that kind of target. A small shift search absorbs a few pixels of pose error.
3. On a parchment letter, the given-name ink is scored the same way. If that vote is strong and names a different teacher, the frame is rejected.
4. Three agreeing frames in a row start **that** teacher's story, on the plane that is actually tracked. A wrong index with a correctly aligned face still plays the right story.
5. A score under 0.55, or a large plane that stays ambiguous for about three seconds, drops the lock so MindAR searches again now that the page fills the frame. One drop is enough: a modest but consistent face can then start, so a poster is not stuck if the poster target itself is shy.
6. After the story starts, a later flicker cannot switch teachers.

Letter scenes use the same placement as the live page (`2.273`, `-0.681` on the parchment crop, `1, 0` on a poster). The clean targets use the placement already tuned for those crops in v24 (`2.083`, `-0.64`). Scene code, sprites, dialogue, and Charlotte's hair are the functions from `teachers.html`, copied unchanged.

No new runtime library. The page still uses three.js 0.160.0 and mind-ar 1.2.5 from the same CDNs. The new file is `identity-v25.js`. New images and the new `.mind` file are new names, so a cached copy of the live page cannot shadow them. The start screen says "preview v25" so a phone can show which page it opened.

References were cropped from files already in the repo by `tools/build-idrefs-v25.py`. The merged target file is rebuilt by `tools/build-targets-v25.mjs` (needs `@msgpack/msgpack@2.8.0`).

## How it was checked

`node tools/test-identity-v25.mjs` (needs `jpeg-js@0.4.4`) runs the real scoring code:

- All four parchment letters, pristine and after warm light plus a shrink to 80, 140, and 280 pixels, resolve to the right teacher.
- A crop shifted by 70 pixels does not confirm anyone.
- All four cartoons, and all four clean portrait references, resolve to the right teacher.
- The gate refuses a small target, refuses an ambiguous close target, asks for a fresh match when a large target stays ambiguous, confirms on three agreeing frames, and will not change teachers afterwards.
- A strong name that disagrees with the portrait blocks the story.
- Scores that would have been "Stéphanie's target, but the face is Abigail" confirm Abigail.

Headless Chrome, with the camera replaced by a video of the real artwork (software WebGL, mind-ar doing the actual track):

| Pointed at | Locked plane at the moment the story started | Story |
| --- | --- | --- |
| Stéphanie letter | parchment 0 | Stéphanie (0.62 vs Abigail 0.22) |
| Zélie letter | parchment 1 | Zélie (0.61 vs 0.13) |
| Abigail letter | parchment 2 | Abigail (0.65 vs Stéphanie 0.28) |
| Işın letter | parchment 3 | Işın (0.57 vs 0.15) |
| Stéphanie poster | cartoon 4, after a weak letter-plane (0.48) was dropped | Stéphanie (0.75 vs 0.14) |
| Zélie poster | cartoon 5, the same way | Zélie (0.72 vs 0.04) |
| Abigail poster | cartoon 6, the same way | Abigail (0.68 vs Stéphanie 0.10) |
| Işın poster | cartoon 7, the same way | Işın (0.60 vs 0.14) |
| Abigail letter, growing from small to large | Stéphanie's target while it was small, with flat scores and no story; Abigail's target once the portrait was large | Abigail |

The walk-in is the case that used to play the wrong story for 6–13 seconds. Here the early Stéphanie lock produced scores around 0.2 and played nothing.

The clean/scroll print was not in this camera run. Its target and its portrait references are loaded; the paper test below is the one that covers it.

## Try it on the iPhone

The addresses already sent to the teachers stay as they are. Use this only as the preview:

`teachers-v25.html`

on the same GitHub Pages host as the current cards, once this branch is what Pages serves. The old filenames are not part of this change, so serving the branch does not replace those links. The start screen must say **preview v25**. Anything else is a cached older page: close the tab and open the preview address again.

Add `?debug=1` if you want the four scores and a thumbnail of the patch being judged. The thumbnail should be the face. A thumbnail of poem text or of the table means the plane is mis-aimed; come a little closer and hold still.

For each teacher, point at:

1. Her parchment letter.
2. Her clean scroll letter.
3. Her cartoon poster.

Come in from across the table, the way it failed before, and also try it up close. Hold the phone still for about a second once the portrait is easy to see. You should get only her story:

- Stéphanie — the torn book, the tape, the classroom. Charlotte's hair is short and dry.
- Zélie — Charlotte arriving tired, then the table.
- Abigail — the rain, the towel, the boot. Wet hair only happens in this scene.
- Işın — the clothes loto and the stars.

The other three letters, and the other three posters, should not start her story. While the page is still far away, the hint should say to come closer, and no story should start. A letter that is too dim or too skewed should keep saying "hold steady" rather than start the wrong one.

Good light, the back camera, Safari. The camera picture stays on the phone.

## FIX-NOTES — overlapping stories and voices

The recognition on `teachers-sun-class.html` is unchanged. Thresholds, the gate, the targets, and the reference images are the same. Zélie's 1.2 second tracking-loss grace and her near-still pose freeze (position, rotation, and smoothed scale) are still in that file, with the same numbers. `teachers-v25.html` is the historical preview and was not edited. The named pages and `teachers.html` were not edited.

### What was actually going wrong

Two separate leaks, both of which grow as the page is used.

1. Start had no re-entry guard. The tap handler called `startAR()`, and `startAR()` constructed a `MindARThree`, a camera stream, and a render loop on every entry. A second tap — or a retry after the first start had already created the camera and then thrown — stacked a second session in the same tab. Each session has its own story and its own voice. That matches "more than one instance in the browser" with only one tab.

2. Inside one session, every confirmed target built a scene and pushed its per-frame updater into a list that runs forever. `stopStory()` only called `onTargetLost` on the one record in `playing`. Anything else that had already started kept its `foundAt` and its `voiceOn`. The scene builders still contain the old self-start: if `claimLock` fails, they set `pendingClaim`, and every frame the updater tries `pendingClaim && group.visible && claimLock(id)` on its own. `claimLock` also returns true when the owner id matches, and every copy of one teacher (parchment, clean, poster) uses the same id, so a second copy of her scene was allowed to start while the first was live. Two live scenes call two `dialogue.start()`s. Those are four separate audio elements, and `start()` did not stop the others, so the voices play together. A fresh load has no built scenes yet, so the first scan is fine. The pile-up appears after several scans.

### What changed

`playback-v25.js` is the only door.

- `enterSession()` succeeds once per page load. The Start tap claims it before any `await`. `startAR()` also refuses to construct a second MindAR if it is entered again.
- `play()` stops every scene that has been started, then silences every dialogue track, then arms exactly one scene. Starting the scene that is already playing does nothing, so a story is not restarted over itself.
- A built scene's updater is wrapped. If that scene is not the armed one, the wrapper returns immediately: no animation, no `pendingClaim` self-start, no audio.
- `dialogue.start()` now stops the other three tracks first, so a stray start cannot leave a second voice running.

Zélie's grace still returns out of `recognize()` for up to 1.2 seconds of total loss, which means `stopStory()` is not called and her armed updater keeps running. A different target still stops her at once, through the same `stopStory()`, which now stops her completely (scene hidden, her voice stopped, claim released) before any new story can start.

### How it was checked

`node tools/test-playback-v25.mjs` drives the real controller. Each fake scene's updater, if it is allowed to run, shows itself and starts its voice — the same thing `pendingClaim` does. The page's loop is simulated by calling every built updater after every change.

- A second and a third `enterSession()` are refused, and they leave nothing playing.
- 24 passes over 4 teachers × 3 surfaces, plus a quick switch and a "phone down" each pass: 360 scans. After every step, live scenes, audible tracks, and visible scenes were all exactly one. After each phone-down, all three were zero.
- Switching one teacher from her letter to her poster stops the letter instance. One voice remains.
- Playing the story that is already current does not start it again.
- The Sun Class page source still contains the 1.2 second Zélie grace and the `dPos < 0.03` pose-and-scale freeze.

The fake-camera rig can show one printed image to MindAR. It cannot put the phone down, pick up a different letter, and do that 20 times; that needs the real prints. The overlap is a session and playback bug, and the script above is the check for it.

### On the iPhone

Use the Sun Class link, `teachers-sun-class.html`. Leave `stephanie.html`, `zelie.html`, `abigail.html`, `isin.html`, and `teachers.html` as they are.

Tap Start once. Then:

1. Point at each teacher's parchment letter, clean letter, and poster, several times each. Put the phone down so the story ends before the next one.
2. While a story is talking, swing to a different letter and hold it. The first voice should stop before the second starts. You should never hear two teachers.
3. On Zélie's letter, cover the camera for less than a second and uncover it. Her story should continue, not restart, and no second voice should join. Cover it for a few seconds: the story should end and stay quiet.
4. Repeat until you have done this well past twenty scans.

One picture, one voice, the whole time. A second tap on Start should do nothing.
