import * as THREE from 'three';
import { createBasement, createDeskProps, DESK_Y } from '../world/basement.js';
import { createLaptop } from '../world/laptop.js';
import { createPhone } from '../world/phone.js';
import { createRigs } from '../world/rigs.js';
import { OS } from '../os/os.js';
import { Miner, RigMart, SafeNet } from '../os/apps/miner.js';
import { Casino } from '../os/apps/casino.js';
import { Organs } from '../os/apps/organs.js';
import { Chirp } from '../os/apps/chirp.js';
import { Arcade } from '../os/apps/arcade.js';
import { Stonks } from '../os/apps/stonks.js';
import { Velvet } from '../os/apps/velvet.js';
import { DataMart } from '../os/apps/datamart.js';
import { Burner, Scanner } from '../os/apps/burner.js';
import { Files, Notepad, Photo, Terminal } from '../os/apps/system.js';
import { audio } from '../core/audio.js';
import { G, mining, heatRate, addMoney, addHeat, on, emit, secret } from '../game/state.js';

const tipEl = document.querySelector('#tip');

// The basement + laptop scene and everything that happens in it.
export function createGame(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.17);

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.02, 30);
  camera.layers.enable(0);

  const room = createBasement();
  scene.add(room.group);
  const P = room.parts;
  const desk = createDeskProps();
  scene.add(desk.group);
  const D = desk.parts;

  const laptop = createLaptop();
  laptop.group.position.set(0, DESK_Y, -0.55);
  scene.add(laptop.group);

  const phone = createPhone({ color: 0x4a4a4a });
  phone.group.scale.setScalar(0.88);
  phone.group.position.set(-0.44, DESK_Y, -0.64);
  phone.group.rotation.y = 0.45;
  phone.baseX = -0.44;
  scene.add(phone.group);

  const rigs = createRigs();
  scene.add(rigs.group);

  // a faint cold fill that rises while you're on the phone, so you can see it
  const callLight = new THREE.PointLight(0xc8d4ff, 0, 1.2, 1.5);
  callLight.position.set(-0.25, DESK_Y + 0.35, -0.4);
  scene.add(callLight);

  // ── you, and the thing behind you (only the hidden photo camera sees these)
  const ghostLayer = 1;
  const hoodMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.95 });
  const you = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 6, 14), hoodMat);
  torso.position.set(0, 0.86, -0.12);
  torso.rotation.x = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), hoodMat);
  head.position.set(0, 1.2, -0.28);
  head.scale.set(1, 1.1, 1.15);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.46), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 }));
  chair.position.set(0, 0.46, 0.0);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.04), chair.material);
  chairBack.position.set(0, 0.75, 0.22);
  you.add(torso, head, chair, chairBack);
  const figure = new THREE.Group();
  const fMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1 });
  const fBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.25, 6, 12), fMat);
  fBody.position.y = 0.88;
  const fHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), fMat);
  fHead.position.y = 1.78;
  fHead.scale.y = 1.25;
  const fEyes = new THREE.Group();
  for (const ex of [-0.04, 0.04]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    e.position.set(ex, 1.8, 0.125);
    fEyes.add(e);
  }
  figure.add(fBody, fHead, fEyes);
  figure.position.set(-0.85, 0, 1.15);
  figure.rotation.y = 0.55;
  const flashBulb = new THREE.PointLight(0xffffff, 0, 8, 1.2);
  [you, figure, flashBulb].forEach((o) => o.traverse((c) => c.layers.set(ghostLayer)));
  scene.add(you, figure, flashBulb);

  // ── the operating system on the screen
  const os = new OS(laptop.screenCanvas);
  os.register('readme', { title: 'README.txt', label: 'README', icon: 'readme', create: (o) => ({ draw: (...a) => o.app('notepad').draw(...a), onOpen: () => (o.app('notepad').file = 'README.txt') }), w: 700, h: 600 });
  os.register('miner', Miner);
  os.register('rigmart', RigMart);
  os.register('casino', Casino);
  os.register('organs', Organs);
  os.register('chirp', Chirp);
  os.register('arcade', Arcade);
  os.register('stonks', Stonks);
  os.register('velvet', Velvet);
  os.register('datamart', DataMart);
  os.register('safenet', SafeNet);
  os.register('burner', Burner);
  os.register('scanner', Scanner);
  os.register('terminal', Terminal);
  os.register('files', Files);
  os.register('notepad', Notepad);
  os.register('photo', Photo);
  os.order.forEach((id) => os.app(id));

  // ── photo of you, from behind, with something standing there
  const photoCam = new THREE.PerspectiveCamera(58, 1.5, 0.05, 20);
  photoCam.position.set(1.7, 2.05, 2.2);
  photoCam.lookAt(-0.15, 0.85, -0.3);
  photoCam.layers.enableAll();
  const photoRT = new THREE.WebGLRenderTarget(900, 600);
  os.takePhoto = () => {
    const r = engine.renderer;
    flashBulb.position.copy(photoCam.position);
    flashBulb.intensity = 14;
    const oldFog = scene.fog.density;
    scene.fog.density = 0.12;
    r.setRenderTarget(photoRT);
    r.render(scene, photoCam);
    const px = new Uint8Array(900 * 600 * 4);
    r.readRenderTargetPixels(photoRT, 0, 0, 900, 600, px);
    r.setRenderTarget(null);
    flashBulb.intensity = 0;
    scene.fog.density = oldFog;
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 600;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(900, 600);
    for (let y = 0; y < 600; y++)
      for (let x = 0; x < 900; x++) {
        const s = ((599 - y) * 900 + x) * 4, d = (y * 900 + x) * 4;
        const l = 0.3 * px[s] + 0.59 * px[s + 1] + 0.11 * px[s + 2];
        const v = Math.min(255, Math.pow(l / 255, 0.55) * 270 + (Math.random() - 0.5) * 30);
        img.data[d] = v * 1.02;
        img.data[d + 1] = v;
        img.data[d + 2] = v * 0.94;
        img.data[d + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#ff9a3c';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(new Date().toLocaleString(), 600, 580);
    return c;
  };

  // ── camera rig
  const cam = {
    zoom: 0, // 0 = at the laptop, 1 = leaned back
    zoomT: 0,
    yaw: 0,
    pitch: 0,
    yawT: 0,
    pitchT: 0,
    looking: false,
    sway: 0,
    shake: 0,
    override: null, // {pos, target, dur}
    overrideW: 0,
    opos: new THREE.Vector3(),
    otgt: new THREE.Vector3(),
  };
  const screenCenter = new THREE.Vector3();
  const screenNormal = new THREE.Vector3();
  function screenFrame() {
    laptop.screen.updateWorldMatrix(true, false);
    laptop.screen.getWorldPosition(screenCenter);
    screenNormal.set(0, 0, 1).transformDirection(laptop.screen.matrixWorld);
  }
  function closeDistance() {
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dh = 0.201 / (0.78 * 2 * tanH);
    const dw = 0.322 / (0.88 * 2 * tanH * camera.aspect);
    return Math.max(dh, dw);
  }
  const farPos = new THREE.Vector3(-0.02, 1.36, 0.68);
  const farLook = new THREE.Vector3(-0.04, 0.8, -0.72);
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  let camT = 0;
  function updateCamera(dt) {
    camT += dt;
    screenFrame();
    cam.zoom += (cam.zoomT - cam.zoom) * Math.min(1, dt * 4);
    const close = screenCenter.clone().addScaledVector(screenNormal, closeDistance());
    close.y += 0.03;
    tmpPos.copy(close).lerp(farPos, cam.zoom);
    tmpLook.copy(screenCenter).lerp(farLook, cam.zoom);
    tmpLook.y -= 0.012 * (1 - cam.zoom);
    // breathing, lung damage, shock
    const sw = 0.0025 + cam.sway * 0.012;
    tmpPos.x += Math.sin(camT * 0.7) * sw;
    tmpPos.y += Math.sin(camT * 1.1) * sw * 0.7;
    if (cam.override) {
      if (cam.overrideW < 0.01) {
        cam.opos.copy(cam.override.pos);
        cam.otgt.copy(cam.override.target);
      }
      cam.overrideW = Math.min(1, cam.overrideW + dt / cam.override.dur);
      const k = Math.min(1, (dt * 3) / cam.override.dur);
      cam.opos.lerp(cam.override.pos, k);
      cam.otgt.lerp(cam.override.target, k);
    } else cam.overrideW = Math.max(0, cam.overrideW - dt / 1.0);
    const ow = ease(cam.overrideW);
    if (ow > 0) {
      tmpPos.lerp(cam.opos, ow);
      tmpLook.lerp(cam.otgt, ow);
    }
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    // head turn (look around)
    if (!cam.looking) {
      cam.yawT *= Math.pow(0.02, dt);
      cam.pitchT *= Math.pow(0.02, dt);
    }
    cam.yaw += (cam.yawT - cam.yaw) * Math.min(1, dt * 10);
    cam.pitch += (cam.pitchT - cam.pitch) * Math.min(1, dt * 10);
    camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), cam.yaw);
    camera.rotateX(cam.pitch);
    if (cam.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * cam.shake * 0.02;
      camera.position.y += (Math.random() - 0.5) * cam.shake * 0.02;
      cam.shake = Math.max(0, cam.shake - dt * 1.5);
    }
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // point the camera somewhere for a cutscene beat
  function lookAt(target, o = {}) {
    const pos = o.pos ? o.pos.clone() : camera.position.clone().lerp(target, o.closer ?? 0);
    cam.override = { pos, target: target.clone(), dur: o.dur || 1.1 };
  }
  function lookBack() {
    cam.override = null;
  }

  // ── interactable things in the room
  const interactables = [];
  const addInteract = (obj, label, fn) => {
    obj.traverse((o) => (o.userData.interact = { label, fn }));
    interactables.push(obj);
  };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-5, -5);
  let screenHit = null;
  let hovered = null;

  function pick() {
    screenHit = null;
    hovered = null;
    if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([laptop.screen, ...interactables], true);
    for (const h of hits) {
      if (h.object === laptop.screen) {
        if (state.mode === 'play' && !cam.looking && cam.overrideW < 0.05) screenHit = h;
        break;
      }
      if (h.object.userData.interact) {
        hovered = h.object.userData.interact;
        break;
      }
    }
  }

  const state = {
    scene,
    camera,
    os,
    laptop,
    phone,
    rigs,
    callLight,
    room: P,
    desk: D,
    mode: 'idle', // idle | play | cutscene | ending
    lookAt,
    lookBack,
    cam,
    addInteract,
    fx: { red: 0, pale: 0, glitch: 0, blindL: 0, blindR: 0, nausea: 0 },
    interactCallback: null,
  };

  // ── pointer & keys
  const canvas = engine.canvas;
  let lastX = 0, lastY = 0;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (cam.looking) {
      cam.yawT = THREE.MathUtils.clamp(cam.yawT - (e.clientX - lastX) * 0.004, -1.9, 1.9);
      cam.pitchT = THREE.MathUtils.clamp(cam.pitchT - (e.clientY - lastY) * 0.004, -0.7, 0.85);
    }
    lastX = e.clientX;
    lastY = e.clientY;
    tipEl.style.left = e.clientX + 16 + 'px';
    tipEl.style.top = e.clientY + 14 + 'px';
  });
  canvas.addEventListener('pointerdown', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    lastX = e.clientX;
    lastY = e.clientY;
    if (state.mode !== 'play' && state.mode !== 'cutscene') return;
    if (e.button === 2) {
      if (state.mode !== 'play') return;
      cam.looking = true;
      return;
    }
    if (e.button !== 0) return;
    pick();
    if (screenHit) os.press();
    else if (hovered && (state.mode === 'play' || hovered.always)) hovered.fn();
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 2) cam.looking = false;
    if (e.button === 0) os.release();
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (state.mode !== 'play') return;
      pick();
      if (screenHit && cam.zoom < 0.5) os.wheel(Math.sign(e.deltaY) * Math.min(120, Math.abs(e.deltaY)));
      else cam.zoomT = THREE.MathUtils.clamp(cam.zoomT + Math.sign(e.deltaY) * 0.5, 0, 1);
    },
    { passive: true },
  );
  window.addEventListener('keydown', (e) => {
    if (state.mode !== 'play') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      cam.zoomT = cam.zoomT > 0.5 ? 0 : 1;
      return;
    }
    if (state.keyHook && state.keyHook(e)) return;
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
    os.key(e);
    audio.key();
  });

  // ── world updates
  let canT = 0, ratT = 20, dollLook = 0;
  state.update = (dt, t) => {
    updateCamera(dt);
    pick();
    // feed the OS the mouse position on its canvas
    if (screenHit) {
      const uv = screenHit.uv;
      os.pointer(uv.x * os.W, (1 - uv.y) * os.H);
      document.body.classList.add('hide-cursor');
    } else {
      if (!os.g.down) os.pointer(-100, -100);
      document.body.classList.remove('hide-cursor');
    }
    canvas.style.cursor = hovered && state.mode === 'play' ? 'pointer' : 'default';
    if (hovered && state.mode === 'play') {
      tipEl.textContent = hovered.label;
      tipEl.classList.add('show');
    } else tipEl.classList.remove('show');

    if (laptop.power > 0.01) {
      os.draw(dt);
      laptop.screenTex.needsUpdate = true;
    }
    // apps that run in the background
    for (const id of os.order) {
      const a = os.apps[id].inst;
      if (a && a.tick) a.tick(dt);
    }

    laptop.update(dt, t);
    phone.update(dt);
    const m = mining();
    rigs.update(dt, t, Math.min(1, m.raw / 400 + 0.2));
    rigs.setCash(G.money);
    audio.setFans(Math.min(1, m.load / 600 + 0.08));

    // candle burns down with the police clock
    const c = D.candle;
    if (c.lit) {
      const hgt = Math.max(0.012, c.height * (1 - (G.heat / 100) * 0.93));
      c.wax.scale.y = hgt;
      c.wax.position.y = 0.012 + hgt / 2;
      c.wick.position.y = 0.012 + hgt + 0.005;
      const fl = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 29.3) * 0.05 + (Math.random() - 0.5) * 0.08;
      c.flame.position.y = 0.012 + hgt + 0.026;
      c.flame.scale.set(fl, 0.9 + fl * 0.15, 1);
      c.flame.quaternion.copy(camera.quaternion);
      c.halo.position.copy(c.flame.position);
      c.halo.quaternion.copy(camera.quaternion);
      c.light.position.set(0, 0.012 + hgt + 0.05, 0);
      c.light.intensity = 0.55 * fl;
    }
    // bulb (until it dies)
    const b = P.bulb;
    if (b.on > 0) {
      const flick = Math.random() < 0.03 ? 0.15 : 1;
      b.light.intensity = 2.5 * b.on * flick;
      b.mat.color.setScalar(b.on * flick);
      audio.setBuzz(b.on * flick);
    }
    // energy drink cans pile up
    canT += dt;
    if (canT > 110) {
      canT = 0;
      const next = D.cans.find((cc) => !cc.visible);
      if (next) next.visible = true;
    }
    // the doll's head turns toward you as they get closer
    const dollTarget = G.heat > 30 ? Math.min(1, (G.heat - 30) / 50) : 0;
    dollLook += (dollTarget - dollLook) * dt * 0.2;
    const dh = P.doll.head;
    const want = new THREE.Vector3();
    camera.getWorldPosition(want);
    P.doll.group.worldToLocal(want);
    dh.rotation.y = Math.atan2(want.x, want.z) * dollLook;
    // rat eyes blink in the dark sometimes
    ratT -= dt;
    if (ratT < 0) {
      P.ratEyes.visible = !P.ratEyes.visible;
      ratT = P.ratEyes.visible ? 3 + Math.random() * 4 : 15 + Math.random() * 25;
      if (P.ratEyes.visible) {
        P.ratEyes.position.set(-1.45 + Math.random() * 0.4, 0.05, 0.2 + Math.random() * 0.9);
        if (Math.random() < 0.5) audio.rat();
      }
    }
    // body damage → shader
    const fx = state.fx;
    fx.red = Math.max(0, fx.red - dt * 0.7);
    fx.pale = Math.max(0, fx.pale - dt * 0.006);
    fx.glitch = Math.max(0, fx.glitch - dt * 1.2);
    if (G.organs.marrow && Math.random() < dt * 0.02) fx.red = Math.max(fx.red, 0.5);
    if (G.organs.liver && Math.random() < dt * 0.015) fx.nausea = 3;
    fx.nausea = Math.max(0, fx.nausea - dt);
    cam.sway = (G.organs.lung ? 0.5 : 0) + (fx.nausea > 0 ? 1.4 : 0) + fx.pale * 0.8;
    const u = engine.u;
    u.uRed.value = fx.red;
    u.uPale.value = Math.min(1, fx.pale);
    u.uBlindL.value += (fx.blindL - u.uBlindL.value) * dt * 2;
    u.uBlindR.value += (fx.blindR - u.uBlindR.value) * dt * 2;
    u.uGlitch.value = Math.max(fx.glitch, state.fxGlitchBase || 0);
  };

  // ── interactables
  addInteract(D.duck, 'rubber duck', () => {
    audio.quack();
    D.duck.position.y = DESK_Y + 0.02;
    setTimeout(() => (D.duck.position.y = DESK_Y), 120);
    if (secret('duck')) emit('say', 'duck');
  });
  addInteract(P.bulb.chain, 'pull chain', () => {
    audio.click(0.6);
    secret('chain');
    emit('say', 'chain');
  });
  addInteract(P.doll.group, 'doll', () => {
    audio.stinger(0.12);
    if (dollLook > 0.3) {
      secret('doll');
      emit('say', 'doll');
    } else emit('say', 'doll0');
  });
  addInteract(P.ratEyes, '...', () => {
    audio.rat();
    secret('rat');
    P.ratEyes.visible = false;
    ratT = 20;
  });
  addInteract(D.mug, 'cold coffee', () => {
    audio.blip(140, 0.08, 0.05);
    emit('say', 'mug');
  });
  addInteract(D.note, 'sticky note', () => emit('say', 'note'));
  addInteract(P.winGlass, 'window', () => emit('say', 'window'));
  addInteract(phone.group, 'phone', () => emit('phoneClick'));
  // the wall writing is only "found" if you click it
  addInteract(P.scrawl, 'wall', () => {
    audio.whisper({ gain: 0.12 });
    secret('scrawl');
    emit('say', 'scrawl');
  });

  return state;
}
