// Skyward Flight — boot and the one loop.
// Fixed 1/60 s steps for the simulation, a Three.js chase camera behind the
// plane, the DOM HUD on top. Screens: title, play, paused, over, complete.
// ?seed=N fixes the island. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it, and sets window.__shotReady.
import * as THREE from '../vendor/three.min.js';
import { BEST_KEY, PALETTE, RINGS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_LANDED, EVENT_OVER } from './world.js';
import { buildWorld } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createHud, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud-root');
const world = createWorld(seed);
const hud = createHud(hudRoot);

// --- Three.js scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyBottom);
scene.fog = new THREE.Fog(0xcfe0ee, 500, 1900);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 5000);
const built = buildWorld(scene, world.groundHeight, seed);
const plane = buildAircraft();
scene.add(plane);
// A soft sky dome gradient: big sphere, backside, vertex colours top/bottom.
{
  const skyGeo = new THREE.SphereGeometry(2400, 24, 12);
  const top = new THREE.Color(PALETTE.skyTop), bottom = new THREE.Color(PALETTE.skyBottom);
  const cols = [];
  const p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const t = Math.max(0, Math.min(1, p.getY(i) / 2400 + 0.35));
    const c = bottom.clone().lerp(top, t);
    cols.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);
}

function syncScene(state, time) {
  // Aircraft pose from the simulation state.
  plane.position.set(state.pos.x, state.pos.y, state.pos.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = (state.heading * Math.PI) / 180;
  plane.rotation.x = -(state.pitch * Math.PI) / 180;
  plane.rotation.z = -(state.roll * Math.PI) / 180;
  plane.userData.prop.rotation.z += 0.35 + state.speed * 0.06;
  // Chase camera: behind and above the tail, looking at the nose.
  const hr = (state.heading * Math.PI) / 180, pr = (state.pitch * Math.PI) / 180;
  const back = 16, up = 5.5;
  const cx = state.pos.x - Math.sin(hr) * Math.cos(pr) * back;
  const cy = state.pos.y - Math.sin(pr) * back + up;
  const cz = state.pos.z + Math.cos(hr) * Math.cos(pr) * back;
  // Snap the camera on the first frame (screenshots paint only a few frames),
  // then ease toward the chase position so the view never fights the pilot.
  if (!syncScene.snapped) { camera.position.set(cx, cy, cz); syncScene.snapped = true; }
  else camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.35);
  camera.lookAt(state.pos.x + Math.sin(hr) * 30, state.pos.y + Math.sin(pr) * 30, state.pos.z - Math.cos(hr) * 30);
  // Ring highlight: next ring green and pulsing, passed rings dimmed away.
  built.rings.forEach((r, i) => {
    if (i < state.ringIndex) { r.group.visible = false; return; }
    r.group.visible = true;
    const next = i === state.ringIndex;
    const pulse = next ? 1 + Math.sin(time * 5) * 0.18 : 1;
    r.group.scale.setScalar(pulse);
    r.hoop.material.color.setHex(next ? PALETTE.ringNext : PALETTE.ring);
  });
  built.clouds.children.forEach((c, i) => { c.position.x += 0.02 + (i % 3) * 0.01; if (c.position.x > 1100) c.position.x = -1100; });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { window.localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode: best lasts this visit */ }
}

function paint(state, screen, best) {
  syncScene(state, state.time);
  renderer.render(scene, camera);
  hud.draw(state, screen, best);
}

// --- Screenshot staging ---------------------------------------------------
if (shot) {
  const sceneShot = stageShot(shot, world);
  let painted = 0;
  (function paintShot() {
    paint(world.state, sceneShot.screen, sceneShot.best);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }());
} else {
  runGame();
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    world.reset();
    world.state.status = 'flying';
    accumulator = 0;
    screen = SCREEN_PLAY;
  }
  function endGame() {
    screen = world.state.status === 'landed' ? SCREEN_COMPLETE : SCREEN_OVER;
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // Idle demo: the plane cruises in a gentle circle behind the title.
      world.step(STEP, { pitch: 0.08, roll: 0.35, yaw: 0, throttle: 0.7 });
      if (world.state.status === 'crashed' || world.state.status === 'landed') world.reset();
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, input.control());
        accumulator -= STEP;
        if (events & EVENT_OVER) { endGame(); break; }
        if (events & EVENT_LANDED) { endGame(); break; }
      }
    } else {
      accumulator = 0;
    }
    paint(world.state, screen, best);
  }
  // Clicking the title / end overlay also starts the game.
  hudRoot.addEventListener('click', () => {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE) startGame();
  });
  requestAnimationFrame(frame);
}
