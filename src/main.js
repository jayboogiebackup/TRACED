// fonts are bundled with the game: no requests to Google (or anyone)
import '@fontsource/special-elite';
import '@fontsource/anonymous-pro/400.css';
import '@fontsource/anonymous-pro/700.css';
import '@fontsource/vt323';
import './style.css';
import { Engine, setEngine, wait } from './core/engine.js';
import { audio } from './core/audio.js';
import { createIntro } from './scenes/intro.js';
import { createGame } from './scenes/game.js';
import { createEndings } from './scenes/endings.js';
import { createDirector } from './game/director.js';
import { gatherInfo } from './game/userinfo.js';
import * as ST from './game/state.js';
import { ringingPhone, theCall, toBasement } from './story.js';
import { hint } from './ui/dialog.js';
import { device } from './core/device.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const engine = new Engine(document.querySelector('#stage'), { phone: device.phone });
setEngine(engine);

gatherInfo();

const intro = createIntro(engine);
engine.setScene(intro.scene, intro.camera);
const stopIntro = engine.onUpdate((dt) => intro.update(dt));
engine.start();

// The intro is just a phone, so it's up immediately. The basement is far heavier: build it
// a beat later (while the phone is ringing in the dark), then warm up its shaders in the
// background so the cut to the basement doesn't stutter.
let game = null, director = null;
const endings = createEndings(engine, () => game);
const gameReady = new Promise((resolve) => {
  setTimeout(() => {
    const t0 = performance.now();
    game = createGame(engine);
    director = createDirector(engine, game, endings);
    game.policeLights = director.policeLights;
    engine.onUpdate((dt, t) => {
      if (engine.scene === game.scene) {
        game.update(dt, t);
        director.update(dt * (DEBUG && params.get('speed') ? +params.get('speed') : 1));
      }
    });
    if (DEBUG) console.log(`basement built in ${Math.round(performance.now() - t0)}ms`);
    const warm = engine.renderer.compileAsync ? engine.renderer.compileAsync(game.scene, game.camera) : Promise.resolve();
    warm.catch(() => {}).then(() => {
      if (DEBUG) console.log(`basement shaders ready at ${Math.round(performance.now() - t0)}ms`);
      resolve();
    });
    if (DEBUG) {
      window.game = game;
    }
  }, 300);
});

// ?debug exposes internals in the console (?debug&speed=10 runs the police clock faster)
if (DEBUG) {
  window.G = ST.G;
  window.ST = ST;
  window.engine = engine;
  window.audio = audio;
}

// canvas text on the laptop needs the web fonts first
const fontsReady = Promise.race([
  Promise.all(['24px "VT323"', '18px "Anonymous Pro"', 'bold 18px "Anonymous Pro"', '20px "Special Elite"'].map((f) => document.fonts.load(f))),
  wait(4),
]);

// The phone is already buzzing on the table from the first frame. Browsers won't play
// sound until the page is touched, so the ringing becomes audible on the first click.
const silentRing = setInterval(() => intro.phone.ring(), 6000);
setTimeout(() => intro.phone.ring(), 900);

let started = false;
async function begin() {
  if (started) return;
  started = true;
  audio.init();
  clearInterval(silentRing);
  gate.classList.add('gone');
  // phones: go full screen where the browser allows it (Android), and unlock speech (iOS)
  if (device.phone) {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
  if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
  await fontsReady;
  if (params.has('skip')) {
    await gameReady;
    stopIntro();
    await enterBasement();
    return;
  }
  audio.startDrone(0.9);
  const picked = await ringingPhone(engine, intro);
  if (!picked) {
    endings.run('ignore');
    return;
  }
  await theCall(engine, intro);
  await gameReady;
  stopIntro();
  await enterBasement({ title: !params.has('skip') });
}

async function enterBasement(o) {
  // the laptop wants landscape; Android can lock it once we're full screen
  try {
    if (device.phone && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
  } catch (e) {
    /* not supported here — the rotate prompt covers it */
  }
  await toBasement(engine, game, intro, o);
}

const gate = document.querySelector('#gate');
if (device.touch) gate.querySelector('.gate-click').textContent = 'tap anywhere';
gate.addEventListener('pointerdown', begin, { once: true });
// iOS only lets audio start from a finished tap
const unlock = () => audio.ctx && audio.ctx.state !== 'running' && audio.ctx.resume();
window.addEventListener('touchend', unlock, { passive: true });
window.addEventListener('click', unlock);
// ?debug&auto starts without a click (no sound until the page is touched)
if (DEBUG && params.has('auto')) begin();
window.addEventListener('keydown', (e) => {
  if (!started && (e.key === 'Enter' || e.key === ' ')) begin();
});

// ── pause menu
const pauseEl = document.querySelector('#pause');
let menuPaused = false;
function setPaused(p) {
  if (p && (!game || game.mode !== 'play')) return;
  menuPaused = p;
  engine.paused = p || rotateHeld;
  pauseEl.classList.toggle('hidden', !p);
  if (audio.master) audio.master.gain.setTargetAtTime(p ? audio.volume * 0.25 : audio.volume, audio.now, 0.1);
  document.body.classList.remove('hide-cursor');
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (menuPaused) setPaused(false);
    else if (game && game.mode === 'play' && !game.os.modalQ.length) setPaused(true);
  }
});
pauseEl.querySelector('[data-act="resume"]').addEventListener('click', () => setPaused(false));
document.querySelector('#vol').addEventListener('input', (e) => audio.setVolume(+e.target.value));
document.querySelector('#vhs').addEventListener('input', (e) => (engine.u.uAmount.value = +e.target.value));
document.querySelector('#voice').addEventListener('change', (e) => (audio.voiceEnabled = e.target.checked));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && game.mode === 'play' && !menuPaused) setPaused(true);
});

// ── touch controls
const hud = document.querySelector('#hud');
hud.addEventListener('pointerdown', (e) => e.stopPropagation());
hud.addEventListener('click', (e) => {
  const b = e.target.closest('.hud-btn');
  if (!b || !game) return;
  audio.click();
  const act = b.dataset.act;
  if (act === 'pause') setPaused(true);
  else if (act === 'lean') b.classList.toggle('on', game.toggleLean());
  else if (act === 'look') {
    const on = !game.lookMode;
    game.setLookMode(on);
    b.classList.toggle('on', on);
    hint(on ? 'drag to look around · tap things in the room · tap ◎ again to go back' : '');
  }
});

// ── rotary dial keypad (touch)
const pad = document.querySelector('#dialpad');
ST.on('dialpad', (on) => pad.classList.toggle('hidden', !(on && device.touch)));
pad.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const b = e.target.closest('button');
  if (!b) return;
  e.preventDefault();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: b.dataset.k }));
});

// ── phones: hold the basement until it's landscape
const rotateEl = document.querySelector('#rotate');
let rotateHeld = false;
function checkLayout() {
  const inBasement = game && engine.scene === game.scene;
  const needRotate = device.phone && device.portrait && inBasement && game.mode !== 'ending';
  rotateEl.classList.toggle('hidden', !needRotate);
  if (needRotate !== rotateHeld) {
    rotateHeld = needRotate;
    engine.paused = rotateHeld || menuPaused;
  }
  hud.classList.toggle('hidden', !(device.touch && inBasement && game.mode === 'play' && !menuPaused && !needRotate));
}
window.addEventListener('resize', checkLayout);
window.addEventListener('orientationchange', () => setTimeout(checkLayout, 300));
setInterval(checkLayout, 250);

// speech voices load lazily in some browsers
if (window.speechSynthesis) window.speechSynthesis.getVoices();
