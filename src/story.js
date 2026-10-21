import * as THREE from 'three';
import { audio } from './core/audio.js';
import { wait } from './core/engine.js';
import { dialog, caption, hideCaption, hint, fade } from './ui/dialog.js';
import { info, refreshTime } from './game/userinfo.js';
import { G, on } from './game/state.js';

const promptEl = document.querySelector('#prompt');

// ───────────────────────── 1. the phone is ringing ─────────────────────────
// resolves true when picked up, false if ignored for good
export async function ringingPhone(engine, intro) {
  const phone = intro.phone;
  let picked = false;
  let resolvePick;
  const pickedP = new Promise((r) => (resolvePick = r));
  let ringingNow = false;
  let totalRings = 0;

  const canvas = engine.canvas;
  const onMove = (e) => {
    const over = intro.pointer(e.clientX, e.clientY);
    phone.setGlow(over && ringingNow ? 1 : over ? 0.35 : 0);
    canvas.style.cursor = over ? 'pointer' : 'default';
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    if (intro.pointer(e.clientX, e.clientY) && ringingNow) {
      picked = true;
      resolvePick();
    }
  };
  window.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  const stopFollow = engine.onUpdate(() => {
    const p = intro.screenPos(new THREE.Vector3(0.17, -0.02, 0.12));
    promptEl.style.left = p.x + 'px';
    promptEl.style.top = p.y + 'px';
  });

  const words = ['PICK UP', 'PICK UP.', 'PICK. UP.'];
  for (let cycle = 0; cycle < 3 && !picked; cycle++) {
    ringingNow = true;
    const loop = audio.startRinging(0.5 + cycle * 0.15);
    loop.onRing = () => {
      phone.ring();
      totalRings++;
      intro.shake = 0.04;
      if (totalRings === 2 || cycle > 0) {
        promptEl.textContent = words[cycle];
        promptEl.classList.remove('hidden');
        promptEl.style.opacity = 1;
      }
    };
    await Promise.race([pickedP, wait(6 * 6 - 3.5)]);
    audio.stopRinging();
    ringingNow = false;
    phone.setGlow(0);
    if (picked) break;
    promptEl.style.opacity = 0;
    caption(cycle === 0 ? 'it stopped.' : cycle === 1 ? 'it stopped. again.' : 'it stopped.', 3);
    await wait(cycle === 0 ? 5 : 7);
    if (cycle === 0) {
      caption('you can\'t ignore it forever.', 3);
      await wait(3);
    }
  }
  window.removeEventListener('pointermove', onMove);
  canvas.removeEventListener('pointerdown', onDown);
  stopFollow();
  promptEl.classList.add('hidden');
  canvas.style.cursor = 'default';
  return picked;
}

// ───────────────────────── 2. the call ─────────────────────────
export async function theCall(engine, intro) {
  const phone = intro.phone;
  refreshTime();
  audio.pickup();
  phone.lifted = true;
  intro.drift = 0.25;
  // handset comes up off the cradle and towards your ear (off-screen left)
  const hs = phone.handset;
  const start = hs.position.clone();
  await engine.animate(0.55, (p) => {
    hs.position.set(start.x, start.y + p * 0.12, start.z + p * 0.05);
    hs.rotation.x = p * 0.5;
    phone.rebuildCord();
  });
  engine.animate(1.1, (p) => {
    hs.position.set(start.x - p * 0.32, start.y + 0.12 + p * 0.22, start.z + 0.05 + p * 0.55);
    hs.rotation.set(0.5 + p * 0.6, -p * 0.9, p * 0.8);
    phone.rebuildCord();
  });
  engine.animate(1.6, (p) => {
    intro.camOffset.set(-0.03 * p, -0.03 * p, -0.16 * p);
    intro.lookOffset.set(-0.02 * p, 0.02 * p, 0);
  });
  intro.spot.intensity *= 0.9;
  audio.startLine();
  audio.setDrone(0.55, 2);
  await wait(1.6);
  audio.breathOnLine(0.8);
  await wait(2.4);

  const say = (t, o = {}) => dialog.say('UNKNOWN CALLER', t, { voice: 'caller', ...o });
  await say('...there you are.');
  await say('Don\'t hang up. You\'ll want to hear this.');
  const where = info.city ? ` — ${info.city}, right?` : '.';
  await say(`You're on ${info.os}. Using ${info.browser}. It's ${info.time} where you are${where}`);
  if (info.battery != null) await say(`Your battery's at ${info.battery} percent. ${info.charging ? 'At least you\'re plugged in.' : 'You should plug that in.'}`);
  if (info.gpu) await say(`Nice graphics card, by the way. ${info.gpu}.`);
  await say('I know a lot more than that. I bought your whole life tonight.');
  await say('Passwords. Messages. Photos. Your search history. *All of it.*');
  await say('It was on the dark web for four ninety-nine. You\'re not even expensive.');
  await say('So here\'s the deal. One million dollars. In bitcoin.');
  await say('Or everyone you\'ve ever met gets a copy.');
  const c = await dialog.choose('UNKNOWN CALLER', '...well?', ['I don\'t have a million dollars.', 'Who is this?']);
  if (c === 0) await say('Then get creative. You\'ve got a laptop and a basement. That\'s more than I started with.');
  else await say('Nobody you want to know. The feds call me GHOSTWIRE. I\'m number four on their list.');
  await say('Oh — one more thing.');
  await say('This line has been tapped by the FBI for eleven months.');
  audio.stopLine();
  await wait(0.2);
  audio.startLine();
  await say('And you just picked up.');
  audio.startHeart(92, 0.55);
  await wait(1.6);
  await say('They\'ve traced the call. They\'re on their way to your house. *Right now.*', { danger: true });
  await say('Better hurry.');
  audio.hangupClick();
  audio.stopLine();
  await wait(0.5);
  audio.dialTone(3);
  audio.siren(0.95, 8);
  caption('they\'re coming.', 3.5);
  await wait(3.2);
  audio.stopHeart();
}

// ───────────────────────── 3. the basement ─────────────────────────
export async function toBasement(engine, game, intro) {
  const u = engine.u;
  audio.glitch(1.3, 0.3);
  audio.tapeStop(1.6);
  await engine.animate(1.1, (p) => (u.uGlitch.value = p));
  await engine.animate(0.4, (p) => (u.uFade.value = p));
  audio.stopDrone(0.5);
  hideCaption();

  const { laptop, room: P } = game;
  laptop.setLid(laptop.CLOSED);
  laptop.power = 0;
  game.mode = 'cutscene';
  engine.setScene(game.scene, game.camera);
  const deskLook = new THREE.Vector3(0, 0.8, -0.6);
  game.lookAt(deskLook, { pos: new THREE.Vector3(0.25, 1.45, 0.75), dur: 0.01 });
  game.cam.overrideW = 1;
  game.cam.opos.set(0.25, 1.45, 0.75);
  game.cam.otgt.copy(deskLook);
  await wait(0.6);
  audio.startDrone(1);
  audio.startBuzz();
  await engine.animate(1.6, (p) => {
    u.uFade.value = 1 - p;
    u.uGlitch.value = 1 - p;
  });
  refreshTime();
  caption(`the basement.  ${info.time}`, 3.5);
  game.lookAt(deskLook, { pos: new THREE.Vector3(0.12, 1.3, 0.45), dur: 4 });
  await wait(3.2);

  // the bulb goes
  const b = P.bulb;
  for (let i = 0; i < 9; i++) {
    b.on = i % 2 ? 1 : 0.1;
    audio.setBuzz(b.on);
    await wait(0.05 + Math.random() * 0.15);
  }
  b.on = 0;
  b.light.intensity = 0;
  b.mat.color.setScalar(0.05);
  audio.setBuzz(0);
  audio.impact(0.35);
  audio.noise(audio.now, 0.4, { gain: 0.25, filter: { type: 'highpass', freq: 4000 } });
  audio.stinger(0.12);
  game.cam.shake = 0.3;
  await wait(1.8);
  caption('the laptop.', 2.5);
  await wait(1);

  // lid opens, screen wakes
  audio.creak();
  game.lookAt(new THREE.Vector3(0, 0.88, -0.66), { pos: new THREE.Vector3(0.0, 1.16, -0.05), dur: 1.8 });
  await engine.animate(1.6, (p) => laptop.setLid(laptop.CLOSED + (laptop.OPEN - laptop.CLOSED) * p));
  audio.powerUp();
  audio.startFans();
  await engine.animate(0.8, (p) => (laptop.power = p));
  game.lookBack();
  await new Promise((r) => {
    const off = on('booted', () => {
      off();
      r();
    });
  });
  await wait(0.4);
  const os = game.os;
  os.open('readme', { x: 560, y: 22, silent: true });
  await wait(0.6);
  os.open('miner', { x: 352, y: 96 });
  game.mode = 'play';
  G.running = true;
  hint('scroll off-screen or TAB — lean back   ·   hold right-click — look around   ·   esc — pause');
  setTimeout(() => hint(''), 26000);
}
