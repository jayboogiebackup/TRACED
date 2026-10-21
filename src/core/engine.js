import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { VHSShader } from './vhs.js';

// Resolution steps the engine falls back through if frames get slow. The VHS look hides a
// lower internal resolution well, so stepping down costs little and buys a lot.
const PR_STEPS = [1.5, 1.25, 1.0, 0.8, 0.65];

export class Engine {
  constructor(container, o = {}) {
    RectAreaLightUniformsLib.init();

    // phones: no MSAA (the tape filter hides jaggies anyway) and a lower resolution cap
    const renderer = new THREE.WebGLRenderer({ antialias: !o.phone, powerPreference: 'high-performance' });
    this.prCap = o.phone ? 1.25 : 1.5;
    this.prLevel = PR_STEPS.findIndex((p) => p <= Math.min(window.devicePixelRatio || 1, this.prCap));
    if (this.prLevel < 0) this.prLevel = PR_STEPS.length - 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PR_STEPS[this.prLevel]));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // shadows are re-rendered only when something that casts them moves (see frame())
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.setClearColor(0x000000, 1);
    this.liveShadows = false;
    this.shadowsDirty = true;
    this.lowPower = false;
    this.perf = { frames: 0, time: 0, grace: 3 };
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.canvas = renderer.domElement;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 60);

    const composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.55, 0.5, 0.86);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.vhs = new ShaderPass(VHSShader);
    composer.addPass(this.vhs);
    this.composer = composer;
    this.u = this.vhs.uniforms;

    this.time = 0;
    this.updaters = new Set();
    this.tweens = [];
    this.shake = 0;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setScene(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.shadowsDirty = true;
    this.perf.grace = 3; // shader warm-up after a scene change isn't a slow machine
    this.resize();
  }

  // Watch the real frame rate; if it stays low, step the quality down (never back up,
  // so it doesn't flicker between settings).
  watchPerf(realDt) {
    const p = this.perf;
    if (document.hidden || realDt > 0.25) return; // tab hidden / one-off hitch
    if (p.grace > 0) {
      p.grace -= realDt;
      return;
    }
    p.frames++;
    p.time += realDt;
    if (p.time < 2.5) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    if (fps >= 45) return;
    if (this.prLevel < PR_STEPS.length - 1) {
      this.prLevel++;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PR_STEPS[this.prLevel]));
      this.resize();
    } else if (this.bloom.enabled) {
      this.bloom.enabled = false;
    }
    // past the first step, the laptop screen also redraws less often
    if (this.prLevel >= 2) this.lowPower = true;
    p.grace = 1.5;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.u.uRes.value.set(w * pr, h * pr);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  onUpdate(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  // tween(obj, {key: target}, seconds, ease) → promise
  tween(obj, to, dur = 1, ease = easeInOut) {
    return new Promise((resolve) => {
      const from = {};
      for (const k in to) from[k] = obj[k];
      this.tweens.push({ obj, from, to, dur, t: 0, ease, resolve });
    });
  }

  // tween arbitrary progress 0..1 through a callback
  animate(dur, fn, ease = easeInOut) {
    const o = { p: 0 };
    return new Promise((resolve) => {
      this.tweens.push({ obj: o, from: { p: 0 }, to: { p: 1 }, dur, t: 0, ease, resolve, fn });
    });
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      this.watchPerf(dt);
      if (dt > 0.1) dt = 0.1;
      this.frame(dt, true);
    };
    requestAnimationFrame(loop);
  }

  frame(dt, render = true) {
    this.time += dt;
    this.u.uTime.value = this.time;
    if (this.paused) {
      if (render) this.composer.render(dt);
      return;
    }
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      const e = tw.ease(p);
      for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (tw.fn) tw.fn(e, p);
      if (p >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
    for (const fn of this.updaters) fn(dt, this.time);
    if (this.liveShadows || this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    if (render) this.composer.render(dt);
  }

  // debug: advance the world without waiting for real frames
  async step(seconds, dt = 1 / 30) {
    for (let t = 0; t < seconds; t += dt) {
      this.frame(dt, false);
      await null;
    }
    this.composer.render(dt);
  }
}

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const linear = (t) => t;
let ENGINE = null;
export const setEngine = (e) => (ENGINE = e);
// waits run on engine time, so pausing freezes cutscenes too
export const wait = (s) => ENGINE.animate(s, () => {}, linear);
