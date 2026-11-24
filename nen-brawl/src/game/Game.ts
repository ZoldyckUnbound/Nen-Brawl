import * as THREE from 'three';
import { Fighter, angleDiff, BASE_STATS, type Team, type AI } from './Fighter';
import { buildSilhouette, type Kind } from './models';
import { buildIsland, buildArena, type World } from './world';
import { SKILLS } from './skills';
import { sfx, initAudio } from './audio';

export type Stage = 'menu' | 'island' | 'transition' | 'arena' | 'over';
export type PlayableKind = 'killua' | 'gon';

export interface HudSkill {
  key: string;
  name: string;
  desc: string;
  cost: number;
  cd: number;
  cdMax: number;
}

export interface HudState {
  stage: Stage;
  kind: PlayableKind;
  name: string;
  level: number;
  xp: number;
  xpNeed: number;
  beli: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  skills: HudSkill[];
  dashCd: number;
  rival: { name: string; hp: number; maxHp: number } | null;
  quest: { text: string; progress: number; goal: number } | null;
  banner: string;
  sub: string;
  countdown: string;
  lockOn: boolean;
  fade: boolean;
  paused: boolean;
  locked: boolean;
  buff: boolean;
}

export interface GameCallbacks {
  onHud: (s: HudState | null) => void;
  onEnd: (r: 'victory' | 'defeat') => void;
}

export interface DmgOpts {
  kb?: number;
  stun?: number;
  color?: number;
  heavy?: boolean;
  noCrit?: boolean;
  onHit?: (v: Fighter) => void;
  dirx?: number;
  dirz?: number;
}

export interface ShootOpts {
  owner: Fighter;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  radius: number;
  dmg: number;
  life: number;
  color: number;
  size: number;
  shape: 'orb' | 'wave' | 'yoyo' | 'hook';
  pierce?: boolean;
  opts?: DmgOpts;
}

interface Proj {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  speed: number;
  radius: number;
  dmg: number;
  owner: Fighter;
  life: number;
  pierce: boolean;
  hit: Set<Fighter>;
  opts: DmgOpts;
  color: number;
  spin: THREE.Object3D | null;
  trailT: number;
}

interface Fx {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  update: (p: number) => void;
  dispose?: () => void;
}

interface Part {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
}

interface Timer {
  t: number;
  fn: () => void;
  owner: Fighter | null;
  id: number;
  match: number;
}

interface Floater {
  el: HTMLElement;
  pos: THREE.Vector3;
  t: number;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
const ringGeo = new THREE.RingGeometry(0.8, 1, 40);
const circleGeo = new THREE.CircleGeometry(1, 40);
const ringThinGeo = new THREE.RingGeometry(0.94, 1, 48);
const cylOpenGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
const planeGeo = new THREE.PlaneGeometry(1, 1);
const torusGeo = new THREE.TorusGeometry(1, 0.22, 6, 14);

const matCache = new Map<string, THREE.MeshBasicMaterial>();
function basicMat(color: number, additive = true) {
  const key = color + (additive ? 'a' : 'n');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, transparent: additive, depthWrite: !additive });
    matCache.set(key, m);
  }
  return m;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const KIND_COLOR: Record<Kind, number> = { killua: 0x8fe3ff, gon: 0x8dff6a, bandit: 0xffffff };

export class Game {
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private cb: GameCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private island: World;
  private arena: World;
  private cur: World;
  private entities = new THREE.Group();
  private fxGroup = new THREE.Group();
  private menuGroup = new THREE.Group();
  private menuF: Record<PlayableKind, Fighter>;
  private menuHover: PlayableKind | null = null;
  private flashEl: HTMLDivElement;

  stage: Stage = 'menu';
  fighters: Fighter[] = [];
  player!: Fighter;
  rival: Fighter | null = null;
  private playerKind: PlayableKind = 'killua';
  private rivalKind: PlayableKind = 'gon';
  private projs: Proj[] = [];
  private fxs: Fx[] = [];
  private parts: Part[] = [];
  private timers: Timer[] = [];
  private floaters: Floater[] = [];
  private matchId = 0;
  private dropping: Fighter | null = null;

  private keys = new Set<string>();
  private mouseDown = false;
  private rightDown = false;
  private camYaw = Math.PI;
  private camPitch = 0.35;
  private camDist = 10;
  private lockOn = false;
  private shakeAmt = 0;
  private hitStop = 0;
  private paused = false;
  private frozen = false;
  private time = 0;
  private hudT = 0;
  private last = 0;
  private raf = 0;
  private w = 1;
  private h = 1;

  private level = 1;
  private xp = 0;
  private beli = 0;
  private quest: { text: string; progress: number; goal: number } | null = null;
  private bannerText = '';
  private bannerSub = '';
  private bannerUntil = 0;
  private countdown = '';
  private fade = false;
  private banditsDown = 0;
  private banditsTotal = 4;
  private phase: 'bandits' | 'rival' = 'bandits';
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, cb: GameCallbacks) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.cb = cb;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a8f4a, 2.0);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    sc.near = 1;
    sc.far = 200;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.island = buildIsland();
    this.arena = buildArena();
    this.arena.group.visible = false;
    this.cur = this.island;
    this.scene.add(this.island.group, this.arena.group, this.entities, this.fxGroup, this.menuGroup);

    // menu showcase
    this.menuF = { killua: new Fighter('killua', 'none', false), gon: new Fighter('gon', 'none', false) };
    const pm = new THREE.MeshLambertMaterial({ color: 0x3b3f58 });
    const gm = new THREE.MeshLambertMaterial({ color: 0xd4a94a });
    (['killua', 'gon'] as PlayableKind[]).forEach((k, i) => {
      const f = this.menuF[k];
      f.pos.set(i === 0 ? -3.3 : 3.3, 0.6, 0);
      f.faceNow(i === 0 ? 0.25 : -0.25);
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.6, 24), pm);
      pod.position.set(f.pos.x, 0.3, 0);
      pod.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2, 0.08, 6, 32), gm);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(f.pos.x, 0.62, 0);
      this.menuGroup.add(pod, rim, f.root);
    });

    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none;';
    overlay.appendChild(this.flashEl);

    this.bind();
    this.resize();
    this.showMenu();
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const real = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(real);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ setup
  private onResize = () => this.resize();
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.stage === 'menu') return;
    const c = e.code;
    if (['Space', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(c)) e.preventDefault();
    if (e.repeat) {
      this.keys.add(c);
      return;
    }
    this.keys.add(c);
    initAudio();
    if (c === 'KeyP') {
      this.paused = !this.paused;
      this.emitHud();
      return;
    }
    if (this.paused) return;
    const idx = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyF'].indexOf(c);
    if (idx >= 0) this.castSkill(this.player, idx);
    else if (c === 'ShiftLeft' || c === 'ShiftRight') this.playerDash();
    else if (c === 'KeyT') {
      this.lockOn = !this.lockOn;
      sfx('ui');
      this.emitHud();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
    this.rightDown = false;
  };
  private onMouseDown = (e: MouseEvent) => {
    if (this.stage === 'menu') return;
    initAudio();
    if (e.button === 0) {
      this.mouseDown = true;
      if (document.pointerLockElement !== this.canvas) {
        try {
          const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
          r?.catch?.(() => {});
        } catch {
          /* ignore */
        }
      }
    }
    if (e.button === 2) this.rightDown = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightDown = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (this.stage === 'menu' || this.paused) return;
    if (document.pointerLockElement === this.canvas || this.rightDown) {
      const lockedOnTarget = this.lockOn && this.lockTarget();
      if (!lockedOnTarget) this.camYaw -= e.movementX * 0.0026;
      this.camPitch = clamp(this.camPitch + e.movementY * 0.0026, -0.15, 1.15);
    }
  };
  private onCtx = (e: Event) => e.preventDefault();

  private bind() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('contextmenu', this.onCtx);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onCtx);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.clearMatch();
    this.flashEl.remove();
    this.renderer.dispose();
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private setEnv(mode: 'day' | 'night') {
    if (mode === 'day') {
      this.scene.background = new THREE.Color(0x8fd3ff);
      this.scene.fog = new THREE.Fog(0x9fdcff, 120, 420);
      this.hemi.color.setHex(0xcfe8ff);
      this.hemi.groundColor.setHex(0x6a8f4a);
      this.hemi.intensity = 2.0;
      this.sun.color.setHex(0xffffff);
      this.sun.intensity = 2.6;
    } else {
      this.scene.background = new THREE.Color(0x0b0820);
      this.scene.fog = new THREE.Fog(0x140c30, 90, 420);
      this.hemi.color.setHex(0x8f95e0);
      this.hemi.groundColor.setHex(0x3a3550);
      this.hemi.intensity = 1.9;
      this.sun.color.setHex(0xb8c4ff);
      this.sun.intensity = 1.8;
    }
  }

  // ------------------------------------------------------------------ menu
  showMenu() {
    this.clearMatch();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.stage = 'menu';
    this.paused = false;
    this.frozen = false;
    this.menuGroup.visible = true;
    this.island.group.visible = true;
    this.arena.group.visible = false;
    this.cur = this.island;
    this.setEnv('day');
    this.cb.onHud(null);
  }

  setHover(k: PlayableKind | null) {
    this.menuHover = k;
  }

  // ------------------------------------------------------------------ match flow
  start(pk: PlayableKind, rk: PlayableKind) {
    initAudio();
    this.clearMatch();
    this.playerKind = pk;
    this.rivalKind = rk;
    this.menuGroup.visible = false;
    this.stage = 'island';
    this.setEnv('day');
    this.island.group.visible = true;
    this.arena.group.visible = false;
    this.cur = this.island;
    this.level = 1;
    this.xp = 0;
    this.beli = 0;
    this.paused = false;
    this.frozen = false;
    this.fade = false;
    this.countdown = '';

    const p = this.spawn(pk, 'player', true, 0);
    p.pos.set(0, 0, 14);
    p.faceNow(Math.PI);
    this.player = p;
    this.applyLevel();
    p.hp = p.maxHp;
    this.camYaw = Math.PI;
    this.camPitch = 0.35;
    this.camDist = 10;
    this.lockOn = false;

    const spots: [number, number][] = [
      [-14, -10],
      [14, -12],
      [0, -18],
      [-7, -21],
    ];
    this.banditsDown = 0;
    this.banditsTotal = spots.length;
    spots.forEach(([x, z], i) => {
      const b = this.spawn('bandit', 'enemy', false, i);
      b.name = 'Bandit';
      b.maxHp = b.hp = 60;
      b.baseSpeed = BASE_STATS.bandit.speed * rand(0.92, 1.08);
      b.pos.set(x, 0, z);
      b.faceNow(Math.atan2(-x, 14 - z));
      b.ai = this.makeAI('bandit', b);
    });
    this.phase = 'bandits';
    this.quest = { text: 'Defeat the Bandits', progress: 0, goal: this.banditsTotal };
    this.banner('QUEST: BANDIT HUNT', 'Defeat 4 bandits to draw out your rival', 4.5);
    this.last = performance.now();
    this.emitHud(true);
  }

  private makeAI(type: 'bandit' | 'rival', f: Fighter): AI {
    return {
      type,
      active: type === 'bandit',
      think: 0.3,
      mode: 'approach',
      strafe: 1,
      dashCd: 1,
      atkT: 0.8,
      tempo: 1,
      aggr: 0.5,
      dodge: 0.25,
      home: f.pos.clone(),
      aggro: false,
      swing: -1,
    };
  }

  private spawn(kind: Kind, team: Team, isPlayer: boolean, variant: number) {
    const f = new Fighter(kind, team, isPlayer, variant);
    this.entities.add(f.root);
    this.fighters.push(f);
    if (kind !== 'bandit') {
      const defs = SKILLS[kind];
      f.cdMax = defs.map((s) => s.cd);
      f.cd = defs.map(() => 0);
    }
    if (team === 'enemy') this.createLabel(f);
    f.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return f;
  }

  private createLabel(f: Fighter) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:0;top:0;text-align:center;font:700 12px/1 system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;white-space:nowrap;will-change:transform;display:none;';
    const nm = document.createElement('div');
    nm.textContent = f.ai?.type === 'rival' || f.kind !== 'bandit' ? '' : f.name;
    const bar = document.createElement('div');
    bar.style.cssText = 'width:74px;height:8px;background:rgba(0,0,0,.65);border:1px solid #000;margin:3px auto 0;border-radius:2px;overflow:hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:100%;background:linear-gradient(#ff5a5a,#c1121f);';
    bar.appendChild(fill);
    el.appendChild(nm);
    el.appendChild(bar);
    this.overlay.appendChild(el);
    f.label = el;
    f.labelFill = fill;
    (f as Fighter & { labelName?: HTMLElement }).labelName = nm;
  }

  private applyLevel() {
    const p = this.player;
    p.maxHp = BASE_STATS[p.kind].hp + 30 * (this.level - 1);
    p.dmgMult = 1 + 0.07 * (this.level - 1);
    p.maxEnergy = 100 + 5 * (this.level - 1);
  }

  private xpNeed() {
    return 60 + this.level * 40;
  }

  private gainXp(amount: number, beli: number) {
    this.beli += beli;
    if (this.level >= 10) return;
    this.xp += amount;
    while (this.xp >= this.xpNeed() && this.level < 10) {
      this.xp -= this.xpNeed();
      this.level++;
      this.applyLevel();
      const p = this.player;
      if (!p.dead) {
        p.hp = Math.min(p.maxHp, p.hp + 30 + p.maxHp * 0.25);
        p.energy = p.maxEnergy;
      }
      sfx('level');
      this.banner('LEVEL UP!', `Level ${this.level} – more health and damage`, 2.2);
      this.fxPillar(p.pos, 0xffe066, 2, 12, 0.7);
      this.fxRing(p.pos, 0xffe066, 1, 6, 0.6);
    }
  }

  private clearMatch() {
    this.matchId++;
    this.timers = [];
    for (const f of this.fighters) this.removeFighter(f);
    this.fighters = [];
    for (const p of this.projs) this.fxGroup.remove(p.mesh);
    this.projs = [];
    for (const fx of this.fxs) {
      this.fxGroup.remove(fx.obj);
      fx.dispose?.();
    }
    this.fxs = [];
    for (const p of this.parts) this.fxGroup.remove(p.mesh);
    this.parts = [];
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    this.rival = null;
    this.dropping = null;
    this.quest = null;
    this.bannerUntil = 0;
    this.countdown = '';
    this.fade = false;
    this.mouseDown = false;
  }

  private removeFighter(f: Fighter) {
    this.entities.remove(f.root);
    f.label?.remove();
    f.label = null;
    f.dispose();
  }

  banner(text: string, sub = '', dur = 2.5) {
    this.bannerText = text;
    this.bannerSub = sub;
    this.bannerUntil = performance.now() + dur * 1000;
    this.emitHud(true);
  }

  private later(delay: number, fn: () => void) {
    this.after(delay, null, fn);
  }

  /** schedule fn; cancelled if the owner dies / is interrupted (castId changes) */
  after(delay: number, owner: Fighter | null, fn: () => void) {
    this.timers.push({ t: delay, fn, owner, id: owner ? owner.castId : 0, match: this.matchId });
  }

  private spawnRivalOnIsland() {
    const p = this.player;
    const ang = rand(0, Math.PI * 2);
    const r = this.makeRival('island');
    const x = clamp(p.pos.x + Math.cos(ang) * 13, -18, 18);
    const z = clamp(p.pos.z + Math.sin(ang) * 13, -18, 18);
    r.pos.set(x, 26, z);
    r.onGround = false;
    r.vy = -8;
    r.faceNow(Math.atan2(p.pos.x - x, p.pos.z - z));
    this.dropping = r;
    sfx('charge');
    this.banner(`⚠ RIVAL APPEARS: ${r.name.toUpperCase()}`, 'A challenger descends from the sky!', 3.5);
    this.quest = { text: `Defeat your rival ${r.name}`, progress: 0, goal: 1 };
    this.phase = 'rival';
  }

  private makeRival(where: 'island' | 'arena') {
    const r = this.spawn(this.rivalKind, 'enemy', false, 0);
    r.name = BASE_STATS[this.rivalKind].name;
    r.addMarker(0xff3030);
    const ai = this.makeAI('rival', r);
    ai.active = false;
    if (where === 'island') {
      r.maxHp = r.hp = 320;
      r.dmgMult = 0.85;
      ai.tempo = 0.95;
      ai.aggr = 0.45;
      ai.dodge = 0.22;
    } else {
      r.maxHp = r.hp = 540;
      r.dmgMult = 1.05;
      ai.tempo = 1.3;
      ai.aggr = 0.62;
      ai.dodge = 0.42;
    }
    r.baseSpeed = BASE_STATS[this.rivalKind].speed * (where === 'island' ? 0.95 : 1.02);
    r.ai = ai;
    this.rival = r;
    const nm = (r as Fighter & { labelName?: HTMLElement }).labelName;
    if (nm) nm.textContent = 'RIVAL ' + r.name;
    return r;
  }

  private onBanditDown() {
    this.banditsDown++;
    if (this.quest) this.quest.progress = this.banditsDown;
    this.gainXp(38, 30 + Math.floor(Math.random() * 20));
    if (this.banditsDown >= this.banditsTotal && this.phase === 'bandits') {
      this.phase = 'rival';
      this.banner('QUEST COMPLETE!', 'Something powerful approaches…', 2.5);
      this.later(2.8, () => {
        if (this.stage === 'island' && !this.player.dead) this.spawnRivalOnIsland();
      });
    }
  }

  private onRivalDown() {
    if (this.player.dead) return;
    if (this.stage === 'island') {
      this.gainXp(120, 250);
      if (this.quest) this.quest.progress = 1;
      this.banner('RIVAL DEFEATED!', 'Teleporting to the Arena…', 2.4);
      this.later(2.4, () => this.startTeleport());
    } else if (this.stage === 'arena') {
      this.stage = 'over';
      this.gainXp(300, 1000);
      if (this.quest) this.quest.progress = 1;
      this.banner('VICTORY!', `You defeated ${this.rival?.name ?? 'the rival'} in the arena!`, 5);
      this.player.setAnim('victory', 99);
      this.player.invuln = 99;
      sfx('level');
      this.later(3.2, () => this.cb.onEnd('victory'));
    }
  }

  private onPlayerDown() {
    if (this.stage === 'over') return;
    this.stage = 'over';
    this.banner('YOU DIED', 'Your rival proved too strong…', 4);
    this.later(2.8, () => this.cb.onEnd('defeat'));
  }

  private startTeleport() {
    if (this.stage !== 'island' || this.player.dead) return;
    this.stage = 'transition';
    this.frozen = true;
    const p = this.player;
    p.invuln = 999;
    p.moveInput.set(0, 0);
    sfx('charge');
    this.fxPillar(p.pos, 0xbfe8ff, 2.5, 50, 1.4);
    this.fxRing(p.pos, 0xffffff, 1, 9, 1.0);
    this.fxRing(p.pos, 0x8fe3ff, 1, 5, 0.8);
    this.banner('TELEPORTING…', 'Entering the Heavens Arena', 2.2);
    this.later(0.9, () => {
      this.fade = true;
      this.emitHud(true);
    });
    this.later(1.9, () => this.switchToArena());
  }

  private switchToArena() {
    // wipe island combat state but keep player
    const p = this.player;
    for (const f of [...this.fighters]) {
      if (f === p) continue;
      this.removeFighter(f);
    }
    this.fighters = [p];
    this.rival = null;
    this.dropping = null;
    for (const pr of this.projs) this.fxGroup.remove(pr.mesh);
    this.projs = [];
    for (const fx of this.fxs) {
      this.fxGroup.remove(fx.obj);
      fx.dispose?.();
    }
    this.fxs = [];
    for (const pt of this.parts) this.fxGroup.remove(pt.mesh);
    this.parts = [];
    this.timers = [];
    this.matchId++;

    this.island.group.visible = false;
    this.arena.group.visible = true;
    this.cur = this.arena;
    this.setEnv('night');
    this.stage = 'arena';
    this.frozen = true;

    p.castId++;
    p.anim = null;
    p.forced = null;
    p.lock = 0;
    p.stun = 0;
    p.slow = 0;
    p.floatT = 0;
    p.buffT = 0;
    p.speedMult = 1;
    p.buffDmg = 1;
    p.boostT = 0;
    p.dashCd = 0;
    p.cd = p.cd.map(() => 0);
    p.energy = p.maxEnergy;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.6);
    p.pos.set(0, 0, 18);
    p.vy = 0;
    p.faceNow(Math.PI);
    p.invuln = 999;
    this.camYaw = Math.PI;
    this.camPitch = 0.3;
    this.camDist = 11.5;
    this.lockOn = true;

    const r = this.makeRival('arena');
    r.pos.set(0, 0, -18);
    r.faceNow(0);
    r.invuln = 999;
    this.quest = { text: `Win the arena 1v1 vs ${r.name}`, progress: 0, goal: 1 };

    this.banner('THE HEAVENS ARENA', `Final duel: you vs ${r.name}`, 3.2);
    this.later(0.35, () => {
      this.fade = false;
      this.emitHud(true);
    });
    const setCount = (t: string) => {
      this.countdown = t;
      if (t) sfx('ui');
      this.emitHud(true);
    };
    this.later(1.2, () => setCount('3'));
    this.later(2.2, () => setCount('2'));
    this.later(3.2, () => setCount('1'));
    this.later(4.2, () => {
      setCount('FIGHT!');
      sfx('boom');
      this.frozen = false;
      p.invuln = 0.3;
      r.invuln = 0.3;
      if (r.ai) r.ai.active = true;
    });
    this.later(5.2, () => setCount(''));
  }

  // ------------------------------------------------------------------ queries
  target(c: Fighter, maxDist = 60): Fighter | null {
    let best: Fighter | null = null;
    let bd = maxDist;
    for (const f of this.fighters) {
      if (f.dead || f.team === c.team || f.team === 'none') continue;
      const d = Math.hypot(f.pos.x - c.pos.x, f.pos.z - c.pos.z);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  private lockTarget(): Fighter | null {
    if (!this.player || this.player.dead) return null;
    return this.target(this.player, 45);
  }

  faceAim(c: Fighter): THREE.Vector3 {
    const t = this.target(c, c.isPlayer ? 30 : 80);
    let dx: number;
    let dz: number;
    if (t) {
      dx = t.pos.x - c.pos.x;
      dz = t.pos.z - c.pos.z;
    } else if (c.isPlayer && c.moveInput.lengthSq() > 0.01) {
      dx = c.moveInput.x;
      dz = c.moveInput.y;
    } else if (c.isPlayer) {
      dx = Math.sin(this.camYaw);
      dz = Math.cos(this.camYaw);
    } else {
      dx = Math.sin(c.yaw);
      dz = Math.cos(c.yaw);
    }
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    c.faceNow(Math.atan2(dx, dz));
    return new THREE.Vector3(dx, 0, dz);
  }

  clampPos(p: THREE.Vector3) {
    const R = this.cur.radius;
    const d = Math.hypot(p.x, p.z);
    if (d > R) {
      p.x *= R / d;
      p.z *= R / d;
    }
  }

  // ------------------------------------------------------------------ combat
  private canCast(f: Fighter, i: number) {
    if (f.kind === 'bandit' || f.dead || this.frozen || this.paused) return false;
    if (f.lock > 0 || f.stun > 0 || f.cd[i] > 0) return false;
    if (this.stage !== 'island' && this.stage !== 'arena') return false;
    const s = SKILLS[f.kind][i];
    return f.energy >= s.cost;
  }

  castSkill(f: Fighter, i: number): boolean {
    if (!f || !this.canCast(f, i)) return false;
    const s = SKILLS[f.kind as PlayableKind][i];
    f.energy -= s.cost;
    f.cd[i] = s.cd * (f.isPlayer ? 1 : 1.1);
    f.cdMax[i] = f.cd[i];
    f.castId++;
    f.combo = 0;
    f.m1cd = Math.max(f.m1cd, 0.25);
    s.cast(this, f);
    this.notifyThreat(f);
    return true;
  }

  private notifyThreat(caster: Fighter) {
    for (const e of this.fighters) {
      if (!e.ai || e.ai.type !== 'rival' || e.dead || e.team === caster.team || !e.ai.active) continue;
      if (Math.hypot(e.pos.x - caster.pos.x, e.pos.z - caster.pos.z) > 24) continue;
      if (e.ai.dashCd > 0 || Math.random() > e.ai.dodge) continue;
      this.after(rand(0.12, 0.26), e, () => {
        if (e.lock > 0 || e.stun > 0 || e.dashCd > 0 || this.frozen) return;
        const dx = caster.pos.x - e.pos.x;
        const dz = caster.pos.z - e.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        const s = Math.random() < 0.5 ? -1 : 1;
        // mostly sideways, slightly away
        this.dash(e, (-dz / l) * s - (dx / l) * 0.35, (dx / l) * s - (dz / l) * 0.35);
        e.ai!.dashCd = rand(2.0, 3.2);
      });
    }
  }

  basic(f: Fighter): boolean {
    if (f.dead || f.lock > 0 || f.stun > 0 || f.m1cd > 0 || this.frozen || this.paused) return false;
    if (this.stage !== 'island' && this.stage !== 'arena') return false;
    const d = this.faceAim(f);
    const idx = f.combo;
    f.combo = (idx + 1) % 4;
    f.comboT = 0.9;
    const names = ['punchR', 'punchL', 'kick', 'spinkick'];
    const mult = [1, 1, 1.1, 1.6][idx];
    const base = f.kind === 'gon' ? 9.5 : f.kind === 'killua' ? 8.5 : 9;
    f.setAnim(names[idx], 0.26);
    f.m1cd = idx === 3 ? 0.62 : f.kind === 'killua' ? 0.3 : 0.34;
    f.slow = 0.35;
    sfx('swing');
    const t = this.target(f, 8);
    if (t) {
      const dist = Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
      if (dist > 2.4) this.dashF(f, d, Math.min(dist - 2.2, 2.2), 0.12);
    }
    const col = KIND_COLOR[f.kind];
    this.after(0.1, f, () => {
      const finisher = idx === 3;
      this.hitArc(f, 3.7, 0.15, base * mult, { kb: finisher ? 5 : 0.6, stun: finisher ? 0.35 : 0, color: col, heavy: finisher });
    });
    return true;
  }

  private playerDash() {
    const p = this.player;
    if (!p || p.dead || this.frozen || this.stage === 'menu' || this.stage === 'over') return;
    if (p.dashCd > 0 || p.stun > 0 || p.lock > 0 || p.energy < 8) return;
    let dx = p.moveInput.x;
    let dz = p.moveInput.y;
    if (dx * dx + dz * dz < 0.01) {
      const t = this.target(p, 40);
      if (t) {
        dx = p.pos.x - t.pos.x;
        dz = p.pos.z - t.pos.z;
      } else {
        dx = -Math.sin(this.camYaw);
        dz = -Math.cos(this.camYaw);
      }
    }
    p.energy -= 8;
    this.dash(p, dx, dz);
  }

  private dash(f: Fighter, dx: number, dz: number) {
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    f.dashCd = f.isPlayer ? 1.0 : 1.6;
    f.invuln = Math.max(f.invuln, 0.28);
    f.forced = { vx: dx * 32, vz: dz * 32, t: 0.17, T: 0.17, ease: false };
    this.fxAfterimage(f.pos, f.yaw, KIND_COLOR[f.kind] || 0xffffff);
    this.fxBurst(new THREE.Vector3(f.pos.x, 0.5, f.pos.z), 0xffffff, 6, 4, 0.25);
    sfx('dash');
  }

  dashF(c: Fighter, dir: THREE.Vector3, dist: number, T: number) {
    c.forced = { vx: (dir.x * dist) / T, vz: (dir.z * dist) / T, t: T, T, ease: false };
  }

  knock(v: Fighter, dx: number, dz: number, dist: number, T = 0.3) {
    const sp = (2 * dist) / T;
    v.forced = { vx: dx * sp, vz: dz * sp, t: T, T, ease: true };
  }

  damage(att: Fighter, vic: Fighter, amt: number, o: DmgOpts = {}): boolean {
    if (vic.dead || vic.invuln > 0) return false;
    if (this.stage === 'transition' || this.stage === 'menu') return false;
    let a = amt * att.dmgMult * att.buffDmg;
    let crit = false;
    if (!o.noCrit && Math.random() < 0.1) {
      a *= 1.5;
      crit = true;
    }
    a = Math.max(1, Math.round(a));
    vic.hp = Math.max(0, vic.hp - a);
    vic.flashHit();
    let dx = o.dirx ?? vic.pos.x - att.pos.x;
    let dz = o.dirz ?? vic.pos.z - att.pos.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.001) {
      dx = Math.sin(att.yaw);
      dz = Math.cos(att.yaw);
    } else {
      dx /= l;
      dz /= l;
    }
    if (o.kb) this.knock(vic, dx, dz, o.kb, 0.28);
    if (o.stun && vic.stunImmune <= 0 && !vic.dead) {
      vic.stun = o.stun;
      vic.stunImmune = o.stun + 0.9;
      vic.lock = 0;
      vic.castId++;
      vic.anim = null;
      vic.floatT = 0;
      vic.slow = 0;
    }
    if (vic.ai) vic.ai.aggro = true;
    const col = o.color ?? 0xffffff;
    const cp = vic.chestPos();
    this.fxBurst(cp, col, o.heavy ? 14 : 7, o.heavy ? 9 : 6, 0.35);
    this.floater(new THREE.Vector3(cp.x, vic.pos.y + 3.8, cp.z), crit ? `${a}!` : `${a}`, vic.isPlayer ? '#ff5a5a' : crit ? '#ffd23f' : '#ffffff', crit || o.heavy ? 26 : 20);
    sfx(vic.isPlayer ? 'hurt' : o.heavy ? 'heavy' : 'hit');
    if (vic.isPlayer) this.shake(o.heavy ? 0.35 : 0.15);
    else if (att.isPlayer) this.shake(o.heavy ? 0.25 : 0.06);
    if (o.heavy) this.hitStop = Math.max(this.hitStop, 0.07);
    o.onHit?.(vic);
    if (vic.hp <= 0) this.kill(vic);
    return true;
  }

  private kill(v: Fighter) {
    if (v.dead) return;
    v.dead = true;
    v.deathT = 0;
    v.anim = null;
    v.lock = 0;
    v.stun = 0;
    v.forced = null;
    v.floatT = 0;
    v.castId++;
    v.buffT = 0;
    v.boostT = 0;
    if (v.label) v.label.style.display = 'none';
    sfx('death');
    this.fxBurst(v.chestPos(), 0xffffff, 18, 9, 0.5);
    this.hitStop = Math.max(this.hitStop, 0.12);
    if (v === this.player) this.onPlayerDown();
    else if (v.ai?.type === 'bandit') this.onBanditDown();
    else if (v.ai?.type === 'rival') this.onRivalDown();
  }

  hitArc(c: Fighter, range: number, cosHalf: number, dmg: number, o: DmgOpts = {}): number {
    let n = 0;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    for (const v of [...this.fighters]) {
      if (v.team === c.team || v.dead || v.team === 'none') continue;
      const dx = v.pos.x - c.pos.x;
      const dz = v.pos.z - c.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist - v.radius > range) continue;
      if (Math.abs(v.pos.y - c.pos.y) > 4) continue;
      if (dist > 1.0) {
        const dot = (dx * fx + dz * fz) / dist;
        if (dot < cosHalf) continue;
      }
      if (this.damage(c, v, dmg, o)) n++;
    }
    return n;
  }

  hitCircle(center: THREE.Vector3, radius: number, c: Fighter, dmg: number, o: DmgOpts = {}): number {
    let n = 0;
    for (const v of [...this.fighters]) {
      if (v.team === c.team || v.dead || v.team === 'none') continue;
      const dx = v.pos.x - center.x;
      const dz = v.pos.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist - v.radius * 0.5 > radius) continue;
      if (Math.abs(v.pos.y - center.y) > 5) continue;
      if (this.damage(c, v, dmg, { ...o, dirx: dx, dirz: dz })) n++;
    }
    return n;
  }

  shoot(s: ShootOpts) {
    const g = new THREE.Group();
    let spin: THREE.Object3D | null = null;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(sx, sy, sz);
      g.add(m);
      return m;
    };
    if (s.shape === 'orb') {
      add(sphereGeo, basicMat(0xffffff), s.size * 0.55, s.size * 0.55, s.size * 0.55);
      add(sphereGeo, basicMat(s.color), s.size * 1.2, s.size * 1.2, s.size * 1.2);
    } else if (s.shape === 'wave') {
      add(sphereGeo, basicMat(s.color), s.size * 1.5, s.size * 0.9, s.size * 0.4);
      add(sphereGeo, basicMat(0xffffff), s.size * 0.8, s.size * 0.45, s.size * 0.3);
      spin = add(torusGeo, basicMat(0xffffaa), s.size * 1.5, s.size * 1.5, s.size * 1.5);
    } else if (s.shape === 'yoyo') {
      add(sphereGeo, basicMat(s.color, false), s.size, s.size, s.size);
      spin = add(torusGeo, basicMat(0xffffff), s.size * 1.7, s.size * 1.7, s.size * 1.7);
    } else {
      add(sphereGeo, basicMat(0xcccccc, false), s.size, s.size, s.size);
    }
    g.position.copy(s.pos);
    g.lookAt(s.pos.x + s.dir.x, s.pos.y + s.dir.y, s.pos.z + s.dir.z);
    this.fxGroup.add(g);
    this.projs.push({
      mesh: g,
      vel: s.dir.clone().normalize().multiplyScalar(s.speed),
      speed: s.speed,
      radius: s.radius,
      dmg: s.dmg,
      owner: s.owner,
      life: s.life,
      pierce: !!s.pierce,
      hit: new Set(),
      opts: s.opts ?? {},
      color: s.color,
      spin,
      trailT: 0,
    });
  }

  shake(v: number) {
    this.shakeAmt = Math.max(this.shakeAmt, v);
  }

  flash(color: string, alpha: number) {
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = String(alpha);
    void el.offsetWidth;
    el.style.transition = 'opacity .55s ease-out';
    el.style.opacity = '0';
  }

  // ------------------------------------------------------------------ fx
  private addFx(obj: THREE.Object3D, dur: number, update: (p: number) => void, dispose?: () => void) {
    this.fxGroup.add(obj);
    this.fxs.push({ obj, t: 0, dur, update, dispose });
  }

  fxRing(pos: THREE.Vector3, color: number, r0: number, r1: number, dur: number) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.12, pos.z);
    this.addFx(
      mesh,
      dur,
      (p) => {
        const s = r0 + (r1 - r0) * (1 - (1 - p) * (1 - p));
        mesh.scale.set(s, s, s);
        m.opacity = 0.9 * (1 - p);
      },
      () => m.dispose()
    );
  }

  fxBurst(pos: THREE.Vector3, color: number, count: number, speed: number, life: number) {
    for (let i = 0; i < count; i++) {
      if (this.parts.length > 420) break;
      const mesh = new THREE.Mesh(boxGeo, basicMat(color));
      const size = rand(0.12, 0.32);
      mesh.scale.setScalar(size);
      mesh.position.copy(pos);
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1.2), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.35, 1));
      const l = life * rand(0.6, 1.2);
      this.fxGroup.add(mesh);
      this.parts.push({ mesh, vel: v, life: l, max: l, size });
    }
  }

  fxBolt(a: THREE.Vector3, b: THREE.Vector3, color: number, dur: number, width = 0.3) {
    const g = new THREE.Group();
    const n = 9;
    const pts: THREE.Vector3[] = [a.clone()];
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(b, i / n);
      p.x += rand(-1.3, 1.3);
      p.z += rand(-1.3, 1.3);
      pts.push(p);
    }
    pts.push(b.clone());
    const segs: THREE.Mesh[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const m = new THREE.Mesh(boxGeo, basicMat(color));
      m.position.copy(pts[i]).lerp(pts[i + 1], 0.5);
      m.lookAt(pts[i + 1]);
      m.scale.set(width, width, pts[i].distanceTo(pts[i + 1]) + 0.1);
      g.add(m);
      segs.push(m);
    }
    this.addFx(g, dur, (p) => {
      g.visible = Math.random() > 0.15;
      const w = width * (1 - p * 0.7);
      for (const s of segs) {
        s.scale.x = w;
        s.scale.y = w;
      }
    });
  }

  fxPillar(pos: THREE.Vector3, color: number, r: number, h: number, dur: number) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(cylOpenGeo, m);
    mesh.position.set(pos.x, h / 2, pos.z);
    mesh.scale.set(r, h, r);
    this.addFx(
      mesh,
      dur,
      (p) => {
        const s = r * (1 - p * 0.75);
        mesh.scale.set(s, h, s);
        m.opacity = 0.65 * (1 - p);
      },
      () => m.dispose()
    );
  }

  fxTelegraph(pos: THREE.Vector3, radius: number, color: number, dur: number) {
    const g = new THREE.Group();
    const fm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const om = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const fill = new THREE.Mesh(circleGeo, fm);
    const ring = new THREE.Mesh(ringThinGeo, om);
    fill.rotation.x = ring.rotation.x = -Math.PI / 2;
    g.add(fill, ring);
    g.position.set(pos.x, 0.14, pos.z);
    ring.scale.set(radius, radius, radius);
    fill.scale.set(0.01, 0.01, 0.01);
    this.addFx(
      g,
      dur,
      (p) => {
        const s = Math.max(0.01, radius * p);
        fill.scale.set(s, s, s);
        om.opacity = 0.6 + Math.sin(p * 30) * 0.3;
        fm.opacity = 0.18 + p * 0.25;
      },
      () => {
        fm.dispose();
        om.dispose();
      }
    );
  }

  fxAfterimage(pos: THREE.Vector3, yaw: number, color: number) {
    const s = buildSilhouette(color);
    s.position.set(pos.x, pos.y, pos.z);
    s.rotation.y = yaw;
    const m = (s.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    this.addFx(
      s,
      0.45,
      (p) => {
        m.opacity = 0.6 * (1 - p);
      },
      () => m.dispose()
    );
  }

  fxSlash(pos: THREE.Vector3, yaw: number, color: number) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const rz of [0.7, -0.7]) {
      const pl = new THREE.Mesh(planeGeo, m);
      pl.scale.set(7, 0.32, 1);
      pl.rotation.z = rz;
      g.add(pl);
    }
    g.position.set(pos.x + Math.sin(yaw) * 2.4, pos.y + 1.8, pos.z + Math.cos(yaw) * 2.4);
    g.rotation.y = yaw;
    this.addFx(
      g,
      0.28,
      (p) => {
        const s = 0.6 + 0.6 * p;
        g.scale.set(s, s, s);
        m.opacity = 0.95 * (1 - p);
      },
      () => m.dispose()
    );
  }

  fxTether(a: Fighter, b: Fighter, color: number, dur: number) {
    const mesh = new THREE.Mesh(boxGeo, basicMat(color));
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    this.addFx(mesh, dur, () => {
      a.chestPos(va);
      b.chestPos(vb);
      mesh.position.copy(va).lerp(vb, 0.5);
      mesh.lookAt(vb);
      mesh.scale.set(0.12, 0.12, Math.max(0.1, va.distanceTo(vb)));
    });
  }

  fxGiantFist(center: THREE.Vector3, color: number) {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xf6c9a0 });
    const dark = new THREE.MeshLambertMaterial({ color: 0xe0a77c });
    const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const b = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(boxGeo, m);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
    };
    b(5.4, 4.2, 5.4, 0, 3.2, 0, skin);
    for (let i = 0; i < 4; i++) b(1.25, 2.2, 5.2, -2 + i * 1.33, 0.9, 0, dark);
    b(1.6, 2.6, 2.2, 3.1, 2.4, 1.8, skin);
    const aura = new THREE.Mesh(sphereGeo, glow);
    aura.scale.set(5.5, 6.5, 5.5);
    aura.position.y = 3;
    g.add(aura);
    g.position.set(center.x, 30, center.z);
    this.addFx(
      g,
      0.7,
      (p) => {
        const t = p * 0.7;
        g.position.y = t < 0.12 ? 30 - (30 - 0) * (t / 0.12) : 0;
        const s = p > 0.7 ? Math.max(0.01, 1 - (p - 0.7) / 0.3) : 1;
        g.scale.set(s, s, s);
      },
      () => {
        skin.dispose();
        dark.dispose();
        glow.dispose();
      }
    );
  }

  private floater(pos: THREE.Vector3, text: string, color: string, size: number) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;left:0;top:0;font:900 ${size}px system-ui,sans-serif;color:${color};text-shadow:-2px 0 #000,2px 0 #000,0 -2px #000,0 2px #000;will-change:transform;pointer-events:none;`;
    this.overlay.appendChild(el);
    if (this.floaters.length > 40) {
      const old = this.floaters.shift();
      old?.el.remove();
    }
    this.floaters.push({ el, pos: pos.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6))), t: 0 });
  }

  private project(p: THREE.Vector3, out: THREE.Vector3) {
    out.copy(p).project(this.camera);
    return out.z < 1 && out.z > -1;
  }

  // ------------------------------------------------------------------ AI
  private updateBandit(f: Fighter, dt: number) {
    const ai = f.ai!;
    const p = this.player;
    f.moveInput.set(0, 0);
    if (f.dead || p.dead || this.frozen) return;
    ai.atkT -= dt;
    const dx = p.pos.x - f.pos.x;
    const dz = p.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    if (!ai.aggro) {
      if (dist < 17) ai.aggro = true;
      return;
    }
    if (f.lock > 0 || f.stun > 0) return;
    f.targetYaw = Math.atan2(dx, dz);
    if (dist > 2.7) {
      f.moveInput.set(dx / dist, dz / dist);
    } else if (ai.atkT <= 0) {
      f.lock = 0.6;
      f.castId++;
      f.faceNow(Math.atan2(dx, dz));
      f.setAnim('punchR', 0.55);
      sfx('swing');
      this.after(0.4, f, () => {
        this.hitArc(f, 3.4, 0.2, 9, { kb: 1.5, color: 0xffffff });
      });
      ai.atkT = 1.5 + Math.random() * 0.7;
    }
  }

  private updateRival(f: Fighter, dt: number) {
    const ai = f.ai!;
    const p = this.player;
    f.moveInput.set(0, 0);
    if (f.dead) return;
    if (this.dropping === f) {
      f.invuln = Math.max(f.invuln, 0.3);
      if (f.onGround) {
        this.dropping = null;
        const pos = f.pos.clone();
        this.fxRing(pos, 0xffffff, 1, 10, 0.5);
        this.fxBurst(new THREE.Vector3(pos.x, 0.5, pos.z), 0xffffff, 24, 10, 0.5);
        this.shake(0.5);
        sfx('boom');
        this.after(0.7, f, () => {
          ai.active = true;
          f.invuln = 0;
        });
      }
      return;
    }
    if (!ai.active || p.dead || this.frozen) return;

    ai.dashCd -= dt;
    ai.think -= dt;
    ai.atkT -= dt;
    if (f.lock > 0 || f.stun > 0) return;

    const dx = p.pos.x - f.pos.x;
    const dz = p.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist;
    const nz = dz / dist;
    if (!f.forced) f.targetYaw = Math.atan2(dx, dz);

    if (ai.think <= 0) {
      ai.think = rand(0.22, 0.55) / ai.tempo;
      const defs = SKILLS[f.kind as PlayableKind];
      const usable = defs
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => f.cd[i] <= 0 && f.energy >= s.cost && dist >= s.ai[0] && dist <= s.ai[1]);
      if (usable.length && Math.random() < ai.aggr) {
        let pick = usable[Math.floor(Math.random() * usable.length)];
        const ult = usable.find((u) => u.i === 4);
        if (ult && Math.random() < 0.5) pick = ult;
        if (this.castSkill(f, pick.i)) return;
      }
      const r = Math.random();
      if (dist < 3.8) ai.mode = r < 0.62 ? 'melee' : r < 0.82 ? 'strafe' : 'retreat';
      else if (dist < 9) ai.mode = r < 0.55 ? 'approach' : 'strafe';
      else ai.mode = 'approach';
      ai.strafe = Math.random() < 0.5 ? -1 : 1;
      if (ai.dashCd <= 0 && Math.random() < 0.14 * ai.tempo) {
        if (dist > 10) this.dash(f, nx, nz);
        else if (dist < 3.5) this.dash(f, -nz * ai.strafe, nx * ai.strafe);
        ai.dashCd = rand(2.2, 3.4);
      }
    }

    switch (ai.mode) {
      case 'approach':
        if (dist > 2.6) f.moveInput.set(nx, nz);
        break;
      case 'melee':
        if (dist > 2.7) f.moveInput.set(nx, nz);
        break;
      case 'retreat':
        f.moveInput.set(-nx, -nz).multiplyScalar(0.9);
        break;
      case 'strafe': {
        const away = dist < 3.5 ? -0.5 : dist > 7 ? 0.6 : 0;
        f.moveInput.set(-nz * ai.strafe + nx * away, nx * ai.strafe + nz * away);
        if (f.moveInput.lengthSq() > 1) f.moveInput.normalize();
        break;
      }
    }

    if (dist < 3.5 && ai.atkT <= 0) {
      if (this.basic(f)) ai.atkT = rand(0.05, 0.3) / ai.tempo;
    }
  }

  // ------------------------------------------------------------------ player control
  private updatePlayer() {
    const p = this.player;
    p.moveInput.set(0, 0);
    if (p.dead || this.frozen || this.stage === 'over') return;
    let ix = 0;
    let iz = 0;
    if (this.keys.has('KeyW')) iz += 1;
    if (this.keys.has('KeyS')) iz -= 1;
    if (this.keys.has('KeyA')) ix -= 1;
    if (this.keys.has('KeyD')) ix += 1;
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    const rx = -Math.cos(this.camYaw);
    const rz = Math.sin(this.camYaw);
    let dx = fx * iz + rx * ix;
    let dz = fz * iz + rz * ix;
    const l = Math.hypot(dx, dz);
    if (l > 0) {
      dx /= l;
      dz /= l;
    }
    p.moveInput.set(dx, dz);
    const t = this.lockOn ? this.lockTarget() : null;
    if (p.lock <= 0 && p.stun <= 0) {
      if (t) p.targetYaw = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
      else if (l > 0) p.targetYaw = Math.atan2(dx, dz);
    }
    if (this.keys.has('Space') && p.onGround && p.lock <= 0 && p.stun <= 0) {
      p.vy = 12.5;
      p.onGround = false;
      sfx('dash');
    }
    if (this.mouseDown || this.keys.has('KeyJ')) this.basic(p);
  }

  // ------------------------------------------------------------------ simulation
  private moveFighter(f: Fighter, dt: number) {
    let mx = 0;
    let mz = 0;
    const canMove = f.lock <= 0 && f.stun <= 0 && !f.dead && !this.frozen;
    let ix = 0;
    let iz = 0;
    if (canMove) {
      const sp = f.baseSpeed * f.speedMult * (f.slow > 0 ? 0.5 : 1);
      ix = f.moveInput.x * sp;
      iz = f.moveInput.y * sp;
      mx = ix;
      mz = iz;
    }
    f.speedNow = Math.hypot(ix, iz);
    if (f.forced) {
      const k = f.forced.ease ? Math.max(0, f.forced.t / f.forced.T) : 1;
      mx += f.forced.vx * k;
      mz += f.forced.vz * k;
      f.forced.t -= dt;
      if (f.forced.t <= 0) f.forced = null;
    }
    f.pos.x += mx * dt;
    f.pos.z += mz * dt;

    const grav = f.floatT > 0 ? 4 : 34;
    f.vy -= grav * dt;
    if (f.floatT > 0 && f.vy < -3) f.vy = -3;
    f.pos.y += f.vy * dt;
    if (f.pos.y <= 0) {
      f.pos.y = 0;
      f.vy = 0;
      f.onGround = true;
    } else f.onGround = false;

    // bounds & obstacles
    this.clampPos(f.pos);
    for (const o of this.cur.obstacles) {
      const dx = f.pos.x - o.x;
      const dz = f.pos.z - o.z;
      const min = o.r + f.radius * 0.8;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001;
        f.pos.x = o.x + (dx / d) * min;
        f.pos.z = o.z + (dz / d) * min;
      }
    }

    // regen
    if (!f.dead && f.kind !== 'bandit') {
      f.energy = Math.min(f.maxEnergy, f.energy + (f.isPlayer ? 9 : 7) * dt);
    }
  }

  private separate() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      for (let j = i + 1; j < fs.length; j++) {
        const a = fs[i];
        const b = fs[j];
        if (a.dead || b.dead) continue;
        if (Math.abs(a.pos.y - b.pos.y) > 2.5) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = (a.radius + b.radius) * 0.95;
        if (d < min) {
          let nx: number;
          let nz: number;
          if (d < 0.001) {
            const ang = Math.random() * Math.PI * 2;
            nx = Math.cos(ang);
            nz = Math.sin(ang);
          } else {
            nx = dx / d;
            nz = dz / d;
          }
          const push = (min - d) / 2;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
          this.clampPos(a.pos);
          this.clampPos(b.pos);
        }
      }
    }
  }

  private updateProjectiles(dt: number) {
    const keep: Proj[] = [];
    for (const pr of this.projs) {
      pr.life -= dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      if (pr.spin) pr.spin.rotation.z += dt * 18;
      pr.trailT -= dt;
      if (pr.trailT <= 0) {
        pr.trailT = 0.04;
        this.fxBurst(pr.mesh.position, pr.color, 1, 1.5, 0.25);
      }
      let dead = pr.life <= 0;
      if (!dead) {
        const pos = pr.mesh.position;
        if (Math.hypot(pos.x, pos.z) > this.cur.radius + 10) dead = true;
        for (const v of [...this.fighters]) {
          if (dead && !pr.pierce) break;
          if (v.dead || v.team === pr.owner.team || v.team === 'none' || pr.hit.has(v)) continue;
          if (Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) > pr.radius + v.radius) continue;
          if (pos.y < v.pos.y - 0.5 || pos.y > v.pos.y + 4.2) continue;
          if (v.invuln > 0) continue; // dash i-frames let you slip through
          pr.hit.add(v);
          const sp = pr.vel.length() || 1;
          this.damage(pr.owner, v, pr.dmg, { ...pr.opts, dirx: pr.vel.x / sp, dirz: pr.vel.z / sp });
          this.fxRing(new THREE.Vector3(pos.x, 0, pos.z), pr.color, 0.5, 3, 0.25);
          if (!pr.pierce) {
            dead = true;
            break;
          }
        }
      }
      if (dead) this.fxGroup.remove(pr.mesh);
      else keep.push(pr);
    }
    this.projs = keep;
  }

  private updateFx(dt: number) {
    const keep: Fx[] = [];
    for (const fx of this.fxs) {
      fx.t += dt;
      const p = Math.min(1, fx.t / fx.dur);
      fx.update(p);
      if (fx.t >= fx.dur) {
        this.fxGroup.remove(fx.obj);
        fx.dispose?.();
      } else keep.push(fx);
    }
    this.fxs = keep;
    const pk: Part[] = [];
    for (const pt of this.parts) {
      pt.life -= dt;
      if (pt.life <= 0) {
        this.fxGroup.remove(pt.mesh);
        continue;
      }
      pt.vel.y -= 14 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.mesh.position.y < 0.05) {
        pt.mesh.position.y = 0.05;
        pt.vel.y *= -0.3;
      }
      pt.mesh.scale.setScalar(pt.size * (pt.life / pt.max));
      pk.push(pt);
    }
    this.parts = pk;
  }

  private processTimers(dt: number) {
    if (!this.timers.length) return;
    const due: Timer[] = [];
    const rest: Timer[] = [];
    for (const tm of this.timers) {
      tm.t -= dt;
      (tm.t <= 0 ? due : rest).push(tm);
    }
    this.timers = rest;
    for (const tm of due) {
      if (tm.match !== this.matchId) continue;
      if (tm.owner && (tm.owner.dead || tm.owner.castId !== tm.id)) continue;
      tm.fn();
    }
  }

  private updateCamera(dt: number, real: number) {
    const p = this.player;
    // manual rotation keys
    const rot = (this.keys.has('KeyQ') || this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('KeyE') || this.keys.has('ArrowRight') ? 1 : 0);
    const t = this.lockOn ? this.lockTarget() : null;
    if (t && !p.dead) {
      const want = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
      this.camYaw += angleDiff(want, this.camYaw) * Math.min(1, real * 7);
    } else if (rot) this.camYaw += rot * 2.2 * real;
    if (this.keys.has('ArrowUp')) this.camPitch = clamp(this.camPitch - real * 1.2, -0.15, 1.15);
    if (this.keys.has('ArrowDown')) this.camPitch = clamp(this.camPitch + real * 1.2, -0.15, 1.15);
    void dt;

    const pivot = new THREE.Vector3(p.pos.x, p.pos.y + 2.7, p.pos.z);
    const cp = Math.cos(this.camPitch);
    const cam = new THREE.Vector3(
      pivot.x - Math.sin(this.camYaw) * cp * this.camDist,
      pivot.y + Math.sin(this.camPitch) * this.camDist,
      pivot.z - Math.cos(this.camYaw) * cp * this.camDist
    );
    cam.y = Math.max(cam.y, 0.8);
    if (this.shakeAmt > 0.001) {
      cam.x += rand(-1, 1) * this.shakeAmt;
      cam.y += rand(-1, 1) * this.shakeAmt;
      cam.z += rand(-1, 1) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-9 * real);
    }
    this.camera.position.copy(cam);
    this.camera.lookAt(pivot);
    this.camera.updateMatrixWorld();
  }

  private updateOverlays(real: number) {
    const v = new THREE.Vector3();
    // labels
    for (const f of this.fighters) {
      if (!f.label) continue;
      const head = new THREE.Vector3(f.pos.x, f.pos.y + 4.3, f.pos.z);
      const dist = this.camera.position.distanceTo(head);
      if (f.dead || dist > 55 || !this.project(head, v) || this.stage === 'menu') {
        f.label.style.display = 'none';
        continue;
      }
      f.label.style.display = 'block';
      const x = (v.x * 0.5 + 0.5) * this.w;
      const y = (-v.y * 0.5 + 0.5) * this.h;
      f.label.style.transform = `translate(${x - 38}px,${y - 24}px)`;
      if (f.labelFill) f.labelFill.style.width = `${(f.hp / f.maxHp) * 100}%`;
    }
    // floaters
    const keep: Floater[] = [];
    for (const fl of this.floaters) {
      fl.t += real;
      if (fl.t > 0.9) {
        fl.el.remove();
        continue;
      }
      const p = fl.pos.clone();
      p.y += fl.t * 2.2;
      if (this.project(p, v)) {
        const x = (v.x * 0.5 + 0.5) * this.w;
        const y = (-v.y * 0.5 + 0.5) * this.h;
        fl.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${1 + Math.max(0, 0.25 - fl.t) * 2})`;
        fl.el.style.opacity = String(Math.min(1, (0.9 - fl.t) * 3));
        fl.el.style.display = 'block';
      } else fl.el.style.display = 'none';
      keep.push(fl);
    }
    this.floaters = keep;
  }

  private emitHud(_force = false) {
    void _force;
    if (this.stage === 'menu' || !this.player) return;
    const p = this.player;
    const defs = SKILLS[this.playerKind];
    const now = performance.now();
    const r = this.rival && !this.rival.dead ? this.rival : null;
    this.cb.onHud({
      stage: this.stage,
      kind: this.playerKind,
      name: p.name,
      level: this.level,
      xp: this.xp,
      xpNeed: this.xpNeed(),
      beli: this.beli,
      hp: Math.max(0, p.hp),
      maxHp: p.maxHp,
      energy: p.energy,
      maxEnergy: p.maxEnergy,
      skills: defs.map((s, i) => ({ key: s.key, name: s.name, desc: s.desc, cost: s.cost, cd: p.cd[i], cdMax: p.cdMax[i] })),
      dashCd: p.dashCd,
      rival: r ? { name: r.name, hp: r.hp, maxHp: r.maxHp } : null,
      quest: this.quest ? { ...this.quest } : null,
      banner: now < this.bannerUntil ? this.bannerText : '',
      sub: now < this.bannerUntil ? this.bannerSub : '',
      countdown: this.countdown,
      lockOn: this.lockOn,
      fade: this.fade,
      paused: this.paused,
      locked: document.pointerLockElement === this.canvas,
      buff: p.buffT > 0,
    });
  }

  // ------------------------------------------------------------------ main loop
  private frame(real: number) {
    this.time += real;
    if (this.stage === 'menu') {
      this.frameMenu(real);
      return;
    }
    if (!this.paused) {
      let dt = real;
      if (this.hitStop > 0) {
        this.hitStop -= real;
        dt *= 0.12;
      }
      this.simulate(dt, real);
    }
    this.updateCamera(0, real);
    this.sun.position.set(this.player.pos.x + 30, 60, this.player.pos.z + 20);
    this.sun.target.position.copy(this.player.pos);
    this.updateOverlays(real);
    this.hudT -= real;
    if (this.hudT <= 0) {
      this.hudT = 0.066;
      this.emitHud();
    }
    this.renderer.render(this.scene, this.camera);
  }

  private simulate(dt: number, real: number) {
    this.processTimers(dt);
    this.updatePlayer();
    for (const f of this.fighters) {
      if (f.ai?.type === 'bandit') this.updateBandit(f, dt);
      else if (f.ai?.type === 'rival') this.updateRival(f, dt);
    }
    for (const f of [...this.fighters]) {
      f.tick(dt);
      this.moveFighter(f, dt);
    }
    this.separate();
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.cur.update(real, this.time);
    for (const f of [...this.fighters]) {
      f.updatePose(dt, this.time);
      if (f.dead && !f.isPlayer && f.ai?.type === 'bandit') {
        if (f.deathT > 1.0) f.root.position.y = -(f.deathT - 1.0) * 3;
        if (f.deathT > 1.6) {
          this.removeFighter(f);
          this.fighters = this.fighters.filter((x) => x !== f);
        }
      }
    }
  }

  private frameMenu(real: number) {
    const t = this.time;
    for (const k of ['killua', 'gon'] as PlayableKind[]) {
      const f = this.menuF[k];
      const hover = this.menuHover === k;
      f.tick(real);
      f.boostT = hover ? 1 : 0;
      f.boostColor = KIND_COLOR[k];
      const base = k === 'killua' ? 0.25 : -0.25;
      f.targetYaw = hover ? 0 : base + Math.sin(t * 0.7 + (k === 'gon' ? 2 : 0)) * 0.15;
      if (hover && !f.anim && Math.random() < 0.02) f.setAnim(['punchR', 'punchL', 'cast'][Math.floor(Math.random() * 3)], 0.5);
      const s = hover ? 1.1 : 1;
      f.root.scale.lerp(new THREE.Vector3(s, s, s), Math.min(1, real * 8));
      f.updatePose(real, t);
    }
    this.cur.update(real, t);
    this.camera.position.set(0, 3.6, 12.2);
    this.camera.lookAt(0, 1.0, 0);
    this.sun.position.set(18, 40, 25);
    this.sun.target.position.set(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
