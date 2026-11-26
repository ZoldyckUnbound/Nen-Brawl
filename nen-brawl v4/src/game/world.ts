import * as THREE from 'three';

export interface Obstacle {
  x: number;
  z: number;
  r: number;
  /** height of the top – used as a grapple / bungee anchor */
  h?: number;
}

export interface Env {
  sky: number;
  fog: number;
  fogN: number;
  fogF: number;
  hemiS: number;
  hemiG: number;
  hemiI: number;
  sunC: number;
  sunI: number;
}

export interface World {
  name: string;
  group: THREE.Group;
  obstacles: Obstacle[];
  radius: number;
  env: Env;
  update: (dt: number, time: number) => void;
  dispose: () => void;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lam = (color: number | string, flat = true) => new THREE.MeshLambertMaterial({ color, flatShading: flat });

function shadowed<T extends THREE.Mesh>(m: T, cast = true, receive = true): T {
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mm = m.material;
      if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
      else (mm as THREE.Material)?.dispose();
    }
  });
}

const DAY: Env = { sky: 0x8fd3ff, fog: 0x9fdcff, fogN: 190, fogF: 620, hemiS: 0xcfe8ff, hemiG: 0x6a8f4a, hemiI: 2.0, sunC: 0xffffff, sunI: 2.6 };

// ---------------------------------------------------------------- bandit island (kept from the original)
export function buildIsland(): World {
  const group = new THREE.Group();
  const rand = rng(1337);
  const obstacles: Obstacle[] = [];

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: 0x2b9ad8 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.7;
  group.add(sea);

  const sand = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(136, 138, 1, 72), lam(0xf0d9a0, false)), false, true);
  sand.position.y = -0.55;
  group.add(sand);
  const grass = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(114, 116, 1, 72), lam(0x62c24c, false)), false, true);
  grass.position.y = -0.5;
  group.add(grass);

  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const d = 26 + rand() * 80;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(3 + rand() * 6, 16), lam(rand() > 0.5 ? 0x54b440 : 0x70d05a, false));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.cos(a) * d, 0.01 + i * 0.0005, Math.sin(a) * d);
    patch.receiveShadow = true;
    group.add(patch);
  }
  const yard = new THREE.Mesh(new THREE.CircleGeometry(21, 48), lam(0xc4a574, false));
  yard.rotation.x = -Math.PI / 2;
  yard.position.y = 0.03;
  yard.receiveShadow = true;
  group.add(yard);
  const yard2 = new THREE.Mesh(new THREE.RingGeometry(20.2, 21.6, 48), lam(0x8d7048, false));
  yard2.rotation.x = -Math.PI / 2;
  yard2.position.y = 0.04;
  group.add(yard2);

  const place = (minR: number, maxR: number, r: number): [number, number] | null => {
    for (let tries = 0; tries < 40; tries++) {
      const a = rand() * Math.PI * 2;
      const d = minR + rand() * (maxR - minR);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 1.5)) return [x, z];
    }
    return null;
  };

  const trunkMat = lam(0x7a5230);
  const leafMats = [lam(0x2f9e44), lam(0x37b24d), lam(0x2b8a3e)];
  for (let i = 0; i < 90; i++) {
    const p = place(26, 100, 1.2);
    if (!p) continue;
    const t = new THREE.Group();
    const h = 4 + rand() * 2;
    const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, h, 7), trunkMat));
    trunk.position.y = h / 2;
    t.add(trunk);
    if (rand() > 0.45) {
      for (let k = 0; k < 3; k++) {
        const c = shadowed(new THREE.Mesh(new THREE.ConeGeometry(3.2 - k * 0.8, 3.2, 7), leafMats[(i + k) % 3]));
        c.position.y = h - 0.5 + k * 1.9;
        t.add(c);
      }
    } else {
      const c = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rand(), 1), leafMats[i % 3]));
      c.position.y = h + 1.4;
      t.add(c);
    }
    t.position.set(p[0], 0, p[1]);
    t.rotation.y = rand() * 6;
    group.add(t);
    obstacles.push({ x: p[0], z: p[1], r: 1.1, h: h + 3 });
  }
  const rockMat = lam(0x8a8f98);
  for (let i = 0; i < 30; i++) {
    const p = place(25, 102, 2.5);
    if (!p) continue;
    const s = 1.4 + rand() * 1.8;
    const rock = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat));
    rock.position.set(p[0], s * 0.55, p[1]);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.scale.y = 0.8;
    group.add(rock);
    obstacles.push({ x: p[0], z: p[1], r: s * 0.95, h: s * 1.4 });
  }
  const wall = lam(0xb98a55);
  const roof = lam(0xa63d2f);
  for (let i = 0; i < 8; i++) {
    const p = place(34, 84, 4.5);
    if (!p) continue;
    const h = new THREE.Group();
    const w = shadowed(new THREE.Mesh(new THREE.BoxGeometry(6, 3.6, 6), wall));
    w.position.y = 1.8;
    h.add(w);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.1), lam(0x4a2f18));
    door.position.set(0, 1.2, 3.05);
    h.add(door);
    const r = shadowed(new THREE.Mesh(new THREE.ConeGeometry(5.2, 3, 4), roof));
    r.position.y = 5.1;
    r.rotation.y = Math.PI / 4;
    h.add(r);
    h.position.set(p[0], 0, p[1]);
    h.lookAt(0, 0, 0);
    group.add(h);
    obstacles.push({ x: p[0], z: p[1], r: 4.4, h: 6.5 });
  }
  const crateMat = lam(0x9c6b3a);
  for (let i = 0; i < 10; i++) {
    const p = place(23, 34, 1.2);
    if (!p) continue;
    const c = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), crateMat));
    c.position.set(p[0], 0.9, p[1]);
    c.rotation.y = rand() * 3;
    group.add(c);
    obstacles.push({ x: p[0], z: p[1], r: 1.3, h: 2.2 });
  }
  const board = new THREE.Group();
  const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), trunkMat));
  post.position.y = 2;
  const sign = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.3), lam(0xd9b36c)));
  sign.position.y = 3.6;
  board.add(post, sign);
  board.position.set(-10, 0, 12);
  board.rotation.y = 2.6;
  group.add(board);

  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand();
    const d = 280 + rand() * 80;
    const m = new THREE.Mesh(new THREE.ConeGeometry(30 + rand() * 30, 50 + rand() * 50, 6), lam(i % 2 ? 0x5d7f6a : 0x6b8a8a));
    m.position.set(Math.cos(a) * d, 10, Math.sin(a) * d);
    group.add(m);
  }
  const clouds = makeClouds(group, rand, 0xffffff, 14);

  return {
    name: 'Bandit Island',
    group,
    obstacles,
    radius: 98,
    env: DAY,
    update: (dt) => moveClouds(clouds, dt),
    dispose: () => disposeGroup(group),
  };
}

function makeClouds(group: THREE.Group, rand: () => number, color: number, n: number) {
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: 0x8899aa });
  for (let i = 0; i < n; i++) {
    const c = new THREE.Group();
    const k = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < k; j++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + rand() * 6, 0), cloudMat);
      s.position.set(j * 9 - k * 4, rand() * 3, rand() * 6);
      s.scale.y = 0.6;
      c.add(s);
    }
    c.position.set((rand() - 0.5) * 500, 60 + rand() * 30, (rand() - 0.5) * 500);
    group.add(c);
    clouds.push(c);
  }
  return clouds;
}
function moveClouds(clouds: THREE.Group[], dt: number) {
  for (const c of clouds) {
    c.position.x += dt * 2.5;
    if (c.position.x > 280) c.position.x = -280;
  }
}

// ---------------------------------------------------------------- natural arenas (island style, large)
interface Theme {
  name: string;
  seed: number;
  env: Env;
  ground: number;
  ground2: [number, number];
  rim: number;
  sea: number;
  yard: number;
  yardRing: number;
  tree: 'round' | 'pine' | 'cactus' | 'dead' | 'palm';
  leaf: number[];
  trunk: number;
  rock: number;
  ruins?: boolean;
  lava?: boolean;
  snow?: boolean;
  mesa?: number;
  mount: [number, number];
  cloud: number;
}

const THEMES: Theme[] = [
  {
    name: 'Whale Island Cove', seed: 11, env: DAY, ground: 0x62c24c, ground2: [0x54b440, 0x70d05a], rim: 0xf0d9a0, sea: 0x2b9ad8, yard: 0xc9b07c, yardRing: 0x8d7048,
    tree: 'palm', leaf: [0x2f9e44, 0x37b24d], trunk: 0x8a6238, rock: 0x8a8f98, mount: [0x5d7f6a, 0x6b8a8a], cloud: 0xffffff,
  },
  {
    name: 'Autumn Ridge', seed: 23, env: { sky: 0xf2b774, fog: 0xf0c08a, fogN: 120, fogF: 420, hemiS: 0xffe2b8, hemiG: 0x8a5a2a, hemiI: 1.9, sunC: 0xffd7a0, sunI: 2.5 },
    ground: 0x8a7a3a, ground2: [0x9a6a2a, 0x7a8a3a], rim: 0x5a4430, sea: 0x4a6a8a, yard: 0xa89060, yardRing: 0x6a5436,
    tree: 'round', leaf: [0xd9792a, 0xc9442a, 0xe0a030, 0xb8602a], trunk: 0x5a3a24, rock: 0x7a6a60, mount: [0x8a5a3a, 0x9a6a4a], cloud: 0xffe3c0,
  },
  {
    name: 'Frozen Plateau', seed: 37, env: { sky: 0xbfe0f5, fog: 0xd2e8f5, fogN: 100, fogF: 380, hemiS: 0xe8f4ff, hemiG: 0x9ab4c8, hemiI: 2.2, sunC: 0xf4fbff, sunI: 2.4 },
    ground: 0xeaf3fa, ground2: [0xd6e8f4, 0xf6fbff], rim: 0xb7d5e8, sea: 0x4a8ab8, yard: 0xd9ecf7, yardRing: 0x8ab6d0,
    tree: 'pine', leaf: [0x2b6a52, 0x347a5e], trunk: 0x4a3a2c, rock: 0x9ab8cc, snow: true, mount: [0xc8dcea, 0xaac4d8], cloud: 0xf4faff,
  },
  {
    name: 'Desert Ruins', seed: 51, env: { sky: 0xf6c58a, fog: 0xf2c48c, fogN: 120, fogF: 420, hemiS: 0xffe6c0, hemiG: 0xc08a50, hemiI: 2.0, sunC: 0xffe0b0, sunI: 2.8 },
    ground: 0xe4be78, ground2: [0xd8aa62, 0xf0cc8a], rim: 0xcf9f5c, sea: 0xd8aa62, yard: 0xd8b476, yardRing: 0x9a7a46,
    tree: 'cactus', leaf: [0x3a8a4a, 0x2f7a40], trunk: 0x3a8a4a, rock: 0xb08a5a, ruins: true, mesa: 0xb7683c, mount: [0xb8744a, 0xc8864e], cloud: 0xfff0d8,
  },
  {
    name: 'Ashen Wastes', seed: 67, env: { sky: 0x4a2a2a, fog: 0x4a2c2c, fogN: 90, fogF: 360, hemiS: 0xff9a6a, hemiG: 0x3a2020, hemiI: 1.6, sunC: 0xff9a5a, sunI: 2.0 },
    ground: 0x3a3438, ground2: [0x2c2628, 0x4a4246], rim: 0x221c1e, sea: 0xff5a1a, yard: 0x4a4044, yardRing: 0xff7a2a,
    tree: 'dead', leaf: [0x2a2224], trunk: 0x2a2224, rock: 0x4a4248, lava: true, mount: [0x3a2a2a, 0x4a3030], cloud: 0x6a4a4a,
  },
];

export function buildNatural(index: number): World {
  const T = THEMES[index % THEMES.length];
  const group = new THREE.Group();
  const rand = rng(T.seed * 977);
  const obstacles: Obstacle[] = [];
  const R = 84;

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: T.sea, emissive: T.lava ? 0xff4a10 : 0x000000, emissiveIntensity: T.lava ? 0.8 : 0 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.8;
  group.add(sea);
  const rim = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(150, 152, 1, 72), lam(T.rim, false)), false, true);
  rim.position.y = -0.55;
  group.add(rim);
  const ground = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(128, 130, 1, 72), lam(T.ground, false)), false, true);
  ground.position.y = -0.5;
  group.add(ground);
  for (let i = 0; i < 80; i++) {
    const a = rand() * Math.PI * 2;
    const d = 20 + rand() * 105;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(3 + rand() * 7, 16), lam(T.ground2[rand() > 0.5 ? 0 : 1], false));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.cos(a) * d, 0.01 + i * 0.0005, Math.sin(a) * d);
    patch.receiveShadow = true;
    group.add(patch);
  }
  const yard = new THREE.Mesh(new THREE.CircleGeometry(62, 64), lam(T.yard, false));
  yard.rotation.x = -Math.PI / 2;
  yard.position.y = 0.03;
  yard.receiveShadow = true;
  group.add(yard);
  const ringM = new THREE.MeshBasicMaterial({ color: T.yardRing, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(61, 62.8, 64), ringM);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(R - 0.5, R + 0.4, 64), ringM);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.045;
  group.add(ring2);

  const place = (minR: number, maxR: number, r: number): [number, number] | null => {
    for (let tries = 0; tries < 50; tries++) {
      const a = rand() * Math.PI * 2;
      const d = minR + rand() * (maxR - minR);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 3)) return [x, z];
    }
    return null;
  };

  const trunkMat = lam(T.trunk);
  const leafMats = T.leaf.map((c) => lam(c));
  const makeTree = (x: number, z: number, i: number) => {
    const t = new THREE.Group();
    const h = 4 + rand() * 3;
    if (T.tree === 'cactus') {
      const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, h + 1, 8), leafMats[0]));
      body.position.y = (h + 1) / 2;
      t.add(body);
      for (const s of [-1, 1]) {
        const arm = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 7), leafMats[1]));
        arm.position.set(s * 1.1, h * 0.55 + (s > 0 ? 0.5 : 0), 0);
        t.add(arm);
        const up = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 7), leafMats[1]));
        up.position.set(s * 1.5, h * 0.55 + 1.3 + (s > 0 ? 0.5 : 0), 0);
        t.add(up);
      }
    } else if (T.tree === 'dead') {
      const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.7, h + 1, 6), trunkMat));
      trunk.position.y = (h + 1) / 2;
      t.add(trunk);
      for (let k = 0; k < 3; k++) {
        const br = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 2.6, 5), trunkMat));
        br.position.set(Math.cos(k * 2.1) * 0.8, h - 0.5 + k * 0.5, Math.sin(k * 2.1) * 0.8);
        br.rotation.set(Math.sin(k * 2.1) * 0.9, 0, -Math.cos(k * 2.1) * 0.9);
        t.add(br);
      }
    } else {
      const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, h, 7), trunkMat));
      trunk.position.y = h / 2;
      t.add(trunk);
      if (T.tree === 'pine') {
        for (let k = 0; k < 4; k++) {
          const c = shadowed(new THREE.Mesh(new THREE.ConeGeometry(3.4 - k * 0.7, 3.2, 7), leafMats[(i + k) % leafMats.length]));
          c.position.y = h - 0.8 + k * 1.8;
          t.add(c);
          if (T.snow) {
            const sn = new THREE.Mesh(new THREE.ConeGeometry(3.0 - k * 0.7, 1.2, 7), lam(0xffffff));
            sn.position.y = h - 0.1 + k * 1.8 + 0.5;
            t.add(sn);
          }
        }
      } else if (T.tree === 'palm') {
        for (let k = 0; k < 6; k++) {
          const leaf = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 3.6), leafMats[k % 2]));
          leaf.position.set(Math.cos(k * 1.05) * 1.5, h + 0.2, Math.sin(k * 1.05) * 1.5);
          leaf.rotation.y = -k * 1.05 + Math.PI / 2;
          leaf.rotation.x = 0.4;
          t.add(leaf);
        }
      } else {
        const c = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rand(), 1), leafMats[i % leafMats.length]));
        c.position.y = h + 1.4;
        t.add(c);
      }
    }
    t.position.set(x, 0, z);
    t.rotation.y = rand() * 6;
    group.add(t);
  };

  // collidable scatter inside the arena (cover to play around)
  for (let i = 0; i < 26; i++) {
    const p = place(15, R - 4, 1.2);
    if (!p) continue;
    makeTree(p[0], p[1], i);
    obstacles.push({ x: p[0], z: p[1], r: T.tree === 'cactus' ? 1.1 : 1.0, h: T.tree === 'palm' ? 7 : T.tree === 'cactus' ? 6 : 8 });
  }
  const rockMat = lam(T.rock);
  for (let i = 0; i < 22; i++) {
    const p = place(14, R - 3, 2.4);
    if (!p) continue;
    const s = 1.4 + rand() * 2;
    const rock = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat));
    rock.position.set(p[0], s * 0.55, p[1]);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.scale.y = 0.85;
    group.add(rock);
    obstacles.push({ x: p[0], z: p[1], r: s * 0.95, h: s * 1.4 });
  }
  if (T.ruins) {
    const stone = lam(0xc9a977);
    for (let i = 0; i < 13; i++) {
      const p = place(16, R - 5, 1.6);
      if (!p) continue;
      const h = 3 + rand() * 5;
      const col = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, h, 8), stone));
      col.position.set(p[0], h / 2, p[1]);
      group.add(col);
      const cap = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 3.2), stone));
      cap.position.set(p[0], h + 0.3, p[1]);
      cap.rotation.y = rand();
      group.add(cap);
      obstacles.push({ x: p[0], z: p[1], r: 1.6, h: h + 0.6 });
    }
  }
  if (T.lava) {
    const lav = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand();
      const pool = new THREE.Mesh(new THREE.CircleGeometry(3 + rand() * 4, 14), lav);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(Math.cos(a) * (R + 4 + rand() * 12), 0.06, Math.sin(a) * (R + 4 + rand() * 12));
      group.add(pool);
    }
  }
  // decorative scenery outside the fight ring
  for (let i = 0; i < 130; i++) {
    const a = rand() * Math.PI * 2;
    const d = R + 4 + rand() * 40;
    makeTree(Math.cos(a) * d, Math.sin(a) * d, i);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand();
    const d = 300 + rand() * 80;
    const m = new THREE.Mesh(new THREE.ConeGeometry(30 + rand() * 30, 50 + rand() * 60, 6), lam(T.mount[i % 2]));
    m.position.set(Math.cos(a) * d, 10, Math.sin(a) * d);
    group.add(m);
  }
  if (T.mesa) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand();
      const d = 190 + rand() * 50;
      const w = 18 + rand() * 18;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.8, w, 30 + rand() * 20, 8), lam(T.mesa));
      mesa.position.set(Math.cos(a) * d, 14, Math.sin(a) * d);
      group.add(mesa);
    }
  }
  const clouds = makeClouds(group, rand, T.cloud, 12);

  return {
    name: T.name, group, obstacles, radius: R, env: T.env,
    update: (dt, time) => {
      moveClouds(clouds, dt);
      if (T.lava) (sea.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.7 + Math.sin(time * 2) * 0.15;
    },
    dispose: () => disposeGroup(group),
  };
}

// ---------------------------------------------------------------- city plaza
function windowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2e3c';
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 5; x++) {
      g.fillStyle = Math.random() > 0.45 ? '#ffd98a' : '#3a4256';
      g.fillRect(4 + x * 12, 4 + y * 10, 8, 6);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCity(): World {
  const group = new THREE.Group();
  const rand = rng(4242);
  const obstacles: Obstacle[] = [];
  const R = 80;
  const ground = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(124, 126, 1, 72), lam(0x3a3d48, false)), false, true);
  ground.position.y = -0.5;
  group.add(ground);
  const pave = new THREE.Mesh(new THREE.CircleGeometry(R + 2, 64), lam(0x5a5e6c, false));
  pave.rotation.x = -Math.PI / 2;
  pave.position.y = 0.02;
  pave.receiveShadow = true;
  group.add(pave);
  const lineM = new THREE.MeshBasicMaterial({ color: 0xe8d36a, side: THREE.DoubleSide });
  for (const [a, b] of [[R - 1, R], [46, 46.8], [16, 16.8]]) {
    const r = new THREE.Mesh(new THREE.RingGeometry(a, b, 64), lineM);
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.04;
    group.add(r);
  }
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 34), lineM);
    l.rotation.x = -Math.PI / 2;
    l.rotation.z = (i * Math.PI) / 8;
    l.position.y = 0.035;
    group.add(l);
  }
  const wt = windowTexture();
  const bm: THREE.MeshLambertMaterial[] = [];
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const d = R + 12 + rand() * 22;
    const w = 12 + rand() * 10;
    const h = 24 + rand() * 60;
    const tex = wt.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 12)));
    const m = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffc870, emissiveMap: tex, emissiveIntensity: 0.55, color: new THREE.Color().setHSL(0.6 + rand() * 0.1, 0.15, 0.55) });
    bm.push(m);
    const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m));
    b.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    b.rotation.y = -a;
    group.add(b);
  }
  // plaza cover: planters, cars, fountains, lamps
  const carCols = [0xc0392b, 0x2c6fbb, 0xe0b030, 0x444a58];
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const d = 14 + rand() * 56;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 5)) continue;
    const car = new THREE.Group();
    const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 4.4), lam(carCols[i % 4])));
    body.position.y = 0.7;
    const cab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 2.2), lam(0x20242c)));
    cab.position.set(0, 1.5, -0.2);
    car.add(body, cab);
    for (const [wx, wz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), lam(0x111111));
      w.rotation.z = Math.PI / 2;
      w.position.set(wx * 1.1, 0.45, wz);
      car.add(w);
    }
    car.position.set(x, 0, z);
    car.rotation.y = rand() * 3;
    group.add(car);
    obstacles.push({ x, z, r: 2.3, h: 2.6 });
  }
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 8, 6), lam(0x2a2d36)));
    pole.position.set(Math.cos(a) * (R - 2), 4, Math.sin(a) * (R - 2));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), lampM);
    lamp.position.set(Math.cos(a) * (R - 2), 8.3, Math.sin(a) * (R - 2));
    group.add(pole, lamp);
  }
  const fountain = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 1.2, 20), lam(0x9a9fb0)));
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 20), new THREE.MeshBasicMaterial({ color: 0x6ac8ff }));
  water.position.set(0, 1.2, 0);
  group.add(water);
  obstacles.push({ x: 0, z: 0, r: 3.6, h: 3 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const d = 30 + (i % 2) * 14;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 5)) continue;
    const hh = 9 + (i % 3) * 2;
    const tw = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, hh, 8), lam(0x6a6f82)));
    tw.position.set(x, hh / 2, z);
    group.add(tw);
    obstacles.push({ x, z, r: 2.1, h: hh });
  }
  // stars
  const sp: number[] = [];
  for (let i = 0; i < 500; i++) {
    const a = rand() * Math.PI * 2;
    const e = 0.2 + rand() * 1.2;
    sp.push(Math.cos(a) * Math.cos(e) * 400, Math.sin(e) * 400, Math.sin(a) * Math.cos(e) * 400);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  group.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));

  return {
    name: 'Yorknew Plaza',
    group, obstacles, radius: R,
    env: { sky: 0x1a1838, fog: 0x2a2048, fogN: 110, fogF: 420, hemiS: 0x9a8fe0, hemiG: 0x3a3550, hemiI: 1.8, sunC: 0xc8c0ff, sunI: 1.7 },
    update: (_dt, time) => {
      bm.forEach((m, i) => (m.emissiveIntensity = 0.5 + Math.sin(time * 0.6 + i) * 0.05));
      water.position.y = 1.2 + Math.sin(time * 3) * 0.03;
    },
    dispose: () => disposeGroup(group),
  };
}

// ---------------------------------------------------------------- heavens arena (bigger)
function stoneTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a8798';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const v = 120 + ((x + y) % 2) * 22 + Math.random() * 10;
      g.fillStyle = `rgb(${v},${v - 4},${v + 14})`;
      g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHeavens(): World {
  const group = new THREE.Group();
  const rand = rng(777);
  const FR = 76;
  const floor = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(FR, FR, 1, 64), new THREE.MeshLambertMaterial({ map: stoneTexture() })), false, true);
  floor.position.y = -0.5;
  group.add(floor);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a94a, side: THREE.DoubleSide });
  for (const [a, b] of [[FR - 4.5, FR - 3.8], [32, 32.7], [10, 10.7]]) {
    const r = new THREE.Mesh(new THREE.RingGeometry(a, b, 64), ringMat);
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.03;
    group.add(r);
  }
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.5, FR * 2 - 10), ringMat);
    l.rotation.x = -Math.PI / 2;
    l.rotation.z = (i * Math.PI) / 4;
    l.position.y = 0.025;
    group.add(l);
  }
  const R = [FR, FR + 5, FR + 10, FR + 15, FR + 20];
  const H = [2.5, 5, 7.5, 10];
  const standMat = new THREE.MeshLambertMaterial({ color: 0x4b4660, side: THREE.BackSide });
  const stepMat = new THREE.MeshLambertMaterial({ color: 0x6a6480, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(R[k], R[k], H[k], 64, 1, true), standMat);
    w.position.y = H[k] / 2;
    group.add(w);
    const step = new THREE.Mesh(new THREE.RingGeometry(R[k], R[k + 1], 64), stepMat);
    step.rotation.x = -Math.PI / 2;
    step.position.y = H[k];
    group.add(step);
  }
  const rows: { r: number; y: number }[] = [];
  for (let k = 0; k < 4; k++) rows.push({ r: R[k] + 1.3, y: H[k] }, { r: R[k] + 3.6, y: H[k] });
  let count = 0;
  const perRow = rows.map((row) => {
    const n = Math.floor((2 * Math.PI * row.r) / 1.5);
    count += n;
    return n;
  });
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.2, 0.6), new THREE.MeshLambertMaterial(), count);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), new THREE.MeshLambertMaterial(), count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let idx = 0;
  const palette = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xffffff];
  rows.forEach((row, ri) => {
    for (let i = 0; i < perRow[ri]; i++) {
      const a = (i / perRow[ri]) * Math.PI * 2 + ri * 0.3;
      const x = Math.cos(a) * row.r;
      const z = Math.sin(a) * row.r;
      q.setFromEuler(new THREE.Euler(0, Math.atan2(-x, -z), 0));
      const hOff = rand() * 0.25;
      m4.compose(new THREE.Vector3(x, row.y + 0.6 + hOff, z), q, new THREE.Vector3(1, 1, 1));
      bodies.setMatrixAt(idx, m4);
      m4.compose(new THREE.Vector3(x, row.y + 1.55 + hOff, z), q, new THREE.Vector3(1, 1, 1));
      heads.setMatrixAt(idx, m4);
      bodies.setColorAt(idx, col.setHex(palette[Math.floor(rand() * palette.length)]));
      heads.setColorAt(idx, col.setHex([0xf6c9a0, 0xd49a6a, 0xfbe3d0, 0x8d5a3a][Math.floor(rand() * 4)]));
      idx++;
    }
  });
  group.add(bodies, heads);

  const flames: THREE.Mesh[] = [];
  const pillarMat = lam(0x5a566e);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a2e });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = Math.cos(a) * (FR - 1);
    const z = Math.sin(a) * (FR - 1);
    const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 6, 1.6), pillarMat));
    p.position.set(x, 3, z);
    group.add(p);
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), flameMat);
    f.position.set(x, 6.8, z);
    group.add(f);
    flames.push(f);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const l = new THREE.PointLight(0xffa24a, 700, 120, 2);
    l.position.set(Math.cos(a) * 56, 8, Math.sin(a) * 56);
    group.add(l);
  }
  const barrier = new THREE.Mesh(
    new THREE.CylinderGeometry(FR - 2.5, FR - 2.5, 9, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  barrier.position.y = 4.5;
  group.add(barrier);
  // broken pillars for cover
  const obstacles: Obstacle[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.5;
    const d = i % 2 ? 40 : 24;
    const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 5 + (i % 3), 8), lam(0x6a6580)));
    p.position.set(Math.cos(a) * d, 2.6, Math.sin(a) * d);
    group.add(p);
    obstacles.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 1.7, h: 5.5 + (i % 3) });
  }
  const starGeo = new THREE.BufferGeometry();
  const sp: number[] = [];
  for (let i = 0; i < 700; i++) {
    const a = rand() * Math.PI * 2;
    const e = 0.15 + rand() * 1.2;
    sp.push(Math.cos(a) * Math.cos(e) * 400, Math.sin(e) * 400, Math.sin(a) * Math.cos(e) * 400);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  moon.position.set(-160, 190, -260);
  group.add(moon);

  return {
    name: 'Heavens Arena', group, obstacles, radius: FR - 3,
    env: { sky: 0x0b0820, fog: 0x140c30, fogN: 110, fogF: 420, hemiS: 0x8f95e0, hemiG: 0x3a3550, hemiI: 1.9, sunC: 0xb8c4ff, sunI: 1.8 },
    update: (_dt, time) => {
      flames.forEach((f, i) => {
        const s = 1 + Math.sin(time * 9 + i) * 0.2;
        f.scale.set(s, 1.3 * s, s);
      });
    },
    dispose: () => disposeGroup(group),
  };
}

export const ARENA_COUNT = THEMES.length + 2;
export function buildArena(i: number): World {
  if (i === 0) return buildHeavens();
  if (i === 1) return buildCity();
  return buildNatural(i - 2);
}
