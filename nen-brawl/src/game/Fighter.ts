import * as THREE from 'three';
import { buildModel, type Kind, type Rig } from './models';

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
  swing: number; // bandit swing windup timer (<0 = idle)
}

export const BASE_STATS: Record<Kind, { speed: number; hp: number; name: string }> = {
  killua: { speed: 11, hp: 400, name: 'Killua' },
  gon: { speed: 10.2, hp: 430, name: 'Gon' },
  bandit: { speed: 5.6, hp: 80, name: 'Bandit' },
};

const bump = (p: number) => Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function angleDiff(to: number, from: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Fighter {
  kind: Kind;
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
  energy = 100;
  maxEnergy = 100;
  level = 1;
  baseSpeed: number;
  speedMult = 1;
  dmgMult = 1;
  buffDmg = 1;
  radius = 0.75;

  cd: number[] = [0, 0, 0, 0, 0];
  cdMax: number[] = [1, 1, 1, 1, 1];
  lock = 0;
  stun = 0;
  stunImmune = 0;
  invuln = 0;
  slow = 0;
  floatT = 0;
  flinch = 0;
  flash = 0;
  m1cd = 0;
  combo = 0;
  comboT = 0;
  dashCd = 0;
  buffT = 0;
  buffColor = 0x9fe8ff;
  boostT = 0;
  boostColor = 0xffaa33;
  castId = 0;

  forced: { vx: number; vz: number; t: number; T: number; ease: boolean } | null = null;
  anim: Anim | null = null;
  moveInput = new THREE.Vector2();
  speedNow = 0;
  walkPhase = Math.random() * 6;

  dead = false;
  deathT = 0;
  ai: AI | null = null;
  label: HTMLElement | null = null;
  labelFill: HTMLElement | null = null;
  hitFlag = false;

  constructor(kind: Kind, team: Team, isPlayer: boolean, variant = 0) {
    this.kind = kind;
    this.team = team;
    this.isPlayer = isPlayer;
    this.name = BASE_STATS[kind].name;
    this.rig = buildModel(kind, variant);
    this.root = this.rig.root;
    this.root.rotation.order = 'YXZ';
    this.pos = this.root.position;
    this.baseSpeed = BASE_STATS[kind].speed;
    this.maxHp = this.hp = BASE_STATS[kind].hp;
  }

  get alive() {
    return !this.dead;
  }

  chestPos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.8, this.pos.z);
  }

  handPos(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.rig.hand.getWorldPosition(out);
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

  flashHit() {
    this.flash = 0.16;
    this.flinch = 0.22;
  }

  /** timers + buffs; movement is applied by the game */
  tick(dt: number) {
    if (this.lock > 0) this.lock -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.stunImmune > 0) this.stunImmune -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.slow > 0) this.slow -= dt;
    if (this.floatT > 0) this.floatT -= dt;
    if (this.flinch > 0) this.flinch -= dt;
    if (this.m1cd > 0) this.m1cd -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.boostT > 0) this.boostT -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    for (let i = 0; i < 5; i++) if (this.cd[i] > 0) this.cd[i] = Math.max(0, this.cd[i] - dt);
    if (this.buffT > 0) {
      this.buffT -= dt;
      if (this.buffT <= 0) {
        this.speedMult = 1;
        this.buffDmg = 1;
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
    }
    if (this.dead) this.deathT += dt;
  }

  updatePose(dt: number, time: number) {
    const r = this.rig;
    this.yaw += angleDiff(this.targetYaw, this.yaw) * Math.min(1, dt * 18);
    r.root.rotation.y = this.yaw;

    // aura
    const auraOn = this.buffT > 0 ? this.buffColor : this.boostT > 0 ? this.boostColor : -1;
    if (auraOn >= 0 && !this.dead) {
      r.aura.visible = true;
      const m = r.aura.material as THREE.MeshBasicMaterial;
      m.color.setHex(auraOn);
      m.opacity = 0.13 + Math.sin(time * 18) * 0.05;
      const s = 1 + Math.sin(time * 14) * 0.05;
      r.aura.scale.set(1.5 * s, 2.1 * s, 1.5 * s);
    } else r.aura.visible = false;

    const walk = Math.min(1.3, this.speedNow / 7);
    if (this.onGround) this.walkPhase += dt * (5 + this.speedNow * 0.55);
    const s = Math.sin(this.walkPhase) * walk;

    let lL = s * 0.95;
    let lR = -s * 0.95;
    let aL = -s * 0.8 - 0.2;
    let aR = s * 0.8 - 0.2;
    let aLz = -0.12;
    let aRz = 0.12;
    if (!this.onGround) {
      lL = -0.6;
      lR = 0.5;
      aL = aR = -0.9;
      aLz = -0.5;
      aRz = 0.5;
    }
    r.body.position.set(0, 1.1 + Math.sin(time * 2.6 + this.walkPhase * 0.0) * 0.025 * (1 - Math.min(1, walk)), 0);
    r.body.rotation.set(0, 0, 0);
    r.head.rotation.set(0, 0, 0);
    r.legL.rotation.set(0, 0, 0);
    r.legR.rotation.set(0, 0, 0);

    if (this.anim) {
      const a = this.anim;
      const p = a.t / a.dur;
      const b = bump(p);
      switch (a.name) {
        case 'punchR':
          aR = -1.75 * b;
          aL = 0.5 * b - 0.2;
          r.body.rotation.y = -0.5 * b;
          break;
        case 'punchL':
          aL = -1.75 * b;
          aR = 0.5 * b - 0.2;
          r.body.rotation.y = 0.5 * b;
          break;
        case 'kick':
          lR = -1.5 * b;
          aL = -0.9 * b;
          aR = 0.7 * b;
          r.body.rotation.x = -0.2 * b;
          break;
        case 'spinkick':
          r.body.rotation.y = p * Math.PI * 2;
          lL = -1.3 * b;
          aLz = -1.2 * b;
          aRz = 1.2 * b;
          break;
        case 'cast': {
          const k = p < 0.8 ? Math.min(1, p * 6) : Math.max(0, (1 - p) / 0.2);
          aL = aR = -1.55 * k;
          r.body.rotation.x = 0.12 * k;
          break;
        }
        case 'charge': {
          const k = Math.min(1, p * 3);
          aL = aR = 0.9 * k;
          aLz = -0.4 * k;
          aRz = 0.4 * k;
          r.body.rotation.x = 0.4 * k;
          r.body.position.x = Math.sin(time * 70) * 0.04 * k;
          lL = 0.3 * k;
          lR = -0.5 * k;
          break;
        }
        case 'slam': {
          if (p < 0.75) {
            const k = 1 - Math.pow(1 - p / 0.75, 2);
            aL = aR = -3.0 * k;
            r.body.rotation.x = -0.25 * k;
            r.body.position.x = Math.sin(time * 60) * 0.03 * k;
          } else {
            const q = (p - 0.75) / 0.25;
            aL = aR = lerp(-3.0, -0.4, Math.min(1, q * 2));
            r.body.rotation.x = lerp(-0.25, 0.5, Math.min(1, q * 2));
          }
          break;
        }
        case 'spin':
          r.body.rotation.y = p * Math.PI * 2 * (a.n ?? 3);
          aLz = -1.5;
          aRz = 1.5;
          aL = aR = 0;
          lL = -0.8;
          lR = 0.4;
          break;
        case 'slash': {
          const k = 1 - Math.pow(1 - Math.min(1, p), 2);
          aR = lerp(-2.7, -0.3, k);
          aL = lerp(-0.2, -1.4, k);
          r.body.rotation.y = lerp(-0.6, 0.6, k);
          break;
        }
        case 'throw': {
          if (p < 0.45) aR = lerp(-0.2, 1.4, p / 0.45);
          else aR = lerp(-1.7, -1.3, Math.min(1, (p - 0.45) / 0.55));
          aL = -0.5;
          r.body.rotation.y = p < 0.45 ? 0.3 : -0.3;
          break;
        }
        case 'victory':
          aL = aR = -3.0 + Math.sin(time * 8) * 0.2;
          break;
      }
    }

    if (this.flinch > 0 && !this.dead) {
      const k = this.flinch / 0.22;
      r.body.rotation.x -= 0.38 * k;
      r.head.rotation.x = -0.3 * k;
      aL -= 0.3 * k;
      aR -= 0.3 * k;
    }

    r.legL.rotation.x = lL;
    r.legR.rotation.x = lR;
    r.armL.rotation.set(aL, 0, aLz);
    r.armR.rotation.set(aR, 0, aRz);

    if (this.dead) {
      r.root.rotation.x = -Math.min(1, this.deathT / 0.45) * (Math.PI / 2);
    } else r.root.rotation.x = 0;
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
