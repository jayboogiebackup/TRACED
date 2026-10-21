import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { label, smudge } from './textures.js';

// A Western Electric 500-style rotary desk phone, built from primitives.
// Origin = centre of the phone's footprint on the table. Units: metres.

const DIAL_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DIAL_LETTERS = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PRS', 'TUV', 'WXY', 'OPER'];
// hole angles (radians, CCW from +x as seen from the front)
const holeAngle = (i) => THREE.MathUtils.degToRad(42 + i * 29.5);

class CoilCurve extends THREE.Curve {
  constructor(base, turns, radius) {
    super();
    this.base = base;
    this.turns = turns;
    this.radius = radius;
    this.N = 400;
    this.frames = base.computeFrenetFrames(this.N, false);
  }
  getPoint(t, target = new THREE.Vector3()) {
    const p = this.base.getPointAt(t);
    const i = Math.min(this.N, Math.round(t * this.N));
    const a = t * this.turns * Math.PI * 2;
    const n = this.frames.normals[i], b = this.frames.binormals[i];
    // the coil relaxes near both ends
    const r = this.radius * Math.min(1, t * 30, (1 - t) * 30);
    return target.copy(p).addScaledVector(n, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
  }
}

export function createPhone(opts = {}) {
  const group = new THREE.Group();
  group.name = 'phone';
  const scratch = smudge(2);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0x5c5c5c,
    roughness: 0.38,
    roughnessMap: scratch,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    metalness: 0,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.25, metalness: 1 });
  const wheelMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfd6d8,
    roughness: 0.08,
    transparent: true,
    opacity: 0.32,
    clearcoat: 1,
    depthWrite: false,
  });

  // ── base plate
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.212, 0.008, 0.226, 2, 0.003), darkMat);
  plate.position.y = 0.004;
  group.add(plate);

  // ── shell: side profile extruded across the width, bevels round the sides
  const W = 0.168;
  const prof = new THREE.Shape();
  prof.moveTo(-0.11, 0);
  prof.lineTo(0.11, 0);
  prof.lineTo(0.11, 0.01);
  prof.lineTo(0.061, 0.094);
  prof.quadraticCurveTo(0.052, 0.112, 0.032, 0.113);
  prof.lineTo(-0.058, 0.113);
  prof.quadraticCurveTo(-0.086, 0.113, -0.096, 0.083);
  prof.lineTo(-0.11, 0.012);
  prof.lineTo(-0.11, 0);
  const shellGeo = new THREE.ExtrudeGeometry(prof, {
    depth: W,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.012,
    bevelSegments: 10,
    curveSegments: 16,
  });
  shellGeo.rotateY(-Math.PI / 2);
  shellGeo.translate(W / 2, 0.006, 0);
  // the 500's sides lean inwards towards the top
  {
    const p = shellGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 - 0.17 * THREE.MathUtils.clamp(y / 0.12, 0, 1);
      p.setX(i, p.getX(i) * k);
    }
  }
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, bodyMat);
  shell.castShadow = shell.receiveShadow = true;
  group.add(shell);

  // ── the dial sits on the sloped front face
  const slopeA = new THREE.Vector2(0.11, 0.016), slopeB = new THREE.Vector2(0.061, 0.1);
  const mid = slopeA.clone().lerp(slopeB, 0.47);
  const dir = slopeB.clone().sub(slopeA).normalize();
  const nrm = new THREE.Vector2(dir.y, -dir.x); // outward (z,y)
  const dial = new THREE.Group();
  dial.position.set(0, mid.y + 0.006, mid.x);
  dial.position.addScaledVector(new THREE.Vector3(0, nrm.y, nrm.x), 0.018);
  dial.lookAt(dial.position.clone().add(new THREE.Vector3(0, nrm.y, nrm.x)));
  group.add(dial);

  const R = 0.046;
  // recessed cup the dial sits in
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.004, 0.02, 48, 1, true), bodyMat);
  cup.rotation.x = Math.PI / 2;
  cup.position.z = -0.008;
  dial.add(cup);

  // white number ring
  const ringTex = label(512, 512, (ctx, w) => {
    ctx.fillStyle = '#e9e6dc';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      const a = holeAngle(i);
      const rr = w * 0.35;
      const x = w / 2 + Math.cos(a) * rr, y = w / 2 - Math.sin(a) * rr;
      ctx.save();
      ctx.translate(x, y);
      ctx.font = 'bold 40px Georgia, serif';
      ctx.fillText(DIAL_DIGITS[i], 0, 10);
      ctx.font = 'bold 17px Georgia, serif';
      ctx.fillText(DIAL_LETTERS[i], 0, -22);
      ctx.restore();
    }
    // centre card
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f4f1e8';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#9a968c';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.font = '22px Georgia, serif';
    ctx.fillText('UNLISTED', w / 2, w / 2 - 14);
    ctx.font = '18px Courier New, monospace';
    ctx.fillText('???-????', w / 2, w / 2 + 16);
  });
  const ring = new THREE.Mesh(
    new THREE.CircleGeometry(R, 64),
    new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.55 }),
  );
  dial.add(ring);

  // clear finger wheel with ten holes
  const wheelShape = new THREE.Shape();
  wheelShape.absarc(0, 0, R * 0.98, 0, Math.PI * 2, false);
  const holeR = 0.0072, holeDist = R * 0.7;
  for (let i = 0; i < 10; i++) {
    const a = holeAngle(i);
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * holeDist, Math.sin(a) * holeDist, holeR, 0, Math.PI * 2, true);
    wheelShape.holes.push(h);
  }
  const inner = new THREE.Path();
  inner.absarc(0, 0, R * 0.42, 0, Math.PI * 2, true);
  wheelShape.holes.push(inner);
  const wheel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wheelShape, { depth: 0.004, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 2, curveSegments: 24 }),
    wheelMat,
  );
  wheel.position.z = 0.002;
  wheel.renderOrder = 2;
  const wheelPivot = new THREE.Group();
  wheelPivot.add(wheel);
  dial.add(wheelPivot);

  // finger stop
  const stop = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0016, 6, 12, Math.PI * 0.9), metalMat);
  const sa = THREE.MathUtils.degToRad(-35);
  stop.position.set(Math.cos(sa) * R * 0.93, Math.sin(sa) * R * 0.93, 0.008);
  stop.rotation.z = sa + Math.PI / 2;
  dial.add(stop);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 16), metalMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.006;
  dial.add(hub);

  // ── cradle: two horns + the hook-switch plungers
  const hornGeo = new RoundedBoxGeometry(0.05, 0.04, 0.07, 5, 0.017);
  const horns = [];
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, bodyMat);
    horn.position.set(sx * 0.07, 0.126, -0.012);
    horn.castShadow = true;
    group.add(horn);
    horns.push(horn);
    const plunger = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.02, 0.016, 2, 0.004), wheelMat);
    plunger.position.set(sx * 0.034, 0.126, -0.012);
    group.add(plunger);
  }

  // ── handset
  const handset = new THREE.Group();
  handset.name = 'handset';
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.112, -0.004, 0),
    new THREE.Vector3(-0.07, 0.012, 0),
    new THREE.Vector3(0, 0.017, 0),
    new THREE.Vector3(0.07, 0.012, 0),
    new THREE.Vector3(0.112, -0.004, 0),
  ]);
  const handleGeo = new THREE.TubeGeometry(handleCurve, 48, 0.016, 18, false);
  handleGeo.scale(1, 0.85, 1.15);
  const handle = new THREE.Mesh(handleGeo, bodyMat);
  handle.castShadow = true;
  handset.add(handle);

  const capTex = label(256, 256, (ctx, w) => {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#050505';
    for (let r = 0; r < 4; r++) {
      const n = r === 0 ? 1 : r * 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(w / 2 + Math.cos(a) * r * 26, w / 2 + Math.sin(a) * r * 26, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x777777, map: capTex, roughness: 0.45, clearcoat: 0.6 });
  const cupProfile = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.03, 0),
    new THREE.Vector2(0.032, 0.006),
    new THREE.Vector2(0.03, 0.016),
    new THREE.Vector2(0.022, 0.03),
    new THREE.Vector2(0.016, 0.042),
  ];
  const cupGeo = new THREE.LatheGeometry(cupProfile, 32);
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(cupGeo, bodyMat);
    c.position.set(sx * 0.098, -0.045, 0);
    c.rotation.z = sx * -0.12;
    c.castShadow = true;
    handset.add(c);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.027, 32), capMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(sx * 0.098, -0.0455, 0);
    handset.add(cap);
  }
  handset.position.set(0, 0.178, -0.012);
  group.add(handset);
  const handsetRest = handset.position.clone();
  const handsetRestRot = handset.rotation.clone();

  // ── coiled cord: handset end → down the side → loops on the table → into the body
  const cordMat = new THREE.MeshPhysicalMaterial({ color: 0x1e1e1e, roughness: 0.4, clearcoat: 0.8 });
  let cord = null;
  const cordAnchor = new THREE.Vector3();
  function rebuildCord() {
    handset.updateMatrix();
    cordAnchor.set(-0.112, -0.05, 0.0).applyMatrix4(handset.matrix);
    const start = cordAnchor.clone();
    const away = Math.max(0, start.distanceTo(new THREE.Vector3(-0.112, 0.13, -0.012)));
    const sag = Math.max(0.006, 0.02 - away * 0.03);
    const pts = [
      start,
      start.clone().add(new THREE.Vector3(-0.02, -0.04, 0.03)),
      new THREE.Vector3(-0.15, 0.03 + away * 0.25, 0.08),
      new THREE.Vector3(-0.2, sag, 0.07),
      new THREE.Vector3(-0.235, sag, -0.01),
      new THREE.Vector3(-0.185, sag, -0.075),
      new THREE.Vector3(-0.13, 0.016, -0.06),
      new THREE.Vector3(-0.112, 0.024, -0.05),
    ];
    const base = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = base.getLength();
    const coil = new CoilCurve(base, len * 260, 0.0075);
    const geo = new THREE.TubeGeometry(coil, Math.floor(len * 3200), 0.0022, 6, false);
    if (cord) {
      cord.geometry.dispose();
      cord.geometry = geo;
    } else {
      cord = new THREE.Mesh(geo, cordMat);
      cord.castShadow = true;
      group.add(cord);
    }
  }
  rebuildCord();

  // line cord out the back into the dark
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.05, 0.02, -0.11),
        new THREE.Vector3(0.09, 0.004, -0.2),
        new THREE.Vector3(0.05, 0.003, -0.45),
        new THREE.Vector3(0.2, 0.003, -1.2),
      ]),
      40,
      0.0028,
      6,
    ),
    cordMat,
  );
  group.add(line);

  // ── hover glow: an inverted hull, like the reference's white drop-shadow
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false });
  const glowShell = new THREE.Mesh(shellGeo, glowMat);
  glowShell.scale.setScalar(1.045);
  glowShell.position.y = -0.003;
  group.add(glowShell);
  const glowHandle = new THREE.Mesh(handleGeo, glowMat);
  glowHandle.scale.setScalar(1.14);
  handset.add(glowHandle);

  // clickable proxy (bigger than the phone so it's easy to hit)
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.1;
  group.add(hit);

  // ── behaviour
  let ringT = -1;
  let glow = 0, glowTarget = 0;
  let spin = 0, spinV = 0, windTarget = 0, winding = false;
  const api = {
    group,
    handset,
    hit,
    dial,
    wheelPivot,
    ringing: false,
    lifted: false,
    rebuildCord,
    // call when a ring burst starts
    ring() {
      ringT = 0;
    },
    setGlow(v) {
      glowTarget = v;
    },
    // spin the finger wheel for a digit (0-9), returns seconds
    dialDigit(d) {
      const idx = d === 0 ? 9 : d - 1;
      windTarget = holeAngle(idx) - THREE.MathUtils.degToRad(-35);
      winding = true;
      spinV = 0;
      return windTarget / 7 + windTarget / 4;
    },
    holeWorldPosition(d) {
      const idx = d === 0 ? 9 : d - 1;
      const a = holeAngle(idx);
      return wheel.localToWorld(new THREE.Vector3(Math.cos(a) * holeDist, Math.sin(a) * holeDist, 0.004));
    },
    update(dt) {
      // shell buzzes back and forth while the bell is going
      if (ringT >= 0) {
        ringT += dt;
        const on = ringT < 2.05;
        if (!on) ringT = -1;
        const k = on ? Math.min(1, ringT * 8) * Math.min(1, (2.05 - ringT) * 6) : 0;
        const ph = ringT * Math.PI * 2 * 20;
        group.rotation.y = Math.sin(ph) * 0.009 * k + (Math.random() - 0.5) * 0.004 * k;
        group.rotation.z = Math.sin(ph * 0.5 + 1) * 0.004 * k;
        group.position.x = (api.baseX ?? 0) + Math.sin(ph) * 0.0012 * k;
        if (!api.lifted) {
          handset.position.y = handsetRest.y + Math.abs(Math.sin(ph)) * 0.0022 * k;
          handset.rotation.z = Math.sin(ph * 1.5) * 0.012 * k;
        }
      } else {
        group.rotation.y *= 0.8;
        group.rotation.z *= 0.8;
      }
      glow += (glowTarget - glow) * Math.min(1, dt * 8);
      glowMat.opacity = glow * 0.5;
      glowShell.visible = glowHandle.visible = glow > 0.01;
      // rotary dial: wind to the finger stop, then spring home
      if (winding) {
        spin = Math.min(windTarget, spin + dt * 7);
        if (spin >= windTarget) winding = false;
      } else if (spin > 0.0001) {
        spinV = Math.min(spinV + dt * 9, 5.5);
        spin = Math.max(0, spin - spinV * dt);
      }
      wheelPivot.rotation.z = -spin;
    },
    resetHandset() {
      handset.position.copy(handsetRest);
      handset.rotation.copy(handsetRestRot);
      api.lifted = false;
      rebuildCord();
    },
    handsetRest,
  };
  return api;
}
