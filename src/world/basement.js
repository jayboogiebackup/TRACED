import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { concrete, wood, label, radial, smudge, srand, rnd } from './textures.js';

// The basement. You sit at the desk facing -Z. Almost everything here lives in the dark
// and only shows up in screen-glow, candle-light, a sweeping flashlight, or police lights.

export const DESK_Y = 0.76;

export function createBasement() {
  const room = new THREE.Group();
  room.name = 'basement';
  const parts = {};

  const RX0 = -2.1, RX1 = 2.5, RZ0 = -1.7, RZ1 = 2.6, RH = 2.45;

  // ── shell
  const conc = concrete(3);
  const wallMat = new THREE.MeshStandardMaterial({ ...conc, color: 0x9a9a9a, roughness: 1, bumpScale: 1.5 });
  const floorConc = concrete(4);
  const floorMat = new THREE.MeshStandardMaterial({ ...floorConc, color: 0x7d7d7d, roughness: 0.92, bumpScale: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX1 - RX0, RZ1 - RZ0), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((RX0 + RX1) / 2, 0, (RZ0 + RZ1) / 2);
  floor.receiveShadow = true;
  room.add(floor);

  const wall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    room.add(m);
    return m;
  };
  wall(RX1 - RX0, RH, (RX0 + RX1) / 2, RH / 2, RZ0, 0); // back
  wall(RX1 - RX0, RH, (RX0 + RX1) / 2, RH / 2, RZ1, Math.PI); // behind you
  wall(RZ1 - RZ0, RH, RX0, RH / 2, (RZ0 + RZ1) / 2, Math.PI / 2); // left
  wall(RZ1 - RZ0, RH, RX1, RH / 2, (RZ0 + RZ1) / 2, -Math.PI / 2); // right

  // ceiling: boards on joists, open above the stairs
  const SW = 0.94, SZ1 = 0.9, SH = 4.8; // stairwell: x RX0..RX0+SW, z RZ0..SZ1, up to SH
  const w = wood(2, [60, 46, 34]);
  const boardMat = new THREE.MeshStandardMaterial({ map: w.map, roughnessMap: w.roughnessMap, color: 0x777777, roughness: 0.95 });
  const ceilPart = (x0, x1, z0, z1) => {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), boardMat);
    c.rotation.x = Math.PI / 2;
    c.position.set((x0 + x1) / 2, RH, (z0 + z1) / 2);
    room.add(c);
  };
  ceilPart(RX0 + SW, RX1, RZ0, RZ1);
  ceilPart(RX0, RX0 + SW, SZ1, RZ1);
  for (let x = RX0 + 0.3; x < RX1; x += 0.45) {
    const z0 = x < RX0 + SW ? SZ1 : RZ0;
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, RZ1 - z0), boardMat);
    j.position.set(x, RH - 0.1, (z0 + RZ1) / 2);
    room.add(j);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, SZ1 - RZ0), boardMat);
  header.position.set(RX0 + SW, RH - 0.05, (RZ0 + SZ1) / 2);
  room.add(header);
  // the stairwell shaft up to the ground floor
  const shaftMat = new THREE.MeshStandardMaterial({ ...conc, color: 0x8a8a8a, roughness: 1, side: THREE.DoubleSide });
  const shaft = (wd, ht, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), shaftMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    room.add(m);
  };
  shaft(SZ1 - RZ0, SH - RH, RX0, (RH + SH) / 2, (RZ0 + SZ1) / 2, Math.PI / 2);
  shaft(SZ1 - RZ0, SH - RH, RX0 + SW, (RH + SH) / 2, (RZ0 + SZ1) / 2, -Math.PI / 2);
  shaft(SW, SH - RH, RX0 + SW / 2, (RH + SH) / 2, RZ0, 0);
  shaft(SW, SH - RH, RX0 + SW / 2, (RH + SH) / 2, SZ1, Math.PI);
  const shaftTop = new THREE.Mesh(new THREE.PlaneGeometry(SW, SZ1 - RZ0), boardMat);
  shaftTop.rotation.x = Math.PI / 2;
  shaftTop.position.set(RX0 + SW / 2, SH, (RZ0 + SZ1) / 2);
  room.add(shaftTop);

  // pipes
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6b6158, roughness: 0.55, metalness: 0.7, roughnessMap: smudge(4) });
  const pipe = (a, b, r = 0.035) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), pipeMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    room.add(m);
    return m;
  };
  pipe(new THREE.Vector3(RX0 + SW, 2.22, -1.35), new THREE.Vector3(RX1, 2.22, -1.35), 0.045);
  pipe(new THREE.Vector3(RX0 + SW, 2.12, -1.5), new THREE.Vector3(RX1, 2.12, -1.5), 0.028);
  pipe(new THREE.Vector3(1.75, 2.22, -1.35), new THREE.Vector3(1.75, 2.22, RZ1), 0.035);
  pipe(new THREE.Vector3(-1.2, 0, -1.55), new THREE.Vector3(-1.2, 2.12, -1.55), 0.03);

  // ── the desk
  const dw = wood(1, [88, 62, 42]);
  const deskMat = new THREE.MeshStandardMaterial({ map: dw.map, roughnessMap: dw.roughnessMap, color: 0xa0a0a0, roughness: 0.85 });
  const desk = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.78), deskMat);
  top.position.y = DESK_Y - 0.02;
  top.receiveShadow = top.castShadow = true;
  desk.add(top);
  for (const [x, z] of [
    [-0.7, -0.34],
    [0.7, -0.34],
    [-0.7, 0.34],
    [0.7, 0.34],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, DESK_Y - 0.04, 0.055), deskMat);
    leg.position.set(x, (DESK_Y - 0.04) / 2, z);
    leg.castShadow = true;
    desk.add(leg);
  }
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.09, 0.02), deskMat);
  apron.position.set(0, DESK_Y - 0.085, -0.36);
  desk.add(apron);
  desk.position.set(0, 0, -0.62);
  room.add(desk);
  parts.desk = desk;

  // ── stairs up to the door (left side)
  const stairMat = new THREE.MeshStandardMaterial({ map: w.map, color: 0x6f6f6f, roughness: 0.95 });
  const steps = 13, rise = 0.2, run = 0.22;
  const sx = RX0 + 0.46;
  const stairTop = steps * rise; // = the floor upstairs
  for (let i = 0; i < steps; i++) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.035, run + 0.04), stairMat);
    tread.position.set(sx, (i + 1) * rise, 1.75 - i * run);
    tread.castShadow = tread.receiveShadow = true;
    room.add(tread);
  }
  const sLen = Math.hypot(stairTop, steps * run);
  const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, sLen), stairMat);
  stringer.position.set(sx + 0.44, stairTop / 2, 1.75 - ((steps - 1) * run) / 2);
  stringer.rotation.x = Math.atan2(stairTop, steps * run);
  room.add(stringer);
  // landing + the door to the house, at the top of the stairs facing down them
  const doorX = RX0 + SW / 2, doorW = 0.78, doorH = 1.95, doorBase = stairTop + 0.02;
  const landing = new THREE.Mesh(new THREE.BoxGeometry(SW - 0.04, 0.06, 0.66), stairMat);
  landing.position.set(doorX, stairTop - 0.01, RZ0 + 0.33);
  room.add(landing);
  // the lit hallway behind the door (only visible once it opens)
  const hallMat = new THREE.MeshBasicMaterial({ color: 0xfff0d8, toneMapped: false });
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), hallMat);
  hall.position.set(doorX, doorBase + doorH / 2, RZ0 + 0.004);
  room.add(hall);
  const doorGeo = new THREE.BoxGeometry(doorW, doorH, 0.04);
  doorGeo.translate(doorW / 2, 0, 0); // hinge on the left edge
  const door = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ map: w.map, color: 0x6a6a6a, roughness: 0.9 }));
  door.position.set(doorX - doorW / 2, doorBase + doorH / 2, RZ0 + 0.03);
  room.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), new THREE.MeshStandardMaterial({ color: 0x9a8a6a, metalness: 1, roughness: 0.3 }));
  knob.position.set(doorW - 0.08, -0.05, 0.035);
  door.add(knob);
  // light leaking around the frame — shadows pass across it when someone's up there
  const leakMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false, transparent: true, opacity: 0.85 });
  const leaks = new THREE.Group();
  const strip = (wd, ht, x, y) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), leakMat);
    s.position.set(x, y, RZ0 + 0.052);
    leaks.add(s);
  };
  strip(doorW + 0.02, 0.012, doorX, doorBase + doorH + 0.004);
  strip(0.01, doorH, doorX - doorW / 2 - 0.004, doorBase + doorH / 2);
  strip(0.01, doorH, doorX + doorW / 2 + 0.004, doorBase + doorH / 2);
  strip(doorW, 0.016, doorX, doorBase + 0.006);
  room.add(leaks);
  // one light does double duty: warm spill from under the door, falling down the stairwell
  const crackLight = new THREE.PointLight(0xe8dcc4, 2.6, 4.2, 1.5);
  crackLight.position.set(doorX, doorBase + 0.6, RZ0 + 0.6);
  room.add(crackLight);
  // someone in the doorway (only when it opens)
  const copMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const cop = new THREE.Group();
  const cBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.95, 4, 10), copMat);
  cBody.position.y = 0.75;
  const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), copMat);
  cHead.position.y = 1.55;
  const cHat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.08, 14), copMat);
  cHat.position.y = 1.66;
  const cBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 14), copMat);
  cBrim.position.set(0, 1.62, 0.03);
  cop.add(cBody, cHead, cHat, cBrim);
  cop.position.set(doorX + 0.06, doorBase, RZ0 + 0.2);
  cop.visible = false;
  room.add(cop);
  // camPos: where to stand to actually see up the stairwell
  parts.door = {
    mesh: door,
    knob,
    hall,
    cop,
    pos: new THREE.Vector3(doorX, doorBase + 1.0, RZ0 + 0.05),
    camPos: new THREE.Vector3(-1.02, 1.25, 1.65),
  };
  parts.crack = { mat: leakMat, light: crackLight, base: 2.6 };
  parts.feet = { visible: false, position: new THREE.Vector3() }; // shadows are faked by dimming the leaks

  // ── high window with bars (back wall, right)
  const winX = 1.05, winY = 2.0;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
  const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.36), new THREE.MeshBasicMaterial({ color: 0x1a2230, toneMapped: false }));
  winGlass.position.set(winX, winY, RZ0 + 0.005);
  room.add(winGlass);
  parts.winGlass = winGlass;
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 6), frameMat);
    bar.position.set(winX + i * 0.1, winY, RZ0 + 0.04);
    bar.castShadow = true;
    room.add(bar);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.12), frameMat);
  sill.position.set(winX, winY - 0.2, RZ0 + 0.05);
  room.add(sill);

  // moonlight / streetlight through the window, casting the bars
  const moon = new THREE.SpotLight(0x9fb6d8, 3.4, 7, 0.3, 0.55, 1.2);
  moon.position.set(winX + 0.3, winY + 0.25, RZ0 - 0.6);
  moon.target.position.set(winX + 0.15, 0, 0.55);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.bias = -0.0005;
  moon.shadow.camera.near = 0.3;
  moon.shadow.camera.far = 6;
  room.add(moon, moon.target);
  parts.moon = moon;
  // god-ray: a soft additive cone
  const beamTex = label(64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.75, 2.6, 24, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTex, color: 0x8ea4c8, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  const beamDir = moon.target.position.clone().sub(moon.position).normalize();
  beam.position.copy(moon.position).addScaledVector(beamDir, 1.45);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir);
  room.add(beam);
  parts.beam = beam;

  // ── hanging bulb on a cord (it doesn't survive long)
  const bulbPos = new THREE.Vector3(0.15, 1.95, -0.75);
  const cordM = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, RH - bulbPos.y, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cordM.position.set(bulbPos.x, (RH + bulbPos.y) / 2 + 0.04, bulbPos.z);
  room.add(cordM);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
  socket.position.copy(bulbPos).add(new THREE.Vector3(0, 0.06, 0));
  room.add(socket);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), bulbMat);
  bulb.position.copy(bulbPos);
  bulb.scale.y = 1.25;
  room.add(bulb);
  const bulbLight = new THREE.PointLight(0xffe2b8, 2.5, 5, 1.6);
  bulbLight.position.copy(bulbPos);
  room.add(bulbLight);
  // pull chain (secret: it does nothing once the bulb is dead)
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.32, 4), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 1, roughness: 0.3 }));
  chain.position.copy(bulbPos).add(new THREE.Vector3(0.02, -0.18, 0));
  room.add(chain);
  parts.bulb = { mesh: bulb, mat: bulbMat, light: bulbLight, chain, on: 1 };

  // ── water heater with a tiny blue pilot flame
  const heaterMat = new THREE.MeshStandardMaterial({ color: 0x8c8f88, roughness: 0.6, metalness: 0.4, roughnessMap: smudge(2) });
  const heater = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.5, 24), heaterMat);
  heater.position.set(2.05, 0.75, -1.25);
  room.add(heater);
  const pilot = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ map: radial(64), color: 0x5aa0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pilot.position.set(2.05, 0.12, -0.96);
  room.add(pilot);

  // ── shelves, boxes, cans
  const shelfMat = new THREE.MeshStandardMaterial({ map: w.map, color: 0x666666, roughness: 0.9 });
  const shelves = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.35), shelfMat);
    s.position.set(0, 0.3 + i * 0.48, 0);
    s.castShadow = s.receiveShadow = true;
    shelves.add(s);
  }
  for (const x of [-0.58, 0.58]) {
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.85, 0.04), shelfMat);
    up.position.set(x, 0.92, 0.15);
    shelves.add(up);
  }
  shelves.position.set(-0.85, 0, RZ0 + 0.2);
  room.add(shelves);
  parts.shelves = shelves;

  const cardMat = new THREE.MeshStandardMaterial({
    color: 0x9a8a72,
    roughness: 0.95,
    map: label(256, 256, (ctx) => {
      ctx.fillStyle = '#b39d7d';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#c8b48f';
      ctx.fillRect(0, 112, 256, 32);
      ctx.fillStyle = '#3a2f22';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('XMAS', 30, 70);
      ctx.font = '22px Arial';
      ctx.fillText('↑ THIS SIDE UP', 40, 210);
    }),
  });
  srand(9);
  const box = (x, y, z, s, rot = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), cardMat);
    b.position.set(x, y + s[1] / 2, z);
    b.rotation.y = rot;
    b.castShadow = b.receiveShadow = true;
    room.add(b);
    return b;
  };
  box(-1.15, 0.315, RZ0 + 0.2, [0.4, 0.3, 0.3], 0.05);
  box(-0.6, 0.315, RZ0 + 0.22, [0.3, 0.22, 0.28], -0.1);
  box(-0.85, 0.795, RZ0 + 0.2, [0.5, 0.25, 0.3], 0.02);
  box(1.6, 0, 1.6, [0.6, 0.45, 0.5], 0.3);
  box(1.65, 0.45, 1.55, [0.45, 0.35, 0.4], 0.1);
  box(-1.5, 0, -0.6, [0.5, 0.4, 0.45], -0.2);
  const canMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5, metalness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16), canMat);
    c.position.set(-1.3 + i * 0.19, 1.275 + 0.1, RZ0 + 0.2);
    c.castShadow = true;
    room.add(c);
  }

  // ── the doll on the shelf. it moves when you're not looking.
  const dollMat = new THREE.MeshStandardMaterial({ color: 0xc9bfb2, roughness: 0.65 });
  const doll = new THREE.Group();
  const dBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.17, 12), new THREE.MeshStandardMaterial({ color: 0x5a4a4a, roughness: 0.9 }));
  dBody.position.y = 0.085;
  doll.add(dBody);
  const dHead = new THREE.Group();
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 16), dollMat);
  dHead.add(headM);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const ex of [-0.02, 0.02]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), eyeMat);
    e.position.set(ex, 0.008, 0.058);
    dHead.add(e);
  }
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.003), eyeMat);
  mouth.position.set(0, -0.022, 0.057);
  dHead.add(mouth);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.063, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 1 }));
  hair.position.y = 0.006;
  hair.rotation.x = -0.25;
  dHead.add(hair);
  dHead.position.y = 0.22;
  doll.add(dHead);
  doll.position.set(-0.45, 1.755, RZ0 + 0.22);
  doll.rotation.y = 0.9;
  room.add(doll);
  parts.doll = { group: doll, head: dHead };

  // ── writing on the wall, only readable in a beam of light
  const scrawl = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.5),
    new THREE.MeshStandardMaterial({
      transparent: true,
      roughness: 1,
      color: 0x3a0d0d,
      map: label(1024, 360, (ctx) => {
        ctx.clearRect(0, 0, 1024, 360);
        ctx.fillStyle = '#fff';
        ctx.font = '120px "Special Elite", Georgia, serif';
        ctx.save();
        ctx.translate(40, 170);
        ctx.rotate(-0.05);
        ctx.fillText('THEY HEAR', 0, 0);
        ctx.fillText('EVERYTHING', 30, 140);
        ctx.restore();
        // drips
        for (let i = 0; i < 26; i++) {
          const x = 60 + Math.random() * 900, y = 120 + Math.random() * 160;
          ctx.fillRect(x, y, 3 + Math.random() * 3, 20 + Math.random() * 70);
        }
      }),
    }),
  );
  scrawl.position.set(RX1 - 0.01, 1.35, 0.4);
  scrawl.rotation.y = -Math.PI / 2;
  room.add(scrawl);
  parts.scrawl = scrawl;

  // a rat lives under the stairs. you'll only ever see its eyes
  const ratEyes = new THREE.Group();
  for (const ex of [-0.012, 0.012]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 8), new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false }));
    e.position.x = ex;
    ratEyes.add(e);
  }
  ratEyes.position.set(-1.35, 0.05, 0.6);
  ratEyes.rotation.y = 0.9;
  ratEyes.visible = false;
  room.add(ratEyes);
  parts.ratEyes = ratEyes;

  // ── ambient: practically nothing
  const amb = new THREE.HemisphereLight(0x6c7a90, 0x050505, 0.06);
  room.add(amb);
  parts.amb = amb;

  // police lights pouring through the window: one light that flips red ↔ blue and swings
  const siren = new THREE.SpotLight(0xff2020, 0, 8, 0.55, 0.6, 1);
  siren.position.set(winX, winY + 0.1, RZ0 - 0.5);
  siren.target.position.set(0.2, 0.6, 0.5);
  room.add(siren, siren.target);
  parts.police = { siren };
  const flash = new THREE.SpotLight(0xf2f5ff, 0, 9, 0.22, 0.4, 1);
  flash.position.set(winX, winY, RZ0 - 0.4);
  flash.castShadow = true;
  flash.shadow.mapSize.set(1024, 1024);
  room.add(flash, flash.target);
  parts.flash = flash;

  parts.bounds = { RX0, RX1, RZ0, RZ1, RH };
  return { group: room, parts };
}

// Desk clutter: candle (burns down as the police get closer), cans, mug, a rubber duck.
export function createDeskProps() {
  const g = new THREE.Group();
  const parts = {};

  // candle on a saucer
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.4 }));
  saucer.position.y = 0.006;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 1, 20), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.7, emissive: 0x2a1a08, emissiveIntensity: 0.25 }));
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.012, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const flameMat = new THREE.MeshBasicMaterial({ map: radial(64, [[0, 'rgba(255,250,235,1)'], [0.35, 'rgba(255,200,120,0.9)'], [1, 'rgba(255,120,40,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.05), flameMat);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ map: radial(64, [[0, 'rgba(255,200,140,0.22)'], [1, 'rgba(255,160,80,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  // no shadow on the candle: a point-light shadow is six extra renders every frame
  const candleLight = new THREE.PointLight(0xffb070, 0.7, 2.2, 1.8);
  const candle = new THREE.Group();
  candle.add(saucer, wax, wick, flame, halo, candleLight);
  candle.position.set(-0.67, DESK_Y, -0.86);
  g.add(candle);
  parts.candle = { group: candle, wax, wick, flame, halo, light: candleLight, height: 0.16, lit: true };

  // energy drink cans
  const canTex = label(256, 128, (ctx) => {
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#9cff57';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = 0; x < 256; x += 16) ctx.lineTo(x, 64 + (x % 32 ? -30 : 30));
    ctx.stroke();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 30px Impact, Arial';
    ctx.fillText('VOLT', 90, 120);
  });
  const canMat = new THREE.MeshStandardMaterial({ map: canTex, roughness: 0.35, metalness: 0.6 });
  const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.125, 20);
  parts.cans = [];
  const canSpots = [
    [-0.62, -0.3, 0],
    [0.62, -0.62, 0],
    [-0.52, -0.82, 1],
    [0.44, -0.86, 1],
    [-0.68, -0.6, 0],
    [0.68, -0.4, 1],
    [0.3, -0.9, 0],
  ];
  canSpots.forEach(([x, z, lying], i) => {
    const c = new THREE.Mesh(canGeo, canMat);
    if (lying) {
      c.rotation.z = Math.PI / 2;
      c.rotation.y = i;
      c.position.set(x, DESK_Y + 0.033, z);
    } else c.position.set(x, DESK_Y + 0.0625, z);
    c.castShadow = true;
    c.visible = i < 1;
    g.add(c);
    parts.cans.push(c);
  });

  // mug
  const mug = new THREE.Group();
  const mugMat = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    map: label(256, 128, (ctx) => {
      ctx.fillStyle = '#e9e6df';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 22px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText("WORLD'S OKAYEST", 128, 58);
      ctx.fillText('HACKER', 128, 86);
    }),
  });
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.037, 0.095, 24, 1, true), mugMat);
  mugBody.position.y = 0.0475;
  // turn the printed side towards the chair
  mugBody.rotation.y = -2.9;
  const mugIn = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.2 }));
  mugIn.rotation.x = -Math.PI / 2;
  mugIn.position.y = 0.075;
  const mugBottom = new THREE.Mesh(new THREE.CircleGeometry(0.037, 24), mugMat);
  mugBottom.rotation.x = Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.3 }));
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.04, 0.05, 0);
  mug.add(mugBody, mugIn, mugBottom, handle);
  mug.position.set(-0.3, DESK_Y, -0.33);
  mug.traverse((o) => (o.castShadow = true));
  g.add(mug);
  parts.mug = mug;

  // rubber duck (debugging)
  const duck = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf3cc2c, roughness: 0.35 });
  const dbody = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), yellow);
  dbody.scale.set(1.25, 0.85, 1);
  dbody.position.y = 0.024;
  const dhead = new THREE.Mesh(new THREE.SphereGeometry(0.019, 18, 12), yellow);
  dhead.position.set(0.02, 0.058, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.4 }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.042, 0.055, 0);
  const deye = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const z of [-0.009, 0.009]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), deye);
    e.position.set(0.033, 0.064, z);
    duck.add(e);
  }
  duck.add(dbody, dhead, beak);
  duck.position.set(0.3, DESK_Y, -0.3);
  duck.rotation.y = 2.5;
  duck.traverse((o) => (o.castShadow = true));
  g.add(duck);
  parts.duck = duck;

  // sticky note stuck to the desk
  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(0.075, 0.075),
    new THREE.MeshStandardMaterial({
      roughness: 0.9,
      map: label(256, 256, (ctx) => {
        ctx.fillStyle = '#e6dc8a';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#1a1a3a';
        ctx.font = '34px "Special Elite", Georgia';
        ctx.fillText('wifi pw:', 24, 70);
        ctx.fillText('hunter2', 24, 120);
        ctx.font = '26px "Special Elite", Georgia';
        ctx.fillText('↑↑↓↓←→←→BA', 20, 200);
      }),
    }),
  );
  note.rotation.x = -Math.PI / 2;
  note.rotation.z = 0.25;
  note.position.set(-0.26, DESK_Y + 0.001, -0.2);
  g.add(note);
  parts.note = note;

  return { group: g, parts };
}
