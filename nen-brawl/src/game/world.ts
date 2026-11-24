import * as THREE from 'three';

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export interface World {
  group: THREE.Group;
  obstacles: Obstacle[];
  radius: number; // walkable radius
  update: (dt: number, time: number) => void;
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

export function buildIsland(): World {
  const group = new THREE.Group();
  const rand = rng(1337);
  const obstacles: Obstacle[] = [];

  // sea
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: 0x2b9ad8 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.7;
  group.add(sea);

  // sand + grass
  const sand = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(86, 88, 1, 64), lam(0xf0d9a0, false)), false, true);
  sand.position.y = -0.55;
  group.add(sand);
  const grass = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(70, 72, 1, 64), lam(0x62c24c, false)), false, true);
  grass.position.y = -0.5;
  group.add(grass);

  // grass patches
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const d = 26 + rand() * 40;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(3 + rand() * 6, 16), lam(rand() > 0.5 ? 0x54b440 : 0x70d05a, false));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.cos(a) * d, 0.01 + i * 0.0005, Math.sin(a) * d);
    patch.receiveShadow = true;
    group.add(patch);
  }
  // dirt yard (fight zone)
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

  // trees
  const trunkMat = lam(0x7a5230);
  const leafMats = [lam(0x2f9e44), lam(0x37b24d), lam(0x2b8a3e)];
  for (let i = 0; i < 46; i++) {
    const p = place(26, 64, 1.2);
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
    obstacles.push({ x: p[0], z: p[1], r: 1.1 });
  }

  // rocks
  const rockMat = lam(0x8a8f98);
  for (let i = 0; i < 16; i++) {
    const p = place(25, 66, 2.5);
    if (!p) continue;
    const s = 1.4 + rand() * 1.8;
    const rock = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat));
    rock.position.set(p[0], s * 0.55, p[1]);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.scale.y = 0.8;
    group.add(rock);
    obstacles.push({ x: p[0], z: p[1], r: s * 0.95 });
  }

  // huts (bandit camp)
  const wall = lam(0xb98a55);
  const roof = lam(0xa63d2f);
  for (let i = 0; i < 4; i++) {
    const p = place(30, 52, 4.5);
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
    obstacles.push({ x: p[0], z: p[1], r: 4.4 });
  }

  // barrels / crates near the yard edge (decor, no collision except crates)
  const crateMat = lam(0x9c6b3a);
  for (let i = 0; i < 6; i++) {
    const p = place(23, 30, 1.2);
    if (!p) continue;
    const c = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), crateMat));
    c.position.set(p[0], 0.9, p[1]);
    c.rotation.y = rand() * 3;
    group.add(c);
    obstacles.push({ x: p[0], z: p[1], r: 1.3 });
  }

  // quest board (decor, no collision)
  const board = new THREE.Group();
  const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), trunkMat));
  post.position.y = 2;
  const sign = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.3), lam(0xd9b36c)));
  sign.position.y = 3.6;
  board.add(post, sign);
  board.position.set(-10, 0, 12);
  board.rotation.y = 2.6;
  group.add(board);

  // distant mountains
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand();
    const d = 190 + rand() * 60;
    const m = new THREE.Mesh(new THREE.ConeGeometry(30 + rand() * 30, 50 + rand() * 50, 6), lam(i % 2 ? 0x5d7f6a : 0x6b8a8a));
    m.position.set(Math.cos(a) * d, 10, Math.sin(a) * d);
    group.add(m);
  }

  // clouds
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x8899aa });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + rand() * 6, 0), cloudMat);
      s.position.set(k * 9 - n * 4, rand() * 3, rand() * 6);
      s.scale.y = 0.6;
      c.add(s);
    }
    c.position.set((rand() - 0.5) * 500, 60 + rand() * 30, (rand() - 0.5) * 500);
    group.add(c);
    clouds.push(c);
  }

  return {
    group,
    obstacles,
    radius: 62,
    update: (dt) => {
      for (const c of clouds) {
        c.position.x += dt * 2.5;
        if (c.position.x > 280) c.position.x = -280;
      }
    },
  };
}

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
  t.repeat.set(10, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildArena(): World {
  const group = new THREE.Group();
  const rand = rng(777);

  const floor = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(32, 32, 1, 64), new THREE.MeshLambertMaterial({ map: stoneTexture() })),
    false,
    true
  );
  floor.position.y = -0.5;
  group.add(floor);
  // sigil rings
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a94a, side: THREE.DoubleSide });
  for (const [a, b] of [
    [27.5, 28.2],
    [13.5, 14],
    [4.5, 5],
  ]) {
    const r = new THREE.Mesh(new THREE.RingGeometry(a, b, 64), ringMat);
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.03;
    group.add(r);
  }
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 27), ringMat);
    l.rotation.x = -Math.PI / 2;
    l.rotation.z = (i * Math.PI) / 4;
    l.position.y = 0.025;
    group.add(l);
  }

  // stands
  const R = [32, 37, 42, 47, 52];
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
  // crowd
  const rows: { r: number; y: number }[] = [];
  for (let k = 0; k < 4; k++) {
    rows.push({ r: R[k] + 1.3, y: H[k] }, { r: R[k] + 3.6, y: H[k] });
  }
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

  // pillars + flames
  const flames: THREE.Mesh[] = [];
  const pillarMat = lam(0x5a566e);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a2e });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * 31;
    const z = Math.sin(a) * 31;
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
    const l = new THREE.PointLight(0xffa24a, 400, 70, 2);
    l.position.set(Math.cos(a) * 28, 8, Math.sin(a) * 28);
    group.add(l);
  }

  // energy barrier
  const barrier = new THREE.Mesh(
    new THREE.CylinderGeometry(29.5, 29.5, 9, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  barrier.position.y = 4.5;
  group.add(barrier);

  // stars + moon
  const starGeo = new THREE.BufferGeometry();
  const sp: number[] = [];
  for (let i = 0; i < 700; i++) {
    const a = rand() * Math.PI * 2;
    const e = 0.15 + rand() * 1.2;
    const d = 400;
    sp.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
  group.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  moon.position.set(-160, 190, -260);
  group.add(moon);

  return {
    group,
    obstacles: [],
    radius: 29,
    update: (_dt, time) => {
      flames.forEach((f, i) => {
        const s = 1 + Math.sin(time * 9 + i) * 0.2;
        f.scale.set(s, 1.3 * s, s);
      });
    },
  };
}
