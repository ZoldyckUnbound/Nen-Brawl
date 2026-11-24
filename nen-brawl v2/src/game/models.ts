import * as THREE from 'three';
import type { Kind } from './defs';

export type { Kind };

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  hand: THREE.Object3D;
  handL: THREE.Object3D;
  foot: THREE.Object3D;
  aura: THREE.Mesh;
  mats: THREE.MeshLambertMaterial[];
  hairMats: THREE.MeshLambertMaterial[];
  hair: THREE.Group;
  hairAdult: THREE.Group | null;
  baseScale: number;
  props: Record<string, THREE.Object3D>;
}

const UP = new THREE.Vector3(0, 1, 0);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const coneGeo = new THREE.ConeGeometry(1, 1, 5);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);

export const BASE_SCALE: Record<Kind, number> = { gon: 1, killua: 1, leorio: 1.1, kurapika: 0.97, hisoka: 1.08, morel: 1.2, chrollo: 1.06, bandit: 1 };
export const SKIN: Record<Kind, string> = {
  gon: '#f1bf92', killua: '#fbe3d0', leorio: '#f0c9a2', kurapika: '#fde6d2', hisoka: '#f6e4e0', morel: '#d9a378', chrollo: '#f3d6bb', bandit: '#c98d5e',
};

function faceTexture(kind: Kind, skin: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = skin;
  g.fillRect(0, 0, 128, 128);
  const el = (x: number, y: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  const line = (x1: number, y1: number, x2: number, y2: number, col: string, w: number) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  const eyes = (iris: string, ew: number, eh: number, brow: string, bw: number, by1: number, by2: number) => {
    for (const sx of [38, 90]) {
      el(sx, 68, ew, eh, '#ffffff');
      el(sx, 70, ew * 0.78, eh * 0.9, iris);
      el(sx, 71, ew * 0.42, eh * 0.55, '#10101a');
      el(sx - 3, 64, 3.5, 4.5, '#ffffff');
      line(sx - 20, sx < 64 ? by1 : by2, sx + 20, sx < 64 ? by2 : by1, brow, bw);
    }
  };
  switch (kind) {
    case 'killua':
      eyes('#5fa8d8', 15, 19, '#1d1d28', 4, 40, 46);
      line(52, 102, 76, 102, '#7a4a3a', 3);
      break;
    case 'gon':
      eyes('#a8641e', 14, 17, '#1a1210', 7, 36, 52);
      line(54, 102, 74, 102, '#7a4a3a', 3);
      break;
    case 'leorio':
      eyes('#3a2a1e', 9, 9, '#14101a', 5, 48, 54);
      for (const sx of [38, 90]) {
        g.strokeStyle = '#c9a24a';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(sx, 69, 18, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(190,220,255,.18)';
        g.fill();
      }
      line(56, 69, 72, 69, '#c9a24a', 3);
      line(50, 104, 78, 106, '#7a4a3a', 3);
      g.fillStyle = 'rgba(40,30,25,.35)';
      g.fillRect(24, 96, 80, 22);
      break;
    case 'kurapika':
      eyes('#6b5a4a', 15, 18, '#c9b44a', 3, 46, 48);
      el(38, 70, 8, 11, '#3b2e24');
      el(90, 70, 8, 11, '#3b2e24');
      line(54, 102, 74, 102, '#a8685a', 3);
      break;
    case 'hisoka':
      for (const sx of [38, 90]) {
        el(sx, 70, 15, 7, '#ffffff');
        el(sx, 71, 7, 6, '#d9a21c');
        el(sx, 71, 3.5, 4.5, '#111');
        line(sx - 20, 64, sx + 20, sx < 64 ? 62 : 66, '#3a1030', 4);
      }
      // star + tear
      g.fillStyle = '#ff4fa0';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 4 : 10;
        g.lineTo(28 + Math.cos(a) * r, 92 + Math.sin(a) * r);
      }
      g.fill();
      g.fillStyle = '#2fd18a';
      g.beginPath();
      g.moveTo(98, 86);
      g.quadraticCurveTo(108, 104, 98, 110);
      g.quadraticCurveTo(88, 104, 98, 86);
      g.fill();
      g.strokeStyle = '#a02a50';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(64, 98, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      break;
    case 'morel':
      el(38, 70, 22, 14, '#0a0a0e');
      el(90, 70, 22, 14, '#0a0a0e');
      line(56, 68, 72, 68, '#0a0a0e', 5);
      line(30, 100, 98, 100, '#5a2a22', 5);
      g.fillStyle = '#f4ecdc';
      for (let i = 0; i < 8; i++) g.fillRect(34 + i * 8, 100, 6, 8);
      line(22, 52, 54, 58, '#6b6b72', 6);
      line(106, 52, 74, 58, '#6b6b72', 6);
      break;
    case 'chrollo':
      eyes('#1c1c24', 13, 14, '#12101a', 4, 48, 50);
      line(54, 104, 74, 104, '#8a5a4a', 3);
      // forehead cross
      g.fillStyle = '#6a3fa0';
      g.fillRect(61, 8, 6, 22);
      g.fillRect(53, 16, 22, 6);
      g.fillStyle = '#a07be0';
      g.fillRect(63, 11, 2, 16);
      break;
    default:
      for (const sx of [38, 90]) {
        el(sx, 70, 11, 8, '#ffffff');
        el(sx, 71, 5, 6, '#111111');
        line(sx - 18, sx < 64 ? 48 : 58, sx + 18, sx < 64 ? 58 : 48, '#1a1210', 7);
      }
      line(40, 100, 90, 96, '#8a3030', 3);
      line(96, 60, 80, 92, '#8a3030', 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

interface Spec {
  upper: string; fore: string; thigh: string; shin: string; boot: string; torso: string; collar: string;
  bulk?: number; foreSkin?: boolean; shinSkin?: boolean;
}

const SPECS: Record<Kind, Spec> = {
  gon: { upper: '#2faa3b', fore: '#2faa3b', foreSkin: true, thigh: '#2a9a36', shin: '#f1bf92', shinSkin: true, boot: '#2faa3b', torso: '#2faa3b', collar: '#173f1f' },
  killua: { upper: '#26305e', fore: '#26305e', foreSkin: true, thigh: '#555b70', shin: '#fbe3d0', shinSkin: true, boot: '#4a2f2a', torso: '#f1eff7', collar: '#1c2348' },
  leorio: { upper: '#1c2a5e', fore: '#1c2a5e', thigh: '#1c2a5e', shin: '#1c2a5e', boot: '#14141a', torso: '#1c2a5e', collar: '#f4f4f8' },
  kurapika: { upper: '#f4f4f8', fore: '#f4f4f8', thigh: '#f1f1f6', shin: '#f1f1f6', boot: '#3f5fc0', torso: '#f4f4f8', collar: '#3f5fc0' },
  hisoka: { upper: '#a9d8ee', fore: '#f6e4e0', foreSkin: true, thigh: '#a9d8ee', shin: '#a9d8ee', boot: '#24285a', torso: '#a9d8ee', collar: '#3b2c5a' },
  morel: { upper: '#7a7580', fore: '#d9a378', foreSkin: true, thigh: '#26262c', shin: '#26262c', boot: '#4a3226', torso: '#7a7580', collar: '#6a6570', bulk: 1.22 },
  chrollo: { upper: '#2a1838', fore: '#2a1838', thigh: '#17171d', shin: '#17171d', boot: '#1a1520', torso: '#2a1838', collar: '#f1eef5' },
  bandit: { upper: '#c98d5e', fore: '#c98d5e', foreSkin: true, thigh: '#35353f', shin: '#4a3a2a', boot: '#241a14', torso: '#6b4a2f', collar: '#241a14' },
};

export function buildModel(kind: Kind, variant = 0): Rig {
  const mats: THREE.MeshLambertMaterial[] = [];
  const hairMats: THREE.MeshLambertMaterial[] = [];
  const mat = (color: number | string) => {
    const m = new THREE.MeshLambertMaterial({ color });
    mats.push(m);
    return m;
  };
  const hmat = (color: number | string) => {
    const m = mat(color);
    hairMats.push(m);
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
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const sp = SPECS[kind];
  const W = sp.bulk ?? 1;
  let skinCol = SKIN[kind];
  if (kind === 'bandit') skinCol = variant % 2 ? '#d49a6a' : '#c98d5e';
  const skin = mat(skinCol);
  const torsoM = mat(sp.torso);
  const upperM = mat(sp.upper);
  const foreM = sp.foreSkin ? skin : mat(sp.fore);
  const thighM = mat(sp.thigh);
  const shinM = sp.shinSkin ? skin : mat(sp.shin);
  const bootM = mat(sp.boot);
  const collarM = mat(sp.collar);

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.1;
  root.add(body);
  const props: Record<string, THREE.Object3D> = {};

  // ---- torso ----
  box(body, 1.0 * W, 1.2, 0.6, torsoM, 0, 0.6, 0);
  box(body, 0.72 * W, 0.2, 0.66, collarM, 0, 1.15, 0);
  box(body, 1.03 * W, 0.58, 0.64, thighM, 0, -0.02, 0);

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
  box(head, 0.16, 0.28, 0.1, skin, -0.58, 0.45, 0);
  box(head, 0.16, 0.28, 0.1, skin, 0.58, 0.45, 0);
  const hair = new THREE.Group();
  head.add(hair);
  let hairAdult: THREE.Group | null = null;

  const capHair = (m: THREE.Material, back = 0.28, side = 0.22) => {
    box(hair, 1.08, 0.3, 1.08, m, 0, 0.92, 0);
    box(hair, 1.08, 0.8, back, m, 0, 0.62, -0.42);
    box(hair, side, 0.6, 0.9, m, -0.5, 0.65, 0);
    box(hair, side, 0.6, 0.9, m, 0.5, 0.65, 0);
  };

  // ---- per character styling ----
  if (kind === 'killua') {
    const h1 = hmat('#eef1f8');
    const h2 = hmat('#d6dcec');
    capHair(h1);
    const sps: number[][] = [
      [0, 1.0, 0, 0, 1, 0.1], [-0.35, 1.0, 0.1, -0.7, 1, 0.3], [0.35, 1.0, 0.1, 0.7, 1, 0.3], [-0.1, 1.0, -0.35, -0.3, 0.8, -0.8],
      [0.3, 1.0, -0.3, 0.8, 0.7, -0.6], [-0.5, 0.9, -0.3, -1, 0.5, -0.4], [0.5, 0.9, -0.35, 1, 0.5, -0.5], [0.1, 1.0, 0.3, 0.2, 0.7, 1],
      [-0.55, 0.7, 0.3, -1, 0.1, 0.4], [0.55, 0.7, 0.3, 1, 0.1, 0.4],
    ];
    sps.forEach(([x, y, z, dx, dy, dz], i) => spike(hair, i % 2 ? h1 : h2, x, y, z, V(dx, dy, dz), 0.55 + (i % 3) * 0.12, 0.2));
    for (const bx of [-0.35, 0, 0.35]) spike(hair, h1, bx, 0.95, 0.5, V(bx * 0.6, -0.8, 0.5), 0.45, 0.17);
    box(body, 0.74 * W, 0.22, 0.62, mat('#2a3366'), 0, 1.08, 0);
  } else if (kind === 'gon') {
    const h1 = hmat('#15131a');
    const tip = hmat('#37c94a');
    capHair(h1);
    const dirs: number[][] = [
      [0, 0.0, 0.1, 0.0, 1.05], [-0.3, 0.1, -0.35, 0.1, 1.0], [0.3, 0.1, 0.35, 0.1, 1.0], [-0.55, -0.1, -0.8, 0.1, 0.85],
      [0.55, -0.1, 0.8, 0.1, 0.85], [-0.3, -0.4, -0.45, -0.6, 0.8], [0.3, -0.4, 0.45, -0.6, 0.8], [0, 0.4, 0.1, 0.5, 0.8],
    ];
    dirs.forEach(([x, z, dx, dz, len]) => {
      const d = V(dx, 1.6, dz);
      spike(hair, h1, x * 0.8, 0.98, z, d, len, 0.24);
      const dn = d.clone().normalize();
      spike(hair, tip, x * 0.8 + dn.x * len * 0.68, 0.98 + dn.y * len * 0.68, z + dn.z * len * 0.68, d, len * 0.34, 0.1);
    });
    for (const bx of [-0.4, -0.1, 0.2, 0.45]) spike(hair, h1, bx, 0.98, 0.5, V(bx * 0.4, -0.9, 0.5), 0.4, 0.14);
    const red = mat('#d6322d');
    box(body, 0.1, 1.0, 0.03, red, 0, 0.62, 0.31);
    box(body, 1.02, 0.09, 0.03, red, 0, 0.12, 0.31);
    box(body, 1.04, 0.1, 0.62, mat('#1b1b1b'), 0, 0.02, 0);
    box(body, 0.72, 0.1, 0.03, red, 0, 1.2, 0.34);
    // adult hair (long, wild, dark green tips)
    hairAdult = new THREE.Group();
    hairAdult.visible = false;
    head.add(hairAdult);
    const ah = hmat('#101810');
    const at = hmat('#1f8a3a');
    box(hairAdult, 1.14, 0.34, 1.14, ah, 0, 0.95, 0);
    box(hairAdult, 1.1, 1.0, 0.3, ah, 0, 0.5, -0.45);
    box(hairAdult, 0.9, 2.2, 0.34, ah, 0, -0.4, -0.62);
    box(hairAdult, 0.5, 1.7, 0.3, ah, -0.45, -0.2, -0.55);
    box(hairAdult, 0.5, 1.7, 0.3, ah, 0.45, -0.2, -0.55);
    box(hairAdult, 0.26, 0.9, 0.9, ah, -0.52, 0.5, 0);
    box(hairAdult, 0.26, 0.9, 0.9, ah, 0.52, 0.5, 0);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const d = V(Math.cos(a) * 0.9, 1.5, Math.sin(a) * 0.9 - 0.15);
      spike(hairAdult, ah, Math.cos(a) * 0.35, 1.0, Math.sin(a) * 0.35, d, 1.5 + (i % 3) * 0.3, 0.3);
      const dn = d.clone().normalize();
      spike(hairAdult, at, Math.cos(a) * 0.35 + dn.x * 1.0, 1.0 + dn.y * 1.0, Math.sin(a) * 0.35 + dn.z * 1.0, d, 0.7, 0.16);
    }
    spike(hairAdult, at, 0, -1.5, -0.7, V(0, -1, -0.2), 0.8, 0.5);
  } else if (kind === 'leorio') {
    const h1 = hmat('#16141c');
    box(hair, 1.08, 0.26, 1.08, h1, 0, 0.9, 0);
    box(hair, 1.08, 0.7, 0.24, h1, 0, 0.6, -0.42);
    box(hair, 0.2, 0.5, 0.9, h1, -0.5, 0.65, 0);
    box(hair, 0.2, 0.5, 0.9, h1, 0.5, 0.65, 0);
    for (let i = 0; i < 9; i++) {
      const x = -0.45 + (i % 5) * 0.225;
      const z = i < 5 ? 0.15 : -0.25;
      spike(hair, h1, x, 0.95, z, V((x - 0.0) * 0.8, 1.3, (i < 5 ? 0.35 : -0.25)), 0.75 + (i % 3) * 0.12, 0.2);
    }
    // shirt V + tie
    box(body, 0.36 * W, 0.95, 0.02, mat('#f4f4f8'), 0, 0.65, 0.31);
    box(body, 0.13, 0.85, 0.035, mat('#1f8a6a'), 0, 0.62, 0.325);
    box(body, 0.1, 0.1, 0.04, mat('#1f8a6a'), 0, 1.07, 0.325);
    box(body, 0.34, 0.9, 0.025, mat('#14224a'), -0.4 * W, 0.6, 0.31);
    box(body, 0.34, 0.9, 0.025, mat('#14224a'), 0.4 * W, 0.6, 0.31);
    // jacket skirt
    box(body, 1.05 * W, 0.45, 0.66, torsoM, 0, -0.32, 0);
  } else if (kind === 'kurapika') {
    const h1 = hmat('#f2dc5d');
    const h2 = hmat('#e0c540');
    box(hair, 1.14, 0.34, 1.14, h1, 0, 0.92, 0);
    box(hair, 1.14, 1.0, 0.3, h1, 0, 0.5, -0.46);
    box(hair, 0.28, 1.0, 1.0, h2, -0.54, 0.5, 0);
    box(hair, 0.28, 1.0, 1.0, h2, 0.54, 0.5, 0);
    for (const bx of [-0.42, -0.14, 0.14, 0.42]) spike(hair, h1, bx, 0.98, 0.5, V(bx * 0.5, -1.1, 0.4), 0.55, 0.19);
    spike(hair, h2, -0.58, 0.45, 0.4, V(-0.4, -1, 0.3), 0.55, 0.16);
    spike(hair, h2, 0.58, 0.45, 0.4, V(0.4, -1, 0.3), 0.55, 0.16);
    // tabard
    const blue = mat('#2f4fb8');
    const redT = mat('#e8584a');
    box(body, 0.98 * W, 1.95, 0.07, blue, 0, 0.12, 0.36);
    box(body, 0.98 * W, 2.0, 0.07, blue, 0, 0.1, -0.36);
    box(body, 0.1, 1.95, 0.075, redT, -0.45 * W, 0.12, 0.365);
    box(body, 0.1, 1.95, 0.075, redT, 0.45 * W, 0.12, 0.365);
    box(body, 0.98 * W, 0.1, 0.075, redT, 0, -0.84, 0.365);
    box(body, 0.45, 0.5, 0.08, redT, 0, -0.35, 0.37);
    box(body, 0.2, 0.22, 0.08, blue, 0, -0.35, 0.375);
    box(body, 0.2, 0.2, 0.08, redT, 0, 0.3, -0.37);
    box(body, 0.34, 0.14, 0.64, blue, -0.35 * W, 1.18, 0);
    box(body, 0.34, 0.14, 0.64, blue, 0.35 * W, 1.18, 0);
    box(body, 0.4, 0.22, 0.12, redT, 0, 1.12, 0.36);
    box(body, 0.14, 0.14, 0.14, redT, 0, 1.12, 0.38);
  } else if (kind === 'hisoka') {
    const h1 = hmat('#e8334a');
    const h2 = hmat('#5b2a86');
    box(hair, 1.1, 0.3, 1.1, h1, 0, 0.92, 0);
    box(hair, 1.1, 0.8, 0.3, h2, 0, 0.6, -0.42);
    box(hair, 0.22, 0.55, 0.9, h1, -0.5, 0.66, 0);
    box(hair, 0.22, 0.55, 0.9, h1, 0.5, 0.66, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = V(Math.cos(a) * 0.7, 1.4, Math.sin(a) * 0.7 - 0.5);
      spike(hair, i % 3 === 0 ? h2 : h1, Math.cos(a) * 0.4, 1.0, Math.sin(a) * 0.4, d, 0.9 + (i % 4) * 0.2, 0.26);
    }
    spike(hair, h1, 0, 0.9, -0.6, V(0, 0.2, -1), 1.2, 0.35);
    // puffy sleeves handled at arm creation; cropped top details
    const dp = mat('#3b2c5a');
    box(body, 0.2, 0.2, 0.03, dp, -0.22, 0.85, 0.31);
    box(body, 0.2, 0.2, 0.03, dp, 0.22, 0.85, 0.31);
    box(body, 0.2, 0.2, 0.03, dp, -0.22, 0.85, -0.31);
    box(body, 0.2, 0.2, 0.03, mat('#d2325a'), 0.22, 0.85, -0.31);
    box(body, 1.08, 0.34, 0.66, mat('#e86a96'), 0, 0.18, 0);
    box(body, 1.2, 0.5, 0.78, mat('#f3d84a'), 0, -0.3, 0);
    box(body, 0.34, 0.7, 0.1, mat('#f3d84a'), 0.3, -0.5, 0.36);
    box(body, 0.34, 0.6, 0.1, mat('#e2c63c'), -0.3, -0.55, -0.36);
    box(body, 0.78, 0.1, 0.62, mat('#e86a96'), 0, 1.2, 0);
  } else if (kind === 'morel') {
    const h1 = hmat('#c9c9cf');
    const h2 = hmat('#aeaeb6');
    box(hair, 1.12, 0.3, 1.1, h1, 0, 0.92, 0);
    box(hair, 1.1, 1.9, 0.26, h1, 0, 0.0, -0.46);
    box(hair, 0.22, 1.5, 0.9, h2, -0.55, 0.15, 0.0);
    box(hair, 0.22, 1.5, 0.9, h2, 0.55, 0.15, 0.0);
    box(hair, 1.0, 0.3, 0.22, h1, 0, 0.88, 0.5);
    box(head, 0.2, 0.42, 0.38, skin, 0, 0.36, 0.6); // big nose
    box(body, 0.16, 1.1, 0.04, mat('#8b2c2f'), 0, 0.6, 0.32);
    box(body, 0.2, 0.2, 0.05, mat('#8b2c2f'), 0, 1.05, 0.33);
    box(body, 0.5, 0.5, 0.03, mat('#6c6772'), -0.25, 0.5, 0.31);
    // pipe
    const pipe = new THREE.Group();
    box(pipe, 0.08, 0.08, 0.7, mat('#2a1a10'), 0, 0, 0.3);
    box(pipe, 0.2, 0.3, 0.2, mat('#3a2412'), 0, 0.14, 0.7);
    props.pipe = pipe;
    pipe.position.set(0.2, 0.18, 0.5);
    head.add(pipe);
  } else if (kind === 'chrollo') {
    const h1 = hmat('#0d0c14');
    box(hair, 1.06, 0.2, 1.06, h1, 0, 0.96, 0);
    box(hair, 1.06, 0.7, 0.2, h1, 0, 0.62, -0.44);
    box(hair, 0.16, 0.45, 0.85, h1, -0.5, 0.7, 0);
    box(hair, 0.16, 0.45, 0.85, h1, 0.5, 0.7, 0);
    box(hair, 0.4, 0.5, 0.2, h1, 0, 0.4, -0.58);
    box(head, 0.12, 0.2, 0.12, mat('#2fd1b8'), -0.64, 0.22, 0.05);
    box(head, 0.12, 0.2, 0.12, mat('#2fd1b8'), 0.64, 0.22, 0.05);
    const fur = mat('#f1eef5');
    const coat = mat('#2a1838');
    const lining = mat('#6b1535');
    // open coat: bare chest strip
    box(body, 0.34 * W, 1.05, 0.03, skin, 0, 0.58, 0.31);
    box(body, 0.36 * W, 1.2, 0.05, coat, -0.34 * W, 0.6, 0.325);
    box(body, 0.36 * W, 1.2, 0.05, coat, 0.34 * W, 0.6, 0.325);
    // long coat tails
    box(body, 0.42 * W, 1.9, 0.07, coat, -0.38 * W, -0.35, 0.34);
    box(body, 0.42 * W, 1.9, 0.07, coat, 0.38 * W, -0.35, 0.34);
    box(body, 1.04 * W, 2.1, 0.08, coat, 0, -0.45, -0.34);
    box(body, 0.9 * W, 1.7, 0.03, lining, 0, -0.35, -0.29);
    box(body, 0.1, 0.9, 0.04, mat('#e0b84a'), 0, 0.4, -0.4);
    box(body, 0.5, 0.1, 0.04, mat('#e0b84a'), 0, 0.62, -0.4);
    for (const by of [0.9, 0.5, 0.1]) box(body, 0.08, 0.08, 0.04, mat('#e0b84a'), 0.38 * W, by, 0.36);
    // fur collar
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      spike(body, fur, Math.cos(a) * 0.52 * W, 1.12, Math.sin(a) * 0.36, V(Math.cos(a) * 0.9, 1.1, Math.sin(a) * 0.9), 0.55, 0.2);
    }
    box(body, 1.1 * W, 0.2, 0.7, fur, 0, 1.15, 0);
  } else if (kind === 'bandit') {
    const h1 = hmat('#1b1612');
    box(hair, 1.06, 0.2, 1.06, h1, 0, 0.98, 0);
    box(hair, 1.06, 0.5, 0.2, h1, 0, 0.75, -0.45);
    box(hair, 1.1, 0.24, 1.1, mat('#c0262b'), 0, 0.86, 0);
    box(hair, 0.3, 0.3, 0.2, mat('#c0262b'), 0.2, 0.75, -0.62);
    box(body, 1.05, 0.25, 0.64, mat('#241a14'), 0, 0.12, 0);
    box(body, 0.14, 1.2, 0.64, mat('#241a14'), 0.33, 0.6, 0);
    void variant;
  }

  // ---- arms ----
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * (0.5 * W + 0.23), 1.1, 0);
    body.add(arm);
    const puffy = kind === 'hisoka';
    box(arm, (puffy ? 0.64 : 0.4 * (W > 1 ? 1.2 : 1)), puffy ? 0.62 : 0.58, puffy ? 0.64 : 0.4 * (W > 1 ? 1.2 : 1), upperM, 0, -0.29, 0);
    const fore = new THREE.Group();
    fore.position.set(0, -0.58, 0);
    arm.add(fore);
    const fw = 0.36 * (W > 1 ? 1.15 : 1);
    box(fore, fw, 0.52, fw, foreM, 0, -0.26, 0);
    box(fore, 0.34, 0.34, 0.34, skin, 0, -0.6, 0);
    if (kind === 'gon') {
      box(fore, 0.45, 0.18, 0.45, mat('#173f1f'), 0, -0.1, 0);
      box(fore, 0.47, 0.06, 0.47, mat('#d6322d'), 0, 0.02, 0);
    }
    if (kind === 'killua') box(arm, 0.47, 0.5, 0.47, mat('#f1eff7'), 0, -0.22, 0);
    if (kind === 'hisoka') box(fore, 0.4, 0.14, 0.4, mat('#e86a96'), 0, -0.4, 0);
    if (kind === 'chrollo') box(fore, 0.5, 0.26, 0.5, mat('#f1eef5'), 0, -0.4, 0);
    if (kind === 'leorio') box(fore, 0.4, 0.1, 0.4, mat('#f4f4f8'), 0, -0.5, 0);
    if (kind === 'kurapika') box(fore, 0.4, 0.1, 0.4, mat('#e8584a'), 0, -0.48, 0);
    if (kind === 'bandit') box(fore, 0.45, 0.16, 0.45, mat('#241a14'), 0, -0.4, 0);
    return { arm, fore };
  };
  const aL = makeArm(-1);
  const aR = makeArm(1);
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.68, 0.05);
  aR.fore.add(hand);
  const handL = new THREE.Object3D();
  handL.position.set(0, -0.68, 0.05);
  aL.fore.add(handL);

  if (kind === 'bandit') {
    const club = new THREE.Mesh(cylGeo, mat('#5b3a1f'));
    club.scale.set(0.16, 1.6, 0.16);
    club.position.set(0, -0.6, 0.55);
    club.rotation.x = Math.PI / 2 - 0.3;
    club.castShadow = true;
    aR.fore.add(club);
    const knob = new THREE.Mesh(boxGeo, mat('#3f2a16'));
    knob.scale.set(0.42, 0.42, 0.42);
    knob.position.set(0, -0.35, 1.3);
    aR.fore.add(knob);
  }
  if (kind === 'leorio') {
    const cs = new THREE.Group();
    box(cs, 0.22, 0.8, 1.05, mat('#5a3b22'), 0, 0, 0);
    box(cs, 0.26, 0.1, 0.3, mat('#c9a24a'), 0, 0.2, 0);
    cs.position.set(0, -0.85, 0.05);
    aL.fore.add(cs);
    props.case = cs;
  }

  // ---- legs ----
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.26 * (W > 1 ? 1.2 : 1), 1.1, 0);
    root.add(leg);
    const lw = 0.46 * (W > 1 ? 1.15 : 1);
    box(leg, lw, 0.58, lw, thighM, 0, -0.29, 0);
    const shin = new THREE.Group();
    shin.position.set(0, -0.58, 0);
    leg.add(shin);
    box(shin, lw * 0.95, 0.54, lw * 0.95, shinM, 0, -0.27, 0);
    box(shin, 0.52, 0.3, 0.7, bootM, 0, -0.4, 0.08);
    if (kind === 'killua') box(shin, 0.52, 0.16, 0.52, mat('#cdb99a'), 0, -0.1, 0);
    if (kind === 'gon') {
      box(shin, 0.56, 0.12, 0.56, mat('#1f7a2a'), 0, -0.08, 0);
      box(shin, 0.3, 0.26, 0.03, mat('#dfe9d4'), 0, -0.4, 0.4);
    }
    if (kind === 'hisoka') {
      for (let i = 0; i < 3; i++) box(shin, 0.5, 0.08, 0.5, mat(i % 2 ? '#e86a96' : '#f3d0dc'), 0, -0.18 - i * 0.11, 0);
      const toe = new THREE.Mesh(coneGeo, bootM);
      toe.scale.set(0.2, 0.5, 0.2);
      toe.rotation.x = Math.PI / 2;
      toe.position.set(0, -0.4, 0.55);
      shin.add(toe);
    }
    if (kind === 'chrollo') {
      box(shin, 0.58, 0.07, 0.58, mat('#9aa0b0'), 0, -0.1, 0);
      box(shin, 0.58, 0.07, 0.58, mat('#9aa0b0'), 0, -0.3, 0);
      box(shin, 0.1, 0.1, 0.1, mat('#e0b84a'), 0, -0.4, 0.38);
    }
    if (kind === 'kurapika') box(shin, 0.5, 0.1, 0.5, mat('#f1f1f6'), 0, -0.05, 0);
    if (kind === 'bandit') box(shin, 0.52, 0.45, 0.52, mat('#4a3a2a'), 0, -0.27, 0);
    return { leg, shin };
  };
  const lL = makeLeg(-1);
  const lR = makeLeg(1);
  const foot = new THREE.Object3D();
  foot.position.set(0, -0.5, 0.25);
  lR.shin.add(foot);

  // aura (additive shell)
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  aura.scale.set(1.5, 2.1, 1.5);
  aura.position.y = 1.7;
  aura.visible = false;
  root.add(aura);

  const baseScale = BASE_SCALE[kind];
  root.scale.setScalar(baseScale);

  return {
    root, body, head, armL: aL.arm, armR: aR.arm, foreL: aL.fore, foreR: aR.fore, legL: lL.leg, legR: lR.leg, shinL: lL.shin, shinR: lR.shin,
    hand, handL, foot, aura, mats, hairMats, hair, hairAdult, baseScale, props,
  };
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
