import * as THREE from 'three';

const basic = (color: number, opacity = 1, additive = true) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide });

export function setOpacity(o: THREE.Object3D, v: number) {
  o.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (m && 'opacity' in m) {
      const base = (m.userData.base ??= m.opacity) as number;
      m.opacity = base * v;
    }
  });
}
export function disposeObj(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mm = m.material as THREE.Material;
      (mm as THREE.MeshBasicMaterial).map?.dispose();
      mm.dispose();
    }
  });
}

/** giant golden open palm (Netero's Guanyin hand / Zero Hand) – points along +Z, palm facing +Z */
export function buildHand(color = 0xffd45a, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const gold = basic(color, 0.85);
  const core = basic(0xffffff, 0.5);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.7), gold);
  palm.position.z = 0;
  g.add(palm);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.3), core);
  g.add(inner);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 1.1 - Math.abs(i - 1.5) * 0.12, 4, 8), gold);
    f.rotation.x = Math.PI / 2;
    f.position.set(-0.55 + i * 0.37, 0, 1.45);
    g.add(f);
  }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.8, 4, 8), gold);
  th.rotation.set(Math.PI / 2, 0, -0.8);
  th.position.set(0.95, 0, 0.6);
  g.add(th);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.4, 12), gold);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.z = -1.5;
  g.add(wrist);
  g.scale.setScalar(scale);
  return g;
}

/** 100-Type Guanyin Bodhisattva: a towering golden figure with a ring of arms and a halo */
export function buildGuanyin(): THREE.Group {
  const g = new THREE.Group();
  const gold = basic(0xffc93a, 0.55);
  const bright = basic(0xfff0a0, 0.45);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 4, 6, 14), gold);
  body.position.y = 4.2;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 14), gold);
  head.position.y = 8.1;
  head.scale.set(1, 1.15, 1);
  g.add(head);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 8), bright);
  crown.position.y = 9.6;
  g.add(crown);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 8, 48), bright);
  halo.position.set(0, 7.2, -1.2);
  g.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 8, 48), gold);
  halo2.position.set(0, 7.2, -1.1);
  g.add(halo2);
  const arms = new THREE.Group();
  arms.position.y = 5.8;
  g.add(arms);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const arm = new THREE.Group();
    arm.rotation.z = a;
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 3.2, 4, 8), i % 2 ? gold : bright);
    seg.position.set(0, 2.6, -0.4);
    seg.rotation.x = -0.25;
    arm.add(seg);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), bright);
    hand.position.set(0, 4.5, -0.8);
    arm.add(hand);
    arms.add(arm);
  }
  g.userData.arms = arms;
  g.userData.halo = halo;
  g.userData.halo2 = halo2;
  return g;
}

/** Kite's Crazy Slots roulette (numbered wheel) – faces +Z */
export function buildRoulette(): THREE.Group {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const cols = ['#d6322d', '#f4efe0', '#2f4fb8', '#f3d84a', '#2fa84a', '#8a3fc8', '#ff8a2a', '#2fc8c8', '#e8508a'];
  for (let i = 0; i < 9; i++) {
    x.fillStyle = cols[i];
    x.beginPath();
    x.moveTo(128, 128);
    x.arc(128, 128, 124, (i / 9) * Math.PI * 2 - Math.PI / 2, ((i + 1) / 9) * Math.PI * 2 - Math.PI / 2);
    x.fill();
    const a = ((i + 0.5) / 9) * Math.PI * 2 - Math.PI / 2;
    x.fillStyle = '#16121c';
    x.font = 'bold 34px sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(String(i + 1), 128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82);
  }
  x.strokeStyle = '#16121c';
  x.lineWidth = 8;
  x.beginPath();
  x.arc(128, 128, 124, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = '#16121c';
  x.beginPath();
  x.arc(128, 128, 16, 0, Math.PI * 2);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(1.5, 36), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 40), basic(0xffd36a, 0.95));
  g.add(rim);
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 36), basic(0xff7ad0, 0.35));
  g.add(glow);
  // pointer
  const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), basic(0xffffff, 1, false));
  ptr.position.set(0, 1.75, 0.05);
  ptr.rotation.z = Math.PI;
  g.add(ptr);
  g.userData.wheel = wheel;
  return g;
}

export function buildScythe(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshToonMaterial({ color: 0x3a2a3e });
  const blade = new THREE.MeshBasicMaterial({ color: 0xd8f0ff });
  const edge = basic(0x9fe0ff, 0.7);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), wood);
  shaft.position.y = 0.4;
  g.add(shaft);
  const b = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 6, 20, Math.PI * 0.8), blade);
  b.position.set(-1.1, 2.0, 0);
  b.rotation.z = -0.3;
  g.add(b);
  const b2 = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 6, 20, Math.PI * 0.8), edge);
  b2.position.copy(b.position);
  b2.rotation.copy(b.rotation);
  g.add(b2);
  g.userData.ref = b;
  return g;
}

/** Potclean / A.P.R. – the little winged marshmallow */
export function buildPotclean(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), white);
  body.scale.set(1, 0.95, 1);
  g.add(body);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeM);
    e.position.set(sx * 0.2, 0.08, 0.5);
    g.add(e);
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    w.position.set(sx * 0.62, 0.15, -0.05);
    w.rotation.y = sx * 0.6;
    w.scale.set(1, 1.4, 1);
    g.add(w);
    g.userData['wing' + (sx > 0 ? 'R' : 'L')] = w;
  }
  const gold = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.07, 6, 18), basic(0xffd36a, 0.95));
  gold.rotation.x = Math.PI / 2;
  gold.position.y = -0.15;
  g.add(gold);
  return g;
}

/** Terpsichora's ballerina puppeteer – tall, thin, glowing with strings */
export function buildPuppeteer(): THREE.Group {
  const g = new THREE.Group();
  const body = basic(0xe05aa8, 0.5);
  const hi = basic(0xffd0f0, 0.55);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 3, 5, 12), body);
  torso.position.y = 5;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 12), hi);
  head.position.y = 7.3;
  g.add(head);
  const tutu = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 20, 1, true), body);
  tutu.position.y = 3.3;
  tutu.rotation.x = Math.PI;
  g.add(tutu);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 4.5, 4, 8), hi);
    arm.position.set(sx * 2.0, 6.2, 0);
    arm.rotation.z = sx * -1.0;
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 3.0, 4, 8), body);
    leg.position.set(sx * 0.5, 1.6, 0);
    leg.rotation.z = sx * 0.1;
    g.add(leg);
  }
  return g;
}

/** Doctor Blythe – big stitched surgeon doll */
export function buildBlythe(): THREE.Group {
  const g = new THREE.Group();
  const skin = basic(0xe8d8f0, 0.55);
  const suit = basic(0x58c8a0, 0.5);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 3.4, 5, 12), suit);
  torso.position.y = 4;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 12), skin);
  head.position.y = 7;
  g.add(head);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 3.4, 4, 8), skin);
    arm.position.set(sx * 1.7, 4.6, 0.6);
    arm.rotation.x = -1.0;
    arm.rotation.z = sx * 0.3;
    g.add(arm);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), basic(0x101010, 1, false));
    e.position.set(sx * 0.35, 7.1, 0.9);
    g.add(e);
  }
  const mask = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.15), basic(0xffffff, 0.8));
  mask.position.set(0, 6.6, 0.95);
  g.add(mask);
  return g;
}
