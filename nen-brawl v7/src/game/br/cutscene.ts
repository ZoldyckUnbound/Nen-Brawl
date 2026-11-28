/**
 * Greed Island opening cinematic – follows Episodes 60-61 of the 2011 Hunter x Hunter anime:
 *   1. night at the mansion where every Greed Island unit has been set up (Tsezguerra explains; rock-paper-scissors decides the order)
 *   2. the player puts on the ring, feeds Nen into the console and says "START GAME" – the body turns to light (it is really teleported)
 *   3. the Starting Point: Eta welcomes the new player, explains BOOK / GAIN and the 100 restricted slots, and plays Ging's message
 *   4. the gates open on the island – a flight over Greed Island's great cities
 *   5. (Battle Royale rule) every player is gathered at the Shiso Tree and Razor's Magic Teleport Circle scatters them
 */
import * as THREE from 'three';
import type { Game } from '../Game';
import type { Fighter } from '../Fighter';
import { poi, RANK_COLOR, type Rank } from './data';
import { ALL_KINDS } from '../defs';
import * as T from '../terrain';
import { sfx } from '../audio';

export interface CutLine { t: number; title?: string; text: string; who?: string; scene?: string }
export const CUT: CutLine[] = [
  { t: 0.4, scene: 'The mansion · where the Greed Island units wait', title: 'GREED ISLAND', text: 'A game forged with Nen. Only a handful of copies exist – and tonight, one of them is yours.' },
  { t: 4.4, text: 'Every unit has been set up in the great hall. Each comes with a console, a memory card… and a ring.', who: 'Narrator' },
  { t: 9.2, scene: 'The great hall · first light of the screening', text: 'The ring carries your Nen into the machine. It is no mere video game.', who: 'Tsezguerra' },
  { t: 13.2, text: 'The order of entry was decided by rock-paper-scissors. You won. You go first.', who: 'Tsezguerra' },
  { t: 17.2, text: 'No clues about Ging are waiting for you in there. Do not forget why you came.', who: 'Narrator' },
  { t: 20.2, scene: 'Console 01 · ring activation', text: 'You slip the ring on and hold your own memory card to the console. Aura floods in.', who: 'Narrator' },
  { t: 23.4, text: '“START GAME!”', who: 'You' },
  { t: 27.2, scene: 'Between worlds', text: 'Your body does not stay behind. It dissolves into light and is teleported across the world.', who: 'Narrator' },
  { t: 31.4, text: 'Whoever holds the ring can be carried to the island – and only a Nen user can start the machine.', who: 'Narrator' },
  { t: 35.4, scene: 'The Starting Point · Greed Island', title: 'WELCOME', text: 'Welcome to Greed Island! I am Eta, the Game Master who greets new players.', who: 'Eta' },
  { t: 39.2, text: 'Your ring gives you two spells. Say “BOOK” – and your binder, with 100 restricted slots, appears. Say “GAIN” – and a card becomes its item.', who: 'Eta' },
  { t: 43.4, text: 'A message from Ging is saved in your ring: “Don’t expect clues about me here. I only wanted to show off the game I made.”', who: 'Ging' },
  { t: 47.2, scene: 'Greed Island · the great cities', text: 'Antokiba’s prize city… Masadora, the magic city and the only shop of spell cards… Limeiro’s royal walls…', who: 'Narrator' },
  { t: 52.0, text: 'Monsters, dungeons, bandits, pirates and Bombers. All of it, inside a game.', who: 'Narrator' },
  { t: 56.2, scene: 'The Shiso Tree · Razor’s Magic Teleport Circle', text: 'Every player gathers at the Shiso Tree. Collecting all the cards is not what saves you today.', who: 'Razor' },
  { t: 59.4, text: 'The Game Masters’ Nen Barrier will rise at 20:00 and close without mercy. Only one hunter will remain.', who: 'Razor' },
  { t: 62.2, title: 'LAST SURVIVOR', text: 'Survive. Gather the cards that keep you alive. Read every hunter you meet.', who: 'Razor' },
];
export const CUT_LEN = 66;
export const CUT_TP = 64.4;

const ease = (k: number) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Cutscene {
  private root = new THREE.Group();
  private hall = new THREE.Group();
  private chamber = new THREE.Group();
  private exterior = new THREE.Group();
  private tunnel = new THREE.Group();
  private tunItems: { m: THREE.Object3D; z0: number; sp: number }[] = [];
  private ring!: THREE.Mesh;
  private card!: THREE.Mesh;
  private portal!: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private cast: Fighter[] = [];
  private done = new Set<string>();
  private path: THREE.Vector3[] = [];
  private flash = 0;
  private bookShown = false;
  readonly HALL = V(0, 4000, 0);
  readonly CH = V(1500, 4000, 0);
  readonly EX = V(-1500, 4000, 0);
  readonly TUN = V(0, 4000, 600);

  constructor(private g: Game, private world: { group: THREE.Group; setFocus: (x: number, z: number, r?: number) => void }, private hero: Fighter) {
    const B = new THREE.BoxGeometry(1, 1, 1);
    const L = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const E = (c: number, k = 1.7) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
    const add = (grp: THREE.Group, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, geo: THREE.BufferGeometry = B) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); grp.add(o); return o; };
    const cyl = (r0: number, r1: number, h = 1, seg = 24) => new THREE.CylinderGeometry(r0, r1, h, seg);

    // ---------------------------------------------------------------- night exterior of the mansion
    {
      const e = this.exterior; e.position.copy(this.EX);
      add(e, L(0x16241c), 0, -0.5, 0, 400, 1, 400);
      add(e, L(0x2a2a34), 0, -0.45, 40, 16, 0.1, 140); // drive
      const wall = L(0xcfc6b0), roof = L(0x2a3350), trim = L(0x8a8068), glow = E(0xffd88a, 1.9);
      add(e, wall, 0, 9, -40, 46, 18, 26); add(e, wall, -34, 7, -34, 22, 14, 20); add(e, wall, 34, 7, -34, 22, 14, 20);
      add(e, roof, 0, 20.5, -40, 50, 4, 30); add(e, roof, -34, 15.2, -34, 24, 3, 22); add(e, roof, 34, 15.2, -34, 24, 3, 22);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) add(e, glow, -19 + i * 4.75, 4 + r * 5.4, -26.9, 2.0, 2.8, 0.15);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(e, glow, s * 34 + (i - 1) * 6, 5.5, -23.9, 2.0, 2.8, 0.15);
      add(e, trim, 0, 2.2, -26.7, 6, 4.4, 0.6); add(e, E(0xffe8b0, 2), 0, 2.0, -26.3, 3.4, 4.0, 0.2);
      for (let i = 0; i < 6; i++) add(e, trim, -9 + i * 3.6, 6.4, -25.6, 1.0, 12.4, 1.0);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 14), E(0xe8f0ff, 1.5)); moon.position.set(120, 150, -300); e.add(moon);
      const star = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.2 + 0.1, r = 700; star[i * 3] = Math.cos(a) * Math.cos(b) * r; star[i * 3 + 1] = Math.sin(b) * r; star[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r - 100; }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(star, 3));
      e.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })));
      for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.28 + 0.2, r = 70 + (i % 3) * 20; const tx = Math.cos(a) * r, tz = -40 + Math.sin(a) * r * 0.8; if (Math.abs(tx) < 14 && tz > -30) continue; add(e, L(0x3a2a1c), tx, 3, tz, 1.2, 6, 1.2); add(e, L(0x14301c), tx, 9, tz, 7, 8, 7, new THREE.IcosahedronGeometry(0.5, 0)); }
      for (let i = 0; i < 9; i++) { const ln = new THREE.PointLight(0xffd88a, 0, 0); void ln; }
    }
    // ---------------------------------------------------------------- the great hall
    {
      const h = this.hall; h.position.copy(this.HALL);
      const dark = L(0x15171f), floor = L(0x2b2e3a), wood = L(0x3a2a22), carpet = L(0x4a1a28);
      add(h, floor, 0, -0.5, 0, 70, 1, 56); add(h, carpet, 0, 0.02, 0, 12, 0.06, 56); add(h, dark, 0, 10, -28, 70, 20, 1); add(h, dark, -35, 10, 0, 1, 20, 56); add(h, dark, 35, 10, 0, 1, 20, 56); add(h, dark, 0, 10, 28, 70, 20, 1); add(h, dark, 0, 20.5, 0, 70, 1, 56);
      for (let i = 0; i < 6; i++) add(h, E(0xbfe8ff, 1.3), -22 + i * 9, 20, 0, 0.7, 0.2, 40);
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { add(h, E(0x5a78c8, 1.2), s * 34.4, 9.5, -20 + i * 10, 0.2, 9, 3.4); add(h, E(0xcfe0ff, 0.5), s * 28, 9.5, -20 + i * 10, 12, 0.05, 0.4); }
      const cols = [0x6ad0ff, 0xb58cff, 0xffc24a, 0x7dffa0, 0xff7ab8, 0x6ad0ff, 0xffc24a];
      for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
        const x = -16 + i * 5.4, z = -6 - r * 9;
        add(h, wood, x, 0.55, z, 3.6, 1.1, 1.8); add(h, L(0x2e3140), x, 1.5, z - 0.1, 1.8, 0.7, 1.1); add(h, E(cols[(i + r) % 7], 1.8), x, 2.5, z - 0.5, 2.3, 1.4, 0.12);
        add(h, E(cols[(i + r * 3) % 7], 2.2), x + 1.4, 1.17, z + 0.5, 0.45, 0.06, 0.45); add(h, L(0x1a1a22), x, 0.4, z + 2.4, 1.2, 0.8, 1.2);
      }
      for (let i = 0; i < 6; i++) { const x = -26 + i * 10.4; add(h, wood, x, 6, -27.4, 3.2, 12, 0.8); for (let k = 0; k < 4; k++) add(h, E([0xc8a050, 0x6a8ac8, 0xb85a5a][k % 3], 0.8), x, 1.8 + k * 2.6, -26.9, 2.8, 0.18, 0.5); }
      for (let i = 0; i < 4; i++) { const x = -18 + i * 12; add(h, E(0xffe9b0, 1.6), x, 17, 0, 3, 0.4, 3); add(h, L(0x6a5a3a), x, 18.6, 0, 0.14, 3, 0.14); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 14, 44), E(0xffd24a, 2.4)); ring.position.set(-16, 2.9, -4.2); ring.rotation.x = 1.2; h.add(ring); this.ring = ring;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), E(0x6ad0ff, 2)); card.position.set(-16, 2.1, -4.7); card.rotation.set(-0.5, 0, 0); card.material.side = THREE.DoubleSide; h.add(card); this.card = card;
      const pl = new THREE.PointLight(0x8fd0ff, 400, 60); pl.position.set(0, 12, 4); h.add(pl);
      const pl2 = new THREE.PointLight(0xffd24a, 100, 14); pl2.position.set(-16, 3.5, -4); h.add(pl2);
    }
    // ---------------------------------------------------------------- the Starting Point chamber
    {
      const c = this.chamber; c.position.copy(this.CH);
      const stone = L(0xcfc8b6), dark = L(0x2a2a3a), gold = E(0xffd24a, 1.8);
      add(c, L(0x4a4a58), 0, -0.5, 0, 56, 1, 56, cyl(0.5, 0.5, 1, 40));
      add(c, stone, 0, 0.1, 0, 36, 0.2, 36, cyl(0.5, 0.5, 1, 40));
      for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(5 + i * 3.4, 0.18, 8, 80), E([0x7be08a, 0xb58cff, 0xffd24a][i], 2)); r.rotation.x = Math.PI / 2; r.position.y = 0.3 + i * 0.02; c.add(r); this.rings.push(r); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, x = Math.cos(a) * 18, z = Math.sin(a) * 18; add(c, stone, x, 7, z, 2.2, 14, 2.2, cyl(0.5, 0.55, 1, 12)); add(c, gold, x, 14.2, z, 3, 0.4, 3, cyl(0.5, 0.5, 1, 12)); }
      add(c, L(0xe8e0cc), 0, 15.5, 0, 40, 1, 40, cyl(0.5, 0.5, 1, 40));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 12, 0, 6.283, 0, 1.2), new THREE.MeshLambertMaterial({ color: 0xd8d0be, side: THREE.DoubleSide })); dome.position.y = 15.5; c.add(dome);
      add(c, E(0xffffff, 1.2), 0, 31, 0, 3, 0.2, 3, cyl(0.5, 0.5, 1, 16));
      add(c, dark, 0, 1.0, -12, 4, 2, 1.8); add(c, gold, 0, 2.1, -12, 4, 0.12, 1.8);
      // arched gate (opens onto the island)
      add(c, dark, -5, 7, 18.6, 3, 14, 2); add(c, dark, 5, 7, 18.6, 3, 14, 2); add(c, dark, 0, 14.5, 18.6, 13, 3, 2);
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(7, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c8).multiplyScalar(2.2), transparent: true, opacity: 0, side: THREE.DoubleSide })); portal.position.set(0, 7, 18.7); c.add(portal); this.portal = portal;
      const lamp = new THREE.PointLight(0xfff2c8, 260, 60); lamp.position.set(0, 12, 4); c.add(lamp);
    }
    // ---------------------------------------------------------------- warp tunnel
    {
      const tun = this.tunnel; tun.position.copy(this.TUN);
      tun.add(new THREE.Mesh(new THREE.SphereGeometry(260, 16, 12), new THREE.MeshBasicMaterial({ color: 0x03040a, side: THREE.BackSide, fog: false })));
      const sm = [0x6ad0ff, 0xb58cff, 0xffd24a, 0xffffff, 0x7dffa0].map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      for (let i = 0; i < 220; i++) { const a = Math.random() * 6.28, r = 3 + Math.random() * 24; const m = new THREE.Mesh(B, sm[i % 5]); m.scale.set(0.12, 0.12, 6 + Math.random() * 28); m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); tun.add(m); this.tunItems.push({ m, z0: Math.random() * 400 - 200, sp: 120 + Math.random() * 160 }); }
      const cg = new THREE.PlaneGeometry(1.5, 2.1);
      for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28, r = 7 + (i % 3) * 3; const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: new THREE.Color(RANK_COLOR[(['S', 'A', 'B', 'C', 'D'] as Rank[])[i % 5]]).multiplyScalar(1.6), side: THREE.DoubleSide, fog: false })); m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); m.rotation.set(Math.random(), Math.random(), Math.random()); tun.add(m); this.tunItems.push({ m, z0: i * 22 - 190, sp: 70 + (i % 4) * 10 }); }
    }
    for (const o of [this.exterior, this.hall, this.chamber, this.tunnel]) this.root.add(o);
    g.scene.add(this.root);
    this.hall.visible = false; this.chamber.visible = false; this.tunnel.visible = false;
    // dark night sky for the indoor / pre-island scenes
    world.group.visible = false;
    g.scene.background = new THREE.Color(0x070a16);
    const fog = g.scene.fog as THREE.Fog | null; if (fog) { fog.near = 60; fog.far = 520; fog.color.set(0x070a16); }

    // ---------------------------------------------------------------- the cast
    const pin = (f: Fighter, p: THREE.Vector3, yaw: number) => { f.st.pin = 1; f.pos.copy(p); f.faceNow(yaw); f.invuln = 1e9; };
    this.hall.updateMatrixWorld();
    for (let i = 1; i < 7; i++) { const f = g.spawn(ALL_KINDS[(i * 5 + 2) % ALL_KINDS.length], 'none', false, 0); pin(f, V(-16 + i * 5.4, 4000, -2.6), Math.PI); this.cast.push(f); }
    const ts = g.spawn('bandit', 'none', false, 1); pin(ts, V(0, 4000, 9), Math.PI + 0.2); this.tint(ts, 0x4a8a5a); this.cast.push(ts);
    const eta = g.spawn('bandit', 'none', false, 0); pin(eta, V(this.CH.x, 4000, this.CH.z - 10.5), 0); this.tint(eta, 0x7be08a); this.cast.push(eta);
    pin(hero, V(-16, 4000, -2.6), Math.PI); hero.root.visible = true;

    // flight path for the island fly-over
    const s = poi('shiso');
    const wp = ['antokiba', 'masadora', 'limeiro'].map((id) => poi(id));
    const alt = (x: number, z: number, add: number) => Math.max(T.groundAt(x, z), 0) + add;
    this.path = [V(s.x - 2200, 420, s.z + 1900), V(s.x + 200, alt(s.x, s.z, 260), s.z + 700)];
    for (const p of wp) this.path.push(V(p.x - 160, alt(p.x, p.z, 170), p.z + 360));
    this.path.push(V(s.x + 200, alt(s.x, s.z, 90), s.z + 220));
  }
  private tint(f: Fighter, col: number) { const c = new THREE.Color(col); for (const m of f.rig.mats) m.color.lerp(c, 0.5); }

  /** camera director */
  camera(cam: THREE.PerspectiveCamera, t: number) {
    const E = this.EX, H = this.HALL, C = this.CH, N = this.TUN;
    if (t < 9) { // A: crane toward the lit windows of the mansion
      const k = ease(t / 9);
      cam.position.set(E.x - 70 + k * 56, E.y + 3 + k * 9, E.z + 80 - k * 52);
      cam.lookAt(E.x + Math.sin(t * 0.3) * 2, E.y + 9 + k * 2, E.z - 40);
      cam.fov = 58;
    } else if (t < 20) { // B: dolly along the row of consoles, over Tsezguerra's shoulder to the waiting players
      const k = (t - 9) / 11;
      cam.position.set(H.x - 30 + ease(k) * 34, H.y + 3.4 + Math.sin(k * 3) * 0.4, H.z + 13 - k * 3);
      cam.lookAt(H.x - 8 + k * 6, H.y + 2.2, H.z - 6);
      cam.fov = 52;
    } else if (t < 27.2) { // C: the player at console 01, ring and card
      const k = ease((t - 20) / 7.2);
      cam.position.set(H.x - 13.6 + (1 - k) * 4, H.y + 2.5 + (1 - k) * 0.6, H.z + 1.2 - k * 3.2);
      cam.lookAt(H.x - 16, H.y + 2.3, H.z - 4.4);
      cam.fov = lerp(50, 36, k);
    } else if (t < 35) { // warp tunnel
      cam.position.set(N.x + Math.sin(t * 2.2) * 1.4, N.y + Math.cos(t * 1.7) * 1.2, N.z + 220);
      cam.lookAt(N.x, N.y, N.z);
      cam.fov = lerp(60, 98, ease((t - 27.2) / 7.8));
    } else if (t < 46.2) { // D: arrival at the Starting Point – orbit, then push in on Eta
      const k = (t - 35) / 11.2, a = lerp(0.6, 2.4, ease(k));
      const r = lerp(17, 8, ease(Math.min(1, k * 1.2)));
      cam.position.set(C.x + Math.cos(a) * r, C.y + lerp(7, 3.4, ease(k)), C.z + Math.sin(a) * r - 2);
      cam.lookAt(C.x, C.y + lerp(2.4, 3.2, k), C.z - lerp(2, 10, ease(k)));
      cam.fov = 54;
    } else if (t < 56.2) { // E: flight over Greed Island
      const k = (t - 46.2) / 10, n = this.path.length - 1, f = Math.min(0.9999, ease(k * 0.96 + 0.02)) * n, i = Math.floor(f), u = f - i;
      const a = this.path[Math.max(0, i - 1)], b = this.path[i], c2 = this.path[Math.min(n, i + 1)], d = this.path[Math.min(n, i + 2)];
      const cr = (p0: number, p1: number, p2: number, p3: number) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
      cam.position.set(cr(a.x, b.x, c2.x, d.x), cr(a.y, b.y, c2.y, d.y), cr(a.z, b.z, c2.z, d.z));
      const nx = Math.min(n, i + 1), tx = this.path[nx];
      cam.lookAt(tx.x + (this.path[Math.min(n, nx + 1)].x - tx.x) * 0.3, tx.y - 120, tx.z + (this.path[Math.min(n, nx + 1)].z - tx.z) * 0.3 + 120);
      cam.fov = 66;
    } else { // F: the gathering at the Shiso Tree
      const s = poi('shiso'), k = ease((t - 56.2) / 8.4), gy = T.groundAt(s.x, s.z + 27);
      const a = 1.9 + k * 1.5;
      cam.position.set(s.x + Math.cos(a) * 30, gy + 7 + k * 5, s.z + 27 + Math.sin(a) * 30 - 8);
      cam.lookAt(s.x, gy + 5.5 + k * 6, s.z + 27);
      cam.fov = 58;
    }
    cam.updateProjectionMatrix();
  }

  /** drive props / events; returns the white-flash amount */
  update(t: number, dt: number, shiso: { x: number; z: number }, dropHero: () => void): number {
    const g = this.g;
    this.hall.visible = t >= 8.6 && t < 27.6;
    this.exterior.visible = t < 9.2;
    this.tunnel.visible = t >= 27 && t < 35.4;
    this.chamber.visible = t >= 34.6 && t < 46.6;
    if (t < 46.2) this.world.group.visible = false;
    // ring / card of console 01
    if (this.ring) {
      const k = Math.max(0, t - 20);
      this.ring.rotation.y += dt * (1 + k * 1.2); this.ring.rotation.z += dt * 0.8; this.ring.position.y = 2.9 + Math.sin(t * 2) * 0.08 + Math.min(1, k * 0.2) * 0.4;
      this.card.rotation.y += dt * (0.6 + k * 0.5); this.card.position.y = 2.1 + Math.sin(t * 2.4) * 0.06;
    }
    for (const it of this.tunItems) { it.z0 -= it.sp * dt; if (it.z0 < -220) it.z0 += 440; it.m.position.z = it.z0; if (it.m.scale.z < 1.4) { it.m.rotation.x += dt * 2; it.m.rotation.y += dt * 1.5; } }
    this.rings.forEach((r, i) => { r.rotation.z += dt * (0.3 + i * 0.25) * (i % 2 ? -1 : 1); });
    const once = (k: string, fn: () => void, at: number) => { if (t >= at && !this.done.has(k)) { this.done.add(k); fn(); } };
    const hp = V(this.HALL.x - 16, 4000 + 2.6, this.HALL.z - 4.5);
    // aura streaming into the console while the ring activates
    if (t > 20.4 && t < 25.6 && Math.random() < dt * 22) { g.fx.gather(hp, 0x9fe8ff, 3.2, 3); g.fx.aura(V(this.hero.pos.x, 4000, this.hero.pos.z), 0x9fe8ff, 2, 3.2, 0.9); }
    once('start', () => { sfx('charge'); g.fx.ring(V(hp.x, 4000.1, hp.z), 0xffd24a, 1, 7, 1.2); }, 23.4);
    once('dissolve', () => { sfx('level'); g.fx.burst(this.hero.chestPos(), 0xffffff, 40, 12, 1.0); g.fx.pillar(this.hero.pos, 0xbfe8ff, 2, 30, 1.2); this.hero.root.visible = false; }, 25.8);
    once('arrive', () => { this.hero.pos.set(this.CH.x, 4000, this.CH.z + 1); this.hero.faceNow(Math.PI); this.hero.root.visible = true; g.fx.pillar(this.hero.pos, 0xb58cff, 3, 40, 1.4); g.fx.ring(V(this.CH.x, 4000.2, this.CH.z + 1), 0xffffff, 1, 16, 1.4); g.fx.burst(this.hero.chestPos(), 0xffffff, 40, 10, 1.0); sfx('level'); }, 35.3);
    once('book', () => { this.bookShown = true; g.popup(this.hero, 'BOOK!', '#ffe9a0', 34); g.fx.pillar(this.hero.pos, 0xffd24a, 1.4, 20, 0.8); sfx('card'); }, 40.0);
    once('gain', () => { g.popup(this.hero, 'GAIN!', '#9fe8ff', 30); g.fx.ring(this.hero.pos, 0x9fe8ff, 1, 6, 0.7); sfx('level'); }, 41.8);
    once('ging', () => { g.fx.ring(this.hero.pos, 0xffd24a, 1, 5, 0.8); sfx('card'); }, 43.6);
    if (t > 44.2 && t < 46.4) this.portal.material = this.portal.material, ((this.portal.material as THREE.MeshBasicMaterial).opacity = ease((t - 44.2) / 2));
    once('island', () => { this.world.group.visible = true; g.scene.background = null; dropHero(); this.endIndoor(); this.restoreFog(); }, 46.2);
    if (t > 56 && !this.done.has('circle')) { this.done.add('circle'); const y = T.groundAt(shiso.x, shiso.z + 27); for (let i = 0; i < 4; i++) g.fx.ring(V(shiso.x, y, shiso.z + 27), 0xb08cff, 2, 16 + i * 3, 3, 0.15 + i * 0.1); g.fx.pillar(V(shiso.x, y, shiso.z + 27), 0xb08cff, 12, 60, 6); sfx('charge'); }
    void this.bookShown;
    // flash choreography: ring glow -> whiteout (start) / teleport / gates open / final teleport
    let fl = 0;
    if (t > 23.4 && t < 26.6) fl = Math.max(0, Math.min(1, (t - 23.4) / 2.4));
    else if (t >= 26.6 && t < 28) fl = 1 - Math.min(1, (t - 26.6) / 1.4);
    else if (t > 34.6 && t < 35.8) fl = 1 - Math.abs(t - 35.2) * 1.6;
    else if (t > 45.4 && t < 47) fl = 1 - Math.abs(t - 46.2) / 0.9;
    else if (t > 63.4 && t < 65.2) fl = 1 - Math.abs(t - 64.4) / 1.0;
    this.flash = Math.max(0, Math.min(1, fl));
    return this.flash;
  }
  private endIndoor() { for (const o of [this.hall, this.chamber, this.tunnel, this.exterior]) o.visible = false; }
  private restoreFog() { /* the BR mode re-applies the island fog in its own update */ }

  /** remove the cosmetic cast and the stage */
  dispose() {
    const g = this.g;
    for (const f of this.cast) { g.removeFighter(f); g.fighters = g.fighters.filter((x) => x !== f); }
    this.cast = [];
    g.scene.remove(this.root);
    this.root.traverse((m) => { const q = m as THREE.Mesh; if (q.isMesh) q.geometry?.dispose?.(); });
    this.hero.st.pin = 0;
    this.hero.root.visible = true;
    this.world.group.visible = true;
  }
}
