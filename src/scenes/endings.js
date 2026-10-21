import * as THREE from 'three';
import { audio } from '../core/audio.js';
import { wait } from '../core/engine.js';
import { dialog, caption, hideCaption, hint, fade } from '../ui/dialog.js';
import { money, C, HEAD } from '../os/gui.js';
import { G, GOAL, SECRETS, secret, loadSecrets, milesAway, spend } from '../game/state.js';
import { info } from '../game/userinfo.js';

// ─────────────────────────────────────────────────────────────────────────────
// THE MESSAGE. Shown at the end of every ending. Edit freely.
// ─────────────────────────────────────────────────────────────────────────────
export const MESSAGE = [
  { t: 'all of ur data is online by now.', c: 'big' },
  { t: 'please be careful and take extra precaution wherever u can.' },
  { t: '' },
  { t: 'USE A VPN.' },
  { t: 'DONT SIGN IN WITH GOOGLE.' },
  { t: 'DONT DO A FACE SCAN.' },
  { t: 'DONT SEND A PICTURE OF UR ID.' },
  { t: 'DONT BE STUPID ONLINE .....' },
  { t: '' },
  { t: 'please. before its too late.', c: 'big loud' },
];

const ENDING_LINES = {
  caught: () => {
    const crimes = [];
    if (G.stats.organs) crimes.push(`· ${G.stats.organs} organ${G.stats.organs > 1 ? 's' : ''} sold on the black market`);
    if (G.stats.deals) crimes.push(`· ${G.stats.deals} darknet deal${G.stats.deals > 1 ? 's' : ''}`);
    if (G.chirp && G.chirp.coin.pulled) crimes.push('· one very public pump-and-dump');
    if (G.stats.records) crimes.push(`· ${G.stats.records.toLocaleString()} stolen records`);
    if (G.stats.gambled > 50000) crimes.push(`· ${money(G.stats.gambled)} gambled on an unlicensed casino`);
    return [
      { t: 'TRACED.', c: 'big loud' },
      { t: '' },
      { t: 'they followed the call to your house.' },
      ...(crimes.length ? [{ t: 'then they found everything else:' }, ...crimes.map((x) => ({ t: x, c: 'dim' }))] : [{ t: 'you never even got close.' }]),
      { t: '' },
      { t: 'GHOSTWIRE was never caught.' },
      { t: 'your data is still for sale. $4.99.' },
    ];
  },
  win: () => [
    { t: 'PAID IN FULL.', c: 'big loud' },
    { t: '' },
    { t: 'the money led them straight to him.' },
    { t: 'they were never coming for you. not really.' },
    { t: '' },
    { t: 'but he was right about one thing.' },
    { t: 'he sold your data again. so did everyone before him.' },
    { t: 'a million dollars doesn\'t buy it back.' },
  ],
  surrender: () => [
    { t: 'HANDS UP.', c: 'big loud' },
    { t: '' },
    { t: 'you told them everything. the call. the money. the man on the phone.' },
    { t: 'they believed most of it.' },
    ...(G.stats.organs ? [{ t: 'the missing organs were harder to explain.', c: 'dim' }] : []),
    { t: '' },
    { t: 'GHOSTWIRE hung up a long time ago.' },
    { t: 'he already had what he wanted. he always did.' },
  ],
  heart: () => [
    { t: 'PRICELESS.', c: 'big loud' },
    { t: '' },
    { t: 'the buyer paid in full. $1,000,000. exactly what you needed.' },
    { t: 'you can\'t send money when you\'re dead.' },
  ],
  blind: () => [
    { t: 'LIGHTS OUT.', c: 'big loud' },
    { t: '' },
    { t: 'you sold the last thing you needed to see the screen.' },
    { t: 'the money\'s right there. you just can\'t find the button.' },
  ],
  kidneys: () => [
    { t: 'RENAL FAILURE.', c: 'big loud' },
    { t: '' },
    { t: 'people need at least one kidney.' },
    { t: 'you had two. past tense.' },
  ],
  ignore: () => [
    { t: 'UNKNOWN CALLER.', c: 'big loud' },
    { t: '' },
    { t: 'you never picked up.' },
    { t: 'good. never answer a number you don\'t know.' },
    { t: '' },
    { t: 'but your data was out there before the phone ever rang.' },
  ],
};

export function createEndings(engine, getGame) {
  const el = document.querySelector('#ending');
  const linesEl = el.querySelector('.end-lines');
  const statsEl = el.querySelector('.end-stats');
  const btn = el.querySelector('.end-btn');
  btn.addEventListener('click', () => location.reload());

  async function showMessage(kind) {
    hideCaption();
    dialog.hide();
    hint('');
    document.body.classList.remove('hide-cursor');
    el.classList.remove('hidden');
    linesEl.innerHTML = '';
    statsEl.classList.remove('show');
    btn.classList.add('hidden');
    audio.stopScore(2);
    audio.stopHeart();
    audio.stopBreathing();
    audio.stopRinging();
    audio.stopLine && audio.stopLine();
    audio.setDrone(0.45, 3);

    const devLine = [info.os, info.browser, info.screen, info.tz, info.gpu, info.battery != null ? `battery ${info.battery}%` : null, info.cores ? `${info.cores} threads` : null]
      .filter(Boolean)
      .join('  ·  ');
    const lines = [
      ...ENDING_LINES[kind](),
      { t: '' },
      { t: '' },
      { t: 'this was a game.' },
      { t: 'this part isn\'t.' },
      { t: '' },
      { t: 'while you played, this page quietly learned:', c: 'dim' },
      { t: devLine, c: 'dim' },
      { t: 'it didn\'t ask. it didn\'t have to.', c: 'dim' },
      { t: '' },
      ...MESSAGE,
    ];
    for (const l of lines) {
      const d = document.createElement('span');
      d.className = 'ln ' + (l.c || '');
      d.textContent = l.t || ' ';
      linesEl.appendChild(d);
      await wait(0.05);
      d.classList.add('show');
      if (l.t) {
        if (l.c && l.c.includes('loud')) audio.impact(0.25);
        else audio.blip(110, 0.08, 0.03);
      }
      d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      await wait(l.t ? (l.c && l.c.includes('big') ? 2.2 : 1.6) : 0.7);
    }
    audio.stinger(0.08);

    // stats + secrets
    if (kind === 'win' && G.stats.traps === 0) secret('noTraps');
    const all = new Set([...loadSecrets(), ...G.secrets]);
    const keys = Object.keys(SECRETS);
    const mm = Math.floor(G.elapsed / 60), ss = Math.floor(G.elapsed % 60);
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    const traps = (G.flags.trapsHit || []).map((x) => `<div class="trap">✗ fell for it: ${esc(x)}</div>`).join('');
    statsEl.innerHTML =
      `<div>TIME ${mm}:${String(ss).padStart(2, '0')} &nbsp;·&nbsp; EARNED ${money(G.earned)} &nbsp;·&nbsp; POLICE ${milesAway().toFixed(2)} mi away &nbsp;·&nbsp; ORGANS SOLD ${G.stats.organs} &nbsp;·&nbsp; TRAPS ${G.stats.traps}</div>` +
      traps +
      `<div class="shead">SECRETS FOUND ${keys.filter((k) => all.has(k)).length} / ${keys.length}</div>` +
      `<div class="sgrid">${keys.map((k) => (all.has(k) ? `<span title="${esc(SECRETS[k][1])}">✓ ${esc(SECRETS[k][0])}</span>` : '<span class="no">? ???</span>')).join('')}</div>`;
    statsEl.classList.add('show');
    statsEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    await wait(1.5);
    btn.classList.remove('hidden');
  }

  async function run(kind) {
    const game = getGame && getGame();
    const u = engine.u;
    if (game) {
      game.mode = 'ending';
      G.running = false;
    }
    if (kind === 'caught') secret('lose');
    if (kind === 'win') secret('win');
    if (kind === 'surrender') secret('surrender');
    if (kind === 'heart') secret('heart');
    if (kind === 'blind') secret('blind');
    if (kind === 'kidneys') secret('kidneys');
    if (kind === 'ignore') secret('ignore');

    if (kind === 'caught' && game) {
      const P = game.room;
      audio.startScore();
      audio.setScore(1);
      const camPos = P.door.camPos.clone();
      game.lookAt(P.door.pos, { pos: camPos, dur: 1 });
      await wait(1.2);
      audio.doorKick();
      game.cam.shake = 1.2;
      u.uGlitch.value = 0.5;
      // the door swings in; someone is standing in the light
      const d = P.door.mesh;
      engine.animate(0.3, (p) => (d.rotation.y = -1.45 * p));
      P.door.cop.visible = true;
      P.crack.light.intensity = 5;
      P.crack.light.distance = 5;
      P.crack.mat.opacity = 1;
      const f = P.flash;
      const top = P.door.cop.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.22, 1.25, 0.25));
      f.position.copy(top);
      f.intensity = 34;
      f.target.position.copy(camPos).add(new THREE.Vector3(-0.6, -0.4, -0.3));
      await dialog.say('POLICE', '*POLICE! DON\'T MOVE!*', { danger: true, auto: 1.6 });
      audio.footsteps(8, 0.2, 0.95);
      const cop = P.door.cop;
      const cop0 = cop.position.clone();
      await engine.animate(1.6, (p) => {
        cop.position.set(cop0.x + p * 0.15, cop0.y - p * 1.45, cop0.z + p * 1.6);
        f.position.set(top.x + p * 0.15, top.y - p * 1.45, top.z + p * 1.6);
        f.target.position.copy(camPos).add(new THREE.Vector3(-0.6 * (1 - p), -0.4 * (1 - p), -0.3 * (1 - p)));
        game.lookAt(f.position, { pos: camPos, dur: 0.4 });
      });
      game.policeLights && game.policeLights(8);
      engine.u.uSat.value = 0.6;
      await dialog.say('POLICE', '*HANDS WHERE I CAN SEE THEM!*', { danger: true, auto: 1.4 });
      await engine.animate(0.5, (p) => (u.uFlash.value = p * 0.9));
      audio.impact(1);
      u.uFade.value = 1;
      u.uFlash.value = 0;
      u.uGlitch.value = 0;
      await wait(1.5);
    } else if (kind === 'win' && game) {
      const os = game.os;
      let t = 0;
      os.overlay = {
        draw(g, dt) {
          t += dt;
          g.rect(0, 0, os.W, os.H, '#06100a');
          g.text('SENDING', os.W / 2, 300, { align: 'center', size: 70, font: HEAD, color: C.green });
          g.text(`${money(GOAL)}  →  bc1q-gh0st-w1r3`, os.W / 2, 370, { align: 'center', size: 30, font: HEAD, color: C.text });
          g.progress(os.W / 2 - 300, 420, 600, 18, Math.min(1, t / 3.5), C.green);
          if (t > 3.6) g.text('CONFIRMED · 1/1 block', os.W / 2, 500, { align: 'center', size: 34, font: HEAD, color: C.green });
          return false;
        },
      };
      audio.powerUp();
      await wait(3.6);
      spend(GOAL);
      audio.cash(true);
      game.rigs.setCash(0);
      await wait(2);
      // one last call
      const phone = game.phone;
      const loop = audio.startRinging(0.45);
      loop.onRing = () => phone.ring();
      await wait(2.4);
      audio.stopRinging();
      audio.pickup();
      game.callLight.intensity = 0.5;
      const pp = phone.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.07, 0));
      game.lookAt(pp, { pos: pp.clone().add(new THREE.Vector3(0.22, 0.24, 0.42)), dur: 0.8 });
      audio.startLine();
      await wait(1.2);
      for (const l of ['...received.', 'You actually did it.', 'Pleasure doing business.', 'Oh — about your data.', 'I sold it again. About ten minutes ago.', 'Nothing personal. It\'s just what it\'s worth.'])
        await dialog.say('UNKNOWN', l, { voice: 'caller' });
      audio.hangupClick();
      audio.stopLine();
      game.lookBack();
      await wait(1);
      audio.radio('all units be advised wallet transaction traced ghostwire located divert all units', { gain: 0.5 });
      caption('(police radio)', 4);
      await wait(4.5);
      audio.siren(0.6, 7);
      caption('the sirens are getting quieter.', 5);
      await wait(5);
      await engine.animate(2, (p) => (u.uFade.value = p));
    } else if (kind === 'surrender' && game) {
      game.lookAt(game.room.door.pos, { pos: game.room.door.camPos.clone(), dur: 1.2 });
      await wait(1.2);
      audio.footsteps(8, 0.5, 0.5);
      caption('you walk up the stairs.', 4);
      await wait(3.5);
      audio.creak();
      await engine.animate(1.2, (p) => (u.uFlash.value = p * 0.85));
      await dialog.say('POLICE', '*HANDS! LET ME SEE YOUR HANDS!*', { danger: true, auto: 1.6 });
      await dialog.say('YOU', 'I got a phone call...', { auto: 2 });
      await engine.animate(1.5, (p) => (u.uFade.value = p));
      u.uFlash.value = 0;
    } else if (kind === 'heart') {
      audio.ekg(true);
      await wait(1);
      u.uFade.value = 1;
      await wait(4.5);
    } else if (kind === 'blind') {
      await engine.animate(3, (p) => {
        u.uBlindL.value = 1;
        u.uBlindR.value = 1;
        u.uFade.value = p;
      });
      await wait(1);
    } else if (kind === 'kidneys') {
      caption('something is very wrong.', 3);
      audio.startHeart(140, 0.6);
      await engine.animate(3, (p) => {
        u.uRed.value = p;
        u.uFade.value = p;
      });
      audio.stopHeart();
      audio.ekg(true);
      await wait(3);
    } else if (kind === 'ignore') {
      await wait(0.5);
    }
    await showMessage(kind);
  }

  return { run };
}
