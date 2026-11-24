import * as THREE from 'three';

export type Kind = 'killua' | 'gon' | 'bandit';

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  hand: THREE.Object3D;
  aura: THREE.Mesh;
  mats: THREE.MeshLambertMaterial[];
}

const UP = new THREE.Vector3(0, 1, 0);

function faceTexture(kind: Kind, skin: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = skin;
  g.fillRect(0, 0, 128, 128);
  const ellipse = (x: number, y: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  if (kind === 'killua') {
    // big pale-blue cat eyes, flat serious mouth
    for (const sx of [38, 90]) {
      ellipse(sx, 66, 15, 19, '#ffffff');
      ellipse(sx, 68, 11, 16, '#5fa8d8');
      ellipse(sx, 69, 6, 10, '#10202e');
      ellipse(sx - 3, 61, 3.5, 4.5, '#ffffff');
      g.strokeStyle = '#1d1d28';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(sx - 18, sx < 64 ? 40 : 46);
      g.lineTo(sx + 18, sx < 64 ? 46 : 40);
      g.stroke();
    }
    g.strokeStyle = '#7a4a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(52, 102);
    g.lineTo(76, 102);
    g.stroke();
  } else if (kind === 'gon') {
    for (const sx of [38, 90]) {
      ellipse(sx, 68, 14, 17, '#ffffff');
      ellipse(sx, 70, 11, 15, '#a8641e');
      ellipse(sx, 71, 6, 9, '#2a1406');
      ellipse(sx - 3, 64, 3.5, 4.5, '#ffffff');
      g.strokeStyle = '#1a1210';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(sx - 20, sx < 64 ? 36 : 52);
      g.lineTo(sx + 20, sx < 64 ? 52 : 36);
      g.stroke();
    }
    g.strokeStyle = '#7a4a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(54, 102);
    g.lineTo(74, 102);
    g.stroke();
  } else {
    // bandit: angry eyes + scar
    for (const sx of [38, 90]) {
      ellipse(sx, 70, 11, 8, '#ffffff');
      ellipse(sx, 71, 5, 6, '#111111');
      g.strokeStyle = '#1a1210';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(sx - 18, sx < 64 ? 48 : 58);
      g.lineTo(sx + 18, sx < 64 ? 58 : 48);
      g.stroke();
    }
    g.strokeStyle = '#8a3030';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(40, 100);
    g.lineTo(90, 96);
    g.stroke();
    g.beginPath();
    g.moveTo(96, 60);
    g.lineTo(80, 92);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const coneGeo = new THREE.ConeGeometry(1, 1, 5);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);

export function buildModel(kind: Kind, variant = 0): Rig {
  const mats: THREE.MeshLambertMaterial[] = [];
  const mat = (color: number | string) => {
    const m = new THREE.MeshLambertMaterial({ color });
    mats.push(m);
    return m;
  };
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(boxGeo, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const spike = (parent: THREE.Object3D, m: THREE.Material, bx: number, by: number, bz: number, dir: THREE.Vector3, len: number, rad: number) => {
    const d = dir.clone().normalize();
    const mesh = new THREE.Mesh(coneGeo, m);
    mesh.scale.set(rad, len, rad);
    mesh.position.set(bx, by, bz).addScaledVector(d, len / 2);
    mesh.quaternion.setFromUnitVectors(UP, d);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const skinCol = kind === 'bandit' ? (variant % 2 ? '#d49a6a' : '#c98d5e') : kind === 'killua' ? '#fbe3d0' : '#f6c9a0';
  const skin = mat(skinCol);

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.1;
  root.add(body);

  // ---- palette ----
  let shirt: THREE.MeshLambertMaterial,
    sleeve: THREE.MeshLambertMaterial,
    shorts: THREE.MeshLambertMaterial,
    boot: THREE.MeshLambertMaterial,
    collar: THREE.MeshLambertMaterial;
  if (kind === 'killua') {
    shirt = mat('#f1eff7');
    sleeve = mat('#26305e');
    shorts = mat('#555b70');
    boot = mat('#4a2f2a');
    collar = mat('#1c2348');
  } else if (kind === 'gon') {
    shirt = mat('#2faa3b');
    sleeve = mat('#2faa3b');
    shorts = mat('#2a9a36');
    boot = mat('#2faa3b');
    collar = mat('#173f1f');
  } else {
    const tints = ['#6b4a2f', '#4b5a3a', '#5a3b4a', '#3e4a63'];
    shirt = mat(tints[variant % tints.length]);
    sleeve = skin;
    shorts = mat('#35353f');
    boot = mat('#241a14');
    collar = mat('#241a14');
  }

  // ---- torso ----
  box(body, 1.0, 1.2, 0.6, shirt, 0, 0.6, 0);
  box(body, 0.72, 0.2, 0.66, collar, 0, 1.15, 0);
  box(body, 1.03, 0.58, 0.64, shorts, 0, -0.02, 0);

  if (kind === 'gon') {
    const red = mat('#d6322d');
    box(body, 0.1, 1.0, 0.03, red, 0, 0.62, 0.31);
    box(body, 1.02, 0.09, 0.03, red, 0, 0.12, 0.31);
    box(body, 0.3, 0.07, 0.03, red, -0.28, 0.5, 0.31);
    box(body, 0.3, 0.07, 0.03, red, 0.28, 0.5, 0.31);
    box(body, 1.04, 0.1, 0.62, mat('#1b1b1b'), 0, 0.02, 0);
    box(body, 0.72, 0.1, 0.03, red, 0, 1.2, 0.34);
  }
  if (kind === 'killua') {
    box(body, 0.74, 0.22, 0.62, mat('#2a3366'), 0, 1.08, 0.0);
  }
  if (kind === 'bandit') {
    box(body, 1.05, 0.25, 0.64, mat('#241a14'), 0, 0.12, 0); // belt
    box(body, 0.14, 1.2, 0.64, mat('#241a14'), 0.33, 0.6, 0); // strap
  }

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 1.2;
  body.add(head);
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTexture(kind, skinCol) });
  mats.push(faceMat);
  const headMesh = new THREE.Mesh(boxGeo, [skin, skin, skin, skin, faceMat, skin]);
  headMesh.scale.set(1.0, 0.95, 0.95);
  headMesh.position.y = 0.5;
  headMesh.castShadow = true;
  head.add(headMesh);
  box(head, 0.16, 0.28, 0.1, skin, -0.58, 0.45, 0); // ears
  box(head, 0.16, 0.28, 0.1, skin, 0.58, 0.45, 0);

  // ---- hair ----
  if (kind === 'killua') {
    const hair = mat('#eef1f8');
    const hair2 = mat('#d6dcec');
    box(head, 1.08, 0.3, 1.08, hair, 0, 0.92, 0);
    box(head, 1.08, 0.8, 0.28, hair, 0, 0.62, -0.42);
    box(head, 0.22, 0.6, 0.9, hair2, -0.5, 0.65, 0);
    box(head, 0.22, 0.6, 0.9, hair2, 0.5, 0.65, 0);
    // messy spikes
    const sp: [number, number, number, number, number, number][] = [
      [0, 1.0, 0, 0, 1, 0.1],
      [-0.35, 1.0, 0.1, -0.7, 1, 0.3],
      [0.35, 1.0, 0.1, 0.7, 1, 0.3],
      [-0.1, 1.0, -0.35, -0.3, 0.8, -0.8],
      [0.3, 1.0, -0.3, 0.8, 0.7, -0.6],
      [-0.5, 0.9, -0.3, -1, 0.5, -0.4],
      [0.5, 0.9, -0.35, 1, 0.5, -0.5],
      [0.1, 1.0, 0.3, 0.2, 0.7, 1],
      [-0.55, 0.7, 0.3, -1, 0.1, 0.4],
      [0.55, 0.7, 0.3, 1, 0.1, 0.4],
    ];
    sp.forEach(([x, y, z, dx, dy, dz], i) =>
      spike(head, i % 2 ? hair : hair2, x, y, z, new THREE.Vector3(dx, dy, dz), 0.55 + (i % 3) * 0.12, 0.2)
    );
    // bangs
    for (const bx of [-0.35, 0, 0.35]) spike(head, hair, bx, 0.95, 0.5, new THREE.Vector3(bx * 0.6, -0.8, 0.5), 0.45, 0.17);
  } else if (kind === 'gon') {
    const hair = mat('#15131a');
    const tip = mat('#37c94a');
    box(head, 1.08, 0.3, 1.08, hair, 0, 0.92, 0);
    box(head, 1.08, 0.8, 0.28, hair, 0, 0.62, -0.42);
    box(head, 0.22, 0.55, 0.9, hair, -0.5, 0.65, 0);
    box(head, 0.22, 0.55, 0.9, hair, 0.5, 0.65, 0);
    const dirs: [number, number, number, number, number][] = [
      [0, 0.0, 0.1, 0.0, 1.05],
      [-0.3, 0.1, -0.35, 0.1, 1.0],
      [0.3, 0.1, 0.35, 0.1, 1.0],
      [-0.55, -0.1, -0.8, 0.1, 0.85],
      [0.55, -0.1, 0.8, 0.1, 0.85],
      [-0.3, -0.4, -0.45, -0.6, 0.8],
      [0.3, -0.4, 0.45, -0.6, 0.8],
      [0, 0.4, 0.1, 0.5, 0.8],
    ];
    dirs.forEach(([x, z, dx, dz, len]) => {
      const d = new THREE.Vector3(dx, 1.6, dz);
      spike(head, hair, x * 0.8, 0.98, z, d, len, 0.24);
      const dn = d.clone().normalize();
      spike(head, tip, x * 0.8 + dn.x * len * 0.68, 0.98 + dn.y * len * 0.68, z + dn.z * len * 0.68, d, len * 0.34, 0.1);
    });
    for (const bx of [-0.4, -0.1, 0.2, 0.45]) spike(head, hair, bx, 0.98, 0.5, new THREE.Vector3(bx * 0.4, -0.9, 0.5), 0.4, 0.14);
  } else {
    const hair = mat('#1b1612');
    box(head, 1.06, 0.2, 1.06, hair, 0, 0.98, 0);
    box(head, 1.06, 0.5, 0.2, hair, 0, 0.75, -0.45);
    box(head, 1.1, 0.24, 1.1, mat('#c0262b'), 0, 0.86, 0); // bandana
    box(head, 0.3, 0.3, 0.2, mat('#c0262b'), 0.2, 0.75, -0.62);
  }

  // ---- arms (pivot at shoulder) ----
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.73, 1.1, 0);
    body.add(arm);
    box(arm, 0.4, 1.0, 0.4, sleeve, 0, -0.5, 0);
    if (kind === 'killua') box(arm, 0.47, 0.5, 0.47, mat('#f1eff7'), 0, -0.2, 0); // short white sleeve
    if (kind === 'gon') {
      box(arm, 0.45, 0.2, 0.45, mat('#173f1f'), 0, -0.84, 0);
      box(arm, 0.47, 0.06, 0.47, mat('#d6322d'), 0, -0.7, 0);
    }
    if (kind === 'bandit') box(arm, 0.45, 0.16, 0.45, mat('#241a14'), 0, -0.82, 0);
    box(arm, 0.36, 0.32, 0.36, skin, 0, -1.1, 0);
    return arm;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);
  const hand = new THREE.Object3D();
  hand.position.set(0, -1.2, 0);
  armR.add(hand);

  if (kind === 'bandit') {
    const club = new THREE.Mesh(cylGeo, mat('#5b3a1f'));
    club.scale.set(0.16, 1.6, 0.16);
    club.position.set(0, -1.1, 0.55);
    club.rotation.x = Math.PI / 2 - 0.3;
    club.castShadow = true;
    armR.add(club);
    const knob = new THREE.Mesh(boxGeo, mat('#3f2a16'));
    knob.scale.set(0.42, 0.42, 0.42);
    knob.position.set(0, -1.1 + 0.25, 1.3);
    armR.add(knob);
  }

  // ---- legs (pivot at hip, in root) ----
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.26, 1.1, 0);
    root.add(leg);
    box(leg, 0.46, 1.1, 0.46, skin, 0, -0.55, 0);
    box(leg, 0.5, 0.55, 0.5, shorts, 0, -0.25, 0);
    if (kind === 'killua') {
      box(leg, 0.52, 0.16, 0.52, mat('#cdb99a'), 0, -0.7, 0); // sock cuff
    }
    if (kind === 'gon') {
      box(leg, 0.54, 0.5, 0.54, boot, 0, -0.78, 0);
      box(leg, 0.56, 0.12, 0.56, mat('#1f7a2a'), 0, -0.55, 0); // folded boot top
      box(leg, 0.3, 0.3, 0.03, mat('#dfe9d4'), 0, -0.85, 0.28); // laces
    }
    if (kind === 'bandit') box(leg, 0.52, 0.45, 0.52, mat('#4a3a2a'), 0, -0.82, 0);
    box(leg, 0.52, 0.4, 0.68, boot, 0, -0.9, 0.08);
    return leg;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // aura (additive shell)
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), auraMat);
  aura.scale.set(1.5, 2.1, 1.5);
  aura.position.y = 1.7;
  aura.visible = false;
  root.add(aura);

  return { root, body, head, armL, armR, legL, legR, hand, aura, mats };
}

/** translucent humanoid silhouette used for afterimages */
export function buildSilhouette(color: number): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(boxGeo, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    g.add(mesh);
  };
  add(1, 1.2, 0.6, 0, 1.7, 0);
  add(1, 0.95, 0.95, 0, 2.8, 0);
  add(0.4, 1.2, 0.4, -0.73, 1.7, 0);
  add(0.4, 1.2, 0.4, 0.73, 1.7, 0);
  add(0.46, 1.1, 0.46, -0.26, 0.55, 0);
  add(0.46, 1.1, 0.46, 0.26, 0.55, 0);
  return g;
}
