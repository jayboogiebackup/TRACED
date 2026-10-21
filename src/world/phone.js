import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { label, smudge } from './textures.js';

// A Western Electric 500-style rotary desk phone, built from code.
// Origin = centre of the phone's footprint on the table. Units: metres.

const DIAL_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DIAL_LETTERS = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PRS', 'TUV', 'WXY', 'OPER'];
// hole angles (radians, CCW from +x as seen from the front)
const holeAngle = (i) => THREE.MathUtils.degToRad(42 + i * 29.5);
const STOP_ANGLE = THREE.MathUtils.degToRad(-35);

// body cross-sections from the table up: [height, half-width, half-depth, centre z]
const BODY = [
  [0.0, 0.104, 0.112, 0.0],
  [0.008, 0.106, 0.114, 0.0],
  [0.03, 0.104, 0.11, -0.002],
  [0.06, 0.097, 0.098, -0.008],
  [0.085, 0.088, 0.084, -0.014],
  [0.1, 0.079, 0.072, -0.018],
  [0.11, 0.068, 0.06, -0.02],
  [0.116, 0.052, 0.046, -0.021],
  [0.119, 0.03, 0.026, -0.021],
  [0.12, 0.0, 0.0, -0.021],
];

// smooth "squircle" loft through the BODY sections
function loftBody(rings = 44, segs = 72, n = 3.4) {
  const dims = new THREE.CatmullRomCurve3(BODY.map(([y, hx, hz]) => new THREE.Vector3(hx, y, hz)));
  const cz = new THREE.CatmullRomCurve3(BODY.map(([, , , z]) => new THREE.Vector3(z, 0, 0)));
  const pos = [], uv = [], idx = [];
  const p = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    dims.getPoint(t, p);
    cz.getPoint(t, c);
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      const co = Math.cos(th), si = Math.sin(th);
      const sx = Math.sign(co) * Math.pow(Math.abs(co), 2 / n);
      const sz = Math.sign(si) * Math.pow(Math.abs(si), 2 / n);
      pos.push(Math.max(0, p.x) * sx, p.y, c.x + Math.max(0, p.z) * sz);
      uv.push(j / segs, t);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j, b = i * segs + ((j + 1) % segs);
      const d = (i + 1) * segs + j, e = (i + 1) * segs + ((j + 1) % segs);
      idx.push(a, d, b, b, d, e);
    }
  // flat bottom
  const centre = pos.length / 3;
  pos.push(0, 0, 0);
  uv.push(0.5, 0);
  for (let j = 0; j < segs; j++) idx.push(centre, j, (j + 1) % segs);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // where the front surface is at body parameter t, and which way it faces
  const frontAt = (t) => {
    const a = dims.getPoint(t), b = cz.getPoint(t);
    return new THREE.Vector3(0, a.y, b.x + a.z);
  };
  return { geo, frontAt };
}

// a tube whose cross-section is an ellipse that changes size along the way
function sweptHandle(curve, steps, radius) {
  const pos = [], idx = [];
  const radial = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const P = curve.getPoint(t);
    const T = curve.getTangent(t);
    const N = new THREE.Vector3(-T.y, T.x, 0).normalize();
    const B = new THREE.Vector3(0, 0, 1);
    const [ry, rz] = radius(t);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const v = P.clone().addScaledVector(N, Math.cos(a) * ry).addScaledVector(B, Math.sin(a) * rz);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial);
      const d = (i + 1) * radial + j, e = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, b, d, b, e, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

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
    roughness: 0.42,
    roughnessMap: scratch,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    metalness: 0,
  });
  const wheelMat = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1c, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.18, metalness: 1 });
  const plungerMat = new THREE.MeshPhysicalMaterial({ color: 0xd8d4c8, roughness: 0.3, clearcoat: 0.6 });

  // ── base plate + feet
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.214, 0.007, 0.23, 2, 0.003), darkMat);
  plate.position.y = 0.0035;
  group.add(plate);
  for (const [x, z] of [
    [-0.09, -0.095],
    [0.09, -0.095],
    [-0.09, 0.095],
    [0.09, 0.095],
  ]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.003, 12), darkMat);
    foot.position.set(x, 0.0015, z);
    group.add(foot);
  }

  // ── body
  const { geo: shellGeo, frontAt } = loftBody();
  shellGeo.translate(0, 0.006, 0);
  const shell = new THREE.Mesh(shellGeo, bodyMat);
  shell.castShadow = shell.receiveShadow = true;
  group.add(shell);

  // ── dial, set into the sloped front
  const tD = 0.3;
  const P = frontAt(tD);
  const T = frontAt(tD + 0.02).sub(frontAt(tD - 0.02)).normalize();
  const N = new THREE.Vector3(0, -T.z, T.y).normalize(); // outward
  const dial = new THREE.Group();
  dial.position.copy(P).addScaledVector(N, 0.008);
  dial.position.y += 0.006;
  dial.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), N);
  group.add(dial);

  const R = 0.046;
  // housing: a short collar buried in the body with a rounded lip
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.007, R + 0.007, 0.034, 72, 1, true), bodyMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = -0.014;
  dial.add(collar);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.0032, 12, 72), bodyMat);
  lip.position.z = 0.002;
  dial.add(lip);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.007, 72), darkMat);
  floor.position.z = -0.006;
  dial.add(floor);

  // white number plate: digits sit exactly under the finger holes
  const ringTex = label(512, 512, (ctx, w) => {
    ctx.fillStyle = '#ebe7dc';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#121212';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      const a = holeAngle(i);
      const rr = w * 0.35;
      const x = w / 2 + Math.cos(a) * rr, y = w / 2 - Math.sin(a) * rr;
      ctx.font = 'bold 15px Georgia, serif';
      ctx.fillText(DIAL_LETTERS[i], x, y - 22);
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillText(DIAL_DIGITS[i], x, y + 8);
    }
    // centre card
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f6f3ea';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#8f8b80';
    ctx.stroke();
    ctx.fillStyle = '#7a1414';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText('EMERGENCY · DIAL 0', w / 2, w / 2 - 34);
    ctx.fillStyle = '#222';
    ctx.font = '24px Georgia, serif';
    ctx.fillText('UNLISTED', w / 2, w / 2 - 4);
    ctx.font = '19px Courier New, monospace';
    ctx.fillText('???-????', w / 2, w / 2 + 26);
  });
  const ring = new THREE.Mesh(new THREE.CircleGeometry(R + 0.002, 72), new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.5 }));
  ring.position.z = -0.005;
  dial.add(ring);
  // a clear dome over the centre card
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.42, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.22),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.005 - R * 0.42 * Math.cos(Math.PI * 0.22);
  dial.add(lens);

  // finger wheel: opaque, ten holes, rotates when you dial
  const wheelShape = new THREE.Shape();
  wheelShape.absarc(0, 0, R * 0.985, 0, Math.PI * 2, false);
  const holeR = 0.0074, holeDist = R * 0.7;
  for (let i = 0; i < 10; i++) {
    const a = holeAngle(i);
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * holeDist, Math.sin(a) * holeDist, holeR, 0, Math.PI * 2, true);
    wheelShape.holes.push(h);
  }
  const inner = new THREE.Path();
  inner.absarc(0, 0, R * 0.43, 0, Math.PI * 2, true);
  wheelShape.holes.push(inner);
  const wheel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wheelShape, { depth: 0.0035, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 3, curveSegments: 28 }),
    wheelMat,
  );
  wheel.position.z = -0.0035;
  wheel.castShadow = true;
  const wheelPivot = new THREE.Group();
  wheelPivot.add(wheel);
  dial.add(wheelPivot);

  // the finger stop: a curved chrome hook that rises off the rim and arches in over the
  // wheel at about 4 o'clock — your finger hits it at the end of each spin
  const stopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(R + 0.0065, 0, -0.002),
    new THREE.Vector3(R + 0.005, 0, 0.0055),
    new THREE.Vector3(R - 0.003, 0, 0.0085),
    new THREE.Vector3(R - 0.012, 0, 0.0068),
  ]);
  const stopGeo = new THREE.TubeGeometry(stopCurve, 20, 0.0016, 8);
  stopGeo.scale(1, 2.4, 1); // flatten the wire into a strip
  const stopGroup = new THREE.Group();
  stopGroup.add(new THREE.Mesh(stopGeo, metalMat));
  const stopTip = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 10, 8), metalMat);
  stopTip.position.copy(stopCurve.getPoint(1));
  stopTip.scale.set(1, 1.6, 0.8);
  stopGroup.add(stopTip);
  const stopFoot = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.01, 0.004, 2, 0.0012), metalMat);
  stopFoot.position.set(R + 0.0065, 0, -0.0005);
  stopGroup.add(stopFoot);
  stopGroup.rotation.z = STOP_ANGLE;
  dial.add(stopGroup);

  // ── cradle: a fork at each end with the hook-switch plungers between them
  const handsetY = 0.165;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.032, 6, 14), bodyMat);
      post.position.set(sx * 0.072, 0.13, -0.02 + sz * 0.027);
      post.rotation.x = sz * 0.18;
      post.castShadow = true;
      group.add(post);
    }
    const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.03, 0.05, 3, 0.009), bodyMat);
    saddle.position.set(sx * 0.072, 0.138, -0.02);
    group.add(saddle);
    const plunger = new THREE.Mesh(new RoundedBoxGeometry(0.015, 0.012, 0.015, 2, 0.003), plungerMat);
    plunger.position.set(sx * 0.036, 0.122, -0.02);
    group.add(plunger);
  }

  // ── handset: a swept handle with the earpiece and mouthpiece cups
  const handset = new THREE.Group();
  handset.name = 'handset';
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.108, -0.014, 0),
    new THREE.Vector3(-0.075, 0.003, 0),
    new THREE.Vector3(0, 0.009, 0),
    new THREE.Vector3(0.075, 0.003, 0),
    new THREE.Vector3(0.108, -0.014, 0),
  ]);
  // slimmer in the middle where you hold it, fuller where it meets the cups
  const handleGeo = sweptHandle(handleCurve, 60, (t) => {
    const end = Math.pow(Math.abs(t - 0.5) * 2, 3);
    return [0.0115 + end * 0.004, 0.0155 + end * 0.004];
  });
  const handle = new THREE.Mesh(handleGeo, bodyMat);
  handle.castShadow = true;
  handset.add(handle);

  const capTex = (rings) =>
    label(256, 256, (ctx, w) => {
      ctx.fillStyle = '#2c2c2c';
      ctx.fillRect(0, 0, w, w);
      ctx.fillStyle = '#060606';
      for (let r = 0; r < rings; r++) {
        const n = r === 0 ? 1 : r * 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r * 0.3;
          ctx.beginPath();
          ctx.arc(w / 2 + Math.cos(a) * r * 24, w / 2 + Math.sin(a) * r * 24, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  const earMat = new THREE.MeshPhysicalMaterial({ color: 0x8a8a8a, map: capTex(4), roughness: 0.4, clearcoat: 0.6 });
  const mouthMat = new THREE.MeshPhysicalMaterial({ color: 0x8a8a8a, map: capTex(3), roughness: 0.4, clearcoat: 0.6 });
  // lathe profile runs rim → top so the faces point outwards
  const cupGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0315, -0.0475),
      new THREE.Vector2(0.0335, -0.045),
      new THREE.Vector2(0.0325, -0.039),
      new THREE.Vector2(0.029, -0.027),
      new THREE.Vector2(0.023, -0.013),
      new THREE.Vector2(0.017, -0.003),
      new THREE.Vector2(0.001, 0.0),
    ],
    48,
  );
  const cups = [];
  for (const sx of [-1, 1]) {
    const cup = new THREE.Group();
    const shellC = new THREE.Mesh(cupGeo, bodyMat);
    shellC.castShadow = true;
    cup.add(shellC);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.0295, 40), sx > 0 ? earMat : mouthMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.y = -0.0462;
    cup.add(cap);
    cup.position.set(sx * 0.1, -0.006, 0);
    cup.rotation.z = sx * 0.16;
    handset.add(cup);
    cups.push(cup);
  }
  handset.position.set(0, handsetY, -0.02);
  group.add(handset);
  const handsetRest = handset.position.clone();
  const handsetRestRot = handset.rotation.clone();

  // ── coiled cord: mouthpiece end → down the side → loops on the table → into the body
  const cordMat = new THREE.MeshPhysicalMaterial({ color: 0x1e1e1e, roughness: 0.4, clearcoat: 0.8 });
  let cord = null;
  const cordAnchor = new THREE.Vector3();
  function rebuildCord() {
    handset.updateMatrix();
    cordAnchor.set(-0.118, -0.03, 0.0).applyMatrix4(handset.matrix);
    const start = cordAnchor.clone();
    const away = Math.max(0, start.distanceTo(new THREE.Vector3(-0.118, handsetY - 0.03, -0.02)));
    const sag = Math.max(0.006, 0.02 - away * 0.03);
    const pts = [
      start,
      start.clone().add(new THREE.Vector3(-0.022, -0.035, 0.03)),
      new THREE.Vector3(-0.155, 0.03 + away * 0.25, 0.08),
      new THREE.Vector3(-0.205, sag, 0.07),
      new THREE.Vector3(-0.24, sag, -0.01),
      new THREE.Vector3(-0.19, sag, -0.075),
      new THREE.Vector3(-0.13, 0.016, -0.07),
      new THREE.Vector3(-0.098, 0.022, -0.065),
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
  glowHandle.scale.set(1.04, 1.3, 1.3);
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
      windTarget = holeAngle(idx) - STOP_ANGLE;
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
      // the base pose (wherever the scene put the phone) is remembered on first update
      if (api.baseRotY === undefined) api.baseRotY = group.rotation.y;
      if (api.baseX === undefined) api.baseX = group.position.x;
      // shell buzzes back and forth while the bell is going
      if (ringT >= 0) {
        ringT += dt;
        const on = ringT < 2.05;
        if (!on) ringT = -1;
        const k = on ? Math.min(1, ringT * 8) * Math.min(1, (2.05 - ringT) * 6) : 0;
        const ph = ringT * Math.PI * 2 * 20;
        group.rotation.y = api.baseRotY + Math.sin(ph) * 0.009 * k + (Math.random() - 0.5) * 0.004 * k;
        group.rotation.z = Math.sin(ph * 0.5 + 1) * 0.004 * k;
        group.position.x = api.baseX + Math.sin(ph) * 0.0012 * k;
        if (!api.lifted) {
          handset.position.y = handsetRest.y + Math.abs(Math.sin(ph)) * 0.0022 * k;
          handset.rotation.z = Math.sin(ph * 1.5) * 0.012 * k;
        }
      } else {
        group.rotation.y = api.baseRotY + (group.rotation.y - api.baseRotY) * 0.8;
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
