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
  mats: THREE.MeshToonMaterial[];
  hairMats: THREE.MeshToonMaterial[];
  hair: THREE.Group;
  hairAdult: THREE.Group | null;
  baseScale: number;
  props: Record<string, THREE.Object3D>;
}

const UP = new THREE.Vector3(0, 1, 0);
export const BASE_SCALE: Record<Kind, number> = {
  gon: 1, killua: 1, leorio: 1.1, kurapika: 0.98, hisoka: 1.1, morel: 1.2, chrollo: 1.07, bandit: 1,
  netero: 0.96, kite: 1.12, knov: 1.08, knuckle: 1.14, pitou: 0.94,
};
export const SKIN: Record<Kind, string> = {
  gon: '#f0b98a', killua: '#fbe6d6', leorio: '#eec59c', kurapika: '#fde8d6', hisoka: '#f6e4de', morel: '#dba67c', chrollo: '#f3d8c0',
  bandit: '#c98d5e', netero: '#f1c9aa', kite: '#f4dcc6', knov: '#f0d2b6', knuckle: '#eab98e', pitou: '#f7ebe6',
};

// ---------------------------------------------------------------- shared look: toon shading + ink outline
const toonGrad = (() => {
  const d = new Uint8Array([95, 150, 215, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide });

function addOutline(mesh: THREE.Mesh, thick: number) {
  const geo = mesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const r = geo.boundingSphere!.radius;
  const sc = (Math.abs(mesh.scale.x) + Math.abs(mesh.scale.y) + Math.abs(mesh.scale.z)) / 3;
  const o = new THREE.Mesh(geo, outlineMat);
  o.scale.setScalar(1 + thick / Math.max(0.05, r * sc));
  mesh.add(o);
}

// ---------------------------------------------------------------- faces (transparent decal painted over the skull)
type Ctx = CanvasRenderingContext2D;
const FW = 320;
const FH = 240;
const EY = 112;
const EX = [86, 234];

function eye(g: Ctx, skin: string, cx: number, cy: number, w: number, h: number, iris: string, side: number, o: { lid?: number; slit?: boolean; lash?: number; pupil?: number; tilt?: number } = {}) {
  const lid = o.lid ?? 0;
  g.save();
  g.translate(cx, cy);
  g.rotate((o.tilt ?? 0) * side);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = iris;
  g.beginPath();
  g.ellipse(side * -2, 2, w * 0.68, h * 0.98, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0b0a12';
  g.beginPath();
  if (o.slit) g.ellipse(side * -2, 2, w * 0.1, h * 0.9, 0, 0, Math.PI * 2);
  else g.ellipse(side * -2, 2, w * (o.pupil ?? 0.34), h * (o.pupil ?? 0.34) * 1.35, 0, 0, Math.PI * 2);
  g.fill();
  const gr = g.createLinearGradient(0, -h, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)');
  gr.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(-w, -h, w * 2, h * 2);
  g.restore();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(-w * 0.28, -h * 0.34, w * 0.2, h * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(w * 0.2, h * 0.38, w * 0.08, h * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#17121c';
  g.lineWidth = o.lash ?? 5;
  g.lineCap = 'round';
  g.beginPath();
  g.ellipse(0, 0, w, h, 0, Math.PI * 1.02, Math.PI * 1.98);
  g.stroke();
  if (lid > 0) {
    g.fillStyle = skin;
    g.beginPath();
    g.rect(-w - 4, -h - 4, w * 2 + 8, (h * 2 + 8) * lid);
    g.fill();
    g.strokeStyle = '#17121c';
    g.lineWidth = (o.lash ?? 5) + 1;
    g.beginPath();
    g.moveTo(-w, -h + h * 2 * lid);
    g.lineTo(w, -h + h * 2 * lid);
    g.stroke();
  }
  g.restore();
}
function brow(g: Ctx, cx: number, cy: number, len: number, thick: number, ang: number, col: string, side: number) {
  g.save();
  g.translate(cx, cy);
  g.rotate(ang * side);
  g.strokeStyle = col;
  g.lineWidth = thick;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-len, 0);
  g.quadraticCurveTo(0, -thick * 0.5, len, 0);
  g.stroke();
  g.restore();
}
function mouth(g: Ctx, kind: 'flat' | 'smile' | 'grin' | 'frown' | 'smirk' | 'open', col = '#8a4a40', y = 190, w = 22) {
  g.strokeStyle = col;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  if (kind === 'flat') {
    g.moveTo(160 - w, y);
    g.lineTo(160 + w, y);
  } else if (kind === 'smile') {
    g.moveTo(160 - w, y - 3);
    g.quadraticCurveTo(160, y + 14, 160 + w, y - 3);
  } else if (kind === 'frown') {
    g.moveTo(160 - w, y + 5);
    g.quadraticCurveTo(160, y - 8, 160 + w, y + 5);
  } else if (kind === 'smirk') {
    g.moveTo(160 - w, y + 2);
    g.quadraticCurveTo(160 + 6, y + 8, 160 + w + 6, y - 6);
  } else if (kind === 'grin') {
    g.moveTo(160 - w - 6, y - 6);
    g.quadraticCurveTo(160, y + 24, 160 + w + 6, y - 6);
    g.lineTo(160 - w - 6, y - 6);
    g.fillStyle = '#5a1a20';
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(160 - w + 2, y - 6, w * 2 - 4, 7);
  } else {
    g.ellipse(160, y + 3, w * 0.55, 9, 0, 0, Math.PI * 2);
    g.fillStyle = '#5a1a20';
    g.fill();
  }
  g.stroke();
}
function nose(g: Ctx, y = 150) {
  g.strokeStyle = 'rgba(120,70,50,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(158, y - 8);
  g.lineTo(154, y + 6);
  g.lineTo(163, y + 6);
  g.stroke();
}
function glasses(g: Ctx, col: string, w: number, h: number, round = false) {
  for (const cx of EX) {
    g.strokeStyle = col;
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(cx - w / 2, EY - h / 2, w, h, round ? w / 2 : 10);
    g.stroke();
    g.fillStyle = 'rgba(190,225,255,0.20)';
    g.fill();
  }
  g.strokeStyle = col;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(EX[0] + w / 2, EY - 6);
  g.lineTo(EX[1] - w / 2, EY - 6);
  g.stroke();
}

function faceTexture(kind: Kind, skin: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = FW;
  c.height = FH;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, FW, FH);
  const both = (fn: (cx: number, side: number) => void) => {
    fn(EX[0], -1);
    fn(EX[1], 1);
  };
  switch (kind) {
    case 'gon':
      both((cx, s) => {
        eye(g, skin, cx, EY, 27, 33, '#b0701e', s, { pupil: 0.4, lash: 5 });
        brow(g, cx, EY - 52, 28, 9, 0.18, '#16110f', s);
      });
      mouth(g, 'grin', '#7a3a30', 192, 20);
      nose(g, 152);
      break;
    case 'killua':
      both((cx, s) => {
        eye(g, skin, cx, EY, 28, 31, '#59b3e8', s, { pupil: 0.3, tilt: -0.08 });
        brow(g, cx, EY - 50, 30, 6, -0.16, '#d9dce8', s);
      });
      mouth(g, 'smirk', '#8a4a4a', 192, 14);
      nose(g, 152);
      break;
    case 'leorio':
      both((cx, s) => {
        eye(g, skin, cx, EY, 17, 17, '#2a2118', s, { pupil: 0.45, lash: 4 });
        brow(g, cx, EY - 38, 24, 9, 0.12, '#14101a', s);
      });
      glasses(g, '#c8a050', 80, 60);
      mouth(g, 'smile', '#7a4a3a', 196, 20);
      nose(g, 156);
      break;
    case 'kurapika':
      both((cx, s) => {
        eye(g, skin, cx, EY, 25, 30, '#7a1c1c', s, { pupil: 0.3, lash: 5 });
        brow(g, cx, EY - 48, 28, 5, 0.04, '#d8bd45', s);
      });
      mouth(g, 'flat', '#a8685a', 194, 14);
      nose(g, 154);
      break;
    case 'hisoka':
      both((cx, s) => {
        eye(g, skin, cx, EY + 4, 29, 18, '#e0b020', s, { slit: true, lash: 6, tilt: 0.12 });
        brow(g, cx, EY - 34, 30, 6, -0.2, '#4a1030', s);
      });
      g.fillStyle = '#ff4fa0';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 6 : 15;
        g.lineTo(60 + Math.cos(a) * r, 150 + Math.sin(a) * r);
      }
      g.fill();
      g.fillStyle = '#2fd18a';
      g.beginPath();
      g.moveTo(260, 140);
      g.quadraticCurveTo(272, 164, 260, 172);
      g.quadraticCurveTo(248, 164, 260, 140);
      g.fill();
      mouth(g, 'grin', '#a02a50', 192, 26);
      nose(g, 154);
      break;
    case 'morel':
      both((cx, s) => {
        eye(g, skin, cx, EY, 22, 10, '#2a2a2e', s, { lash: 6, pupil: 0.5 });
        brow(g, cx, EY - 30, 32, 12, 0.06, '#6b6b72', s);
      });
      mouth(g, 'flat', '#4a2a22', 204, 28);
      break;
    case 'chrollo':
      both((cx, s) => {
        eye(g, skin, cx, EY, 23, 26, '#17151f', s, { pupil: 0.5, lash: 5, lid: 0.16 });
        brow(g, cx, EY - 44, 26, 5, 0.1, '#0d0c14', s);
      });
      mouth(g, 'flat', '#8a5a4a', 194, 14);
      nose(g, 154);
      g.fillStyle = '#6a3fa0';
      g.fillRect(155, 6, 10, 38);
      g.fillRect(142, 17, 36, 9);
      break;
    case 'netero':
      both((cx, s) => {
        eye(g, skin, cx, EY + 2, 22, 13, '#40302a', s, { lash: 4, pupil: 0.5, lid: 0.3 });
        g.strokeStyle = 'rgba(150,100,80,0.5)';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(cx, EY + 26, 18, 0.3, Math.PI - 0.3);
        g.stroke();
      });
      mouth(g, 'smile', '#a04a40', 198, 14);
      break;
    case 'kite':
      both((cx, s) => {
        eye(g, skin, cx, EY + 2, 26, 15, '#1c1a24', s, { pupil: 0.55, lash: 6, lid: 0.22, tilt: -0.06 });
        brow(g, cx, EY - 32, 30, 5, -0.1, '#8a8a98', s);
      });
      mouth(g, 'smirk', '#8a5a4a', 194, 14);
      nose(g, 156);
      break;
    case 'knov':
      both((cx, s) => {
        eye(g, skin, cx, EY, 18, 19, '#1b1b26', s, { pupil: 0.5, lash: 4, lid: 0.14 });
        brow(g, cx, EY - 40, 24, 5, -0.08, '#101018', s);
      });
      glasses(g, '#9aa4b8', 76, 54);
      mouth(g, 'flat', '#8a5a4a', 196, 14);
      nose(g, 156);
      break;
    case 'knuckle':
      both((cx, s) => {
        eye(g, skin, cx, EY + 2, 23, 18, '#2a1d16', s, { pupil: 0.5, lash: 6, lid: 0.18, tilt: 0.14 });
        brow(g, cx, EY - 32, 34, 12, 0.26, '#0e0c10', s);
      });
      mouth(g, 'frown', '#7a3a30', 198, 24);
      nose(g, 156);
      break;
    case 'pitou':
      both((cx, s) => {
        eye(g, skin, cx, EY + 4, 31, 34, '#e0507a', s, { slit: true, pupil: 0.3, lash: 5 });
        brow(g, cx, EY - 50, 22, 4, 0.1, '#c9c9d4', s);
      });
      g.strokeStyle = '#c0707a';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(138, 192);
      g.quadraticCurveTo(149, 204, 160, 192);
      g.quadraticCurveTo(171, 204, 182, 192);
      g.stroke();
      break;
    default:
      both((cx, s) => {
        eye(g, skin, cx, EY, 18, 14, '#111', s, { lash: 7, pupil: 0.5 });
        brow(g, cx, EY - 34, 28, 10, 0.3, '#1a1210', s);
      });
      g.strokeStyle = '#8a3030';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(200, 70);
      g.lineTo(170, 150);
      g.stroke();
      mouth(g, 'frown', '#6a2a2a', 196, 24);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function stripeTexture(a: string, b: string, n = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const w = 64 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(i * w, 0, w, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

interface Spec {
  upper: string; fore: string; thigh: string; shin: string; boot: string; torso: string; collar: string;
  bulk?: number; thin?: number; foreSkin?: boolean; shinSkin?: boolean;
}
const SPECS: Record<Kind, Spec> = {
  gon: { upper: '#2e9a3e', fore: '#2e9a3e', foreSkin: true, thigh: '#2a8a38', shin: '#f0b98a', shinSkin: true, boot: '#2e8a3a', torso: '#2e9a3e', collar: '#1d5a2a' },
  killua: { upper: '#2a2f66', fore: '#2a2f66', foreSkin: true, thigh: '#6a7088', shin: '#fbe6d6', shinSkin: true, boot: '#4a2f2a', torso: '#eceaf6', collar: '#1c2348' },
  leorio: { upper: '#1b2142', fore: '#1b2142', thigh: '#1b2142', shin: '#1b2142', boot: '#101016', torso: '#1b2142', collar: '#f4f4f8' },
  kurapika: { upper: '#f6f6fa', fore: '#f6f6fa', thigh: '#f1f1f6', shin: '#f1f1f6', boot: '#3f5fc0', torso: '#f6f6fa', collar: '#3f5fc0' },
  hisoka: { upper: '#a9d8ee', fore: '#f6e4e0', foreSkin: true, thigh: '#f3d84a', shin: '#f3d84a', boot: '#24285a', torso: '#a9d8ee', collar: '#3b2c5a' },
  morel: { upper: '#78737e', fore: '#dba67c', foreSkin: true, thigh: '#26262c', shin: '#26262c', boot: '#4a3226', torso: '#78737e', collar: '#6a6570', bulk: 1.22 },
  chrollo: { upper: '#1c1224', fore: '#1c1224', thigh: '#15151b', shin: '#15151b', boot: '#1a1520', torso: '#1c1224', collar: '#f1eef5' },
  bandit: { upper: '#c98d5e', fore: '#c98d5e', foreSkin: true, thigh: '#35353f', shin: '#4a3a2a', boot: '#241a14', torso: '#6b4a2f', collar: '#241a14' },
  netero: { upper: '#f1f6fb', fore: '#f1f6fb', thigh: '#f1f6fb', shin: '#e9e3d6', boot: '#7a4a28', torso: '#f1f6fb', collar: '#2f7fc0', bulk: 0.96 },
  kite: { upper: '#f4f5f8', fore: '#f4f5f8', thigh: '#17171d', shin: '#17171d', boot: '#8a7a44', torso: '#f4f5f8', collar: '#f4f5f8', bulk: 0.86, thin: 0.84 },
  knov: { upper: '#14141c', fore: '#14141c', thigh: '#14141c', shin: '#14141c', boot: '#0c0c10', torso: '#14141c', collar: '#f4f4f8', bulk: 0.94, thin: 0.9 },
  knuckle: { upper: '#f6f6f8', fore: '#f6f6f8', thigh: '#f1f1f4', shin: '#f1f1f4', boot: '#101014', torso: '#f6f6f8', collar: '#f6f6f8', bulk: 1.14, thin: 1.1 },
  pitou: { upper: '#1a2552', fore: '#1a2552', thigh: '#b8683a', shin: '#f7ebe6', shinSkin: true, boot: '#1a2552', torso: '#1a2552', collar: '#1a2552', bulk: 0.8, thin: 0.78 },
};

export function buildModel(kind: Kind, variant = 0): Rig {
  const mats: THREE.MeshToonMaterial[] = [];
  const hairMats: THREE.MeshToonMaterial[] = [];
  const mat = (color: number | string, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGrad, ...extra });
    mats.push(m);
    return m;
  };
  const hmat = (color: number | string) => {
    const m = mat(color);
    hairMats.push(m);
    return m;
  };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ol = 0.03) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    if (ol > 0) addOutline(mesh, ol);
    return mesh;
  };
  const cap = (p: THREE.Object3D, r: number, len: number, m: THREE.Material, x: number, y: number, z: number, sx = 1, sz = 1) =>
    add(p, new THREE.CapsuleGeometry(r, len, 5, 14), m, x, y, z, sx, 1, sz);
  const ball = (p: THREE.Object3D, r: number, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ol = 0.025) =>
    add(p, new THREE.SphereGeometry(r, 18, 14), m, x, y, z, sx, sy, sz, ol);
  const cyl = (p: THREE.Object3D, rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, sx = 1, sz = 1, seg = 18) =>
    add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, sx, 1, sz);
  const box = (p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ol = 0.02) =>
    add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, 1, 1, 1, ol);
  const spike = (p: THREE.Object3D, m: THREE.Material, bx: number, by: number, bz: number, dir: THREE.Vector3, len: number, rad: number) => {
    const d = dir.clone().normalize();
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 7), m);
    mesh.position.set(bx, by, bz).addScaledVector(d, len / 2);
    mesh.quaternion.setFromUnitVectors(UP, d);
    mesh.castShadow = true;
    p.add(mesh);
    addOutline(mesh, 0.02);
    return mesh;
  };
  /** open cylinder wedge – coat tails and skirts */
  const skirt = (p: THREE.Object3D, rt: number, rb: number, h: number, m: THREE.MeshToonMaterial, y: number, thStart: number, thLen: number, sz = 0.62) => {
    const geo = new THREE.CylinderGeometry(rt, rb, h, 24, 1, true, thStart, thLen);
    const mm = m.clone();
    mm.side = THREE.DoubleSide;
    mats.push(mm);
    const mesh = new THREE.Mesh(geo, mm);
    mesh.scale.set(1, 1, sz);
    mesh.position.set(0, y, 0);
    mesh.castShadow = true;
    p.add(mesh);
    return mesh;
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const sp = SPECS[kind];
  const W = sp.bulk ?? 1;
  const T = sp.thin ?? 1;
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
  const gold = mat('#e8c24a');
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.1;
  root.add(body);
  const props: Record<string, THREE.Object3D> = {};

  // ---- torso ----
  const tw = 0.5 * W;
  cyl(body, tw, tw * 0.82, 1.2, torsoM, 0, 0.62, 0, 1, 0.6);
  cyl(body, tw * 0.84, tw * 0.9, 0.34, thighM, 0, -0.05, 0, 1, 0.62);
  cyl(body, 0.15 * Math.max(0.8, T), 0.17 * Math.max(0.8, T), 0.24, skin, 0, 1.26, 0.0);

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 1.22;
  body.add(head);
  const faceMat = new THREE.MeshToonMaterial({ map: faceTexture(kind, skinCol), transparent: true, gradientMap: toonGrad, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mats.push(faceMat);
  const hw = kind === 'morel' ? 0.56 : kind === 'pitou' ? 0.5 : kind === 'knuckle' ? 0.54 : kind === 'kite' || kind === 'knov' ? 0.46 : 0.5;
  const hh = kind === 'morel' || kind === 'kite' ? 0.58 : 0.54;
  const hy = 0.56;
  ball(head, 1, skin, 0, hy, 0, hw, hh, hw * 0.96, 0.02);
  const faceGeo = new THREE.SphereGeometry(1, 28, 18, Math.PI / 2 - 0.95, 1.9, 1.05, 1.45);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.scale.set(hw * 1.012, hh * 1.012, hw * 0.96 * 1.012);
  face.position.set(0, hy, 0);
  head.add(face);
  ball(head, 1, skin, 0, hy - 0.2, 0.05, hw * 0.78, hh * 0.62, hw * 0.78, 0.0);
  ball(head, 0.12, skin, -hw * 0.98, hy - 0.02, 0, 0.5, 1, 0.8, 0.012);
  ball(head, 0.12, skin, hw * 0.98, hy - 0.02, 0, 0.5, 1, 0.8, 0.012);
  const hair = new THREE.Group();
  head.add(hair);
  let hairAdult: THREE.Group | null = null;
  /** hair helmet: a shell over the top/back of the skull */
  const hairCap = (p: THREE.Object3D, m: THREE.Material, len = 1.5, grow = 1.07, y = hy + 0.03, back = true) => {
    const geo = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.min(len, 1.2));
    const mesh = add(p, geo, m, 0, y, -0.02, hw * grow, hh * grow, hw * 0.96 * grow, 0.02);
    if (back) ball(p, 1, m, 0, hy + 0.08, -0.1, hw * 1.04, hh * 0.66 * grow, hw * 0.8, 0.02);
    return mesh;
  };

  // ---- per character styling ----
  if (kind === 'killua') {
    const h1 = hmat('#eef1fa');
    const h2 = hmat('#cdd4ea');
    hairCap(hair, h1, 1.35, 1.08, hy + 0.04);
    const sps: number[][] = [
      [0, 0.95, 0.05, 0, 1, 0.1], [-0.3, 0.92, 0.05, -0.7, 1, 0.3], [0.3, 0.92, 0.05, 0.7, 1, 0.3], [-0.1, 0.9, -0.3, -0.3, 0.8, -0.8],
      [0.3, 0.9, -0.28, 0.8, 0.7, -0.6], [-0.45, 0.8, -0.25, -1, 0.5, -0.4], [0.45, 0.8, -0.3, 1, 0.5, -0.5], [0.1, 0.95, 0.3, 0.2, 0.7, 1],
      [-0.5, 0.6, 0.0, -1, 0.1, 0.1], [0.5, 0.6, 0.0, 1, 0.1, 0.1], [-0.2, 0.7, -0.45, -0.4, 0.2, -1], [0.25, 0.7, -0.45, 0.4, 0.2, -1],
    ];
    sps.forEach(([x, y, z, dx, dy, dz], i) => spike(hair, i % 2 ? h1 : h2, x * hw * 1.6, y, z * 1.4, V(dx, dy, dz), 0.62 + (i % 3) * 0.14, 0.2));
    for (const bx of [-0.34, 0, 0.34]) spike(hair, h1, bx, 0.98, 0.4, V(bx * 0.6, -0.75, 0.5), 0.42, 0.15);
    cyl(body, tw * 0.64, tw * 0.74, 0.2, mat('#2a3366'), 0, 1.2, 0, 1, 0.9);
  } else if (kind === 'gon') {
    const h1 = hmat('#17141c');
    const tip = hmat('#2f9f48');
    hairCap(hair, h1, 1.2, 1.08, hy + 0.05);
    const dirs: number[][] = [
      [0, 0.0, 0.1, 0.0, 1.05], [-0.3, 0.1, -0.35, 0.1, 1.0], [0.3, 0.1, 0.35, 0.1, 1.0], [-0.5, -0.1, -0.8, 0.1, 0.85],
      [0.5, -0.1, 0.8, 0.1, 0.85], [-0.3, -0.4, -0.45, -0.6, 0.8], [0.3, -0.4, 0.45, -0.6, 0.8], [0, 0.4, 0.1, 0.5, 0.8],
    ];
    dirs.forEach(([x, z, dx, dz, len]) => {
      const d = V(dx, 1.5, dz);
      spike(hair, h1, x * 0.8, 1.0, z, d, len * 0.95, 0.22);
      const dn = d.clone().normalize();
      spike(hair, tip, x * 0.8 + dn.x * len * 0.62, 1.0 + dn.y * len * 0.62, z + dn.z * len * 0.62, d, len * 0.36, 0.1);
    });
    for (const bx of [-0.34, -0.1, 0.16, 0.38]) spike(hair, h1, bx, 0.99, 0.34, V(bx * 0.4, -0.9, 0.45), 0.4, 0.12);
    const red = mat('#d6322d');
    box(body, 0.08, 1.0, 0.03, mat('#d9e8d0'), 0, 0.62, 0.31, 0);
    box(body, 1.0 * W, 0.08, 0.03, red, 0, 0.15, 0.3, 0);
    cyl(body, tw * 0.9, tw * 0.9, 0.1, mat('#1b1b1b'), 0, 0.05, 0, 1, 0.62);
    cyl(body, tw * 0.62, tw * 0.74, 0.22, collarM, 0, 1.2, 0.0, 1, 0.9);
    hairAdult = new THREE.Group();
    hairAdult.visible = false;
    head.add(hairAdult);
    const ah = hmat('#101810');
    const at = hmat('#1f8a3a');
    hairCap(hairAdult, ah, 1.35, 1.1, hy + 0.04);
    box(hairAdult, 1.0, 2.4, 0.3, ah, 0, -0.6, -0.5);
    box(hairAdult, 0.5, 1.8, 0.3, ah, -0.45, -0.3, -0.45);
    box(hairAdult, 0.5, 1.8, 0.3, ah, 0.45, -0.3, -0.45);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const d = V(Math.cos(a) * 0.9, 1.5, Math.sin(a) * 0.9 - 0.15);
      spike(hairAdult, ah, Math.cos(a) * 0.35, 1.0, Math.sin(a) * 0.35, d, 1.5 + (i % 3) * 0.3, 0.3);
      const dn = d.clone().normalize();
      spike(hairAdult, at, Math.cos(a) * 0.35 + dn.x * 1.0, 1.0 + dn.y * 1.0, Math.sin(a) * 0.35 + dn.z * 1.0, d, 0.7, 0.16);
    }
    spike(hairAdult, at, 0, -1.7, -0.6, V(0, -1, -0.2), 0.8, 0.5);
  } else if (kind === 'leorio') {
    const h1 = hmat('#16141c');
    hairCap(hair, h1, 1.25, 1.07, hy + 0.04);
    for (let i = 0; i < 9; i++) {
      const x = -0.4 + (i % 5) * 0.2;
      const z = i < 5 ? 0.12 : -0.22;
      spike(hair, h1, x, 0.98, z, V(x * 0.8, 1.3, i < 5 ? 0.35 : -0.25), 0.6 + (i % 3) * 0.12, 0.17);
    }
    box(body, 0.34 * W, 0.95, 0.02, mat('#f4f4f8'), 0, 0.65, 0.3, 0);
    box(body, 0.12, 0.85, 0.035, mat('#1f7a6a'), 0, 0.6, 0.315, 0.012);
    box(body, 0.1, 0.1, 0.04, mat('#1f7a6a'), 0, 1.05, 0.315, 0.01);
    for (const sx of [-1, 1]) {
      const l = box(body, 0.2, 0.95, 0.03, mat('#161c3a'), sx * 0.24 * W, 0.6, 0.31, 0.01);
      l.rotation.z = sx * 0.2;
    }
    skirt(body, tw * 1.02, tw * 1.1, 0.6, torsoM, -0.28, 0, Math.PI * 2, 0.64);
  } else if (kind === 'kurapika') {
    const h1 = hmat('#f2dc5d');
    const h2 = hmat('#e0c540');
    hairCap(hair, h1, 1.5, 1.09, hy + 0.02);
    ball(hair, 1, h2, -hw * 0.98, hy - 0.1, 0, 0.14, 0.42, 0.42, 0.02);
    ball(hair, 1, h2, hw * 0.98, hy - 0.1, 0, 0.14, 0.42, 0.42, 0.02);
    for (const bx of [-0.36, -0.12, 0.12, 0.36]) spike(hair, h1, bx, 0.98, 0.38, V(bx * 0.5, -1.1, 0.35), 0.5, 0.15);
    ball(head, 0.07, mat('#e8584a'), -hw * 1.0, hy - 0.2, 0.02, 1, 1.6, 1, 0.01);
    ball(head, 0.07, mat('#e8584a'), hw * 1.0, hy - 0.2, 0.02, 1, 1.6, 1, 0.01);
    const blue = mat('#2f4fb8');
    const redT = mat('#e8584a');
    box(body, 0.9 * W, 1.7, 0.05, blue, 0, 0.1, 0.34, 0.015);
    box(body, 0.9 * W, 1.8, 0.05, blue, 0, 0.05, -0.34, 0.015);
    box(body, 0.09, 1.7, 0.055, redT, -0.4 * W, 0.1, 0.345, 0);
    box(body, 0.09, 1.7, 0.055, redT, 0.4 * W, 0.1, 0.345, 0);
    box(body, 0.9 * W, 0.08, 0.055, redT, 0, -0.74, 0.345, 0);
    box(body, 0.42, 0.36, 0.06, redT, 0, -0.3, 0.355, 0);
    box(body, 0.16, 0.18, 0.065, mat('#f6f6fa'), 0, -0.3, 0.362, 0);
    box(body, 0.18, 0.18, 0.06, redT, 0, 0.3, -0.36, 0);
    for (const sx of [-1, 1]) box(body, 0.3, 0.1, 0.62, blue, sx * 0.34 * W, 1.18, 0, 0.012);
    box(body, 0.36, 0.2, 0.1, redT, 0, 1.1, 0.34, 0);
  } else if (kind === 'hisoka') {
    const h1 = hmat('#e8334a');
    const h2 = hmat('#5b2a86');
    hairCap(hair, h1, 1.2, 1.07, hy + 0.05);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = V(Math.cos(a) * 0.7, 1.5, Math.sin(a) * 0.7 - 0.5);
      spike(hair, i % 3 === 0 ? h2 : h1, Math.cos(a) * 0.38, 1.0, Math.sin(a) * 0.38, d, 0.95 + (i % 4) * 0.2, 0.22);
    }
    spike(hair, h1, 0, 0.9, -0.5, V(0, 0.2, -1), 1.1, 0.3);
    const pink = mat('#e8508a');
    const dp = mat('#3b2c5a');
    const rd = mat('#c8223a');
    ball(body, 0.1, rd, -0.24, 0.9, 0.3, 1, 1, 0.2, 0.01);
    ball(body, 0.1, dp, 0.24, 0.9, 0.3, 1, 1, 0.2, 0.01);
    ball(body, 0.1, dp, -0.24, 0.5, 0.3, 1, 1, 0.2, 0.01);
    ball(body, 0.1, rd, 0.24, 0.5, 0.3, 1, 1, 0.2, 0.01);
    cyl(body, tw * 1.0, tw * 0.9, 0.34, pink, 0.0, 0.17, 0, 1, 0.64);
    skirt(body, tw * 1.08, tw * 1.28, 0.7, mat('#f3d84a'), -0.42, Math.PI * 0.2, Math.PI * 1.6, 0.66);
    cyl(body, tw * 0.62, tw * 0.74, 0.18, mat('#e86a96'), 0, 1.2, 0, 1, 0.9);
  } else if (kind === 'morel') {
    const h1 = hmat('#cfcfd6');
    const h2 = hmat('#aeaeb8');
    hairCap(hair, h1, 1.45, 1.08, hy + 0.04);
    box(hair, 1.0, 1.7, 0.24, h1, 0, 0.1, -0.5);
    ball(hair, 1, h2, -hw * 1.02, hy - 0.1, -0.05, 0.16, 0.7, 0.45, 0.02);
    ball(hair, 1, h2, hw * 1.02, hy - 0.1, -0.05, 0.16, 0.7, 0.45, 0.02);
    ball(head, 0.2, skin, 0, hy - 0.14, hw * 0.98, 1, 1.25, 1.2, 0.02);
    cap(head, 0.1, 0.5, hmat('#b8b8c0'), 0, hy - 0.34, hw * 0.9, 1, 0.6).rotation.z = Math.PI / 2;
    box(body, 0.14, 1.0, 0.04, mat('#8b2c2f'), 0, 0.6, 0.31, 0);
    ball(body, 0.1, mat('#8b2c2f'), 0, 1.08, 0.31, 1.3, 1, 0.5, 0);
    box(body, 0.4, 0.4, 0.03, mat('#6c6772'), -0.25, 0.5, 0.31, 0);
    skirt(body, tw * 1.02, tw * 1.12, 0.5, torsoM, -0.28, 0, Math.PI * 2, 0.64);
    const pipe = new THREE.Group();
    cyl(pipe, 0.045, 0.05, 0.7, mat('#2a1a10'), 0, 0, 0.3, 1, 1, 8).rotation.x = Math.PI / 2;
    cyl(pipe, 0.14, 0.11, 0.3, mat('#3a2412'), 0, 0.14, 0.68);
    props.pipe = pipe;
    pipe.position.set(0.22, hy - 0.36, hw * 0.9);
    head.add(pipe);
  } else if (kind === 'chrollo') {
    const h1 = hmat('#0d0c14');
    hairCap(hair, h1, 1.45, 1.07, hy + 0.04);
    box(hair, 0.5, 0.8, 0.2, h1, 0, 0.35, -0.5);
    for (const sx of [-1, 1]) {
      cyl(head, 0.03, 0.03, 0.2, gold, sx * hw * 0.98, hy - 0.2, 0.02, 1, 1, 6);
      ball(head, 0.06, mat('#2fd1b8'), sx * hw * 0.98, hy - 0.34, 0.02, 1, 1.6, 1, 0.01);
    }
    const fur = mat('#f1eef5');
    const coat = mat('#1c1224');
    const lining = mat('#6b1535');
    box(body, 0.3 * W, 1.05, 0.03, skin, 0, 0.6, 0.3, 0);
    for (const sx of [-1, 1]) {
      const p = box(body, 0.34 * W, 1.2, 0.06, coat, sx * 0.3 * W, 0.62, 0.315, 0.012);
      p.rotation.z = -sx * 0.06;
    }
    skirt(body, tw * 1.04, tw * 1.28, 1.6, coat, -0.6, Math.PI * 0.62, Math.PI * 1.76, 0.78);
    skirt(body, tw * 0.9, tw * 1.1, 1.4, lining, -0.55, Math.PI * 0.7, Math.PI * 1.6, 0.74);
    box(body, 0.1, 0.9, 0.04, gold, 0, 0.4, -0.46, 0);
    box(body, 0.5, 0.1, 0.04, gold, 0, 0.62, -0.46, 0);
    for (const by of [0.9, 0.5, 0.1]) ball(body, 0.05, gold, 0.36 * W, by, 0.36, 1, 1, 0.5, 0);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      spike(body, fur, Math.cos(a) * 0.5 * W, 1.12, Math.sin(a) * 0.36, V(Math.cos(a) * 0.9, 1.0, Math.sin(a) * 0.9), 0.5, 0.17);
    }
    cyl(body, tw * 1.1, tw * 1.18, 0.26, fur, 0, 1.18, 0, 1, 0.78);
  } else if (kind === 'netero') {
    const white = hmat('#f4f4f6');
    ball(hair, 0.16, white, 0, hy + hh * 0.98, -0.12, 1, 0.9, 1, 0.02);
    spike(hair, white, 0, hy + hh * 1.0, -0.14, V(0.05, 1, -0.5), 0.75, 0.13);
    spike(hair, white, 0, hy + hh * 1.0, -0.14, V(0.28, 1, -0.2), 0.62, 0.1);
    box(hair, 0.16, 0.12, 0.2, mat('#2f7fc0'), 0, hy + hh * 0.98, -0.12, 0.01);
    ball(hair, 1, white, -hw * 0.98, hy - 0.05, -0.1, 0.1, 0.34, 0.3, 0.015);
    ball(hair, 1, white, hw * 0.98, hy - 0.05, -0.1, 0.1, 0.34, 0.3, 0.015);
    for (const sx of [-1, 1]) {
      spike(head, white, sx * 0.14, hy + 0.1, hw * 0.92, V(sx * 1, 0.55, 0.05), 0.55, 0.06);
      spike(head, white, sx * 0.04, hy - 0.3, hw * 0.96, V(sx * 1, -0.3, 0.2), 0.42, 0.075);
      cyl(head, 0.03, 0.03, 0.18, mat('#202020'), sx * hw * 0.98, hy - 0.2, 0.02, 1, 1, 6);
    }
    ball(head, 0.16, white, 0, hy - 0.5, hw * 0.78, 1, 1.4, 0.8, 0.02);
    spike(head, white, 0, hy - 0.52, hw * 0.78, V(0, -1, 0.2), 0.42, 0.1);
    const blue = mat('#2f7fc0');
    const lap = box(body, 0.2, 1.2, 0.04, blue, 0.12 * W, 0.7, 0.32, 0.01);
    lap.rotation.z = 0.28;
    box(body, 0.7, 0.3, 0.04, mat('#e9eef5'), 0, 0.08, 0.32, 0.01);
    for (const [x, y, r] of [[-0.05, 0.28, 0.7], [0.05, 0.28, -0.7], [-0.05, 0.14, 0.7], [0.05, 0.14, -0.7]]) {
      const l = box(body, 0.012, 0.13, 0.02, mat('#1a1a22'), x, y, 0.34, 0);
      l.rotation.z = r;
    }
    cyl(body, tw * 1.05, tw * 1.1, 0.5, torsoM, -0.1, -0.15, 0, 1, 0.66);
  } else if (kind === 'kite') {
    const h1 = hmat('#dfe3ec');
    const h2 = hmat('#c4c9d6');
    hairCap(hair, h1, 1.5, 1.07, hy + 0.03);
    box(hair, 1.0, 3.0, 0.2, h1, 0, -0.9, -0.42);
    box(hair, 0.9, 2.6, 0.18, h2, 0, -0.8, -0.58);
    for (const sx of [-1, 1]) {
      box(hair, 0.16, 2.2, 0.5, h2, sx * hw * 1.0, -0.15, 0.0);
      box(hair, 0.1, 1.8, 0.2, h1, sx * 0.3, 0.0, hw * 0.88);
    }
    const capM = mat('#3a78c0');
    const crown = ball(hair, 1, capM, 0, hy + hh * 0.72, 0.02, hw * 1.2, 0.34, hw * 1.12, 0.025);
    crown.rotation.x = -0.05;
    cyl(hair, hw * 1.1, hw * 1.12, 0.1, capM, 0, hy + hh * 0.5, 0.02, 1, 1.0);
    const brim = box(hair, 0.7, 0.04, 0.46, capM, 0, hy + hh * 0.52, hw * 0.98, 0.012);
    brim.rotation.x = 0.18;
    cyl(body, tw * 0.62, tw * 0.74, 0.34, mat('#f4f5f8'), 0, 1.2, 0, 1, 0.9);
    cyl(body, tw * 0.9, tw * 0.9, 0.36, mat('#9fd0ee'), 0, 0.06, 0, 1, 0.64);
    for (let i = 0; i < 3; i++) cyl(body, tw * 0.92, tw * 0.92, 0.02, mat('#7ab4d8'), 0, -0.05 + i * 0.12, 0, 1, 0.65);
  } else if (kind === 'knov') {
    const h1 = hmat('#14121a');
    hairCap(hair, h1, 1.3, 1.07, hy + 0.04);
    for (let i = 0; i < 6; i++) spike(hair, h1, -0.3 + i * 0.12, 0.98, 0.12, V(0.15 - i * 0.04, 0.5, 0.9), 0.38, 0.12);
    box(body, 0.3 * W, 0.95, 0.02, mat('#f4f4f8'), 0, 0.65, 0.3, 0);
    box(body, 0.1, 0.8, 0.035, mat('#8ab6e0'), 0, 0.6, 0.315, 0.01);
    for (const sx of [-1, 1]) {
      const l = box(body, 0.18, 0.95, 0.03, mat('#1c1c26'), sx * 0.22 * W, 0.62, 0.31, 0.01);
      l.rotation.z = sx * 0.22;
      ball(body, 0.03, mat('#cccccc'), sx * 0.2, 0.2, 0.33, 1, 1, 0.5, 0);
    }
    skirt(body, tw * 1.02, tw * 1.06, 0.55, torsoM, -0.28, 0, Math.PI * 2, 0.64);
  } else if (kind === 'knuckle') {
    const h1 = hmat('#0f0e12');
    hairCap(hair, h1, 1.3, 1.07, hy + 0.0);
    const pomp = box(hair, 0.86, 0.52, 0.9, h1, 0, hy + hh * 0.9, 0.18);
    pomp.rotation.x = -0.25;
    box(hair, 0.96, 0.18, 0.7, h1, 0, hy + hh * 0.7, 0.42);
    for (const sx of [-1, 1]) box(hair, 0.14, 0.5, 0.5, h1, sx * hw * 0.98, hy + 0.05, 0.12);
    const wc = mat('#f6f6f8');
    cyl(body, tw * 0.62, tw * 0.7, 0.3, wc, 0, 1.22, 0, 1, 0.92);
    box(body, 0.06, 1.2, 0.03, mat('#d6d6dc'), 0, 0.62, 0.31, 0);
    for (let i = 0; i < 5; i++) cap(body, 0.04, 0.12, gold, 0, 0.2 + i * 0.26, 0.33, 1.2, 0.5).rotation.z = Math.PI / 2;
    cap(body, 0.04, 0.12, gold, 0, 1.28, 0.38, 1.2, 0.5).rotation.z = Math.PI / 2;
    skirt(body, tw * 1.02, tw * 1.16, 1.2, wc, -0.42, 0, Math.PI * 2, 0.7);
  } else if (kind === 'pitou') {
    const h1 = hmat('#f1f1fa');
    const h2 = hmat('#d9d9ea');
    hairCap(hair, h1, 1.55, 1.1, hy + 0.03);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ball(hair, 0.2, i % 2 ? h1 : h2, Math.cos(a) * hw * 1.0, hy - 0.12 + (i % 3) * 0.05, Math.sin(a) * hw * 0.94 - 0.04, 1, 1.2, 1, 0.02);
    }
    for (const bx of [-0.3, -0.08, 0.14, 0.34]) spike(hair, h1, bx, 0.98, 0.36, V(bx * 0.6, -0.8, 0.5), 0.4, 0.15);
    for (const sx of [-1, 1]) {
      const e = spike(hair, h1, sx * 0.3, 1.0, -0.04, V(sx * 0.5, 1, -0.1), 0.52, 0.19);
      e.scale.z = 0.5;
      const inn = spike(hair, mat('#f0a0b8'), sx * 0.3, 1.0, 0.02, V(sx * 0.5, 1, -0.05), 0.36, 0.1);
      inn.scale.z = 0.4;
    }
    const tail = new THREE.Group();
    tail.position.set(0, -0.1, -0.28);
    body.add(tail);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      ball(tail, 0.09 - t * 0.02, h1, Math.sin(t * 2.6) * 0.5, -0.1 + t * 0.9 - Math.pow(t, 2) * 0.4, -0.18 - Math.cos(t * 2.4) * 0.35, 1, 1, 1, 0.015);
    }
    props.tail = tail;
    for (const sx of [-1, 1]) for (const by of [0.95, 0.65, 0.35]) ball(body, 0.05, gold, sx * 0.17, by, 0.31, 1, 1, 0.5, 0.01);
    box(body, 0.04, 1.1, 0.03, mat('#10183a'), 0, 0.6, 0.31, 0);
    for (const sx of [-1, 1]) {
      const c = box(body, 0.2, 0.18, 0.06, mat('#1a2552'), sx * 0.2, 1.22, 0.28, 0.01);
      c.rotation.z = sx * -0.5;
    }
    cyl(body, tw * 0.64, tw * 0.9, 0.12, mat('#10183a'), 0, 1.22, 0, 1, 0.86);
    skirt(body, tw * 0.95, tw * 1.25, 0.4, torsoM, -0.2, 0, Math.PI * 2, 0.64);
  } else if (kind === 'bandit') {
    const h1 = hmat('#1b1612');
    hairCap(hair, h1, 1.2, 1.06, hy + 0.04);
    cyl(hair, hw * 1.08, hw * 1.08, 0.2, mat('#c0262b'), 0, hy + hh * 0.5, 0, 1, 0.96);
    box(hair, 0.3, 0.3, 0.2, mat('#c0262b'), 0.2, hy + 0.2, -0.56);
    cyl(body, tw * 0.9, tw * 0.9, 0.24, mat('#241a14'), 0, 0.12, 0, 1, 0.62);
    box(body, 0.14, 1.2, 0.6, mat('#241a14'), 0.33, 0.6, 0, 0.01);
  }

  // ---- arms ----
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * (0.5 * W + 0.17), 1.08, 0);
    body.add(arm);
    const aw = 0.17 * T * (W > 1 ? 1.08 : 1);
    const puffy = kind === 'hisoka';
    ball(arm, aw * 1.25, upperM, 0, 0.0, 0, 1, 1, 1, 0.02);
    if (puffy) ball(arm, 0.3, upperM, 0, -0.26, 0, 1, 1.2, 1, 0.025);
    else cap(arm, aw, 0.32, upperM, 0, -0.29, 0);
    const fore = new THREE.Group();
    fore.position.set(0, -0.58, 0);
    arm.add(fore);
    const fw = 0.14 * T * (W > 1 ? 1.1 : 1);
    ball(fore, fw * 1.05, kind === 'pitou' ? skin : upperM, 0, 0, 0, 1, 1, 1, 0.015);
    cap(fore, fw, 0.32, foreM, 0, -0.26, 0);
    ball(fore, 0.15 * Math.max(0.85, T), skin, 0, -0.62, 0.01, 1, 1.05, 0.9, 0.02);
    if (kind === 'gon') {
      cyl(fore, 0.19, 0.19, 0.16, mat('#1d5a2a'), 0, -0.14, 0);
      cyl(fore, 0.2, 0.2, 0.05, mat('#d6322d'), 0, -0.04, 0);
    }
    if (kind === 'killua') cap(arm, 0.2, 0.34, mat('#f1eff7'), 0, -0.26, 0);
    if (kind === 'hisoka') cyl(fore, 0.17, 0.17, 0.12, mat('#e86a96'), 0, -0.44, 0);
    if (kind === 'chrollo') {
      cyl(fore, 0.22, 0.2, 0.3, mat('#f1eef5'), 0, -0.44, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        spike(fore, mat('#f1eef5'), Math.cos(a) * 0.2, -0.56, Math.sin(a) * 0.2, V(Math.cos(a), -0.6, Math.sin(a)), 0.18, 0.07);
      }
    }
    if (kind === 'leorio') cyl(fore, 0.15, 0.15, 0.07, mat('#f4f4f8'), 0, -0.5, 0);
    if (kind === 'kurapika') cyl(fore, 0.155, 0.155, 0.08, mat('#e8584a'), 0, -0.48, 0);
    if (kind === 'bandit') cyl(fore, 0.18, 0.18, 0.14, mat('#241a14'), 0, -0.42, 0);
    if (kind === 'kite') {
      cyl(fore, 0.14, 0.14, 0.4, mat('#f4f5f8'), 0, -0.34, 0);
      cyl(arm, aw * 1.1, aw * 1.1, 0.04, mat('#d4d8e4'), 0, -0.4, 0);
    }
    if (kind === 'knov') cyl(fore, 0.145, 0.145, 0.06, mat('#f4f4f8'), 0, -0.52, 0);
    if (kind === 'netero') {
      const wide = new THREE.Group();
      wide.position.set(0, -0.05, 0);
      fore.add(wide);
      cyl(wide, 0.2, 0.46, 0.85, mat('#f1f6fb', { side: THREE.DoubleSide }), 0, -0.36, 0, 1, 1, 20);
      cyl(wide, 0.37, 0.43, 0.1, mat('#2f7fc0'), 0, -0.52, 0);
      cyl(wide, 0.41, 0.45, 0.12, mat('#2f7fc0'), 0, -0.7, 0);
    }
    if (kind === 'knuckle') {
      cyl(fore, 0.17, 0.18, 0.1, mat('#f6f6f8'), 0, -0.48, 0);
      for (const dy of [-0.4, -0.5]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 6, 12), gold);
        r.position.set(side * 0.17, dy, 0);
        r.rotation.y = Math.PI / 2;
        fore.add(r);
      }
    }
    if (kind === 'pitou') {
      cyl(fore, 0.17, 0.27, 0.34, mat('#1a2552'), 0, -0.42, 0);
      cyl(fore, 0.27, 0.27, 0.05, mat('#3a4a8a'), 0, -0.58, 0);
      cap(fore, 0.12, 0.3, skin, 0, -0.3, 0);
    }
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
    const club = cyl(aR.fore, 0.09, 0.12, 1.6, mat('#5b3a1f'), 0, -0.6, 0.55, 1, 1, 8);
    club.rotation.x = Math.PI / 2 - 0.3;
    ball(aR.fore, 0.24, mat('#3f2a16'), 0, -0.35, 1.3, 1, 1, 1);
  }
  if (kind === 'leorio') {
    const cs = new THREE.Group();
    box(cs, 0.2, 0.8, 1.05, mat('#5a3b22'), 0, 0, 0);
    box(cs, 0.24, 0.1, 0.3, gold, 0, 0.2, 0);
    box(cs, 0.26, 0.06, 0.5, mat('#3a2514'), 0, 0.42, 0, 0);
    cs.position.set(0, -0.85, 0.05);
    aL.fore.add(cs);
    props.case = cs;
  }

  // ---- legs ----
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.24 * (W > 1 ? 1.15 : W < 0.9 ? 0.85 : 1), 1.1, 0);
    root.add(leg);
    const lw = 0.2 * T * (W > 1 ? 1.12 : 1);
    const baggy = kind === 'netero' || kind === 'knuckle';
    if (baggy) cap(leg, lw * 1.5, 0.3, thighM, 0, -0.32, 0, 1, 1);
    else if (kind === 'pitou') {
      const sh = mat('#ffffff', { map: stripeTexture('#c46a3a', '#8a3f22', 10) });
      cap(leg, lw * 1.15, 0.4, sh, 0, -0.3, 0);
    } else cap(leg, lw, 0.38, thighM, 0, -0.3, 0);
    const shin = new THREE.Group();
    shin.position.set(0, -0.58, 0);
    leg.add(shin);
    ball(shin, lw * 0.82, kind === 'pitou' ? mat('#f7ebe6') : baggy ? thighM : shinM, 0, 0, 0, 1, 1, 1, 0.015);
    const sw = lw * 0.8;
    if (baggy) {
      cap(shin, sw * 1.55, 0.18, thighM, 0, -0.14, 0);
      cap(shin, sw * 0.8, 0.2, mat('#e8e2d4'), 0, -0.34, 0);
    } else cap(shin, sw, 0.3, shinM, 0, -0.27, 0);
    if (kind === 'netero') {
      ball(shin, 0.17, mat('#f4f4f6'), 0, -0.46, 0.08, 1, 0.6, 1.6, 0.015);
      box(shin, 0.34, 0.06, 0.7, mat('#7a4a28'), 0, -0.56, 0.06, 0.012);
      box(shin, 0.34, 0.14, 0.12, mat('#7a4a28'), 0, -0.62, 0.28, 0.01);
      box(shin, 0.34, 0.14, 0.12, mat('#7a4a28'), 0, -0.62, -0.12, 0.01);
    } else if (kind === 'pitou') {
      ball(shin, 0.13, mat('#ffffff'), 0, 0.02, 0.02, 1, 1, 1, 0.012);
      cyl(shin, 0.13, 0.13, 0.1, mat('#d9a070'), 0, -0.12, 0);
      ball(shin, 0.18, bootM, 0, -0.45, 0.1, 1, 0.55, 1.7, 0.02);
    } else {
      const bw = kind === 'knuckle' ? 0.22 : 0.2;
      ball(shin, bw, bootM, 0, -0.47, 0.09, 1, 0.6, 1.75, 0.02);
    }
    if (kind === 'killua') cyl(shin, 0.19, 0.19, 0.16, mat('#cdb99a'), 0, -0.1, 0);
    if (kind === 'gon') {
      cyl(shin, 0.2, 0.2, 0.12, mat('#d8e4d0'), 0, -0.08, 0);
      cyl(shin, 0.21, 0.21, 0.18, bootM, 0, -0.36, 0);
    }
    if (kind === 'hisoka') {
      for (let i = 0; i < 3; i++) cyl(shin, 0.19, 0.19, 0.07, mat(i % 2 ? '#e86a96' : '#f3d0dc'), 0, -0.16 - i * 0.1, 0);
      const toe = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 8), bootM);
      toe.rotation.x = Math.PI / 2;
      toe.position.set(0, -0.47, 0.52);
      shin.add(toe);
    }
    if (kind === 'chrollo') {
      cyl(shin, 0.2, 0.2, 0.06, mat('#9aa0b0'), 0, -0.12, 0);
      cyl(shin, 0.2, 0.2, 0.06, mat('#9aa0b0'), 0, -0.3, 0);
    }
    if (kind === 'kurapika') cyl(shin, 0.19, 0.19, 0.08, mat('#f1f1f6'), 0, -0.06, 0);
    return { leg, shin };
  };
  const lL = makeLeg(-1);
  const lR = makeLeg(1);
  const foot = new THREE.Object3D();
  foot.position.set(0, -0.5, 0.25);
  lR.shin.add(foot);

  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
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
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    g.add(mesh);
  };
  add(new THREE.CapsuleGeometry(0.5, 0.8, 4, 10), 0, 2.0, 0, 1, 1, 0.62);
  add(new THREE.SphereGeometry(0.5, 12, 10), 0, 3.05, 0, 1, 1.05, 0.96);
  add(new THREE.CapsuleGeometry(0.17, 0.9, 4, 8), -0.7, 1.95, 0);
  add(new THREE.CapsuleGeometry(0.17, 0.9, 4, 8), 0.7, 1.95, 0);
  add(new THREE.CapsuleGeometry(0.2, 0.8, 4, 8), -0.25, 0.65, 0);
  add(new THREE.CapsuleGeometry(0.2, 0.8, 4, 8), 0.25, 0.65, 0);
  return g;
}
