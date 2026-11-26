// Skyward Flight — the island: procedural terrain, sea, runway, ring hoops,
// clouds and sun, all in one warm late-afternoon style. Built from the same
// groundHeight function the physics uses, so what you see is what you hit.
import * as THREE from '../vendor/three.min.js';
import { PALETTE, RINGS, RUNWAY, WORLD } from './config.js';
import { createRandom } from './random.js';

function colourFor(h, rng) {
  const c = new THREE.Color();
  if (h < 1.5) c.setHex(PALETTE.sand);
  else if (h < 14) c.setHex(rng() < 0.5 ? PALETTE.grass : PALETTE.field);
  else if (h < 55) c.setHex(PALETTE.forest);
  else if (h < 110) c.setHex(PALETTE.rock);
  else c.setHex(PALETTE.snow);
  return c;
}

export function buildWorld(scene, groundHeight, seed) {
  const rng = createRandom(seed ^ 0x5f3a);
  // Terrain: a 96x96 grid over the whole island, vertex-coloured by height.
  const seg = 96, size = WORLD.size;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const c = colourFor(h, rng);
    // Slight per-vertex variation so fields read as patchwork, not flat paint.
    const jitter = 0.92 + rng() * 0.16;
    colours[i * 3] = c.r * jitter; colours[i * 3 + 1] = c.g * jitter; colours[i * 3 + 2] = c.b * jitter;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  scene.add(terrain);

  // Sea: a flat blue disc just below the rim, visible at the island edge.
  const sea = new THREE.Mesh(new THREE.CircleGeometry(1900, 48),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.2;
  scene.add(sea);

  // Runway: dark strip with a white centreline and threshold bars.
  const runway = new THREE.Group();
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshStandardMaterial({ color: PALETTE.runway, roughness: 0.9 }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.35;
  runway.add(strip);
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
  for (let i = -4; i <= 4; i += 1) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 14), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.4, i * 26);
    runway.add(dash);
  }
  runway.position.set(RUNWAY.x, 0, RUNWAY.z);
  scene.add(runway);

  // A few low-poly trees clustered on the green slopes.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.forest, roughness: 0.9 });
  const trees = new THREE.Group();
  for (let i = 0; i < 90; i += 1) {
    const x = (rng() * 2 - 1) * 950, z = (rng() * 2 - 1) * 950;
    const h = groundHeight(x, z);
    if (h < 6 || h > 45) continue;
    if (Math.abs(x - RUNWAY.x) < 60 && Math.abs(z - RUNWAY.z) < 180) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 6), trunkMat);
    trunk.position.set(x, h + 1.5, z);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 7), leafMat);
    crown.position.set(x, h + 6, z);
    trees.add(trunk); trees.add(crown);
  }
  scene.add(trees);

  // Ring hoops: glowing torus + a soft inner disc; the next ring pulses green.
  const rings = RINGS.map((ring) => {
    const g = new THREE.Group();
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(ring.r, 1.1, 12, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.ring }));
    g.add(hoop);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(ring.r - 2, 32),
      new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.07, side: THREE.DoubleSide }));
    g.add(disc);
    g.position.set(ring.x, ring.y, ring.z);
    // Face the hoop along the course (roughly toward the previous waypoint).
    g.rotation.y = Math.atan2(ring.x, ring.z);
    scene.add(g);
    return { group: g, hoop, def: ring };
  });

  // Clouds: clusters of white flattened spheres drifting slowly.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 16; i += 1) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rng() * 9, 10, 8), cloudMat);
      s.scale.y = 0.45;
      s.position.set(j * 10 - n * 5, rng() * 3, rng() * 8 - 4);
      puff.add(s);
    }
    puff.position.set((rng() * 2 - 1) * 1000, 190 + rng() * 90, (rng() * 2 - 1) * 1000);
    clouds.add(puff);
  }
  scene.add(clouds);

  // Sun: a warm disc low in the west, plus the lights that sell the hour.
  const sun = new THREE.Mesh(new THREE.CircleGeometry(42, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sun.position.set(-900, 260, -700);
  sun.lookAt(0, 60, 0);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6a7a52, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffe0b0, 1.6);
  dir.position.set(-600, 380, -400);
  scene.add(dir);

  return { rings, clouds };
}
