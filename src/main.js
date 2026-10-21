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

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const engine = new Engine(document.querySelector('#stage'));
setEngine(engine);

gatherInfo();

const intro = createIntro(engine);
engine.setScene(intro.scene, intro.camera);
const stopIntro = engine.onUpdate((dt) => intro.update(dt));

let game = null;
const endings = createEndings(engine, () => game);
game = createGame(engine);
const director = createDirector(engine, game, endings);
game.policeLights = director.policeLights;
engine.onUpdate((dt, t) => {
  if (engine.scene === game.scene) {
    game.update(dt, t);
    director.update(dt * (DEBUG && params.get('speed') ? +params.get('speed') : 1));
  }
});
engine.start();

// ?debug exposes internals in the console (?debug&speed=10 runs the police clock faster)
if (DEBUG) {
  window.G = ST.G;
  window.ST = ST;
  window.game = game;
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
  await fontsReady;
  if (params.has('skip')) {
    stopIntro();
    await toBasement(engine, game, intro);
    return;
  }
  audio.startDrone(0.9);
  const picked = await ringingPhone(engine, intro);
  if (!picked) {
    endings.run('ignore');
    return;
  }
  await theCall(engine, intro);
  stopIntro();
  await toBasement(engine, game, intro);
}

const gate = document.querySelector('#gate');
gate.addEventListener('pointerdown', begin, { once: true });
window.addEventListener('keydown', (e) => {
  if (!started && (e.key === 'Enter' || e.key === ' ')) begin();
});

// ── pause menu
const pauseEl = document.querySelector('#pause');
function setPaused(p) {
  if (p && game.mode !== 'play') return;
  engine.paused = p;
  pauseEl.classList.toggle('hidden', !p);
  if (audio.master) audio.master.gain.setTargetAtTime(p ? audio.volume * 0.25 : audio.volume, audio.now, 0.1);
  document.body.classList.remove('hide-cursor');
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (engine.paused) setPaused(false);
    else if (game.mode === 'play' && !game.os.modalQ.length) setPaused(true);
  }
});
pauseEl.querySelector('[data-act="resume"]').addEventListener('click', () => setPaused(false));
document.querySelector('#vol').addEventListener('input', (e) => audio.setVolume(+e.target.value));
document.querySelector('#vhs').addEventListener('input', (e) => (engine.u.uAmount.value = +e.target.value));
document.querySelector('#voice').addEventListener('change', (e) => (audio.voiceEnabled = e.target.checked));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'play' && !engine.paused) setPaused(true);
});

// speech voices load lazily in some browsers
if (window.speechSynthesis) window.speechSynthesis.getVoices();
