import * as THREE from 'three';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { CHARS } from '../chars';
import { ALL_KINDS, type PlayableKind } from '../defs';
import { REWORKS } from '../balance';
import { sfx, setMusic } from '../audio';
import { buildGreedIsland, type GreedWorld } from './world';
import { attachCreature, updateCreature } from '../creatures';
import { Cutscene, CUT, CUT_LEN, CUT_TP } from './cutscene';
import * as T from '../terrain';
import {
  CARDS, SPELL_IDS, BARRIER_T, RANK_COLOR, RANK_VALUE, ZONE_PHASES, MONS, POIS, DUNGEONS, MAP_R, CHAT, poi, rollCard, rollRank, resetIssued,
  makePersonalities, makeNames, type Rank, type Pers, type MonDef, type Card, type Pass, type Poi,
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
const EXPECT: [number, number][] = [[0, 100], [200, 98], [700, 90], [1200, 74], [1700, 52], [2200, 30], [2600, 15], [2900, 5], [3000, 2]];
const expectedAlive = (t: number) => { for (let i = 1; i < EXPECT.length; i++) if (t < EXPECT[i][0]) { const [t0, a0] = EXPECT[i - 1], [t1, a1] = EXPECT[i]; return a0 + ((a1 - a0) * (t - t0)) / (t1 - t0); } return 1; };

interface Bot {
  id: number; name: string; kind: PlayableKind; team: number; pers: Pers; x: number; z: number; hp: number; maxHp: number; level: number; alive: boolean;
  inv: string[]; jenny: number; kills: number; state: 'travel' | 'work' | 'fight' | 'zone' | 'flee' | 'dead'; stateT: number; goal: { x: number; z: number } | null; work: string;
  fightT: number; foe: Bot | null; f: Fighter | null; shield: number; revealT: number; hideT: number; chatT: number; hostile: boolean; ally: boolean; cp: number;
  tgt: Fighter | null; tgtT: number; react: number; seen: boolean; spellT: number; fleeing: number; met: boolean;
  /** per-bot memory: strategy, risk appetite, known players, grudges, pacts */
  m: Record<string, any>;
}
interface Pickup { id: number; x: number; z: number; card?: string; jenny?: number; herb?: boolean; rank: Rank; ttl: number }
interface Chest { id: number; x: number; z: number; tier: number; opened: boolean; big?: boolean; name?: string; guard?: number[] }
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
  begun: boolean; over: boolean; mapLevel: number; cut: { lines: { title?: string; text: string; who?: string; t?: number }[]; t: number; len: number; skip: boolean; flash: number; scene: string } | null;
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
  orient: { title: 'Orientation Run', desc: 'Visit both Antokiba and Masadora', goal: 2, reward: 'An Island Chart + 2,000 J' },
  prize: { title: 'Antokiba Prize Contest', desc: 'Beat the reigning Contest Champion in a duel at the Antokiba colosseum', goal: 1, reward: 'Sword of Truth (#083) + 2,000 J' },
  k_parcel: { title: 'Sealed Parcel', desc: 'Carry the sealed parcel to Dorias (7 km away) – do not die on the way', goal: 1, reward: 'An A-rank card + 3,000 J' },
  k_courier: { title: 'Harbor Letter', desc: 'Deliver the harbor letter to Soufrabi', goal: 1, reward: 'Two spell cards + 1,500 J' },
  k_golem: { title: 'Dungeon Cleaner', desc: 'Defeat a Dungeon Guardian in any dungeon', goal: 1, reward: 'Miniature Dragon (S)' },
  cyclops: { title: "Biscuit's Training", desc: 'Defeat 3 Cyclops in the Badlands', goal: 3, reward: "Mad Scientist's Steroids + 2,500 J" },
  herbs: { title: 'Sick Villagers', desc: 'Gather 4 medicinal herbs around the bandit village', goal: 4, reward: 'Wild Luck Alexandrite' },
  pirates: { title: "Razor's Pirates", desc: 'Defeat the Pirate Captain at the Soufrabi lighthouse', goal: 1, reward: 'Blue Planet (SS)' },
  bounty: { title: 'Bounty Board', desc: 'Eliminate the marked player', goal: 1, reward: '5,000 J + a rare card' },
  k_locust: { title: 'Pest Control', desc: 'Defeat 7 Pearl Locusts for Farmer Hale', goal: 7, reward: 'A C-rank card + 1,800 J' },
  k_puffball: { title: 'Fluff Trouble', desc: 'Defeat 3 Hyper Puffballs for Mossy the herbalist', goal: 3, reward: 'A B-rank card' },
  k_bubblehorse: { title: 'Catch the Bubble Horse', desc: 'Corner a Bubble Horse (switch Ten and Zetsu!)', goal: 1, reward: 'A rare spell card + 2,500 J' },
  k_rat: { title: 'Rat Catcher', desc: 'Defeat 8 Radio Rats near the docks', goal: 8, reward: 'Two spell cards' },
  k_lizard: { title: 'The Black Lizard', desc: 'Slay the Melanin Lizard haunting the Badlands', goal: 1, reward: 'An A-rank card + 4,000 J' },
  k_wolf: { title: 'Wolf Pack', desc: 'Defeat 6 wolves for the bandit elder', goal: 6, reward: 'A C-rank card + Jenny' },
  k_beetle: { title: 'King of Insects', desc: 'Defeat a King White Stag Beetle', goal: 1, reward: 'An A-rank card' },
  wander: { title: 'Grand Tour', desc: 'Visit 5 different cities', goal: 5, reward: 'Map bonus: S-rank card' },
};
const EXTRA_REWARD: Record<string, (b: BR) => void> = {
  k_locust: (b) => { b.addCard(rollRank('C')); b.addJenny(1800); },
  k_puffball: (b) => { b.addCard(rollRank('B')); },
  k_bubblehorse: (b) => { b.addCard(pick(SPELL_IDS.filter((id) => ['B', 'C', 'A'].includes(CARDS[id].rank)))); b.addJenny(2500); },
  k_rat: (b) => { b.addCard(pick(SPELL_IDS)); b.addCard(pick(SPELL_IDS)); },
  k_lizard: (b) => { b.addCard(rollRank('A')); b.addJenny(4000); },
  k_wolf: (b) => { b.addCard(rollRank('C')); b.addJenny(1500); },
  k_parcel: (b) => { b.addCard(rollRank('A')); b.addJenny(3000); },
  k_courier: (b) => { b.addCard(pick(SPELL_IDS)); b.addCard(pick(SPELL_IDS)); b.addJenny(1500); },
  k_golem: (b) => { b.addCard('s051'); },
  k_beetle: (b) => { b.addCard(rollRank('A')); },
  wander: (b) => { b.addCard(rollRank('S')); },
};
const EXTRA_NPCS: { id: string; name: string; poi: string; dx: number; dz: number; tint: number; variant: number; text: string; quest: string }[] = [
  { id: 'farmer', name: 'Farmer Hale', poi: 'rubicuta', dx: 14, dz: 10, tint: 0xc8b070, variant: 1, text: "Those pearl-shelled locusts are eating my crops! Squash four of them out on the fields and I'll pay you in cards.", quest: 'k_locust' },
  { id: 'herbalist', name: 'Old Mossy', poi: 'bunzen', dx: 12, dz: -8, tint: 0x7ab86a, variant: 2, text: "Hyper Puffballs drift in from the meadows and prickle everything. Pop three and I'll share my best finds.", quest: 'k_puffball' },
  { id: 'stable', name: 'Stable Master', poi: 'dodgeball', dx: 14, dz: 12, tint: 0xd8a070, variant: 3, text: "Bubble Horses can't be caught by force. Stay calm, switch between Ten and Zetsu, and corner one — you'll earn a fine spell card.", quest: 'k_bubblehorse' },
  { id: 'fisher', name: 'Dockhand Pete', poi: 'soufrabi', dx: 20, dz: 14, tint: 0x6a9ac8, variant: 1, text: 'Radio Rats keep gnawing the nets and stealing cards from careless hunters. Get rid of five and the spells are yours.', quest: 'k_rat' },
  { id: 'ranger', name: 'Ranger Ione', poi: 'badlands', dx: -14, dz: 10, tint: 0xd89a60, variant: 2, text: 'A black Melanin Lizard has taken the canyon. Nobody sane fights it head-on — but a brave Hunter might. A-rank cards await.', quest: 'k_lizard' },
  { id: 'elder', name: 'Bandit Elder', poi: 'bandits', dx: -12, dz: -10, tint: 0xb0a090, variant: 0, text: 'A wolf pack circles our palisade at night. Thin their numbers, outsider, and we will pay.', quest: 'k_wolf' },
  { id: 'butler', name: 'Mansion Butler', poi: 'mansion', dx: 12, dz: 18, tint: 0xe8e0d0, variant: 3, text: 'A King White Stag Beetle nests in the garden woods. The Mistress would be most grateful if it were removed.', quest: 'k_beetle' },
  { id: 'contest', name: 'Contest Master', poi: 'antokiba', dx: 0, dz: -226, tint: 0xd8503a, variant: 2, text: 'The monthly Antokiba tournament! Beat our reigning Champion in a fair duel in the colosseum and the Sword of Truth is yours.', quest: 'prize' },
  { id: 'courier1', name: 'Spell Shop Courier', poi: 'masadora', dx: -16, dz: 12, tint: 0xb58cff, variant: 1, text: 'A sealed parcel has to reach the Dorias casino owner. Do not open it, do not dawdle – and watch your back, hunters love parcels.', quest: 'k_parcel' },
  { id: 'courier2', name: 'Harbor Clerk', poi: 'port', dx: -12, dz: 8, tint: 0x6ad0ff, variant: 3, text: 'This letter must reach the Soufrabi harbor master. The road is long, and the island is dangerous.', quest: 'k_courier' },
  { id: 'miner', name: 'Old Prospector', poi: 'badlands', dx: 14, dz: -8, tint: 0xc89a60, variant: 0, text: 'A stone golem guards every old dungeon on this island. Bring me proof one of them is down and I will hand over my miniature dragon.', quest: 'k_golem' },
  { id: 'cartog1', name: 'Cartographer', poi: 'limeiro', dx: 16, dz: 14, tint: 0xe8d8a0, variant: 1, text: '', quest: '' },
  { id: 'cartog2', name: 'Cartographer', poi: 'aiai', dx: 14, dz: 12, tint: 0xe8d8a0, variant: 1, text: '', quest: '' },
  { id: 'cartog3', name: 'Cartographer', poi: 'soufrabi', dx: 16, dz: 10, tint: 0xe8d8a0, variant: 1, text: '', quest: '' },
  { id: 'cartog4', name: 'Cartographer', poi: 'dorias', dx: 14, dz: 14, tint: 0xe8d8a0, variant: 1, text: '', quest: '' },
  { id: 'guide', name: 'Limeiro Guide', poi: 'limeiro', dx: 0, dz: 70, tint: 0xf0d078, variant: 0, text: 'Greed Island is vast. Walk its cities — Antokiba, Masadora, Dorias, Aiai, Soufrabi — and the Game Masters will reward the traveller.', quest: 'wander' },
];
const NPC_DEFS0: { id: string; name: string; poi: string; dx: number; dz: number; tint: number; variant: number }[] = [
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
const NPC_DEFS = [...NPC_DEFS0, ...EXTRA_NPCS.map(({ id, name, poi, dx, dz, tint, variant }) => ({ id, name, poi, dx, dz, tint, variant }))];
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
  private cosmetics: Fighter[] = []; spawnPts: { x: number; z: number }[] = []; private cs: Cutscene | null = null; private fogDone = false; private camPos = V(); private expectBoost = 1; private sacUsed = false; private lastPlayerPos = V();

  constructor(g: Game, kind: PlayableKind, format: Format) {
    g.br = this;
    this.g = g; this.kind = kind; this.format = format;
    resetIssued();
    this.world = buildGreedIsland();
    g.scene.add(this.world.group);
    g.cur = this.world;
    g.setEnv(this.world.env);
    g.camera.far = 9500;
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

    this.world.prime(poi('shiso').x, poi('shiso').z);
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
    const names = makeNames(100);
    const kinds = shuffle([...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS, ...ALL_KINDS]);
    const pts = this.spawnPoints(nTeams);
    this.spawnPts = pts;
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
          inv: [...(Math.random() < 0.1 ? ['s100'] : Math.random() < 0.55 ? ['s101'] : []), pick(['p1003', 'p1001', 'p1009', 'p1025']), pick(['p1038', 'p1031', 'p1019', 'p1002'])], jenny: START_J + Math.floor(rand(-800, 1500)), kills: 0, state: 'work', stateT: rand(3, 9), goal: null, work: 'loot',
          fightT: 0, foe: null, f: null, shield: 0, revealT: 0, hideT: 0, chatT: rand(10, 45), hostile: false, ally: tI === 0, cp: 1, tgt: null, tgtT: 0, react: 0, seen: false, spellT: rand(8, 30), fleeing: 0, met: false, m: {},
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
    this.inv = ['p1003', 'p1009', 'p1001'];
    this.recompute();
  }

  /** every team gets a dry, gentle patch of land; nearest neighbours are ~1300–2500 m apart (1–2 min of two players walking towards each other) */
  private spawnPoints(n: number) {
    const avoid = POIS.map((p) => ({ x: p.x, z: p.z, r: p.r * 1.3 }));
    let best: { x: number; z: number }[] = [], bestScore = -1;
    for (let k = 0; k < 7; k++) {
      const pts = T.landPoints(n, Math.random, { maxR: 6900, avoid });
      let md = 1e9;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) md = Math.min(md, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
      const score = pts.length >= n ? md : md - 5000;
      if (score > bestScore) { bestScore = score; best = pts; }
      if (pts.length >= n && md > 1400) break;
    }
    while (best.length < n) best.push({ x: rand(-600, 600), z: rand(-600, 600) });
    shuffle(best);
    return best;
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
    for (const h of w.herbSpots) this.pickups.push({ id: this.nextId++, x: h.x, z: h.z, herb: true, rank: 'D', ttl: 1e9 });
    const addMon = (def: string, x: number, z: number, nameSfx = '') => {
      const d = MONS[def];
      const p = this.freeNear(x, z, 2.5 * d.scale);
      this.mons.push({ id: this.nextId++, def: d, x: p.x, z: p.z, hx: p.x, hz: p.z, hp: d.hp, alive: true, f: null, name: d.name + nameSfx, atkT: 1, windT: 0, spawned: false });
    };
    const around = (id: string, n: number, d0: number, d1: number, def: string) => { const p = poi(id); for (let i = 0; i < n; i++) { const a = rand(0, 6.28), d = rand(d0, d1); addMon(def, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d); } };
    const sp = this.spawnPts;
    const nearSpawn = (x: number, z: number) => sp.some((q) => Math.hypot(q.x - x, q.z - z) < 300);
    const scatter = (def: string, n: number, test: (x: number, z: number, h: number) => boolean, pack = 1) => {
      let c = 0, g = 0;
      while (c < n && g++ < n * 500) {
        const x = rand(-6400, 6400), z = rand(-7000, 6800), h = T.groundAt(x, z);
        if (h < 2 || T.sdf(x, z) < 200 || !test(x, z, h) || nearSpawn(x, z) || POIS.some((p) => Math.hypot(p.x - x, p.z - z) < p.r * 1.2)) continue;
        for (let i = 0; i < pack; i++) { const a = rand(0, 6.28), d = rand(4, 24); addMon(def, x + Math.cos(a) * d, z + Math.sin(a) * d); }
        c++;
      }
    };
    const bad = (x: number, z: number) => T.badAt(x, z) > 0.45, forest = (x: number, z: number) => T.forestAt(x, z) > 0.4;
    const low = (x: number, z: number, h: number) => h < 60 && T.forestAt(x, z) < 0.3 && T.badAt(x, z) < 0.2;
    scatter('cyclops', 9, bad, 3); scatter('lizard', 5, bad); scatter('melanin', 10, bad);
    scatter('wolf', 16, forest, 4); scatter('beast', 12, forest); scatter('beetle', 9, (x, z, h) => forest(x, z) || h > 80);
    scatter('puffball', 22, low, 2); scatter('bubblehorse', 12, low); scatter('locust', 12, low, 4); scatter('rat', 14, (_x, _z, h) => h < 8, 2);
    scatter('wolf', 5, (_x, _z, h) => h > 110, 3);
    around('mansion', 2, 40, 70, 'beetle');
    for (const d of DUNGEONS) { addMon('beetle', d.x + 22, d.z + 6); addMon('golem', d.x, d.z + 11, ' · ' + d.name); }
    const lh = poi('lighthouse');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; addMon('pirate', lh.x + Math.cos(a) * 20, lh.z + Math.sin(a) * 20); }
    addMon('captain', lh.x + 6, lh.z + 14);
    const mn = poi('mansion');
    addMon('guard', mn.x, mn.z + 30);
    // rare sites: the only chests on the island. Each one is sealed until its guardians are defeated.
    for (const sc of w.secretSpots) {
      const guards: number[] = this.mons.filter((m) => !m.def.ally && Math.hypot(m.x - sc.x, m.z - sc.z) < 40).map((m) => m.id);
      if (guards.length < 2) {
        const pool = sc.tier >= 3 ? ['cyclops', 'beast', 'beetle', 'lizard'] : ['wolf', 'beast', 'beetle', 'melanin'];
        const n = sc.tier >= 3 ? 3 : 2;
        for (let i = 0; i < n; i++) { addMon(pick(pool), sc.x + rand(-16, 16), sc.z + rand(-16, 16)); guards.push(this.mons[this.mons.length - 1].id); }
      }
      this.chests.push({ id: this.nextId++, x: sc.x, z: sc.z, tier: sc.tier, opened: false, name: sc.name, guard: guards });
    }
    for (const d of NPC_DEFS) { const p = poi(d.poi); const q = this.freeNear(p.x + d.dx, p.z + d.dz, 1.5); this.npcs.push({ id: d.id, name: d.name, x: q.x, z: q.z, f: null, tint: d.tint, yaw: rand(0, 6.28), variant: d.variant }); }
  }

  // ------------------------------------------------------------------ cutscene / start
  begin() {
    if (this.begun) return;
    this.begun = true;
    this.cutActive = true;
    this.g.paused = false;
    this.buildStage();
    this.world.vegOn = false;
  }
  /** the cutscene can not be skipped */
  skipCut() { /* unskippable by design */ }

  private buildStage() { this.cs = new Cutscene(this.g, this.world, this.g.player); }
  private endStage() { this.cs?.dispose(); this.cs = null; }

  cutCamera(cam: THREE.PerspectiveCamera, real: number): boolean {
    if (!this.cutActive || !this.cs) return false;
    void real;
    this.cs.camera(cam, this.cutT);
    this.camPos.copy(cam.position);
    return true;
  }

  private updateCut(dt: number) {
    this.cutT += dt;
    const t = this.cutT, g = this.g, s = poi('shiso');
    const fog = g.scene.fog as THREE.Fog | null;
    if (this.cs) this.cutFlash = this.cs.update(t, dt, s, () => { const p = g.player; p.st.pin = 0; p.pos.set(s.x, T.groundAt(s.x, s.z + 24), s.z + 24); p.vy = 0; p.faceNow(Math.PI); g.camYaw = Math.PI; });
    if (t >= 46.2 && !this.fogDone && fog) { this.fogDone = true; fog.near = this.world.env.fogN * 2; fog.far = this.world.env.fogF * 1.6; fog.color.set(this.world.env.fog); }
    if (t >= CUT_TP && !this.cutDone) { g.flash('#ffffff', 0.9); sfx('boom'); this.teleportAll(); }
    if (t >= CUT_LEN) { this.cutActive = false; this.finishStart(); }
    if (t >= 46.2) { this.world.vegOn = this.camPos.y < 260; this.world.setFocus(this.camPos.x, this.camPos.z, 3600); } else this.world.setFocus(s.x, s.z, 600);
  }

  private teleportAll() {
    this.cutDone = true;
    const g = this.g;
    g.player.st.pin = 0;
    for (const f of this.cosmetics) { g.fx.pillar(f.pos, 0xb08cff, 2.2, 50, 1.2); g.removeFighter(f); g.fighters = g.fighters.filter((x) => x !== f); }
    this.cosmetics = [];
    const p = g.player;
    g.fx.pillar(p.pos, 0xffffff, 3, 70, 1.4);
    const sp = this.freeNear(this.sp.x, this.sp.z, 3);
    this.world.prime(sp.x, sp.z);
    this.world.vegOn = true;
    p.pos.set(sp.x, T.groundAt(sp.x, sp.z), sp.z);
    p.vy = 0;
    g.camYaw = Math.atan2(-sp.x, -sp.z) + Math.PI;
    p.faceNow(Math.atan2(-sp.x, -sp.z));
    let i = 0;
    for (const b of this.myTeam.members) if (b.f) { const q = this.freeNear(sp.x + Math.cos(i * 2) * 4, sp.z + Math.sin(i * 2) * 4, 1.5); b.f.pos.set(q.x, T.groundAt(q.x, q.z), q.z); b.x = q.x; b.z = q.z; i++; }
    g.fx.pillar(V(sp.x, p.pos.y, sp.z), 0xb08cff, 4, 90, 2);
    g.fx.ring(V(sp.x, p.pos.y, sp.z), 0xffffff, 1, 14, 1.2);
    sfx('level');
  }

  private finishStart() {
    const g = this.g;
    this.teleported = true;
    this.endStage();
    const fog = g.scene.fog as THREE.Fog | null;
    if (fog) { fog.near = this.world.env.fogN; fog.far = this.world.env.fogF; fog.color.set(this.world.env.fog); }
    g.scene.background = null;
    g.stage = 'arena';
    g.frozen = false;
    g.player.invuln = 2.5;
    g.camPitch = 0.35; g.camDist = 15; g.camDistNow = 15;
    setMusic('brMatch');
    g.banner('GREED ISLAND', `${this.format === 'solo' ? 'SOLO · 100 players' : this.format === 'duos' ? 'DUOS · 50 teams' : 'SQUADS · 25 teams'} — be the LAST SURVIVOR · Nen Barrier rises at 20:00`, 5);
    this.toast('Goal: be the LAST SURVIVOR. Missions, monsters and sealed vaults give cards – nothing lies around. Buy or loot a map card to open M.', '#bfe8ff');
  }

  // ------------------------------------------------------------------ cards / inventory
  // ---- card VFX modelled on the anime: the card is drawn from the binder, glows in the rank colour, rises and bursts when released
  private cardMeshFor(rank: Rank, big = 1): THREE.Group {
    const col = new THREE.Color(RANK_COLOR[rank]);
    const grp = new THREE.Group();
    const mk = (geo: THREE.BufferGeometry, color: THREE.Color | number, o: Partial<THREE.MeshBasicMaterialParameters> = {}) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...o }));
    const glow = mk(new THREE.PlaneGeometry(3.4, 4), col.clone().multiplyScalar(1.6), { transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    const frame = mk(new THREE.PlaneGeometry(1.7, 2.3), col.clone().multiplyScalar(1.9), { transparent: true, opacity: 0.95, depthWrite: false });
    const face = mk(new THREE.PlaneGeometry(1.5, 2.1), 0x120e1c);
    const sym = mk(new THREE.CircleGeometry(0.44, 6), col.clone().multiplyScalar(2.2));
    glow.position.z = -0.03; frame.position.z = -0.012; sym.position.z = 0.012;
    grp.add(glow, frame, face, sym); grp.scale.setScalar(big);
    return grp;
  }
  private cardRelease(c: Card, word: string) {
    const g = this.g, p = g.player, col = parseInt(RANK_COLOR[c.rank].slice(1), 16);
    const card = this.cardMeshFor(c.rank);
    g.popup(p, word, RANK_COLOR[c.rank], 26);
    p.setAnim('castUp', 0.9);
    sfx('card');
    const up = new THREE.Vector3(), hand = new THREE.Vector3();
    g.fx.custom(card, 1.0, (k) => {
      p.handLPos(hand); up.set(p.pos.x, p.pos.y + 4.8 * p.scaleNow, p.pos.z);
      const e = Math.min(1, k * 1.5), s = e * e * (3 - 2 * e);
      card.position.lerpVectors(hand, up, s);
      card.scale.setScalar(0.5 + s * 1.5 + (k > 0.75 ? (k - 0.75) * 5 : 0));
      card.rotation.set(0, k * 13, Math.sin(k * 9) * 0.12);
      const mats = card.children.map((o) => (o as THREE.Mesh).material as THREE.MeshBasicMaterial);
      mats[0].opacity = 0.3 + 0.2 * Math.sin(k * 40);
      if (k > 0.85) for (const m of mats) { m.transparent = true; m.opacity = Math.max(0, (1 - k) / 0.15); }
    }, () => { card.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); });
    g.fx.gather(hand.set(p.pos.x, p.pos.y + 4, p.pos.z), col, 3, 12);
    g.later(0.88, () => {
      if (p.dead) return;
      const pos = V(p.pos.x, p.pos.y + 4.8 * p.scaleNow, p.pos.z);
      g.fx.explosion(pos, col, 2.6, 0.45); g.fx.burst(pos, 0xffffff, 26, 9, 0.7); g.fx.ring(p.pos, col, 1, 9, 0.7); g.fx.pillar(p.pos, col, 1.6, 26, 0.7); sfx('level');
    });
  }
  /** a freshly collected card streaks into the binder */
  private cardIn(id: string) {
    const g = this.g, p = g.player, rank = CARDS[id].rank, col = parseInt(RANK_COLOR[rank].slice(1), 16);
    const card = this.cardMeshFor(rank, 0.8);
    const from = V(p.pos.x + rand(-1.5, 1.5), p.pos.y + 6.5, p.pos.z + rand(-1.5, 1.5)), hand = V();
    g.fx.custom(card, 0.7, (k) => {
      p.handLPos(hand);
      const s = k * k;
      card.position.lerpVectors(from, hand, s);
      card.rotation.set(k * 6, k * 10, 0); card.scale.setScalar(0.9 * (1 - s * 0.7));
      if (Math.random() < 0.6) g.fx.burst(card.position, col, 1, 1.5, 0.3, 0.2);
    }, () => { card.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); g.fx.ring(p.pos, col, 0.5, 3, 0.35); });
  }
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
      this.cardIn(id);
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
    if (id === 'prize') this.spawnChampion('Contest Champion', poi('antokiba'), 'prize');
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
      case 'orient': this.addCard('s101'); this.addJenny(2000); break;
      case 'prize': this.addCard('s083'); this.addJenny(2000); break;
      case 'cyclops': this.addCard('s070'); this.addJenny(2500); break;
      case 'herbs': this.addCard('s075'); break;
      case 'pirates': this.addCard('s081'); break;
      case 'bounty': this.addJenny(5000); this.addCard(rollRank('B')); break;
    }
    EXTRA_REWARD[q.id]?.(this);
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
    this.world.setBarrier(z.r, level, this.t >= BARRIER_T);
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
    if (!z.started || z.dps <= 0 || this.t < BARRIER_T) return;
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

  // ================================================================== bot brains – abstract layer
  // Every bot is its own player: a per-game strategy (looter / questor / slayer / camper / zone-hugger / hunter / nomad) drawn from its
  // personality, a risk appetite, memories of who it has met, grudges, rare temporary pacts, and survival-first decisions.
  private pickStrategy(b: Bot): string {
    const P = b.pers;
    const w: [string, number][] = [
      ['looter', 0.5 + P.greed + P.curio * 0.6], ['questor', 0.4 + P.curio * 1.3 + P.social * 0.3], ['slayer', 0.2 + P.aggr * P.skill * 1.6],
      ['camper', 0.15 + P.patience * 1.5 + P.caution * 0.5], ['zonehug', 0.2 + P.caution + (1 - P.curio) * 0.4], ['hunter', 0.1 + P.aggr * 0.9 + P.greed * 0.4], ['nomad', 0.2 + P.curio * 0.6 + (1 - P.patience) * 0.4],
    ];
    let sum = 0; for (const o of w) sum += o[1];
    let r = Math.random() * sum;
    for (const o of w) { r -= o[1]; if (r <= 0) return o[0]; }
    return 'looter';
  }
  private mem(b: Bot) {
    const m = b.m;
    if (!m.init) { m.init = 1; m.strat = this.pickStrategy(b); m.risk = clamp(b.pers.aggr * 0.5 + (1 - b.pers.caution) * 0.4 + rand(-0.2, 0.2), 0.05, 0.98); m.done = new Set<string>(); m.known = new Map<number, { x: number; z: number; t: number }>(); m.mood = 0; m.pact = -1; m.pactT = 0; m.coolT = rand(0, 20); m.fleeT = 0; m.fleeFrom = null; m.lastWork = ''; m.hideT = 0; }
    return m;
  }
  private mapLevelOf(inv: string[]) { return inv.includes('s100') ? 2 : inv.includes('s101') ? 1 : 0; }
  private townGoal(_b: Bot, p: Poi) { const a = rand(0, 6.28), d = rand(0, Math.min(36, p.r * 0.1)); return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }; }

  private chooseGoal(b: Bot) {
    const m = this.mem(b), P = b.pers;
    const z = this.zoneAt(this.t);
    const nextR = z.closing ? z.to : z.tNext < 200 ? z.to : z.r;
    const safe = Math.max(18, nextR * 0.84);
    const d0 = Math.hypot(b.x, b.z);
    const early = this.t < 40;
    const inSafe = (x: number, zz: number) => Math.hypot(x, zz) < Math.max(safe, z.r * 0.88, 20);
    // 1 ── the barrier: leave early if cautious, late if reckless
    const lead = 40 + 160 * P.caution * (1.2 - m.risk * 0.5);
    if (!early && (d0 > safe || (z.closing && d0 > z.r - 36) || (!z.closing && z.tNext < lead && d0 > safe * 0.92))) {
      const a = Math.atan2(b.z, b.x) + rand(-0.7, 0.7), d = safe * rand(0.1, 0.7);
      b.goal = { x: Math.cos(a) * d, z: Math.sin(a) * d }; b.work = this.t > 1000 ? 'camp' : 'loot'; b.state = 'zone'; return;
    }
    // 2 ── hurt: slip away and recover (survival first)
    if (b.hp < b.maxHp * (0.28 + 0.34 * P.healAt) && !b.inv.some((c) => CARDS[c].fx?.heal) ) {
      const a = rand(0, 6.28), d = rand(70, 260); const q = this.freeNear(b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, 2);
      b.goal = inSafe(q.x, q.z) ? q : { x: b.x, z: b.z }; b.work = 'camp'; b.state = 'travel'; return;
    }
    const S = m.strat as string;
    const sm = (k: string) => ({ looter: { loot: 2, quest: 0.8 }, questor: { quest: 2.4, loot: 0.8 }, slayer: { mon: 2.6, site: 1.2, hunt: 0.8 }, camper: { camp: 3, ambush: 1.4 }, zonehug: { camp: 2, ambush: 0.6, scout: 0.5 }, hunter: { hunt: 2.6, ambush: 1.4, mon: 0.6 }, nomad: { scout: 1.8, loot: 1, site: 1.4, quest: 0.8 } } as Record<string, Record<string, number>>)[S]?.[k] ?? 1;
    const hasMap = this.mapLevelOf(b.inv) > 0;
    const strength = this.botPower(b) / 520;
    const opts: [string, number][] = [
      ['loot', (0.4 + P.greed * 1.2 + P.curio) * sm('loot')],
      ['quest', (0.35 + P.curio * 1.1 + P.social * 0.4) * sm('quest') * (this.t < 1500 ? 1 : 0.4)],
      ['mon', (P.aggr * P.skill * 1.5 + 0.15) * sm('mon') * clamp(strength, 0.4, 1.6)],
      ['site', (P.curio * P.skill * 0.9 + 0.05) * sm('site') * clamp(strength - 0.4, 0, 1.5) * (this.t > 240 ? 1 : 0.2)],
      ['casino', b.jenny > 2500 ? P.greed * P.curio * 1.2 : 0],
      ['shop', b.jenny > 10000 ? P.spells * 2.2 : 0],
      ['map', !hasMap && b.jenny >= 3000 ? 2.2 : 0],
      ['camp', (P.patience * 1.2 + 0.1) * sm('camp') * (this.t > 300 ? 1.4 : 0.5)],
      ['ambush', P.patience * P.aggr * 1.4 * sm('ambush') * (this.t > 240 ? 1 : 0.2)],
      ['hunt', P.aggr * 0.5 * Math.min(1.6, this.expectBoost) * sm('hunt') * (this.t > 200 ? 1 : 0)],
      ['scout', (P.curio * 0.7 + 0.1) * sm('scout')],
    ];
    let sum = 0; for (const o of opts) sum += o[1];
    let r = Math.random() * sum, w = 'loot';
    for (const o of opts) { r -= o[1]; if (r <= 0) { w = o[0]; break; } }
    let tx = b.x, tz = b.z;
    const towns = POIS.filter((p) => inSafe(p.x, p.z) && p.id !== 'dodgeball' && p.id !== 'tree');
    if (w === 'loot' || w === 'quest') {
      const cands = towns.filter((p) => !m.done.has(p.id)).sort(() => Math.random() - 0.5).slice(0, 5);
      cands.sort((a, c) => (c.tier * P.greed * 2 + rand(0, 2) - Math.hypot(c.x - b.x, c.z - b.z) / (260 + P.curio * 600)) - (a.tier * P.greed * 2 + rand(0, 2) - Math.hypot(a.x - b.x, a.z - b.z) / (260 + P.curio * 600)));
      const p = cands[0]; if (p) { const q = this.townGoal(b, p); tx = q.x; tz = q.z; b.work = w; m.poi = p.id; } else w = 'camp';
    } else if (w === 'mon') { const mm = this.mons.filter((x) => x.alive && !x.def.boss && !x.def.ally && inSafe(x.x, x.z)).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z)).slice(0, 8); const q = mm.length ? pick(mm) : null; if (q) { tx = q.x; tz = q.z; m.mon = q.def.id; } else w = 'loot'; }
    else if (w === 'site') { const ss = this.chests.filter((c) => !c.opened && inSafe(c.x, c.z)); const c = ss.length ? pick(ss) : null; if (c) { tx = c.x; tz = c.z; m.site = c.id; } else w = 'mon'; }
    else if (w === 'casino') { const p = poi('dorias'); const q = this.townGoal(b, p); tx = q.x; tz = q.z; if (!inSafe(tx, tz)) w = 'camp'; }
    else if (w === 'shop') { const p = poi('masadora'); const q = this.townGoal(b, p); tx = q.x; tz = q.z; if (!inSafe(tx, tz)) w = 'camp'; }
    else if (w === 'map') { const p = poi(pick(['antokiba', 'limeiro', 'aiai', 'soufrabi'])); const q = this.townGoal(b, p); tx = q.x; tz = q.z; if (!inSafe(tx, tz)) w = 'camp'; }
    else if (w === 'hunt') {
      // go after the richest / weakest player we remember (or the human, if they look juicy)
      let best: { x: number; z: number; s: number } | null = null;
      for (const [id, k] of m.known as Map<number, { x: number; z: number; t: number }>) { const o = this.bots[id]; if (!o || !o.alive || o.team === b.team || this.t - k.t > 240) continue; const s = this.richness(o.inv) / 9000 + (1 - o.hp / o.maxHp) * 2 - Math.hypot(k.x - b.x, k.z - b.z) / 900; if (!best || s > best.s) best = { x: k.x, z: k.z, s }; }
      if (!best && !this.g.player.dead && this.myValue > 12000 && Math.random() < 0.5) best = { x: this.g.player.pos.x, z: this.g.player.pos.z, s: 0 };
      if (best && inSafe(best.x, best.z)) { tx = best.x + rand(-30, 30); tz = best.z + rand(-30, 30); } else w = 'scout';
    }
    if (w === 'scout') { const a = rand(0, 6.28), d = rand(150, 700); const q = this.freeNear(b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, 2); if (inSafe(q.x, q.z)) { tx = q.x; tz = q.z; } else w = 'camp'; }
    if (w === 'camp' || w === 'ambush') { const a = rand(0, 6.28), d = w === 'camp' ? rand(0, 140) : rand(40, 200); const q = this.freeNear(b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, 2); tx = inSafe(q.x, q.z) ? q.x : 0; tz = inSafe(q.x, q.z) ? q.z : 0; }
    // squad-mates and pact partners stay together
    if (!b.ally) { const lead = this.teams[b.team].members.find((q) => q.alive); if (lead && lead !== b && Math.random() < 0.85) { tx = lead.x + rand(-6, 6); tz = lead.z + rand(-6, 6); w = 'camp'; } }
    if (m.pact >= 0 && m.pactT > 0) { const pb = this.bots[m.pact]; if (pb?.alive && Math.random() < 0.6) { tx = pb.x + rand(-8, 8); tz = pb.z + rand(-8, 8); w = 'camp'; } }
    b.goal = { x: tx, z: tz }; b.work = w; b.state = 'travel';
  }

  private finishWork(b: Bot) {
    const m = this.mem(b), P = b.pers;
    const give = (id: string) => { b.inv.push(id); if (b.inv.length > 40) { let wi = 0, wv = 1e9; b.inv.forEach((c, i) => { const v = RANK_VALUE[CARDS[c].rank]; if (v < wv && c !== 's017' && c !== 's100' && c !== 's101') { wv = v; wi = i; } }); b.inv.splice(wi, 1); } };
    const luck = P.greed * 0.06;
    const pw = this.botPower(b);
    const hurt = (f: number) => { b.hp -= b.maxHp * f; if (b.hp <= 0) { this.finalizeBot(b, null, 'was defeated on a mission'); return true; } return false; };
    switch (b.work) {
      case 'loot': case 'quest': {
        // an NPC mission: harder towns pay better, but every task can be failed
        const p = poi(m.poi ?? POIS[0].id);
        if (!p || m.done.has(p.id)) { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.1); break; }
        const diff = 0.3 + p.tier * 0.17;
        const ok = Math.random() < clamp(0.3 + 0.55 * P.skill + (pw / 700) * 0.2 - diff * 0.35, 0.1, 0.9);
        m.done.add(p.id);
        if (ok) { const rk = p.tier >= 3 ? pick<Rank>(['A', 'S', 'A']) : p.tier === 2 ? pick<Rank>(['B', 'A', 'B', 'C']) : pick<Rank>(['C', 'D', 'B']); give(rollRank(rk)); b.jenny += Math.round(rand(800, 2600) * (1 + p.tier * 0.4)); if (Math.random() < 0.3) give(rollCard(1, luck, 0.7)); b.level = Math.min(9, b.level + (Math.random() < 0.25 ? 1 : 0)); }
        else { if (hurt(rand(0.1, 0.35))) return; }
        break;
      }
      case 'mon': {
        const win = Math.random() < clamp(pw / (pw + 300 + Math.random() * 360), 0.15, 0.9);
        if (win) { if (Math.random() < 0.6) give(rollCard(1, luck, 0.5)); b.jenny += Math.round(rand(500, 1800)); b.level = Math.min(9, b.level + (Math.random() < 0.35 ? 1 : 0)); }
        else { if (hurt(rand(0.2, 0.55))) return; }
        break;
      }
      case 'site': {
        const c = this.chests.find((x) => x.id === m.site);
        if (!c || c.opened) break;
        const win = Math.random() < clamp(pw / 950 + P.skill * 0.15, 0.1, 0.8);
        if (win) { c.opened = true; const n = c.tier >= 3 ? 4 : 3; for (let i = 0; i < n; i++) give(rollRank(i === 0 ? pick<Rank>(['S', 'A', 'A']) : pick<Rank>(['A', 'B', 'B', 'C']))); b.level = Math.min(9, b.level + 1); this.feedAdd(`${b.name} cleared ${c.name ?? 'a rare site'}`, '#ffd98a'); }
        else { if (hurt(rand(0.35, 0.8))) return; }
        break;
      }
      case 'casino': { const bet = Math.min(b.jenny, 1000 * (1 + Math.floor(P.greed * 3))); b.jenny -= bet; if (Math.random() < 0.46 + P.greed * 0.04) { b.jenny += bet * 2; if (Math.random() < 0.04) give(rollRank(pick<Rank>(['A', 'S']))); } break; }
      case 'shop': if (b.jenny >= 10000) { b.jenny -= 10000; for (let i = 0; i < 3; i++) give(pick(SPELL_IDS)); } break;
      case 'map': if (b.jenny >= 3000 && !this.mapLevelOf(b.inv)) { if (b.jenny >= 16000 && Math.random() < 0.25) { b.jenny -= 14000; give('s100'); } else { b.jenny -= 3000; give('s101'); } } break;
      case 'camp': case 'ambush': b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.3); break;
      case 'scout': { for (const o of this.bots) if (o.alive && o.team !== b.team && Math.hypot(o.x - b.x, o.z - b.z) < 700) (m.known as Map<number, { x: number; z: number; t: number }>).set(o.id, { x: o.x, z: o.z, t: this.t }); break; }
    }
    if (b.hp < b.maxHp * 0.95 && b.work !== 'camp') b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.1 * (0.5 + P.healAt));
    // use a healing card if one is held and we are hurt
    if (b.hp < b.maxHp * 0.5) { const i = b.inv.findIndex((c) => !!CARDS[c].fx?.heal); if (i >= 0) { const id = b.inv.splice(i, 1)[0]; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * CARDS[id].fx!.heal![0]); } }
  }

  private botStep(dt: number) {
    const g = this.g;
    const alive = this.aliveCount();
    this.expectBoost = clamp(1 + (alive - expectedAlive(this.t)) / 9, 0.03, 3);
    for (const b of this.bots) {
      if (!b.alive) continue;
      const m = this.mem(b);
      b.revealT = Math.max(0, b.revealT - dt); b.hideT = Math.max(0, b.hideT - dt); b.spellT -= dt; b.chatT -= dt; m.coolT -= dt; m.pactT -= dt; m.fleeT -= dt;
      m.mood = Math.max(0, m.mood - dt * 0.01);
      if (b.f) { b.x = b.f.pos.x; b.z = b.f.pos.z; b.hp = b.f.hp; }
      b.stateT -= dt;
      if (m.pact >= 0 && (m.pactT <= 0 || !this.bots[m.pact]?.alive)) m.pact = -1;
      if (b.state === 'flee') { if (m.fleeT <= 0) { b.state = 'work'; b.work = 'camp'; b.stateT = rand(8, 25); b.goal = null; } continue; }
      if (!b.goal && b.state !== 'fight') this.chooseGoal(b);
      if (b.state === 'travel' || b.state === 'zone') {
        if (b.goal && Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 8) {
          b.state = 'work';
          const w = b.work;
          b.stateT = w === 'camp' ? rand(25, 80) * (0.5 + b.pers.patience) : w === 'ambush' ? rand(40, 100) : w === 'casino' ? rand(12, 26) : w === 'quest' || w === 'loot' ? rand(70, 190) : w === 'mon' ? rand(30, 70) : w === 'site' ? rand(50, 110) : w === 'scout' ? rand(6, 14) : rand(8, 20);
        } else if (b.stateT < -110) { b.goal = null; b.stateT = 0; }
      } else if (b.state === 'work') {
        const z = this.zoneAt(this.t);
        if (b.stateT <= 0) { this.finishWork(b); if (b.alive) { b.goal = null; this.chooseGoal(b); } }
        else if (z.closing && Math.hypot(b.x, b.z) > z.r - 30) { b.goal = null; this.chooseGoal(b); }
        else if (b.work === 'camp' || b.work === 'ambush') b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.006 * dt);
      } else if (b.state === 'fight') {
        if (!b.f) this.fightTick(b, dt);
      }
      if (!b.f && b.alive && b.state !== 'fight' && b.state !== 'work') b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.0025 * dt);
      if (b.f && b.spellT <= 0 && b.f.ai && !b.ally) this.botSpellOnPlayer(b);
    }
    this.encounters(dt);
    // friendly bots offer trades to the human
    if (this.tradeT <= 0 && !this.trade && !this.dialog && this.combatT <= 0) {
      const p = g.player;
      const cand = this.bots.find((b) => b.alive && b.f && !b.ally && !b.hostile && b.pers.social > 0.55 && b.pers.aggr < 0.5 && Math.hypot(b.f.pos.x - p.pos.x, b.f.pos.z - p.pos.z) < 22 && !((b.f.st.hurtT ?? 0) > 0));
      this.tradeT = rand(70, 120);
      if (cand) {
        const mine = this.inv.filter((c) => c !== 's100' && c !== 's101');
        if (mine.length && cand.inv.length) {
          const want = pick(mine); const rk = CARDS[want].rank;
          const give = cand.inv.filter((c) => c !== 's100' && c !== 's101' && RANK_VALUE[CARDS[c].rank] >= RANK_VALUE[rk] * 0.6 && RANK_VALUE[CARDS[c].rank] <= RANK_VALUE[rk] * 1.8);
          if (give.length) { this.trade = { bot: cand, give: pick(give), want }; this.say(cand, 'greet'); }
        }
      }
    }
  }

  /** what does `a` want to do about `b`? (fight / avoid / ignore / pact / stalk / ambush) */
  private intent(a: Bot, b: Bot, d: number): string {
    const m = this.mem(a), P = a.pers;
    if (a.team === b.team) return 'ignore';
    if (m.pact === b.id && m.pactT > 0) return 'ignore';
    const pa = this.botPower(a), pb = this.botPower(b);
    const pr = pa / Math.max(1, pb);
    const val = this.richness(b.inv) / 12000;
    const late = clamp((this.t - 900) / 1800, 0, 1);
    const lowMe = a.hp < a.maxHp * 0.4;
    let go = P.aggr * 0.85 + m.risk * 0.3 + P.greed * val * 0.35 + (pr - 1) * 0.55 * (0.4 + P.skill) + m.mood * 0.5 + late * 0.35 + (b.hp < b.maxHp * 0.5 ? 0.25 : 0) - P.caution * 0.35 * Math.max(0, 1.15 - pr) - (lowMe ? 0.6 : 0);
    if (m.grudge === b.id) go += 0.6;
    go += rand(-0.25, 0.25);
    if (go > 0.82) return P.patience > 0.6 && d > 40 && Math.random() < 0.6 ? 'ambush' : 'fight';
    if (go > 0.58 && P.patience > 0.45 && !lowMe) return 'stalk';
    if (pr < 0.75 && P.caution > 0.45) return 'avoid';
    if (P.social > 0.6 && P.aggr < 0.55 && Math.random() < 0.14 && m.pact < 0 && this.t < 2300) return 'pact';
    return Math.random() < 0.5 ? 'ignore' : 'avoid';
  }

  private encounters(dt: number) {
    const live = this.bots.filter((b) => b.alive && !b.f && b.state !== 'fight' && b.state !== 'flee');
    const cell = new Map<number, Bot[]>();
    const CS = 240;
    for (const b of live) { const k = Math.floor(b.x / CS) * 4096 + Math.floor(b.z / CS); const a = cell.get(k); if (a) a.push(b); else cell.set(k, [b]); }
    const fighting = this.bots.filter((b) => b.alive && b.state === 'fight' && !b.f);
    for (const a of live) {
      const ma = this.mem(a);
      if (a.state === 'fight' || ma.coolT > 0) continue;
      const ci = Math.floor(a.x / CS), cj = Math.floor(a.z / CS);
      let best: Bot | null = null, bd = 1e9;
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const b of cell.get(i * 4096 + j) ?? []) {
        if (b === a || b.team === a.team || b.state === 'fight') continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < bd) { bd = d; best = b; }
      }
      const enc = 90 + 120 * a.pers.curio + (a.work === 'scout' ? 120 : 0) - (a.work === 'camp' || a.work === 'ambush' ? 30 : 0);
      if (best && bd < enc) {
        const hide = a.hideT > 0 || best.hideT > 0 ? 0.3 : 1;
        const early = this.t < 90 ? 0.1 : this.t < 240 ? 0.4 : 1;
        // noticing someone is a probability per second; spotting is easier for scouts and harder for hidden / camping targets
        const spot = (0.04 + 0.04 * a.pers.skill) * hide * (best.work === 'camp' ? 0.6 : 1) * (a.work === 'scout' ? 2 : 1) * early * this.expectBoost;
        if (Math.random() > 1 - Math.exp(-spot * dt)) { ma.coolT = rand(6, 22); (ma.known as Map<number, { x: number; z: number; t: number }>).set(best.id, { x: best.x, z: best.z, t: this.t }); this.meet(a, best, bd); }
      } else if (a.pers.patience > 0.5 && a.pers.aggr > 0.5 && this.t > 240) {
        // vultures drift toward ongoing fights
        const f = fighting.find((q) => Math.hypot(q.x - a.x, q.z - a.z) < 130);
        if (f && Math.random() < 0.06 * this.expectBoost) { a.goal = { x: f.x + rand(-14, 14), z: f.z + rand(-14, 14) }; a.work = 'ambush'; a.state = 'travel'; ma.vulture = f.id; }
      }
    }
    // third parties jump into brawls they are close to
    for (const f of fighting) {
      if (!f.foe || Math.random() > 0.02 * this.expectBoost) continue;
      const third = live.find((q) => q.state !== 'fight' && q !== f.foe && q.team !== f.team && q.team !== f.foe!.team && Math.hypot(q.x - f.x, q.z - f.z) < 45 && q.pers.aggr > 0.45);
      if (third) { const target = f.hp < f.foe.hp ? f : f.foe; third.state = 'fight'; third.foe = target; third.fightT = rand(5, 12); }
    }
  }

  /** two bots noticed each other */
  private meet(a: Bot, b: Bot, d: number) {
    const ia = this.intent(a, b, d), ib = this.intent(b, a, d);
    const ma = this.mem(a), mb = this.mem(b);
    if (ia === 'pact' && ib !== 'fight') { if (Math.random() < 0.7) { ma.pact = b.id; mb.pact = a.id; ma.pactT = mb.pactT = rand(400, 1100); this.metSet.size; return; } }
    const aggressor = ia === 'fight' ? a : ib === 'fight' ? b : null;
    if (aggressor) {
      const victim = aggressor === a ? b : a;
      // the victim may notice in time and slip away (cautious players do)
      const mv = this.mem(victim);
      const escape = (this.intent(victim, aggressor, d) === 'avoid' || victim.pers.caution > 0.7) && Math.random() < 0.3 + 0.4 * victim.pers.skill && d > 25;
      if (escape) { victim.state = 'flee'; mv.fleeT = rand(10, 24); mv.fleeFrom = aggressor.id; const ang = Math.atan2(victim.z - aggressor.z, victim.x - aggressor.x) + rand(-0.4, 0.4); victim.goal = { x: victim.x + Math.cos(ang) * 260, z: victim.z + Math.sin(ang) * 260 }; this.say(victim, 'flee', 0.5); return; }
      this.startFight(aggressor, victim);
      return;
    }
    if (ia === 'stalk' || ia === 'ambush') { a.goal = { x: b.x + rand(-10, 10), z: b.z + rand(-10, 10) }; a.work = 'ambush'; a.state = 'travel'; ma.coolT = rand(10, 30); return; }
    if (ia === 'avoid' || ib === 'avoid') { const away = Math.atan2(a.z - b.z, a.x - b.x) + rand(-0.6, 0.6); a.goal = { x: a.x + Math.cos(away) * 300, z: a.z + Math.sin(away) * 300 }; a.work = 'loot'; a.state = 'travel'; }
  }

  private startFight(a: Bot, b: Bot) {
    a.state = b.state = 'fight';
    a.foe = b; b.foe = a;
    a.fightT = b.fightT = rand(9, 22);
    this.mem(b).grudge = a.id; this.mem(b).mood = Math.min(1, this.mem(b).mood + 0.3);
  }
  /** an unseen brawl advances a little every tick: damage trades by power, shields and cards matter, and the loser may bolt */
  private fightTick(a: Bot, dt: number) {
    const b = a.foe;
    if (!b || !b.alive || b.state !== 'fight') { a.foe = null; a.state = 'work'; a.stateT = 3; return; }
    if (a.id > b.id) return; // resolve each pair once
    const pa = this.botPower(a), pb = this.botPower(b);
    const dpsA = (28 + 46 * a.pers.skill) * (pa / 520) * rand(0.55, 1.45), dpsB = (28 + 46 * b.pers.skill) * (pb / 520) * rand(0.55, 1.45);
    const dmgToB = dpsA * dt * 1.15, dmgToA = dpsB * dt * 1.15;
    const hit = (x: Bot, dmg: number) => { if (x.shield > 0) { const s = Math.min(x.shield, dmg); x.shield -= s; dmg -= s; } x.hp -= dmg; };
    hit(b, dmgToB); hit(a, dmgToA);
    a.fightT -= dt; b.fightT = a.fightT;
    for (const [x, y] of [[a, b], [b, a]] as [Bot, Bot][]) {
      if (x.hp <= 0) { x.foe = null; y.foe = null; y.state = 'work'; y.stateT = rand(5, 12); y.goal = null; y.level = Math.min(9, y.level + 1); this.mem(y).mood = Math.max(0, this.mem(y).mood - 0.2); this.finalizeBot(x, y, 'eliminated'); if (y.hp <= 0) y.hp = y.maxHp * 0.05; return; }
      const fleeAt = 0.15 + 0.3 * x.pers.caution;
      if (x.hp < x.maxHp * fleeAt && Math.random() < dt * (0.25 + 0.5 * x.pers.skill)) {
        x.foe = null; y.foe = null; x.state = 'flee'; this.mem(x).fleeT = rand(12, 28); const ang = Math.atan2(x.z - y.z, x.x - y.x) + rand(-0.5, 0.5); x.goal = { x: x.x + Math.cos(ang) * 320, z: x.z + Math.sin(ang) * 320 };
        // the winner either gives chase or lets them go
        if (y.pers.aggr > 0.6 && y.hp > y.maxHp * 0.45 && Math.random() < 0.55) { y.state = 'travel'; y.work = 'hunt'; y.goal = { x: x.goal.x, z: x.goal.z }; } else { y.state = 'work'; y.stateT = rand(5, 12); y.goal = null; }
        this.mem(x).mood = Math.min(1, this.mem(x).mood + 0.25);
        return;
      }
    }
    if (a.fightT <= 0) { // stalemate: both disengage hurt
      for (const x of [a, b]) { x.foe = null; x.state = 'work'; x.stateT = rand(5, 12); x.goal = null; x.work = 'camp'; }
    }
  }

  /** abstract movement: straight-line travel that slides around the sea, bunny-hops and dashes like a real player */
  private moveAbstract(dt: number) {
    for (const b of this.bots) {
      if (!b.alive || b.f || (b.state !== 'travel' && b.state !== 'zone' && b.state !== 'flee') || !b.goal) continue;
      const dx = b.goal.x - b.x, dz = b.goal.z - b.z, d = Math.hypot(dx, dz);
      const m = this.mem(b);
      const sprint = b.state === 'flee' || b.state === 'zone' ? 1.25 : (b.pers.patience < 0.25 ? 1.2 : 1);
      const sp = 10.6 * (0.9 + 0.25 * b.pers.skill) * sprint * dt * (b.work === 'hunt' ? 1.1 : 1);
      if (d <= sp) { b.x = b.goal.x; b.z = b.goal.z; continue; }
      let ang = Math.atan2(dz, dx);
      if (m.avoid) ang += m.avoid;
      let moved = false;
      for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
        const a2 = ang + off, nx = b.x + Math.cos(a2) * sp * 6, nz = b.z + Math.sin(a2) * sp * 6;
        if (T.groundAt(nx, nz) > T.DEEP + 0.4 && Math.hypot(nx, nz) < MAP_R - 30) { b.x += Math.cos(a2) * sp; b.z += Math.sin(a2) * sp; m.avoid = off * 0.8; moved = true; break; }
      }
      if (!moved) { b.goal = null; b.stateT = 0; }
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
    const items = [...b.inv];
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
    ai.type = 'bot'; ai.active = true; ai.tempo = 0.85 + 0.55 * b.pers.skill; ai.aggr = 0.3 + 0.6 * b.pers.aggr; ai.dodge = 0.18 + 0.5 * b.pers.skill;
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
        if (b.ally) { if (d > 520 && !(b.f.st.hurtT > 0)) { if (b.pers.social > 0.7) { const q = this.freeNear(fx + rand(-6, 6), fz + rand(-6, 6), 1.5); b.f.pos.set(q.x, 0, q.z); } else { this.dematerialize(b); n--; } } continue; }
        if (d > 560 && !(b.f.st.hurtT > 0) && !(b.tgt && !b.tgt.dead)) { this.dematerialize(b); n--; }
      } else if (b.ally && b.pers.social > 0.7 && d > 800) { const q = this.freeNear(fx + rand(-4, 4), fz + rand(-4, 4), 1.5); b.x = q.x; b.z = q.z; this.materialize(b); n++; }
      else if (d < 430) cand.push({ b, d });
    }
    cand.sort((a, c) => a.d - c.d);
    for (const c of cand) { if (n >= 26 || made >= 3) break; this.materialize(c.b); n++; made++; }
    // monsters
    for (const m of this.mons) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - fx, m.z - fz);
      if (!m.f && d < 230) this.spawnMon(m);
      else if (m.f && d > 340 && !(m.def.boss && m === this.boss && m.f.st.aggro)) { m.x = m.f.pos.x; m.z = m.f.pos.z; m.hp = m.f.hp; this.g.removeFighter(m.f); this.g.fighters = this.g.fighters.filter((x) => x !== m.f); m.f = null; }
    }
    for (const nn of this.npcs) {
      const d = Math.hypot(nn.x - fx, nn.z - fz);
      if (!nn.f && d < 220) this.spawnNpc(nn);
      else if (nn.f && d > 320) { this.g.removeFighter(nn.f); this.g.fighters = this.g.fighters.filter((x) => x !== nn.f); nn.f = null; }
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
    if (d.model) attachCreature(f, d.model, d.tint); else this.tintFighter(f, d.tint, 0.7);
    f.pos.set(m.x, T.groundAt(m.x, m.z), m.z); f.faceNow(rand(0, 6.28));
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
  // ================================================================== bot brains – real-time layer (humans in a fight)
  private scr = new WeakMap<Fighter, Record<string, any>>();
  private S(f: Fighter) { let s = this.scr.get(f); if (!s) { s = {}; this.scr.set(f, s); } return s; }

  private findTarget(b: Bot, f: Fighter): Fighter | null {
    const g = this.g;
    const m = this.mem(b);
    const perc = 36 + 46 * b.pers.skill + 18 * b.pers.curio;
    let best: Fighter | null = null, bs = -1e9;
    for (const t of g.fighters) {
      if (t.dead || t === f || t.team === f.team || t.team === 'none' || t.invuln > 50) continue;
      const d = Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
      if (d >= perc) continue;
      if (t.isPlayer && (t.st.stealthT ?? 0) > 0 && d > 5) continue;
      const isMon = t.team === 'monster' || t.team === 'hunter';
      if (isMon && !b.ally) { if (d > 26 && m.strat !== 'slayer') continue; if (b.pers.aggr < 0.22 && d > 12 && !(f.st.hurtT > 0)) continue; }
      const tb = t.st.botId !== undefined ? this.bots[t.st.botId] : null;
      if (tb && m.pact === tb.id && m.pactT > 0) continue;
      let bonus = 0;
      if (!b.ally && !isMon) {
        const key = 'dec' + (t.isPlayer ? 'P' : t.st.botId ?? t.name);
        if (f.st[key] === undefined) {
          // decide ONCE whether to attack on sight: personality, relative strength, how hurt they look, grudges, late-game desperation
          const pr = (f.hp + (f.st.shield ?? 0)) / Math.max(1, t.hp + (t.st.shield ?? 0));
          const base = t.isPlayer ? 0.16 + 0.8 * b.pers.aggr : 0.28 + 0.7 * b.pers.aggr;
          const late = clamp((this.t - 900) / 1800, 0, 0.35);
          const p = clamp(base * (0.6 + 0.5 * pr) * (t.hp < t.maxHp * 0.5 ? 1.35 : 1) + late + (m.grudge === tb?.id ? 0.6 : 0), 0.02, 0.97);
          f.st[key] = Math.random() < p ? this.stanceFor(b) : 0;
          if (f.st[key] === 0) { this.say(b, 'greet', 0.8); if (t.isPlayer && b.pers.social > 0.5) this.metSet.add(b.id); }
          else if (t.isPlayer) this.say(b, 'taunt', 0.4);
        }
        if (f.st[key] === 0 && !b.hostile && !(t.isPlayer ? false : f.st.hurtT > 0)) continue;
      }
      if ((t.st.hurtT ?? 0) > 4.2 && t.lastSkill) bonus += 6;
      if (t.hp < t.maxHp * 0.4) bonus += 8;
      if (t === b.tgt) bonus += 7;
      if (isMon) bonus -= 8;
      const s = bonus - d;
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }

  /** how a bot that decided to be hostile actually approaches: 1 = attack on sight, 2 = watch first, 3 = ambush, 4 = opportunist (waits for you to be weak / busy) */
  private stanceFor(b: Bot): number {
    const A = b.pers.arche, r = Math.random();
    if (['Ambusher', 'Camper', 'Sneaky Thief', 'Lone Wolf'].includes(A)) return r < 0.8 ? 3 : 4;
    if (['Cautious Scout', 'Veteran', 'Strategist', 'Lore Nerd', 'Duelist', 'Explorer', 'Spellcaster'].includes(A)) return r < 0.65 ? 2 : r < 0.85 ? 4 : 1;
    if (['Vulture', 'Bounty Hunter', 'Gold Digger', 'Loot Goblin', 'Card Hoarder'].includes(A)) return r < 0.7 ? 4 : 1;
    if (['Trigger-Happy', 'Berserker', 'Rager', 'Sweat', 'Show-off', 'Speed Runner'].includes(A)) return r < 0.88 ? 1 : 2;
    return r < 0.6 ? 1 : r < 0.8 ? 2 : 4;
  }
  private stance(b: Bot, f: Fighter, t: Fighter, d: number, dt: number): boolean {
    if (t.team === 'monster' || t.team === 'hunter' || b.hostile || b.ally) return false;
    const key = 'dec' + (t.isPlayer ? 'P' : t.st.botId ?? t.name);
    const mode = f.st[key];
    if (mode === undefined || mode <= 1) return false;
    const g = this.g, s = this.S(f);
    const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z;
    f.st.stT = (f.st.stT ?? 0) + dt;
    const weak = t.hp < t.maxHp * 0.55 || (t.st.hurtT ?? 0) > 0 || t.lock > 0.3 || !!t.charging;
    const facingAway = Math.cos(t.yaw - Math.atan2(dx, dz)) > 0.2;
    const go = () => { f.st[key] = 1; f.st.stT = 0; this.say(b, 'taunt', 0.6); if (f.dashCd <= 0 && d > 6 && f.energy > 30) g.dash(f, dx / (d || 1), dz / (d || 1)); };
    f.targetYaw = Math.atan2(dx, dz);
    const mv = (x: number, z: number) => { const [sx, sz] = this.steer(f, x, z, s, true); f.moveInput.set(sx, sz); };
    if (mode === 2) { // watch: circle at a safe distance, size the target up, then commit or walk away
      if (d < 24) mv(-dx, -dz); else if (d > 44) mv(dx, dz); else { mv(-dz * s.sg, dx * s.sg); f.moveInput.multiplyScalar(0.5); }
      if (!s.sg || Math.random() < dt * 0.15) s.sg = Math.random() < 0.5 ? -1 : 1;
      if (weak && Math.random() < dt * 1.2) go();
      else if (f.st.stT > 14 + 12 * b.pers.patience) { if (Math.random() < 0.25 + b.pers.aggr * 0.5) go(); else { f.st[key] = 0; b.goal = null; } }
      return true;
    }
    if (mode === 3) { if (d < 13 || (d < 24 && facingAway && f.st.stT > 3) || (weak && d < 40)) go(); else if (f.st.stT > 40) f.st[key] = 0; return true; }
    if (mode === 4) { if (d > 38) mv(dx, dz); else if (d < 26) { mv(-dx, -dz); f.moveInput.multiplyScalar(0.6); } if (weak) go(); else if (f.st.stT > 45) f.st[key] = 0; return true; }
    return false;
  }
  /** bots use Specified-Slot / spell cards on themselves: heal when low, shield / vanish when losing, buff before a brawl */
  private botCards(b: Bot, f: Fighter, inFight: boolean) {
    if (b.spellT > 0 && !(f.hp < f.maxHp * 0.3)) return;
    const g = this.g;
    const find = (pred: (c: (typeof CARDS)[string]) => boolean) => b.inv.findIndex((id) => pred(CARDS[id]));
    const use = (i: number) => { const id = b.inv.splice(i, 1)[0]; b.spellT = rand(10, 24); g.popup(f, '🃏 ' + CARDS[id].name, '#ffe9a0', 15); g.fx.ring(f.pos, 0xffe9a0, 1, 5, 0.5); return id; };
    if (f.hp < f.maxHp * (0.35 + 0.2 * b.pers.healAt)) { const i = find((c) => !!c.fx?.heal); if (i >= 0) { const id = use(i); const [pc] = CARDS[id].fx!.heal!; g.heal(f, f.maxHp * pc, true); return; } }
    if (inFight && f.hp < f.maxHp * 0.5) { const i = find((c) => !!c.fx?.shield || !!c.fx?.stealth || !!c.fx?.invuln); if (i >= 0) { const id = use(i); const c = CARDS[id]; if (c.fx?.shield) g.addShield(f, c.fx.shield); else f.invuln = Math.max(f.invuln, 2.5); return; } }
    if (inFight && Math.random() < 0.01 + 0.03 * b.pers.spells) { const i = find((c) => !!c.fx?.buff); if (i >= 0) { const id = use(i); const bf = CARDS[id].fx!.buff!; f.buffDmg = 1 + (bf.dmg ?? 0.15); g.later(bf.t, () => { f.buffDmg = 1; }); return; } }
  }

  private botFighters(dt: number) {
    const g = this.g;
    for (const b of this.bots) {
      const f = b.f;
      if (!f || f.dead) continue;
      b.x = f.pos.x; b.z = f.pos.z; b.hp = f.hp;
      this.botAI(b, f, dt);
    }
    for (const f of g.fighters) if (f.st.hunt && !f.dead && f.ai) this.hunterAI(f, dt);
  }

  // ---- movement intelligence: obstacle probing, rock climbing, stuck recovery
  /** 0 = open, 1 = climbable prop (rock / stump / crate), 2 = blocked (sea, wall, tree trunk, tall boulder) */
  private probe(f: Fighter, x: number, z: number): number {
    if (T.groundAt(x, z) < T.DEEP + 0.25) return 2;
    let res = 0;
    for (const o of this.world.near(x, z)) {
      if (Math.hypot(x - o.x, z - o.z) >= o.r + 0.75) continue;
      const top = o.dome ? o.dome[0] + o.dome[2] : o.flat !== undefined ? o.flat : -1e9;
      if (top > -1e8 && top - f.pos.y < 3.3) res = 1; else return 2;
    }
    return res;
  }
  private hop(f: Fighter, s: Record<string, any>, high = true) {
    if (!f.onGround || f.stun > 0 || f.lock > 0 || f.charging) return;
    f.vy = 17.5; f.onGround = false; f.coyote = 0; f.st.manualJump = 1; f.st.jumpHold = 0; f.jumpHeld = high; s.jh = high ? 0.5 : 0.1;
  }
  /** heading toward (dx,dz) that avoids water / walls / trunks, jumping up onto rocks that are in the way */
  private steer(f: Fighter, dx: number, dz: number, s: Record<string, any>, canJump = true): [number, number] {
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const base = Math.atan2(dz, dx), look = 3.8, pref = s.side ?? 1;
    let chosen = base, found = false, climb = false;
    for (const o of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.1, -2.1]) {
      const a = base + o * pref;
      const p1 = Math.max(this.probe(f, f.pos.x + Math.cos(a) * look, f.pos.z + Math.sin(a) * look), this.probe(f, f.pos.x + Math.cos(a) * look * 0.5, f.pos.z + Math.sin(a) * look * 0.5));
      if (p1 === 0) { chosen = a; found = true; if (o !== 0) s.side = o > 0 ? pref : -pref; break; }
      if (p1 === 1 && o === 0 && canJump) { chosen = a; found = true; climb = true; break; }
    }
    if (!found) { s.side = -pref; chosen = base + 1.3 * -pref; }
    if (climb) this.hop(f, s, true);
    return [Math.cos(chosen), Math.sin(chosen)];
  }
  private isZoner(f: Fighter): boolean {
    const def = f.def; if (!def) return false;
    const rs = def.skills.filter((s) => s.cost === 0 || s.ai[1] < 99).map((s) => s.ai[1]).sort((a, c) => a - c);
    const med = rs[Math.floor(rs.length / 2)] ?? 10;
    return med >= 24 && def.m1Range < 5.2 && !['gon', 'netero', 'knuckle', 'kastro', 'zeno'].includes(def.kind);
  }

  private combat(f: Fighter, t: Fighter, dt: number, tempo: number, aggr: number, dodge: number) {
    const g = this.g, ai = f.ai!, s = this.S(f);
    const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    if (f.charging) { f.targetYaw = Math.atan2(dx, dz); f.faceNow(f.targetYaw); if (f.charging.t >= ai.holdFor) g.releaseCharge(f); return; }
    if (f.lock > 0 || f.stun > 0) return;
    if (!f.forced) f.targetYaw = Math.atan2(dx, dz);
    const def = f.def!, mr = def.m1Range * f.rangeMult;
    const skill = clamp(0.35 + dodge * 1.2, 0.2, 1);
    if (s.zoner === undefined) s.zoner = this.isZoner(f);
    s.rt = (s.rt ?? 0) - dt;
    // read the enemy: a fresh cast nearby gets a jump-dodge or a sidestep (humans do this late and not every time)
    if ((t.st.lastCastT ?? 0) > 2.5 && dist < 20 && s.rt <= 0 && f.onGround) { s.rt = rand(0.9, 1.8); if (Math.random() < dodge * 1.4) this.hop(f, s, false); }
    if (ai.think <= 0) {
      ai.think = rand(0.16, 0.4) / tempo;
      const defs = f.skillsDefs, arr = g.cdArr(f);
      const cand: { i: number; w: number }[] = [];
      for (let i = 0; i < defs.length; i++) {
        const sd = defs[i];
        if (arr[i] > 0 || f.energy < sd.cost || dist < sd.ai[0] || dist > sd.ai[1] || (sd.can && !sd.can(g, f))) continue;
        let w = 1;
        if (i === 3) w = t.hp < t.maxHp * 0.5 || f.hp < f.maxHp * 0.35 || t.stun > 0.4 ? 5 : 0.6;
        else if (i === 4) w = dist > 13 ? 3 : f.hp < f.maxHp * 0.4 ? 1.6 : 0.2;
        if (t.stun > 0.3 && i < 4) w *= 1.8;
        cand.push({ i, w });
      }
      const castP = clamp(aggr * (0.5 + 0.5 * skill) * (t.stun > 0.3 ? 1.6 : 1), 0.1, 0.97);
      if (cand.length && Math.random() < castP) {
        let sum = 0; for (const c of cand) sum += c.w;
        let r = Math.random() * sum, pk = cand[0];
        for (const c of cand) { r -= c.w; if (r <= 0) { pk = c; break; } }
        const sd = defs[pk.i];
        if (sd.charge) ai.holdFor = rand(0.15, sd.charge * (0.5 + 0.5 * skill));
        if (g.tryCast(f, pk.i)) return;
      }
      const r = Math.random();
      if (s.zoner) ai.mode = dist < 6 ? 'retreat' : dist > 19 ? 'approach' : r < 0.7 ? 'strafe' : 'approach';
      else if (dist < mr + 1.2) ai.mode = r < 0.58 ? 'melee' : r < 0.82 ? 'strafe' : 'retreat';
      else if (dist < 10) ai.mode = r < 0.6 ? 'approach' : 'strafe';
      else ai.mode = 'approach';
      ai.strafe = Math.random() < 0.5 ? -1 : 1;
      // dash: close the gap, sidestep when pressured, escape when hurt
      if (ai.dashCd <= 0 && f.dashCd <= 0 && f.energy > 40) {
        if (dist > 12 && Math.random() < 0.35 * tempo) { g.dash(f, nx, nz); ai.dashCd = rand(1.0, 2.4); }
        else if (dist < 5 && Math.random() < 0.2 * tempo) { g.dash(f, -nz * ai.strafe, nx * ai.strafe); ai.dashCd = rand(1.2, 2.6); }
        else if (f.hp < f.maxHp * 0.45 && (f.st.hurtT ?? 0) > 4.3 && Math.random() < dodge * 0.9) { g.dash(f, -nx + -nz * ai.strafe * 0.5, -nz + nx * ai.strafe * 0.5); ai.dashCd = rand(1.5, 3); }
      }
    }
    if (ai.jumpT <= 0 && f.onGround && f.stun <= 0) { ai.jumpT = rand(1.4, 4.2); if (Math.random() < 0.3 + 0.35 * skill) this.hop(f, s, Math.random() < 0.6); }
    const go = (x: number, z: number, k = 1) => { const [sx, sz] = this.steer(f, x, z, s, true); f.moveInput.set(sx * k, sz * k); };
    switch (ai.mode) {
      case 'approach': case 'melee': if (dist > Math.max(2.4, mr * 0.55)) go(nx, nz); break;
      case 'retreat': go(-nx, -nz, 0.95); break;
      case 'strafe': { const away = (s.zoner ? (dist < 9 ? -0.7 : dist > 15 ? 0.7 : 0) : dist < 3.5 ? -0.5 : dist > 7 ? 0.6 : 0); go(-nz * ai.strafe + nx * away, nx * ai.strafe + nz * away); break; }
    }
    if (f.moveInput.lengthSq() > 1) f.moveInput.normalize();
    if (def && dist < mr + 1.0 && ai.atkT <= 0) { if (g.basic(f)) ai.atkT = rand(0.04, 0.25) / tempo; }
  }
  private tickAI(f: Fighter, dt: number) { const ai = f.ai!; ai.dashCd -= dt; ai.think -= dt; ai.atkT -= dt; ai.jumpT -= dt; }

  private botAI(b: Bot, f: Fighter, dt: number) {
    const g = this.g;
    f.moveInput.set(0, 0);
    if (g.frozen || !f.ai) return;
    const m = this.mem(b), s = this.S(f);
    this.tickAI(f, dt);
    if (s.jh > 0) { s.jh -= dt; if (s.jh <= 0) f.jumpHeld = false; }
    b.tgtT -= dt;
    if (b.tgtT <= 0) {
      b.tgtT = rand(0.25, 0.45);
      const old = b.tgt; b.tgt = this.findTarget(b, f);
      if (b.tgt && b.tgt !== old) { b.react = rand(0.14, 0.6) * (1.35 - b.pers.skill); m.mood = Math.min(1, m.mood + (b.tgt.team === 'monster' ? 0 : 0.03)); }
      f.aimT = b.tgt && !b.tgt.dead ? b.tgt : null;
    }
    if (b.react > 0) b.react -= dt;
    this.botCards(b, f, !!(b.tgt && !b.tgt.dead));
    const t = b.tgt && !b.tgt.dead ? b.tgt : null;
    const lowHp = f.hp < f.maxHp * (0.18 + 0.3 * b.pers.healAt);
    const dT = t ? Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) : 999;
    // healing channel (R): only when nobody is close
    if (lowHp && dT > 13 && (f.st.healCdT ?? 0) <= 0 && !f.st.healing) g.startHeal(f);
    if (f.st.healing) { if (f.hp >= f.maxHp * 0.92 || dT < 7) g.stopHeal(f); else return; }
    // stuck recovery: if we want to move but are not getting anywhere, hop, sidestep and dash
    s.sT = (s.sT ?? 0) + dt;
    if (s.sT > 0.7) {
      const moved = Math.hypot(f.pos.x - (s.sx ?? f.pos.x), f.pos.z - (s.sz ?? f.pos.z));
      s.stuck = (s.want && moved < 0.45 && f.stun <= 0 && f.lock <= 0) ? (s.stuck ?? 0) + 1 : 0;
      s.sx = f.pos.x; s.sz = f.pos.z; s.sT = 0; s.want = false;
      if (s.stuck >= 2) { s.stuck = 0; s.unT = 0.8; s.unA = rand(0, 6.28); this.hop(f, s, true); if (f.dashCd <= 0 && f.energy > 30) g.dash(f, Math.cos(s.unA), Math.sin(s.unA)); }
    }
    if ((s.unT ?? 0) > 0) { s.unT -= dt; f.moveInput.set(Math.cos(s.unA), Math.sin(s.unA)); f.targetYaw = s.unA; return; }
    if (t) {
      if (b.react > 0) { f.targetYaw = Math.atan2(t.pos.x - f.pos.x, t.pos.z - f.pos.z); return; }
      const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1;
      if (this.stance(b, f, t, d, dt)) { s.want = f.moveInput.lengthSq() > 0.01; return; }
      // survival first: cautious players break off when hurt – run, hop, dash, then heal out of sight
      if (lowHp && b.pers.caution > 0.4 && !b.ally) {
        b.fleeing = 1.5; const [sx, sz] = this.steer(f, -dx, -dz, s, true); f.moveInput.set(sx, sz); f.targetYaw = Math.atan2(-dz, -dx) + Math.PI / 2;
        f.targetYaw = Math.atan2(sx, sz); s.want = true;
        if (f.ai.dashCd <= 0 && f.dashCd <= 0 && f.energy > 30) { g.dash(f, sx, sz); f.ai.dashCd = rand(0.9, 1.8); this.say(b, 'flee', 0.5); }
        else if (f.ai.jumpT <= 0 && Math.random() < dt * 0.8) { this.hop(f, s, true); f.ai.jumpT = rand(0.8, 1.6); }
        return;
      }
      if (b.pers.tilt > 0.6 && (f.st.hurtT ?? 0) > 3 && Math.random() < 0.01) this.say(b, 'hurt', 1);
      this.combat(f, t, dt, f.ai.tempo, f.ai.aggr, f.ai.dodge);
      s.want = f.moveInput.lengthSq() > 0.01;
      return;
    }
    // no target: follow the player (allies) or walk the abstract plan with human parkour
    let gx = NaN, gz = NaN, sprint = false;
    if (b.ally && (b.pers.social > 0.72 || !b.goal)) {
      const p = g.player; const dx = p.pos.x - f.pos.x, dz = p.pos.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d > 9) { gx = p.pos.x; gz = p.pos.z; sprint = d > 24; }
      if (f.hp < f.maxHp * 0.55 && (f.st.healCdT ?? 0) <= 0 && !f.st.healing) g.startHeal(f);
    } else if ((b.state === 'travel' || b.state === 'zone' || b.state === 'flee') && b.goal) {
      gx = b.goal.x; gz = b.goal.z; sprint = b.state === 'zone' || b.state === 'flee' || b.pers.patience < 0.25 || b.pers.skill > 0.6;
    } else if (b.state === 'work') {
      if (Math.random() < dt * 0.35) f.targetYaw += rand(-1.6, 1.6);
      // greedy players run to cards dropped by a kill nearby
      let best: { x: number; z: number } | null = null, bd = 18 + 60 * b.pers.greed;
      for (const pk of this.pickups) if (pk.card && pk.ttl > 0) { const d = Math.hypot(pk.x - f.pos.x, pk.z - f.pos.z); if (d < bd) { bd = d; best = pk; } }
      if (best) { gx = best.x; gz = best.z; sprint = bd > 20; }
    }
    if (!Number.isNaN(gx)) {
      const dx = gx - f.pos.x, dz = gz - f.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.5) {
        const [sx, sz] = this.steer(f, dx, dz, s, true);
        f.moveInput.set(sx, sz); f.targetYaw = Math.atan2(sx, sz); s.want = true;
        // fast travel like a real player: bunny-hop and dash along the path
        if (sprint && d > 30 && f.onGround && f.ai.jumpT <= 0 && Math.random() < dt * 1.2) { this.hop(f, s, false); f.ai.jumpT = rand(0.5, 1.2); }
        if (sprint && d > 45 && f.dashCd <= 0 && f.energy > 60 && f.ai.dashCd <= 0 && f.stun <= 0 && f.lock <= 0) { g.dash(f, sx, sz); f.ai.dashCd = rand(1.2, 2.8); }
      }
    }
    // pick up cards walked over
    for (const pk of this.pickups) if (pk.card && pk.ttl > 0 && Math.hypot(pk.x - f.pos.x, pk.z - f.pos.z) < 2.6) { b.inv.push(pk.card); pk.ttl = 0; this.say(b, 'loot', 0.3); }
  }

  private hunterAI(f: Fighter, dt: number) {
    const g = this.g, p = g.player;
    f.moveInput.set(0, 0);
    if (g.frozen) return;
    this.tickAI(f, dt);
    if (this.champs.has(f) && Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z) > 58) return;
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
      updateCreature(f, dt);
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
    const cq = this.champs.get(v);
    if (cq && by?.isPlayer) { this.progress(cq, 1); this.feedAdd(`You defeated ${v.name}!`, '#ffd24a'); }
    if (v.st.hunt) { if (by?.isPlayer && !cq) { this.addJenny(2500); this.addCard(rollCard(2, this.luck, 0.4)); this.kills++; this.feedAdd(`You defeated a Bomber Hunter`, '#7dff9a'); } g.fx.explosion(v.chestPos(), 0xff6a2a, 2.5, 0.4); }
  }
  champs = new Map<Fighter, string>();
  private spawnChampion(name: string, p: Poi, qid: string) {
    const g = this.g;
    const q = this.freeNear(p.x + 6, p.z - p.r * 0.62 + 20, 2);
    const f = g.spawn(pick(ALL_KINDS), 'hunter', false, 0);
    f.name = name; f.pos.set(q.x, T.groundAt(q.x, q.z), q.z);
    const def = CHARS[f.kind as PlayableKind];
    f.maxHp = f.hp = Math.round(def.hp * 1.4);
    const ai = g.makeAI('rival', f); ai.type = 'bot'; ai.active = true; ai.tempo = 1.15; ai.aggr = 0.8; ai.dodge = 0.5; f.ai = ai; f.st.hunt = 1;
    f.addMarker(0xffd24a); g.createLabel(f); if (f.labelName) f.labelName.textContent = '★ ' + name;
    this.champs.set(f, qid);
    this.toast(`${name} awaits at the Antokiba colosseum!`, '#ffd24a');
  }
  private botOrFighter(f: Fighter): Bot | Fighter { return f.st.botId !== undefined ? this.bots[f.st.botId] : f; }
  private monsterDown(m: MonSp, by: Fighter | null) {
    const g = this.g;
    m.alive = false;
    const d = m.def;
    if (d.ally) return;
    this.progress('k_' + d.id, 1);
    this.feedAdd(`${by?.isPlayer ? 'You' : by?.name ?? 'Someone'} defeated ${m.name}`, by?.isPlayer ? '#7dff9a' : '#ffffff');
    const pos = V(m.f?.pos.x ?? m.x, 0, m.f?.pos.z ?? m.z);
    g.fx.explosion(V(pos.x, 2, pos.z), 0xffd24a, 3, 0.5);
    const mine = !!by && (by.isPlayer || by.team === 'player');
    if (mine) { this.monsKilled++; g.gainXp(d.xp, 0); this.addJenny(rand(d.jenny[0], d.jenny[1])); if (d.id === 'cyclops') this.progress('cyclops', 1); if (d.id === 'captain') this.progress('pirates', 1); }
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
    for (const c of this.chests) { if (c.opened) continue; const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d < 4.6 && d < bd) { bd = d; const left = (c.guard ?? []).filter((id) => this.mons.find((m) => m.id === id)?.alive).length; best = { kind: 'chest', id: String(c.id), text: left > 0 ? `${c.name ?? 'Vault'} is sealed – ${left} guardian${left > 1 ? 's' : ''} left` : c.big ? 'Open Greed Drop chest' : `Open ${c.name ?? 'treasure chest'}` }; } }
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
      if ((c.guard ?? []).some((id) => this.mons.find((m) => m.id === id)?.alive)) { this.toast('The vault is sealed – defeat its guardians first!', '#ff9a9a'); sfx('ui'); return; }
      c.opened = true; sfx('level');
      const n = c.big ? 4 : c.tier >= 3 ? 4 : 3;
      const pos = V(c.x, 0, c.z);
      g.fx.pillar(pos, c.big ? 0xffd24a : 0xfff0a0, 1.5, 24, 0.7);
      g.fx.burst(V(c.x, 1.5, c.z), 0xffe066, 14, 6, 0.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28 + Math.random();
        const id = c.big || c.tier >= 2 ? rollRank(i === 0 ? pick<Rank>(c.tier >= 3 ? ['S', 'A', 'A'] : ['A', 'B', 'B']) : pick<Rank>(c.tier >= 3 ? ['A', 'B', 'B', 'C'] : ['B', 'C', 'C', 'D'])) : rollCard(c.tier, this.luck, 0.5);
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
  private mapOpts(): DialogOpt[] {
    const J = (n: number) => n.toLocaleString() + ' J';
    return [
      { id: 'buy_chart', label: 'Island Chart', sub: `${J(this.price(3000))} · rough outline of the island, you and your teammates`, disabled: this.mapLevel >= 1 || this.jenny < this.price(3000) },
      { id: 'buy_atlas', label: 'Greed Island Atlas', sub: `${J(this.price(14000))} · full atlas: biomes, roads, towns, dungeons and rare sites`, disabled: this.mapLevel >= 2 || this.jenny < this.price(14000) },
    ];
  }
  openDialog(npc: string) {
    this.dialogNpc = npc;
    const J = (n: number) => n.toLocaleString() + ' J';
    if (npc.startsWith('cartog')) { this.dialog = { id: 'cartog', npc: 'Cartographer', title: 'Island Cartographer', text: `Without a map you are walking blind. I sell two: a rough Chart, and the complete Atlas. You have ${J(this.jenny)}.`, opts: [...this.mapOpts(), { id: 'bye', label: 'Leave' }] }; this.g.paused = false; sfx('ui'); return; }
    switch (npc) {
      case 'eta': this.dialog = { id: 'eta', npc: 'Eta', title: 'Eta · Game Master', text: 'Welcome to Greed Island! Nothing lies around for free – cards come from missions, monsters, rare vaults and rivals. Cards are everything here: Specified Slot cards (items, creatures, passives) and Spell Cards (tactics). The Nen Barrier rises at 20:00 and the game ends at 50:00 — until then, explore, trade and take on missions. Need a push?', opts: [{ id: 'q_orient', label: 'Mission: collect 3 cards' }, { id: 'tips', label: 'Any tips?' }, { id: 'bye', label: 'Goodbye' }] }; break;
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
    const xn = EXTRA_NPCS.find((n) => n.id === npc);
    if (xn) { const q = this.quests.find((k) => k.id === xn.quest); const st = q ? (q.done ? 'Thanks again, hunter!' : `Progress: ${q.prog}/${q.goal}.`) : xn.text; this.dialog = { id: npc, npc: xn.name.split(' ')[0], title: xn.name, text: st, opts: [...(q ? [] : [{ id: 'q_' + xn.quest, label: 'Accept: ' + QUESTS[xn.quest].title, sub: 'Reward: ' + QUESTS[xn.quest].reward }]), { id: 'bye', label: 'Goodbye' }] }; }
    if (this.dialog) { this.g.paused = false; sfx('ui'); }
  }
  private sellOpts(): DialogOpt[] {
    const uniq = [...new Set(this.inv.filter((c) => c !== 's100' && c !== 's101'))].sort((a, b) => RANK_VALUE[this.rank(b)] - RANK_VALUE[this.rank(a)]).slice(0, 7);
    return [...this.mapOpts(), ...uniq.map((id) => ({ id: 'sell_' + id, label: `Sell ${CARDS[id].name} [${this.rank(id)}]`, sub: this.sellValue(id).toLocaleString() + ' J' + (this.count(id) > 1 ? ` · you have ${this.count(id)}` : '') })), { id: 'sellcol', label: 'Sell every collectible card', sub: 'Keeps passives, consumables & spells' }, { id: 'bye', label: 'Leave' }];
  }
  private casinoOpts(): DialogOpt[] {
    return [{ id: 'slots', label: 'Slot machine', sub: '1,000 J · triple 7 = legendary card', disabled: this.jenny < 1000 }, { id: 'poker', label: "Poker vs the Casino King", sub: '5,000 J · win the Fledgling Gambler card', disabled: this.jenny < 5000 }, { id: 'dice', label: 'Risky Dice (stake your worst card)', sub: '5-6: upgrade · 1-2: lose it', disabled: this.inv.filter((c) => c !== 's100' && c !== 's101').length === 0 }, { id: 'bye', label: 'Leave' }];
  }
  closeDialog() { this.dialog = null; sfx('ui'); }
  get uiBlocking() { return !!this.dialog || this.mapOpen || !!this.trade; }
  get mapLevel() { return this.mapLevelOf(this.inv); }
  toggleMap() {
    if (!this.mapOpen && this.mapLevel === 0) { this.toast('You carry no map card! Buy an Island Chart at a Trade Shop or cartographer, or take one from a rival.', '#ffcf8a'); sfx('ui'); return; }
    this.mapOpen = !this.mapOpen; sfx('ui');
  }
  acceptTrade() { const t = this.trade; if (!t) return; if (this.has(t.want) && t.bot.inv.includes(t.give)) { this.removeCard(t.want); t.bot.inv.splice(t.bot.inv.indexOf(t.give), 1); t.bot.inv.push(t.want); this.addCard(t.give, true); this.toast(`Traded ${CARDS[t.want].name} for ${CARDS[t.give].name}`, '#7dff9a'); this.say(t.bot, 'loot'); } this.trade = null; }
  declineTrade() { this.trade = null; }

  choose(id: string) {
    const g = this.g;
    const d = this.dialog;
    if (!d) return;
    const J = (n: number) => n.toLocaleString() + ' J';
    const refresh = () => this.openDialog(this.dialogNpc);
    if (id === 'bye') { this.closeDialog(); return; }
    if (id === 'tips') { d.text = 'Open the Binder with B. Spells need targets you have MET (come within 45m). Holy Water shields you from the Barrier for 25s. Heal with R. Cyclops in the Badlands drop good cards.'; d.opts = [{ id: 'q_orient', label: 'Mission: collect 3 cards' }, { id: 'bye', label: 'Thanks' }]; return; }
    if (id.startsWith('q_')) { this.startQuest(id.slice(2)); this.closeDialog(); return; }
    if (id.startsWith('sell_')) { const cid = id.slice(5); if (this.removeCard(cid)) { this.addJenny(this.sellValue(cid), true); sfx('level'); this.toast(`Sold ${CARDS[cid].name} for ${J(this.sellValue(cid))}`, '#ffe066'); } refresh(); return; }
    switch (id) {
      case 'sellcol': { let tot = 0; for (const c of [...this.inv]) { if (CARDS[c].type === 'collect' && c !== 's100' && c !== 's101') { tot += this.sellValue(c); this.removeCard(c); } } this.addJenny(tot, true); this.toast(tot ? `Sold collectibles for ${J(tot)}` : 'Nothing to sell', '#ffe066'); refresh(); break; }
      case 'meal': { const pr = this.price(800); if (this.jenny >= pr) { this.jenny -= pr; g.heal(g.player, g.player.maxHp * 0.5); g.player.speedMult = 1.1; g.player.buffT = 60; sfx('level'); } refresh(); break; }
      case 'gossip': this.revealNear(3, 14, 200); this.toast('The cats whisper where players are…', '#bfe8ff'); this.closeDialog(); break;
      case 'pack': { const pr = this.price(10000); if (this.jenny >= pr) { this.jenny -= pr; for (let i = 0; i < 3; i++) this.addCard(rollCard(1, this.luck + 0.05, 1.5 > 1 ? 1 : 1) && pick(SPELL_IDS) ? this.rollSpell() : 'p1001'); sfx('level'); } refresh(); break; }
      case 'train': if (this.jenny >= 2500) { this.jenny -= 2500; g.gainXp(this.xpNeedNow(), 0); } refresh(); break;
      case 'buy_chart': case 'buy_atlas': { const chart = id === 'buy_chart'; const pr = this.price(chart ? 3000 : 14000); if (this.jenny >= pr && this.mapLevel < (chart ? 1 : 2)) { this.jenny -= pr; if (!chart) this.removeCard('s101'); this.addCard(chart ? 's101' : 's100'); sfx('level'); } refresh(); break; }
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
    const pool = this.inv.filter((c) => c !== 's100' && c !== 's101').sort((a, b) => RANK_VALUE[this.rank(a)] - RANK_VALUE[this.rank(b)]);
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
    this.visitAcc += dt; if (this.visitAcc > 0.5) { this.visitAcc = 0; this.checkVisited(); }
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
  private visitAcc = 0;
  private checkVisited() {
    const p = this.g.player;
    for (const t of POIS) if (Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < t.r + 20 && !this.visited.has(t.id)) { this.visited.add(t.id); this.progress('wander', 1); this.toast(`Discovered ${t.name}`, t.color); }
    const near = (id: string) => { const q = poi(id); return Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < q.r * 0.5; };
    if (near('dorias')) this.progress('k_parcel', 1);
    if (near('soufrabi')) this.progress('k_courier', 1);
    if (this.visited.has('antokiba') && this.visited.has('masadora')) this.progress('orient', 2);
  }

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
      this.cardRelease(c, c.name + '… RELEASE!');
      g.after(c.cast ?? 1, p, () => { this.casting = null; if (!this.has(id)) return; this.resolveSpell(c, tg); });
      return;
    }
    this.useCd = 0.6;
    this.removeCard(id);
    this.cardRelease(c, 'GAIN!');
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
      case 'levy': { let n = 0; for (const b of this.bots) { if (!b.alive || b.team === 0 || Math.hypot(b.x - p.pos.x, b.z - p.pos.z) > 20) continue; if (this.botBlocks(b)) continue; const pool = b.inv.filter((x) => x !== 's100' && x !== 's101'); if (!pool.length) continue; const id = pick(pool); b.inv.splice(b.inv.indexOf(id), 1); this.addCard(id); b.hostile = true; n++; } if (!n) this.toast('Levy found no one to tax', '#cccccc'); break; }
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
      m4.compose(V(pk.x, y + T.groundAt(pk.x, pk.z), pk.z), q, s);
      this.cardMesh.setMatrixAt(n, m4);
      col.set(pk.herb ? '#7dff7d' : pk.jenny ? '#ffd24a' : RANK_COLOR[pk.rank]).multiplyScalar(1.5);
      this.cardMesh.setColorAt(n, col);
      n++;
      if ((pk.card && RANK_VALUE[pk.rank] >= RANK_VALUE.B) || pk.herb) {
        if (nb < 395) { m4.compose(V(pk.x, T.groundAt(pk.x, pk.z), pk.z), new THREE.Quaternion(), V(1, 1, 1)); this.beamMesh.setMatrixAt(nb, m4); col.set(pk.herb ? '#7dff7d' : RANK_COLOR[pk.rank]).multiplyScalar(1.4); this.beamMesh.setColorAt(nb, col); nb++; }
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
      m4.compose(V(c.x, T.groundAt(c.x, c.z), c.z), new THREE.Quaternion().setFromAxisAngle(up, c.id), s);
      this.chestMesh.setMatrixAt(nc, m4);
      col.set(c.big ? '#ffd24a' : c.tier >= 2 ? '#b06bff' : c.tier === 1 ? '#c9a24a' : '#8a5a2a');
      this.chestMesh.setColorAt(nc, col);
      nc++;
      if ((c.tier >= 1 || c.big) && nb < 399) { m4.compose(V(c.x, T.groundAt(c.x, c.z), c.z), new THREE.Quaternion(), c.big ? V(2.4, 1.6, 2.4) : V(1.2, 1, 1.2)); this.beamMesh.setMatrixAt(nb, m4); col.set(c.big ? '#ffd24a' : c.tier >= 2 ? '#b06bff' : '#ffe9a0').multiplyScalar(1.3); this.beamMesh.setColorAt(nb, col); nb++; }
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
    for (const c of this.chests) if (!c.opened && c.name) marks.push({ x: c.x, z: c.z, t: 'site', label: c.name });
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
      begun: this.begun, over: this.over, mapLevel: this.mapLevel,
      cut: this.cutActive ? { lines: CUT.filter((c) => c.t <= this.cutT).slice(-2).map((c) => ({ title: c.title, text: c.text, who: c.who, t: c.t })), t: this.cutT, len: CUT_LEN, skip: false, flash: this.cutFlash, scene: [...CUT].reverse().find((c) => c.t <= this.cutT && c.scene)?.scene ?? '' } : null,
      time: this.t, alive: this.aliveCount(), teams: this.teamsAlive(), kills: this.kills, format: this.format,
      zone: { r: z.r, phase: z.phase, closing: z.closing, tNext: z.tNext, nextR: z.to, dps: z.dps * (this.surgeT > 0 ? 2 : 1), started: this.t >= BARRIER_T },
      outside: Math.hypot(px, pz) > z.r && this.t >= BARRIER_T, edge: z.r - Math.hypot(px, pz), jenny: this.jenny, binderOpen: this.binderOpen, mapOpen: this.mapOpen,
      spells: Object.entries(spells).map(([id, n]) => ({ id, n })), spec, specCount: Object.keys(spec).length, spellCount: this.spellCount,
      prompt, dialog: this.dialog, quests: this.quests.map((q) => ({ ...q })), feed: this.feed.map((f) => ({ text: f.text, color: f.color })), toasts: this.toasts.map((t) => ({ text: t.text, color: t.color })),
      mini: { x: px, z: pz, yaw: g.camYaw, safeR: z.r, nextR: z.to, marks: this.mapLevel >= 2 ? marks : this.mapLevel === 1 ? marks.filter((q) => q.t === 'ally') : [] },
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
