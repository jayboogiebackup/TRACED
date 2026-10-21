import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { label, smudge } from './textures.js';
import { DESK_Y } from './basement.js';

// Everything you buy shows up in the room: mining hardware with spinning fans and
// blinking LEDs, cooling, cash on the desk, a cooler on the floor...

const fanTex = label(128, 128, (ctx) => {
  ctx.clearRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  for (let i = 0; i < 9; i++) {
    ctx.save();
    ctx.rotate((i / 9) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.quadraticCurveTo(40, -24, 58, -6);
    ctx.quadraticCurveTo(40, 6, 10, 6);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#888';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('NVDUH', 0, 3);
});
const fanMat = new THREE.MeshStandardMaterial({ map: fanTex, transparent: true, roughness: 0.6, alphaTest: 0.05 });

// LED materials blink on different rhythms; each LED grabs one at random
const LED_COLORS = [0x6dff8a, 0x6dff8a, 0x6dff8a, 0x5ab4ff, 0xffb347, 0xff4d4d];
const ledMats = Array.from({ length: 12 }, (_, i) => new THREE.MeshBasicMaterial({ color: LED_COLORS[i % LED_COLORS.length], toneMapped: false }));
const ledGeo = new THREE.PlaneGeometry(0.006, 0.004);

const metal = new THREE.MeshStandardMaterial({ color: 0x8d9196, roughness: 0.35, metalness: 0.9, roughnessMap: smudge(2) });
const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.5 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.8 });
const pcb = new THREE.MeshStandardMaterial({ color: 0x1f3a24, roughness: 0.6 });
const stripMat = new THREE.MeshBasicMaterial({ color: 0x8a6dff, toneMapped: false });

function fan(r) {
  const f = new THREE.Mesh(new THREE.CircleGeometry(r, 24), fanMat);
  f.userData.spin = 18 + Math.random() * 8;
  return f;
}
function led(x, y, z, parent, ry = 0) {
  const l = new THREE.Mesh(ledGeo, ledMats[(Math.random() * ledMats.length) | 0]);
  l.position.set(x, y, z);
  l.rotation.y = ry;
  parent.add(l);
  return l;
}

// ───────── builders (each returns a Group standing on y=0, facing +z) ─────────
function buildEGPU() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.09, 0.2, 2, 0.006), darkMetal);
  b.position.y = 0.045;
  g.add(b);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.06), blackPlastic);
  grille.position.set(0, 0.045, 0.1005);
  g.add(grille);
  const f = fan(0.028);
  f.position.set(0, 0.045, 0.101);
  g.add(f);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.0025, 0.07), stripMat);
  s.position.set(0.0556, 0.045, 0.05);
  s.rotation.y = Math.PI / 2;
  g.add(s);
  led(-0.04, 0.08, 0.1006, g);
  return g;
}

function buildGPU() {
  // a graphics card lying on its back with three fans up
  const g = new THREE.Group();
  const shroud = new THREE.Mesh(new RoundedBoxGeometry(0.31, 0.045, 0.125, 2, 0.008), darkMetal);
  shroud.position.y = 0.0225;
  g.add(shroud);
  for (let i = -1; i <= 1; i++) {
    const f = fan(0.042);
    f.rotation.x = -Math.PI / 2;
    f.position.set(i * 0.098, 0.0455, 0);
    g.add(f);
  }
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.004), stripMat);
  strip.position.set(0, 0.03, 0.0631);
  g.add(strip);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.12), metal);
  bracket.position.set(-0.157, 0.025, 0);
  g.add(bracket);
  return g;
}

function buildRig() {
  // open-air aluminium frame, six cards standing in a row, PSU underneath
  const g = new THREE.Group();
  const W = 0.62, H = 0.42, D = 0.3;
  const bar = (x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), metal);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) bar(x, H / 2, z, 0.018, H, 0.018);
  for (const y of [0.02, 0.2, H]) {
    bar(0, y, -D / 2, W, 0.018, 0.018);
    bar(0, y, D / 2, W, 0.018, 0.018);
  }
  const mobo = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.24), pcb);
  mobo.position.set(0, 0.2, 0);
  g.add(mobo);
  const psu = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.15), blackPlastic);
  psu.position.set(0.18, 0.065, 0);
  g.add(psu);
  for (let i = 0; i < 6; i++) {
    const x = -W / 2 + 0.06 + i * 0.1;
    const card = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.12, 0.26, 1, 0.004), darkMetal);
    card.add(body);
    for (const z of [-0.07, 0.05]) {
      const f = fan(0.036);
      f.rotation.y = Math.PI / 2;
      f.position.set(0.0205, 0, z);
      card.add(f);
    }
    led(0.021, 0.05, 0.12, card, Math.PI / 2);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.003), stripMat);
    st.rotation.y = Math.PI / 2;
    st.position.set(0.0206, -0.058, 0);
    card.add(st);
    card.position.set(x, H - 0.08 + 0.02, 0);
    g.add(card);
  }
  return g;
}

function buildASIC() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.3), metal);
  b.position.y = 0.075;
  b.castShadow = true;
  g.add(b);
  for (const z of [0.1505, -0.1505]) {
    const f = fan(0.062);
    f.position.set(0, 0.075, z);
    if (z < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  const lab = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.05),
    new THREE.MeshStandardMaterial({
      map: label(256, 96, (ctx) => {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(0, 0, 256, 96);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 36px Arial';
        ctx.fillText('ANTMINER', 14, 44);
        ctx.font = '24px Arial';
        ctx.fillText('S19 // 95TH', 14, 80);
      }),
    }),
  );
  lab.rotation.y = Math.PI / 2;
  lab.position.set(0.1005, 0.08, 0);
  g.add(lab);
  for (let i = 0; i < 3; i++) led(0.1006, 0.13, -0.1 + i * 0.03, g, Math.PI / 2);
  return g;
}

function buildRack() {
  const g = new THREE.Group();
  const W = 0.6, H = 1.9, D = 0.8;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), blackPlastic);
  frame.position.y = H / 2;
  frame.castShadow = true;
  g.add(frame);
  // servers: dark faces with dense LED rows
  for (let u = 0; u < 14; u++) {
    const y = 0.15 + u * 0.12;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, 0.1), darkMetal);
    face.position.set(0, y, D / 2 + 0.002);
    g.add(face);
    const n = 3 + ((Math.random() * 6) | 0);
    for (let i = 0; i < n; i++) led(-0.22 + i * 0.022, y + 0.02, D / 2 + 0.004, g);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.004), u % 3 ? stripMat : ledMats[0]);
    st.position.set(0.16, y - 0.025, D / 2 + 0.004);
    g.add(st);
  }
  // smoked glass door
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.02, H - 0.04),
    new THREE.MeshPhysicalMaterial({ color: 0x222831, roughness: 0.05, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false }),
  );
  glass.position.set(0, H / 2, D / 2 + 0.03);
  g.add(glass);
  return g;
}

function buildBoxFan() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.12, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.6 }));
  frame.position.y = 0.27;
  g.add(frame);
  const f = fan(0.21);
  f.position.set(0, 0.27, 0.061);
  f.userData.spin = 10;
  g.add(f);
  const grill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.44),
    new THREE.MeshStandardMaterial({
      transparent: true,
      roughness: 0.4,
      metalness: 0.8,
      color: 0x999999,
      map: label(256, 256, (ctx) => {
        ctx.clearRect(0, 0, 256, 256);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (let r = 20; r < 128; r += 14) {
          ctx.beginPath();
          ctx.arc(128, 128, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          ctx.moveTo(128, 128);
          ctx.lineTo(128 + Math.cos(i / 1.91) * 128, 128 + Math.sin(i / 1.91) * 128);
          ctx.stroke();
        }
      }),
    }),
  );
  grill.position.set(0, 0.27, 0.0625);
  g.add(grill);
  const feet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.2), blackPlastic);
  feet.position.y = 0.015;
  g.add(feet);
  return g;
}

function buildCooler() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.85 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.28, 0.3, 2, 0.02), white);
  body.position.y = 0.14;
  body.castShadow = true;
  g.add(body);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.05, 0.32, 2, 0.02), white);
  lid.position.y = 0.3;
  g.add(lid);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.17),
    new THREE.MeshStandardMaterial({
      map: label(512, 256, (ctx) => {
        ctx.fillStyle = '#eee';
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = '#b11';
        ctx.fillRect(20, 20, 472, 216);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 54px Arial';
        ctx.fillText('HUMAN ORGAN', 256, 100);
        ctx.font = 'bold 40px Arial';
        ctx.fillText('FOR TRANSPLANT', 256, 160);
        ctx.font = '26px Arial';
        ctx.fillText('KEEP COLD · DO NOT OPEN', 256, 210);
      }),
    }),
  );
  sign.position.set(0, 0.15, 0.1505);
  g.add(sign);
  return g;
}

function buildCash() {
  const g = new THREE.Group();
  const bill = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    map: label(256, 128, (ctx) => {
      ctx.fillStyle = '#8fa483';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#4c5f44';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, 240, 112);
      ctx.fillStyle = '#4c5f44';
      ctx.beginPath();
      ctx.ellipse(128, 64, 30, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 28px Georgia';
      ctx.fillText('100', 20, 44);
      ctx.fillText('100', 190, 112);
    }),
  });
  const band = new THREE.MeshStandardMaterial({ color: 0xd9c38a, roughness: 0.7 });
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.156, 0.022, 0.067), [bill, bill, bill, bill, bill, bill]);
  stack.position.y = 0.011;
  stack.castShadow = true;
  g.add(stack);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.0225, 0.0675), band);
  b.position.y = 0.011;
  g.add(b);
  return g;
}

function buildPackage() {
  const g = new THREE.Group();
  const tape = new THREE.MeshStandardMaterial({ color: 0x9e9078, roughness: 0.5, roughnessMap: smudge(1) });
  const brick = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.06, 0.11, 2, 0.012), tape);
  brick.position.y = 0.03;
  brick.castShadow = true;
  g.add(brick);
  const stamp = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.05),
    new THREE.MeshBasicMaterial({
      transparent: true,
      color: 0x772222,
      map: label(128, 80, (ctx) => {
        ctx.clearRect(0, 0, 128, 80);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.strokeRect(6, 6, 116, 68);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 26px Arial';
        ctx.fillText('☠ 7', 30, 50);
      }),
    }),
  );
  stamp.rotation.x = -Math.PI / 2;
  stamp.position.y = 0.0605;
  g.add(stamp);
  return g;
}

const BUILDERS = { egpu: buildEGPU, gpu: buildGPU, rig: buildRig, asic: buildASIC, rack: buildRack, boxfan: buildBoxFan, cooler: buildCooler, cash: buildCash, pkg: buildPackage };

// where each kind of thing goes, in order
const D = DESK_Y;
const SLOTS = {
  egpu: [
    [0.36, D, -0.74, -0.25],
    [0.5, D, -0.76, -0.35],
    [0.63, D, -0.9, -0.5],
  ],
  gpu: [
    [-0.33, D, -0.9, 0.1],
    [0.2, D, -0.93, -0.05],
    [-0.31, D + 0.045, -0.9, 0.18],
    [0.21, D + 0.045, -0.94, -0.1],
  ],
  rig: [
    [1.05, 0, -0.85, -0.25],
    [1.12, 0, -0.1, -0.9],
    [-1.05, 0, -1.1, 0.3],
  ],
  asic: [
    [-0.95, 0, -0.55, 0.6],
    [-0.95, 0.15, -0.55, 0.62],
    [-0.95, 0.3, -0.55, 0.58],
    [-1.2, 0, -0.2, 0.9],
    [-1.2, 0.15, -0.2, 0.92],
    [-0.55, 0.315, -1.48, 0],
  ],
  rack: [
    [1.35, 0, -1.28, -0.15],
    [2.05, 0, -0.25, -Math.PI / 2],
    [2.05, 0, 0.55, -Math.PI / 2],
  ],
  boxfan: [
    [0.82, 0, -0.5, -0.9],
    [-0.82, 0, -0.42, 0.9],
    [0.62, 0, 0.75, -2.4],
  ],
  cooler: [[-0.62, 0, 0.05, 0.4]],
  pkg: [
    [-1.4, 0.4, -0.55, 0.3],
    [-1.35, 0.46, -0.6, 0.9],
    [-1.45, 0.52, -0.5, 0.1],
    [-1.3, 0.4, -0.7, 2],
    [-1.42, 0.58, -0.62, 1.2],
  ],
};

// cash stacks on the desk, front right
const CASH = [];
for (let layer = 0; layer < 4; layer++)
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = (i / 3) | 0;
    CASH.push([0.45 + col * 0.08 + layer * 0.004, D + layer * 0.0225, -0.52 + row * 0.165 + layer * 0.003, (Math.random() - 0.5) * 0.15 + Math.PI / 2]);
  }

export function createRigs() {
  const group = new THREE.Group();
  group.name = 'rigs';
  const fans = [];
  const placed = {};
  const dropping = [];
  const cash = [];

  for (const [x, y, z, ry] of CASH) {
    const c = buildCash();
    c.position.set(x, y, z);
    c.rotation.y = ry;
    c.visible = false;
    group.add(c);
    cash.push(c);
  }

  const api = {
    group,
    count: (type) => (placed[type] ? placed[type].length : 0),
    // returns the object, or null if there's no room left to show it
    add(type, animate = true) {
      const slots = SLOTS[type];
      placed[type] = placed[type] || [];
      if (!slots || placed[type].length >= slots.length) return null;
      const [x, y, z, ry] = slots[placed[type].length];
      const obj = BUILDERS[type]();
      obj.traverse((o) => {
        const mm = Array.isArray(o.material) ? o.material[0] : o.material;
        if (o.isMesh && !mm.isMeshBasicMaterial) o.castShadow = true;
        if (o.userData.spin) fans.push(o);
      });
      obj.position.set(x, y, z);
      obj.rotation.y = ry;
      group.add(obj);
      placed[type].push(obj);
      if (animate) {
        obj.userData.drop = { t: 0, y };
        obj.position.y = y + 0.4;
        obj.scale.setScalar(0.001);
        dropping.push(obj);
      }
      return obj;
    },
    remove(type) {
      const arr = placed[type];
      if (!arr || !arr.length) return;
      const o = arr.pop();
      group.remove(o);
    },
    worldPos(type, i = -1) {
      const arr = placed[type];
      if (!arr || !arr.length) return null;
      return arr.at(i).getWorldPosition(new THREE.Vector3());
    },
    setCash(money) {
      // log scale: $1k → 1 stack, $1M → all of them
      const n = money < 500 ? 0 : Math.min(cash.length, Math.ceil((Math.log10(money) - 2.7) * 7.2));
      cash.forEach((c, i) => (c.visible = i < n));
    },
    update(dt, t, load = 1) {
      for (const f of fans) f.rotation.z -= f.userData.spin * dt * (0.4 + load * 0.6);
      for (let i = 0; i < ledMats.length; i++) {
        const rate = 0.5 + i * 0.73;
        const on = Math.sin(t * rate * 6 + i * 7.1) > (i % 3 === 0 ? 0.6 : -0.2) || Math.random() < 0.02;
        ledMats[i].color.setHex(LED_COLORS[i % LED_COLORS.length]).multiplyScalar(on ? 1 : 0.12);
      }
      stripMat.color.setHSL((t * 0.05) % 1, 0.7, 0.55);
      for (let i = dropping.length - 1; i >= 0; i--) {
        const o = dropping[i];
        const d = o.userData.drop;
        d.t += dt * 2.2;
        const p = Math.min(1, d.t);
        o.scale.setScalar(Math.min(1, p * 1.6));
        const bounce = p < 1 ? Math.abs(Math.cos(p * Math.PI * 1.5)) * (1 - p) * 0.4 : 0;
        o.position.y = d.y + bounce;
        if (p >= 1) dropping.splice(i, 1);
      }
    },
  };
  return api;
}
