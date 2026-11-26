import * as THREE from 'three';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { CHARS } from '../chars';
import { ALL_KINDS, type PlayableKind } from '../defs';
import { REWORKS } from '../balance';
import { sfx, setMusic } from '../audio';
import { buildGreedIsland, type GreedWorld } from './world';
import {
  CARDS, SPELL_IDS, RANK_COLOR, RANK_VALUE, ZONE_PHASES, MONS, POIS, DUNGEONS, MAP_R, CHAT, poi, rollCard, rollRank, resetIssued,
  makePersonalities, makeNames, type Rank, type Pers, type MonDef, type Card, type Pass,
} from './data';

export type Format = 'solo' | 'duos' | 'squads';
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const KP: Partial<Record<PlayableKind, number>> = { gon: 1.1, killua: 1.08, netero: 1.18, hisoka: 1.08, zeno: 1.12, knuckle: 1.05 };
const RPOW: Record<Rank, number> = { SS: 0.14, S: 0.06, A: 0.03, B: 0.015, C: 0.008, D: 0.004, E: 0.002, F: 0.001, G: 0.0005 };
const MAX_SPELLS = 18;
const START_J = 3000;
const EXPECT: [number, number][] = [[0, 100], [90, 99], [300, 88], [540, 72], [780, 54], [1020, 35], [1200, 20], [1380, 9], [1500, 2]];
const expectedAlive = (t: number) => { for (let i = 1; i < EXPECT.length; i++) if (t < EXPECT[i][0]) { const [t0, a0] = EXPECT[i - 1], [t1, a1] = EXPECT[i]; return a0 + ((a1 - a0) * (t - t0)) / (t1 - t0); } return 1; };

interface Bot {
  id: number; name: string; kind: PlayableKind; team: number; pers: Pers; x: number; z: number; hp: number; maxHp: number; level: number; alive: boolean;
  inv: string[]; jenny: number; kills: number; state: 'travel' | 'work' | 'fight' | 'zone' | 'dead'; stateT: number; goal: { x: number; z: number } | null; work: string;
  fightT: number; foe: Bot | null; f: Fighter | null; shield: number; revealT: number; hideT: number; chatT: number; hostile: boolean; ally: boolean; cp: number;
  tgt: Fighter | null; tgtT: number; react: number; seen: boolean; spellT: number; fleeing: number; met: boolean;
}
interface Pickup { id: number; x: number; z: number; card?: string; jenny?: number; herb?: boolean; rank: Rank; ttl: number }
interface Chest { id: number; x: number; z: number; tier: number; opened: boolean; big?: boolean }
interface MonSp { id: number; def: MonDef; x: number; z: number; hx: number; hz: number; hp: number; alive: boolean; f: Fighter | null; name: string; atkT: number; windT: number; spawned: boolean }
interface Npc { id: string; name: string; x: number; z: number; f: Fighter | null; tint: number; yaw: number; variant: number }
interface FieldZone { x: number; z: number; r: number; t: number; max: number; heal: number; slow: number; imm: boolean; dps: number; dmg: number; team: string; color: number; acc: number }
interface Quest { id: string; title: string; desc: string; prog: number; goal: number; reward: string; done: boolean }
interface Summon { f: Fighter; until: number; owner: Fighter }
interface Team { id: number; members: Bot[]; hasPlayer: boolean; place: number }

export interface CardView { id: string; n: number }
export interface DialogOpt { id: string; label: string; sub?: string; disabled?: boolean }
export interface Dialog { id: string; title: string; npc: string; text: string; opts: DialogOpt[]; reels?: string[]; hand?: { you: string[]; king: string[] }; targets?: { id: string; label: string; sub?: string }[] }
export interface BrHudState {
  begun: boolean; over: boolean; cut: { lines: { title?: string; text: string; who?: string }[]; t: number; len: number; skip: boolean; flash: number } | null;
  time: number; alive: number; teams: number; kills: number; format: Format;
  zone: { r: number; phase: number; closing: boolean; tNext: number; nextR: number; dps: number; started: boolean };
  outside: boolean; edge: number; jenny: number; binderOpen: boolean; mapOpen: boolean;
  spells: CardView[]; spec: Record<string, number>; specCount: number; spellCount: number;
  prompt: { text: string; key: string } | null; dialog: Dialog | null;
  quests: Quest[]; feed: { text: string; color: string }[]; toasts: { text: string; color: string }[];
  mini: { x: number; z: number; yaw: number; safeR: number; nextR: number; marks: { x: number; z: number; t: string; label?: string }[] };
  allies: { name: string; hp: number; maxHp: number; alive: boolean }[];
  effects: { name: string; t: number; max: number; color: string }[]; casting: { name: string; t: number; max: number } | null;
  boss: { name: string; hp: number; maxHp: number } | null; trade: { name: string; give: string; want: string } | null;
  esp: { x: number; y: number; name: string; dist: number; color: string }[]; warn: string; dodge: { t: number; lives: number } | null; luck: number;
  result: { placement: number; kills: number; time: number; cards: number; jenny: number; victory: boolean; monsters: number } | null;
  met: { id: string; label: string; sub: string }[]; towns: { id: string; label: string }[]; hasFriends: boolean; shield: number; shieldMax: number; revealAll: boolean;
}
const QUESTS: Record<string, { title: string; desc: string; goal: number; reward: string }> = {
  cards: { title: "Eta's Welcome", desc: 'Pick up 3 cards from the ground or chests', goal: 3, reward: '3,000 J + a D-rank card' },
  prize: { title: 'Antokiba Prize Contest', desc: 'Defeat 3 monsters', goal: 3, reward: 'An A-rank Specified Slot card' },
  cyclops: { title: "Biscuit's Training", desc: 'Defeat 3 Cyclops in the Badlands', goal: 3, reward: "Mad Scientist's Steroids + 2,500 J" },
  herbs: { title: 'Sick Villagers', desc: 'Gather 4 medicinal herbs around the bandit village', goal: 4, reward: 'Wild Luck Alexandrite' },
  pirates: { title: "Razor's Pirates", desc: 'Defeat the Pirate Captain at the Soufrabi lighthouse', goal: 1, reward: 'Blue Planet (SS)' },
  bounty: { title: 'Bounty Board', desc: 'Eliminate the marked player', goal: 1, reward: '5,000 J + a rare card' },
};
const CUT: { t: number; title?: string; text: string; who?: string }[] = [
  { t: 0.4, title: 'GREED ISLAND', text: 'A game conjured by Ging Freecss and the Game Masters — sealed by Nen.' },
  { t: 4.2, text: 'Welcome, Hunters. Say “Book” to open your Binder. Collect cards, cast spells, clear the island.', who: 'Eta' },
  { t: 8.4, text: 'But only one Hunter — or team — will claim Ruler’s Blessing. The rest will be sent home.', who: 'Eta' },
  { t: 12, text: 'The Game Masters will scatter you with the Magic Teleport Circle. Spawn points are evenly spaced.', who: 'Razor' },
  { t: 15.2, text: 'The Nen Barrier rises after one minute… and it will not stop closing.', who: 'Razor' },
];
const CUT_LEN = 18.5;
const NPC_DEFS: { id: string; name: string; poi: string; dx: number; dz: number; tint: number; variant: number }[] = [
  { id: 'eta', name: 'Eta · Game Master', poi: 'shiso', dx: 10, dz: 12, tint: 0x7be08a, variant: 0 },
  { id: 'trade', name: 'Trade Shop Clerk', poi: 'antokiba', dx: 8, dz: 8, tint: 0xd8a860, variant: 1 },
  { id: 'board', name: 'Bounty Board Keeper', poi: 'antokiba', dx: -6, dz: -12, tint: 0xf2d060, variant: 2 },
  { id: 'diner', name: 'Cat Diner Waiter', poi: 'antokiba', dx: -12, dz: 12, tint: 0xf0a860, variant: 3 },
  { id: 'spells', name: 'Spell Card Shopkeeper', poi: 'masadora', dx: 0, dz: 14, tint: 0xc07aff, variant: 2 },
  { id: 'king', name: 'Casino King', poi: 'dorias', dx: 0, dz: 17, tint: 0xff4fd8, variant: 1 },
  { id: 'biscuit', name: 'Biscuit · Trainer', poi: 'badlands', dx: 6, dz: 5, tint: 0xffa0c0, variant: 3 },
  { id: 'razor', name: 'Razor · Game Master', poi: 'dodgeball', dx: 0, dz: -9, tint: 0xff6a5a, variant: 0 },
  { id: 'elena', name: 'Elena · Game Master', poi: 'port', dx: 10, dz: 8, tint: 0x6ad0ff, variant: 2 },
  { id: 'sick', name: 'Sick Villager', poi: 'bandits', dx: 4, dz: 5, tint: 0xb8b8a0, variant: 1 },
];
const HINTS: Record<string, string> = { cyclops: 'Cyclops guard the Badlands', beetle: 'Giant insects guard rare items', beast: 'Beasts roam Bunzen forest' };

export class BR {
  g: Game; kind: PlayableKind; format: Format; world: GreedWorld;
  begun = false; over = false; t = 0; cutT = 0; cutDone = false; cutFlash = 0; cutSkip = false; cutActive = false; teleported = false;
  bots: Bot[] = []; teams: Team[] = []; myTeam!: Team;
  pickups: Pickup[] = []; chests: Chest[] = []; mons: MonSp[] = []; npcs: Npc[] = []; fields: FieldZone[] = []; summons: Summon[] = [];
  inv: string[] = []; jenny = START_J; kills = 0; monsKilled = 0; cardsFound = 0; jennyEarned = 0; pb: Pass = {};
  binderOpen = false; mapOpen = false; dialog: Dialog | null = null; dialogNpc = ''; quests: Quest[] = []; feed: { text: string; color: string; t: number }[] = []; toasts: { text: string; color: string; t: number }[] = [];
  casting: { name: string; t: number; max: number; cid: number } | null = null; useCd = 0; combatT = 0;
  sp = { x: 0, z: 0 }; pidSeq = 1; nextId = 1; result: BrHudState['result'] = null; warn = ''; warnT = 0;
  scanT = 0; scanR = 0; scanAll = false; espT = 0; espR = 0; espThrough = false; traced: Bot | null = null; traceT = 0; richT = 0;
  dodge: { t: number; lives: number; ballT: number; razor: Fighter | null } | null = null;
  trade: { bot: Bot; give: string; want: string } | null = null; tradeT = 60; hunterT = 100; boss: MonSp | null = null; bossDone = false; drops = 0; surgeT = 0; surgeBase = 0;
  forfeit = false; deathHow = '';
  lf: { t: number; ex: number; ez: number } | null = null; visited = new Set<string>(['shiso']); metSet = new Set<number>(); pers: Pers[] = [];
  private cardMesh: THREE.InstancedMesh; private beamMesh: THREE.InstancedMesh; private chestMesh: THREE.InstancedMesh; private bookMesh: THREE.Group;
  private zoneRings: THREE.Mesh[] = []; private hudAcc = 0; private stepAcc = 0; private matAcc = 0; private zoneAcc = 0; private incomeAcc = 0; private lastPhase = -1; private phaseFx = -1; private finalFx = false;
  private cosmetics: Fighter[] = []; private expectBoost = 1; private sacUsed = false; private lastPlayerPos = V();

  constructor(g: Game, kind: PlayableKind, format: Format) {
    g.br = this;
    this.g = g; this.kind = kind; this.format = format;
    resetIssued();
    this.world = buildGreedIsland();
    g.scene.add(this.world.group);
    g.cur = this.world;
    g.setEnv(this.world.env);
    g.camera.far = 1700;
    g.camera.updateProjectionMatrix();

    const cg = new THREE.BoxGeometry(1.5, 2.1, 0.08);
    this.cardMesh = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0xffffff }), 700);
    this.cardMesh.frustumCulled = false; this.cardMesh.count = 0;
    const bg = new THREE.CylinderGeometry(0.2, 0.2, 30, 8, 1, true).translate(0, 15, 0);
    this.beamMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), 400);
    this.beamMesh.frustumCulled = false; this.beamMesh.count = 0;
    const chg = new THREE.BoxGeometry(2.6, 1.7, 1.8).translate(0, 0.85, 0);
    this.chestMesh = new THREE.InstancedMesh(chg, new THREE.MeshLambertMaterial({ color: 0xffffff }), 400);
    this.chestMesh.frustumCulled = false; this.chestMesh.count = 0;
    g.scene.add(this.cardMesh, this.beamMesh, this.chestMesh);
    const book = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.3), new THREE.MeshLambertMaterial({ color: 0x5a2a1a }));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 1.2), new THREE.MeshBasicMaterial({ color: 0xf4ecd0 }));
    const gold = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd24a).multiplyScalar(1.8) }));
    gold.position.z = 0.45;
    book.add(cover, pages, gold);
    book.visible = false;
    this.bookMesh = book;

    this.pers = shuffle(makePersonalities());
    this.setupTeams();
    this.setupWorldContent();
    // cutscene stage: everyone gathers at the Shiso Tree
    g.stage = 'transition';
    g.frozen = true;
    const s = poi('shiso');
    const p = g.player;
    p.pos.set(s.x, 0, s.z + 24);
    p.faceNow(Math.PI);
    g.camYaw = Math.PI;
    let i = 0;
    for (const b of this.myTeam.members) { b.x = s.x + 3 * (++i) * (i % 2 ? 1 : -1); b.z = s.z + 26; this.materialize(b); }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 6.28 + 0.4;
      const f = g.spawn(pick(ALL_KINDS), 'none', false, 0);
      f.pos.set(s.x + Math.cos(a) * 11, 0, s.z + 30 + Math.sin(a) * 6);
      f.faceNow(Math.PI);
      this.cosmetics.push(f);
    }
    setMusic('brLobby');
  }

  // ------------------------------------------------------------------ setup
  private setupTeams() {
    const g = this.g;
    const per = this.format === 'solo' ? 1 : this.format === 'duos' ? 2 : 4;
    const nTeams = 100 / per;
    const names = makeNames(99);
    const kinds = shuffle([...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS]);
    const pts = this.spawnPoints(nTeams);
    for (let i = 0; i < nTeams; i++) this.teams.push({ id: i, members: [], hasPlayer: i === 0, place: 0 });
    let id = 0;
    for (let tI = 0; tI < nTeams; tI++) {
      const cnt = tI === 0 ? per - 1 : per;
      for (let m = 0; m < cnt; m++) {
        const kind = kinds[id % kinds.length];
        const pers = this.pers[id];
        const def = CHARS[kind];
        const sp = pts[tI];
        const b: Bot = {
          id, name: names[id], kind, team: tI, pers, x: sp.x + Math.cos(m * 1.7) * 3, z: sp.z + Math.sin(m * 1.7) * 3, hp: def.hp, maxHp: def.hp, level: 1, alive: true,
          inv: ['s100', pick(['p1003', 'p1001', 'p1009', 'p1025']), pick(['p1038', 'p1031', 'p1019', 'p1002'])], jenny: START_J + Math.floor(rand(-800, 1500)), kills: 0, state: 'work', stateT: rand(3, 9), goal: null, work: 'loot',
          fightT: 0, foe: null, f: null, shield: 0, revealT: 0, hideT: 0, chatT: rand(10, 45), hostile: false, ally: tI === 0, cp: 1, tgt: null, tgtT: 0, react: 0, seen: false, spellT: rand(8, 30), fleeing: 0, met: false,
        };
        this.bots.push(b);
        this.teams[tI].members.push(b);
        id++;
      }
    }
    this.myTeam = this.teams[0];
    this.sp = pts[0];
    const p = g.spawn(this.kind, 'player', true, 0);
    g.player = p;
    g.applyLevel();
    p.hp = p.maxHp;
    this.inv = ['s100', 'p1003', 'p1009', 'p1001'];
    this.recompute();
  }

  private spawnPoints(n: number) {
    const R0 = MAP_R * 0.86;
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const r = R0 * Math.sqrt((i + 0.5) / n);
      const a = i * 2.39996323;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      for (let k = 0; k < 40 && this.world.blocked(x, z, 3.5); k++) { x += Math.cos(a + k) * 4; z += Math.sin(a + k) * 4; }
      out.push({ x, z });
    }
    shuffle(out);
    return out;
  }

  private freeNear(x: number, z: number, r = 3) {
    for (let k = 0; k < 40; k++) {
      const a = k * 2.4, d = k * 1.2;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (!this.world.blocked(px, pz, r) && Math.hypot(px, pz) < MAP_R - 8) return { x: px, z: pz };
    }
    return { x, z };
  }

  private setupWorldContent() {
    const w = this.world;
    for (const c of w.chestSpots) this.chests.push({ id: this.nextId++, x: c.x, z: c.z, tier: c.tier, opened: false });
    for (const s of w.lootSpots) {
      if (Math.random() < 0.74) { const id = rollCard(s.tier, 0, 0.55); this.pickups.push({ id: this.nextId++, x: s.x, z: s.z, card: id, rank: CARDS[id].rank, ttl: 1e9 }); }
      else this.pickups.push({ id: this.nextId++, x: s.x, z: s.z, jenny: Math.round(rand(300, 1200) * (1 + s.tier * 0.8)), rank: 'S', ttl: 1e9 });
    }
    for (const h of w.herbSpots) this.pickups.push({ id: this.nextId++, x: h.x, z: h.z, herb: true, rank: 'D', ttl: 1e9 });
    const addMon = (def: string, x: number, z: number, nameSfx = '') => {
      const d = MONS[def];
      const p = this.freeNear(x, z, 2.5 * d.scale);
      this.mons.push({ id: this.nextId++, def: d, x: p.x, z: p.z, hx: p.x, hz: p.z, hp: d.hp, alive: true, f: null, name: d.name + nameSfx, atkT: 1, windT: 0, spawned: false });
    };
    const around = (id: string, n: number, d0: number, d1: number, def: string) => { const p = poi(id); for (let i = 0; i < n; i++) { const a = rand(0, 6.28), d = rand(d0, d1); addMon(def, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d); } };
    around('badlands', 9, 70, 230, 'cyclops');
    around('bunzen', 3, 40, 130, 'beast');
    for (const [x, z] of [[-420, 130], [-560, -120]]) addMon('beast', x, z);
    for (const id of ['rubicuta', 'aiai', 'antokiba', 'shiso']) { const p = poi(id); const a = rand(0, 6.28); for (let i = 0; i < 3; i++) addMon('locust', p.x + Math.cos(a) * 130 + rand(-8, 8), p.z + Math.sin(a) * 130 + rand(-8, 8)); }
    around('mansion', 2, 40, 70, 'beetle');
    for (const d of DUNGEONS) { addMon('beetle', d.x + 22, d.z + 6); addMon('golem', d.x, d.z + 11, ' · ' + d.name); }
    const lh = poi('lighthouse');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; addMon('pirate', lh.x + Math.cos(a) * 20, lh.z + Math.sin(a) * 20); }
    addMon('captain', lh.x + 6, lh.z + 14);
    const mn = poi('mansion');
    addMon('guard', mn.x, mn.z + 30);
    for (const d of NPC_DEFS) { const p = poi(d.poi); const q = this.freeNear(p.x + d.dx, p.z + d.dz, 1.5); this.npcs.push({ id: d.id, name: d.name, x: q.x, z: q.z, f: null, tint: d.tint, yaw: rand(0, 6.28), variant: d.variant }); }
  }

  // ------------------------------------------------------------------ cutscene / start
  begin() {
    if (this.begun) return;
    this.begun = true;
    this.cutActive = true;
    this.g.paused = false;
    const fog = this.g.scene.fog as THREE.Fog | null;
    if (fog) { fog.near = 700; fog.far = 3400; } // clear skies for the aerial cutscene
    this.toast('Press B / tap BINDER to open your card binder · E interact · R heal · M map', '#ffe8a0');
  }
  skipCut() { if (this.cutActive && this.cutT > 2) this.cutT = Math.max(this.cutT, 15.9); }

  cutCamera(cam: THREE.PerspectiveCamera, real: number): boolean {
    if (!this.cutActive && !(this.teleported && this.cutFlash > 0)) return false;
    if (!this.cutActive) return false;
    void real;
    const t = this.cutT;
    const s = poi('shiso');
    if (this.cutDone) {
      const k = clamp((t - 16) / 2.4, 0, 1), e = k * k * (3 - 2 * k);
      const pp = this.g.player.pos;
      cam.position.set(pp.x + Math.sin(this.g.camYaw) * -12 * (1 - e), 9 + (1 - e) * 80, pp.z + Math.cos(this.g.camYaw) * -14 - (1 - e) * 10);
      cam.lookAt(pp.x, 3, pp.z);
      return true;
    }
    if (t < 5) {
      const a = -0.6 + t * 0.14;
      cam.position.set(Math.cos(a) * 780, 340 - t * 8, Math.sin(a) * 780);
      cam.lookAt(0, 30, 0);
    } else if (t < 10) {
      const k = (t - 5) / 5, e = k * k * (3 - 2 * k);
      cam.position.set(s.x + 110 - 84 * e, 80 - 62 * e, s.z + 170 - 118 * e);
      cam.lookAt(s.x, 12 + (1 - e) * 20, s.z + 14);
    } else {
      const k = (t - 10) / 8;
      const a = Math.PI * 0.5 + k * 1.2;
      cam.position.set(s.x + Math.cos(a) * 24, 7 + k * 5, s.z + 28 + Math.sin(a) * 24 - 10);
      cam.lookAt(s.x, 4.5, s.z + 27);
    }
    return true;
  }

  private updateCut(dt: number) {
    this.cutT += dt;
    this.cutFlash = Math.max(0, this.cutFlash - dt * 2);
    const s = poi('shiso');
    if (this.cutT > 10 && !this.cosmetics[0]?.st.circle) {
      if (this.cosmetics[0]) this.cosmetics[0].st.circle = 1;
      for (let i = 0; i < 4; i++) this.g.fx.ring(V(s.x, 0, s.z + 27), 0xb08cff, 2, 16 + i * 3, 3, 0.15 + i * 0.1);
      this.g.fx.pillar(V(s.x, 0, s.z + 27), 0xb08cff, 12, 60, 6);
      sfx('charge');
    }
    if (this.cutT > 15.3 && this.cutFlash === 0 && !this.cutDone && this.cutT < 15.6) { this.cutFlash = 1; this.g.flash('#ffffff', 0.9); sfx('boom'); }
    if (this.cutT >= 16 && !this.cutDone) this.teleportAll();
    if (this.cutT >= CUT_LEN) { this.cutActive = false; this.finishStart(); }
    // keep camera focus for chunk culling
    this.world.setFocus(this.cutT < 10 ? 0 : s.x, this.cutT < 10 ? 0 : s.z, this.cutT < 10 ? 1300 : 900);
  }

  private teleportAll() {
    this.cutDone = true;
    const g = this.g;
    for (const f of this.cosmetics) { g.fx.pillar(f.pos, 0xb08cff, 2.2, 50, 1.2); g.removeFighter(f); g.fighters = g.fighters.filter((x) => x !== f); }
    this.cosmetics = [];
    const p = g.player;
    g.fx.pillar(p.pos, 0xffffff, 3, 70, 1.4);
    const sp = this.freeNear(this.sp.x, this.sp.z, 3);
    p.pos.set(sp.x, 0, sp.z);
    p.vy = 0;
    g.camYaw = Math.atan2(-sp.x, -sp.z) + Math.PI;
    p.faceNow(Math.atan2(-sp.x, -sp.z));
    let i = 0;
    for (const b of this.myTeam.members) if (b.f) { const q = this.freeNear(sp.x + Math.cos(i * 2) * 4, sp.z + Math.sin(i * 2) * 4, 1.5); b.f.pos.set(q.x, 0, q.z); b.x = q.x; b.z = q.z; i++; }
    g.fx.pillar(V(sp.x, 0, sp.z), 0xb08cff, 4, 90, 2);
    g.fx.ring(V(sp.x, 0, sp.z), 0xffffff, 1, 14, 1.2);
    sfx('level');
  }

  private finishStart() {
    const g = this.g;
    this.teleported = true;
    const fog = g.scene.fog as THREE.Fog | null;
    if (fog) { fog.near = this.world.env.fogN; fog.far = this.world.env.fogF; }
    g.stage = 'arena';
    g.frozen = false;
    g.player.invuln = 2.5;
    g.camPitch = 0.35; g.camDist = 15; g.camDistNow = 15;
    setMusic('brMatch');
    g.banner('GREED ISLAND', `${this.format === 'solo' ? 'SOLO · 100 players' : this.format === 'duos' ? 'DUOS · 50 teams' : 'SQUADS · 25 teams'} — the Nen Barrier rises at 1:00`, 4.5);
    this.toast('Explore, loot cards, complete missions — you are not forced to fight right away.', '#bfe8ff');
  }

  // ------------------------------------------------------------------ cards / inventory
  count(id: string) { let n = 0; for (const c of this.inv) if (c === id) n++; return n; }
  has(id: string) { return this.inv.includes(id); }
  get spellCount() { return this.inv.filter((c) => c[0] === 'p').length; }
  get luck() { return (this.pb.luck ?? 0); }
  addCard(id: string, quiet = false): boolean {
    const c = CARDS[id];
    if (!c) return false;
    if (c.kind === 'spell' && this.spellCount >= MAX_SPELLS) { this.toast('Free-slot pockets are full! Use or drop a spell.', '#ff9a9a'); return false; }
    this.inv.push(id);
    this.cardsFound++;
    this.recompute();
    if (!quiet) {
      this.toast(`+ ${c.name} [${c.rank}]`, RANK_COLOR[c.rank]);
      sfx('card');
      if (RANK_VALUE[c.rank] >= RANK_VALUE.A) { sfx('level'); this.g.popup(this.g.player, `${c.rank}-RANK: ${c.name.toUpperCase()}!`, RANK_COLOR[c.rank], 24); }
    }
    this.progress('cards', 1);
    return true;
  }
  removeCard(id: string) { const i = this.inv.indexOf(id); if (i >= 0) { this.inv.splice(i, 1); this.recompute(); return true; } return false; }
  addJenny(n: number, quiet = false) {
    const v = Math.round(n * (1 + (this.pb.jenny ?? 0)));
    this.jenny += v; this.jennyEarned += v;
    if (!quiet && v >= 100) this.toast(`+${v.toLocaleString()} J`, '#ffe066');
  }
  discount() { return clamp(this.pb.shop ?? 0, 0, 0.6); }
  recompute() {
    const pb: Pass = {};
    const seen = new Set<string>();
    for (const id of this.inv) {
      if (seen.has(id)) continue;
      seen.add(id);
      const ps = CARDS[id]?.pass;
      if (!ps) continue;
      for (const k of Object.keys(ps) as (keyof Pass)[]) {
        const v = ps[k];
        if (typeof v === 'number') (pb as Record<string, number>)[k] = ((pb as Record<string, number>)[k] ?? 0) + v;
        else if (v) (pb as Record<string, boolean>)[k] = true;
      }
    }
    this.pb = pb;
    const g = this.g, p = g.player;
    if (!p) return;
    const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    g.applyLevel();
    p.hp = Math.min(p.maxHp, Math.max(p.hp, p.maxHp * ratio));
    p.st.cdRate = (pb.cdr ?? 0);
    p.st.shMax = Math.max(60, 60 + (pb.shield ?? 0) + 40);
    if (this.has('s000')) p.st.beaconPass = 1;
  }
  private botPower(b: Bot) {
    let cp = 1;
    for (const id of b.inv) cp += RPOW[CARDS[id]?.rank ?? 'G'];
    b.cp = cp;
    const rw = REWORKS[b.kind] ? 1.08 : 1;
    return (b.hp + b.shield) * (0.75 + 0.5 * b.pers.skill) * (KP[b.kind] ?? 1) * rw * (1 + 0.07 * (b.level - 1)) * cp;
  }
  private richness(inv: string[]) { let v = 0; for (const id of inv) v += RANK_VALUE[CARDS[id]?.rank ?? 'G']; return v; }
  get myValue() { return this.richness(this.inv); }

  // ------------------------------------------------------------------ toasts / feed / quests
  toast(text: string, color = '#ffffff') { this.toasts.push({ text, color, t: 4.5 }); if (this.toasts.length > 5) this.toasts.shift(); }
  private feedAdd(text: string, color = '#ffffff') { this.feed.push({ text, color, t: 9 }); if (this.feed.length > 7) this.feed.shift(); }
  private say(b: Bot, kind: keyof typeof CHAT.chill, chance = 1) {
    if (!b.f || b.f.dead || Math.random() > chance) return;
    this.g.popup(b.f, pick(CHAT[b.pers.style][kind]), '#ffffff', 15);
  }
  startQuest(id: string, title?: string, desc?: string, reward?: string) {
    if (this.quests.some((q) => q.id === id)) return;
    const d = QUESTS[id];
    this.quests.push({ id, title: title ?? d.title, desc: desc ?? d.desc, prog: 0, goal: d.goal, reward: reward ?? d.reward, done: false });
    this.toast(`NEW MISSION: ${title ?? d.title}`, '#ffe066');
    sfx('ui');
  }
  progress(id: string, n = 1) {
    const q = this.quests.find((x) => x.id === id && !x.done);
    if (!q) return;
    q.prog = Math.min(q.goal, q.prog + n);
    if (q.prog >= q.goal) this.completeQuest(q);
  }
  private completeQuest(q: Quest) {
    q.done = true;
    sfx('level');
    this.toast(`MISSION COMPLETE: ${q.title}`, '#7dff9a');
    switch (q.id) {
      case 'cards': this.addJenny(3000); this.addCard(rollRank('D')); break;
      case 'prize': this.addCard(rollRank('A')); this.addJenny(2000); break;
      case 'cyclops': this.addCard('s070'); this.addJenny(2500); break;
      case 'herbs': this.addCard('s075'); break;
      case 'pirates': this.addCard('s081'); break;
      case 'bounty': this.addJenny(5000); this.addCard(rollRank('B')); break;
    }
    window.setTimeout(() => { this.quests = this.quests.filter((x) => x !== q); }, 6000);
  }

  // ------------------------------------------------------------------ zone
  zoneAt(t: number) {
    let prev = MAP_R;
    for (let i = 0; i < ZONE_PHASES.length; i++) {
      const ph = ZONE_PHASES[i];
      if (t < ph.t0) return { r: prev, phase: i, closing: false, tNext: ph.t0 - t, to: ph.r, dps: i === 0 ? 0 : ZONE_PHASES[i - 1].dps, started: i > 0 || t >= 0 && false };
      if (t < ph.t1) { const k = (t - ph.t0) / (ph.t1 - ph.t0); return { r: prev + (ph.r - prev) * k, phase: i, closing: true, tNext: ph.t1 - t, to: ph.r, dps: ph.dps, started: true }; }
      prev = ph.r;
    }
    return { r: 0, phase: ZONE_PHASES.length - 1, closing: true, tNext: 0, to: 0, dps: 14, started: true };
  }
  get safeR() { return this.zoneAt(this.t).r; }
  private zoneStep(dt: number) {
    const z = this.zoneAt(this.t);
    const level = clamp(z.phase / 7, 0, 1);
    this.world.setBarrier(z.r, level, this.t >= 60);
    if (z.phase !== this.lastPhase) {
      if (z.closing && z.phase !== this.phaseFx) {
        this.phaseFx = z.phase;
        const msg = z.phase === 0 ? 'THE GAME MASTER’S NEN BARRIER HAS APPEARED' : `NEN BARRIER CLOSING · PHASE ${z.phase + 1}`;
        this.g.banner(msg, z.phase === 0 ? 'Stay inside the glowing circle — the barrier burns anything outside' : `Safe zone shrinking to ${Math.round(z.to)}m`, 4);
        sfx('thunder');
        this.g.flash('#b08cff', 0.25);
        if (z.phase >= 2 && z.phase % 2 === 0) { this.surgeT = 22; this.toast('BARRIER SURGE: damage doubled outside for 22s!', '#ff7a7a'); }
        if (z.phase % 2 === 1 || z.phase === 2) this.spawnDrop();
        if (z.phase === 5 && !this.finalFx) { this.finalFx = true; this.finalArena(); }
        if (z.phase === 5) setMusic('brFinal');
      }
      this.lastPhase = z.phase;
    }
    this.surgeT = Math.max(0, this.surgeT - dt);
    this.zoneAcc += dt;
    if (this.zoneAcc < 0.5) return;
    const tick = this.zoneAcc;
    this.zoneAcc = 0;
    if (!z.started || z.dps <= 0 || this.t < 60) return;
    const dps = z.dps * (this.surgeT > 0 ? 2 : 1) * 0.01;
    const g = this.g;
    for (const f of g.fighters) {
      if (f.dead || (!f.isPlayer && f.st.botId === undefined && !f.st.ally)) continue;
      if (f.st.ally) continue;
      if (Math.hypot(f.pos.x, f.pos.z) <= z.r) continue;
      if ((f.st.barrierImmT ?? 0) > 0 || this.inImmZone(f.pos.x, f.pos.z)) continue;
      const k = f.isPlayer ? 1 - (this.pb.guard ? 0.1 : 0) : 1;
      g.damage(f, f, Math.max(2, f.maxHp * dps * tick * k), { dot: true, noCrit: true, noMeter: true, pierce: true, color: 0xb08cff });
    }
    for (const b of this.bots) {
      if (!b.alive || b.f) continue;
      if (Math.hypot(b.x, b.z) <= z.r) continue;
      b.hp -= b.maxHp * dps * tick;
      if (b.hp <= 0) this.finalizeBot(b, null, 'was consumed by the Nen Barrier');
    }
  }
  private inImmZone(x: number, z: number) { return this.fields.some((f) => f.imm && Math.hypot(x - f.x, z - f.z) < f.r); }
  private finalArena() {
    const g = this.g;
    g.banner("THE GAME MASTERS' COLOSSEUM", 'The final safe zone is forced into the arena. No more hiding.', 5);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28; g.fx.pillar(V(Math.cos(a) * 30, 0, Math.sin(a) * 30), 0xffd24a, 1.4, 80, 8); }
    sfx('boom');
  }
  private spawnDrop() {
    const r = this.safeR;
    const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * Math.max(10, r * 0.7);
    const q = this.freeNear(Math.cos(a) * d, Math.sin(a) * d, 4);
    this.chests.push({ id: this.nextId++, x: q.x, z: q.z, tier: 3, opened: false, big: true });
    this.drops++;
    this.g.banner('GREED DROP INCOMING', 'A Game Master supply chest landed in the safe zone — look for the golden beam!', 4);
    this.g.fx.pillar(V(q.x, 0, q.z), 0xffd24a, 3, 90, 3);
    sfx('level');
    this.toast('Greed Drop: contains A–SS cards. Marked on your map.', '#ffd24a');
  }

  // ------------------------------------------------------------------ main update
  update(dt: number) {
    if (!this.begun) return;
    const g = this.g;
    if (this.cutActive) { this.updateCut(dt); this.hudTick(dt); return; }
    if (!this.teleported) return;
    const p = g.player;
    this.t += dt;
    this.combatT = Math.max(0, this.combatT - dt);
    this.useCd = Math.max(0, this.useCd - dt);
    this.warnT = Math.max(0, this.warnT - dt);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter((f) => f.t > 0);
    this.lastPlayerPos.copy(p.pos);
    this.world.setFocus(p.pos.x, p.pos.z);
    this.zoneStep(dt);
    this.timeline(dt);
    this.fieldsStep(dt);
    this.passives(dt);
    this.stepAcc += dt;
    if (this.stepAcc >= 0.25) { const s = this.stepAcc; this.stepAcc = 0; this.botStep(s); }
    this.moveAbstract(dt);
    this.matAcc += dt;
    if (this.matAcc > 0.3) { this.matAcc = 0; this.materializeStep(); }
    this.botFighters(dt);
    this.monstersStep(dt);
    this.summonsStep(dt);
    this.npcStep();
    this.pickupsStep(dt);
    this.eventsStep(dt);
    this.renderPickups(dt);
    if (this.casting && p.castId !== this.casting.cid) this.casting = null;
    if (this.casting) this.casting.t += dt;
    // cleanup dead bodies
    for (const f of [...g.fighters]) if (f.dead && !f.isPlayer && f.deathT > 2.2) { g.removeFighter(f); g.fighters = g.fighters.filter((x) => x !== f); }
  }

  private timeline(dt: number) {
    void dt;
    if (this.t > 540 && !this.boss && !this.bossDone) {
      const d = MONS.genthru, h = poi('bomber');
      const m: MonSp = { id: this.nextId++, def: d, x: h.x, z: h.z, hx: h.x, hz: h.z, hp: d.hp, alive: true, f: null, name: d.name, atkT: 2, windT: 0, spawned: false };
      this.mons.push(m); this.boss = m;
      this.g.banner('WORLD BOSS: GENTHRU THE BOMBER', 'A convicted Bomber has broken into the Bomber Hideout. Big rewards await — bring friends.', 5);
      sfx('thunder');
      this.toast('Genthru marked on your map: the Bomber Hideout.', '#ff9a6a');
    }
    // hunters after your valuable cards
    this.hunterT -= dt;
    if (this.hunterT <= 0) { this.hunterT = 95; if (this.myValue >= 24000 && !this.over) this.spawnHunters(); }
    this.tradeT -= dt;
  }

  private spawnHunters() {
    const g = this.g, p = g.player;
    const n = this.myValue > 100000 ? 3 : 2;
    g.banner('BOUNTY ALERT', 'Hostile NPC Hunters are after your valuable cards!', 3.5);
    sfx('thunder');
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28);
      const q = this.freeNear(p.pos.x + Math.cos(a) * 55, p.pos.z + Math.sin(a) * 55, 2);
      const f = g.spawn(pick(ALL_KINDS), 'hunter', false, 0);
      f.name = 'Bomber Hunter';
      f.pos.set(q.x, 0, q.z);
      const def = CHARS[f.kind as PlayableKind];
      f.maxHp = f.hp = Math.round(def.hp * 1.25);
      const ai = g.makeAI('rival', f); ai.type = 'bot'; ai.active = true; ai.tempo = 1.05; ai.aggr = 0.7; f.ai = ai;
      f.st.hunt = 1;
      f.addMarker(0xff3030);
      g.createLabel(f);
      if (f.labelName) f.labelName.textContent = 'HUNTER';
    }
  }

  // ------------------------------------------------------------------ passives & effects on the player
  private passives(dt: number) {
    const g = this.g, p = g.player;
    if (p.dead) return;
    const pb = this.pb;
    p.st.cdRate = pb.cdr ?? 0;
    // regeneration & income
    if (pb.regen) g.heal(p, p.maxHp * pb.regen * dt, true);
    if (pb.energy) p.energy = Math.min(p.maxEnergy, p.energy + 7.5 * pb.energy * dt);
    if (pb.income) { this.incomeAcc += dt; if (this.incomeAcc >= 12) { this.incomeAcc = 0; this.addJenny(pb.income); } }
    // shield regen (Shield of Faith)
    if ((pb.shield ?? 0) > 0 && (p.st.hurtT ?? 0) <= 0 && (p.st.shield ?? 0) < (p.st.shMax ?? 100)) p.st.shield = Math.min(p.st.shMax ?? 100, (p.st.shield ?? 0) + 5 * dt);
    if (pb.sac && !this.sacUsed && p.hp < p.maxHp * 0.3) { this.sacUsed = true; g.addShield(p, pb.sac); g.popup(p, 'SACRIFICE ARMOR!', '#ffc83a', 22); }
    p.atkSpeed = (p.st.atkBuffT ?? 0) > 0 && !p.inForm ? 1.2 : p.atkSpeed;
    if ((p.st.atkBuffT ?? 0) <= 0 && p.atkSpeed === 1.2) p.atkSpeed = 1;
    // healing over time pool
    if ((p.st.hotT ?? 0) > 0) g.heal(p, (p.st.hotRate ?? 0) * dt, true);
    // stealth
    const stealth = (p.st.stealthT ?? 0) > 0;
    if (stealth !== !!p.st.stealthOn) { p.st.stealthOn = stealth ? 1 : 0; for (const m of p.rig.mats) { m.transparent = stealth; m.opacity = stealth ? 0.2 : 1; m.needsUpdate = true; } }
    if (!stealth && (p.st.decoyAlive ?? 0)) p.st.decoyAlive = 0;
    // book model on the hand
    if (this.bookMesh.parent !== p.rig.handL) p.rig.handL.add(this.bookMesh);
    this.bookMesh.visible = this.binderOpen;
    this.bookMesh.position.set(0, 0.2, 0.4);
    // in-combat tag
    if ((p.st.hurtT ?? 0) > 3.5) this.combatT = Math.max(this.combatT, 0);
  }

  private fieldsStep(dt: number) {
    const g = this.g, p = g.player;
    for (const z of this.fields) {
      z.t -= dt; z.acc += dt;
      if (z.acc > 0.6) { g.fx.ring(V(z.x, 0, z.z), z.color, 1, z.r, 0.9, 0.12); g.fx.aura(V(z.x + rand(-z.r, z.r) * 0.6, 0, z.z + rand(-z.r, z.r) * 0.6), z.color, 1, 3, 0.8); z.acc = 0; }
      for (const f of g.fighters) {
        if (f.dead || Math.hypot(f.pos.x - z.x, f.pos.z - z.z) > z.r) continue;
        const friend = f.team === z.team;
        if (friend) { if (z.heal) g.heal(f, f.maxHp * z.heal * dt, true); if (z.dmg) f.st.zoneDmgT = 0.5; }
        else if (f.team !== 'none') {
          if (z.slow) g.applySlow(f, 0.4, 1 - z.slow);
          if (z.dps) { f.st.zoneAcc = (f.st.zoneAcc ?? 0) + dt; if (f.st.zoneAcc > 0.5) { f.st.zoneAcc = 0; g.damage(p, f, z.dps * 0.5, { dot: true, noCrit: true, noMeter: true, color: z.color }); } }
        }
      }
    }
    this.fields = this.fields.filter((z) => z.t > 0);
    p.dmgMult = p.dmgMult; // (kept for clarity: zone buff handled via zoneDmgT in damage multiplier below)
  }
  zoneDmgBoost(f: Fighter) { return (f.st.zoneDmgT ?? 0) > 0 ? 1.2 : 1; }

  // ------------------------------------------------------------------ bots: abstract simulation
  private aliveCount() { let n = this.g.player.dead ? 0 : 1; for (const b of this.bots) if (b.alive) n++; return n; }
  private teamsAlive() { let n = 0; for (const t of this.teams) if ((t.hasPlayer && !this.g.player.dead) || t.members.some((m) => m.alive)) n++; return n; }

  private chooseGoal(b: Bot) {
    const z = this.zoneAt(this.t);
    const safe = Math.max(18, (z.closing ? z.to : z.r) * 0.82);
    const rr = z.closing ? z.r : z.r;
    const outsideNext = Math.hypot(b.x, b.z) > Math.max(safe, 20);
    const early = this.t < 40;
    if (!early && (outsideNext || (z.closing && Math.hypot(b.x, b.z) > z.r - 25) || (!z.closing && z.tNext < 70 && Math.hypot(b.x, b.z) > safe * 0.9))) {
      const a = Math.atan2(b.z, b.x) + rand(-0.8, 0.8), d = safe * rand(0.15, 0.7);
      b.goal = { x: Math.cos(a) * d, z: Math.sin(a) * d }; b.work = this.t > 1000 ? 'camp' : 'loot'; b.state = 'zone'; return;
    }
    const P = b.pers;
    const opts: [string, number][] = [['loot', 1 + P.greed * 2 + P.curio], ['camp', P.patience * 1.6 * (this.t > 300 ? 1.4 : 0.5)], ['mon', P.aggr * P.skill * 1.5 + 0.1], ['casino', b.jenny > 1500 ? P.greed * P.curio * 1.4 : 0], ['shop', b.jenny > 7000 ? P.spells * 2.2 : 0], ['quest', P.curio * 0.9], ['dungeon', P.curio * P.skill * 0.7], ['hunt', P.aggr * 0.22 * Math.min(1.5, this.expectBoost) * (this.t > 180 ? 1 : 0)]];
    let sum = 0;
    for (const o of opts) sum += o[1];
    let r = Math.random() * sum;
    let w = 'loot';
    for (const o of opts) { r -= o[1]; if (r <= 0) { w = o[0]; break; } }
    let tx = b.x, tz = b.z;
    const inSafe = (x: number, zz: number) => Math.hypot(x, zz) < Math.max(safe, rr * 0.9, 20);
    if (w === 'loot' || w === 'quest') {
      const cands = POIS.filter((p) => inSafe(p.x, p.z)).sort(() => Math.random() - 0.5).slice(0, 5);
      cands.sort((a, c) => (c.tier * P.greed * 3 + rand(0, 2) - Math.hypot(c.x - b.x, c.z - b.z) / (200 + P.curio * 400)) - (a.tier * P.greed * 3 + rand(0, 2) - Math.hypot(a.x - b.x, a.z - b.z) / (200 + P.curio * 400)));
      const p = cands[0];
      if (p) { const a = rand(0, 6.28), d = rand(0, p.r * 0.6); tx = p.x + Math.cos(a) * d; tz = p.z + Math.sin(a) * d; } else w = 'camp';
    } else if (w === 'mon') { const m = this.mons.filter((x) => x.alive && !x.def.boss && inSafe(x.x, x.z)); const mm = m.length ? pick(m) : null; if (mm) { tx = mm.x; tz = mm.z; } else w = 'loot'; }
    else if (w === 'casino') { const p = poi('dorias'); tx = p.x; tz = p.z; if (!inSafe(tx, tz)) w = 'camp'; }
    else if (w === 'shop') { const p = poi('masadora'); tx = p.x; tz = p.z; if (!inSafe(tx, tz)) w = 'camp'; }
    else if (w === 'dungeon') { const d = pick(DUNGEONS); tx = d.x; tz = d.z + 10; if (!inSafe(tx, tz)) w = 'camp'; }
    else if (w === 'hunt') { const pp = this.g.player.pos; tx = pp.x + rand(-50, 50); tz = pp.z + rand(-50, 50); if (!inSafe(tx, tz) || this.g.player.dead) w = 'loot'; }
    if (w === 'camp') { const a = rand(0, 6.28), d = rand(0.05, 0.6) * safe; tx = Math.cos(a) * d; tz = Math.sin(a) * d; }
    // team members follow their leader
    if (!b.ally) { const lead = this.teams[b.team].members.find((m) => m.alive); if (lead && lead !== b) { tx = lead.x + rand(-5, 5); tz = lead.z + rand(-5, 5); w = 'camp'; } }
    b.goal = { x: tx, z: tz }; b.work = w; b.state = 'travel';
  }

  private finishWork(b: Bot) {
    const P = b.pers;
    const near = POIS.reduce((best, p) => (Math.hypot(p.x - b.x, p.z - b.z) < Math.hypot(best.x - b.x, best.z - b.z) ? p : best), POIS[0]);
    const luck = P.greed * 0.1;
    const give = (id: string) => { b.inv.push(id); if (b.inv.length > 40) { let wi = 0, wv = 1e9; b.inv.forEach((c, i) => { const v = RANK_VALUE[CARDS[c].rank]; if (v < wv && c !== 's017') { wv = v; wi = i; } }); b.inv.splice(wi, 1); } };
    switch (b.work) {
      case 'loot': { const n = 1 + Math.floor(Math.random() * 3 + P.greed * 1.5); for (let i = 0; i < n; i++) give(rollCard(Math.max(0, near.tier - (Math.hypot(near.x - b.x, near.z - b.z) > near.r ? 1 : 0)), luck, 0.5)); b.jenny += Math.round(rand(300, 1500)); break; }
      case 'mon': {
        const pw = this.botPower(b);
        const win = Math.random() < clamp(pw / (pw + 260 + Math.random() * 300), 0.2, 0.92);
        if (win) { give(rollCard(1, luck, 0.5)); b.jenny += Math.round(rand(600, 2000)); b.level = Math.min(8, b.level + (Math.random() < 0.4 ? 1 : 0)); }
        else { b.hp -= b.maxHp * rand(0.2, 0.55); if (b.hp <= 0) this.finalizeBot(b, null, 'was crushed by a monster'); }
        break;
      }
      case 'casino': { const bet = Math.min(b.jenny, 1000 * (1 + Math.floor(P.greed * 3))); b.jenny -= bet; if (Math.random() < 0.46 + P.greed * 0.05) { b.jenny += bet * 2; if (Math.random() < 0.05) give(rollRank(pick<Rank>(['A', 'S']))); } break; }
      case 'shop': if (b.jenny >= 10000) { b.jenny -= 10000; for (let i = 0; i < 3; i++) give(pick(SPELL_IDS)); } break;
      case 'quest': give(rollCard(1, luck, 0.4)); b.jenny += 1500; break;
      case 'dungeon': { const win = Math.random() < clamp(this.botPower(b) / 900, 0.15, 0.8); if (win) { for (let i = 0; i < 3; i++) give(rollCard(3, luck, 0.4)); b.level = Math.min(8, b.level + 1); } else { b.hp -= b.maxHp * rand(0.3, 0.7); if (b.hp <= 0) this.finalizeBot(b, null, 'fell in a dungeon'); } break; }
      case 'camp': b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.3); break;
    }
    if (b.hp < b.maxHp * 0.95 && b.work !== 'camp') b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.12 * (0.5 + P.healAt));
    b.shield = Math.min(60, b.shield + (b.inv.includes('p1003') ? 0 : 0));
  }

  private botStep(dt: number) {
    const g = this.g;
    const alive = this.aliveCount();
    this.expectBoost = clamp(1 + (alive - expectedAlive(this.t)) / 7, 0.03, 3);
    for (const b of this.bots) {
      if (!b.alive) continue;
      b.revealT = Math.max(0, b.revealT - dt); b.hideT = Math.max(0, b.hideT - dt); b.spellT -= dt; b.chatT -= dt;
      if (b.ally && b.f) continue;
      const pos = b.f ? b.f.pos : null;
      if (pos) { b.x = pos.x; b.z = pos.z; b.hp = b.f!.hp; }
      b.stateT -= dt;
      if (!b.goal && b.state !== 'fight') this.chooseGoal(b);
      if (b.state === 'travel' || b.state === 'zone') {
        if (b.goal && Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 6) { b.state = 'work'; b.stateT = b.work === 'camp' ? rand(20, 70) * (0.5 + b.pers.patience) : b.work === 'casino' ? rand(10, 22) : rand(6, 22); if (b.work === 'mon' || b.work === 'dungeon') b.stateT = rand(8, 16); }
        else if (b.stateT < -90) { b.goal = null; this.chooseGoal(b); b.stateT = 0; }
      } else if (b.state === 'work') {
        if (b.stateT <= 0) { this.finishWork(b); if (b.alive) { b.goal = null; this.chooseGoal(b); } }
        else if (this.zoneAt(this.t).closing && Math.hypot(b.x, b.z) > this.zoneAt(this.t).r - 30) { b.goal = null; this.chooseGoal(b); }
      } else if (b.state === 'fight') {
        if (!b.f) { b.fightT -= dt; if (b.fightT <= 0) this.resolveFight(b); }
      }
      if (!b.f && b.alive) {
        // passive healing for abstract bots
        if (b.state !== 'fight') b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.004 * dt);
        if (b.chatT <= 0) b.chatT = rand(40, 100);
      }
      // bots use spells on nearby enemies
      if (b.f && b.spellT <= 0 && b.f.ai && !b.ally) this.botSpellOnPlayer(b);
    }
    this.encounters(dt);
    // trades offered by friendly bots
    if (this.tradeT <= 0 && !this.trade && !this.dialog && this.combatT <= 0) {
      const p = g.player;
      const cand = this.bots.find((b) => b.alive && b.f && !b.ally && !b.hostile && b.pers.social > 0.55 && b.pers.aggr < 0.5 && Math.hypot(b.f.pos.x - p.pos.x, b.f.pos.z - p.pos.z) < 22 && !(b.f.st.hurtT > 0));
      this.tradeT = rand(70, 120);
      if (cand) {
        const mine = this.inv.filter((c) => c !== 's100');
        if (mine.length && cand.inv.length) {
          const want = pick(mine);
          const rk = CARDS[want].rank;
          const give = cand.inv.filter((c) => c !== 's100' && RANK_VALUE[CARDS[c].rank] >= RANK_VALUE[rk] * 0.6 && RANK_VALUE[CARDS[c].rank] <= RANK_VALUE[rk] * 1.8);
          if (give.length) { this.trade = { bot: cand, give: pick(give), want }; this.say(cand, 'greet'); }
        }
      }
    }
  }

  private encounters(dt: number) {
    const live = this.bots.filter((b) => b.alive && !b.f && b.state !== 'fight');
    const cell = new Map<number, Bot[]>();
    const CS = 60;
    for (const b of live) { const k = Math.floor(b.x / CS) * 4096 + Math.floor(b.z / CS); const a = cell.get(k); if (a) a.push(b); else cell.set(k, [b]); }
    const fighting = this.bots.filter((b) => b.alive && b.state === 'fight' && !b.f);
    for (const a of live) {
      if (a.state === 'fight') continue;
      const ci = Math.floor(a.x / CS), cj = Math.floor(a.z / CS);
      let best: Bot | null = null, bd = 1e9;
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const b of cell.get(i * 4096 + j) ?? []) {
        if (b === a || b.team === a.team || b.state === 'fight') continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < bd) { bd = d; best = b; }
      }
      const enc = 30 + 22 * a.pers.curio;
      if (best && bd < enc) {
        const hide = a.hideT > 0 || best.hideT > 0 ? 0.3 : 1;
        const passive = a.pers.aggr < 0.28 && best.pers.aggr < 0.28;
        // encounter RATE (per second while in range): calm early game, ramps up as the island gets crowded
        const early = this.t < 90 ? 0.12 : this.t < 240 ? 0.45 : 1;
        const lam = (0.005 + 0.02 * (a.pers.aggr + best.pers.aggr) / 2) * this.expectBoost * hide * (passive ? 0.1 : 1) * early * (1 + this.t / 800);
        if (Math.random() < 1 - Math.exp(-lam * dt)) this.startFight(a, best);
      } else if (a.pers.patience > 0.5 && a.pers.aggr > 0.5) {
        // vultures walk toward ongoing fights
        const f = fighting.find((q) => Math.hypot(q.x - a.x, q.z - a.z) < 110);
        if (f && Math.random() < 0.05 * this.expectBoost) { a.goal = { x: f.x + rand(-6, 6), z: f.z + rand(-6, 6) }; a.work = 'camp'; a.state = 'travel'; }
      }
    }
  }
  private startFight(a: Bot, b: Bot) {
    a.state = b.state = 'fight';
    a.foe = b; b.foe = a;
    a.fightT = b.fightT = rand(8, 18);
  }
  private sideOf(b: Bot) { return this.teams[b.team].members.filter((m) => m.alive && !m.f && Math.hypot(m.x - b.x, m.z - b.z) < 40); }
  private resolveFight(a: Bot) {
    const b = a.foe;
    a.foe = null;
    if (!b || !b.alive || b.state !== 'fight') { a.state = 'work'; a.stateT = 3; return; }
    b.foe = null;
    const A = this.sideOf(a), B = this.sideOf(b);
    const pa = A.reduce((s, m) => s + this.botPower(m), 0), pb = B.reduce((s, m) => s + this.botPower(m), 0);
    const aWins = Math.random() < pa / (pa + pb);
    const win = aWins ? A : B, lose = aWins ? B : A;
    const wl = aWins ? pb / (pa + pb) : pa / (pa + pb);
    const killer = win.reduce((best, m) => (m.pers.aggr > best.pers.aggr ? m : best), win[0]);
    for (const m of win) { m.hp -= m.maxHp * clamp(0.2 + wl * 0.6 + rand(-0.1, 0.1), 0.1, 0.85); if (m.hp <= 0) m.hp = m.maxHp * 0.06; m.state = 'work'; m.stateT = rand(4, 10); m.goal = null; m.foe = null; }
    for (const m of lose) {
      m.foe = null;
      if (Math.random() < 0.72 - m.pers.caution * 0.15) this.finalizeBot(m, killer, 'eliminated');
      else { m.hp = Math.max(m.hp * 0.2, 6); m.state = 'work'; m.stateT = rand(6, 14); m.goal = null; m.work = 'camp'; }
    }
    killer.level = Math.min(9, killer.level + 1);
  }

  private moveAbstract(dt: number) {
    for (const b of this.bots) {
      if (!b.alive || b.f || (b.state !== 'travel' && b.state !== 'zone') || !b.goal) continue;
      const dx = b.goal.x - b.x, dz = b.goal.z - b.z, d = Math.hypot(dx, dz);
      const sp = 9.6 * (0.85 + 0.3 * b.pers.skill) * dt;
      if (d <= sp) { b.x = b.goal.x; b.z = b.goal.z; } else { b.x += (dx / d) * sp; b.z += (dz / d) * sp; }
    }
  }

  private finalizeBot(b: Bot, by: Bot | Fighter | null, how: string) {
    if (!b.alive) return;
    // Angel's Breath / Book of Life
    const holder = this.teams[b.team].members.find((m) => m.alive && m.inv.includes('s017') && Math.hypot(m.x - b.x, m.z - b.z) < 40) ?? (b.inv.includes('s093') ? b : undefined);
    if (holder && b.id !== -1) {
      const id = holder.inv.includes('s017') ? 's017' : 's093';
      holder.inv.splice(holder.inv.indexOf(id), 1);
      b.hp = b.maxHp * (id === 's017' ? 0.6 : 0.3);
      if (b.f) { b.f.dead = false; b.f.hp = b.hp; b.f.invuln = 2; this.g.popup(b.f, id === 's017' ? "ANGEL'S BREATH!" : 'BOOK OF LIFE!', '#ffe066', 22); this.g.fx.pillar(b.f.pos, 0xffe066, 2, 40, 1); }
      return;
    }
    b.alive = false; b.state = 'dead';
    if (b.f) { this.say(b, 'die'); }
    const killerName = by ? (by as Bot).name ?? (by as Fighter).name : null;
    const isMe = by && (by as Fighter).isPlayer;
    const killerBot = by && (by as Bot).pers ? (by as Bot) : null;
    if (killerBot) { killerBot.kills++; if (killerBot.f) this.say(killerBot, 'kill', 0.7); killerBot.jenny += Math.round(b.jenny * 0.4); }
    // drops
    const items = b.inv.filter((c) => c !== 's100');
    const p = this.freeNear(b.x, b.z, 1);
    const near = Math.hypot(p.x - this.lastPlayerPos.x, p.z - this.lastPlayerPos.z) < 160;
    if (killerBot && !near && !killerBot.f) { for (const c of items) killerBot.inv.push(c); }
    else items.forEach((c, i) => { const a = (i / Math.max(1, items.length)) * 6.28; this.pickups.push({ id: this.nextId++, x: p.x + Math.cos(a) * 2.2, z: p.z + Math.sin(a) * 2.2, card: c, rank: CARDS[c].rank, ttl: 600 }); });
    if (b.jenny > 200) this.pickups.push({ id: this.nextId++, x: p.x, z: p.z, jenny: Math.round(b.jenny * 0.6), rank: 'S', ttl: 600 });
    b.inv = [];
    const tm = this.teams[b.team];
    const col = isMe ? '#7dff9a' : '#ffffff';
    this.feedAdd(killerName ? `${killerName} ${isMe ? 'eliminated' : 'eliminated'} ${b.name}` : `${b.name} ${how}`, col);
    if (!tm.members.some((m) => m.alive) && !(tm.hasPlayer && !this.g.player.dead)) tm.place = this.teamsAlive() + 1;
    if (isMe) { this.kills++; this.g.gainXp(60, 0); this.checkBounty(b); this.addJenny(Math.round(b.jenny * 0.3)); }
    if (this.traced === b) this.traced = null;
    this.checkEnd();
  }
  private checkBounty(b: Bot) { const q = this.quests.find((x) => x.id === 'bounty' && x.desc.includes(b.name)); if (q) this.progress('bounty', 1); }

  private checkEnd() {
    if (this.over) return;
    if (this.teamsAlive() <= 1 && !this.g.player.dead) {
      this.over = true;
      const g = this.g;
      g.stage = 'over';
      setMusic('victory');
      this.result = { placement: 1, kills: this.kills, time: this.t, cards: this.cardsFound, jenny: this.jennyEarned, victory: true, monsters: this.monsKilled };
      g.banner('GREED ISLAND CLEARED!', "Ruler's Blessing is yours — #1 VICTORY ROYALE", 6);
      g.player.invuln = 999;
      g.player.setAnim('victory', 99);
      for (let i = 0; i < 8; i++) g.later(i * 0.4, () => g.fx.pillar(V(g.player.pos.x + rand(-10, 10), 0, g.player.pos.z + rand(-10, 10)), pick([0xffd24a, 0xff6ad8, 0x6ad0ff]), 1.5, 60, 1.2));
      sfx('level');
      g.later(4.5, () => g.cb.onEnd('victory'));
    }
  }

  // ------------------------------------------------------------------ materialization
  materialize(b: Bot) {
    if (b.f || !b.alive) return;
    const g = this.g;
    const f = g.spawn(b.kind, b.ally ? 'player' : 't' + b.team, false, 0);
    f.name = b.name;
    f.maxHp = b.maxHp + (b.level - 1) * 25;
    f.hp = Math.min(f.maxHp, b.hp + (b.level - 1) * 25);
    f.pos.set(b.x, 0, b.z);
    f.faceNow(rand(0, 6.28));
    f.dmgMult = 1 + 0.05 * (b.level - 1);
    f.st.botId = b.id;
    f.st.shield = b.shield;
    const ai = g.makeAI('rival', f);
    ai.type = 'bot'; ai.active = true; ai.tempo = 0.8 + 0.5 * b.pers.skill; ai.aggr = 0.3 + 0.6 * b.pers.aggr; ai.dodge = 0.1 + 0.3 * b.pers.skill;
    f.ai = ai;
    if (b.ally) f.st.ally = 0;
    g.createLabel(f);
    if (f.labelName) {
      f.labelName.textContent = b.name;
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:9px;font-weight:600;color:#ffe0a0;opacity:.85;margin-top:1px';
      sub.textContent = b.pers.title;
      f.labelName.appendChild(sub);
    }
    if (b.ally && f.labelFill) f.labelFill.style.background = 'linear-gradient(#7dff9a,#12a34a)';
    b.f = f; b.tgt = null; b.fleeing = 0;
    if (b.state === 'fight') { b.state = 'work'; b.stateT = 2; b.foe = null; }
  }
  private dematerialize(b: Bot) {
    const f = b.f;
    if (!f) return;
    b.x = f.pos.x; b.z = f.pos.z; b.hp = Math.max(1, f.hp); b.shield = f.st.shield ?? 0;
    this.g.removeFighter(f);
    this.g.fighters = this.g.fighters.filter((x) => x !== f);
    b.f = null;
  }
  private materializeStep() {
    const p = this.g.player;
    const fx = p.pos.x, fz = p.pos.z;
    let n = 0;
    for (const b of this.bots) if (b.f) n++;
    let made = 0;
    const cand: { b: Bot; d: number }[] = [];
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = Math.hypot(b.x - fx, b.z - fz);
      if (b.f) {
        if (b.ally) { if (d > 90) { const q = this.freeNear(fx + rand(-5, 5), fz + rand(-5, 5), 1.5); b.f.pos.set(q.x, 0, q.z); } continue; }
        if (d > 120 && !(b.f.st.hurtT > 0) && !(b.tgt && !b.tgt.dead)) { this.dematerialize(b); n--; }
      } else if (b.ally) { const q = this.freeNear(fx + rand(-4, 4), fz + rand(-4, 4), 1.5); b.x = q.x; b.z = q.z; this.materialize(b); n++; }
      else if (d < 74) cand.push({ b, d });
    }
    cand.sort((a, c) => a.d - c.d);
    for (const c of cand) { if (n >= 15 || made >= 2) break; this.materialize(c.b); n++; made++; }
    // monsters
    for (const m of this.mons) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - fx, m.z - fz);
      if (!m.f && d < 105) this.spawnMon(m);
      else if (m.f && d > 160 && !(m.def.boss && m === this.boss && m.f.st.aggro)) { m.x = m.f.pos.x; m.z = m.f.pos.z; m.hp = m.f.hp; this.g.removeFighter(m.f); this.g.fighters = this.g.fighters.filter((x) => x !== m.f); m.f = null; }
    }
    for (const nn of this.npcs) {
      const d = Math.hypot(nn.x - fx, nn.z - fz);
      if (!nn.f && d < 100) this.spawnNpc(nn);
      else if (nn.f && d > 150) { this.g.removeFighter(nn.f); this.g.fighters = this.g.fighters.filter((x) => x !== nn.f); nn.f = null; }
    }
  }
  private tintFighter(f: Fighter, tint: number, k = 0.6) { const c = new THREE.Color(tint); for (const m of f.rig.mats) m.color.lerp(c, k); }
  private spawnNpc(n: Npc) {
    const g = this.g;
    const f = g.spawn('bandit', 'none', false, n.variant);
    f.name = n.name; f.pos.set(n.x, 0, n.z); f.faceNow(n.yaw); f.baseSpeed = 0; f.invuln = 1e9;
    this.tintFighter(f, n.tint, 0.55);
    g.createLabel(f);
    if (f.labelName) { f.labelName.textContent = n.name; f.labelName.style.color = '#ffe8a0'; }
    if (f.labelFill?.parentElement) f.labelFill.parentElement.style.display = 'none';
    f.st.npc = 1;
    n.f = f;
  }
  private spawnMon(m: MonSp, team = 'monster', owner?: Fighter) {
    const g = this.g;
    const d = m.def;
    const f = g.spawn('bandit', team, false, d.variant);
    f.name = m.name; f.maxHp = d.hp; f.hp = m.hp; f.baseSpeed = d.spd;
    f.rig.baseScale *= d.scale; f.scaleNow = f.rig.baseScale; f.radius = 0.75 * d.scale;
    this.tintFighter(f, d.tint, 0.7);
    f.pos.set(m.x, 0, m.z); f.faceNow(rand(0, 6.28));
    f.st.monId = m.id; f.ai = null;
    f.dmgMult = 1;
    g.createLabel(f);
    if (f.labelName) { f.labelName.textContent = (d.boss ? '☠ ' : '') + m.name; f.labelName.style.color = d.boss ? '#ff9a6a' : '#ffd0a0'; }
    if (owner && f.labelFill) f.labelFill.style.background = 'linear-gradient(#7dff9a,#12a34a)';
    if (d.boss) f.addMarker(0xff6a3a);
    m.f = f; m.spawned = true;
    return f;
  }

  // ------------------------------------------------------------------ bots: real combat AI
  private findTarget(b: Bot, f: Fighter): Fighter | null {
    const g = this.g;
    const perc = 30 + 40 * b.pers.skill;
    let best: Fighter | null = null, bd = perc;
    for (const t of g.fighters) {
      if (t.dead || t === f || t.team === f.team || t.team === 'none' || t.invuln > 50) continue;
      const d = Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
      if (d >= bd) continue;
      if (t.isPlayer && (t.st.stealthT ?? 0) > 0 && d > 5) continue;
      const isMon = t.team === 'monster' || t.team === 'hunter';
      if (isMon && d > 22 && !b.ally) continue;
      if (!b.ally && !isMon) {
        const key = 'dec' + (t.isPlayer ? 'P' : t.st.botId ?? t.name);
        if (f.st[key] === undefined) {
          // decide once whether this bot attacks on sight
          const p = t.isPlayer ? 0.18 + 0.82 * b.pers.aggr : 0.3 + 0.7 * b.pers.aggr;
          f.st[key] = Math.random() < p ? 1 : 0;
          if (f.st[key] === 0) this.say(b, 'greet', 0.8);
          else if (t.isPlayer) this.say(b, 'taunt', 0.4);
        }
        if (f.st[key] === 0 && !b.hostile && !(t.isPlayer ? false : f.st.hurtT > 0)) continue;
      }
      bd = d; best = t;
    }
    return best;
  }

  private botFighters(dt: number) {
    const g = this.g;
    for (const b of this.bots) {
      const f = b.f;
      if (!f || f.dead) continue;
      b.x = f.pos.x; b.z = f.pos.z; b.hp = f.hp;
      this.botAI(b, f, dt);
    }
    // hunters
    for (const f of g.fighters) if (f.st.hunt && !f.dead && f.ai) this.hunterAI(f, dt);
  }

  private combat(f: Fighter, t: Fighter, _dt: number, tempo: number, aggr: number, dodge: number) {
    const g = this.g;
    const ai = f.ai!;
    const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    if (f.charging) { f.targetYaw = Math.atan2(dx, dz); f.faceNow(f.targetYaw); if (f.charging.t >= ai.holdFor) g.releaseCharge(f); return; }
    if (f.lock > 0 || f.stun > 0) return;
    if (!f.forced) f.targetYaw = Math.atan2(dx, dz);
    if (ai.think <= 0) {
      ai.think = rand(0.2, 0.5) / tempo;
      const defs = f.skillsDefs;
      const arr = g.cdArr(f);
      const usable = defs.map((s, i) => ({ s, i })).filter(({ s, i }) => arr[i] <= 0 && f.energy >= s.cost && dist >= s.ai[0] && dist <= s.ai[1] && (!s.can || s.can(g, f)));
      if (usable.length && Math.random() < aggr) {
        const pk = usable[Math.floor(Math.random() * usable.length)];
        const ult = usable.find((u) => u.i === 3);
        const ch = ult && Math.random() < 0.5 ? ult : pk;
        if (ch.s.charge) ai.holdFor = rand(0.1, ch.s.charge * 0.95);
        if (g.tryCast(f, ch.i)) return;
      }
      const r = Math.random();
      const mr = f.def ? f.def.m1Range * f.rangeMult : 4;
      if (dist < mr + 1.2) ai.mode = r < 0.62 ? 'melee' : r < 0.82 ? 'strafe' : 'retreat';
      else if (dist < 10) ai.mode = r < 0.55 ? 'approach' : 'strafe';
      else ai.mode = 'approach';
      ai.strafe = Math.random() < 0.5 ? -1 : 1;
      if (ai.dashCd <= 0 && f.dashCd <= 0 && Math.random() < 0.16 * tempo) { if (dist > 11) g.dash(f, nx, nz); else if (dist < 4) g.dash(f, -nz * ai.strafe, nx * ai.strafe); ai.dashCd = rand(2.2, 3.6); }
      if (f.hp < f.maxHp * 0.5 && Math.random() < dodge * 0.4 && f.dashCd <= 0) g.dash(f, -nx, -nz);
    }
    if (ai.jumpT <= 0 && f.onGround && f.stun <= 0) { ai.jumpT = rand(2.5, 6); if (Math.random() < 0.5) { f.vy = 15; f.onGround = false; } }
    switch (ai.mode) {
      case 'approach': case 'melee': if (dist > 2.6) f.moveInput.set(nx, nz); break;
      case 'retreat': f.moveInput.set(-nx, -nz).multiplyScalar(0.9); break;
      case 'strafe': { const away = dist < 3.5 ? -0.5 : dist > 7 ? 0.6 : 0; f.moveInput.set(-nz * ai.strafe + nx * away, nx * ai.strafe + nz * away); if (f.moveInput.lengthSq() > 1) f.moveInput.normalize(); break; }
    }
    if (f.def && dist < f.def.m1Range * f.rangeMult + 1.0 && ai.atkT <= 0) { if (g.basic(f)) ai.atkT = rand(0.04, 0.25) / tempo; }
  }
  private tickAI(f: Fighter, dt: number) { const ai = f.ai!; ai.dashCd -= dt; ai.think -= dt; ai.atkT -= dt; ai.jumpT -= dt; }

  private botAI(b: Bot, f: Fighter, dt: number) {
    const g = this.g;
    f.moveInput.set(0, 0);
    if (g.frozen || !f.ai) return;
    this.tickAI(f, dt);
    b.tgtT -= dt;
    if (b.tgtT <= 0) { b.tgtT = 0.35; const old = b.tgt; b.tgt = this.findTarget(b, f); if (b.tgt && b.tgt !== old) b.react = rand(0.12, 0.55) * (1.3 - b.pers.skill); }
    if (b.react > 0) b.react -= dt;
    const t = b.tgt && !b.tgt.dead ? b.tgt : null;
    const lowHp = f.hp < f.maxHp * (0.18 + 0.3 * b.pers.healAt);
    // healing channel
    if (lowHp && (!t || Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) > 13) && (f.st.healCdT ?? 0) <= 0 && !f.st.healing) g.startHeal(f);
    if (f.st.healing) { if (f.hp >= f.maxHp * 0.92 || (t && Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) < 7)) g.stopHeal(f); else return; }
    if (t) {
      if (b.react > 0) { f.targetYaw = Math.atan2(t.pos.x - f.pos.x, t.pos.z - f.pos.z); return; }
      const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1;
      if (lowHp && b.pers.caution > 0.45 && !b.ally) {
        b.fleeing = 1.5; f.moveInput.set(-dx / d, -dz / d); f.targetYaw = Math.atan2(-dx, -dz);
        if (f.ai.dashCd <= 0 && f.dashCd <= 0) { g.dash(f, -dx / d, -dz / d); f.ai.dashCd = 3; this.say(b, 'flee', 0.6); }
        return;
      }
      if (b.pers.tilt > 0.6 && (f.st.hurtT ?? 0) > 3 && Math.random() < 0.01) this.say(b, 'hurt', 1);
      this.combat(f, t, dt, f.ai.tempo, f.ai.aggr, f.ai.dodge);
      return;
    }
    // no target: walk the abstract plan / follow the player
    if (b.ally) {
      const p = g.player;
      const dx = p.pos.x - f.pos.x, dz = p.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1;
      if (d > 9) { f.moveInput.set(dx / d, dz / d); f.targetYaw = Math.atan2(dx, dz); if (d > 28 && f.dashCd <= 0) g.dash(f, dx / d, dz / d); }
      if (f.hp < f.maxHp * 0.55 && (f.st.healCdT ?? 0) <= 0 && !f.st.healing) g.startHeal(f);
      return;
    }
    if ((b.state === 'travel' || b.state === 'zone') && b.goal) {
      const dx = b.goal.x - f.pos.x, dz = b.goal.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d > 3) { f.moveInput.set(dx / d, dz / d); f.targetYaw = Math.atan2(dx, dz); if (b.pers.skill > 0.65 && d > 40 && f.dashCd <= 0 && Math.random() < 0.01) g.dash(f, dx / d, dz / d); }
    } else if (b.state === 'work' && Math.random() < 0.002) { f.targetYaw += rand(-1.5, 1.5); }
    // pickup loot while walking
    for (const pk of this.pickups) if (pk.card && Math.hypot(pk.x - f.pos.x, pk.z - f.pos.z) < 2.4) { b.inv.push(pk.card); pk.ttl = 0; this.say(b, 'loot', 0.3); }
  }

  private hunterAI(f: Fighter, dt: number) {
    const g = this.g, p = g.player;
    f.moveInput.set(0, 0);
    if (g.frozen) return;
    this.tickAI(f, dt);
    let t: Fighter | null = p.dead ? null : p;
    const near = g.target(f, 30);
    if (near && near !== p && near.team !== 'monster' && Math.hypot(near.pos.x - f.pos.x, near.pos.z - f.pos.z) < 14) t = near;
    if (!t) return;
    if (f.st.healing) return;
    if (Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) > 70 && t === p) { const dx = p.pos.x - f.pos.x, dz = p.pos.z - f.pos.z, d = Math.hypot(dx, dz); f.moveInput.set(dx / d, dz / d); f.targetYaw = Math.atan2(dx, dz); return; }
    this.combat(f, t, dt, 1.05, 0.7, 0.25);
  }

  private botSpellOnPlayer(b: Bot) {
    const g = this.g, p = g.player, f = b.f!;
    b.spellT = rand(14, 40) / (0.4 + b.pers.spells);
    if (p.dead || b.hostile === false && b.pers.aggr < 0.4) return;
    const d = Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z);
    if (d > 16 || (p.st.stealthT ?? 0) > 0) return;
    const opts = b.inv.filter((c) => ['p1006', 'p1007', 'p1021', 'p1018', 'p1014', 'p1012'].includes(c));
    if (!opts.length || Math.random() > b.pers.spells + 0.15) return;
    const id = pick(opts);
    b.inv.splice(b.inv.indexOf(id), 1);
    const c = CARDS[id];
    this.warn = `${b.name} is casting ${c.name.toUpperCase()} on you!`; this.warnT = c.fx?.sp === 'leave' ? 3.5 : 2;
    sfx('charge');
    g.after(this.warnT, null, () => {
      if (p.dead || !b.alive || !b.f) return;
      if (Math.hypot(p.pos.x - b.f.pos.x, p.pos.z - b.f.pos.z) > 24) { this.toast(`You escaped ${c.name}!`, '#7dff9a'); return; }
      const blk = this.playerBlocks();
      if (blk) { this.toast(`${blk} blocked ${b.name}'s ${c.name}!`, '#9fe8ff'); return; }
      this.hostileOnPlayer(b, c);
    });
  }
  private hostileOnPlayer(b: Bot, c: Card) {
    const g = this.g, p = g.player;
    const steal = (kinds: 'p' | 's' | 'any', n = 1) => {
      for (let i = 0; i < n; i++) {
        const pool = this.inv.filter((x) => x !== 's100' && (kinds === 'any' || x[0] === kinds));
        if (!pool.length) { this.toast(`${b.name}'s ${c.name} found nothing to take`, '#cccccc'); return; }
        const id = c.fx?.sp === 'mug' ? pool.sort((a, z) => RANK_VALUE[CARDS[z].rank] - RANK_VALUE[CARDS[a].rank])[0] : pick(pool);
        this.removeCard(id); b.inv.push(id);
        this.toast(`${b.name} stole ${CARDS[id].name}!`, '#ff9a9a');
      }
    };
    switch (c.fx?.sp) {
      case 'pickpocket': steal('p'); break;
      case 'thief': steal('s'); break;
      case 'mug': steal('any'); break;
      case 'levy': steal('any'); break;
      case 'relegate': { const q = this.freeNear(rand(-500, 500), rand(-500, 500), 3); this.tpPlayer(q.x, q.z); this.toast(`${b.name} relegated you!`, '#ff9a9a'); break; }
      case 'leave': g.banner('LEAVE!', `${b.name} cast Leave on you...`, 2); this.deathHow = 'was ejected by Leave'; g.damage(b.f!, p, 99999, { pierce: true, noCrit: true, noMeter: true }); break;
    }
  }

  // ------------------------------------------------------------------ monsters
  private monsterAI(m: MonSp, f: Fighter, dt: number) {
    const g = this.g;
    const d = m.def;
    f.moveInput.set(0, 0);
    if (g.frozen || f.stun > 0 || f.lock > 0) return;
    m.atkT -= dt;
    const allyTeam = f.team === 'player';
    const owner = allyTeam ? g.player : null;
    // fleeing to the safe zone
    const safe = this.safeR * 0.82;
    if (!allyTeam && Math.hypot(m.hx, m.hz) > safe && safe > 5) { const k = safe / Math.hypot(m.hx, m.hz); m.hx *= 1 - (1 - k) * dt * 0.4; m.hz *= 1 - (1 - k) * dt * 0.4; }
    let t: Fighter | null = null, bd = d.aggro;
    for (const o of g.fighters) {
      if (o.dead || o.team === f.team || o.team === 'none') continue;
      if (!allyTeam && (o.team === 'monster')) continue;
      if (allyTeam && o.team === 'player') continue;
      const dist = Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
      const hdist = Math.hypot(o.pos.x - m.hx, o.pos.z - m.hz);
      if (dist < bd && (allyTeam || hdist < d.leash) && !(o.isPlayer && (o.st.stealthT ?? 0) > 0 && dist > 6)) { bd = dist; t = o; }
    }
    if (!t) {
      const home = allyTeam && owner ? { x: owner.pos.x, z: owner.pos.z } : { x: m.hx, z: m.hz };
      const dx = home.x - f.pos.x, dz = home.z - f.pos.z, dist = Math.hypot(dx, dz);
      if (dist > (allyTeam ? 8 : 3)) { f.moveInput.set(dx / dist, dz / dist).multiplyScalar(allyTeam ? 1 : 0.7); f.targetYaw = Math.atan2(dx, dz); }
      if (!allyTeam) { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.05 * dt); f.st.aggro = 0; }
      if (d.atk === 'heal' && owner && owner.hp < owner.maxHp) { g.heal(owner, owner.maxHp * 0.02 * dt, true); }
      return;
    }
    f.st.aggro = 1;
    const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z, dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist, nz = dz / dist;
    f.targetYaw = Math.atan2(dx, dz);
    const dmg = d.dmg;
    const col = d.boss ? 0xff7a3a : 0xffc080;
    const ranged = d.atk === 'volley' || d.atk === 'bomb';
    if (ranged) {
      const keep = d.atk === 'bomb' ? 16 : 12;
      if (dist < keep - 3) f.moveInput.set(-nx, -nz); else if (dist > keep + 6) f.moveInput.set(nx, nz);
      else f.moveInput.set(-nz * 0.6, nx * 0.6);
    } else if (dist > d.range * 0.7) f.moveInput.set(nx, nz);
    if (m.atkT > 0) return;
    if (d.atk === 'melee' || d.atk === 'heal') {
      if (dist < d.range) { m.atkT = d.cd; f.lock = 0.5; f.castId++; f.faceNow(Math.atan2(dx, dz)); f.setAnim('slamR', 0.5); sfx('swing'); g.after(0.32, f, () => g.hitArc(f, d.range + 0.6, 0.15, dmg, { kb: 2.5, color: col })); }
    } else if (d.atk === 'slam') {
      if (dist < d.range + 1.5) {
        m.atkT = d.cd; f.lock = 0.9; f.castId++; f.faceNow(Math.atan2(dx, dz)); f.setAnim('slamR', 0.85);
        const c = V(f.pos.x + nx * d.range * 0.6, 0, f.pos.z + nz * d.range * 0.6);
        g.fx.ring(c, 0xff5a3a, d.range * 1.3, 1, 0.7);
        g.after(0.62, f, () => { g.fx.shockwave(c, col, d.range * 1.25, 0.5); g.fx.debris(c, 8, 6); g.shake(0.3); sfx('heavy'); g.hitSphere(c, d.range * 1.15, f, dmg, { kb: 7, heavy: true, color: col, stun: 0.3 }); });
      }
    } else if (d.atk === 'charge') {
      if (dist > 5 && dist < 18) {
        m.atkT = d.cd; f.lock = 0.9; f.castId++; f.faceNow(Math.atan2(dx, dz)); f.setAnim('crouch', 0.5);
        g.fx.ring(f.pos, 0xff5a3a, 3, 1, 0.5);
        g.after(0.5, f, () => { sfx('dash'); g.dashF(f, V(nx, 0, nz), Math.min(dist + 3, 17), 0.38); g.after(0.2, f, () => g.hitArc(f, d.range + 1, 0, dmg, { kb: 8, heavy: true, color: col, stun: 0.4 })); g.after(0.4, f, () => g.hitArc(f, d.range + 1, 0, dmg * 0.6, { kb: 4, color: col })); });
      } else if (dist <= 5) { m.atkT = d.cd * 0.6; f.lock = 0.45; f.setAnim('slamR', 0.45); g.after(0.3, f, () => g.hitArc(f, d.range, 0.1, dmg * 0.7, { kb: 3, color: col })); }
    } else if (d.atk === 'pounce') {
      if (dist < d.range + 5 && dist > 2.5) { m.atkT = d.cd; f.lock = 0.7; f.castId++; f.faceNow(Math.atan2(dx, dz)); f.setAnim('leap', 0.6); g.after(0.22, f, () => { g.dashF(f, V(nx, 0, nz), Math.min(dist, d.range + 4), 0.25); f.vy = 10; }); g.after(0.48, f, () => g.hitArc(f, d.range + 1, 0, dmg, { kb: 4, color: col, bleed: d.boss ? 3 : 0 })); }
      else if (dist <= 2.5) { m.atkT = d.cd * 0.6; f.lock = 0.4; f.setAnim('jabR', 0.4); g.after(0.2, f, () => g.hitArc(f, d.range, 0.1, dmg * 0.7, { kb: 2, color: col })); }
    } else if (d.atk === 'volley') {
      if (dist < d.range + 6) { m.atkT = d.cd; f.lock = 0.35; f.faceNow(Math.atan2(dx, dz)); f.setAnim('castFwd', 0.35); sfx('zap'); const o = f.chestPos().addScaledVector(V(nx, 0, nz), 1.2); const dir = t.chestPos().sub(o).normalize(); g.shoot({ owner: f, pos: o, dir, speed: 46, radius: 1, dmg, life: 1, color: allyTeam ? 0x7dffb0 : 0xff7a3a, size: 0.8, shape: 'orb', opts: { kb: 1.5, color: col, noCrit: true } }); }
    } else if (d.atk === 'bomb') {
      m.atkT = d.cd; f.lock = 0.5; f.faceNow(Math.atan2(dx, dz)); f.setAnim('castFwd', 0.5); sfx('charge');
      const n = Math.random() < 0.4 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const o = f.chestPos().addScaledVector(V(nx, 0, nz), 1.4);
        const tp = t.pos.clone().add(V(rand(-4, 4), 0, rand(-4, 4)));
        const dd = tp.clone().sub(o); const L = Math.hypot(dd.x, dd.z) || 1;
        const sp = clamp(L / 1.0, 14, 40);
        g.after(0.35 + i * 0.12, f, () => g.shoot({ owner: f, pos: o.clone(), dir: V(dd.x / L, 0.7, dd.z / L).normalize(), speed: sp, radius: 0.6, dmg: 6, life: 2.4, color: 0xff6a2a, size: 1, shape: 'orb', grav: 24, opts: { noCrit: true }, onEnd: (pos) => { const c = V(pos.x, 0, pos.z); g.fx.explosion(V(pos.x, 1, pos.z), 0xff6a2a, 4.5, 0.5); g.fx.shockwave(c, 0xff9a3a, 8, 0.5); sfx('boom'); g.hitSphere(c, 7, f, dmg, { kb: 7, heavy: true, color: 0xff6a2a }); } }));
      }
      if (!this.lf && Math.random() < 0.35 && t.isPlayer) { this.lf = { t: 6, ex: 0, ez: 0 }; this.warn = 'LITTLE FLOWER! A bomb is attached to you — get 30m away from Genthru or defeat him!'; this.warnT = 6; sfx('charge'); }
    }
  }
  private monstersStep(dt: number) {
    const g = this.g;
    for (const m of this.mons) {
      if (!m.alive || !m.f) continue;
      const f = m.f;
      if (f.dead) continue;
      m.x = f.pos.x; m.z = f.pos.z; m.hp = f.hp;
      this.monsterAI(m, f, dt);
    }
    if (this.lf) {
      const b = this.boss;
      this.lf.t -= dt;
      const p = g.player;
      if (!b || !b.alive || !b.f || Math.hypot(b.f.pos.x - p.pos.x, b.f.pos.z - p.pos.z) > 32) { this.lf = null; this.toast('Little Flower disarmed!', '#7dff9a'); }
      else if (this.lf.t <= 0) { g.fx.explosion(p.chestPos(), 0xff6a2a, 5, 0.6); g.fx.shockwave(V(p.pos.x, 0, p.pos.z), 0xff9a3a, 9, 0.5); sfx('boom'); g.damage(b.f, p, 85, { kb: 8, heavy: true, noCrit: true, color: 0xff6a2a }); this.lf = null; }
    }
  }
  /** called from Game.kill for every non-player fighter */
  onFighterDown(v: Fighter, by?: Fighter | null) {
    const g = this.g;
    if (v.isPlayer) { this.playerDown(by ?? null); return; }
    if (v.st.botId !== undefined) {
      const b = this.bots[v.st.botId];
      if (b) { b.hp = 0; this.finalizeBot(b, by ? this.botOrFighter(by) : null, 'was eliminated'); if (b.alive) { /* revived */ v.dead = false; } }
      return;
    }
    if (v.st.monId !== undefined) {
      const m = this.mons.find((x) => x.id === v.st.monId);
      if (m) this.monsterDown(m, by ?? null);
      return;
    }
    if (v.st.hunt) { if (by?.isPlayer) { this.addJenny(2500); this.addCard(rollCard(2, this.luck, 0.4)); this.kills++; this.feedAdd(`You defeated a Bomber Hunter`, '#7dff9a'); } g.fx.explosion(v.chestPos(), 0xff6a2a, 2.5, 0.4); }
  }
  private botOrFighter(f: Fighter): Bot | Fighter { return f.st.botId !== undefined ? this.bots[f.st.botId] : f; }
  private monsterDown(m: MonSp, by: Fighter | null) {
    const g = this.g;
    m.alive = false;
    const d = m.def;
    if (d.ally) return;
    this.feedAdd(`${by?.isPlayer ? 'You' : by?.name ?? 'Someone'} defeated ${m.name}`, by?.isPlayer ? '#7dff9a' : '#ffffff');
    const pos = V(m.f?.pos.x ?? m.x, 0, m.f?.pos.z ?? m.z);
    g.fx.explosion(V(pos.x, 2, pos.z), 0xffd24a, 3, 0.5);
    const mine = !!by && (by.isPlayer || by.team === 'player');
    if (mine) { this.monsKilled++; g.gainXp(d.xp, 0); this.addJenny(rand(d.jenny[0], d.jenny[1])); this.progress('prize', 1); if (d.id === 'cyclops') this.progress('cyclops', 1); if (d.id === 'captain') this.progress('pirates', 1); }
    if (d.drop) {
      const n = d.drop.n;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28;
        const id = d.drop.min ? rollRank(i === 0 ? d.drop.min : 'B') : rollCard(d.drop.tier, mine ? this.luck : 0, 0.5);
        this.pickups.push({ id: this.nextId++, x: pos.x + Math.cos(a) * 2.5, z: pos.z + Math.sin(a) * 2.5, card: id, rank: CARDS[id].rank, ttl: 900 });
      }
    }
    if (d.id === 'guard') this.pickups.push({ id: this.nextId++, x: pos.x, z: pos.z + 3, card: 's046', rank: 'A', ttl: 900 });
    if (d.id === 'captain') this.pickups.push({ id: this.nextId++, x: pos.x + 3, z: pos.z, card: 's081', rank: 'SS', ttl: 900 });
    if (d.id === 'golem') this.chests.push({ id: this.nextId++, x: pos.x, z: pos.z, tier: 3, opened: false, big: true });
    if (d.id === 'cyclops') this.pickups.push({ id: this.nextId++, x: pos.x, z: pos.z - 3, card: pick(['p1001', 's100', 'p1003']) === 's100' ? 'p1002' : 'p1003', rank: 'G', ttl: 900 });
    if (d.id === 'genthru') { this.bossDone = true; this.boss = null; g.banner('GENTHRU DEFEATED', 'The Bomber is down — his loot is yours!', 4); sfx('level'); this.lf = null; this.pickups.push({ id: this.nextId++, x: pos.x, z: pos.z + 3, card: rollRank('SS'), rank: 'SS', ttl: 900 }); }
    if (d.boss && d.id !== 'genthru') sfx('level');
  }

  // ------------------------------------------------------------------ summons
  private summonsStep(dt: number) {
    const g = this.g;
    void dt;
    for (const s of this.summons) {
      if (g.time > s.until || s.f.dead) { if (!s.f.dead) { g.fx.burst(s.f.chestPos(), 0xffffff, 12, 6, 0.4); } g.removeFighter(s.f); g.fighters = g.fighters.filter((x) => x !== s.f); s.until = -1; continue; }
      const m = this.mons.find((x) => x.id === s.f.st.monId);
      if (m) { m.x = s.f.pos.x; m.z = s.f.pos.z; m.hx = s.owner.pos.x; m.hz = s.owner.pos.z; this.monsterAI(m, s.f, 1 / 60); }
    }
    this.summons = this.summons.filter((s) => s.until >= 0);
  }
  summon(defId: string, t: number) {
    const g = this.g, p = g.player;
    const d = MONS[defId];
    const m: MonSp = { id: this.nextId++, def: d, x: p.pos.x + 3, z: p.pos.z + 2, hx: p.pos.x, hz: p.pos.z, hp: d.hp, alive: true, f: null, name: d.name, atkT: 0.5, windT: 0, spawned: true };
    this.mons.push(m);
    const f = this.spawnMon(m, 'player', p);
    g.fx.pillar(f.pos, 0xffffff, 2, 30, 0.8);
    this.summons.push({ f, until: g.time + t, owner: p });
    sfx('level');
  }

  // ------------------------------------------------------------------ NPCs / pickups / interaction
  private npcStep() {
    const p = this.g.player;
    for (const n of this.npcs) {
      if (!n.f) continue;
      const d = Math.hypot(n.x - p.pos.x, n.z - p.pos.z);
      if (d < 14) n.f.targetYaw = Math.atan2(p.pos.x - n.x, p.pos.z - n.z);
      n.f.moveInput.set(0, 0);
    }
  }
  private pickupsStep(dt: number) {
    const p = this.g.player;
    void dt;
    for (const pk of this.pickups) {
      pk.ttl -= dt;
      if (pk.ttl <= 0) continue;
      if (Math.hypot(pk.x - p.pos.x, pk.z - p.pos.z) > 2.7 || p.dead) continue;
      if (pk.card) { if (this.addCard(pk.card)) pk.ttl = 0; }
      else if (pk.jenny) { this.addJenny(pk.jenny); sfx('card'); pk.ttl = 0; }
      else if (pk.herb) { this.toast('Medicinal herb gathered', '#9aff9a'); sfx('card'); this.progress('herbs', 1); pk.ttl = 0; }
    }
    this.pickups = this.pickups.filter((x) => x.ttl > 0);
  }
  private nearestInteract(): { kind: string; id: string; text: string } | null {
    const p = this.g.player;
    if (p.dead) return null;
    let best: { kind: string; id: string; text: string } | null = null, bd = 1e9;
    for (const c of this.chests) { if (c.opened) continue; const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d < 4.6 && d < bd) { bd = d; best = { kind: 'chest', id: String(c.id), text: c.big ? 'Open Greed Drop chest' : 'Open treasure chest' }; } }
    for (const n of this.npcs) { const d = Math.hypot(n.x - p.pos.x, n.z - p.pos.z); if (d < 6 && d < bd) { bd = d; best = { kind: 'npc', id: n.id, text: `Talk to ${n.name}` }; } }
    return best;
  }
  interact() {
    const g = this.g;
    if (this.dialog) return;
    const it = this.nearestInteract();
    if (!it) return;
    if (it.kind === 'chest') {
      const c = this.chests.find((x) => String(x.id) === it.id);
      if (!c || c.opened) return;
      c.opened = true; sfx('level');
      const n = c.big ? 4 : 2 + (Math.random() < 0.4 ? 1 : 0);
      const pos = V(c.x, 0, c.z);
      g.fx.pillar(pos, c.big ? 0xffd24a : 0xfff0a0, 1.5, 24, 0.7);
      g.fx.burst(V(c.x, 1.5, c.z), 0xffe066, 14, 6, 0.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28 + Math.random();
        const id = c.big ? rollRank(i === 0 ? pick<Rank>(['S', 'A', 'A']) : pick<Rank>(['A', 'B', 'B', 'C'])) : rollCard(c.tier, this.luck, 0.5);
        this.pickups.push({ id: this.nextId++, x: c.x + Math.cos(a) * 2.8, z: c.z + Math.sin(a) * 2.8, card: id, rank: CARDS[id].rank, ttl: 900 });
      }
      this.pickups.push({ id: this.nextId++, x: c.x, z: c.z + 3, jenny: Math.round(rand(500, 1800) * (1 + c.tier * 0.6)), rank: 'S', ttl: 900 });
      return;
    }
    if (this.combatT > 0 && this.p.st.hurtT > 0) { this.toast("You're in combat! Finish the fight first.", '#ff9a9a'); return; }
    this.openDialog(it.id);
  }
  private get p() { return this.g.player; }

  // ------------------------------------------------------------------ dialogs
  private rank(id: string) { return CARDS[id].rank; }
  private sellValue(id: string) { return Math.round(RANK_VALUE[this.rank(id)] * (1 + (this.pb.shop ?? 0) * 0.5)); }
  private price(n: number) { return Math.round(n * (1 - this.discount())); }
  openDialog(npc: string) {
    this.dialogNpc = npc;
    const J = (n: number) => n.toLocaleString() + ' J';
    switch (npc) {
      case 'eta': this.dialog = { id: 'eta', npc: 'Eta', title: 'Eta · Game Master', text: 'Welcome to Greed Island! Cards are everything here: Specified Slot cards (items, creatures, passives) and Spell Cards (tactics). The Barrier closes at 25:00 — until then, explore. Need a push?', opts: [{ id: 'q_cards', label: 'Mission: collect 3 cards' }, { id: 'tips', label: 'Any tips?' }, { id: 'bye', label: 'Goodbye' }] }; break;
      case 'trade': this.dialog = { id: 'trade', npc: 'Trade', title: 'Antokiba Trade Shop', text: `I buy cards for Jenny. You have ${J(this.jenny)}.`, opts: this.sellOpts() }; break;
      case 'board': {
        const rich = this.bots.filter((b) => b.alive && !b.ally).sort((a, c) => this.richness(c.inv) - this.richness(a.inv)).slice(0, 3);
        this.dialog = { id: 'board', npc: 'Board', title: 'Bounty Board', text: 'Players carrying the most valuable cards. Hunt one down for a reward.', opts: [...rich.map((b) => ({ id: 'bounty_' + b.id, label: `Bounty: ${b.name}`, sub: `${J(this.richness(b.inv))} in cards · ${b.pers.title}` })), { id: 'bye', label: 'Leave' }] };
        break;
      }
      case 'diner': this.dialog = { id: 'diner', npc: 'Cat', title: 'Cat Diner', text: 'Nyaa~ Hungry, hunter? Eat up, or ask us what we heard.', opts: [{ id: 'meal', label: 'Hot meal', sub: `${J(this.price(800))} · heal 50% + 10% speed for 60s`, disabled: this.jenny < this.price(800) }, { id: 'gossip', label: 'Ask for gossip (free)', sub: 'Reveals the 3 nearest players on your map' }, { id: 'bye', label: 'Leave' }] }; break;
      case 'spells': this.dialog = { id: 'spells', npc: 'Shop', title: 'Spell Card Shop · Masadora', text: `The only place spell cards are sold: 3 random spells for ${J(this.price(10000))}. You have ${J(this.jenny)}.`, opts: [{ id: 'pack', label: 'Buy a spell pack (3 cards)', sub: J(this.price(10000)), disabled: this.jenny < this.price(10000) }, { id: 'bye', label: 'Leave' }] }; break;
      case 'king': this.dialog = { id: 'king', npc: 'King', title: 'Dorias Casino', text: `Welcome to Dorias! Try your luck. Triple 7 wins a legendary card. You have ${J(this.jenny)}.`, opts: this.casinoOpts() }; break;
      case 'biscuit': this.dialog = { id: 'biscuit', npc: 'Biscuit', title: 'Biscuit · Trainer', text: "Hmph. You look soft. Strike three Cyclops in the Badlands and I'll reward you. Or pay for training.", opts: [{ id: 'q_cyclops', label: 'Mission: defeat 3 Cyclops' }, { id: 'train', label: 'Train (2,500 J)', sub: '+1 level', disabled: this.jenny < 2500 }, { id: 'bye', label: 'Leave' }] }; break;
      case 'razor': this.dialog = { id: 'razor', npc: 'Razor', title: "Razor's Dodgeball", text: 'Survive 40 seconds of my dodgeballs with at least one of your three lives and I will give you a rare card.', opts: [{ id: 'dodge', label: 'Play dodgeball' }, { id: 'bye', label: 'Not now' }] }; break;
      case 'elena': this.dialog = { id: 'elena', npc: 'Elena', title: 'Elena · Harbor Tower', text: 'I handle the departures. Looking for a way out? Or perhaps a peek at the Barrier schedule?', opts: [{ id: 'info', label: 'Barrier schedule (free)' }, { id: 'ticket', label: 'Transport Ticket: leave the island', sub: 'Forfeits the match' }, { id: 'bye', label: 'Goodbye' }] }; break;
      case 'sick': this.dialog = { id: 'sick', npc: 'Villager', title: 'Sick Villagers', text: "Please… we're not really bandits. The island's fever is killing us. Bring us four herbs from the hills and take our treasure, Alexandrite.", opts: [{ id: 'q_herbs', label: 'Mission: gather 4 herbs' }, { id: 'bye', label: 'Leave' }] }; break;
    }
    if (this.dialog) { this.g.paused = false; sfx('ui'); }
  }
  private sellOpts(): DialogOpt[] {
    const uniq = [...new Set(this.inv.filter((c) => c !== 's100'))].sort((a, b) => RANK_VALUE[this.rank(b)] - RANK_VALUE[this.rank(a)]).slice(0, 7);
    return [...uniq.map((id) => ({ id: 'sell_' + id, label: `Sell ${CARDS[id].name} [${this.rank(id)}]`, sub: this.sellValue(id).toLocaleString() + ' J' + (this.count(id) > 1 ? ` · you have ${this.count(id)}` : '') })), { id: 'sellcol', label: 'Sell every collectible card', sub: 'Keeps passives, consumables & spells' }, { id: 'bye', label: 'Leave' }];
  }
  private casinoOpts(): DialogOpt[] {
    return [{ id: 'slots', label: 'Slot machine', sub: '1,000 J · triple 7 = legendary card', disabled: this.jenny < 1000 }, { id: 'poker', label: "Poker vs the Casino King", sub: '5,000 J · win the Fledgling Gambler card', disabled: this.jenny < 5000 }, { id: 'dice', label: 'Risky Dice (stake your worst card)', sub: '5-6: upgrade · 1-2: lose it', disabled: this.inv.filter((c) => c !== 's100').length === 0 }, { id: 'bye', label: 'Leave' }];
  }
  closeDialog() { this.dialog = null; sfx('ui'); }
  get uiBlocking() { return !!this.dialog || this.mapOpen || !!this.trade; }
  toggleMap() { this.mapOpen = !this.mapOpen; sfx('ui'); }
  acceptTrade() { const t = this.trade; if (!t) return; if (this.has(t.want) && t.bot.inv.includes(t.give)) { this.removeCard(t.want); t.bot.inv.splice(t.bot.inv.indexOf(t.give), 1); t.bot.inv.push(t.want); this.addCard(t.give, true); this.toast(`Traded ${CARDS[t.want].name} for ${CARDS[t.give].name}`, '#7dff9a'); this.say(t.bot, 'loot'); } this.trade = null; }
  declineTrade() { this.trade = null; }

  choose(id: string) {
    const g = this.g;
    const d = this.dialog;
    if (!d) return;
    const J = (n: number) => n.toLocaleString() + ' J';
    const refresh = () => this.openDialog(this.dialogNpc);
    if (id === 'bye') { this.closeDialog(); return; }
    if (id === 'tips') { d.text = 'Open the Binder with B. Spells need targets you have MET (come within 45m). Holy Water shields you from the Barrier for 25s. Heal with R. Cyclops in the Badlands drop good cards.'; d.opts = [{ id: 'q_cards', label: 'Mission: collect 3 cards' }, { id: 'bye', label: 'Thanks' }]; return; }
    if (id.startsWith('q_')) { this.startQuest(id.slice(2)); this.closeDialog(); return; }
    if (id.startsWith('sell_')) { const cid = id.slice(5); if (this.removeCard(cid)) { this.addJenny(this.sellValue(cid), true); sfx('level'); this.toast(`Sold ${CARDS[cid].name} for ${J(this.sellValue(cid))}`, '#ffe066'); } refresh(); return; }
    switch (id) {
      case 'sellcol': { let tot = 0; for (const c of [...this.inv]) { if (CARDS[c].type === 'collect' && c !== 's100') { tot += this.sellValue(c); this.removeCard(c); } } this.addJenny(tot, true); this.toast(tot ? `Sold collectibles for ${J(tot)}` : 'Nothing to sell', '#ffe066'); refresh(); break; }
      case 'meal': { const pr = this.price(800); if (this.jenny >= pr) { this.jenny -= pr; g.heal(g.player, g.player.maxHp * 0.5); g.player.speedMult = 1.1; g.player.buffT = 60; sfx('level'); } refresh(); break; }
      case 'gossip': this.revealNear(3, 14, 200); this.toast('The cats whisper where players are…', '#bfe8ff'); this.closeDialog(); break;
      case 'pack': { const pr = this.price(10000); if (this.jenny >= pr) { this.jenny -= pr; for (let i = 0; i < 3; i++) this.addCard(rollCard(1, this.luck + 0.05, 1.5 > 1 ? 1 : 1) && pick(SPELL_IDS) ? this.rollSpell() : 'p1001'); sfx('level'); } refresh(); break; }
      case 'train': if (this.jenny >= 2500) { this.jenny -= 2500; g.gainXp(this.xpNeedNow(), 0); } refresh(); break;
      case 'slots': this.playSlots(); break;
      case 'poker': this.playPoker(); break;
      case 'dice': this.playDice(); break;
      case 'dodge': this.startDodge(); this.closeDialog(); break;
      case 'w1': g.heal(g.player, g.player.maxHp); g.addShield(g.player, 80); this.closeDialog(); sfx('level'); break;
      case 'w2': this.addCard(rollRank(pick<Rank>(['C', 'B']))); this.addCard(rollRank(pick<Rank>(['B', 'A']))); this.closeDialog(); break;
      case 'w3': { const r = Math.max(10, this.safeR * 0.5); const a = rand(0, 6.28); this.closeDialog(); this.tpPlayer(Math.cos(a) * r, Math.sin(a) * r); break; }
      case 'info': { const z = this.zoneAt(this.t); d.text = `Phase ${z.phase + 1}: ${z.closing ? 'closing to' : 'next shrink to'} ${Math.round(z.to)}m in ${Math.max(0, Math.round(z.tNext))}s. Final safe zone: the Colosseum.`; d.opts = [{ id: 'bye', label: 'Thanks' }]; break; }
      case 'ticket': this.forfeit = true; this.deathHow = 'left the island'; this.closeDialog(); g.damage(g.player, g.player, 99999, { pierce: true, noCrit: true, noMeter: true }); break;
      default:
        if (id.startsWith('bounty_')) { const b = this.bots[parseInt(id.slice(7), 10)]; if (b) { this.quests = this.quests.filter((q) => q.id !== 'bounty'); this.startQuest('bounty', `Bounty: ${b.name}`, `Eliminate ${b.name} (${b.pers.title}) — carrying ${J(this.richness(b.inv))} in cards`, '5,000 J + a rare card'); this.traced = b; this.traceT = 40; } this.closeDialog(); }
    }
  }
  private xpNeedNow() { return 60 + this.g.level * 40; }
  private rollSpell() { let id = pick(SPELL_IDS); for (let i = 0; i < 3; i++) { const c = pick(SPELL_IDS); if (CARDS[c].limit < CARDS[id].limit && Math.random() < 0.5) id = c; } return id; }

  private playSlots() {
    const d = this.dialog!;
    if (this.jenny < 1000) return;
    this.jenny -= 1000;
    const sym = ['7', '7', '🍒', '🔔', '⭐', '🃏', '💎'];
    const lk = this.luck;
    const reels = [0, 1, 2].map(() => (Math.random() < 0.03 * (1 + lk) ? '7' : pick(sym)));
    const same = reels[0] === reels[1] && reels[1] === reels[2];
    d.reels = reels;
    if (same && reels[0] === '7') { d.text = 'JACKPOT 7-7-7!! A legendary card spills from the machine!'; this.addCard(rollRank(pick<Rank>(['S', 'S', 'A', 'SS']))); this.addJenny(8000); sfx('level'); this.g.flash('#ffd24a', 0.5); }
    else if (same) { d.text = 'Triple match! +6,000 J'; this.addJenny(6000, true); sfx('level'); }
    else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) { d.text = 'A pair — your 1,000 J comes back.'; this.addJenny(1000, true); }
    else d.text = 'No luck this time…';
    d.opts = this.casinoOpts();
  }
  private playDice() {
    const d = this.dialog!;
    const pool = this.inv.filter((c) => c !== 's100').sort((a, b) => RANK_VALUE[this.rank(a)] - RANK_VALUE[this.rank(b)]);
    if (!pool.length) return;
    const stake = pool[0];
    this.removeCard(stake);
    const r = 1 + Math.floor(Math.random() * 6 + this.luck * 0.8);
    const roll = Math.min(6, r);
    if (roll >= 5) { const rk = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'] as Rank[]; const i = Math.min(rk.length - 1, rk.indexOf(this.rank(stake)) + 2); const nid = rollRank(rk[i]); this.addCard(nid, true); d.text = `Rolled ${roll}! Your ${CARDS[stake].name} became ${CARDS[nid].name} [${CARDS[nid].rank}]!`; sfx('level'); }
    else if (roll >= 3) { this.addCard(stake, true); d.text = `Rolled ${roll}. Nothing happens.`; }
    else d.text = `Rolled ${roll}. ${CARDS[stake].name} crumbles to dust…`;
    d.opts = this.casinoOpts();
  }
  private playPoker() {
    const d = this.dialog!;
    if (this.jenny < 5000) return;
    this.jenny -= 5000;
    const deck: string[] = [];
    for (const s of ['♠', '♥', '♦', '♣']) for (let r = 2; r <= 14; r++) deck.push(r + s);
    shuffle(deck);
    const you = deck.slice(0, 5), king = deck.slice(5, 10);
    const score = (h: string[]) => {
      const rs = h.map((c) => parseInt(c, 10)).sort((a, b) => b - a), su = h.map((c) => c.slice(-1));
      const cnt: Record<number, number> = {}; rs.forEach((r) => (cnt[r] = (cnt[r] ?? 0) + 1));
      const g = Object.values(cnt).sort((a, b) => b - a);
      const flush = su.every((s) => s === su[0]), str = new Set(rs).size === 5 && rs[0] - rs[4] === 4;
      let c = 0; if (str && flush) c = 8; else if (g[0] === 4) c = 7; else if (g[0] === 3 && g[1] === 2) c = 6; else if (flush) c = 5; else if (str) c = 4; else if (g[0] === 3) c = 3; else if (g[0] === 2 && g[1] === 2) c = 2; else if (g[0] === 2) c = 1;
      return c * 100 + rs[0] + rs[1] / 20;
    };
    const names = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
    const a = score(you), b = score(king) - this.luck * 40;
    d.hand = { you, king };
    const win = a >= b;
    d.text = win ? `You win with ${names[Math.floor(a / 100)]}! The King hands over a Fledgling Gambler card.` : `The King wins with ${names[Math.floor(score(king) / 100)]}. Better luck next time.`;
    if (win) { this.addCard('s043'); this.addJenny(7000, true); sfx('level'); }
    d.opts = this.casinoOpts();
  }

  private startDodge() {
    const p = this.g.player;
    const c = poi('dodgeball');
    const razorNpc = this.npcs.find((n) => n.id === 'razor');
    p.pos.set(c.x, 0, c.z + 7);
    this.dodge = { t: 0, lives: 3, ballT: 1, razor: razorNpc?.f ?? null };
    this.g.banner('DODGEBALL!', 'Survive 40 seconds — dodge Razor’s balls (3 lives)', 3);
    sfx('boom');
  }
  private dodgeStep(dt: number) {
    const dd = this.dodge;
    if (!dd) return;
    const g = this.g, p = g.player, c = poi('dodgeball');
    if (p.dead) { this.dodge = null; return; }
    dd.t += dt; dd.ballT -= dt;
    if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > 40) { this.dodge = null; this.toast('You left the court. Dodgeball cancelled.', '#ff9a9a'); return; }
    const razor = dd.razor ?? this.npcs.find((n) => n.id === 'razor')?.f;
    if (dd.ballT <= 0 && razor && !razor.dead) {
      dd.ballT = Math.max(0.5, 1.5 - dd.t * 0.022);
      const a = rand(0, 6.28);
      const from = V(c.x + Math.cos(a) * 20, 1.6, c.z + Math.sin(a) * 14);
      const lead = V(p.pos.x + p.moveInput.x * 5 * Math.random(), 1.6, p.pos.z + p.moveInput.y * 5 * Math.random());
      const dir = lead.sub(from).normalize();
      g.shoot({ owner: razor, pos: from, dir, speed: 30 + dd.t * 0.7, radius: 1.2, dmg: 24, life: 2.4, color: 0xff5a5a, size: 1.5, shape: 'orb', opts: { noCrit: true, kb: 4, color: 0xff5a5a }, onHit: (v) => { if (v === p && this.dodge) { this.dodge.lives--; this.toast(`Hit! ${this.dodge.lives} lives left`, '#ff9a9a'); if (this.dodge.lives <= 0) { this.dodge = null; g.banner('OUT!', 'Razor wins this round.', 2); } } } });
    }
    if (this.dodge && dd.t >= 40) {
      this.dodge = null; g.banner('YOU SURVIVED!', 'Razor nods approvingly.', 3); sfx('level');
      this.addCard(rollRank(pick<Rank>(['B', 'B', 'A']))); this.addJenny(3000);
    }
  }

  // ------------------------------------------------------------------ misc events
  private eventsStep(dt: number) {
    this.dodgeStep(dt);
    this.scanT = Math.max(0, this.scanT - dt); this.espT = Math.max(0, this.espT - dt); this.traceT = Math.max(0, this.traceT - dt); this.richT = Math.max(0, this.richT - dt);
    this.hudAcc += dt;
    if (this.traceT <= 0 && this.traced && !this.quests.some((q) => q.id === 'bounty')) this.traced = null;
  }

  // ------------------------------------------------------------------ player down / revive
  /** returns true when a revive card saved the fighter */
  tryRevive(v: Fighter): boolean {
    const g = this.g;
    if (this.forfeit) return false;
    if (!v.isPlayer && v.st.botId === undefined && !v.st.ally) return false;
    if (v.isPlayer) {
      const ally = this.myTeam.members.find((m) => m.alive && m.inv.includes('s017') && m.f && Math.hypot(m.f.pos.x - v.pos.x, m.f.pos.z - v.pos.z) < 40);
      let id: string | null = null;
      if (this.has('s017')) { this.removeCard('s017'); id = 's017'; }
      else if (ally) { ally.inv.splice(ally.inv.indexOf('s017'), 1); id = 's017'; }
      else if (this.has('s093')) { this.removeCard('s093'); id = 's093'; }
      if (!id) return false;
      v.hp = v.maxHp * (id === 's017' ? 0.6 : 0.3); v.invuln = 2.5; v.stun = 0;
      g.popup(v, id === 's017' ? "ANGEL'S BREATH!" : 'BOOK OF LIFE!', '#ffe066', 28); g.fx.pillar(v.pos, 0xffe066, 3, 50, 1.2); g.fx.ring(v.pos, 0xffffff, 1, 10, 0.8); sfx('level'); g.flash('#ffe066', 0.35);
      return true;
    }
    return false;
  }
  playerDown(by: Fighter | null, how = this.deathHow) {
    if (this.over) return;
    this.over = true;
    const g = this.g;
    g.stage = 'over';
    setMusic('defeat');
    const place = this.teamsAlive() + (this.myTeam.members.some((m) => m.alive) ? 0 : 1);
    this.result = { placement: Math.max(2, place), kills: this.kills, time: this.t, cards: this.cardsFound, jenny: this.jennyEarned, victory: false, monsters: this.monsKilled };
    const by2 = by ? (by.st.botId !== undefined ? this.bots[by.st.botId].name : by.name) : null;
    this.feedAdd(by2 ? `${by2} eliminated you` : `You ${how || 'were consumed by the Nen Barrier'}`, '#ff7a7a');
    g.banner('ELIMINATED', `You placed #${this.result.placement} of ${this.format === 'solo' ? 100 : this.teams.length}${by2 ? ` · by ${by2}` : ''}`, 3.5);
    this.binderOpen = false; g.binderOpen = false; this.dialog = null;
    g.later(2.8, () => g.cb.onEnd('defeat'));
  }

  // ------------------------------------------------------------------ binder + spells
  setBinder(open: boolean) {
    this.binderOpen = open;
    this.bookMesh.visible = open;
    if (open) sfx('card');
  }
  private nearestBot(range: number, enemy = true) {
    const p = this.g.player;
    let best: Bot | null = null, bd = range;
    for (const b of this.bots) { if (!b.alive || (enemy && b.team === 0)) continue; const d = Math.hypot(b.x - p.pos.x, b.z - p.pos.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  private revealNear(n: number, dur: number, range: number) {
    const p = this.g.player;
    const list = this.bots.filter((b) => b.alive && b.team !== 0 && b.hideT <= 0).map((b) => ({ b, d: Math.hypot(b.x - p.pos.x, b.z - p.pos.z) })).filter((x) => x.d < range).sort((a, c) => a.d - c.d).slice(0, n);
    for (const x of list) { x.b.revealT = dur; this.metSet.add(x.b.id); }
    return list.length;
  }
  playerBlocks(): string | null {
    const p = this.g.player;
    if ((p.st.reflectT ?? 0) > 0) return 'Reflect';
    if (p.st.wall) { p.st.wall = 0; return 'Defensive Wall'; }
    if ((p.st.bridgeT ?? 0) > 0) { p.st.bridgeT = 0; return 'Drawbridge'; }
    if ((p.st.holyN ?? 0) > 0) { p.st.holyN--; return 'Holy Water'; }
    if (this.pb.guard && (p.st.padCdT ?? 0) <= 0) { p.st.padCdT = 45; return "Paladin's Necklace"; }
    return null;
  }
  private botBlocks(b: Bot): string | null {
    for (const id of ['p1003', 'p1019', 'p1026', 'p1004']) if (b.inv.includes(id) && Math.random() < 0.55) { b.inv.splice(b.inv.indexOf(id), 1); return CARDS[id].name; }
    return null;
  }
  moveBot(b: Bot, x: number, z: number) { b.x = x; b.z = z; if (b.f) { b.f.pos.set(x, 0, z); } }
  tpPlayer(x: number, z: number, withNear = 0) {
    const g = this.g, p = g.player;
    const q = this.freeNear(x, z, 2.5);
    g.fx.pillar(p.pos, 0xb08cff, 2.2, 50, 1);
    const riders: Bot[] = withNear ? this.bots.filter((b) => b.alive && Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < withNear) : [];
    p.pos.set(q.x, 0, q.z); p.vy = 0;
    for (const b of riders) { const r = this.freeNear(q.x + rand(-6, 6), q.z + rand(-6, 6), 1.5); this.moveBot(b, r.x, r.z); }
    for (const b of this.myTeam.members) if (b.f && !riders.includes(b)) { const r = this.freeNear(q.x + rand(-4, 4), q.z + rand(-4, 4), 1.5); b.f.pos.set(r.x, 0, r.z); }
    g.fx.pillar(p.pos, 0xb08cff, 2.5, 60, 1.2); g.fx.ring(p.pos, 0xffffff, 1, 9, 0.8); sfx('boom');
    this.checkVisited();
  }
  private checkVisited() { const p = this.g.player; for (const t of POIS) if (Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < t.r + 20 && !this.visited.has(t.id)) { this.visited.add(t.id); this.toast(`Discovered ${t.name}`, t.color); } }

  /** the card entry point used by the binder UI */
  useCard(id: string, tgt?: string) {
    const g = this.g, p = g.player;
    const c = CARDS[id];
    if (!c || !this.has(id) || p.dead || this.over) return;
    if (this.useCd > 0 || this.casting) return;
    if (c.type === 'passive') { this.toast(`${c.name} is passive — it works while in your binder.`, '#cccccc'); return; }
    if (c.type === 'collect') { this.toast(`${c.name} is a collectible — sell it at a Trade Shop.`, '#cccccc'); return; }
    if (c.kind === 'spell') {
      const sp = c.fx!.sp!;
      if (['return', 'drift', 'collision', 'accompany'].includes(sp) && this.combatT > 0) { this.toast('Teleport spells cannot be used in combat! Break away first.', '#ff9a9a'); return; }
      let tg = tgt;
      if (c.tgt === 'met' && !tg) { this.toast('Choose a player you have met.', '#ff9a9a'); return; }
      if (c.tgt === 'town' && !tg) { this.toast('Choose a destination.', '#ff9a9a'); return; }
      if (sp === 'accompany' && !tg) tg = 'ally';
      this.useCd = 0.8;
      this.casting = { name: c.name, t: 0, max: c.cast ?? 1, cid: ++p.castId };
      p.slow = c.cast ?? 1; p.slowMul = 0.55;
      this.g.popup(p, c.name.toUpperCase() + '!', RANK_COLOR[c.rank], 24);
      sfx('charge');
      g.after(c.cast ?? 1, p, () => { this.casting = null; if (!this.has(id)) return; this.resolveSpell(c, tg); });
      return;
    }
    this.useCd = 0.6;
    this.removeCard(id);
    this.applyFx(c);
  }

  private applyFx(c: Card) {
    const g = this.g, p = g.player;
    const fx = c.fx!;
    g.popup(p, c.name.toUpperCase(), RANK_COLOR[c.rank], 22);
    sfx('level');
    g.fx.pillar(p.pos, parseInt(RANK_COLOR[c.rank].slice(1), 16), 1.6, 26, 0.7);
    if (fx.heal) { p.st.hotT = fx.heal[1]; p.st.hotRate = (p.maxHp * fx.heal[0]) / Math.max(0.1, fx.heal[1]); }
    if (fx.shield) g.addShield(p, fx.shield);
    if (fx.energy) p.energy = Math.min(p.maxEnergy, p.energy + fx.energy);
    if (fx.buff) { const b = fx.buff; if (b.dmg || b.spd) { p.buffDmg = 1 + (b.dmg ?? 0); p.speedMult = 1 + (b.spd ?? 0); p.buffT = b.t; p.buffColor = 0xffc45a; } if (b.atk) p.st.atkBuffT = b.t; }
    if (fx.zone) { const z = fx.zone; this.fields.push({ x: p.pos.x, z: p.pos.z, r: z.r, t: z.t, max: z.t, heal: z.heal ?? 0, slow: z.slow ?? 0, imm: !!z.imm, dps: z.dps ?? 0, dmg: z.dmg ?? 0, team: 'player', color: z.imm ? 0x7dff9a : z.dps ? 0xa0ff80 : 0x9fe8ff, acc: 0 }); }
    if (fx.summon) this.summon(fx.summon.m, fx.summon.t);
    if (fx.stealth) { p.st.stealthT = fx.stealth; for (const b of this.bots) if (b.f && b.tgt === p) b.tgt = null; }
    if (fx.invuln) p.invuln = Math.max(p.invuln, fx.invuln);
    if (fx.stun) { for (const b of this.bots) if (b.f && !b.ally && Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < fx.stun.r) g.stunFighter(b.f, fx.stun.t, true); for (const m of this.mons) if (m.f && Math.hypot(m.x - p.pos.x, m.z - p.pos.z) < fx.stun.r && !m.def.boss) g.stunFighter(m.f, fx.stun.t, true); g.fx.shockwave(V(p.pos.x, 0, p.pos.z), 0xffffff, fx.stun.r, 0.6); g.flash('#ffffff', 0.4); }
    if (fx.slow) { const s = fx.slow; for (const f of g.fighters) if (!f.dead && f.team !== 'player' && f.team !== 'none' && Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) < s.r) g.applySlow(f, s.t, s.m); g.fx.shockwave(V(p.pos.x, 0, p.pos.z), 0x9fe8ff, s.r, 0.6); }
    if (fx.float) { g.launch(p, 34); p.floatT = 4; p.st.manualJump = 0; }
    if (fx.cleanse) this.cleanse();
    if (fx.level) g.gainXp(this.xpNeedNow() * 1.05, 0);
    if (fx.maxhp) { g.player.maxHp += fx.maxhp; p.hp = Math.min(p.maxHp, p.hp + fx.maxhp); }
    if (fx.pack) for (let i = 0; i < fx.pack; i++) this.addCard(this.rollSpell());
    if (fx.gamble) { const r = 1 + Math.floor(Math.random() * 6); if (r <= 2) { g.damage(p, p, p.maxHp * 0.25, { dot: true, noCrit: true, noMeter: true, pierce: true }); this.toast(`Rolled ${r}: ouch!`, '#ff9a9a'); } else if (r >= 5) { this.addCard(rollRank(pick<Rank>(['B', 'A', 'A']))); this.toast(`Rolled ${r}: a rare card!`, '#ffe066'); } else this.toast(`Rolled ${r}.`, '#ffffff'); }
    if (fx.sp) this.special(fx.sp, c);
  }
  private cleanse() { const p = this.g.player; p.stun = 0; p.root_ = 0; p.slow = 0; p.slowMul = 1; p.st.bleedT = 0; p.st.shock = 0; p.st.vulnT = 0; p.st.judgeT = 0; this.g.fx.ring(p.pos, 0xffffff, 1, 8, 0.6); }
  private special(sp: string, c: Card) {
    const g = this.g, p = g.player;
    switch (sp) {
      case 'hollow': { const a = p.yaw; const q = this.freeNear(p.pos.x + Math.sin(a) * 45, p.pos.z + Math.cos(a) * 45, 2); g.fx.pillar(p.pos, 0x7dff9a, 2, 30, 1); g.after(1.4, null, () => { p.pos.set(q.x, 0, q.z); g.fx.pillar(p.pos, 0x7dff9a, 2, 30, 1); }); break; }
      case 'pond': { const low = this.inv.filter((x) => x !== 's100' && x !== c.id).sort((a, b) => RANK_VALUE[this.rank(a)] - RANK_VALUE[this.rank(b)]).slice(0, 3); for (const l of low) this.removeCard(l); const nid = rollRank(pick<Rank>(['B', 'B', 'A', 'S'])); this.addCard(nid); break; }
      case 'tree': { const x = p.pos.x, z = p.pos.z; for (let i = 0; i < 6; i++) g.later(i * 5, () => { const a = rand(0, 6.28); this.pickups.push({ id: this.nextId++, x: x + Math.cos(a) * 5, z: z + Math.sin(a) * 5, card: rollCard(0, 0.1, 0.6), rank: 'F', ttl: 200 }); sfx('card'); }); break; }
      case 'scanAll': this.scanT = 30; this.scanR = 1e9; this.scanAll = true; g.later(30, () => { this.scanAll = false; }); break;
      case 'genie': this.dialog = { id: 'genie', npc: 'Genie', title: 'Fickle Genie', text: 'I can grant ONE wish. Choose wisely, hunter.', opts: [{ id: 'w1', label: 'Full heal & shield' }, { id: 'w2', label: 'Two rare spell cards' }, { id: 'w3', label: 'Teleport me to the safe zone' }] }; this.dialogNpc = 'genie'; break;
      case 'fairy': this.toast(`The Fairy King shows the next Barrier: ${Math.round(this.zoneAt(this.t).to)}m radius, centered on Limeiro.`, '#bfe8ff'); this.scanT = Math.max(this.scanT, 0); this.richT = 20; break;
      case 'polter': { let n = 0; const iv = window.setInterval(() => { if (n++ > 15 || p.dead) { window.clearInterval(iv); return; } const t = g.target(p, 24); if (t) { const o = V(p.pos.x + rand(-2, 2), p.pos.y + 3, p.pos.z + rand(-2, 2)); g.shoot({ owner: p, pos: o, dir: t.chestPos().sub(o).normalize(), speed: 50, radius: 1, dmg: 22, life: 0.8, color: 0xe8c0ff, size: 0.8, shape: 'orb', opts: { noCrit: true, color: 0xe8c0ff } }); } }, 500); break; }
      case 'xray': this.espT = 20; this.espR = 130; this.espThrough = true; break;
      case 'tv': this.revealNear(5, 12, 400); this.espT = 12; this.espR = 400; break;
      case 'snake': this.revealNear(10, 25, 150); this.espT = 25; this.espR = 150; break;
      case 'randSpell': { const sc = CARDS[pick(SPELL_IDS.filter((x) => !['p1014', 'p1005'].includes(x)))]; this.toast(`The remote chose ${sc.name}!`, '#ffe066'); this.resolveSpell(sc, undefined, true); break; }
      case 'postcard': { const dead = this.myTeam.members.filter((m) => !m.alive).slice(0, 2); if (!dead.length) { g.addShield(p, 80); this.toast('No fallen teammates — a spirit shield surrounds you.', '#bfe8ff'); } for (const m of dead) { m.alive = true; m.state = 'work'; m.hp = m.maxHp * 0.5; m.inv = ['s100']; this.moveBot(m, p.pos.x + rand(-3, 3), p.pos.z + rand(-3, 3)); this.materialize(m); this.toast(`${m.name} returns from the dead!`, '#ffe066'); } break; }
      case 'revenge': p.st.reflectT = 20; break;
      case 'magnet': { let n = 0; for (const pk of this.pickups) if (pk.ttl > 0 && Math.hypot(pk.x - p.pos.x, pk.z - p.pos.z) < 45) { pk.x = p.pos.x + rand(-2, 2); pk.z = p.pos.z + rand(-2, 2); n++; } this.toast(`${n} cards pulled to you`, '#7dffb0'); break; }
      case 'smoke': break;
      case 'smite': { const A = g.pAim; const gp = A.ground.clone(); gp.y = 0; g.fx.ring(gp, 0xfff0a0, 6, 1, 1.2); g.after(1.2, null, () => { g.fx.pillar(gp, 0xfff0a0, 3, 70, 0.5); g.fx.explosion(V(gp.x, 2, gp.z), 0xfff0a0, 5, 0.5); sfx('thunder'); g.hitSphere(gp, 6, p, 140, { kb: 8, heavy: true, color: 0xfff0a0, noCrit: true }); }); break; }
      case 'quiver': { const A = g.pAim; for (let i = 0; i < 24; i++) g.after(i * 0.05, p, () => { const o = p.chestPos().addScaledVector(A.flat, 1); const d = A.dir.clone(); d.x += rand(-0.1, 0.1); d.z += rand(-0.1, 0.1); d.y += rand(-0.03, 0.05); g.shoot({ owner: p, pos: o, dir: d.normalize(), speed: 90, radius: 0.6, dmg: 9, life: 0.8, color: 0xffe0a0, size: 0.5, shape: 'knife', opts: { noCrit: true, color: 0xffe0a0 } }); }); break; }
      case 'decoy': { this.makeDecoy(10); break; }
      case 'swap': break;
    }
  }
  private makeDecoy(t: number) {
    const g = this.g, p = g.player;
    const f = g.spawn(p.kind, 'player', false, 0);
    f.name = 'Decoy'; f.pos.copy(p.pos); f.pos.x += 3; f.faceNow(p.yaw); f.maxHp = f.hp = 140; f.baseSpeed = 0;
    for (const m of f.rig.mats) m.color.lerp(new THREE.Color(0x66ccff), 0.5);
    f.st.sum = 1;
    for (const b of this.bots) if (b.f && !b.ally && b.tgt === p && Math.random() < 0.6) b.tgt = f;
    this.decoyTargets(f);
    g.after(t, null, () => { g.fx.burst(f.chestPos(), 0x66ccff, 14, 6, 0.4); g.removeFighter(f); g.fighters = g.fighters.filter((x) => x !== f); });
    g.fx.pillar(f.pos, 0x66ccff, 1.4, 20, 0.6);
  }
  private decoyTargets(f: Fighter) { f.st.decoy = 1; }

  resolveSpell(c: Card, tgt?: string, free = false) {
    const g = this.g, p = g.player;
    const sp = c.fx!.sp!;
    if (!free) { if (!this.removeCard(c.id)) return; }
    const fail = (m: string) => { this.toast(m, '#ff9a9a'); if (!free && c.fx?.sp !== 'lottery') { this.addCard(c.id, true); } };
    const col = parseInt(RANK_COLOR[c.rank].slice(1), 16);
    const hostile = (b: Bot | null, label: string): Bot | null => {
      if (!b) { fail(`${c.name}: no target in range`); return null; }
      const blk = this.botBlocks(b);
      if (blk) { this.toast(`${b.name} blocked ${c.name} with ${blk}!`, '#9fe8ff'); return null; }
      this.metSet.add(b.id);
      this.feedAdd(`You cast ${c.name} on ${b.name}${label}`, '#ffd0a0');
      b.hostile = true;
      return b;
    };
    switch (sp) {
      case 'peek': this.revealNear(8, 8, 70); this.espT = 8; this.espR = 70; this.espThrough = false; break;
      case 'fluoro': this.revealNear(12, 12, 120); this.espT = 12; this.espR = 120; this.espThrough = true; break;
      case 'wall': g.addShield(p, 60); p.st.wall = 1; break;
      case 'reflect': p.st.reflectT = 8; break;
      case 'magnet': { const b = this.bots[parseInt(tgt ?? '-1', 10)]; if (!b || !b.alive) { fail('Target is gone'); break; } const bb = hostile(b, ''); if (!bb) break; const q = this.freeNear(p.pos.x + Math.sin(p.yaw) * 6, p.pos.z + Math.cos(p.yaw) * 6, 1.5); g.fx.pillar(V(bb.x, 0, bb.z), col, 1.6, 40, 0.8); this.moveBot(bb, q.x, q.z); g.fx.pillar(V(q.x, 0, q.z), col, 1.6, 40, 0.8); sfx('boom'); break; }
      case 'pickpocket': case 'thief': case 'mug': case 'corrupt': {
        const b = hostile(this.nearestBot(sp === 'mug' ? 15 : sp === 'corrupt' ? 25 : 20), '');
        if (!b) break;
        const pool = b.inv.filter((x) => x !== 's100' && (sp === 'pickpocket' ? x[0] === 'p' : sp === 'thief' ? x[0] === 's' : true));
        if (!pool.length) { this.toast(`${b.name} has nothing to take`, '#cccccc'); break; }
        const id = sp === 'mug' || sp === 'corrupt' ? pool.sort((a, z) => RANK_VALUE[this.rank(z)] - RANK_VALUE[this.rank(a)])[0] : pick(pool);
        b.inv.splice(b.inv.indexOf(id), 1);
        if (sp === 'corrupt') this.toast(`${CARDS[id].name} was corrupted into dust!`, '#ff9aff');
        else { this.addCard(id); this.toast(`Stole ${CARDS[id].name} from ${b.name}`, '#ffe066'); }
        break;
      }
      case 'return': { const t = POIS.find((x) => x.id === tgt); if (!t || !this.visited.has(t.id)) { fail('Pick a town you have visited'); break; } this.tpPlayer(t.x + rand(-10, 10), t.z + rand(-10, 10)); break; }
      case 'mimic': { const sp2 = this.inv.filter((x) => x[0] === 'p' && x !== 'p1010').sort((a, z) => RANK_VALUE[this.rank(z)] - RANK_VALUE[this.rank(a)])[0]; if (!sp2) { fail('Nothing to copy'); break; } this.addCard(sp2); break; }
      case 'relegate': case 'origin': { const b = hostile(this.nearestBot(30), ''); if (!b) break; const s = poi('shiso'); const q = sp === 'origin' ? this.freeNear(s.x + rand(-10, 10), s.z + rand(-10, 10), 2) : this.freeNear(rand(-600, 600), rand(-600, 600), 3); g.fx.pillar(V(b.x, 0, b.z), col, 2, 40, 0.8); this.moveBot(b, q.x, q.z); b.goal = null; break; }
      case 'leave': {
        const b = this.nearestBot(12);
        if (!b) { fail('Leave: no target within 12m'); break; }
        this.warnT = 0;
        this.toast(`Leave is closing on ${b.name}…`, '#ff9a9a');
        g.fx.ring(V(b.x, 0, b.z), 0xff5a5a, 6, 1, 3);
        g.after(3, null, () => { if (!b.alive) return; if (Math.hypot(b.x - p.pos.x, b.z - p.pos.z) > 20) { this.toast(`${b.name} escaped Leave!`, '#9fe8ff'); return; } const blk = this.botBlocks(b); if (blk) { this.toast(`${b.name} countered with ${blk}!`, '#9fe8ff'); return; } g.fx.pillar(V(b.x, 0, b.z), 0xffffff, 3, 90, 1.2); sfx('thunder'); if (b.f) { b.f.dead = false; g.damage(p, b.f, 99999, { pierce: true, noCrit: true, noMeter: true }); } else this.finalizeBot(b, { isPlayer: true, name: 'You' } as unknown as Fighter, 'was ejected by Leave'); });
        break;
      }
      case 'clair': { const n = this.revealNear(6, 20, 300); this.espT = 20; this.espR = 300; this.toast(`Clairvoyance reveals ${n} players`, '#e0c0ff'); break; }
      case 'drift': { const un = POIS.filter((x) => !this.visited.has(x.id)); const t = un.length ? pick(un) : null; if (!t) { fail('You have visited every town'); break; } this.tpPlayer(t.x + rand(-10, 10), t.z + rand(-10, 10)); break; }
      case 'collision': { const un = this.bots.filter((b) => b.alive && b.team !== 0 && !this.metSet.has(b.id)); const b = un.length ? pick(un) : null; if (!b) { fail('You have met everyone'); break; } this.tpPlayer(b.x + rand(-5, 5), b.z + rand(-5, 5)); this.metSet.add(b.id); this.toast(`You crashed next to ${b.name}!`, '#ffb070'); break; }
      case 'levy': { let n = 0; for (const b of this.bots) { if (!b.alive || b.team === 0 || Math.hypot(b.x - p.pos.x, b.z - p.pos.z) > 20) continue; if (this.botBlocks(b)) continue; const pool = b.inv.filter((x) => x !== 's100'); if (!pool.length) continue; const id = pick(pool); b.inv.splice(b.inv.indexOf(id), 1); this.addCard(id); b.hostile = true; n++; } if (!n) this.toast('Levy found no one to tax', '#cccccc'); break; }
      case 'bridge': p.st.bridgeT = 60; break;
      case 'fake': this.makeDecoy(10); break;
      case 'truce': { for (const f of g.fighters) if (!f.dead && Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) < 15) f.st.truceT = 6; g.fx.shockwave(V(p.pos.x, 0, p.pos.z), 0xffffff, 15, 0.8); break; }
      case 'dispel': this.cleanse(); break;
      case 'blackout': p.st.blackoutT = 45; break;
      case 'holy': p.st.barrierImmT = 25; p.st.holyN = 10; g.fx.pillar(p.pos, 0x9fe8ff, 2.2, 40, 1); break;
      case 'trace': { const b = hostile(this.nearestBot(60), ''); if (!b) break; this.traced = b; this.traceT = 25; b.revealT = 25; break; }
      case 'rock': { const A = g.pAim; const gp = A.ground.clone(); gp.y = 0; const from = p.chestPos(); const d = gp.clone().sub(from); const L = Math.hypot(d.x, d.z) || 1; g.shoot({ owner: p, pos: from.addScaledVector(A.flat, 1), dir: V(d.x / L, 0.65, d.z / L).normalize(), speed: clamp(L * 0.9, 18, 50), radius: 0.8, dmg: 5, life: 2.6, color: 0xb0a090, size: 1.6, shape: 'orb', grav: 26, opts: { noCrit: true }, onEnd: (pos) => { const cc = V(pos.x, 0, pos.z); g.fx.explosion(V(pos.x, 1, pos.z), 0xc0a080, 4, 0.5); g.fx.debris(cc, 12, 8); sfx('boom'); g.hitSphere(cc, 6, p, 55, { kb: 7, heavy: true, color: 0xc0a080, noCrit: true }); } }); break; }
      case 'list': { const rich = this.bots.filter((b) => b.alive && b.team !== 0 && b.hideT <= 0).sort((a, z) => this.richness(z.inv) - this.richness(a.inv)).slice(0, 3); for (const b of rich) { b.revealT = 15; this.metSet.add(b.id); } this.toast(`Richest: ${rich.map((b) => b.name).join(', ')}`, '#ffe066'); break; }
      case 'accompany': {
        const friends = this.myTeam.members.filter((m) => m.alive && m.f);
        let dest: { x: number; z: number } | null = null;
        if (tgt === 'ally' || !tgt) { const fr = friends.find((m) => Math.hypot(m.x - p.pos.x, m.z - p.pos.z) > 60); dest = fr ? { x: fr.x, z: fr.z } : null; }
        else { const t = POIS.find((x) => x.id === tgt); if (t && this.visited.has(t.id)) dest = { x: t.x, z: t.z }; }
        if (!dest) { const t = POIS.filter((x) => this.visited.has(x.id)); const q = t.length ? pick(t) : poi('shiso'); dest = { x: q.x, z: q.z }; }
        this.tpPlayer(dest.x + rand(-6, 6), dest.z + rand(-6, 6), 20);
        break;
      }
      case 'contact': { for (const m of this.myTeam.members) if (m.f) g.heal(m.f, m.f.maxHp * 0.25); if (this.myTeam.members.length === 0) g.heal(p, p.maxHp * 0.15); else g.heal(p, p.maxHp * 0.15, true); break; }
      case 'analysis': this.scanT = 25; this.scanR = 140; this.scanAll = false; break;
      case 'lottery': { const id = Math.random() < 0.16 ? rollRank(pick<Rank>(['C', 'B', 'A'])) : rollCard(1, this.luck, 0.6); this.addCard(id); break; }
    }
    sfx('level');
  }

  // ------------------------------------------------------------------ rendering of pickups & chests
  private renderPickups(dt: number) {
    void dt;
    const g = this.g, p = g.player;
    const time = g.time;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0), s = V(1, 1, 1);
    const col = new THREE.Color();
    let n = 0, nb = 0;
    const R = 150;
    for (const pk of this.pickups) {
      if (pk.ttl <= 0) continue;
      const dx = pk.x - p.pos.x, dz = pk.z - p.pos.z;
      if (dx * dx + dz * dz > R * R) continue;
      if (n >= 690) break;
      const y = 1.5 + Math.sin(time * 2 + pk.id) * 0.25;
      q.setFromAxisAngle(up, time * 1.6 + pk.id);
      const small = pk.jenny ? 0.7 : 1;
      s.set(small, small, small);
      m4.compose(V(pk.x, y, pk.z), q, s);
      this.cardMesh.setMatrixAt(n, m4);
      col.set(pk.herb ? '#7dff7d' : pk.jenny ? '#ffd24a' : RANK_COLOR[pk.rank]).multiplyScalar(1.5);
      this.cardMesh.setColorAt(n, col);
      n++;
      if ((pk.card && RANK_VALUE[pk.rank] >= RANK_VALUE.B) || pk.herb) {
        if (nb < 395) { m4.compose(V(pk.x, 0, pk.z), new THREE.Quaternion(), V(1, 1, 1)); this.beamMesh.setMatrixAt(nb, m4); col.set(pk.herb ? '#7dff7d' : RANK_COLOR[pk.rank]).multiplyScalar(1.4); this.beamMesh.setColorAt(nb, col); nb++; }
      }
    }
    this.cardMesh.count = n;
    this.cardMesh.instanceMatrix.needsUpdate = true;
    if (this.cardMesh.instanceColor) this.cardMesh.instanceColor.needsUpdate = true;
    let nc = 0;
    for (const c of this.chests) {
      if (c.opened) continue;
      const dx = c.x - p.pos.x, dz = c.z - p.pos.z;
      if (dx * dx + dz * dz > R * R * 1.5) continue;
      if (nc >= 395) break;
      const sc = c.big ? 1.9 : 1;
      s.set(sc, sc, sc);
      m4.compose(V(c.x, 0, c.z), new THREE.Quaternion().setFromAxisAngle(up, c.id), s);
      this.chestMesh.setMatrixAt(nc, m4);
      col.set(c.big ? '#ffd24a' : c.tier >= 2 ? '#b06bff' : c.tier === 1 ? '#c9a24a' : '#8a5a2a');
      this.chestMesh.setColorAt(nc, col);
      nc++;
      if ((c.tier >= 1 || c.big) && nb < 399) { m4.compose(V(c.x, 0, c.z), new THREE.Quaternion(), c.big ? V(2.4, 1.6, 2.4) : V(1.2, 1, 1.2)); this.beamMesh.setMatrixAt(nb, m4); col.set(c.big ? '#ffd24a' : c.tier >= 2 ? '#b06bff' : '#ffe9a0').multiplyScalar(1.3); this.beamMesh.setColorAt(nb, col); nb++; }
    }
    this.chestMesh.count = nc;
    this.chestMesh.instanceMatrix.needsUpdate = true;
    if (this.chestMesh.instanceColor) this.chestMesh.instanceColor.needsUpdate = true;
    this.beamMesh.count = nb;
    this.beamMesh.instanceMatrix.needsUpdate = true;
    if (this.beamMesh.instanceColor) this.beamMesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ HUD
  private hudTick(dt: number) { void dt; }
  hud(): BrHudState {
    const g = this.g, p = g.player;
    const z = this.zoneAt(this.t);
    const spells: Record<string, number> = {}, spec: Record<string, number> = {};
    for (const id of this.inv) { if (id[0] === 'p') spells[id] = (spells[id] ?? 0) + 1; else spec[id] = (spec[id] ?? 0) + 1; }
    const marks: BrHudState['mini']['marks'] = [];
    const px = p.pos.x, pz = p.pos.z;
    for (const m of this.myTeam.members) if (m.alive) marks.push({ x: m.x, z: m.z, t: 'ally' });
    const hidden = (p.st.blackoutT ?? 0) > 0;
    void hidden;
    for (const b of this.bots) if (b.alive && b.revealT > 0 && b.hideT <= 0 && !b.ally) marks.push({ x: b.x, z: b.z, t: b === this.traced ? 'trace' : 'enemy', label: b.name });
    if (this.has('s000') || this.bots.some((b) => b.alive && b.inv.includes('s000'))) for (const b of this.bots) if (b.alive && (b.inv.includes('s000') || b.inv.includes('s081'))) marks.push({ x: b.x, z: b.z, t: 'beacon', label: b.name });
    for (const q of this.quests) void q;
    for (const c of this.chests) if (!c.opened && c.big) marks.push({ x: c.x, z: c.z, t: 'drop', label: 'Greed Drop' });
    if (this.boss && this.boss.alive) marks.push({ x: this.boss.x, z: this.boss.z, t: 'boss', label: 'Genthru' });
    for (const n of this.npcs) marks.push({ x: n.x, z: n.z, t: 'npc', label: n.name });
    if (this.scanT > 0) {
      let k = 0;
      for (const c of this.chests) if (!c.opened && Math.hypot(c.x - px, c.z - pz) < this.scanR && k++ < 120) marks.push({ x: c.x, z: c.z, t: 'chest' });
      for (const pk of this.pickups) if (pk.ttl > 0 && Math.hypot(pk.x - px, pk.z - pz) < this.scanR && k++ < 160) marks.push({ x: pk.x, z: pk.z, t: 'loot' });
    }
    const it = this.nearestInteract();
    const prompt = it && !this.dialog ? { text: it.text, key: 'E' } : null;
    const effects: BrHudState['effects'] = [];
    const eff = (k: string, name: string, color: string, max: number) => { const v = p.st[k] ?? 0; if (v > 0) effects.push({ name, t: v, max, color }); };
    eff('stealthT', 'Stealth', '#c0c0ff', 20); eff('reflectT', 'Reflect', '#9fe8ff', 8); eff('barrierImmT', 'Barrier Immune', '#c8a0ff', 25); eff('bridgeT', 'Drawbridge', '#a0d0ff', 60);
    eff('blackoutT', 'Blackout', '#707080', 45); eff('hotT', 'Regenerating', '#7dff9a', 8); eff('atkBuffT', 'Attack Speed', '#ffc45a', 60); eff('truceT', 'Truce', '#ffffff', 6);
    if (p.buffT > 0) effects.push({ name: 'Empowered', t: p.buffT, max: 60, color: '#ffc45a' });
    if (this.surgeT > 0) effects.push({ name: 'Barrier Surge', t: this.surgeT, max: 22, color: '#ff5a5a' });
    const esp: BrHudState['esp'] = [];
    if (this.espT > 0 || this.traceT > 0) {
      const v = V();
      for (const b of this.bots) {
        if (!b.alive || b.ally || b.hideT > 0) continue;
        const d = Math.hypot(b.x - px, b.z - pz);
        const tr = b === this.traced && this.traceT > 0;
        if (!tr && (this.espT <= 0 || d > this.espR || b.revealT <= 0)) continue;
        v.set(b.x, 3, b.z).project(g.camera);
        if (v.z > 1 || v.z < -1) continue;
        esp.push({ x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5, name: b.name, dist: d, color: tr ? '#ff5a5a' : '#ffe066' });
      }
    }
    const sh = p.st.shield ?? 0;
    const met = [...this.metSet].map((id) => this.bots[id]).filter((b) => b && b.alive).sort((a, c) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(c.x - px, c.z - pz)).slice(0, 12);
    const bossF = this.boss?.f && !this.boss.f.dead && Math.hypot(this.boss.f.pos.x - px, this.boss.f.pos.z - pz) < 90 ? this.boss : null;
    const nearMon = this.mons.find((m) => m.f && !m.f.dead && m.def.boss && m.f.team === 'monster' && m.f.st.aggro && Math.hypot(m.f.pos.x - px, m.f.pos.z - pz) < 70);
    const bf = bossF ?? nearMon ?? null;
    return {
      begun: this.begun, over: this.over,
      cut: this.cutActive ? { lines: CUT.filter((c) => c.t <= this.cutT).slice(-2).map((c) => ({ title: c.title, text: c.text, who: c.who })), t: this.cutT, len: CUT_LEN, skip: this.cutT > 2, flash: this.cutFlash } : null,
      time: this.t, alive: this.aliveCount(), teams: this.teamsAlive(), kills: this.kills, format: this.format,
      zone: { r: z.r, phase: z.phase, closing: z.closing, tNext: z.tNext, nextR: z.to, dps: z.dps * (this.surgeT > 0 ? 2 : 1), started: this.t >= 60 },
      outside: Math.hypot(px, pz) > z.r && this.t >= 60, edge: z.r - Math.hypot(px, pz), jenny: this.jenny, binderOpen: this.binderOpen, mapOpen: this.mapOpen,
      spells: Object.entries(spells).map(([id, n]) => ({ id, n })), spec, specCount: Object.keys(spec).length, spellCount: this.spellCount,
      prompt, dialog: this.dialog, quests: this.quests.map((q) => ({ ...q })), feed: this.feed.map((f) => ({ text: f.text, color: f.color })), toasts: this.toasts.map((t) => ({ text: t.text, color: t.color })),
      mini: { x: px, z: pz, yaw: g.camYaw, safeR: z.r, nextR: z.to, marks },
      allies: this.myTeam.members.map((m) => ({ name: m.name, hp: m.f ? m.f.hp : m.hp, maxHp: m.f ? m.f.maxHp : m.maxHp, alive: m.alive })),
      effects, casting: this.casting ? { name: this.casting.name, t: this.casting.t, max: this.casting.max } : null,
      boss: bf ? { name: bf.name, hp: bf.f?.hp ?? bf.hp, maxHp: bf.def.hp } : null,
      trade: this.trade ? { name: this.trade.bot.name, give: this.trade.give, want: this.trade.want } : null,
      esp, warn: this.warnT > 0 ? this.warn : '', dodge: this.dodge ? { t: this.dodge.t, lives: this.dodge.lives } : null, luck: this.luck, result: this.result,
      met: met.map((b) => ({ id: String(b.id), label: b.name, sub: `${Math.round(Math.hypot(b.x - px, b.z - pz))}m · ${b.pers.title}` })),
      towns: POIS.filter((t) => this.visited.has(t.id)).map((t) => ({ id: t.id, label: t.name })), hasFriends: this.myTeam.members.length > 0, shield: sh, shieldMax: p.st.shMax ?? 100, revealAll: this.scanAll,
    };
  }
  noteHit(att: Fighter, vic: Fighter) {
    if (vic.isPlayer || vic.team === 'player' || att.isPlayer || att.team === 'player') this.combatT = 6;
    const b = vic.st.botId !== undefined ? this.bots[vic.st.botId] : null;
    if (b && att !== vic) { b.hostile = true; b.tgt = att; b.react = 0; b.tgtT = 1; b.hideT = 0; }
  }
  stats() { return this.result; }
  hintFor(k: string) { return HINTS[k] ?? ''; }

  // ------------------------------------------------------------------ cleanup
  dispose() {
    const g = this.g;
    g.scene.remove(this.world.group, this.cardMesh, this.beamMesh, this.chestMesh);
    this.world.dispose();
    this.cardMesh.dispose(); this.beamMesh.dispose(); this.chestMesh.dispose();
    for (const r of this.zoneRings) g.scene.remove(r);
    g.camera.far = 1200;
    g.camera.updateProjectionMatrix();
  }
}
