import * as THREE from 'three';
import { buildModel, type Rig } from './models';
import { ANIMS, ANIM_CHANNELS, SPIN_ANIMS, CHARGE_POSES, CHANNELS, type Chan } from './anims';
import type { Kind, CharDef } from './defs';

export type Team = 'player' | 'enemy' | 'none';

export interface Anim {
  name: string;
  t: number;
  dur: number;
  n?: number;
}

export interface AI {
  type: 'bandit' | 'rival';
  active: boolean;
  think: number;
  mode: string;
  strafe: number;
  dashCd: number;
  atkT: number;
  tempo: number;
  aggr: number;
  dodge: number;
  home: THREE.Vector3;
  aggro: boolean;
  swing: number;
  jumpT: number;
  holdFor: number;
}

export const BANDIT = { speed: 5.6, hp: 80, name: 'Bandit' };

export function angleDiff(to: number, from: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

type PoseFull = Record<Chan, number>;

export type Form = '' | 'adult' | 'god' | 'exhaust' | 'emperor' | 'deep';

export class Fighter {
  kind: Kind;
  def: CharDef | null;
  team: Team;
  isPlayer: boolean;
  name: string;
  rig: Rig;
  root: THREE.Group;
  pos: THREE.Vector3;
  vy = 0;
  onGround = true;
  yaw = 0;
  targetYaw = 0;

  hp: number;
  maxHp: number;
  energy = 50;
  maxEnergy = 100;
  meter = 0;
  meterMax = 100;
  level = 1;
  baseSpeed: number;
  speedMult = 1;
  dmgMult = 1;
  buffDmg = 1;
  dmgTaken = 1;
  atkSpeed = 1;
  rangeMult = 1;
  radius = 0.75;

  cd: number[] = [0, 0, 0, 0, 0];
  cdMax: number[] = [1, 1, 1, 1, 1];
  cdF: number[] = [0, 0, 0, 0, 0];
  cdFMax: number[] = [1, 1, 1, 1, 1];
  lock = 0;
  stun = 0;
  stunImmune = 0;
  invuln = 0;
  slow = 0;
  slowMul = 1;
  root_ = 0;
  floatT = 0;
  flinch = 0;
  flash = 0;
  m1cd = 0;
  combo = 0;
  comboT = 0;
  comboAir = false;
  dashCd = 0;
  dashMax = 1.6;
  buffT = 0;
  buffColor = 0x9fe8ff;
  boostT = 0;
  boostColor = 0xffaa33;
  auraCol = -1;
  auraAmt = 0;
  auraScale = 1;
  castId = 0;
  ghost = 0;
  tumble = 0;
  slamT = 0;
  landT = 0;
  coyote = 0;
  jumpBuf = 0;
  jumpHeld = false;
  onLand: { fn: () => void; t: number } | null = null;

  form: Form = '';
  formT = 0;
  formMax = 1;
  charging: { i: number; t: number; max: number; anim: string } | null = null;
  st: Record<string, number> = {};
  lastSkill: { kind: Kind; i: number; t: number; form: boolean } | null = null;

  forced: { vx: number; vz: number; t: number; T: number; ease: boolean; land?: boolean } | null = null;
  anim: Anim | null = null;
  moveInput = new THREE.Vector2();
  speedNow = 0;
  walkPhase = Math.random() * 6;

  dead = false;
  deathT = 0;
  ai: AI | null = null;
  label: HTMLElement | null = null;
  labelFill: HTMLElement | null = null;
  labelName: HTMLElement | null = null;
  trailPrev: Record<number, THREE.Vector3> = {};
  scaleNow: number;

  constructor(kind: Kind, team: Team, isPlayer: boolean, variant = 0, def: CharDef | null = null) {
    this.kind = kind;
    this.def = def;
    this.team = team;
    this.isPlayer = isPlayer;
    this.name = def ? def.name : BANDIT.name;
    this.rig = buildModel(kind, variant);
    this.root = this.rig.root;
    this.root.rotation.order = 'YXZ';
    this.pos = this.root.position;
    this.baseSpeed = def ? def.speed : BANDIT.speed;
    this.maxHp = this.hp = def ? def.hp : BANDIT.hp;
    this.scaleNow = this.rig.baseScale;
    if (def) this.meter = def.meter.start;
  }

  get alive() {
    return !this.dead;
  }
  get skillsDefs() {
    return this.def ? (this.form === 'adult' || this.form === 'god' ? this.def.formSkills ?? this.def.skills : this.def.skills) : [];
  }
  get inForm() {
    return this.form === 'adult' || this.form === 'god';
  }
  get airborne() {
    return !this.onGround;
  }

  chestPos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.8 * this.rig.baseScale, this.pos.z);
  }
  handPos(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.rig.hand.getWorldPosition(out);
  }
  handLPos(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.rig.handL.getWorldPosition(out);
  }
  footPos(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.rig.foot.getWorldPosition(out);
  }
  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
  faceNow(angle: number) {
    this.yaw = this.targetYaw = angle;
    this.root.rotation.y = angle;
  }

  addMarker(color: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.9, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    this.root.add(ring);
  }

  setAnim(name: string, dur: number, n?: number) {
    this.anim = { name, t: 0, dur, n };
  }

  flashHit(k = 1) {
    this.flash = 0.16;
    this.flinch = 0.22 * k;
  }

  setFormVisual(form: Form) {
    const r = this.rig;
    if (r.hairAdult) {
      r.hairAdult.visible = form === 'adult';
      r.hair.visible = form !== 'adult';
    }
    const glow = form === 'god' ? 1 : 0;
    if (this.kind === 'killua') for (const m of r.hairMats) m.emissive.setRGB(0.25 * glow, 0.5 * glow, 0.9 * glow);
  }

  /** timers + buffs; movement is applied by the game */
  tick(dt: number) {
    if (this.lock > 0) this.lock -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.stunImmune > 0) this.stunImmune -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.slow > 0) {
      this.slow -= dt;
      if (this.slow <= 0) this.slowMul = 1;
    }
    if (this.root_ > 0) this.root_ -= dt;
    if (this.floatT > 0) this.floatT -= dt;
    if (this.flinch > 0) this.flinch -= dt;
    if (this.m1cd > 0) this.m1cd -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.boostT > 0) this.boostT -= dt;
    if (this.ghost > 0) this.ghost -= dt;
    if (this.tumble > 0) this.tumble -= dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.coyote > 0) this.coyote -= dt;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.onLand) {
      this.onLand.t -= dt;
      if (this.onLand.t <= 0) this.onLand = null;
    }
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    const cdRate = 1 + (this.st.cdRate ?? 0);
    for (let i = 0; i < 5; i++) {
      if (this.cd[i] > 0) this.cd[i] = Math.max(0, this.cd[i] - dt * (i === 3 ? 1 : cdRate));
      if (this.cdF[i] > 0) this.cdF[i] = Math.max(0, this.cdF[i] - dt * cdRate);
    }
    for (const k of Object.keys(this.st)) {
      if (k.endsWith('T') && this.st[k] > 0) this.st[k] = Math.max(0, this.st[k] - dt);
    }
    if (this.buffT > 0) {
      this.buffT -= dt;
      if (this.buffT <= 0) {
        this.speedMult = this.inForm ? this.speedMult : 1;
        this.buffDmg = this.inForm ? this.buffDmg : 1;
      }
    }
    if (this.anim) {
      this.anim.t += dt;
      if (this.anim.t >= this.anim.dur) this.anim = null;
    }
    if (this.flash > 0) {
      this.flash -= dt;
      const k = Math.max(0, this.flash / 0.16);
      for (const m of this.rig.mats) m.emissive.setRGB(k * 0.8, k * 0.12, k * 0.12);
      if (this.flash <= 0 && this.kind === 'killua' && this.form === 'god') {
        for (const m of this.rig.hairMats) m.emissive.setRGB(0.25, 0.5, 0.9);
      }
    }
    if (this.dead) this.deathT += dt;
  }

  private base(time: number): PoseFull {
    const walk = Math.min(1.3, this.speedNow / 7);
    if (this.onGround) this.walkPhase += 0; // advanced in updatePose
    const s = Math.sin(this.walkPhase) * walk;
    const idle = Math.sin(time * 2.4 + this.walkPhase * 0) * 0.025 * (1 - Math.min(1, walk));
    const B: PoseFull = {
      bx: walk > 0.5 ? 0.08 * Math.min(1, walk) : 0, by: 0, bz: 0, py: idle - Math.abs(Math.cos(this.walkPhase)) * 0.05 * walk, pz: 0, hx: 0, hy: 0, ry: 0,
      aLx: -s * 0.8 - 0.1, aLz: -0.12, aRx: s * 0.8 - 0.1, aRz: 0.12, eL: -0.3 - Math.max(0, s) * 0.5, eR: -0.3 - Math.max(0, -s) * 0.5,
      lL: s * 0.95, lR: -s * 0.95, kL: Math.max(0, s) * 0.9, kR: Math.max(0, -s) * 0.9,
    };
    if (!this.onGround) {
      const rising = this.vy > 0;
      B.lL = rising ? -0.6 : -0.25;
      B.lR = rising ? 0.3 : 0.35;
      B.kL = rising ? 0.9 : 0.3;
      B.kR = rising ? 1.1 : 0.5;
      B.aLx = B.aRx = rising ? -1.0 : -2.0;
      B.aLz = -0.55;
      B.aRz = 0.55;
      B.eL = B.eR = -0.35;
      B.bx = rising ? 0.05 : 0.12;
      B.py = 0;
    }
    return B;
  }

  updatePose(dt: number, time: number) {
    const r = this.rig;
    this.yaw += angleDiff(this.targetYaw, this.yaw) * Math.min(1, dt * 18);

    // scale (forms)
    const want = this.rig.baseScale * (this.form === 'adult' ? 1.28 : 1) * (this.dead ? 1 : 1);
    this.scaleNow += (want - this.scaleNow) * Math.min(1, dt * 6);
    r.root.scale.setScalar(this.scaleNow);

    // aura
    let col = -1;
    let amt = 0.13;
    if (this.auraCol >= 0) {
      col = this.auraCol;
      amt = this.auraAmt;
    } else if (this.buffT > 0) col = this.buffColor;
    else if (this.boostT > 0) col = this.boostColor;
    if (col >= 0 && !this.dead) {
      r.aura.visible = true;
      const m = r.aura.material as THREE.MeshBasicMaterial;
      m.color.setHex(col);
      m.opacity = amt + Math.sin(time * 18) * amt * 0.35;
      const s = (1 + Math.sin(time * 14) * 0.05) * this.auraScale;
      r.aura.scale.set(1.5 * s, 2.1 * s, 1.5 * s);
    } else r.aura.visible = false;

    if (this.onGround) this.walkPhase += dt * (5 + this.speedNow * 0.55);
    const B = this.base(time);
    const out: PoseFull = { ...B };

    if (this.charging) {
      const P = CHARGE_POSES[this.charging.anim] ?? CHARGE_POSES.charge;
      const k = Math.min(1, this.charging.t * 6);
      for (const c of Object.keys(P) as Chan[]) out[c] = B[c] + (P[c]! - B[c]) * k;
      out.pz += Math.sin(time * 70) * 0.025 * k;
      out.py += Math.sin(time * 55) * 0.02 * k;
    } else if (this.anim) {
      const a = this.anim;
      const keys = ANIMS[a.name];
      if (keys) {
        const p = Math.min(1, a.t / a.dur);
        const env = Math.min(1, p / 0.08 + 0.15) * Math.min(1, (1 - p) / 0.12 + 0.0001);
        let i = 0;
        while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
        const k0 = keys[i];
        const k1 = keys[i + 1] ?? keys[i];
        const span = Math.max(0.0001, k1[0] - k0[0]);
        const lt = Math.min(1, Math.max(0, (p - k0[0]) / span));
        const f = smooth(lt);
        for (const ch of ANIM_CHANNELS[a.name]) {
          const va = k0[1][ch] ?? B[ch];
          const vb = k1[1][ch] ?? B[ch];
          if (ch === 'ry') {
            const spin = SPIN_ANIMS.has(a.name) ? a.n ?? 1 : 1;
            out.ry = (va + (vb - va) * lt) * spin;
          } else {
            const v = va + (vb - va) * f;
            out[ch] = B[ch] + (v - B[ch]) * Math.min(1, env);
          }
        }
      }
    }

    // landing squash
    if (this.landT > 0) {
      const k = this.landT / 0.14;
      out.py -= 0.3 * k;
      out.kL += 0.5 * k;
      out.kR += 0.5 * k;
      out.lL -= 0.3 * k;
      out.lR -= 0.3 * k;
    }
    // exhausted slump
    if (this.form === 'exhaust') {
      out.bx += 0.35;
      out.hx += 0.3;
      out.py -= 0.1;
      out.aLx = out.aRx = 0.1;
    }
    // hit reaction
    if (this.flinch > 0 && !this.dead) {
      const k = this.flinch / 0.22;
      out.bx -= 0.45 * k;
      out.hx -= 0.35 * k;
      out.aLx -= 0.5 * k;
      out.aRx -= 0.5 * k;
      out.pz -= 0.12 * k;
    }
    if (this.tumble > 0 && !this.dead) {
      out.bx -= (0.5 - this.tumble) * 9;
      out.lL = -0.5;
      out.lR = 0.4;
    }

    r.root.rotation.y = this.yaw + out.ry;
    r.body.position.set(0, 1.1 + out.py, out.pz);
    r.body.rotation.set(out.bx, out.by, out.bz);
    r.head.rotation.set(out.hx, out.hy, 0);
    r.armL.rotation.set(out.aLx, 0, out.aLz);
    r.armR.rotation.set(out.aRx, 0, out.aRz);
    r.foreL.rotation.set(out.eL, 0, 0);
    r.foreR.rotation.set(out.eR, 0, 0);
    const hip = 1.1 + Math.min(0, out.py) * 0.85;
    r.legL.position.y = hip;
    r.legR.position.y = hip;
    r.legL.rotation.set(out.lL, 0, 0);
    r.legR.rotation.set(out.lR, 0, 0);
    r.shinL.rotation.set(out.kL, 0, 0);
    r.shinR.rotation.set(out.kR, 0, 0);

    if (this.dead) r.root.rotation.x = -Math.min(1, this.deathT / 0.45) * (Math.PI / 2);
    else r.root.rotation.x = 0;
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mm = m.material;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else if (mm && !this.rig.mats.includes(mm as THREE.MeshLambertMaterial)) (mm as THREE.Material).dispose();
      }
    });
    for (const m of this.rig.mats) {
      (m.map as THREE.Texture | null)?.dispose();
      m.dispose();
    }
  }
}

export { CHANNELS };
