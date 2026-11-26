// Skyward Flight — pure simulation, no rendering here.
// Terrain height, the aircraft state, flight physics, rings, fuel, damage,
// landings and crashes. The renderer and the screenshot autopilot both read
// from this one state, so a staged shot is real gameplay.
import { PLANE, RINGS, RUNWAY, SCORE, STEP, WORLD } from './config.js';
import { makeNoise } from './random.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_OVER = 8;
export const EVENT_FUEL_EMPTY = 16;

// Terrain height at (x, z). A flat valley floor around the runway, rising
// ridges toward the edges, plus rolling hills in between. Sea at the rim.
export function makeTerrain(seed) {
  const n1 = makeNoise(seed + 11);
  const n2 = makeNoise(seed + 77);
  return function groundHeight(x, z) {
    const dist = Math.hypot(x, z);
    const rim = Math.max(0, (dist - 780) / 420); // 0 in the valley, 1 at the edge
    const hills = n1(x / 260, z / 260) * 26 + n2(x / 90, z / 90) * 9;
    const ridge = rim * rim * 150 + rim * 40;
    // Flatten the runway strip completely so landings are fair: distance to
    // the runway segment (x = 0, z in 190..450), fully flat on the strip and
    // blending back to the hills over 100 m. The visual strip sits at y 0.35,
    // so the ground under it must be ~0, not a half-flattened bump.
    // The flat area extends 60 m past each end of the strip as an overrun.
    const dz = Math.max(0, Math.abs(z - RUNWAY.z) - (RUNWAY.length / 2 + 60));
    const distToStrip = Math.hypot(x - RUNWAY.x, dz);
    const flat = Math.max(0, 1 - distToStrip / 100);
    const smoothFlat = flat * flat * (3 - 2 * flat);
    const h = (hills + ridge) * (1 - smoothFlat);
    return Math.max(-6, h);
  };
}

export function createWorld(seed) {
  const groundHeight = makeTerrain(seed);
  const state = freshState();
  function freshState() {
    return {
      seed,
      time: 0,
      // Start on the runway, nose pointing north (-z), ready to roll.
      pos: { x: RUNWAY.x, y: groundHeight(RUNWAY.x, RUNWAY.z) + 2.5, z: RUNWAY.z + 90 },
      heading: 0, // degrees, 0 = north (-z) down the runway toward the rings, 90 = east
      pitch: 0, roll: 0,
      speed: 0, throttle: 0,
      fuel: PLANE.fuelMax, hull: PLANE.hullMax,
      score: 0, combo: 0, bestCombo: 0,
      ringIndex: 0, ringsPassed: 0,
      lastHardHit: -99, // seconds: grace between hard-impact damage events
      landingPhase: 0, // autopilot only: 0 = aligning on the centreline, 1 = final
      landingFromSouth: null, // latched at final entry: which side the approach came from
      status: 'ready', // ready | flying | landed | crashed | outoffuel
      message: '', messageUntil: 0,
      verticalSpeed: 0, lastLandingHard: false,
    };
  }
  function reset() {
    Object.assign(state, freshState());
  }
  function groundAt(x, z) { return groundHeight(x, z); }

  function setMessage(text, seconds = 2.5) {
    state.message = text;
    state.messageUntil = state.time + seconds;
  }

  function nearestRing() {
    return state.ringIndex < RINGS.length ? RINGS[state.ringIndex] : null;
  }

  // One fixed step. `ctl` is { pitch, roll, yaw, throttleDelta, throttle } with
  // stick values in [-1, 1]. Returns an event bitmask.
  function step(dt, ctl) {
    state.time += dt;
    if (state.status === 'crashed' || state.status === 'landed') return 0;
    let events = 0;
    const s = state;

    // Throttle: stick or direct set; clamp 0..1.
    if (ctl.throttle !== undefined && ctl.throttle !== null) s.throttle = ctl.throttle;
    else s.throttle += (ctl.throttleDelta || 0) * dt;
    s.throttle = Math.max(0, Math.min(1, s.throttle));

    // Stick: pitch up is positive, roll right positive, yaw right positive.
    const onGround = s.pos.y - groundHeight(s.pos.x, s.pos.z) < 3.2 && s.speed < 40;
    s.pitch += (ctl.pitch || 0) * PLANE.pitchRate * dt * (onGround ? 0.25 : 1);
    // Roll is a bank-angle target, not a rate: holding the stick banks the
    // plane to that angle and holds it; centring the stick levels the wings.
    // (A rate here made any steering input wind the bank up to its stop and
    // keep turning past the target — the plane could never fly straight.)
    const targetRoll = (ctl.roll || 0) * 75;
    s.roll += (targetRoll - s.roll) * Math.min(1, 4 * dt);
    s.heading += ((ctl.yaw || 0) * PLANE.yawRate
      + Math.sin(s.roll * Math.PI / 180) * PLANE.turnFromBank * 57.3) * dt;
    s.pitch = Math.max(-45, Math.min(45, s.pitch));
    s.roll = Math.max(-75, Math.min(75, s.roll));
    s.heading = ((s.heading % 360) + 360) % 360;

    // Speed: throttle pushes, drag pulls; climbing costs speed, diving gains it.
    s.speed += (PLANE.accel * s.throttle - PLANE.drag * s.speed
      - Math.sin(s.pitch * Math.PI / 180) * 9) * dt;
    s.speed = Math.max(0, Math.min(PLANE.maxSpeed + 12, s.speed));

    // Stall: below minimum speed the wing gives up and the nose drops.
    const stalled = s.speed < PLANE.minSpeed && !onGround;
    if (stalled) s.pitch -= 18 * dt;

    // Move along the nose direction.
    const hr = s.heading * Math.PI / 180, pr = s.pitch * Math.PI / 180;
    const vx = Math.sin(hr) * Math.cos(pr) * s.speed;
    const vy = Math.sin(pr) * s.speed;
    const vz = -Math.cos(hr) * Math.cos(pr) * s.speed;
    const prevY = s.pos.y;
    s.pos.x += vx * dt; s.pos.y += vy * dt; s.pos.z += vz * dt;
    s.verticalSpeed = (s.pos.y - prevY) / dt;
    // Soft world edge: steer back rather than letting the plane vanish.
    if (Math.abs(s.pos.x) > WORLD.half || Math.abs(s.pos.z) > WORLD.half) {
      s.pos.x = Math.max(-WORLD.half, Math.min(WORLD.half, s.pos.x));
      s.pos.z = Math.max(-WORLD.half, Math.min(WORLD.half, s.pos.z));
      s.heading = (s.heading + 180) % 360;
      setMessage('Edge of the valley — turning back');
    }
    if (s.pos.y > 420) { s.pos.y = 420; s.pitch = Math.min(s.pitch, 0); }

    // Fuel: drains with throttle; empty tank means gliding to whatever is below.
    s.fuel -= PLANE.fuelDrain * (0.25 + s.throttle) * dt;
    if (s.fuel <= 0) {
      s.fuel = 0;
      if (s.throttle > 0) { s.throttle = 0; events |= EVENT_FUEL_EMPTY; setMessage('Fuel empty — gliding!'); }
    }

    // Rings: fly through the glowing hoop to score.
    const ring = nearestRing();
    if (ring) {
      const d = Math.hypot(s.pos.x - ring.x, s.pos.y - ring.y, s.pos.z - ring.z);
      if (d < ring.r) {
        s.ringsPassed += 1; s.ringIndex += 1;
        s.combo += 1; s.bestCombo = Math.max(s.bestCombo, s.combo);
        const gained = SCORE.ring + (s.combo - 1) * SCORE.comboBonus;
        s.score += gained;
        events |= EVENT_RING;
        setMessage(s.ringIndex >= RINGS.length
          ? `All rings cleared! Land on the runway (+${SCORE.landing})`
          : `Ring ${s.ringsPassed}/${RINGS.length}  +${gained}  (combo x${s.combo})`);
      }
    }

    // Ground contact.
    const ground = groundHeight(s.pos.x, s.pos.z);
    const clearance = s.pos.y - ground;
    if (clearance <= 1.6) {
      // The strip plus its flat overrun counts as runway for a touchdown.
      const overRunway = Math.abs(s.pos.x - RUNWAY.x) < RUNWAY.width / 2 + 6
        && Math.abs(s.pos.z - RUNWAY.z) < RUNWAY.length / 2 + 60
        && Math.abs(ground) < 4;
      const soft = Math.abs(s.verticalSpeed) < 6 && Math.abs(s.pitch) < 18
        && Math.abs(s.roll) < 25 && s.speed < 62;
      if (overRunway && soft) {
        s.pos.y = ground + 1.6; s.speed *= Math.max(0, 1 - 1.4 * dt);
        if (s.speed < 6) {
          s.status = 'landed'; events |= EVENT_LANDED | EVENT_OVER;
          if (s.ringIndex >= RINGS.length) {
            s.score += SCORE.landing + Math.max(0, Math.round((100 - s.time) * SCORE.timeBonusPerSec));
            setMessage('Mission complete — perfect landing!');
          } else {
            setMessage('Landed. Take off again to finish the rings!');
          }
          return events;
        }
        return events;
      }
      // Not a landing: a hard impact. One scrape costs hull once; a short
      // grace stops a bumpy rollout from draining the hull in three hits.
      const impact = Math.abs(s.verticalSpeed) + Math.max(0, s.speed - 45);
      if (s.time - s.lastHardHit < 1.5) {
        s.pos.y = ground + 2.2; s.speed *= 0.8;
        return events;
      }
      s.lastHardHit = s.time;
      s.hull -= Math.max(12, impact * 2.2);
      s.combo = 0;
      if (s.hull <= 0 || impact > 34) {
        s.hull = 0; s.status = 'crashed'; s.pos.y = ground + 1.2;
        events |= EVENT_CRASH | EVENT_OVER;
        setMessage('Crashed!');
      } else {
        s.pos.y = ground + 1.8; s.speed *= 0.45; s.pitch = 0;
        setMessage('Hard impact! Hull damaged');
      }
    }
    if (s.status === 'landed') events |= EVENT_OVER;
    return events;
  }

  return { state, reset, step, groundHeight, nearestRing, setMessage };
}
