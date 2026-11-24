import * as THREE from 'three';
import { buildSilhouette } from './models';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const tmpC = new THREE.Color();

class Particles {
  mesh: THREE.Points;
  n = 0;
  cap: number;
  pos: Float32Array;
  col: Float32Array;
  siz: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  s0: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  grow: Float32Array;
  mat: THREE.ShaderMaterial;
  geo: THREE.BufferGeometry;

  constructor(cap: number, additive: boolean) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.siz = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.geo = new THREE.BufferGeometry();
    const pa = new THREE.BufferAttribute(this.pos, 3);
    const ca = new THREE.BufferAttribute(this.col, 4);
    const sa = new THREE.BufferAttribute(this.siz, 1);
    pa.setUsage(THREE.DynamicDrawUsage);
    ca.setUsage(THREE.DynamicDrawUsage);
    sa.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', pa);
    this.geo.setAttribute('color', ca);
    this.geo.setAttribute('size', sa);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vColor; uniform float uScale;
        void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(size*uScale/max(0.1,-mv.z),400.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vColor;
        void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.05,d); gl_FragColor=vec4(vColor.rgb, vColor.a*a);
        #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Points(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 5 : 4;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, a: number, size: number, life: number, grav = 0, drag = 0, grow = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    tmpC.setHex(color);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = tmpC.r; this.col[i * 4 + 1] = tmpC.g; this.col[i * 4 + 2] = tmpC.b; this.col[i * 4 + 3] = a;
    this.siz[i] = size; this.s0[i] = size;
    this.life[i] = life; this.max[i] = life;
    this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }

  private copy(from: number, to: number) {
    for (let k = 0; k < 3; k++) { this.pos[to * 3 + k] = this.pos[from * 3 + k]; this.vel[to * 3 + k] = this.vel[from * 3 + k]; }
    for (let k = 0; k < 4; k++) this.col[to * 4 + k] = this.col[from * 4 + k];
    this.siz[to] = this.siz[from]; this.s0[to] = this.s0[from]; this.life[to] = this.life[from]; this.max[to] = this.max[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.grow[to] = this.grow[from];
  }

  update(dt: number, alphaBase: number[]) {
    for (let i = 0; i < this.n; ) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.n--;
        if (i < this.n) this.copy(this.n, i);
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      const k = this.life[i] / this.max[i];
      this.siz[i] = Math.max(0.01, this.s0[i] * (k * (1 - this.grow[i]) + (1 - k) * this.grow[i] * 1.8 + (this.grow[i] > 0 ? 0 : 0)));
      this.col[i * 4 + 3] = (alphaBase[0] ?? 1) * Math.min(1, k * 2.2);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Fx {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  update: (p: number, dt: number) => void;
  dispose?: () => void;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
const ringThinGeo = new THREE.RingGeometry(0.94, 1, 56);
const circleGeo = new THREE.CircleGeometry(1, 40);
const cylOpenGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2);
const planeGeo = new THREE.PlaneGeometry(1, 1);
const domeGeo = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const torusGeo = new THREE.TorusGeometry(1, 0.12, 6, 32);

function crescentGeo() {
  const A = 1.15;
  const N = 22;
  const s = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    const a = -A + (2 * A * i) / N;
    const x = Math.cos(a);
    const y = Math.sin(a);
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const cx = -0.4;
  const r2 = Math.hypot(Math.cos(A) - cx, Math.sin(A));
  const b0 = Math.atan2(Math.sin(A), Math.cos(A) - cx);
  for (let i = 0; i <= N; i++) {
    const b = b0 - (2 * b0 * i) / N;
    s.lineTo(cx + r2 * Math.cos(b), r2 * Math.sin(b));
  }
  return new THREE.ShapeGeometry(s);
}
const crescent = crescentGeo();

function starGeo() {
  const s = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 0.22 : 1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s);
}
const star = starGeo();

export class FX {
  group = new THREE.Group();
  glow = new Particles(3200, true);
  soft = new Particles(900, false);
  private fxs: Fx[] = [];
  camera: THREE.Camera | null = null;

  constructor() {
    this.group.add(this.glow.mesh, this.soft.mesh);
  }

  setScale(h: number, fov: number) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.glow.mat.uniforms.uScale.value = s;
    this.soft.mat.uniforms.uScale.value = s;
  }

  private add(obj: THREE.Object3D, dur: number, update: (p: number, dt: number) => void, dispose?: () => void) {
    this.group.add(obj);
    this.fxs.push({ obj, t: 0, dur, update, dispose });
  }

  private mat(color: number, opacity = 0.9, side: THREE.Side = THREE.DoubleSide) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  update(dt: number) {
    const keep: Fx[] = [];
    for (const fx of this.fxs) {
      fx.t += dt;
      const p = Math.min(1, fx.t / fx.dur);
      fx.update(p, dt);
      if (fx.t >= fx.dur) {
        this.group.remove(fx.obj);
        fx.dispose?.();
      } else keep.push(fx);
    }
    this.fxs = keep;
    this.glow.update(dt, [1]);
    this.soft.update(dt, [0.55]);
  }

  clear() {
    for (const fx of this.fxs) {
      this.group.remove(fx.obj);
      fx.dispose?.();
    }
    this.fxs = [];
    this.glow.n = 0;
    this.soft.n = 0;
  }

  // ------------------------------------------------------------ particles
  burst(pos: THREE.Vector3, color: number, count: number, speed: number, life: number, size = 0.35) {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1.2), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.35, 1));
      this.glow.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z, color, 1, size * rand(0.6, 1.3), life * rand(0.6, 1.2), 6, 1.5);
    }
  }
  sparks(pos: THREE.Vector3, color: number, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1.1));
      this.glow.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z, i % 3 === 0 ? 0xffffff : color, 1, rand(0.1, 0.22), rand(0.25, 0.6), 14, 0.8);
    }
  }
  dust(pos: THREE.Vector3, count: number, spread: number, color = 0xb8a98a, size = 1.2) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spread * rand(0.3, 1);
      this.soft.emit(pos.x + Math.cos(a) * 0.5, pos.y + 0.2, pos.z + Math.sin(a) * 0.5, Math.cos(a) * s, rand(0.5, 2.5), Math.sin(a) * s, color, 1, size * rand(0.6, 1.3), rand(0.6, 1.2), -0.4, 1.8, 0.6);
    }
  }
  smoke(pos: THREE.Vector3, count: number, spread: number, color = 0x8a8494, size = 2.2, life = 1.8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spread * Math.random();
      this.soft.emit(pos.x + Math.cos(a) * s, pos.y + rand(0, 1.4), pos.z + Math.sin(a) * s, rand(-0.6, 0.6), rand(0.2, 1.1), rand(-0.6, 0.6), color, 1, size * rand(0.7, 1.4), life * rand(0.7, 1.2), -0.3, 0.6, 0.5);
    }
  }
  /** converging charge particles around a point */
  gather(pos: THREE.Vector3, color: number, radius: number, count = 2) {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      const p = pos.clone().addScaledVector(v, radius);
      this.glow.emit(p.x, p.y, p.z, -v.x * radius * 4, -v.y * radius * 4, -v.z * radius * 4, color, 1, rand(0.18, 0.34), 0.25, 0, 0);
    }
  }
  aura(pos: THREE.Vector3, color: number, count: number, h = 3.4, r = 0.9) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = r * rand(0.4, 1);
      this.glow.emit(pos.x + Math.cos(a) * rr, pos.y + rand(0, h * 0.6), pos.z + Math.sin(a) * rr, 0, rand(2, 5), 0, color, 0.9, rand(0.2, 0.45), rand(0.4, 0.8), 0, 0.3, 0);
    }
  }

  // ------------------------------------------------------------ meshes
  flashAt(pos: THREE.Vector3, color: number, size: number, dur = 0.18) {
    const m = this.mat(color, 0.95);
    const mesh = new THREE.Mesh(sphereGeo, m);
    mesh.position.copy(pos);
    this.add(mesh, dur, (p) => {
      const s = size * (0.35 + p * 0.9);
      mesh.scale.setScalar(s);
      m.opacity = 0.95 * (1 - p) * (1 - p);
    }, () => m.dispose());
  }

  hitSpark(pos: THREE.Vector3, color: number, size = 1.2) {
    const m = this.mat(color, 1);
    const m2 = this.mat(0xffffff, 1);
    const g = new THREE.Group();
    const a = new THREE.Mesh(star, m);
    const b = new THREE.Mesh(star, m2);
    b.scale.setScalar(0.55);
    b.position.z = 0.01;
    g.add(a, b);
    g.position.copy(pos);
    const roll = Math.random() * Math.PI;
    this.add(g, 0.2, (p) => {
      if (this.camera) g.quaternion.copy(this.camera.quaternion);
      g.rotateZ(roll);
      const s = size * (0.4 + p * 1.1);
      g.scale.set(s, s * 0.8, s);
      m.opacity = m2.opacity = 1 - p * p;
    }, () => { m.dispose(); m2.dispose(); });
    this.flashAt(pos, color, size * 0.8, 0.14);
  }

  ring(pos: THREE.Vector3, color: number, r0: number, r1: number, dur: number, y = 0.12) {
    const m = this.mat(color, 0.9);
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, y, pos.z);
    this.add(mesh, dur, (p) => {
      const s = r0 + (r1 - r0) * (1 - (1 - p) * (1 - p));
      mesh.scale.set(s, s, s);
      m.opacity = 0.9 * (1 - p);
    }, () => m.dispose());
  }

  /** ring standing perpendicular to a direction (impact shockwaves) */
  vring(pos: THREE.Vector3, dir: THREE.Vector3, color: number, r0: number, r1: number, dur: number) {
    const m = this.mat(color, 0.9);
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(dir));
    this.add(mesh, dur, (p) => {
      const s = r0 + (r1 - r0) * (1 - (1 - p) * (1 - p));
      mesh.scale.set(s, s, s);
      m.opacity = 0.9 * (1 - p);
    }, () => m.dispose());
  }

  shockwave(pos: THREE.Vector3, color: number, r: number, dur = 0.5) {
    this.ring(pos, color, 0.5, r, dur);
    this.ring(pos, 0xffffff, 0.3, r * 0.75, dur * 0.7, 0.16);
    const m = this.mat(color, 0.5);
    const mesh = new THREE.Mesh(torusGeo, m);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(pos.x, 0.3, pos.z);
    this.add(mesh, dur, (p) => {
      const s = 0.5 + (r - 0.5) * (1 - (1 - p) * (1 - p));
      mesh.scale.set(s, s, s * 1.8);
      m.opacity = 0.55 * (1 - p);
    }, () => m.dispose());
    const n = Math.min(40, Math.floor(r * 3));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.glow.emit(pos.x, 0.3, pos.z, Math.cos(a) * r * 1.6, rand(0.5, 3), Math.sin(a) * r * 1.6, color, 1, rand(0.3, 0.6), 0.5, 3, 2.5);
    }
    this.dust(new THREE.Vector3(pos.x, 0, pos.z), Math.min(16, Math.floor(r * 2)), r * 1.3);
  }

  crack(pos: THREE.Vector3, color: number, r: number, dur = 3) {
    const g = new THREE.Group();
    const dark = new THREE.MeshBasicMaterial({ color: 0x1a140e, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const glow = this.mat(color, 0.8);
    const n = 8 + Math.floor(r);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      let x = 0;
      let z = 0;
      let ang = a;
      const len = r * rand(0.55, 1);
      const segs = 3;
      for (let s = 0; s < segs; s++) {
        const l = len / segs;
        ang += rand(-0.4, 0.4);
        const cx = x + Math.cos(ang) * l * 0.5;
        const cz = z + Math.sin(ang) * l * 0.5;
        for (const [m, w, y] of [[dark, 0.28 - s * 0.05, 0.05], [glow, 0.1, 0.07]] as [THREE.Material, number, number][]) {
          const pl = new THREE.Mesh(planeGeo, m);
          pl.rotation.x = -Math.PI / 2;
          pl.rotation.z = -ang;
          pl.scale.set(l * 1.05, w, 1);
          pl.position.set(cx, y, cz);
          g.add(pl);
        }
        x += Math.cos(ang) * l;
        z += Math.sin(ang) * l;
      }
    }
    const disc = new THREE.Mesh(circleGeo, dark);
    disc.rotation.x = -Math.PI / 2;
    disc.scale.setScalar(r * 0.25);
    disc.position.y = 0.045;
    g.add(disc);
    g.position.set(pos.x, 0, pos.z);
    this.add(g, dur, (p) => {
      const k = p < 0.08 ? p / 0.08 : 1;
      g.scale.set(k, 1, k);
      dark.opacity = 0.85 * Math.min(1, (1 - p) * 3);
      glow.opacity = 0.8 * Math.max(0, 1 - p * 4);
    }, () => { dark.dispose(); glow.dispose(); });
  }

  debris(pos: THREE.Vector3, count: number, spread: number, color = 0x7a6a55) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, rand(-0.1, 0.1)) });
      const mesh = new THREE.Mesh(boxGeo, m);
      const s = rand(0.25, 0.7);
      mesh.scale.set(s, s * rand(0.6, 1.2), s);
      mesh.position.set(pos.x + rand(-1, 1), pos.y + 0.2, pos.z + rand(-1, 1));
      mesh.castShadow = true;
      const a = Math.random() * Math.PI * 2;
      const sp = spread * rand(0.3, 1);
      const v = new THREE.Vector3(Math.cos(a) * sp, rand(5, 11), Math.sin(a) * sp);
      const spin = new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8));
      this.add(mesh, 1.3, (p, dt) => {
        v.y -= 28 * dt;
        mesh.position.addScaledVector(v, dt);
        if (mesh.position.y < s * 0.4) { mesh.position.y = s * 0.4; v.y *= -0.25; v.x *= 0.6; v.z *= 0.6; spin.multiplyScalar(0.6); }
        mesh.rotation.x += spin.x * dt; mesh.rotation.y += spin.y * dt; mesh.rotation.z += spin.z * dt;
        mesh.scale.multiplyScalar(p > 0.75 ? 0.94 : 1);
      }, () => m.dispose());
    }
  }

  explosion(pos: THREE.Vector3, color: number, r: number, dur = 0.55) {
    const m = this.mat(color, 0.75);
    const m2 = this.mat(0xffffff, 0.9);
    const a = new THREE.Mesh(sphereGeo, m);
    const b = new THREE.Mesh(sphereGeo, m2);
    const g = new THREE.Group();
    g.add(a, b);
    g.position.copy(pos);
    this.add(g, dur, (p) => {
      const e = 1 - Math.pow(1 - p, 3);
      a.scale.setScalar(Math.max(0.01, r * e));
      b.scale.setScalar(Math.max(0.01, r * 0.6 * e * (1 - p)));
      m.opacity = 0.75 * (1 - p);
      m2.opacity = 0.9 * Math.max(0, 1 - p * 2.2);
    }, () => { m.dispose(); m2.dispose(); });
    this.shockwave(new THREE.Vector3(pos.x, 0, pos.z), color, r * 1.15, dur * 0.9);
    this.burst(pos, color, Math.min(60, Math.floor(r * 6)), r * 3, 0.7, 0.5);
    this.sparks(pos, 0xffffff, Math.min(40, Math.floor(r * 4)), r * 4);
    this.flashAt(pos, 0xffffff, r * 1.4, 0.2);
    this.smoke(new THREE.Vector3(pos.x, Math.max(0, pos.y - 0.5), pos.z), Math.min(14, Math.floor(r * 2)), r * 0.6, 0x4a4650, r * 0.5, 1.4);
  }

  pillar(pos: THREE.Vector3, color: number, r: number, h: number, dur: number) {
    const m = this.mat(color, 0.6);
    const mesh = new THREE.Mesh(cylOpenGeo, m);
    mesh.position.set(pos.x, h / 2, pos.z);
    mesh.scale.set(r, h, r);
    this.add(mesh, dur, (p) => {
      const s = r * (1 - p * 0.75);
      mesh.scale.set(s, h, s);
      m.opacity = 0.65 * (1 - p);
    }, () => m.dispose());
  }

  dome(pos: THREE.Vector3, r: number, color: number, dur: number, opacity = 0.25) {
    const m = this.mat(color, opacity);
    const mesh = new THREE.Mesh(domeGeo, m);
    mesh.position.set(pos.x, 0, pos.z);
    this.add(mesh, dur, (p) => {
      const g = Math.min(1, p * 8);
      mesh.scale.setScalar(r * (0.4 + 0.6 * g));
      m.opacity = opacity * Math.min(1, g, (1 - p) * 4);
    }, () => m.dispose());
  }

  telegraph(pos: THREE.Vector3, radius: number, color: number, dur: number) {
    const g = new THREE.Group();
    const fm = this.mat(color, 0.3);
    const om = this.mat(color, 0.9);
    const fill = new THREE.Mesh(circleGeo, fm);
    const ring = new THREE.Mesh(ringThinGeo, om);
    fill.rotation.x = ring.rotation.x = -Math.PI / 2;
    g.add(fill, ring);
    g.position.set(pos.x, 0.14, pos.z);
    ring.scale.setScalar(radius);
    this.add(g, dur, (p) => {
      fill.scale.setScalar(Math.max(0.01, radius * p));
      om.opacity = 0.6 + Math.sin(p * 30) * 0.3;
      fm.opacity = 0.18 + p * 0.25;
    }, () => { fm.dispose(); om.dispose(); });
  }

  telegraphLine(pos: THREE.Vector3, dir: THREE.Vector3, len: number, width: number, color: number, dur: number) {
    const m = this.mat(color, 0.3);
    const mesh = new THREE.Mesh(planeGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    const ang = Math.atan2(dir.x, dir.z);
    const g = new THREE.Group();
    g.add(mesh);
    mesh.scale.set(width, len, 1);
    mesh.position.set(0, 0, len / 2);
    mesh.rotation.z = 0;
    g.position.set(pos.x, 0.15, pos.z);
    g.rotation.y = ang;
    this.add(g, dur, (p) => { m.opacity = 0.15 + p * 0.35 + Math.sin(p * 40) * 0.08; }, () => m.dispose());
  }

  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, width: number, dur: number) {
    const g = new THREE.Group();
    const m = this.mat(color, 0.7);
    const m2 = this.mat(0xffffff, 0.95);
    const o = new THREE.Mesh(beamGeo, m);
    const c = new THREE.Mesh(beamGeo, m2);
    const len = Math.max(0.1, a.distanceTo(b));
    g.position.copy(a).lerp(b, 0.5);
    g.lookAt(b);
    o.scale.set(width, width, len);
    c.scale.set(width * 0.4, width * 0.4, len);
    g.add(o, c);
    this.add(g, dur, (p) => {
      const k = 1 - p;
      o.scale.set(width * (0.4 + k), width * (0.4 + k), len);
      c.scale.set(width * 0.4 * k, width * 0.4 * k, len);
      m.opacity = 0.7 * k;
      m2.opacity = 0.95 * k;
    }, () => { m.dispose(); m2.dispose(); });
    const n = Math.min(24, Math.floor(len / 1.5));
    for (let i = 0; i < n; i++) {
      const p = a.clone().lerp(b, Math.random());
      this.glow.emit(p.x, p.y, p.z, rand(-2, 2), rand(-2, 2), rand(-2, 2), color, 1, rand(0.15, 0.35), 0.4, 0, 1, 0);
    }
  }

  bolt(a: THREE.Vector3, b: THREE.Vector3, color: number, dur: number, width = 0.3, branches = 2, jag = 1.2) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    const g = new THREE.Group();
    const segsM: THREE.Mesh[] = [];
    const build = (p0: THREE.Vector3, p1: THREE.Vector3, w: number, j: number) => {
      const n = Math.max(3, Math.floor(p0.distanceTo(p1) / 2.2));
      let prev = p0.clone();
      for (let i = 1; i <= n; i++) {
        const p = p0.clone().lerp(p1, i / n);
        if (i < n) p.addScaledVector(side, rand(-j, j)).addScaledVector(up, rand(-j, j));
        const mc = this.mat(color, 0.9);
        const mw = this.mat(0xffffff, 1);
        for (const [m, k] of [[mc, 1], [mw, 0.4]] as [THREE.Material, number][]) {
          const s = new THREE.Mesh(boxGeo, m);
          s.position.copy(prev).lerp(p, 0.5);
          s.lookAt(p);
          s.scale.set(w * k, w * k, prev.distanceTo(p) + 0.12);
          g.add(s);
          segsM.push(s);
        }
        prev = p;
      }
    };
    build(a, b, width, jag);
    for (let i = 0; i < branches; i++) {
      const s = a.clone().lerp(b, rand(0.2, 0.8));
      const e = s.clone().addScaledVector(side, rand(-1, 1) * len * 0.2).addScaledVector(up, rand(-1, 1) * len * 0.15).addScaledVector(dir, len * 0.12);
      build(s, e, width * 0.5, jag * 0.6);
    }
    this.add(g, dur, (p) => {
      g.visible = Math.random() > 0.18;
      const w = 1 - p * 0.75;
      for (const s of segsM) { s.scale.x *= 1; s.scale.y = s.scale.x; }
      g.scale.set(w, w, 1);
    }, () => { for (const s of segsM) (s.material as THREE.Material).dispose(); });
    this.glow.emit(b.x, b.y, b.z, 0, 0, 0, 0xffffff, 1, 1.4, 0.18, 0, 0, 0);
    this.sparks(b, color, 8, 8);
  }

  /** crescent slash. dir = travel direction, roll rotates around dir (0 = horizontal sweep) */
  slashArc(pos: THREE.Vector3, dir: THREE.Vector3, roll: number, size: number, width: number, color: number, dur = 0.26) {
    const f = dir.clone().normalize();
    let l = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f);
    if (l.lengthSq() < 0.01) l.set(1, 0, 0);
    l.normalize();
    let n = new THREE.Vector3().crossVectors(f, l).normalize();
    const l2 = l.clone().multiplyScalar(Math.cos(roll)).addScaledVector(n, Math.sin(roll));
    n = new THREE.Vector3().crossVectors(f, l2).normalize();
    l = l2;
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, l, n));
    const m = this.mat(color, 0.95);
    const m2 = this.mat(0xffffff, 0.9);
    const g = new THREE.Group();
    const a = new THREE.Mesh(crescent, m);
    const b = new THREE.Mesh(crescent, m2);
    b.scale.set(0.93, 0.8, 1);
    b.position.x = -0.02;
    g.add(a, b);
    g.position.copy(pos);
    g.quaternion.copy(q);
    this.add(g, dur, (p) => {
      const e = 1 - Math.pow(1 - p, 3);
      const sx = size * (0.45 + 0.75 * e);
      g.scale.set(sx * 0.9, size * (0.55 + 0.45 * e) * width, size);
      g.position.copy(pos).addScaledVector(f, size * 0.5 * e);
      m.opacity = 0.95 * (1 - p);
      m2.opacity = 0.9 * Math.max(0, 1 - p * 1.6);
    }, () => { m.dispose(); m2.dispose(); });
  }

  trailSeg(a: THREE.Vector3, b: THREE.Vector3, color: number, width: number, life = 0.2) {
    const len = a.distanceTo(b);
    if (len < 0.05) return;
    const m = this.mat(color, 0.85);
    const mesh = new THREE.Mesh(beamGeo, m);
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.lookAt(b);
    mesh.scale.set(width, width, len + 0.05);
    this.add(mesh, life, (p) => {
      const k = 1 - p;
      mesh.scale.x = mesh.scale.y = width * k;
      m.opacity = 0.85 * k;
    }, () => m.dispose());
    this.glow.emit(b.x, b.y, b.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), color, 0.9, width * 1.4, life * 1.3, 0, 2, 0);
  }

  afterimage(pos: THREE.Vector3, yaw: number, color: number, dur = 0.45, alpha = 0.6) {
    const s = buildSilhouette(color);
    s.position.set(pos.x, pos.y, pos.z);
    s.rotation.y = yaw;
    const m = (s.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    this.add(s, dur, (p) => { m.opacity = alpha * (1 - p); }, () => m.dispose());
  }

  tether(a: THREE.Object3D | (() => THREE.Vector3), b: () => THREE.Vector3, color: number, dur: number, width = 0.12) {
    const m = this.mat(color, 0.95);
    const mesh = new THREE.Mesh(beamGeo, m);
    const va = new THREE.Vector3();
    this.add(mesh, dur, () => {
      if (typeof a === 'function') va.copy(a());
      else a.getWorldPosition(va);
      const vb = b();
      mesh.position.copy(va).lerp(vb, 0.5);
      mesh.lookAt(vb);
      mesh.scale.set(width, width, Math.max(0.1, va.distanceTo(vb)));
    }, () => m.dispose());
  }

  /** chain = row of rings between two moving points */
  chain(a: () => THREE.Vector3, b: () => THREE.Vector3, color: number, dur: number, links = 14) {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < links; i++) {
      const t = new THREE.Mesh(torusGeo, m);
      t.scale.setScalar(0.28);
      g.add(t);
      meshes.push(t);
    }
    this.add(g, dur, (p) => {
      const va = a();
      const vb = b();
      const sag = Math.sin(Math.min(1, p * 6) * Math.PI * 0.5);
      meshes.forEach((t, i) => {
        const k = i / (links - 1);
        t.position.copy(va).lerp(vb, k);
        t.position.y += Math.sin(k * Math.PI) * 0.3 * (1 - sag);
        t.lookAt(vb);
        t.rotateZ(i % 2 ? Math.PI / 2 : 0);
      });
      g.visible = p < 0.97;
    }, () => m.dispose());
  }

  orbit(center: () => THREE.Vector3, count: number, radius: number, color: number, dur: number, size = 0.35, h = 2.2, speed = 4) {
    const mm = this.mat(color, 0.9);
    const g = new THREE.Group();
    const ms: THREE.Mesh[] = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Mesh(sphereGeo, mm);
      s.scale.setScalar(size);
      g.add(s);
      ms.push(s);
    }
    this.add(g, dur, (p) => {
      const c = center();
      const t = p * dur * speed;
      ms.forEach((s, i) => {
        const a = t + (i / count) * Math.PI * 2;
        s.position.set(c.x + Math.cos(a) * radius, c.y + h + Math.sin(a * 2) * 0.4, c.z + Math.sin(a) * radius);
        this.glow.emit(s.position.x, s.position.y, s.position.z, 0, 0, 0, color, 0.8, size * 0.9, 0.25, 0, 0, 0);
      });
      mm.opacity = 0.9 * Math.min(1, (1 - p) * 6);
    }, () => mm.dispose());
    return ms;
  }
}
