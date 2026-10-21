import { Vector2 } from 'three';

// Real-time version of the exorciseyourex.com look. On their site the grain,
// line wobble and red/cyan fringe are baked into pre-rendered stills and the
// vignette + scanlines are CSS. Here the scene is live 3D, so the "baked" part
// happens in this pass and the exact CSS overlays sit on top (see style.css).
export const VHSShader = {
  name: 'VHSShader',
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uAmount: { value: 1 }, // master strength (pause-menu slider)
    uJitter: { value: 1.35 }, // per-row tape wobble, px
    uChroma: { value: 1.6 }, // red/cyan fringe, px
    uGrain: { value: 0.11 },
    uSat: { value: 0.22 }, // the reference is almost fully grey
    uWarp: { value: 0.45 }, // rolling tracking band
    uGlitch: { value: 0 }, // 0..1 heavy tape damage (transitions, scares)
    uBlindL: { value: 0 }, // sold a cornea
    uBlindR: { value: 0 },
    uRed: { value: 0 }, // pain pulse
    uPale: { value: 0 }, // blood loss
    uFade: { value: 0 }, // to black
    uFlash: { value: 0 }, // to white
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uAmount, uJitter, uChroma, uGrain, uSat, uWarp, uGlitch;
    uniform float uBlindL, uBlindR, uRed, uPale, uFade, uFlash;
    varying vec2 vUv;

    float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float vnoise(float x) {
      float i = floor(x), f = fract(x);
      float u = f * f * (3.0 - 2.0 * f);
      return mix(hash11(i), hash11(i + 1.0), u);
    }
    float bayer4(vec2 p) {
      vec2 q = mod(floor(p), 4.0);
      float a = mod(q.x, 2.0), b = mod(q.y, 2.0);
      float c = step(2.0, q.x), d = step(2.0, q.y);
      float v = 8.0 * abs(a - b) + 4.0 * b + 2.0 * abs(c - d) + d;
      return v / 16.0;
    }
    vec3 tap(vec2 uv) { return texture2D(tDiffuse, clamp(uv, vec2(0.001), vec2(0.999))).rgb; }

    void main() {
      vec2 uv = vUv;
      float t = uTime;
      float A = uAmount;
      float px = 1.0 / uRes.x;
      float row = floor(uv.y * uRes.y);

      // per-row tape wobble -> the combed horizontal edges in the reference stills
      float wob = vnoise(row * 0.23 + t * 11.0) - 0.5;
      wob += (vnoise(row * 0.031 - t * 2.7) - 0.5) * 0.8;
      float off = wob * 2.0 * uJitter * px * A;
      off += sin(uv.y * 21.0 + t * 1.7) * 0.45 * px * A;

      // slow rolling tracking band
      float bp = fract(t * 0.043) * 1.4 - 0.2;
      float band = smoothstep(0.045, 0.0, abs(uv.y - bp));
      off += band * (hash12(vec2(row, floor(t * 30.0))) - 0.5) * 9.0 * px * uWarp * A;

      // heavy damage
      float G = uGlitch;
      if (G > 0.0) {
        float blk = floor(uv.y * (14.0 + 30.0 * hash11(floor(t * 9.0))));
        float g = hash11(blk * 3.17 + floor(t * 24.0));
        off += step(1.0 - G * 0.55, g) * (hash11(blk * 1.91 + floor(t * 31.0)) - 0.5) * 0.22 * G;
        uv.y = fract(uv.y + G * G * 0.04 * sin(t * 37.0) * step(0.6, hash11(floor(t * 8.0))));
      }
      uv.x += off;

      // red / cyan fringe
      float ca = (uChroma * A + G * 9.0 + band * 3.0) * px;
      vec3 col;
      col.r = tap(uv + vec2(ca, 0.0)).r;
      col.g = tap(uv).g;
      col.b = tap(uv - vec2(ca, 0.0)).b;

      // VHS keeps luma sharp but smears colour sideways
      vec3 sm = vec3(0.0);
      for (int i = -3; i <= 3; i++) sm += tap(uv + vec2(float(i) * 2.6 * px, 0.0));
      sm /= 7.0;
      float L = dot(col, vec3(0.299, 0.587, 0.114));
      float Ls = dot(sm, vec3(0.299, 0.587, 0.114));
      vec3 chroma = sm - Ls;
      col = vec3(L) + chroma * uSat;
      col *= vec3(0.955, 0.985, 1.04); // cold grey like the stills

      // interlace + streaks
      col *= 1.0 - 0.055 * mod(row, 2.0) * A;
      float streak = hash12(vec2(row, floor(t * 24.0)));
      col += (streak - 0.5) * 0.04 * A * (0.25 + L);
      // dropout specks
      float drop = step(0.99993 - G * 0.004, hash12(vec2(floor(uv.x * uRes.x / 14.0), row + floor(t * 20.0) * 7.0)));
      col = mix(col, vec3(0.75), drop * 0.45 * A);

      // grain + stipple (the dotted texture on the skull)
      float gr = hash12(gl_FragCoord.xy + fract(t * 7.13) * 917.0) - 0.5;
      float mid = clamp(L * (1.0 - L) * 4.0, 0.0, 1.0);
      col += gr * uGrain * A * (0.45 + 0.9 * mid);
      col *= 1.0 + (bayer4(gl_FragCoord.xy) - 0.5) * 0.09 * A * mid;

      // body damage states
      float Lp = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(Lp) * 1.12 + 0.03, uPale * 0.7);
      vec2 c = vUv - 0.5;
      float edge = smoothstep(0.2, 0.75, length(c * vec2(1.3, 1.0)));
      col = mix(col, col * vec3(1.35, 0.35, 0.35) + vec3(0.12, 0.0, 0.0) * edge, uRed * (0.35 + 0.65 * edge));
      float eyeL = smoothstep(0.58, 0.18, vUv.x);
      float eyeR = smoothstep(0.42, 0.82, vUv.x);
      col *= 1.0 - uBlindL * eyeL * 0.94;
      col *= 1.0 - uBlindR * eyeR * 0.94;

      // lifted VHS blacks
      col = max(col, 0.0) * 0.975 + 0.008 * A;
      col = mix(col, vec3(1.0), uFlash);
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
