import * as THREE from 'three';
import type { Game } from '../Game';

const UP = new THREE.Vector3(0, 1, 0);
const sg = new THREE.SphereGeometry(1, 10, 8);
const coneG = new THREE.ConeGeometry(1, 1, 8);

/** a streaking aura dragon (Zeno's Dragon Head / Lance / Dive). Travels `len` along `dir` while its body undulates. */
export function dragonFx(g: Game, from: THREE.Vector3, dir: THREE.Vector3, len: number, color = 0x58d8f0, dur = 0.4, scale = 1) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  mat.color.multiplyScalar(1.7);
  const white = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const N = 18;
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(sg, i % 3 === 0 ? white : mat);
    m.scale.setScalar(Math.max(0.16, (0.62 - i * 0.024) * scale));
    grp.add(m);
    segs.push(m);
  }
  const head = new THREE.Group();
  const snout = new THREE.Mesh(coneG, white);
  snout.scale.set(0.75 * scale, 1.9 * scale, 0.75 * scale);
  snout.rotation.x = Math.PI / 2;
  snout.position.z = 0.5 * scale;
  head.add(snout);
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(coneG, mat);
    horn.scale.set(0.16 * scale, 1.0 * scale, 0.16 * scale);
    horn.rotation.set(-0.9, 0, sx * 0.5);
    horn.position.set(sx * 0.35 * scale, 0.5 * scale, -0.5 * scale);
    head.add(horn);
    const eye = new THREE.Mesh(sg, mat);
    eye.scale.setScalar(0.12 * scale);
    eye.position.set(sx * 0.3 * scale, 0.28 * scale, 0.1 * scale);
    head.add(eye);
  }
  grp.add(head);
  const d = dir.clone().normalize();
  let side = new THREE.Vector3().crossVectors(d, UP);
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(side, d).normalize();
  g.fx.custom(grp, dur, (p) => {
    const e = Math.min(1, p * 1.7);
    const hl = len * (1 - Math.pow(1 - e, 2));
    head.position.copy(from).addScaledVector(d, hl);
    head.lookAt(head.position.clone().add(d));
    const t = p * dur;
    segs.forEach((s, i) => {
      const along = hl - (i + 1) * 0.86 * scale;
      s.visible = along > -0.2;
      const w = Math.sin(t * 17 - i * 0.75) * 0.55 * scale * Math.min(1, i / 3);
      s.position.copy(from).addScaledVector(d, Math.max(0, along)).addScaledVector(side, w).addScaledVector(up, Math.cos(t * 13 - i * 0.7) * 0.22 * scale);
    });
    const fade = 1 - Math.max(0, (p - 0.55) / 0.45);
    mat.opacity = 0.8 * fade;
    white.opacity = 0.9 * fade;
  }, () => { mat.dispose(); white.dispose(); });
}

// ---------------------------------------------------------------- Gido's spinning tops
const topBody = new THREE.ConeGeometry(0.5, 0.9, 14).rotateX(Math.PI);
const topDisc = new THREE.CylinderGeometry(0.66, 0.66, 0.1, 16);
const topKnob = new THREE.SphereGeometry(0.18, 8, 6);
const topStripe = new THREE.TorusGeometry(0.62, 0.05, 6, 20).rotateX(Math.PI / 2);
const brass = new THREE.MeshLambertMaterial({ color: 0xd8a850, emissive: 0x6a4a18 });
const topRed = new THREE.MeshLambertMaterial({ color: 0xd63a4a, emissive: 0x501018 });
export function buildTop(s = 1): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(topBody, brass);
  b.position.y = 0.45;
  const d = new THREE.Mesh(topDisc, brass);
  d.position.y = 0.88;
  const k = new THREE.Mesh(topKnob, topRed);
  k.position.y = 1.08;
  const st = new THREE.Mesh(topStripe, topRed);
  st.position.y = 0.88;
  g.add(b, d, k, st);
  g.scale.setScalar(s);
  return g;
}
/** n spinning tops orbiting a moving centre */
export function topsOrbit(g: Game, center: () => THREE.Vector3, n: number, radius: number, dur: number, speed = 3.4) {
  const grp = new THREE.Group();
  const tops: THREE.Group[] = [];
  for (let i = 0; i < n; i++) {
    const t = buildTop(0.7);
    grp.add(t);
    tops.push(t);
  }
  let tt = 0;
  g.fx.custom(grp, dur, (p, dt) => {
    tt += dt;
    const c = center();
    const grow = Math.min(1, p * 6) * Math.min(1, (1 - p) * 6);
    tops.forEach((t, i) => {
      const a = (i / n) * Math.PI * 2 + tt * speed;
      t.position.set(c.x + Math.cos(a) * radius * grow, 0.2 + Math.abs(Math.sin(tt * 4 + i)) * 0.5, c.z + Math.sin(a) * radius * grow);
      t.rotation.y += dt * 36;
      t.rotation.z = Math.sin(tt * 5 + i) * 0.25;
      t.scale.setScalar(0.7 * Math.max(0.05, grow));
      if (Math.random() < dt * 4) g.fx.sparks(new THREE.Vector3(t.position.x, 0.2, t.position.z), 0xffd890, 1, 4);
    });
  });
}
