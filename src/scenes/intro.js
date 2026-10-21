import * as THREE from 'three';
import { createPhone } from '../world/phone.js';
import { wood, radial } from '../world/textures.js';

// Darkness. One phone. One weak light. It's ringing.
export function createIntro(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.55);

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 20);
  const camBase = new THREE.Vector3(0.0, 0.36, 0.92);
  const lookBase = new THREE.Vector3(-0.02, 0.07, 0);
  camera.position.copy(camBase);
  camera.lookAt(lookBase);

  // table top (only visible inside the pool of light)
  const w = wood(3, [70, 52, 38]);
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshStandardMaterial({ map: w.map, roughnessMap: w.roughnessMap, roughness: 0.75, color: 0xd0d0d0 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  const phone = createPhone();
  phone.group.rotation.y = 0;
  scene.add(phone.group);

  // single weak bulb above — the faint shadow
  const spot = new THREE.SpotLight(0xfff0dc, 3.2, 3.4, 0.4, 0.9, 1.4);
  spot.position.set(0.12, 1.2, 0.55);
  spot.target.position.set(0, 0.04, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.01;
  spot.shadow.radius = 7;
  spot.shadow.camera.near = 0.4;
  spot.shadow.camera.far = 3;
  scene.add(spot, spot.target);

  // a cold edge light so the silhouette separates from the black
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.35);
  rim.position.set(-1, 0.6, -1.2);
  scene.add(rim);
  const fill = new THREE.HemisphereLight(0x8090a0, 0x000000, 0.05);
  scene.add(fill);

  // dust drifting through the light
  const dustCount = 260;
  const dustGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(dustCount * 3);
  const vel = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 0.7;
    pos[i * 3 + 1] = Math.random() * 0.7;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    vel[i * 3] = (Math.random() - 0.5) * 0.004;
    vel[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      size: 0.0045,
      map: radial(64),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffffff,
    }),
  );
  scene.add(dust);

  const state = {
    scene,
    camera,
    phone,
    spot,
    camBase,
    lookBase,
    drift: 1,
    lookOffset: new THREE.Vector3(),
    camOffset: new THREE.Vector3(),
    shake: 0,
    hover: false,
  };

  const mouse = new THREE.Vector2(0, 0);
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  state.pointer = (x, y) => {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    mouse.copy(ndc);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(phone.hit, false).length > 0;
  };

  let t = 0;
  state.update = (dt) => {
    t += dt;
    phone.update(dt);
    // slow creeping dolly + breathing + a little parallax from the mouse
    const d = state.drift;
    const target = camBase.clone();
    target.x += Math.sin(t * 0.21) * 0.012 * d + mouse.x * 0.02 * d;
    target.y += Math.sin(t * 0.33) * 0.006 * d + mouse.y * 0.012 * d;
    target.z -= Math.min(t * 0.0022, 0.08) * d;
    target.add(state.camOffset);
    camera.position.lerp(target, Math.min(1, dt * 2));
    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake * 0.01;
      camera.position.y += (Math.random() - 0.5) * state.shake * 0.01;
      state.shake = Math.max(0, state.shake - dt * 0.05);
    }
    camera.lookAt(lookBase.clone().add(state.lookOffset));

    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount * 3; i += 3) {
      p[i] += vel[i] * dt * 6;
      p[i + 1] += vel[i + 1] * dt * 6;
      p[i + 2] += vel[i + 2] * dt * 6;
      if (Math.abs(p[i]) > 0.35) vel[i] *= -1;
      if (p[i + 1] < 0 || p[i + 1] > 0.7) vel[i + 1] *= -1;
      if (Math.abs(p[i + 2]) > 0.3) vel[i + 2] *= -1;
    }
    dustGeo.attributes.position.needsUpdate = true;
    // bulb wavers
    spot.intensity = 3.2 * (0.94 + Math.sin(t * 7.3) * 0.02 + Math.sin(t * 13.1) * 0.02 + (Math.random() < 0.004 ? -0.4 : 0));
  };

  // screen-space position of the phone (for the PICK UP prompt)
  state.screenPos = (offset = new THREE.Vector3(0.12, 0.02, 0.1)) => {
    const v = phone.group.position.clone().add(offset).project(camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  };

  return state;
}
