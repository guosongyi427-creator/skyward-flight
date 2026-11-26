// Screenshot staging: ?shot=start|play|end&seed=N plays the real rules forward
// from a fresh world, steered by a simple autopilot, so each frame is what a
// short real game looks like and the same seed always gives the same frame.
// start: title screen after a short demo flight. play: mid-course, chasing the
// next ring with score on the board. end: the full Ring Run flown to a landing
// (or a crash, if the pilot runs out of luck) — the end screen over the valley.
import { RINGS, RUNWAY, STEP } from './config.js';
import { EVENT_LANDED, EVENT_OVER } from './world.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const END_LIMIT_SECONDS = 300;

// Steer toward a target point: bank toward the heading error, pitch toward
// the altitude error, throttle up when slow. Returns a control object.
function steerToward(state, target, throttle, gentle = false) {
  const dx = target.x - state.pos.x, dy = target.y - state.pos.y, dz = target.z - state.pos.z;
  const wantHeading = (Math.atan2(dx, -dz) * 180) / Math.PI;
  let err = ((wantHeading - state.heading + 540) % 360) - 180;
  // Ring chasing needs full bank to catch the bearing at speed; on final a
  // gentle bank (max ~36 deg) stops the heading hunting back and forth and
  // snaking 50-80 m sideways — harmless at altitude, fatal on final.
  const roll = gentle
    ? Math.max(-0.6, Math.min(0.6, err / 60))
    : Math.max(-1, Math.min(1, err / 35));
  const dist = Math.hypot(dx, dz);
  const wantPitch = Math.max(-18, Math.min(18, Math.atan2(dy, Math.max(30, dist)) * 180 / Math.PI));
  const pitch = Math.max(-1, Math.min(1, (wantPitch - state.pitch) / 14));
  return { pitch, roll, yaw: Math.max(-0.4, Math.min(0.4, err / 90)), throttleDelta: 0, throttle };
}

function autopilot(state) {
  const ring = state.ringIndex < RINGS.length ? RINGS[state.ringIndex] : null;
  if (ring) {
    // Slow down close to the ring: at full speed the turn circle is wider
    // than the approach and the plane orbits the hoop instead of threading it.
    const dist = Math.hypot(ring.x - state.pos.x, ring.z - state.pos.z);
    const throttle = dist < 260 ? 0.45 : 0.72;
    return steerToward(state, { x: ring.x, y: ring.y, z: ring.z }, throttle);
  }
  // Rings done: two phases, latched. First align high on the extended
  // centreline (55 m, safely above the 26 m hills beside the strip), from
  // whichever side the rings ended on. Only once lined up does the plane
  // start down the slope, aiming at a single distant point beyond the far
  // end of the strip. Diving straight at the runway from wherever the last
  // ring was made the plane descend over the hills, arrive unaligned, and
  // scrape around the strip at low speed until the hull gave out.
  // The approach side is latched on the first landing call: recomputing it
  // from the position each step flipped the staging point and the runway
  // heading 180 deg whenever the plane crossed the strip centre, and it
  // turned around forever.
  if (state.landingFromSouth === null) state.landingFromSouth = state.pos.z > RUNWAY.z;
  const fromSouth = state.landingFromSouth;
  const stageZ = fromSouth ? RUNWAY.z + 470 : RUNWAY.z - 470;
  const touchZ = fromSouth ? RUNWAY.z + 60 : RUNWAY.z - 60;
  const farZ = fromSouth ? RUNWAY.z - 200 : RUNWAY.z + 200;
  if (!state.landingPhase) state.landingPhase = 0;
  if (state.landingPhase === 0) {
    const nearStage = Math.hypot(state.pos.x - RUNWAY.x, state.pos.z - stageZ) < 70;
    if (nearStage) { state.landingPhase = 1; state.landingFromSouth = state.pos.z > RUNWAY.z; }
    else return steerToward(state, { x: RUNWAY.x, y: 55, z: stageZ }, 0.5);
  }
  // Final: follow the centreline, don't chase a point. A point target made
  // the plane snake ±100 m around the strip in a stable limit cycle (turn
  // radius vs. bearing rate). Instead the heading is the runway heading
  // crabbed toward the line by the lateral error, and the altitude follows
  // the slope down to the touchdown point. Hold height while correcting
  // laterally: descending while 30+ m off the line put the plane into the
  // hills beside the strip.
  const approach = fromSouth ? 0 : 180;
  const lateral = state.pos.x - RUNWAY.x;
  const crab = Math.max(-35, Math.min(35, lateral * 0.35));
  const headingCmd = approach + (fromSouth ? -crab : crab);
  let headingErr = ((headingCmd - state.heading + 540) % 360) - 180;
  const roll = Math.max(-0.5, Math.min(0.5, headingErr / 25));
  // One-sided slope: distance to the touchdown point, clamped at zero once
  // past it. The earlier |z - touchZ| was V-shaped, so after crossing the
  // touchdown point the target altitude rose again and the plane pulled up
  // and flew over the strip instead of landing on it.
  const distToTouch = fromSouth
    ? Math.max(0, state.pos.z - touchZ)
    : Math.max(0, touchZ - state.pos.z);
  const slopeAlt = Math.max(2, distToTouch * 0.06);
  // Hold height only while well off the line; holding it to 25 m until the
  // plane was within 30 m of the line left no strip left to descend on.
  const finalAlt = Math.abs(lateral) > 60 ? Math.max(slopeAlt, 25) : slopeAlt;
  // Flare: once over the strip and low, aim below the ground instead of at
  // the slope — the slope's gentle tail made the plane float past the end.
  const overStrip = Math.abs(lateral) < 20 && state.pos.z > RUNWAY.z - 140 && state.pos.z < RUNWAY.z + 140;
  const targetAlt = overStrip && state.pos.y < 14 ? -2 : finalAlt;
  const wantPitch = Math.max(-10, Math.min(10, (targetAlt - state.pos.y) * 0.5));
  const pitch = Math.max(-1, Math.min(1, (wantPitch - state.pitch) / 14));
  void farZ;
  return { pitch, roll, yaw: 0, throttleDelta: 0, throttle: 0.32 };
}

export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  s.status = 'flying'; // staged flights are real flights, not parked on the strip
  if (name !== 'play' && name !== 'end' && name !== 'chase') {
    // Start: take off, climb toward the first ring, freeze on the title screen.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(s));
      if (s.status === 'crashed') break;
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  // 'chase' is a later play frame (4 rings down, over the eastern valley)
  // so the fourth screenshot is a different moment, not a repeat of play.
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'chase' ? 90 : PLAY_SECONDS;
  const breakAt = name === 'chase' ? 4 : 2;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(s));
    if (events & EVENT_OVER) break;
    if ((name === 'play' || name === 'chase') && s.ringsPassed >= breakAt) break;
  }
  if (name === 'end') {
    if (s.status === 'landed') return { screen: SCREEN_COMPLETE, best: s.score };
    if (s.status === 'crashed') return { screen: SCREEN_OVER, best: s.score };
    // Ran out of time mid-course: show the play screen rather than a blank end.
    return { screen: SCREEN_PLAY, best: s.score };
  }
  void EVENT_LANDED;
  return { screen: SCREEN_PLAY, best: s.score };
}
