import * as THREE from 'three';
import { Fighter, BANDIT, type Team, type AI, type Form } from './Fighter';
import { buildSilhouette } from './models';
import { buildIsland, buildArena, ARENA_COUNT, type World, type Env } from './world';
import { FX } from './fx';
import { CHARS } from './chars';
import { ALL_KINDS, type PlayableKind, type Kind, type DmgOpts, type M1Step, type SkillDef, type CharDef } from './defs';
import { sfx, initAudio, setMusic } from './audio';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type { PlayableKind };
export type Stage = 'menu' | 'island' | 'transition' | 'arena' | 'over';

export interface HudSkill {
  key: string;
  name: string;
  desc: string;
  cost: number;
  cd: number;
  cdMax: number;
  charging: boolean;
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
  meter: { name: string; color: string; value: number; max: number };
  form: { name: string; t: number; max: number; kind: string } | null;
  skills: HudSkill[];
  dashCd: number;
  dashMax: number;
  rival: { name: string; hp: number; maxHp: number; form: string } | null;
  quest: { text: string; progress: number; goal: number } | null;
  banner: string;
  sub: string;
  countdown: string;
  shiftLock: boolean;
  fade: boolean;
  paused: boolean;
  locked: boolean;
  needLock: boolean;
  charge: number;
  mapName: string;
  sens: number;
  hint: string;
}

export interface GameCallbacks {
  onHud: (s: HudState | null) => void;
  onEnd: (r: 'victory' | 'defeat') => void;
}

export interface Aim {
  dir: THREE.Vector3;
  flat: THREE.Vector3;
  yaw: number;
  point: THREE.Vector3;
  ground: THREE.Vector3;
  dist: number;
  target: Fighter | null;
}

export type ProjShape = 'orb' | 'wave' | 'fist' | 'card' | 'bullet' | 'knife' | 'smoke' | 'page' | 'hook' | 'case' | 'wisp';

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
  shape: ProjShape;
  pierce?: boolean;
  grav?: number;
  homing?: { target: Fighter; rate: number };
  boomerang?: boolean;
  noGround?: boolean;
  opts?: DmgOpts;
  onHit?: (v: Fighter, pos: THREE.Vector3) => void;
  onEnd?: (pos: THREE.Vector3, why: 'life' | 'hit' | 'ground') => void;
}

interface Proj {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  speed: number;
  s: ShootOpts;
  life: number;
  maxLife: number;
  hit: Set<Fighter>;
  spin: THREE.Object3D | null;
  trailT: number;
  returned: boolean;
}

export interface Zone {
  pos: THREE.Vector3;
  r: number;
  t: number;
  owner: Fighter;
  accum: number;
  tick?: (g: Game, z: Zone, dt: number) => void;
  onEnd?: (g: Game, z: Zone) => void;
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
interface Trail {
  f: Fighter;
  which: 1 | 2 | 3;
  color: number;
  t: number;
  width: number;
  prev: THREE.Vector3 | null;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
const torusGeo = new THREE.TorusGeometry(1, 0.22, 6, 14);
const matCache = new Map<string, THREE.MeshBasicMaterial>();
function basicMat(color: number, additive = true) {
  const key = color + (additive ? 'a' : 'n');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, transparent: additive, depthWrite: !additive });
    if (additive) m.color.multiplyScalar(1.8);
    matCache.set(key, m);
  }
  return m;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const KIND_COLOR = (k: Kind) => (k === 'bandit' ? 0xffffff : CHARS[k].color);
const SKILL_KEYS = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyF'];
const JUMP_V = 18;
const JUMP_HOLD_MAX = 0.32;
const JUMP_HOLD_DRAIN = 40;

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
  private arena: World | null = null;
  private cur: World;
  private entities = new THREE.Group();
  fx = new FX();
  private menuGroup = new THREE.Group();
  private menuF: Record<PlayableKind, Fighter>;
  private menuHover: PlayableKind = 'gon';
  private flashEl: HTMLDivElement;
  private cursorEl: HTMLDivElement;
  private arrowEl: HTMLElement;
  private crossEl: HTMLElement;

  stage: Stage = 'menu';
  fighters: Fighter[] = [];
  player!: Fighter;
  rival: Fighter | null = null;
  private playerKind: PlayableKind = 'gon';
  private rivalKind: PlayableKind = 'killua';
  private projs: Proj[] = [];
  private zones: Zone[] = [];
  private trails: Trail[] = [];
  private timers: Timer[] = [];
  private floaters: Floater[] = [];
  private matchId = 0;

  private keys = new Set<string>();
  private mouseDown = false;
  private rightDown = false;
  private clickBuf = 0;
  private holdT = 0;
  private camYaw = Math.PI;
  private camPitch = 0.35;
    private camDist = 12;
  private camDistNow = 12;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private menuPtr = new THREE.Vector2(0, 0);
  private menuSpin = 0;
  private menuDrag = false;
  private menuDragX = 0;
  private menuMoved = 0;
  private menuPulse = 0;
  get cameraYaw() {
    return this.camYaw + Math.PI;
  }
  private camShift = 0;
  private shiftLock = false;
  private cursor = new THREE.Vector2(0, 0);
  private sens = 1;
  private locked = false;
  private hadLock = false;
  private fallback = false;
  private needLock = false;
  private pendingBanner = false;
  private fovKick = 0;
  private shakeAmt = 0;
  private hitStop = 0;
  private paused = false;
  private frozen = false;
  time = 0;
  private hudT = 0;
  private last = 0;
  private raf = 0;
  private w = 1;
  private h = 1;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private pAim: Aim = { dir: new THREE.Vector3(0, 0, 1), flat: new THREE.Vector3(0, 0, 1), yaw: 0, point: new THREE.Vector3(), ground: new THREE.Vector3(), dist: 10, target: null };

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
  private lastArena = -1;
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
        this.fx.camera = this.camera;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.6, 1.5);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a8f4a, 2.0);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -48;
    sc.right = 48;
    sc.top = 48;
    sc.bottom = -48;
    sc.near = 1;
    sc.far = 220;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.island = buildIsland();
    this.cur = this.island;
    this.scene.add(this.island.group, this.entities, this.fx.group, this.menuGroup);

    try {
      const s = parseFloat(localStorage.getItem('nenbrawl.sens') || '1');
      if (s > 0.1 && s < 5) this.sens = s;
    } catch { /* ignore */ }

    // menu showcase (one pod, swaps character on hover)
    this.menuF = {} as Record<PlayableKind, Fighter>;
    const pm = new THREE.MeshLambertMaterial({ color: 0x3b3f58 });
    const gm = new THREE.MeshLambertMaterial({ color: 0xd4a94a });
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.6, 28), pm);
    pod.position.set(3.2, 0.3, 0);
    pod.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 6, 36), gm);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(3.2, 0.62, 0);
    this.menuGroup.add(pod, rim);
    for (const k of ALL_KINDS) {
      const f = new Fighter(k, 'none', false, 0, CHARS[k]);
      CHARS[k].onSpawn?.(this, f);
      f.pos.set(3.2, 0.6, 0);
      f.faceNow(-0.3);
      f.root.visible = false;
      f.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      this.menuGroup.add(f.root);
      this.menuF[k] = f;
    }

    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none;';
    overlay.appendChild(this.flashEl);

    this.cursorEl = document.createElement('div');
    this.cursorEl.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none;will-change:transform;z-index:30;';
    this.cursorEl.innerHTML =
      '<svg id="nb-arrow" width="26" height="30" viewBox="0 0 26 30" style="position:absolute;left:0;top:0;filter:drop-shadow(0 2px 2px rgba(0,0,0,.8))"><path d="M1 1 L1 22 L7 17 L11 27 L15 25.5 L11 16 L19 16 Z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      '<div id="nb-cross" style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;display:none;"><div style="position:absolute;inset:4px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px #000,inset 0 0 3px #000;"></div><div style="position:absolute;left:12px;top:12px;width:4px;height:4px;background:#fff;border-radius:50%;box-shadow:0 0 3px #000;"></div></div>';
    overlay.appendChild(this.cursorEl);
    this.arrowEl = this.cursorEl.querySelector('#nb-arrow') as HTMLElement;
    this.crossEl = this.cursorEl.querySelector('#nb-cross') as HTMLElement;

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

  // ------------------------------------------------------------------ input
  private onResize = () => this.resize();
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.stage === 'menu') return;
    const c = e.code;
    if (['Space', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(c)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(c);
    initAudio();
    if (c === 'Escape' || c === 'KeyP') {
      if (c === 'Escape' && this.locked) return; // browser releases the lock; handled in lock change
      if (this.needLock) return;
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused) return;
    const idx = SKILL_KEYS.indexOf(c);
    if (idx >= 0) this.tryCast(this.player, idx);
    else if (c === 'KeyQ') this.playerDash();
    else if (c === 'ShiftLeft' || c === 'ShiftRight') {
      this.shiftLock = !this.shiftLock;
      if (this.shiftLock) this.cursor.set(this.w / 2, this.h / 2);
      sfx('ui');
    } else if (c === 'Space') {
      this.player.jumpBuf = 0.14;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    const idx = SKILL_KEYS.indexOf(e.code);
    if (idx >= 0 && this.player && this.player.charging && this.player.charging.i === idx) this.releaseCharge(this.player);
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
    this.rightDown = false;
    if (this.player?.charging) this.releaseCharge(this.player);
  };
    private onMouseDown = (e: MouseEvent) => {
    if (this.stage === 'menu') {
      this.menuDown(e);
      return;
    }
    initAudio();
    if (this.needLock) {
      this.resume();
      return;
    }
    if (!this.locked && !this.fallback && !this.paused) this.requestLock();
    if (this.paused) return;
    if (e.button === 0) {
      this.mouseDown = true;
      this.clickBuf = 0.25;
    }
    if (e.button === 2) this.rightDown = true;
  };
    private onMouseUp = (e: MouseEvent) => {
    if (this.stage === 'menu') {
      if (this.menuDrag && this.menuMoved < 6) this.menuAttack();
      this.menuDrag = false;
      return;
    }
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightDown = false;
  };
    private onMouseMove = (e: MouseEvent) => {
    if (this.stage === 'menu') {
      this.menuMove(e);
      return;
    }
    if (this.paused) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    if (this.shiftLock || this.rightDown) {
      this.camYaw -= dx * 0.0026 * this.sens;
      this.camPitch = clamp(this.camPitch + dy * 0.0026 * this.sens, -1.45, 1.45);
    } else {
      this.cursor.x = clamp(this.cursor.x + dx * this.sens, 0, this.w);
      this.cursor.y = clamp(this.cursor.y + dy * this.sens, 0, this.h);
    }
  };
  private onWheel = (e: WheelEvent) => {
    if (this.stage === 'menu' || this.paused) return;
    this.camDist = clamp(this.camDist * Math.exp(e.deltaY * 0.0014), 3.2, 40);
  };
  private onCtx = (e: Event) => e.preventDefault();
  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) {
      this.hadLock = true;
      this.fallback = false;
    } else if (this.hadLock && this.stage !== 'menu' && this.stage !== 'over' && !this.needLock) {
      this.setPaused(true);
    }
  };
  private onLockError = () => {
    this.fallback = true;
    if (this.needLock) this.resume(true);
  };

  private bind() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onCtx);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
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
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onCtx);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.clearMatch();
    this.flashEl.remove();
    this.cursorEl.remove();
    this.renderer.dispose();
  }

  private requestLock() {
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => { this.fallback = true; });
    } catch {
      this.fallback = true;
    }
    window.setTimeout(() => {
      if (!this.locked && !this.disposed && this.stage !== 'menu') this.fallback = true;
    }, 500);
  }

  private setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    this.mouseDown = false;
    this.rightDown = false;
    if (this.player?.charging) this.releaseCharge(this.player);
    if (p && this.locked) document.exitPointerLock();
    this.emitHud();
  }

  /** called from the UI (user gesture) to start / resume */
  resume(fromError = false) {
    if (!fromError) this.requestLock();
    this.needLock = false;
    this.paused = false;
    this.last = performance.now();
    if (this.pendingBanner) {
      this.pendingBanner = false;
      this.banner('QUEST: BANDIT HUNT', 'Defeat 4 bandits — then your rival awaits', 4.5);
    }
    this.cursor.set(this.w / 2, this.h / 2);
    this.emitHud(true);
  }
  pause() {
    this.setPaused(true);
  }
  setSens(v: number) {
    this.sens = clamp(v, 0.15, 4);
    try { localStorage.setItem('nenbrawl.sens', String(this.sens)); } catch { /* ignore */ }
  }
  getSens() {
    return this.sens;
  }
  keyDown(code: string) {
    return this.keys.has(code);
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.w = w;
    this.h = h;
        this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cursor.set(clamp(this.cursor.x || w / 2, 0, w), clamp(this.cursor.y || h / 2, 0, h));
  }

  private setEnv(e: Env) {
    this.scene.background = new THREE.Color(e.sky);
    this.scene.fog = new THREE.Fog(e.fog, e.fogN, e.fogF);
    this.hemi.color.setHex(e.hemiS);
    this.hemi.groundColor.setHex(e.hemiG);
    this.hemi.intensity = e.hemiI;
    this.sun.color.setHex(e.sunC);
    this.sun.intensity = e.sunI;
  }

  // ------------------------------------------------------------------ menu
    showMenu() {
    setMusic('menu');
    this.clearMatch();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.hadLock = false;
    this.stage = 'menu';
    this.paused = false;
    this.needLock = false;
    this.frozen = false;
    this.shiftLock = false;
    this.menuGroup.visible = true;
    this.island.group.visible = true;
    if (this.arena) this.arena.group.visible = false;
    this.cur = this.island;
    this.setEnv(this.island.env);
    this.cursorEl.style.display = 'none';
    this.cb.onHud(null);
  }

    private menuMove(e: MouseEvent) {
    this.menuPtr.set((e.clientX / this.w) * 2 - 1, (e.clientY / this.h) * 2 - 1);
    if (this.menuDrag) {
      const dx = e.clientX - this.menuDragX;
      this.menuDragX = e.clientX;
      this.menuSpin += dx * 0.012;
      this.menuMoved += Math.abs(dx);
    }
  }
  private menuDown(e: MouseEvent) {
    initAudio();
    setMusic('menu');
    this.menuDrag = true;
    this.menuDragX = e.clientX;
    this.menuMoved = 0;
  }
  private menuAttack() {
    this.previewSkill(this.menuHover, Math.floor(Math.random() * 5));
  }
  /** menu showcase: play a stylised version of a skill on the display pod */
  previewSkill(k: PlayableKind, i: number) {
    initAudio();
    setMusic('menu');
    this.menuHover = k;
    const f = this.menuF[k];
    const d = CHARS[k];
    const col = d.color;
    const anims = ['castFwd', d.m1.steps[Math.min(2, d.m1.steps.length - 1)].anim, 'slamR', 'summon', 'leap'];
    f.setAnim(anims[i] ?? 'castFwd', 0.8);
    const p = new THREE.Vector3(3.2, 0.6, 0);
    const c = p.clone().setY(2.6);
    const fw = new THREE.Vector3(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    sfx((['zap', 'slash', 'boom', 'charge', 'dash'] as const)[i] ?? 'swing');
    this.fx.shockwave(p, col, 3.5 + i * 0.8, 0.5);
    this.fx.impact(c.clone().addScaledVector(fw, 1.8), col, 1.3 + i * 0.25, fw);
    this.fx.slashX(c.clone().addScaledVector(fw, 1.4), fw, col, 3.6, 0.3);
    this.fx.burst(c, col, 20, 8, 0.5);
    if (i === 3) {
      this.fx.beamColumn(p, col, 2.2, 18, 1.2);
      this.flash('#ffffff', 0.15);
    }
    if (i === 4) f.vy = 0;
    this.menuPulse = 1;
  }
  setHover(k: PlayableKind | null) {
    if (k) this.menuHover = k;
  }

  // ------------------------------------------------------------------ match flow
    start(pk: PlayableKind, rk: PlayableKind) {
    initAudio();
    setMusic('island');
    this.clearMatch();
    this.playerKind = pk;
    this.rivalKind = rk;
    this.menuGroup.visible = false;
    this.stage = 'island';
    this.setEnv(this.island.env);
    this.island.group.visible = true;
    if (this.arena) this.arena.group.visible = false;
    this.cur = this.island;
    this.level = 1;
    this.xp = 0;
    this.beli = 0;
    this.frozen = false;
    this.fade = false;
    this.countdown = '';
    this.shiftLock = false;

    const p = this.spawn(pk, 'player', true, 0);
    p.pos.set(0, 0, 14);
    p.faceNow(Math.PI);
    this.player = p;
    this.applyLevel();
    p.hp = p.maxHp;
    this.camYaw = Math.PI;
        this.camPitch = 0.35;
    this.camDist = 12;
    this.camDistNow = 12;

    const spots: [number, number][] = [[-14, -10], [14, -12], [0, -18], [-7, -21]];
    this.banditsDown = 0;
    this.banditsTotal = spots.length;
    spots.forEach(([x, z], i) => {
      const b = this.spawn('bandit', 'enemy', false, i);
      b.name = 'Bandit';
      b.maxHp = b.hp = 60;
      b.baseSpeed = BANDIT.speed * rand(0.92, 1.08);
      b.pos.set(x, 0, z);
      b.faceNow(Math.atan2(-x, 14 - z));
      b.ai = this.makeAI('bandit', b);
    });
    this.quest = { text: 'Defeat the Bandits', progress: 0, goal: this.banditsTotal };
    // wait for the player to click (pointer lock needs a user gesture)
    this.paused = true;
    this.needLock = true;
    this.pendingBanner = true;
    this.cursor.set(this.w / 2, this.h / 2);
    this.last = performance.now();
    this.emitHud(true);
  }

  private makeAI(type: 'bandit' | 'rival', f: Fighter): AI {
    return {
      type, active: type === 'bandit', think: 0.3, mode: 'approach', strafe: 1, dashCd: 1, atkT: 0.8, tempo: 1, aggr: 0.5, dodge: 0.25,
      home: f.pos.clone(), aggro: false, swing: -1, jumpT: rand(2, 5), holdFor: 0.5,
    };
  }

  private spawn(kind: Kind, team: Team, isPlayer: boolean, variant: number) {
    const def = kind === 'bandit' ? null : CHARS[kind];
    const f = new Fighter(kind, team, isPlayer, variant, def);
    this.entities.add(f.root);
    this.fighters.push(f);
    if (def) {
      f.cdMax = def.skills.map((s) => s.cd);
      f.cdFMax = (def.formSkills ?? def.skills).map((s) => s.cd);
      f.energy = 50;
      def.onSpawn?.(this, f);
    }
    if (team === 'enemy') this.createLabel(f);
    f.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    return f;
  }

  private createLabel(f: Fighter) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:0;top:0;text-align:center;font:700 12px/1 system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;white-space:nowrap;will-change:transform;display:none;';
    const nm = document.createElement('div');
    nm.textContent = f.kind === 'bandit' ? f.name : '';
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
    f.labelName = nm;
  }

  private applyLevel() {
    const p = this.player;
    p.maxHp = CHARS[this.playerKind].hp + 30 * (this.level - 1);
    p.dmgMult = 1 + 0.06 * (this.level - 1);
    p.maxEnergy = 100;
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
      this.fx.pillar(p.pos, 0xffe066, 2, 12, 0.7);
      this.fx.ring(p.pos, 0xffe066, 1, 6, 0.6);
    }
  }

  private clearMatch() {
    this.matchId++;
    this.timers = [];
    for (const f of this.fighters) this.removeFighter(f);
    this.fighters = [];
    for (const p of this.projs) this.fx.group.remove(p.mesh);
    this.projs = [];
    for (const z of this.zones) z.onEnd?.(this, z);
    this.zones = [];
    this.trails = [];
    this.fx.clear();
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    this.rival = null;
    this.quest = null;
    this.bannerUntil = 0;
    this.countdown = '';
    this.fade = false;
    this.mouseDown = false;
    this.rightDown = false;
    this.paused = false;
    this.needLock = false;
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

  later(delay: number, fn: () => void) {
    this.after(delay, null, fn);
  }
  /** schedule fn; cancelled if the owner dies / is interrupted (castId changes) */
  after(delay: number, owner: Fighter | null, fn: () => void) {
    this.timers.push({ t: delay, fn, owner, id: owner ? owner.castId : 0, match: this.matchId });
  }

  private makeRival() {
    const kind = this.rivalKind;
    const def = CHARS[kind];
    const r = this.spawn(kind, 'enemy', false, 0);
    r.name = def.name;
    r.addMarker(0xff3030);
    const ai = this.makeAI('rival', r);
    ai.active = false;
    ai.tempo = 1.15;
    ai.aggr = 0.6;
    ai.dodge = 0.34;
    r.maxHp = r.hp = Math.round(def.hp * 1.25);
    r.dmgMult = 1.0;
    r.baseSpeed = def.speed * 1.0;
    r.ai = ai;
    this.rival = r;
    if (r.labelName) r.labelName.textContent = 'RIVAL ' + r.name;
    return r;
  }

  private onBanditDown() {
    this.banditsDown++;
    if (this.quest) this.quest.progress = this.banditsDown;
    this.gainXp(38, 30 + Math.floor(Math.random() * 20));
    if (this.banditsDown >= this.banditsTotal && this.stage === 'island') {
      this.banner('QUEST COMPLETE!', 'Your rival is waiting — straight to the arena!', 2.4);
      this.later(2.4, () => {
        if (this.stage === 'island' && !this.player.dead) this.startTeleport();
      });
    }
  }

  private onRivalDown() {
    if (this.player.dead || this.stage !== 'arena') return;
        this.stage = 'over';
    setMusic('victory');
    this.gainXp(300, 1000);
    if (this.quest) this.quest.progress = 1;
    this.banner('VICTORY!', `You defeated ${this.rival?.name ?? 'the rival'}!`, 5);
    this.player.setAnim('victory', 99);
    this.player.invuln = 99;
    sfx('level');
    this.later(3.2, () => this.cb.onEnd('victory'));
  }

  private onPlayerDown() {
    if (this.stage === 'over') return;
        this.stage = 'over';
    setMusic('defeat');
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
    this.fx.pillar(p.pos, 0xbfe8ff, 2.5, 50, 1.4);
    this.fx.ring(p.pos, 0xffffff, 1, 9, 1.0);
    this.banner('TELEPORTING…', 'Entering the arena', 2.0);
    this.later(0.8, () => { this.fade = true; this.emitHud(true); });
    this.later(1.7, () => this.switchToArena());
  }

    private switchToArena() {
    setMusic('arena');
    const p = this.player;
    for (const f of [...this.fighters]) if (f !== p) this.removeFighter(f);
    this.fighters = [p];
    this.rival = null;
    for (const pr of this.projs) this.fx.group.remove(pr.mesh);
    this.projs = [];
    this.zones = [];
    this.trails = [];
    this.fx.clear();
    this.timers = [];
    this.matchId++;

    // random arena (never the same twice in a row)
    let idx = Math.floor(Math.random() * ARENA_COUNT);
    if (idx === this.lastArena) idx = (idx + 1) % ARENA_COUNT;
    this.lastArena = idx;
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.dispose();
    }
    this.arena = buildArena(idx);
    this.scene.add(this.arena.group);
    this.island.group.visible = false;
    this.cur = this.arena;
    this.setEnv(this.arena.env);
    this.stage = 'arena';
    this.frozen = true;

    p.castId++;
    p.anim = null;
    p.forced = null;
    p.charging = null;
    p.lock = 0;
    p.stun = 0;
    p.slow = 0;
    p.floatT = 0;
    p.buffT = 0;
    p.boostT = 0;
    p.dashCd = 0;
    this.endForm(p, true);
    p.cd = p.cd.map(() => 0);
    p.cdF = p.cdF.map(() => 0);
    p.st = {};
    p.energy = p.maxEnergy;
    p.meter = p.def!.meter.start;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.6);
    const R = this.cur.radius;
    p.pos.set(0, 0, R * 0.62);
    p.vy = 0;
    p.faceNow(Math.PI);
    p.invuln = 999;
    this.camYaw = Math.PI;
    this.camPitch = 0.3;
    this.camDist = 13;

    const r = this.makeRival();
    r.pos.set(0, 0, -R * 0.62);
    r.faceNow(0);
    r.invuln = 999;
    this.quest = { text: `Win the duel vs ${r.name}`, progress: 0, goal: 1 };

    this.banner(this.cur.name.toUpperCase(), `Final duel: you vs ${r.name}`, 3.2);
    this.later(0.35, () => { this.fade = false; this.emitHud(true); });
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
  enemies(c: Fighter): Fighter[] {
    return this.fighters.filter((f) => !f.dead && f.team !== c.team && f.team !== 'none');
  }
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
  defOf(k: PlayableKind): CharDef {
    return CHARS[k];
  }
  get radius() {
    return this.cur.radius;
  }
  get arenaRadius() {
    return this.cur.radius;
  }

  /** aiming: the player's aim follows the on-screen cursor; AI aims at its target */
  aim(c: Fighter): Aim {
    if (c.isPlayer) return this.pAim;
    const t = this.target(c, 90);
    const cc = c.chestPos();
    const flat = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const point = t ? t.chestPos() : cc.clone().addScaledVector(flat, 10);
    const dir = point.clone().sub(cc);
    const dist = dir.length();
    if (dist > 0.01) dir.normalize();
    else dir.copy(flat);
    dir.x += rand(-0.02, 0.02);
    dir.z += rand(-0.02, 0.02);
    dir.normalize();
    const fl = new THREE.Vector3(dir.x, 0, dir.z);
    if (fl.lengthSq() < 0.0001) fl.copy(flat);
    fl.normalize();
    return { dir, flat: fl, yaw: Math.atan2(fl.x, fl.z), point, ground: t ? t.pos.clone() : point.clone().setY(0), dist, target: t };
  }
  /** turn the caster toward where the cursor is, returns the horizontal direction */
  faceAim(c: Fighter): THREE.Vector3 {
    const a = this.aim(c);
    c.faceNow(a.yaw);
    return a.flat.clone();
  }

  private computeAim() {
    const p = this.player;
    if (!p) return;
    const w = this.w;
    const h = this.h;
    const cx = this.shiftLock ? w / 2 : this.cursor.x;
    const cy = this.shiftLock ? h / 2 : this.cursor.y;
    this.ndc.set((cx / w) * 2 - 1, -((cy / h) * 2 - 1));
    this.ray.setFromCamera(this.ndc, this.camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    const chest = p.chestPos();
    let best: Fighter | null = null;
    let bd = 1e9;
    const vc = new THREE.Vector3();
    for (const v of this.fighters) {
      if (v.dead || v.team === p.team || v.team === 'none') continue;
      v.chestPos(vc);
      const tt = Math.max(0, vc.clone().sub(o).dot(d));
      const cl = o.clone().addScaledVector(d, tt);
      const dist = vc.distanceTo(cl);
      if (dist < 2.2 + tt * 0.03 && dist < bd) {
        bd = dist;
        best = v;
      }
    }
    const A = this.pAim;
    const far = o.clone().addScaledVector(d, 70);
    if (best) A.point.copy(best.chestPos());
    else if (d.y < -0.01) {
      const t = (chest.y - o.y) / d.y;
      A.point.copy(t > 0 && t < 150 ? o.clone().addScaledVector(d, t) : far);
    } else A.point.copy(far);
    if (d.y < -0.005) {
      const t = -o.y / d.y;
      A.ground.copy(t > 0 && t < 160 ? o.clone().addScaledVector(d, t) : far.setY(0));
    } else A.ground.copy(far).setY(0);
    A.dir.copy(A.point).sub(chest);
    A.dist = A.dir.length();
    if (A.dist < 0.6) A.dir.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    A.dir.normalize();
    A.flat.set(A.dir.x, 0, A.dir.z);
    if (A.flat.lengthSq() < 0.0004) A.flat.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    A.flat.normalize();
    A.yaw = Math.atan2(A.flat.x, A.flat.z);
    A.target = best;
  }

  clampPos(p: THREE.Vector3) {
    const R = this.cur.radius;
    const d = Math.hypot(p.x, p.z);
    if (d > R) {
      p.x *= R / d;
      p.z *= R / d;
    }
  }

  // ------------------------------------------------------------------ forms / status helpers
  setForm(f: Fighter, form: Form, dur: number) {
    f.form = form;
    f.formT = dur;
    f.formMax = dur;
    f.setFormVisual(form);
    if (form === 'adult' || form === 'god') {
      f.cdF = f.cdF.map(() => 0);
    }
  }
  endForm(f: Fighter, silent = false) {
    const was = f.form;
    if (!was) return;
    f.form = '';
    f.formT = 0;
    f.speedMult = 1;
    f.buffDmg = 1;
    f.atkSpeed = 1;
    f.rangeMult = 1;
    f.dmgTaken = 1;
    f.st.cdRate = 0;
    f.auraCol = -1;
    f.setFormVisual('');
    if (!silent) f.def?.onFormEnd?.(this, f, was);
    if (f.combo) f.combo = 0;
  }
  heal(f: Fighter, amt: number) {
    if (f.dead) return;
    const a = Math.min(amt, f.maxHp - f.hp);
    if (a <= 0) return;
    f.hp += a;
    this.floater(new THREE.Vector3(f.pos.x, f.pos.y + 4.2, f.pos.z), `+${Math.round(a)}`, '#7dff9a', 22);
  }
  applySlow(f: Fighter, t: number, mul: number) {
    f.slow = Math.max(f.slow, t);
    f.slowMul = f.slow > 0 && f.slowMul < 1 ? Math.min(f.slowMul, mul) : mul;
  }
  addZone(z: Omit<Zone, 'accum'>) {
    this.zones.push({ ...z, accum: 0 });
  }
  trail(f: Fighter, which: 1 | 2 | 3, color: number, dur: number, width = 0.32) {
    this.trails.push({ f, which, color, t: dur, width, prev: null });
  }
  addMeter(f: Fighter, v: number) {
    f.meter = clamp(f.meter + v, 0, f.meterMax);
  }
  stunFighter(v: Fighter, t: number, force = false) {
    if (v.dead) return;
    if (!force && v.stunImmune > 0) return;
    v.stun = Math.max(v.stun, t);
    v.stunImmune = v.stun + 0.8;
    v.lock = 0;
    v.castId++;
    v.charging = null;
    v.anim = null;
    v.floatT = 0;
    v.onLand = null;
    if (v.ai) v.ai.swing = -1;
  }

  // ------------------------------------------------------------------ skills
  private cdArr(f: Fighter) {
    return f.inForm ? f.cdF : f.cd;
  }
  private cdMaxArr(f: Fighter) {
    return f.inForm ? f.cdFMax : f.cdMax;
  }
  private canAct(f: Fighter) {
    if (!f || f.dead || this.frozen || this.paused) return false;
    if (f.lock > 0 || f.stun > 0) return false;
    return this.stage === 'island' || this.stage === 'arena';
  }
  tryCast(f: Fighter, i: number): boolean {
        if (!this.canAct(f) || !f.def || f.charging) return false;
    if ((f.st.zetsuT ?? 0) > 0) {
      if (f.isPlayer && (f.st.zetsuMsgT ?? 0) <= 0) {
        f.st.zetsuMsgT = 0.8;
        this.popup(f, 'ZETSU — NEN SEALED', '#ffd96a', 18);
      }
      return false;
    }
    const s = f.skillsDefs[i];
    if (!s) return false;
    if (this.cdArr(f)[i] > 0 || f.energy < s.cost) return false;
    if (s.can && !s.can(this, f)) return false;
    if (s.charge) {
      f.charging = { i, t: 0, max: s.charge, anim: s.chargeAnim ?? 'charge' };
      f.m1cd = Math.max(f.m1cd, 0.1);
      sfx('charge');
      return true;
    }
    return this.fire(f, i, 0);
  }
  releaseCharge(f: Fighter) {
    const c = f.charging;
    if (!c) return;
    f.charging = null;
    const frac = c.t < 0.16 ? 0 : clamp((c.t - 0.12) / Math.max(0.1, c.max - 0.12), 0.05, 1);
    this.fire(f, c.i, frac);
  }
  private fire(f: Fighter, i: number, ch: number): boolean {
    const s = f.skillsDefs[i];
    if (!s || !f.def) return false;
    if (f.st.judgeT > 0) this.judgePunish(f);
    if (f.dead) return false;
    f.energy -= s.cost;
    f.castId++;
    f.combo = 0;
    f.m1cd = Math.max(f.m1cd, 0.25);
    f.lastSkill = { kind: f.kind, i, t: this.time, form: f.inForm };
    f.st.lastCastT = 3;
    const mult = f.isPlayer ? 1 : 1.1;
    const arr = this.cdArr(f);
    const mx = this.cdMaxArr(f);
    arr[i] = s.cd * mult;
    mx[i] = arr[i];
    const ov = s.cast(this, f, ch);
    if (typeof ov === 'number') {
      arr[i] = ov;
      mx[i] = Math.max(ov, 0.01);
    }
    this.notifyThreat(f);
    return true;
  }
  private judgePunish(f: Fighter) {
    f.st.judgeT = 0;
    this.fx.chain(() => f.chestPos().add(new THREE.Vector3(0, 6, 0)), () => f.chestPos(), 0xff3030, 0.5);
    this.fx.explosion(f.chestPos(), 0xff2a2a, 3, 0.4);
    this.damage(f, f, 30, { noCrit: true, color: 0xff3030, noMeter: true, heavy: true });
    this.floater(new THREE.Vector3(f.pos.x, f.pos.y + 5, f.pos.z), 'JUDGMENT!', '#ff4040', 26);
  }

  private notifyThreat(caster: Fighter) {
    for (const e of this.fighters) {
      if (!e.ai || e.ai.type !== 'rival' || e.dead || e.team === caster.team || !e.ai.active) continue;
      if (Math.hypot(e.pos.x - caster.pos.x, e.pos.z - caster.pos.z) > 26) continue;
      if (e.dashCd > 0 || Math.random() > e.ai.dodge) continue;
      this.after(rand(0.12, 0.26), e, () => {
        if (e.lock > 0 || e.stun > 0 || e.dashCd > 0 || this.frozen) return;
        const dx = caster.pos.x - e.pos.x;
        const dz = caster.pos.z - e.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        const s = Math.random() < 0.5 ? -1 : 1;
        this.dash(e, (-dz / l) * s - (dx / l) * 0.35, (dx / l) * s - (dz / l) * 0.35);
        e.ai!.dashCd = rand(2.0, 3.2);
      });
    }
  }

  // ------------------------------------------------------------------ M1
  basic(f: Fighter, boost = 1): boolean {
    if (f.dead || f.lock > 0 || f.stun > 0 || f.m1cd > 0 || this.frozen || this.paused || f.charging || !f.def) return false;
    if (this.stage !== 'island' && this.stage !== 'arena') return false;
    const def = f.def;
    const air = !f.onGround;
    const chain = air ? def.m1Air : f.inForm || (def.m1Form && (f.form === 'scythe' || f.form === 'terps')) ? def.m1Form ?? def.m1 : def.m1;
    if (f.comboAir !== air) {
      f.combo = 0;
      f.comboAir = air;
    }
    const idx = f.combo % chain.steps.length;
    const s = chain.steps[idx];
    const last = idx === chain.steps.length - 1;
    const rate = f.atkSpeed;
    const aim = this.aim(f);
    f.faceNow(aim.yaw);
    f.combo = last ? 0 : idx + 1;
    f.comboT = chain.window;
    f.m1cd = last ? Math.max(chain.recovery, s.dur / rate) : s.dur / rate;
    f.setAnim(s.anim, clamp(Math.max(s.dur * 1.1, s.hit * 2.1) / rate, 0.17, 0.7));
    f.st.m1T = 0.28;
    sfx('swing');
    const rm = f.rangeMult;
    // lunge toward the aim / target
    const t = this.target(f, s.range * rm * 2.2 + 2);
    let lunge = s.lunge ?? 1.6;
    if (t && !s.behind && !s.dive) {
      const dist = Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
      lunge = Math.min(lunge, Math.max(0, dist - 1.8));
    }
        if (lunge > 0.2 && !s.dive) {
      this.dashF(f, aim.flat, lunge, 0.12);
      if (lunge > 1.5) this.fx.speedLines(f.chestPos(), aim.flat, s.color ?? def.color, 5, 3.5, 0.2);
    }
    if (air) {
      f.vy = Math.max(f.vy, 3.5);
      f.floatT = 0.22;
    }
    if (s.dive) f.vy = Math.max(f.vy, s.hop ?? 11);
    if (s.hop && !s.dive) f.vy = Math.max(f.vy, s.hop);
    if (s.trail) this.trail(f, s.trail, s.color ?? def.color, Math.max(0.2, s.hit * 1.6), 0.3);
    const n = s.hits ?? 1;
    for (let k = 0; k < n; k++) this.after(s.hit / rate + k * 0.07, f, () => this.m1Hit(f, s, (boost * (1 / n)) * (n > 1 ? 1.1 : 1), k === 0));
    return true;
  }

  private m1Hit(f: Fighter, s: M1Step, boost: number, first: boolean) {
    const def = f.def!;
    const rm = f.rangeMult;
    const color = s.color ?? def.color;
    if (first && f.form === 'god') {
      const tt = this.target(f, 9);
      if (tt) f.faceNow(Math.atan2(tt.pos.x - f.pos.x, tt.pos.z - f.pos.z));
    }
    if (s.behind) {
      const t = this.target(f, 11);
      if (t) {
        this.fx.afterimage(f.pos, f.yaw, color);
        const fw = new THREE.Vector3(Math.sin(t.yaw), 0, Math.cos(t.yaw));
        f.pos.x = t.pos.x - fw.x * 1.8;
        f.pos.z = t.pos.z - fw.z * 1.8;
        this.clampPos(f.pos);
        f.faceNow(Math.atan2(t.pos.x - f.pos.x, t.pos.z - f.pos.z));
        this.fx.burst(f.chestPos(), color, 10, 7, 0.3);
        sfx('dash');
      }
    }
    const fwd = f.forward();
    const o: DmgOpts = { kb: s.kb ?? 0.8, stun: s.stun, launch: s.launch, slam: s.slam, color, heavy: s.heavy, side: s.side, melee: true, breakGuard: s.breakGuard, recoil: s.recoil };
    if (s.dive) {
      f.vy = -44;
      f.floatT = 0;
      const dm = s.dmg * boost;
      f.onLand = {
        t: 1.5,
        fn: () => {
          const c = new THREE.Vector3(f.pos.x, 0, f.pos.z);
          this.fx.shockwave(c, color, s.dive! * rm, 0.5);
          this.fx.crack(c, color, s.dive! * rm * 0.6);
          this.fx.debris(c, 10, 8);
          this.shake(0.3);
          this.hitSphere(c, s.dive! * rm, f, dm, { ...o, kb: s.kb ?? 7, heavy: true });
        },
      };
      return;
    }
    const pos = f.chestPos().addScaledVector(fwd, 1.5 * rm);
    const anim = s.anim;
    let roll = rand(-0.5, 0.5);
    if (/upper/.test(anim)) roll = 1.3;
    else if (/slam|dive|overhead/.test(anim)) roll = Math.PI / 2;
    else if (/hook|round|spin/.test(anim)) roll = 0;
    else if (/kick|knee/.test(anim)) roll = 0.5;
        this.fx.slashArc(pos, fwd, roll, 2.2 * rm, 0.55, color, 0.17);
    if (s.heavy) this.fx.slashX(pos, fwd, color, 3.8 * rm, 0.3);
    const hits = this.hitArc(f, s.range * rm, s.arc ?? 0.25, s.dmg * boost, o);
    if (s.shock) {
      const c = new THREE.Vector3(f.pos.x, 0, f.pos.z).addScaledVector(fwd, 2.2 * rm);
      this.fx.shockwave(c, color, s.shock * rm, 0.45);
      if (f.onGround) {
        this.fx.crack(c, color, s.shock * rm * 0.6);
        this.fx.debris(c, 8, 7);
      }
      this.shake(0.22);
      this.hitSphere(c, s.shock * rm * 0.7, f, s.dmg * 0.4 * boost, { ...o, kb: 4, exclude: hits });
    }
    if (hits.length && s.heavy) this.fovKick = Math.max(this.fovKick, 2);
    if (s.slam && !f.onGround) {
      f.vy = -28;
      f.floatT = 0;
    }
  }

  private playerDash() {
    const p = this.player;
    if (!p || p.dead || this.frozen || this.paused || this.stage === 'menu' || this.stage === 'over') return;
    if (p.dashCd > 0 || p.stun > 0 || p.lock > 0 || p.root_ > 0) return;
    let dx = p.moveInput.x;
    let dz = p.moveInput.y;
    if (dx * dx + dz * dz < 0.01) {
      dx = -Math.sin(this.camYaw);
      dz = -Math.cos(this.camYaw);
    }
    this.dash(p, dx, dz);
  }

  dash(f: Fighter, dx: number, dz: number) {
    if (f.st.judgeT > 0) this.judgePunish(f);
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const god = f.form === 'god';
    f.dashMax = f.isPlayer ? (god ? 0.7 : 1.5) : god ? 1.0 : 1.9;
    f.dashCd = f.dashMax;
    const T = god ? 0.2 : 0.17;
    const sp = god ? 52 : 34;
    f.invuln = Math.max(f.invuln, 0.24);
    f.forced = { vx: dx * sp, vz: dz * sp, t: T, T, ease: false };
    f.charging = null;
    f.setAnim('crouch', 0.18);
    const col = KIND_COLOR(f.kind);
    this.fx.afterimage(f.pos, f.yaw, col);
    this.fx.burst(new THREE.Vector3(f.pos.x, 0.5, f.pos.z), 0xffffff, 8, 5, 0.25);
    this.fx.dust(new THREE.Vector3(f.pos.x, 0, f.pos.z), 6, 3);
    if (god) {
      f.ghost = 0.25;
      this.trail(f, 3, 0xcfefff, 0.3, 0.5);
      this.trail(f, 1, 0xcfefff, 0.3, 0.4);
    }
    f.def?.onDash?.(this, f);
    sfx('dash');
  }

  dashF(c: Fighter, dir: THREE.Vector3, dist: number, T: number) {
    c.forced = { vx: (dir.x * dist) / T, vz: (dir.z * dist) / T, t: T, T, ease: false };
  }
  knock(v: Fighter, dx: number, dz: number, dist: number, T = 0.3) {
    const sp = (2 * dist) / T;
    v.forced = { vx: dx * sp, vz: dz * sp, t: T, T, ease: true };
  }
  stop(t: number) {
    this.hitStop = Math.max(this.hitStop, t);
  }
  slamDown(v: Fighter, att: Fighter) {
    v.vy = -38;
    v.onGround = false;
    v.slamT = 1.6;
    v.st.slamBy = att.isPlayer ? 1 : 0;
  }
  launch(v: Fighter, vy: number) {
    v.vy = vy;
    v.onGround = false;
    v.tumble = 0.5;
  }

  // ------------------------------------------------------------------ damage
  damage(att: Fighter, vic: Fighter, amt: number, o: DmgOpts = {}): boolean {
    if (vic.dead || (vic.invuln > 0 && !o.pierce)) return false;
    if (this.stage === 'transition' || this.stage === 'menu') return false;
    // Killua Godspeed: Whirlwind auto-counter vs short range attacks
    if (vic.kind === 'killua' && vic.form === 'god' && o.melee && att !== vic && (vic.st.whirlT ?? 0) <= 0 && vic.lock <= 0 && vic.stun <= 0 && !vic.charging) {
      if (Math.hypot(att.pos.x - vic.pos.x, att.pos.z - vic.pos.z) < 6.5) {
        vic.st.whirlT = 2.4;
        this.whirlwind(vic, att);
        return false;
      }
    }
        if (att !== vic && vic.def?.evade?.(this, vic, att, amt, o)) return false;
    let a = amt * att.dmgMult * att.buffDmg * (att.def?.dmgBonus?.(att) ?? 1) * (o.mult ? o.mult(vic) : 1) * vic.dmgTaken;
    if ((vic.st.vulnT ?? 0) > 0) a *= 1.12;
    let crit = false;
    if (!o.noCrit && !o.dot && Math.random() < 0.08) {
      a *= 1.5;
      crit = true;
    }
    a = Math.max(1, Math.round(a));
    vic.hp = Math.max(0, vic.hp - a);
    if (!o.dot) vic.flashHit(o.heavy ? 1.2 : 1);
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
    if (o.side) {
      const fx = Math.sin(att.yaw);
      const fz = Math.cos(att.yaw);
      const sgn = (vic.pos.x - att.pos.x) * fz - (vic.pos.z - att.pos.z) * fx > 0 ? 1 : -1;
      dx = fz * sgn;
      dz = -fx * sgn;
    }
    if (!o.dot) {
      if (o.kb) this.knock(vic, dx, dz, o.kb * (vic.st.heavyKB ? 0.6 : 1), 0.28);
      if (o.launch) this.launch(vic, o.launch);
      if (o.slam) {
        vic.vy = -36;
        vic.onGround = false;
        vic.slamT = 1.6;
        vic.st.slamBy = att.isPlayer ? 1 : 0;
      }
      if (o.stun) this.stunFighter(vic, o.stun, !!o.breakGuard);
      else if (o.recoil) {
        vic.m1cd = Math.max(vic.m1cd, 0.25);
        if (vic.lock > 0 && vic.lock < 0.5) vic.lock = 0;
      }
      if (o.root) vic.root_ = Math.max(vic.root_, o.root);
      if (o.slow) this.applySlow(vic, o.slow, o.slowMul ?? 0.5);
      if (o.bleed) {
        vic.st.bleedT = Math.max(vic.st.bleedT ?? 0, o.bleed);
        vic.st.bleedDps = Math.max(vic.st.bleedDps ?? 0, o.bleedDps ?? 4);
      }
    }
    if (vic.ai) vic.ai.aggro = true;
    if (!o.noMeter && !o.dot) {
      if (att.def && att !== vic) this.addMeter(att, a * att.def.gainHit * (att.inForm ? 0.5 : 1));
      if (vic.def) this.addMeter(vic, a * vic.def.gainHurt);
    }
    if (att !== vic) {
      att.def?.onDealt?.(this, att, vic, a, o);
      vic.def?.onHurt?.(this, vic, att, a, o);
    }
    const col = o.color ?? 0xffffff;
    const cp = vic.chestPos();
    if (!o.dot) {
            this.fx.hitSpark(cp, col, o.heavy ? 2.2 : 1.3);
      this.fx.impact(cp, col, o.heavy ? 1.7 : crit ? 1.2 : 0.55, new THREE.Vector3(dx, 0.25, dz));
      this.fx.sparks(cp, col, o.heavy ? 16 : 7, o.heavy ? 12 : 8);
      this.fx.burst(cp, col, o.heavy ? 10 : 4, o.heavy ? 8 : 5, 0.3);
      if (o.heavy) this.fx.vring(cp, new THREE.Vector3(dx, 0.2, dz), col, 0.5, 3.5, 0.3);
      sfx(vic.isPlayer ? 'hurt' : o.heavy ? 'heavy' : 'hit');
      if (vic.isPlayer) this.shake(o.heavy ? 0.4 : 0.16);
      else if (att.isPlayer) this.shake(o.heavy ? 0.28 : 0.07);
      if (o.heavy) this.hitStop = Math.max(this.hitStop, 0.075);
      else if (att.isPlayer || vic.isPlayer) this.hitStop = Math.max(this.hitStop, 0.025);
    }
    this.floater(new THREE.Vector3(cp.x, vic.pos.y + 3.8, cp.z), crit ? `${a}!` : `${a}`, o.dot ? '#ff7a7a' : vic.isPlayer ? '#ff5a5a' : crit ? '#ffd23f' : '#ffffff', crit || o.heavy ? 26 : o.dot ? 16 : 20);
    o.onHit?.(vic);
    if (vic.hp <= 0) this.kill(vic);
    return true;
  }

  private whirlwind(k: Fighter, att: Fighter) {
    this.fx.afterimage(k.pos, k.yaw, 0xcfefff);
    k.invuln = Math.max(k.invuln, 0.7);
    k.castId++;
    k.lock = 0.5;
    const ang = Math.atan2(att.pos.x - k.pos.x, att.pos.z - k.pos.z);
    k.pos.x = att.pos.x - Math.sin(ang) * 1.9 + Math.cos(ang) * 1.2;
    k.pos.z = att.pos.z - Math.cos(ang) * 1.9 - Math.sin(ang) * 1.2;
    this.clampPos(k.pos);
    k.faceNow(Math.atan2(att.pos.x - k.pos.x, att.pos.z - k.pos.z));
    this.floater(new THREE.Vector3(k.pos.x, k.pos.y + 5, k.pos.z), 'WHIRLWIND!', '#cfefff', 24);
    this.fx.burst(k.chestPos(), 0xcfefff, 14, 9, 0.3);
    sfx('zap');
    for (let i = 0; i < 4; i++) {
      this.after(0.08 + i * 0.08, k, () => {
        k.faceNow(Math.atan2(att.pos.x - k.pos.x, att.pos.z - k.pos.z));
        k.setAnim(i % 2 ? 'jabL' : 'jabR', 0.14);
        this.fx.trailSeg(k.chestPos(), k.chestPos().addScaledVector(k.forward(), 3), 0xcfefff, 0.4);
        this.hitArc(k, 4.5, 0, i === 3 ? 12 : 6, { color: 0xcfefff, kb: i === 3 ? 9 : 0.4, stun: i === 3 ? 0.4 : 0, heavy: i === 3, noMeter: true, melee: false });
      });
    }
  }

  selfDamage(f: Fighter, amt: number) {
    this.damage(f, f, amt, { noCrit: true, noMeter: true, dot: true });
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
    v.charging = null;
    v.auraCol = -1;
    if (v.label) v.label.style.display = 'none';
    sfx('death');
    this.fx.explosion(v.chestPos(), 0xffffff, 2.2, 0.4);
    this.hitStop = Math.max(this.hitStop, 0.14);
    if (v === this.player) this.onPlayerDown();
    else if (v.ai?.type === 'bandit') this.onBanditDown();
    else if (v.ai?.type === 'rival') this.onRivalDown();
  }

  private inY(v: Fighter, c: THREE.Vector3, tol: number) {
    return Math.abs(v.pos.y + 1.4 - c.y) <= tol;
  }

  hitArc(c: Fighter, range: number, cosHalf: number, dmg: number, o: DmgOpts = {}): Fighter[] {
    const out: Fighter[] = [];
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const cc = c.chestPos();
    for (const v of [...this.fighters]) {
      if (v.team === c.team || v.dead || v.team === 'none' || o.exclude?.includes(v)) continue;
      const dx = v.pos.x - c.pos.x;
      const dz = v.pos.z - c.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist - v.radius > range) continue;
      if (!this.inY(v, cc, 3.6)) continue;
      if (dist > 1.0) {
        const dot = (dx * fx + dz * fz) / dist;
        if (dot < cosHalf) continue;
      }
      if (this.damage(c, v, dmg, { melee: true, ...o })) out.push(v);
    }
    return out;
  }

  hitSphere(center: THREE.Vector3, radius: number, c: Fighter, dmg: number, o: DmgOpts = {}): Fighter[] {
    const out: Fighter[] = [];
    for (const v of [...this.fighters]) {
      if (v.team === c.team || v.dead || v.team === 'none' || o.exclude?.includes(v)) continue;
      const dx = v.pos.x - center.x;
      const dz = v.pos.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist - v.radius * 0.5 > radius) continue;
      if (Math.abs(v.pos.y + 1.4 - center.y) > radius * 0.6 + 3.5) continue;
      if (this.damage(c, v, dmg, { ...o, dirx: dx, dirz: dz })) out.push(v);
    }
    return out;
  }
  hitCircle = this.hitSphere.bind(this);

  /** capsule along a 3D ray: slashes, beams, bullets */
  hitBeam(c: Fighter, origin: THREE.Vector3, dir: THREE.Vector3, len: number, width: number, dmg: number, o: DmgOpts = {}): Fighter[] {
    const out: Fighter[] = [];
    const vc = new THREE.Vector3();
    const dn = dir.clone().normalize();
    for (const v of [...this.fighters]) {
      if (v.team === c.team || v.dead || v.team === 'none' || o.exclude?.includes(v)) continue;
      v.chestPos(vc);
      const t = clamp(vc.clone().sub(origin).dot(dn), 0, len);
      const cl = origin.clone().addScaledVector(dn, t);
      if (vc.distanceTo(cl) > width + v.radius * 0.7) continue;
      if (this.damage(c, v, dmg, { dirx: dn.x, dirz: dn.z, ...o })) out.push(v);
    }
    return out;
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
    const z = s.size;
    switch (s.shape) {
      case 'orb':
        add(sphereGeo, basicMat(0xffffff), z * 0.55, z * 0.55, z * 0.55);
        add(sphereGeo, basicMat(s.color), z * 1.2, z * 1.2, z * 1.2);
        spin = add(torusGeo, basicMat(s.color), z * 1.5, z * 1.5, z * 1.5);
        break;
      case 'wave':
        add(sphereGeo, basicMat(s.color), z * 1.5, z * 0.9, z * 0.4);
        add(sphereGeo, basicMat(0xffffff), z * 0.8, z * 0.45, z * 0.3);
        spin = add(torusGeo, basicMat(0xffffaa), z * 1.5, z * 1.5, z * 1.5);
        break;
      case 'fist': {
        const skin = new THREE.MeshLambertMaterial({ color: 0xf6c9a0 });
        add(boxGeo, skin, z * 1.1, z * 1.0, z * 1.2);
        for (let i = 0; i < 4; i++) {
          const f = add(boxGeo, skin, z * 0.26, z * 0.3, z * 0.5);
          f.position.set(-z * 0.4 + i * z * 0.27, z * 0.1, z * 0.75);
        }
        add(sphereGeo, basicMat(s.color), z * 1.7, z * 1.5, z * 1.7);
        break;
      }
      case 'card': {
        add(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), z * 0.9, z * 0.04, z * 1.3);
        add(boxGeo, basicMat(s.color), z * 1.1, z * 0.05, z * 1.5);
        break;
      }
      case 'page':
        add(boxGeo, new THREE.MeshBasicMaterial({ color: 0xf4efe0 }), z * 1.1, z * 0.04, z * 1.5);
        add(boxGeo, basicMat(s.color), z * 1.3, z * 0.05, z * 1.7);
        break;
      case 'bullet':
        add(sphereGeo, basicMat(0xffffff), z * 0.4, z * 0.4, z * 1.6);
        add(sphereGeo, basicMat(s.color), z * 0.8, z * 0.8, z * 2.4);
        break;
      case 'knife':
        add(boxGeo, new THREE.MeshBasicMaterial({ color: 0xe8ecf8 }), z * 0.12, z * 0.25, z * 1.6);
        add(boxGeo, basicMat(s.color), z * 0.2, z * 0.35, z * 1.8);
        break;
      case 'case': {
        add(boxGeo, new THREE.MeshLambertMaterial({ color: 0x5a3b22 }), z * 0.5, z * 1.8, z * 2.4);
        add(boxGeo, basicMat(0xc9a24a), z * 0.6, z * 0.4, z * 0.5);
        spin = g;
        break;
      }
      case 'smoke':
        add(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x6a6474, transparent: true, opacity: 0.6, depthWrite: false }), z, z, z);
        break;
      case 'wisp':
        add(sphereGeo, basicMat(0xffffff), z * 0.5, z * 0.5, z * 0.5);
        add(sphereGeo, new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.6, depthWrite: false }), z * 1.2, z * 1.2, z * 1.2);
        break;
      default:
        add(sphereGeo, basicMat(0xcccccc, false), z, z, z);
        add(sphereGeo, basicMat(s.color), z * 1.6, z * 1.6, z * 1.6);
    }
    g.position.copy(s.pos);
    g.lookAt(s.pos.x + s.dir.x, s.pos.y + s.dir.y, s.pos.z + s.dir.z);
    this.fx.group.add(g);
    this.projs.push({
      mesh: g, vel: s.dir.clone().normalize().multiplyScalar(s.speed), speed: s.speed, s, life: s.life, maxLife: s.life, hit: new Set(), spin, trailT: 0, returned: false,
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
  kick(v: number) {
    this.fovKick = Math.max(this.fovKick, v);
  }

  private floater(pos: THREE.Vector3, text: string, color: string, size: number) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;left:0;top:0;font:900 ${size}px system-ui,sans-serif;color:${color};text-shadow:-2px 0 #000,2px 0 #000,0 -2px #000,0 2px #000;will-change:transform;pointer-events:none;`;
    this.overlay.appendChild(el);
    if (this.floaters.length > 40) this.floaters.shift()?.el.remove();
    this.floaters.push({ el, pos: pos.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6))), t: 0 });
  }
  popup(f: Fighter, text: string, color = '#ffffff', size = 22) {
    this.floater(new THREE.Vector3(f.pos.x, f.pos.y + 4.6, f.pos.z), text, color, size);
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
    if (dist > 2.7) f.moveInput.set(dx / dist, dz / dist);
    else if (ai.atkT <= 0) {
      f.lock = 0.6;
      f.castId++;
      f.faceNow(Math.atan2(dx, dz));
      f.setAnim('slamR', 0.55);
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
    if (f.dead || !f.def) return;
    if (!ai.active || p.dead || this.frozen) return;
    ai.dashCd -= dt;
    ai.think -= dt;
    ai.atkT -= dt;
    ai.jumpT -= dt;
    const dx = p.pos.x - f.pos.x;
    const dz = p.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist;
    const nz = dz / dist;
    if (f.charging) {
      f.targetYaw = Math.atan2(dx, dz);
      f.faceNow(f.targetYaw);
      if (f.charging.t >= ai.holdFor) this.releaseCharge(f);
      return;
    }
    if (f.lock > 0 || f.stun > 0) return;
    if (!f.forced) f.targetYaw = Math.atan2(dx, dz);

    if (ai.think <= 0) {
      ai.think = rand(0.2, 0.5) / ai.tempo;
      const defs = f.skillsDefs;
      const arr = this.cdArr(f);
      const usable = defs
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => arr[i] <= 0 && f.energy >= s.cost && dist >= s.ai[0] && dist <= s.ai[1] && (!s.can || s.can(this, f)));
      if (usable.length && Math.random() < ai.aggr) {
        const pick = usable[Math.floor(Math.random() * usable.length)];
        const ult = usable.find((u) => u.i === 3);
        const choice = ult && Math.random() < 0.55 ? ult : pick;
        const sk = choice.s;
        if (sk.charge) ai.holdFor = rand(0.1, sk.charge * 0.95);
        if (this.tryCast(f, choice.i)) return;
      }
      const r = Math.random();
      const mr = f.def.m1Range * f.rangeMult;
      if (dist < mr + 1.2) ai.mode = r < 0.62 ? 'melee' : r < 0.82 ? 'strafe' : 'retreat';
      else if (dist < 10) ai.mode = r < 0.55 ? 'approach' : 'strafe';
      else ai.mode = 'approach';
      ai.strafe = Math.random() < 0.5 ? -1 : 1;
      if (ai.dashCd <= 0 && f.dashCd <= 0 && Math.random() < 0.14 * ai.tempo) {
        if (dist > 11) this.dash(f, nx, nz);
        else if (dist < 4) this.dash(f, -nz * ai.strafe, nx * ai.strafe);
        ai.dashCd = rand(2.2, 3.4);
      }
    }
    if (ai.jumpT <= 0 && f.onGround && f.stun <= 0) {
      ai.jumpT = rand(2.5, 6);
      if (Math.random() < 0.5) {
        f.vy = JUMP_V * 0.85;
        f.onGround = false;
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
    if (dist < f.def.m1Range * f.rangeMult + 1.0 && ai.atkT <= 0) {
      if (this.basic(f)) ai.atkT = rand(0.04, 0.25) / ai.tempo;
    }
  }

  // ------------------------------------------------------------------ player control
  private updatePlayer(dt: number) {
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
    // keyboard camera: arrows look, +/- zoom
    if (this.keys.has('ArrowUp')) this.camPitch = clamp(this.camPitch - 1.6 * dt, -1.45, 1.45);
    if (this.keys.has('ArrowDown')) this.camPitch = clamp(this.camPitch + 1.6 * dt, -1.45, 1.45);
    if (this.keys.has('ArrowLeft')) this.camYaw += 2.2 * dt;
    if (this.keys.has('ArrowRight')) this.camYaw -= 2.2 * dt;
    if (this.keys.has('Equal') || this.keys.has('NumpadAdd') || this.keys.has('BracketRight')) this.camDist = clamp(this.camDist * Math.exp(-1.4 * dt), 3.2, 40);
    if (this.keys.has('Minus') || this.keys.has('NumpadSubtract') || this.keys.has('BracketLeft')) this.camDist = clamp(this.camDist * Math.exp(1.4 * dt), 3.2, 40);
    if (p.lock <= 0 && p.stun <= 0) {
      if (this.shiftLock) p.targetYaw = this.camYaw;
      else if (p.charging) p.targetYaw = this.pAim.yaw;
      else if (l > 0) p.targetYaw = Math.atan2(dx, dz);
    }
    // jump: buffered + coyote + variable height
    p.jumpHeld = this.keys.has('Space');
    if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0) && p.lock <= 0 && p.stun <= 0) {
            p.vy = JUMP_V;
      p.st.manualJump = 1;
      p.st.jumpHold = 0;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuf = 0;
      this.fx.dust(new THREE.Vector3(p.pos.x, 0, p.pos.z), 5, 3);
      sfx('dash');
    }
    // M1
    this.clickBuf = Math.max(0, this.clickBuf - dt);
    const mode = p.def?.m1Mode ?? 'repeat';
    if (mode === 'repeat') {
      if (this.mouseDown || this.keys.has('KeyJ')) this.basic(p);
    } else if (mode === 'click') {
      if (this.clickBuf > 0 && this.basic(p)) this.clickBuf = 0;
    } else {
      if (this.clickBuf > 0 && p.m1cd <= 0) {
        if (this.basic(p)) {
          this.clickBuf = 0;
          this.holdT = 0;
        }
      } else if (this.mouseDown && p.m1cd <= 0 && p.lock <= 0 && p.stun <= 0 && !p.charging) {
        this.holdT += dt;
      } else if (!this.mouseDown && this.holdT > 0) {
        if (this.holdT > 0.3 && p.m1cd <= 0) this.basic(p, 1 + Math.min(this.holdT, 1.2) * 0.3);
        this.holdT = 0;
      }
      p.st.fistCharge = this.mouseDown && this.holdT > 0.15 ? Math.min(1, this.holdT / 1.2) : 0;
    }
  }

  // ------------------------------------------------------------------ simulation
  private moveFighter(f: Fighter, dt: number) {
    let mx = 0;
    let mz = 0;
    const canMove = f.lock <= 0 && f.stun <= 0 && !f.dead && !this.frozen && f.root_ <= 0;
    let ix = 0;
    let iz = 0;
    if (canMove) {
      let sp = f.baseSpeed * f.speedMult * (f.slow > 0 ? f.slowMul : 1);
      if (f.charging) sp *= 0.45;
      if ((f.st.m1T ?? 0) > 0) sp *= 0.6;
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

    // jump physics: snappy fall, floaty apex, variable height
    let grav = 56;
    if (f.floatT > 0) grav = 5;
    else if (f.vy > 0) grav = f.st.manualJump && !f.jumpHeld && f.vy > 6 && f.slamT <= 0 ? 78 : Math.abs(f.vy) < 4 ? 30 : 44;
    else if (Math.abs(f.vy) < 4) grav = 34;
        if (f.isPlayer && f.jumpHeld && f.st.manualJump && f.vy > 0 && f.floatT <= 0 && f.slamT <= 0 && (f.st.jumpHold ?? 0) < JUMP_HOLD_MAX && f.energy > 1) {
      // hold to jump higher – costs stamina
      f.st.jumpHold = (f.st.jumpHold ?? 0) + dt;
      f.energy = Math.max(0, f.energy - JUMP_HOLD_DRAIN * dt);
      grav = 0;
      if (Math.random() < dt * 45) this.fx.burst(new THREE.Vector3(f.pos.x, f.pos.y + 0.2, f.pos.z), 0xcfe8ff, 1, 3, 0.3, 0.3);
    }
    f.vy -= grav * dt;
    if (f.floatT > 0 && f.vy < -3) f.vy = -3;
    if (f.vy < -52) f.vy = -52;
    f.pos.y += f.vy * dt;
    const wasAir = !f.onGround;
    if (f.pos.y <= 0) {
      const iv = f.vy;
      f.pos.y = 0;
      f.vy = 0;
      f.onGround = true;
      f.coyote = 0.1;
      if (wasAir) this.landed(f, iv);
    } else f.onGround = false;

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
    if (!f.dead && f.def) f.energy = Math.min(f.maxEnergy, f.energy + (f.isPlayer ? 6 : 5) * dt);
  }

  private landed(f: Fighter, iv: number) {
    f.st.manualJump = 0;
    if (f.forced?.land) f.forced = null;
    f.tumble = 0;
    if (iv < -12) {
      f.landT = 0.14;
      this.fx.dust(new THREE.Vector3(f.pos.x, 0, f.pos.z), 4, 3);
    }
    if (f.slamT > 0) {
      f.slamT = 0;
      const c = new THREE.Vector3(f.pos.x, 0, f.pos.z);
      this.fx.shockwave(c, 0xffe0a0, 4, 0.4);
      this.fx.crack(c, 0xffe0a0, 3.5, 2);
      this.fx.debris(c, 6, 6);
      this.fx.explosion(new THREE.Vector3(c.x, 0.8, c.z), 0xffd080, 2.5, 0.35);
      this.shake(0.3);
      this.hitStop = Math.max(this.hitStop, 0.06);
      sfx('heavy');
      const bySelf = f.st.slamBy === 1;
      if (f.hp > 0) {
        const att = bySelf ? this.player : this.rival;
        if (att && !att.dead) this.damage(att, f, 7, { noCrit: true, color: 0xffd080, stun: 0.6, heavy: true, noMeter: true });
        else this.selfDamage(f, 5);
      }
    }
    if (f.onLand) {
      const cb = f.onLand.fn;
      f.onLand = null;
      cb();
    }
  }

  private separate() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      for (let j = i + 1; j < fs.length; j++) {
        const a = fs[i];
        const b = fs[j];
        if (a.dead || b.dead || a.ghost > 0 || b.ghost > 0) continue;
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

  private endProj(pr: Proj, why: 'life' | 'hit' | 'ground') {
    this.fx.group.remove(pr.mesh);
    pr.s.onEnd?.(pr.mesh.position.clone(), why);
  }

  private updateProjectiles(dt: number) {
    const keep: Proj[] = [];
    const tmp = new THREE.Vector3();
    for (const pr of this.projs) {
      const s = pr.s;
      pr.life -= dt;
      if (s.homing && !s.homing.target.dead) {
        const want = s.homing.target.chestPos(tmp).sub(pr.mesh.position).normalize();
        const cur = pr.vel.clone().normalize();
        cur.lerp(want, Math.min(1, s.homing.rate * dt)).normalize();
        pr.vel.copy(cur).multiplyScalar(pr.speed);
      }
      if (s.boomerang && !pr.returned && pr.life < pr.maxLife * 0.5) {
        pr.returned = true;
        pr.hit.clear();
      }
      if (pr.returned && !s.owner.dead) {
        const to = s.owner.chestPos(tmp).sub(pr.mesh.position);
        if (to.length() < 1.8) {
          this.endProj(pr, 'life');
          continue;
        }
        pr.vel.copy(to.normalize().multiplyScalar(pr.speed * 1.1));
      }
      if (s.grav) pr.vel.y -= s.grav * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      if (pr.vel.lengthSq() > 0.01) pr.mesh.lookAt(pr.mesh.position.clone().add(pr.vel));
      if (pr.spin) pr.spin.rotation.z += dt * 18;
      if (s.shape === 'case') pr.mesh.rotation.x += dt * 14;
      pr.trailT -= dt;
      const pos = pr.mesh.position;
      if (pr.trailT <= 0) {
        pr.trailT = 0.025;
        if (s.shape === 'smoke') this.fx.smoke(pos, 1, 0.6, 0x7a7484, s.size * 1.6, 1.0);
        else {
          this.fx.glow.emit(pos.x, pos.y, pos.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), s.color, 0.9, s.size * rand(0.5, 0.9), 0.3, 0, 2, 0);
          if (s.size > 0.8 && Math.random() < 0.6) this.fx.glow.emit(pos.x, pos.y, pos.z, rand(-3, 3), rand(-3, 3), rand(-3, 3), 0xffffff, 1, 0.16, 0.3, 4, 1, 0);
        }
      }
      let dead = pr.life <= 0;
      let why: 'life' | 'hit' | 'ground' = 'life';
      if (!dead && pos.y < 0.15 && !s.noGround) {
        dead = true;
        why = 'ground';
      }
      if (!dead && Math.hypot(pos.x, pos.z) > this.cur.radius + 14) dead = true;
      if (!dead) {
        for (const v of [...this.fighters]) {
          if (dead && !s.pierce) break;
          if (v.dead || v.team === s.owner.team || v.team === 'none' || pr.hit.has(v)) continue;
          if (Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) > s.radius + v.radius) continue;
          if (pos.y < v.pos.y - 0.6 || pos.y > v.pos.y + 4.4) continue;
          if (v.invuln > 0) continue;
          pr.hit.add(v);
          const sp = pr.vel.length() || 1;
          this.damage(s.owner, v, s.dmg, { ...(s.opts ?? {}), dirx: pr.vel.x / sp, dirz: pr.vel.z / sp });
          s.onHit?.(v, pos.clone());
          if (!s.pierce) {
            dead = true;
            why = 'hit';
            break;
          }
        }
      }
      if (dead) this.endProj(pr, why);
      else keep.push(pr);
    }
    this.projs = keep;
  }

  private updateZones(dt: number) {
    const keep: Zone[] = [];
    for (const z of this.zones) {
      z.t -= dt;
      z.accum += dt;
      z.tick?.(this, z, dt);
      if (z.t <= 0 || z.owner.dead) z.onEnd?.(this, z);
      else keep.push(z);
    }
    this.zones = keep;
  }

  private updateTrails() {
    const keep: Trail[] = [];
    const v = new THREE.Vector3();
    for (const t of this.trails) {
      t.t -= 1 / 60;
      if (t.t <= 0 || t.f.dead) continue;
      const p = t.which === 1 ? t.f.handPos(v) : t.which === 2 ? t.f.handLPos(v) : t.f.footPos(v);
      if (t.prev) this.fx.trailSeg(t.prev, p, t.color, t.width, 0.2);
      t.prev = p.clone();
      keep.push(t);
    }
    this.trails = keep;
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

  private updateStatus(f: Fighter, dt: number) {
    if (f.dead) return;
    if ((f.st.bleedT ?? 0) > 0) {
      f.st.bleedAcc = (f.st.bleedAcc ?? 0) + dt;
      if (f.st.bleedAcc >= 0.5) {
        f.st.bleedAcc -= 0.5;
        this.damage(f, f, (f.st.bleedDps ?? 4) * 0.5, { dot: true, noCrit: true, noMeter: true, color: 0xc01a1a });
        this.fx.burst(f.chestPos(), 0xc01a1a, 3, 3, 0.4, 0.25);
      }
    }
    if ((f.st.shock ?? 0) > 0 && !((f.st.shockT ?? 0) > 0)) f.st.shock = 0;
    if ((f.st.shock ?? 0) > 0 && Math.random() < dt * 10) this.fx.sparks(f.chestPos(), 0x9fe8ff, 1, 4);
    // forms
    if (f.form && f.formT > 0) {
      f.formT -= dt;
      if (f.formT <= 0) this.endForm(f);
    }
    // charging
    if (f.charging) {
      const ch = f.charging;
      ch.t = Math.min(ch.max + 0.3, ch.t + dt);
      if (f.def?.chargeDrain && f.meter > 0) f.meter = Math.max(0, f.meter - f.def.chargeDrain * dt);
      const frac = Math.min(1, ch.t / ch.max);
      const hp = f.handPos();
      this.fx.gather(hp, f.def?.color ?? 0xffffff, 0.8 + frac * 1.6, 1 + Math.floor(frac * 3));
      if (Math.random() < dt * (6 + frac * 14)) this.fx.sparks(hp, f.def?.color ?? 0xffffff, 1, 3);
      if (frac >= 1 && ch.t - dt < ch.max) {
        this.fx.ring(f.pos, f.def?.color ?? 0xffffff, 0.5, 3, 0.3);
        this.fx.flashAt(hp, 0xffffff, 1.6, 0.2);
        sfx('ui');
      }
    }
    f.def?.update?.(this, f, dt);
    this.updateAura(f, dt);
  }

  private updateAura(f: Fighter, dt: number) {
    if (!f.def) return;
    let col = -1;
    let amt = 0.12;
    let sc = 1;
    let rate = 0;
    let pcol = 0xffffff;
    if (f.form === 'adult') { col = 0x0e6a24; amt = 0.26; sc = 1.35; rate = 18; pcol = 0x1fe05a; }
    else if (f.form === 'god') { col = 0xaee6ff; amt = 0.22; sc = 1.2; rate = 22; pcol = 0xdff6ff; }
        else if (f.form === 'guanyin') { col = 0xffc93a; amt = 0.24; sc = 1.25; rate = 20; pcol = 0xffe07a; }
    else if (f.form === 'terps') { col = 0xff6aa8; amt = 0.22; sc = 1.2; rate = 22; pcol = 0xff9ac8; }
    else if (f.form === 'scythe') { col = 0xff7ad0; amt = 0.2; sc = 1.2; rate = 16; pcol = 0xff9ae0; }
    else if (f.form === 'emperor') { col = 0xff2a2a; amt = 0.2; sc = 1.15; rate = 14; pcol = 0xff4a4a; }
    else if (f.form === 'deep') { col = 0x6a5a8a; amt = 0.2; sc = 1.15; rate = 10; pcol = 0x8a7aa8; }
    else if (f.kind === 'gon' && f.meter >= 99) { col = 0x8dff6a; amt = 0.08; rate = 6; pcol = 0x8dff6a; }
    else if (f.kind === 'killua' && f.meter >= 99) { col = 0x9fe8ff; amt = 0.07; rate = 8; pcol = 0x9fe8ff; }
    else if ((f.st.auraT ?? 0) > 0) { col = f.def.color; amt = 0.12; rate = 8; pcol = f.def.color; }
    f.auraCol = col;
    f.auraAmt = amt;
    f.auraScale = sc;
    if (rate > 0 && !f.dead && Math.random() < dt * rate) this.fx.aura(f.pos, pcol, 1, 3.4 * f.scaleNow, 0.9);
    if (f.form === 'god' && Math.random() < dt * 9) {
      const a = f.chestPos();
      const b = a.clone().add(new THREE.Vector3(rand(-2, 2), rand(-1.5, 1.5), rand(-2, 2)));
      this.fx.bolt(a, b, 0xcfefff, 0.1, 0.07, 0, 0.4);
    }
    if (f.st.fistCharge && f.st.fistCharge > 0) {
      const hp = f.handPos();
      this.fx.gather(hp, 0x8dff6a, 0.6 + f.st.fistCharge, 2);
    }
  }

  private simulate(dt: number, real: number) {
    this.processTimers(dt);
    this.updatePlayer(dt);
    for (const f of this.fighters) {
      if (f.ai?.type === 'bandit') this.updateBandit(f, dt);
      else if (f.ai?.type === 'rival') this.updateRival(f, dt);
    }
    for (const f of [...this.fighters]) {
      f.tick(dt);
      if (!this.frozen) this.updateStatus(f, dt);
      this.moveFighter(f, dt);
    }
    this.separate();
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateTrails();
    this.fx.update(dt);
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

  // ------------------------------------------------------------------ camera / overlays
  private updateCamera(real: number) {
    const p = this.player;
    this.camShift += ((this.shiftLock ? 1 : 0) - this.camShift) * Math.min(1, real * 10);
    const pivot = new THREE.Vector3(p.pos.x, 2.7 + p.pos.y * 0.7, p.pos.z);
        this.camDistNow += (this.camDist - this.camDistNow) * Math.min(1, real * 9);
    const dist = this.camDistNow * (1 - 0.2 * this.camShift);
    const cp = Math.cos(this.camPitch);
    const rx = -Math.cos(this.camYaw);
    const rz = Math.sin(this.camYaw);
    pivot.x += rx * 2.1 * this.camShift;
    pivot.z += rz * 2.1 * this.camShift;
    const cam = new THREE.Vector3(
      pivot.x - Math.sin(this.camYaw) * cp * dist,
      pivot.y + Math.sin(this.camPitch) * dist,
      pivot.z - Math.cos(this.camYaw) * cp * dist
    );
        const look = pivot.clone();
    if (cam.y < 0.7) {
      look.y += 0.7 - cam.y;
      cam.y = 0.7;
    }
    if (this.shakeAmt > 0.001) {
      cam.x += rand(-1, 1) * this.shakeAmt;
      cam.y += rand(-1, 1) * this.shakeAmt;
      cam.z += rand(-1, 1) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-9 * real);
    }
    const fov = 62 + this.fovKick + (p.form === 'god' ? 4 : 0);
    this.fovKick *= Math.exp(-6 * real);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.copy(cam);
        this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
    this.fx.setScale(this.renderer.domElement.height, this.camera.fov);
  }

  private updateOverlays(real: number) {
    const v = new THREE.Vector3();
    for (const f of this.fighters) {
      if (!f.label) continue;
      const head = new THREE.Vector3(f.pos.x, f.pos.y + 4.3 * f.scaleNow, f.pos.z);
      const dist = this.camera.position.distanceTo(head);
      if (f.dead || dist > 70 || !this.project(head, v) || this.stage === 'menu') {
        f.label.style.display = 'none';
        continue;
      }
      f.label.style.display = 'block';
      const x = (v.x * 0.5 + 0.5) * this.w;
      const y = (-v.y * 0.5 + 0.5) * this.h;
      f.label.style.transform = `translate(${x - 38}px,${y - 24}px)`;
      if (f.labelFill) f.labelFill.style.width = `${(f.hp / f.maxHp) * 100}%`;
    }
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
    // custom cursor
    const show = this.stage !== 'menu' && !this.paused && !this.needLock;
    this.cursorEl.style.display = show ? 'block' : 'none';
    if (show) {
      const cx = this.shiftLock ? this.w / 2 : this.cursor.x;
      const cy = this.shiftLock ? this.h / 2 : this.cursor.y;
      this.cursorEl.style.transform = `translate(${cx}px,${cy}px)`;
      this.arrowEl.style.display = this.shiftLock ? 'none' : 'block';
      this.crossEl.style.display = this.shiftLock ? 'block' : 'none';
      const ring = this.crossEl.firstElementChild as HTMLElement;
      ring.style.borderColor = this.pAim.target ? '#ff5a5a' : '#ffffff';
    }
    this.canvas.style.cursor = 'none';
  }

  private emitHud(_force = false) {
    void _force;
    if (this.stage === 'menu' || !this.player) return;
    const p = this.player;
    const def = CHARS[this.playerKind];
    const now = performance.now();
    const r = this.rival && !this.rival.dead ? this.rival : null;
    const arr = this.cdArr(p);
    const mx = this.cdMaxArr(p);
    const skills = p.skillsDefs.map((s, i) => ({ key: s.key, name: s.name, desc: s.desc, cost: s.cost, cd: arr[i], cdMax: mx[i], charging: p.charging?.i === i }));
    const formName = p.form === 'adult' ? 'ADULT GON' : p.form === 'god' ? 'GODSPEED' : p.form === 'exhaust' ? 'EXHAUSTED' : p.form === 'emperor' ? 'EMPEROR TIME' : p.form === 'deep' ? 'DEEP PURPLE' : p.form === 'guanyin' ? (p.kind === 'knuckle' ? 'KEN' : '100-TYPE GUANYIN') : p.form === 'terps' ? 'TERPSICHORA' : p.form === 'scythe' ? 'JACKPOT 7-7-7' : '';
    let hint = '';
    if (this.paused && this.needLock) hint = 'start';
    this.cb.onHud({
      stage: this.stage, kind: this.playerKind, name: p.name, level: this.level, xp: this.xp, xpNeed: this.xpNeed(), beli: this.beli,
      hp: Math.max(0, p.hp), maxHp: p.maxHp, energy: p.energy, maxEnergy: p.maxEnergy,
      meter: { name: def.meter.name, color: def.meter.color, value: p.meter, max: p.meterMax },
      form: p.form ? { name: formName, t: p.formT, max: p.formMax, kind: p.form } : null,
      skills, dashCd: p.dashCd, dashMax: p.dashMax,
      rival: r ? { name: r.name, hp: r.hp, maxHp: r.maxHp, form: r.form } : null,
      quest: this.quest ? { ...this.quest } : null,
      banner: now < this.bannerUntil ? this.bannerText : '', sub: now < this.bannerUntil ? this.bannerSub : '',
      countdown: this.countdown, shiftLock: this.shiftLock, fade: this.fade, paused: this.paused, locked: this.locked, needLock: this.needLock,
      charge: p.charging ? Math.min(1, p.charging.t / p.charging.max) : -1,
      mapName: this.cur.name, sens: this.sens, hint,
    });
  }

  // ------------------------------------------------------------------ main loop
  private frame(real: number) {
    this.time += real;
    if (this.stage === 'menu') {
      this.frameMenu(real);
      return;
    }
    this.updateCamera(real);
    this.computeAim();
    if (!this.paused) {
      let dt = real;
      if (this.hitStop > 0) {
        this.hitStop -= real;
        dt *= 0.1;
      }
      this.simulate(dt, real);
    } else {
      // keep poses alive
      for (const f of this.fighters) f.updatePose(0, this.time);
    }
    this.sun.position.set(this.player.pos.x + 30, 60, this.player.pos.z + 20);
    this.sun.target.position.copy(this.player.pos);
    this.updateOverlays(real);
    this.hudT -= real;
    if (this.hudT <= 0) {
      this.hudT = 0.066;
      this.emitHud();
    }
    this.composer.render();
  }

  private frameMenu(real: number) {
    const t = this.time;
    this.canvas.style.cursor = 'default';
    this.cursorEl.style.display = 'none';
    for (const k of ALL_KINDS) {
      const f = this.menuF[k];
      const show = this.menuHover === k;
      f.root.visible = show;
      if (!show) continue;
      f.tick(real);
      f.boostT = 1;
      f.boostColor = CHARS[k].color;
            f.targetYaw = -0.35 + this.menuSpin + this.menuPtr.x * 0.45 + Math.sin(t * 0.7) * 0.18;
      if (Math.random() < real * 18) this.fx.aura(new THREE.Vector3(3.2, 0.6, 0), CHARS[k].color, 1, 3.6, 1.4);
      if (!f.anim && Math.random() < 0.012) f.setAnim(['jabR', 'hookL', 'castFwd', 'kickR', 'slashR', 'upperR'][Math.floor(Math.random() * 6)], 0.55);
      f.updatePose(real, t);
    }
    this.fx.update(real);
    this.cur.update(real, t);
        this.menuPulse *= Math.exp(-3 * real);
    if (!this.menuDrag) this.menuSpin *= Math.exp(-0.5 * real);
    this.camera.position.set(this.menuPtr.x * 1.6, 3.8 - this.menuPtr.y * 0.8, 12.5 - this.menuPulse * 1.2);
    this.camera.lookAt(0.6 + this.menuPtr.x * 0.5, 1.9, 0);
    this.camera.updateMatrixWorld();
    this.sun.position.set(18, 40, 25);
    this.sun.target.position.set(0, 0, 0);
    this.composer.render();
  }
}

// kept for chars that want to draw a ghost
export { buildSilhouette };
export type { SkillDef };
