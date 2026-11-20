// Stress the playback controller the Sun Class page uses.
// A scene's raw updater always tries to show itself and start its voice,
// which is what the legacy pendingClaim path does. After every step the
// page runs every built updater; only the armed story may proceed.
import { readFileSync } from 'fs';
import { createPlayback } from '../playback-v25.js';

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ok  ' + name + (detail ? '  ' + detail : ''));
  else { failed++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
}

function makeTracks() {
  return ['stephanie', 'zelie', 'abigail', 'isin'].map((id) => ({
    id,
    starts: 0,
    start() { this.starts++; },
    stop() {},
  }));
}

function harness() {
  const tracks = makeTracks();
  const playback = createPlayback(tracks);
  const updaters = [];
  const scenes = [];
  function addScene(teacher, anchor) {
    const scene = {
      started: false,
      teacher,
      anchor,
      visible: false,
      starts: 0,
      stops: 0,
      start() { scene.starts++; scene.visible = true; },
      stop() { scene.stops++; scene.visible = false; },
    };
    const raw = () => {
      // Legacy self-start: any updater that runs claims the stage and the voice.
      scene.visible = true;
      tracks[teacher].start();
    };
    updaters.push(playback.wrap(scene, raw));
    scenes.push(scene);
    return scene;
  }
  const grid = [];
  for (let anchor = 0; anchor < 3; anchor++) {
    grid[anchor] = [];
    for (let teacher = 0; teacher < 4; teacher++) grid[anchor][teacher] = addScene(teacher, anchor);
  }
  function frame() {
    for (const update of updaters) update(0, 0.016);
  }
  function snapshot() {
    return {
      live: playback.liveCount(),
      audible: playback.audible(),
      visible: scenes.filter((s) => s.visible).length,
    };
  }
  return { playback, tracks, grid, scenes, frame, snapshot };
}

console.log('session can be opened once');
{
  const { playback } = harness();
  check('first Start claims the session', playback.enterSession() === true);
  check('second Start is refused', playback.enterSession() === false);
  check('a retry after that is still refused', playback.enterSession() === false);
  check('refused Start left nothing playing', playback.liveCount() === 0 && playback.audible() === 0);
}

console.log('one story, one voice, across repeated scans');
{
  const h = harness();
  h.playback.enterSession();
  let worstLive = 0;
  let worstAudible = 0;
  let worstVisible = 0;
  let steps = 0;
  function touch(anchor, teacher) {
    h.playback.play(h.grid[anchor][teacher]);
    h.frame();
    const s = h.snapshot();
    worstLive = Math.max(worstLive, s.live);
    worstAudible = Math.max(worstAudible, s.audible);
    worstVisible = Math.max(worstVisible, s.visible);
    steps++;
    if (s.live !== 1 || s.audible !== 1 || s.visible !== 1) {
      check('step ' + steps + ' anchor ' + anchor + ' teacher ' + teacher, false, JSON.stringify(s));
    }
  }
  // 24 full passes of 4 teachers x 3 surfaces (letter, poster, clean) = 288 scans.
  for (let pass = 0; pass < 24; pass++) {
    for (let teacher = 0; teacher < 4; teacher++) {
      for (let anchor = 0; anchor < 3; anchor++) touch(anchor, teacher);
    }
    // Quick switch mid-story, then the phone goes down.
    touch(0, 0);
    touch(1, 2);
    touch(2, 1);
    h.playback.stopAll();
    h.frame();
    const down = h.snapshot();
    if (down.live !== 0 || down.audible !== 0 || down.visible !== 0) {
      check('phone down on pass ' + pass, false, JSON.stringify(down));
    }
  }
  check('288 scans plus quick switches stayed at one story', worstLive === 1 && worstAudible === 1 && worstVisible === 1, 'steps ' + steps + ' max ' + worstLive + '/' + worstAudible + '/' + worstVisible);
  check('putting the phone down leaves silence', h.snapshot().audible === 0 && h.snapshot().visible === 0);
}

console.log('a second instance of the same teacher cannot keep its voice');
{
  const h = harness();
  h.playback.enterSession();
  const letter = h.grid[0][0];
  const poster = h.grid[1][0];
  h.playback.play(letter);
  h.frame();
  h.playback.play(poster);
  h.frame();
  check('poster replaced the letter', h.playback.active() === poster && letter.visible === false && poster.visible === true);
  check('one voice after the switch', h.playback.audible() === 1 && h.playback.liveCount() === 1);
  check('the letter was actually stopped', letter.stops === 1 && letter.started === false);
}

console.log('starting the story that is already playing does not restart it');
{
  const h = harness();
  const scene = h.grid[0][3];
  h.playback.play(scene);
  h.frame();
  const starts = scene.starts;
  check('play of the current story is a no-op', h.playback.play(scene) === false);
  check('no second start', scene.starts === starts && h.playback.liveCount() === 1 && h.playback.audible() === 1);
}

console.log('the page still has the Zélie grace and the near-still pose freeze');
{
  const html = readFileSync(new URL('../teachers-sun-class.html', import.meta.url), 'utf8');
  check('grace is 1.2s for Zélie only', html.includes("TEACHER_KEYS[playing.teacher] === 'zelie'") && html.includes('now - zelieLostAt < 1200'));
  check('near-still window and smoothed scale are intact', html.includes('dPos < 0.03 && dAng < 0.03') && html.includes('_smS.lerp(_rawS, 0.05)') && html.includes('_smM.compose(_smP, _smQ, _smS)'));
  check('frozen teacher pages are not this file', !html.includes('teachers.html?only='));
}

if (failed) {
  console.log('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nall checks passed');
