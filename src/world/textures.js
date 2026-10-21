import * as THREE from 'three';

// Procedural textures drawn into canvases at load time — no image files.

let seed = 1337;
export function srand(s) {
  seed = s;
}
export function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

// tileable value noise
function makeNoise(period, s) {
  const g = new Float32Array(period * period);
  srand(s);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const i0 = ((xi % period) + period) % period, j0 = ((yi % period) + period) % period;
    const i1 = (i0 + 1) % period, j1 = (j0 + 1) % period;
    const a = g[j0 * period + i0], b = g[j0 * period + i1], c = g[j1 * period + i0], d = g[j1 * period + i1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(n, x, y, oct) {
  let s = 0, a = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    s += n(x * f, y * f) * a;
    tot += a;
    a *= 0.5;
    f *= 2;
  }
  return s / tot;
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// field(x,y) in [0,1] → painted by fn(v, x, y) → [r,g,b]
function paint(size, field, fn) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = field(x, y);
      const [r, g, b] = fn(v, x, y);
      const i = (y * size + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

const cache = {};

export function concrete(repeat = 2) {
  if (!cache.concrete) {
    const S = 512;
    const n1 = makeNoise(16, 11), n2 = makeNoise(64, 12), n3 = makeNoise(8, 13);
    const field = (x, y) => {
      const u = x / S, v = y / S;
      return fbm(n1, u * 16, v * 16, 5) * 0.6 + fbm(n2, u * 64, v * 64, 3) * 0.25 + n3(u * 8, v * 8) * 0.15;
    };
    const vals = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) vals[y * S + x] = field(x, y);
    srand(77);
    const pits = new Set();
    for (let i = 0; i < 2600; i++) pits.add(((rnd() * S) | 0) + ((rnd() * S) | 0) * S);
    const get = (x, y) => vals[y * S + x];
    const map = paint(S, get, (v, x, y) => {
      let c = 70 + v * 70;
      // damp stains
      c -= Math.max(0, n3((x / S) * 8 + 3, (y / S) * 8) - 0.6) * 90;
      if (pits.has(x + y * S)) c *= 0.55;
      return [c, c * 0.98, c * 0.95];
    });
    const rough = paint(S, get, (v) => {
      const c = 170 + v * 80;
      return [c, c, c];
    });
    const bump = paint(S, get, (v, x, y) => {
      let c = v * 255;
      if (pits.has(x + y * S)) c *= 0.3;
      return [c, c, c];
    });
    cache.concrete = { map, rough, bump };
  }
  const c = cache.concrete;
  return {
    map: tex(c.map, { repeat }),
    roughnessMap: tex(c.rough, { repeat, srgb: false }),
    bumpMap: tex(c.bump, { repeat, srgb: false }),
  };
}

export function wood(repeat = 1, tone = [92, 64, 42]) {
  const key = 'wood' + tone.join();
  if (!cache[key]) {
    const S = 512;
    const n = makeNoise(32, 21), n2 = makeNoise(128, 22);
    const map = paint(
      S,
      (x, y) => {
        const u = x / S, v = y / S;
        const warp = fbm(n, u * 4, v * 32, 4) * 6;
        return (Math.sin((v * 40 + warp) * Math.PI) * 0.5 + 0.5) * 0.6 + fbm(n2, u * 128, v * 8, 2) * 0.4;
      },
      (v) => {
        const k = 0.55 + v * 0.55;
        return [tone[0] * k, tone[1] * k, tone[2] * k];
      },
    );
    const rough = paint(S, (x, y) => fbm(n2, (x / S) * 64, (y / S) * 8, 3), (v) => {
      const c = 150 + v * 90;
      return [c, c, c];
    });
    cache[key] = { map, rough };
  }
  const c = cache[key];
  return { map: tex(c.map, { repeat }), roughnessMap: tex(c.rough, { repeat, srgb: false }) };
}

// fine smudges / micro-scratches for plastics and metal
export function smudge(repeat = 1) {
  if (!cache.smudge) {
    const S = 256;
    const n = makeNoise(16, 31);
    const c = paint(S, (x, y) => fbm(n, (x / S) * 16, (y / S) * 16, 4), (v) => {
      const k = 120 + v * 110;
      return [k, k, k];
    });
    const ctx = c.getContext('2d');
    srand(5);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 90; i++) {
      ctx.lineWidth = rnd() * 0.8;
      ctx.beginPath();
      const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 10 + rnd() * 50;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    cache.smudge = c;
  }
  return tex(cache.smudge, { repeat, srgb: false });
}

// text painted on a canvas (labels, stickers, warning signs)
export function label(w, h, draw) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// gradient blob, used for light pools / glows / dust
export function radial(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
