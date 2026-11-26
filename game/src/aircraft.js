// Skyward Flight — the aircraft, built from three.js primitives so it reads as
// a real little propeller plane: rounded fuselage, tapered wings, tail, fin,
// spinning propeller and a glass canopy. No imported model, no copied art.
import * as THREE from '../vendor/three.min.js';
import { PALETTE } from './config.js';

export function buildAircraft() {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: PALETTE.planeBody, roughness: 0.55, metalness: 0.15 });
  const cream = new THREE.MeshStandardMaterial({ color: PALETTE.planeWing, roughness: 0.6, metalness: 0.05 });
  const navy = new THREE.MeshStandardMaterial({ color: PALETTE.planeTrim, roughness: 0.5, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ef, roughness: 0.15, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.7 });

  // Fuselage: a stretched sphere nose-to-tail, plus a tapered tail cone.
  const fuselage = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), body);
  fuselage.scale.set(1, 1, 3.4);
  group.add(fuselage);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.2, 12), body);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.6;
  group.add(tailCone);
  // Cream cheatline stripe along the side.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.22, 5.4), cream);
  stripe.position.set(0, -0.15, 0.4);
  group.add(stripe);

  // Canopy: a flattened glass bubble over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), glass);
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.85, 0.9);
  group.add(canopy);

  // Main wings: wide, slightly swept, with navy tips.
  function wing(side) {
    const w = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 1.7), cream);
    panel.position.set(side * 3.2, 0, 0.4);
    w.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.7), navy);
    tip.position.set(side * 5.6, 0, 0.4);
    w.add(tip);
    return w;
  }
  group.add(wing(1)); group.add(wing(-1));

  // Tailplane and vertical fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.0), cream);
  tailplane.position.set(0, 0.25, 5.4);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.3), navy);
  fin.position.set(0, 0.85, 5.5);
  fin.rotation.x = -0.25;
  group.add(fin);

  // Fixed landing gear: two wheels and struts.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), dark);
    strut.position.set(side * 0.8, -1.15, 0.9);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.8, -1.55, 0.9);
    group.add(wheel);
  }

  // Propeller: hub + two blades, spun by the renderer from airspeed.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -3.95);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 10), navy);
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.5, 0.08), dark);
    blade.rotation.z = angle;
    blade.position.z = -0.12;
    prop.add(blade);
  }
  group.add(prop);
  group.userData.prop = prop;

  // A small tail wheel so the plane sits level on the strip.
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.1, 5.2);
  group.add(tailWheel);

  // A small navigation light on each wingtip.
  for (const [side, color] of [[-1, 0xff4444], [1, 0x44ff88]]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color }));
    light.position.set(side * 5.9, 0, 0.4);
    group.add(light);
  }
  return group;
}
