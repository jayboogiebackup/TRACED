import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { label, smudge } from './textures.js';

// A beat-up black laptop. Origin = centre of the base footprint, on the table.
// The screen is a live canvas texture (the OS is drawn into it every frame).

const W = 0.37, D = 0.255, H = 0.021;
const LID_H = 0.25, LID_T = 0.009;
export const SCREEN_W = 0.322, SCREEN_H = SCREEN_W / 1.6;

const KB_ROWS = [
  [['esc', 1], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['del', 1.5]],
  [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['⌫', 1.5]],
  [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1]],
  [['caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['enter', 1.75]],
  [['shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['shift', 2.25]],
  [['ctrl', 1.25], ['fn', 1], ['❖', 1], ['alt', 1.25], ['', 5.5], ['alt', 1.25], ['ctrl', 1.25], ['◀', 1], ['▲', 1], ['▶', 1]],
];

export function createLaptop() {
  const group = new THREE.Group();
  group.name = 'laptop';
  const scratch = smudge(3);

  const shellMat = new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.62, roughnessMap: scratch, metalness: 0.15 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.8 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.5, roughnessMap: scratch });

  // ── base
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 3, 0.007), shellMat);
  base.position.y = H / 2;
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  // keyboard well
  const kbW = 0.3, kbD = 0.118;
  const well = new THREE.Mesh(new THREE.PlaneGeometry(kbW + 0.008, kbD + 0.008), deckMat);
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, H + 0.0004, -0.035);
  group.add(well);

  // keys: instanced caps + one merged legend mesh using an atlas
  const u = kbW / 15;
  const rowH = kbD / KB_ROWS.length;
  const keys = [];
  KB_ROWS.forEach((row, r) => {
    const total = row.reduce((s, k) => s + k[1], 0);
    let x = -kbW / 2 + (kbW - total * u) / 2;
    for (const [lab, wu] of row) {
      const kw = wu * u;
      keys.push({ lab, x: x + kw / 2, z: -0.035 - kbD / 2 + rowH * (r + 0.5), w: kw - 0.0028, d: (r === 0 ? rowH * 0.75 : rowH) - 0.0028 });
      x += kw;
    }
  });
  const capGeo = new RoundedBoxGeometry(1, 0.004, 1, 1, 0.0012);
  const caps = new THREE.InstancedMesh(capGeo, keyMat, keys.length);
  const m = new THREE.Matrix4();
  keys.forEach((k, i) => {
    m.compose(new THREE.Vector3(k.x, H + 0.0022, k.z), new THREE.Quaternion(), new THREE.Vector3(k.w, 1, k.d));
    caps.setMatrixAt(i, m);
  });
  caps.castShadow = false;
  caps.receiveShadow = true;
  group.add(caps);

  const cell = 64, cols = 16;
  const atlas = label(cols * cell, Math.ceil(keys.length / cols) * cell, (ctx) => {
    ctx.clearRect(0, 0, 9999, 9999);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    keys.forEach((k, i) => {
      const cx = (i % cols) * cell + cell / 2, cy = Math.floor(i / cols) * cell + cell / 2;
      ctx.font = `${k.lab.length > 2 ? 15 : 24}px Arial, sans-serif`;
      ctx.fillText(k.lab, cx, cy);
    });
  });
  const lpos = [], luv = [];
  const rowsN = Math.ceil(keys.length / cols);
  keys.forEach((k, i) => {
    const s = Math.min(k.w, k.d) * 0.95;
    const x0 = k.x - s / 2, x1 = k.x + s / 2, z0 = k.z - s / 2, z1 = k.z + s / 2, y = H + 0.0043;
    lpos.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0);
    const u0 = (i % cols) / cols, u1 = u0 + 1 / cols;
    const v1 = 1 - Math.floor(i / cols) / rowsN, v0 = v1 - 1 / rowsN;
    luv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  });
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
  lgeo.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2));
  const legendMat = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, color: 0x6a6a6a, depthWrite: false, toneMapped: false });
  const legends = new THREE.Mesh(lgeo, legendMat);
  group.add(legends);

  // touchpad + sticker + power led
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.105, 0.0006, 0.064, 2, 0.0003), new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.35 }));
  pad.position.set(0, H + 0.0002, 0.075);
  group.add(pad);
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.026, 0.026),
    new THREE.MeshStandardMaterial({
      roughness: 0.4,
      map: label(128, 128, (ctx) => {
        ctx.fillStyle = '#c9c9c9';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#222';
        ctx.fillRect(6, 6, 116, 116);
        ctx.fillStyle = '#ddd';
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('C0RE', 64, 46);
        ctx.font = 'bold 40px Arial';
        ctx.fillText('i3', 64, 86);
        ctx.font = '13px Arial';
        ctx.fillText('outside', 64, 110);
      }),
    }),
  );
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.set(0.125, H + 0.0006, 0.085);
  group.add(sticker);
  // a worn sticker someone should have listened to
  const vpn = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 0.022),
    new THREE.MeshStandardMaterial({
      roughness: 0.6,
      transparent: true,
      map: label(256, 112, (ctx) => {
        ctx.clearRect(0, 0, 256, 112);
        ctx.fillStyle = '#d9d4c7';
        ctx.beginPath();
        ctx.roundRect(4, 4, 248, 104, 18);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.font = 'bold 44px Arial';
        ctx.fillText('USE A VPN', 128, 70);
        // scuffs
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * 256, Math.random() * 112, Math.random() * 14, 2);
      }),
    }),
  );
  vpn.rotation.x = -Math.PI / 2;
  vpn.rotation.z = 0.12;
  vpn.position.set(-0.122, H + 0.0006, 0.088);
  group.add(vpn);
  // trackpad click bar + side vents
  const padLine = new THREE.Mesh(new THREE.PlaneGeometry(0.103, 0.0008), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  padLine.rotation.x = -Math.PI / 2;
  padLine.position.set(0, H + 0.0006, 0.097);
  group.add(padLine);
  const ventMat = new THREE.MeshBasicMaterial({ color: 0x030303 });
  for (let i = 0; i < 9; i++) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.0022), ventMat);
    v.rotation.y = Math.PI / 2;
    v.position.set(W / 2 + 0.0002, H * 0.5, -0.07 + i * 0.008);
    group.add(v);
  }
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x9dffb8, toneMapped: false });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.0015), ledMat);
  led.position.set(-0.16, H * 0.5, D / 2 + 0.0002);
  group.add(led);

  // ── lid on its hinge
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D / 2 + 0.006);
  group.add(lidPivot);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, W * 0.82, 16), shellMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, H - 0.002, -D / 2 + 0.006);
  group.add(hinge);

  const lid = new THREE.Mesh(new RoundedBoxGeometry(W, LID_H, LID_T, 3, 0.0045), shellMat);
  lid.position.set(0, LID_H / 2 + 0.003, -LID_T / 2);
  lid.castShadow = true;
  lidPivot.add(lid);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.012, LID_H - 0.01), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 }));
  bezel.position.set(0, LID_H / 2 + 0.003, 0.0002);
  lidPivot.add(bezel);
  const bezelLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.036, 0.007),
    new THREE.MeshStandardMaterial({
      transparent: true,
      roughness: 0.4,
      metalness: 0.6,
      color: 0x8a8a8a,
      map: label(256, 50, (ctx) => {
        ctx.clearRect(0, 0, 256, 50);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GH0ST', 128, 42);
      }),
    }),
  );
  bezelLogo.position.set(0, 0.0185, 0.0005);
  lidPivot.add(bezelLogo);

  // the live screen
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1280;
  screenCanvas.height = 800;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.magFilter = THREE.LinearFilter;
  screenTex.generateMipmaps = false;
  screenTex.anisotropy = 8;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: 0x000000 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
  const screenY = LID_H / 2 + 0.012;
  screen.position.set(0, screenY, 0.0006);
  screen.name = 'screen';
  lidPivot.add(screen);

  // the screen lights the keyboard, the desk and whatever is in front of it
  const glow = new THREE.RectAreaLight(0xbfd8ff, 0, SCREEN_W, SCREEN_H);
  glow.position.set(0, screenY, 0.004);
  glow.rotation.y = Math.PI;
  lidPivot.add(glow);

  // webcam — the green light has been on the whole time
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 20), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.1, metalness: 0.6 }));
  cam.position.set(0, LID_H - 0.0045, 0.0007);
  lidPivot.add(cam);
  const camLensGlint = new THREE.Mesh(new THREE.CircleGeometry(0.0009, 12), new THREE.MeshBasicMaterial({ color: 0x334466 }));
  camLensGlint.position.set(0.0007, LID_H - 0.004, 0.0009);
  lidPivot.add(camLensGlint);
  const camLedMat = new THREE.MeshBasicMaterial({ color: 0x6dff8a, toneMapped: false });
  const camLed = new THREE.Mesh(new THREE.CircleGeometry(0.0009, 10), camLedMat);
  camLed.position.set(0.008, LID_H - 0.0045, 0.0008);
  lidPivot.add(camLed);
  // (bought later) a strip of tape over it
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.009, 0.0008),
    new THREE.MeshStandardMaterial({ color: 0x9a8f78, roughness: 0.9, transparent: true, opacity: 0.94 }),
  );
  tape.position.set(0.003, LID_H - 0.0045, 0.001);
  tape.rotation.z = 0.08;
  tape.visible = false;
  lidPivot.add(tape);

  // logo on the back of the lid
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.02),
    new THREE.MeshBasicMaterial({
      transparent: true,
      color: 0x777777,
      map: label(256, 64, (ctx) => {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 44px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GH0ST', 128, 48);
      }),
    }),
  );
  logo.position.set(0, LID_H / 2, -LID_T - 0.0003);
  logo.rotation.y = Math.PI;
  lidPivot.add(logo);

  const OPEN = -0.27; // ~105°
  const CLOSED = Math.PI / 2 - 0.02;
  lidPivot.rotation.x = OPEN;

  const api = {
    group,
    screen,
    screenCanvas,
    screenTex,
    screenMat,
    glow,
    lidPivot,
    legendMat,
    camLed,
    camLedMat,
    tape,
    OPEN,
    CLOSED,
    power: 0, // 0 = off, 1 = on (fades the panel)
    setLid(a) {
      lidPivot.rotation.x = a;
    },
    update(dt, t) {
      const p = api.power;
      screenMat.color.setScalar(p * 0.84);
      glow.intensity = p * (api.glowLevel ?? 3.2);
      legendMat.color.setScalar(0.12 + p * 0.3);
      // the webcam light never quite stays steady
      camLedMat.color.setRGB(0.43, 1, 0.54).multiplyScalar(tape.visible ? 0 : (0.6 + 0.4 * (Math.sin(t * 1.3) > -0.95 ? 1 : 0.2)) * (1 + (api.ledBoost || 0) * 4));
      ledMat.color.setRGB(0.6, 1, 0.7).multiplyScalar(0.4 + 0.3 * Math.sin(t * 2));
    },
  };
  return api;
}
