// Skyward Flight — every tuning number in one place.
// Units: metres, seconds, degrees. The world is a 2400 x 2400 m island valley
// with a runway near the origin and a ring course winding over it.
export const STEP = 1 / 60;
export const WORLD = { size: 2400, half: 1200, seaLevel: 0 };

export const PLANE = {
  minSpeed: 26,       // below this the wing stalls and the nose drops
  maxSpeed: 95,
  cruiseSpeed: 58,
  accel: 14,          // speed gained per second at full throttle
  drag: 0.12,
  pitchRate: 42,      // deg / s at full stick
  rollRate: 95,
  yawRate: 26,
  turnFromBank: 0.95, // heading change per second per radian of bank
  climbFactor: 0.55,
  fuelMax: 100,
  fuelDrain: 0.35,    // per second at cruise throttle, scaled by throttle
  hullMax: 100,
};

export const RUNWAY = {
  x: 0, z: 320, heading: 0, length: 260, width: 26,
};

// Six rings of the Ring Run, in order. Each is a position + radius.
export const RINGS = [
  { x: -180, y: 95,  z: 40,   r: 26 },
  { x: -420, y: 120, z: -260, r: 26 },
  { x: -120, y: 150, z: -560, r: 24 },
  { x: 260,  y: 130, z: -620, r: 24 },
  { x: 520,  y: 110, z: -280, r: 26 },
  { x: 300,  y: 90,  z: 120,  r: 26 },
];

export const SCORE = { ring: 250, comboBonus: 50, landing: 500, timeBonusPerSec: 2 };
// A clean run: 6 rings with a growing combo, then the landing bonus.
export const MAX_COMBO_SCORE = SCORE.ring * 6 + SCORE.comboBonus * 15 + SCORE.landing;
export const BEST_KEY = 'skyward-flight.best';

export const PALETTE = {
  skyTop: 0x2f6fb8, skyBottom: 0xcfe8f5,
  sea: 0x2e7fa8, sand: 0xd9c28a, grass: 0x5da24a, field: 0x8fae4e,
  forest: 0x2f6b34, rock: 0x8d8578, snow: 0xf2f5f7,
  runway: 0x3a3f46, runwayMark: 0xf5f5f0,
  planeBody: 0xe8542f, planeWing: 0xf5f2e8, planeTrim: 0x1f3a5f,
  ring: 0xffc233, ringNext: 0x35e0a1,
  hudText: '#eef6ff', hudDim: '#a8c4dc', hudWarn: '#ffb03a', hudBad: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
