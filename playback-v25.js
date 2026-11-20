// One AR session, one story, one voice.
// Scene updaters and dialogue elements stay where they are; this is the
// only thing allowed to open a session or to mark a scene as playing.

export function createPlayback(tracks) {
  const flags = tracks.map(() => ({ on: false }));
  tracks.forEach((track, i) => {
    const rawStart = track.start.bind(track);
    const rawStop = track.stop.bind(track);
    track.start = function exclusiveStart() {
      // Idle, page load, and the Start tap itself are silence. A track
      // becomes audible only while a story is the armed one.
      if (!active || !active.started) {
        rawStop();
        flags[i].on = false;
        return;
      }
      for (let j = 0; j < tracks.length; j++) {
        if (j !== i) tracks[j].stop();
      }
      rawStart();
      flags[i].on = true;
    };
    track.stop = function markStopped() {
      rawStop();
      flags[i].on = false;
    };
  });

  let session = false;
  let active = null;
  const scenes = [];

  function silence() {
    for (const track of tracks) track.stop();
  }

  function stopAll() {
    active = null;
    for (const scene of scenes) {
      if (!scene.started) continue;
      scene.started = false;
      try { scene.stop(); } catch (e) { /* scene already reset */ }
    }
    // onTargetLost stops its own track. Silence again so a scene that
    // never reached onTargetLost cannot keep a voice.
    silence();
  }

  function play(scene) {
    if (active === scene && scene.started) return false;
    stopAll();
    active = scene;
    scene.started = true;
    try { scene.start(); } catch (e) { /* scene declined */ }
    return true;
  }

  function wrap(scene, rawUpdate) {
    if (scene.started === undefined) scene.started = false;
    scenes.push(scene);
    return function guardedUpdate(t, dt) {
      // A built scene that is not the current story cannot animate,
      // cannot claim the stage, and cannot start audio.
      if (active !== scene || !scene.started) return;
      rawUpdate(t, dt);
    };
  }

  function liveCount() {
    let n = 0;
    for (const scene of scenes) if (scene.started) n++;
    return n;
  }

  function audible() {
    let n = 0;
    for (const flag of flags) if (flag.on) n++;
    return n;
  }

  return {
    // First call wins for the life of the page. A second Start, a
    // double tap, or a retry after a partial failure gets false.
    enterSession() {
      if (session) return false;
      session = true;
      return true;
    },
    sessionStarted() { return session; },
    play,
    stopAll,
    wrap,
    silence,
    liveCount,
    audible,
    active() { return active; },
    storyArmed() { return !!(active && active.started); },
  };
}
