import * as THREE from 'three';
import { FX, crescent } from './fx';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
const streakGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).rotateX(Math.PI / 2);
const ringGeo2 = new THREE.RingGeometry(0.62, 1, 64);

const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function ringMat(color: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uO: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vU; void main(){ vU=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uC; uniform float uO; varying vec2 vU;
      void main(){ float r=length(vU); float a=pow(smoothstep(0.62,0.97,r),2.2)*smoothstep(1.0,0.965,r);
        vec3 col=mix(uC*1.5, vec3(1.8), pow(smoothstep(0.85,0.97,r),2.0)); gl_FragColor=vec4(col, a*uO); }`,
  });
}
function fireMat(color: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uO: { value: 1 }, uT: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uT; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 p=position*(1.0+0.1*sin(position.x*7.0+uT*9.0)*sin(position.y*6.0-uT*7.0)*sin(position.z*8.0+uT*5.0));
        vec4 mv=modelViewMatrix*vec4(p,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uO; varying vec3 vN; varying vec3 vV;
      void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.6); vec3 col=mix(vec3(1.6,1.4,1.1),uC*1.8,smoothstep(0.0,0.85,f)); gl_FragColor=vec4(col, uO*(0.28+0.72*f)); }`,
  });
}

/** v4 effects: layered, physically-flavoured hits, slashes and blasts */
export class FX2 extends FX {
  flare(pos: THREE.Vector3, color: number, size: number, dur = 0.2, op = 1) {
    const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: op });
    m.color.multiplyScalar(2.2);
    const sp = new THREE.Sprite(m);
    sp.position.copy(pos);
    this.add(sp, dur, (p) => {
      const e = 1 - Math.pow(1 - p, 2.5);
      sp.scale.setScalar(size * (0.45 + e * 0.9));
      m.opacity = op * Math.pow(1 - p, 1.6);
    }, () => m.dispose());
  }

  /** a thin hot tracer that flies, falls and fades */
  streak(pos: THREE.Vector3, vel: THREE.Vector3, color: number, life: number, thick = 0.03) {
    const m = this.mat(color, 1);
    const mesh = new THREE.Mesh(streakGeo, m);
    const p = pos.clone();
    const v = vel.clone();
    mesh.position.copy(p);
    this.add(mesh, life, (k, dt) => {
      v.y -= 22 * dt;
      v.multiplyScalar(1 - 1.4 * dt);
      p.addScaledVector(v, dt);
      if (p.y < 0.05) { p.y = 0.05; v.y *= -0.3; }
      mesh.position.copy(p);
      mesh.lookAt(p.x + v.x, p.y + v.y, p.z + v.z);
      const len = Math.max(0.08, v.length() * 0.05 * (1 - k));
      mesh.scale.set(thick * (1 - k * 0.7), thick * (1 - k * 0.7), len);
      m.opacity = 1 - k * k;
    }, () => m.dispose());
  }

  private camRing(pos: THREE.Vector3, color: number, r0: number, r1: number, dur: number, dir?: THREE.Vector3) {
    const m = ringMat(color);
    const mesh = new THREE.Mesh(ringGeo2, m);
    mesh.position.copy(pos);
    this.add(mesh, dur, (p) => {
      if (dir) mesh.lookAt(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
      else if (this.camera) mesh.quaternion.copy(this.camera.quaternion);
      const s = r0 + (r1 - r0) * (1 - Math.pow(1 - p, 3));
      mesh.scale.setScalar(s);
      m.uniforms.uO.value = Math.pow(1 - p, 1.4);
    }, () => m.dispose());
  }

  override hitSpark(pos: THREE.Vector3, color: number, size = 1.2) {
    this.flare(pos, 0xffffff, size * 1.5, 0.11);
    this.flare(pos, color, size * 3.4, 0.24, 0.65);
    const n = 5 + Math.floor(size * 4);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 13) * (0.7 + size * 0.3));
      if (i < 4) this.streak(pos, v, i % 2 ? 0xffffff : color, rand(0.22, 0.42), 0.028);
      else this.glow.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z, i % 3 === 0 ? 0xffffff : color, 1, rand(0.08, 0.17), rand(0.3, 0.7), 16, 1.2, 0);
    }
  }

  override impact(pos: THREE.Vector3, color: number, power = 1, dir?: THREE.Vector3) {
    const d = dir ? dir.clone().normalize() : new THREE.Vector3(rand(-1, 1), rand(-0.2, 0.6), rand(-1, 1)).normalize();
    this.flare(pos, 0xffffff, 1.6 + power * 1.3, 0.12);
    this.flare(pos, color, 3.2 + power * 2.4, 0.3, 0.6);
    this.camRing(pos, color, 0.3, 1.6 + power * 1.5, 0.26 + power * 0.04);
    if (power > 0.8) this.camRing(pos, 0xffffff, 0.2, 1.1 + power, 0.2, d);
    const n = 6 + Math.floor(power * 6);
    for (let i = 0; i < n; i++) {
      const v = d.clone().multiplyScalar(rand(6, 16) * (0.7 + power * 0.5)).add(new THREE.Vector3(rand(-6, 6), rand(-1, 7), rand(-6, 6)));
      this.streak(pos, v, i % 2 ? 0xffffff : color, rand(0.25, 0.55), 0.03 + power * 0.008);
    }
    for (let i = 0; i < 6 + Math.floor(power * 6); i++) {
      const v = d.clone().multiplyScalar(rand(2, 9)).add(new THREE.Vector3(rand(-4, 4), rand(0, 5), rand(-4, 4)));
      this.glow.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z, color, 1, rand(0.1, 0.24), rand(0.35, 0.8), 14, 1.1, 0);
    }
    // a small puff of grit / smoke carried by the blow
    for (let i = 0; i < 2 + Math.floor(power * 2); i++) {
      this.soft.emit(pos.x, pos.y, pos.z, d.x * rand(1, 4) + rand(-1, 1), rand(0.3, 2), d.z * rand(1, 4) + rand(-1, 1), 0x8a8494, 1, rand(0.9, 1.5) * (0.7 + power * 0.4), rand(0.5, 0.9), -0.3, 1.6, 0.8);
    }
  }

  override slashArc(pos: THREE.Vector3, dir: THREE.Vector3, roll: number, size: number, width: number, color: number, dur = 0.26) {
    const f = dir.clone().normalize();
    let l = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f);
    if (l.lengthSq() < 0.01) l.set(1, 0, 0);
    l.normalize();
    let n = new THREE.Vector3().crossVectors(f, l).normalize();
    const l2 = l.clone().multiplyScalar(Math.cos(roll)).addScaledVector(n, Math.sin(roll));
    n = new THREE.Vector3().crossVectors(f, l2).normalize();
    l = l2;
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, l, n));
    const sm = (c: number) =>
      new THREE.ShaderMaterial({
        uniforms: { uC: { value: new THREE.Color(c) }, uO: { value: 1 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uC; uniform float uO; varying vec2 vP;
          void main(){ float r=length(vP); float ang=abs(atan(vP.y,vP.x))/1.15; float tip=1.0-pow(clamp(ang,0.0,1.0),2.0);
            float edge=smoothstep(0.3,1.0,r); vec3 col=mix(uC*1.4, vec3(2.2), pow(edge,3.0)); gl_FragColor=vec4(col, uO*tip*(0.18+0.82*edge)); }`,
      });
    const m = sm(color);
    const m2 = sm(0xffffff);
    const g = new THREE.Group();
    const a = new THREE.Mesh(crescent, m);
    const b = new THREE.Mesh(crescent, m2);
    b.scale.set(0.9, 0.55, 1);
    b.position.x = 0.04;
    g.add(a, b);
    g.position.copy(pos);
    g.quaternion.copy(q);
    this.add(g, dur, (p) => {
      const e = 1 - Math.pow(1 - p, 3);
      const sx = size * (0.5 + 0.8 * e);
      g.scale.set(sx * 0.9, size * (0.55 + 0.45 * e) * width, size);
      g.position.copy(pos).addScaledVector(f, size * 0.55 * e);
      m.uniforms.uO.value = Math.pow(1 - p, 1.3);
      m2.uniforms.uO.value = Math.max(0, 1 - p * 1.5);
    }, () => { m.dispose(); m2.dispose(); });
    // embers shed along the cut
    for (let i = 0; i < 6; i++) {
      const t = rand(-1, 1);
      const pp = pos.clone().addScaledVector(f, size * (0.55 + 0.35 * Math.cos(t))).addScaledVector(l, Math.sin(t) * size * 0.6 * width);
      this.glow.emit(pp.x, pp.y, pp.z, f.x * 3 + rand(-2, 2), rand(0, 2), f.z * 3 + rand(-2, 2), i % 2 ? 0xffffff : color, 0.9, rand(0.07, 0.15), rand(0.25, 0.5), 6, 1.5, 0);
    }
  }

  override shockwave(pos: THREE.Vector3, color: number, r: number, dur = 0.5) {
    const m = ringMat(color);
    const mesh = new THREE.Mesh(ringGeo2, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.14, pos.z);
    const m2 = ringMat(0xffffff);
    const mesh2 = new THREE.Mesh(ringGeo2, m2);
    mesh2.rotation.x = -Math.PI / 2;
    mesh2.position.set(pos.x, 0.18, pos.z);
    const g = new THREE.Group();
    g.add(mesh, mesh2);
    this.add(g, dur, (p) => {
      const e = 1 - Math.pow(1 - p, 3);
      mesh.scale.setScalar(Math.max(0.2, 0.4 + (r - 0.4) * e));
      mesh2.scale.setScalar(Math.max(0.2, 0.3 + (r * 0.8 - 0.3) * e));
      m.uniforms.uO.value = 1 - p;
      m2.uniforms.uO.value = Math.max(0, 0.9 - p * 1.4);
    }, () => { m.dispose(); m2.dispose(); });
    const n = Math.min(26, Math.floor(r * 2.2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
      const sp = r * rand(1.2, 2.2);
      this.soft.emit(pos.x + Math.cos(a) * 0.6, 0.35, pos.z + Math.sin(a) * 0.6, Math.cos(a) * sp, rand(0.8, 2.4), Math.sin(a) * sp, 0xb5a98e, 1, rand(1.0, 1.9), rand(0.7, 1.3), -0.5, 2.8, 0.7);
    }
    for (let i = 0; i < Math.min(30, Math.floor(r * 2.5)); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = r * rand(1.0, 2.0);
      this.glow.emit(pos.x, 0.3, pos.z, Math.cos(a) * sp, rand(2, 7), Math.sin(a) * sp, i % 3 ? color : 0xffffff, 1, rand(0.1, 0.22), rand(0.4, 0.9), 16, 1.2, 0);
    }
  }

  override explosion(pos: THREE.Vector3, color: number, r: number, dur = 0.55) {
    const m = fireMat(color);
    const core = fireMat(0xfff0c0);
    const a = new THREE.Mesh(sphereGeo, m);
    const b = new THREE.Mesh(sphereGeo, core);
    const g = new THREE.Group();
    g.add(a, b);
    g.position.copy(pos);
    this.add(g, dur, (p, dt) => {
      const e = 1 - Math.pow(1 - p, 3);
      m.uniforms.uT.value += dt;
      core.uniforms.uT.value += dt * 1.4;
      a.scale.setScalar(Math.max(0.01, r * (0.25 + e * 0.85)));
      b.scale.setScalar(Math.max(0.01, r * 0.55 * (0.3 + e * 0.7) * (1 - p)));
      m.uniforms.uO.value = Math.pow(1 - p, 1.2);
      core.uniforms.uO.value = Math.max(0, 1 - p * 2.0);
    }, () => { m.dispose(); core.dispose(); });
    this.flare(pos, 0xffffff, r * 2.6, 0.18);
    this.flare(pos, color, r * 4.5, dur * 0.8, 0.5);
    this.shockwave(new THREE.Vector3(pos.x, 0, pos.z), color, r * 1.25, dur * 0.95);
    const nb = Math.min(50, Math.floor(r * 6));
    for (let i = 0; i < nb; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.1, 1.1), rand(-1, 1)).normalize().multiplyScalar(r * rand(1.5, 4.5));
      this.glow.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z, i % 3 === 0 ? 0xffe9b0 : color, 1, rand(0.15, 0.35), rand(0.5, 1.2), 12, 1.5, 0);
    }
    for (let i = 0; i < Math.min(12, Math.floor(r * 1.6)); i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize().multiplyScalar(r * rand(3, 6));
      this.streak(pos, v, i % 2 ? 0xffffff : color, rand(0.4, 0.8), 0.04);
    }
    // billowing smoke column (dark, lit from within)
    for (let i = 0; i < Math.min(18, Math.floor(r * 3)); i++) {
      const aa = Math.random() * Math.PI * 2;
      const s = r * rand(0.1, 0.7);
      this.soft.emit(pos.x + Math.cos(aa) * s, Math.max(0.3, pos.y - 0.3) + rand(0, 0.8), pos.z + Math.sin(aa) * s, Math.cos(aa) * rand(0.5, 2.5), rand(1.2, 4.5), Math.sin(aa) * rand(0.5, 2.5), i % 3 ? 0x4a4650 : 0x2a2630, 1, r * rand(0.5, 0.95), rand(1.1, 2.2), -0.4, 0.9, 0.8);
    }
  }
}
