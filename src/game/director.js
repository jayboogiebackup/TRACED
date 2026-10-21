import * as THREE from 'three';
import { audio } from '../core/audio.js';
import { wait, easeInOut } from '../core/engine.js';
import { dialog, caption, hideCaption, toast, hint } from '../ui/dialog.js';
import { C, FONT, HEAD, money } from '../os/gui.js';
import { G, GOAL, on, emit, addMoney, addHeat, spend, secret, scannerLog, mining, heatRate } from './state.js';
import { info } from './userinfo.js';
import { DESK_Y } from '../world/basement.js';

const pick = (a) => a[(Math.random() * a.length) | 0];

// Everything that happens to you in the basement: messages, calls, sirens,
// knocks at the door, traps, surgery, purchases showing up in the room.
export function createDirector(engine, game, endings) {
  const { os, laptop, phone, rigs, room: P, desk: D } = game;
  const burner = os.app('burner');
  const u = engine.u;
  let busy = false; // a blocking cutscene is playing
  let ringing = null;
  let ended = false;

  const ghost = (t, o) => burner.push('ghost', t, o);
  const lesson = (title, body) => {
    G.stats.traps++;
    G.flags.trapsHit = (G.flags.trapsHit || []).concat(title);
    setTimeout(() => toast('LESSON: ' + title, body, 9), 900);
  };

  async function block(fn, pauseClock = true) {
    if (busy || ended) return;
    busy = true;
    const prev = game.mode;
    game.mode = 'cutscene';
    if (pauseClock) G.running = false;
    try {
      await fn();
    } finally {
      if (!ended) {
        game.mode = 'play';
        G.running = true;
      }
      busy = false;
    }
  }

  // ───────────────── traps (the real lesson of the game) ─────────────────
  function overlayScan(done) {
    let t = 0;
    const dots = Array.from({ length: 70 }, () => [Math.random(), Math.random()]);
    return {
      draw(g, dt) {
        t += dt;
        const W = os.W, H = os.H;
        g.rect(0, 0, W, H, '#000');
        const cx = W / 2, cy = H / 2 - 30;
        // grainy "webcam" silhouette — it's you, roughly
        const img = g.ctx;
        for (let i = 0; i < 900; i++) {
          const x = Math.random() * 640 + cx - 320, y = Math.random() * 480 + cy - 240;
          img.fillStyle = `rgba(200,200,200,${Math.random() * 0.12})`;
          img.fillRect(x, y, 2, 2);
        }
        img.fillStyle = '#2a2d2e';
        img.beginPath();
        img.ellipse(cx, cy - 20, 120, 150, 0, 0, Math.PI * 2);
        img.fill();
        img.beginPath();
        img.ellipse(cx, cy + 250, 300, 140, 0, Math.PI, 0);
        img.fill();
        g.stroke(cx - 320, cy - 240, 640, 480, C.border, 2);
        // face mesh
        const p = Math.min(1, t / 3);
        img.fillStyle = C.green;
        dots.slice(0, Math.floor(p * dots.length)).forEach(([a, b]) => {
          const x = cx + (a - 0.5) * 200, y = cy - 20 + (b - 0.5) * 260;
          img.fillRect(x - 2, y - 2, 4, 4);
        });
        const sy = cy - 170 + ((t * 220) % 300);
        g.line(cx - 150, sy, cx + 150, sy, C.green, 2);
        g.text('● REC', cx - 300, cy - 210, { size: 20, bold: true, color: C.red });
        const label = t < 3 ? `Hold still… analyzing facial geometry ${Math.floor(p * 100)}%` : 'IDENTITY VERIFIED ✓';
        g.text(label, cx, cy + 290, { align: 'center', size: 26, font: HEAD, color: t < 3 ? C.text : C.green });
        if (t > 4.2) {
          done();
          return true;
        }
        return false;
      },
    };
  }
  function overlayUpload(done) {
    let t = 0;
    return {
      draw(g, dt) {
        t += dt;
        const W = os.W, H = os.H;
        g.rect(0, 0, W, H, 'rgba(0,0,0,0.85)');
        const x = W / 2 - 300, y = H / 2 - 120;
        g.rect(x, y, 600, 240, '#151015');
        g.stroke(x, y, 600, 240, C.pink, 2);
        g.text('Uploading…', x + 30, y + 50, { size: 22, bold: true });
        g.text('ID_front.jpg', x + 30, y + 100, { size: 17, color: C.dim });
        g.progress(x + 200, y + 88, 360, 14, Math.min(1, t / 1.4), C.pink);
        g.text('ID_back.jpg', x + 30, y + 140, { size: 17, color: C.dim });
        g.progress(x + 200, y + 128, 360, 14, Math.max(0, Math.min(1, (t - 1.4) / 1.4)), C.pink);
        g.text(t > 3 ? '✓ You are now a Verified Buyer' : 'Verifying…', x + 300, y + 200, { align: 'center', size: 20, bold: true, color: t > 3 ? C.green : C.text });
        if (t > 4) {
          done();
          return true;
        }
        return false;
      },
    };
  }
  function overlayPhish(done) {
    let t = 0;
    return {
      draw(g, dt) {
        t += dt;
        const W = os.W, H = os.H;
        g.rect(0, 0, W, H, '#e9edf2');
        g.rect(0, 0, W, 70, '#1d4a8a');
        g.text('SecureBank', 40, 46, { size: 30, bold: true, color: '#fff' });
        g.text('🔒 https://secure-bank-verify.co.ru/login', 300, 44, { size: 16, color: '#cfe0ff' });
        const x = W / 2 - 260, y = 180;
        g.text('Verify your identity', x, y, { size: 30, bold: true, color: '#1a1a1a' });
        const fields = ['Card number', 'Expiry', 'CVV', 'Online banking password', 'Mother\'s maiden name'];
        fields.forEach((f, i) => {
          const fy = y + 40 + i * 70;
          g.text(f, x, fy + 18, { size: 15, color: '#444' });
          g.rect(x, fy + 26, 520, 36, '#fff');
          g.stroke(x, fy + 26, 520, 36, '#aab');
          const filled = Math.max(0, Math.min(1, (t - i * 0.4) / 0.4));
          g.text('•'.repeat(Math.floor(filled * 12)), x + 12, fy + 50, { size: 18, color: '#222' });
        });
        g.text(t > 2.8 ? 'Thank you! Your account is now secure.' : 'Autofilling from your browser…', W / 2, y + 420, { align: 'center', size: 20, bold: true, color: t > 2.8 ? '#1a7a3a' : '#1d4a8a' });
        if (t > 4) {
          done();
          return true;
        }
        return false;
      },
    };
  }

  on('trap', (id) => {
    if (id === 'face') {
      laptop.ledBoost = 1;
      audio.powerUp();
      os.overlay = overlayScan(() => {
        laptop.ledBoost = 0;
        G.flags.faceVerified = true;
        os.notify('Verified ✓', 'High roller limits removed. Good luck!', { app: 'casino', color: C.green });
        setTimeout(() => {
          addHeat(10, 'Facial match received from a third-party verification vendor.');
          os.notify('Your face was shared', 'LuckyStrike shared your biometric profile with 14 "partners".', { color: C.red, creepy: true });
          ghost('nice face :)');
          u.uGlitch.value = 0.6;
          game.fx.glitch = 0.8;
          audio.glitch(0.5);
          lesson('never scan your face for a website', 'A face scan can\'t be changed like a password. Once it leaks, it\'s leaked forever.');
        }, 3500);
      });
    } else if (id === 'google') {
      G.flags.google = true;
      addMoney(500, 'trap');
      if (G.chirp) G.chirp.followers *= 2;
      audio.cash();
      setTimeout(() => {
        addHeat(10, 'Account linked: location history places suspect at this address.');
        ghost('thanks for signing in with google. lovely inbox. very searchable.');
        audio.stinger(0.15);
        lesson('don\'t "sign in with Google"', 'One click hands a stranger your name, email, contacts — sometimes your location. Make a separate account instead.');
      }, 2500);
    } else if (id === 'id') {
      audio.powerUp();
      os.overlay = overlayUpload(() => {
        G.flags.idUploaded = true;
        G.flags.idDiscount = true;
        setTimeout(() => {
          const loss = Math.round(G.money * 0.18);
          spend(loss);
          addHeat(8, 'Stolen ID used to open accounts. Records cross-referenced to suspect.');
          burner.push('bank', `ALERT: 3 new credit cards opened in your name. ${money(loss)} withdrawn from your account.`);
          ghost('cute ID photo. your middle name is embarrassing.', { quiet: true });
          audio.stinger(0.18);
          lesson('never send a picture of your ID', 'It\'s everything someone needs to become you. Sites that ask for it get breached all the time.');
        }, 6000);
      });
    } else if (id === 'phish') {
      os.overlay = overlayPhish(() => {
        setTimeout(() => {
          const loss = Math.round(G.money * 0.15);
          spend(loss);
          burner.push('bank', `ALERT: ${money(loss)} transferred to an external account. If this wasn't you, too bad.`);
          ghost('you clicked a link in a text message. in THIS situation?', { quiet: true });
          audio.lose();
          lesson('don\'t click links in texts', 'Real banks don\'t text you a link to "verify". Type the address yourself.');
        }, 2000);
      });
    } else if (id === 'doxx-self') {
      lesson('never post your address', 'Not in a post, not in a bio, not "as a joke". Screenshots are forever.');
    }
  });

  // ───────────────── organs ─────────────────
  on('organ', (it) =>
    block(async () => {
      const first = G.stats.organs === 0 && it.id !== 'blood';
      audio.squelch();
      await engine.animate(0.5, (p) => (u.uFade.value = p));
      audio.startHeart(it.id === 'heart' ? 50 : 112, 0.6);
      if (it.id !== 'blood')
        caption(
          pick(['you wake up in a bathtub full of ice.', 'a man in a surgical mask counts backwards from ten.', 'everything smells like bleach.', '"you won\'t even miss it," he says.']),
          3,
        );
      else caption('a needle. a bag. a cookie.', 2.5);
      await wait(it.id === 'blood' ? 1.4 : 2.6);
      audio.stopHeart();
      if (it.repeat) G.organs.blood++;
      else G.organs[it.id] = 1;
      if (it.id === 'heart') {
        ended = true;
        endings.run('heart');
        return;
      }
      addMoney(it.price, 'organ');
      audio.cash(true);
      if (it.id !== 'blood') {
        G.stats.organs++;
        addHeat(1.2, null);
        if (!rigs.count('cooler')) rigs.add('cooler', false);
      }
      // what it costs you
      const fx = game.fx;
      fx.red = 1;
      if (it.id === 'blood') {
        fx.pale = Math.min(1.2, fx.pale + 0.22);
        if (fx.pale > 1) {
          caption('you pass out for a while.', 3);
          addHeat(4, null);
          u.uFade.value = 1;
          await wait(2.5);
        }
      }
      if (it.id === 'corneaL') fx.blindL = 1;
      if (it.id === 'corneaR') fx.blindR = 1;
      if (it.id === 'lung') audio.startBreathing(0.28, 0.1);
      await engine.animate(1.1, (p) => (u.uFade.value = 1 - p));
      if (first) {
        burner.push('doc', 'pleasure doing business. if you get a fever, don\'t call me.');
        ghost('did you just sell an organ? respect.', { quiet: true });
      }
      const o = G.organs;
      if (o.kidneyL && o.kidneyR) {
        ended = true;
        await wait(1);
        endings.run('kidneys');
        return;
      }
      if (o.corneaL && o.corneaR) {
        ended = true;
        await wait(1.5);
        endings.run('blind');
        return;
      }
      if (o.kidneyL + o.liver + o.corneaL + o.lung + o.marrow >= 5) secret('allorgans');
    }),
  );

  // ───────────────── purchases show up in the room ─────────────────
  const glanced = {};
  on('buy', (it) => {
    if (it.model) {
      const obj = rigs.add(it.model);
      if (obj) {
        audio.impact(0.25);
        if (['rig', 'asic', 'rack', 'boxfan'].includes(it.model) && !glanced[it.model]) {
          glanced[it.model] = true;
          block(async () => {
            await wait(0.1);
            const p = obj.getWorldPosition(new THREE.Vector3());
            p.y += it.model === 'rack' ? 0.9 : 0.2;
            game.lookAt(p, { dur: 0.9, pos: new THREE.Vector3(0.1, 1.35, 0.2) });
            await wait(2);
            game.lookBack();
            await wait(0.6);
          }, false);
        }
      }
    }
    switch (it.id) {
      case 'tape':
        laptop.tape.visible = true;
        secret('tape');
        caption('you tape over the webcam. the green light is gone. finally.', 4);
        break;
      case 'tinfoil':
        secret('tinfoil');
        caption('you look ridiculous. you feel 4% safer.', 4);
        break;
      case 'cans': {
        G.clickBoostUntil = G.elapsed + 60;
        const can = D.cans.find((c) => !c.visible);
        if (can) can.visible = true;
        audio.noise(audio.now, 0.3, { gain: 0.2, filter: { type: 'highpass', freq: 3000 } });
        break;
      }
      case 'vpn':
        toast('GOOD CALL', 'A VPN hides your IP address from every site you visit. Get one for real, too.', 8);
        break;
      case 'ac':
        caption('the AC unit wheezes to life. it smells like someone else\'s house.', 4);
        break;
      case 'tap':
        caption('an orange extension cord now runs through the window to next door.', 4);
        break;
    }
  });

  // ───────────────── flavor text for things in the room ─────────────────
  // darknet packages pile up on the boxes by the stairs
  on('package', () => {
    if (rigs.count('pkg') < 5) rigs.add('pkg');
  });

  on('say', (id) => {
    const lines = {
      duck: 'you explain everything to the duck. the duck says nothing. you feel a little better.',
      chain: 'click. ...click. the bulb is dead.',
      doll: 'it\'s looking at you. it wasn\'t before.',
      doll0: 'a doll. you don\'t remember putting it there.',
      mug: 'cold coffee. you drink it anyway.',
      note: 'wifi pw: hunter2     ↑ ↑ ↓ ↓ ← → ← → B A',
      window: G.heat > 60 ? 'red and blue on the street. getting closer.' : 'the street is empty. for now.',
      scrawl: 'THEY HEAR EVERYTHING. you didn\'t write that. did you?',
    };
    caption(lines[id] || '', 4.5);
  });

  on('konami', () => {
    if (secret('konami')) {
      addMoney(13370, 'konami');
      audio.win(2);
      os.notify('DEV MODE', '+$13,370. you still remember the code.', { color: C.purple });
    }
  });

  on('shutdown', () =>
    block(async () => {
      secret('bsod');
      audio.glitch(0.8, 0.3);
      os.locked = true;
      const bsod = {
        t: 0,
        draw(g, dt) {
          bsod.t += dt;
          g.rect(0, 0, os.W, os.H, '#0a0a0a');
          g.text(':)', 120, 220, { size: 150, font: HEAD, color: '#ddd' });
          g.para('You can\'t turn this off.\n\nYou never could. It was never really off. Not the webcam, not the microphone, not the location.\n\nRestarting where you left off…', 120, 340, os.W - 240, { size: 26, font: FONT, color: '#ddd' });
          return bsod.t > 4.5;
        },
      };
      os.overlay = bsod;
      audio.stinger(0.2);
      await wait(4.6);
      os.locked = false;
    }),
  );

  // ───────────────── the phone on the desk ─────────────────
  const phonePos = () => phone.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.07, 0));
  const phoneCamPos = () => phonePos().add(new THREE.Vector3(0.22, 0.24, 0.42));

  function liftHandset(up) {
    return engine.animate(0.6, (p) => {
      const k = up ? p : 1 - p;
      game.callLight.intensity = k * 0.5;
      phone.handset.position.set(phone.handsetRest.x + k * 0.04, phone.handsetRest.y + k * 0.16, phone.handsetRest.z + k * 0.12);
      phone.handset.rotation.set(k * 0.9, 0, k * 0.4);
      phone.lifted = up || p < 1;
      phone.rebuildCord();
    });
  }

  // returns when answered (true) or missed (false)
  function ringPhone(seconds = 22) {
    return new Promise((resolve) => {
      const loop = audio.startRinging(0.45);
      loop.onRing = () => phone.ring();
      caption('the phone is ringing. (click it)', seconds);
      phone.setGlow(0.6);
      // lean back from the screen so the phone is in view
      const prevZoom = game.cam.zoomT;
      game.cam.zoomT = 1;
      const timer = setTimeout(() => finish(false), seconds * 1000);
      ringing = (answered) => finish(answered);
      function finish(answered) {
        clearTimeout(timer);
        game.cam.zoomT = prevZoom;
        audio.stopRinging();
        phone.setGlow(0);
        ringing = null;
        if (!answered) caption('it stopped.', 2);
        else hideCaption();
        resolve(answered);
      }
    });
  }

  async function ghostCall(lines, missed) {
    if (busy || ended) return;
    const answered = await ringPhone();
    if (!answered) {
      ghost(missed);
      return;
    }
    await block(async () => {
      audio.pickup();
      game.lookAt(phonePos(), { pos: phoneCamPos(), dur: 0.8 });
      await liftHandset(true);
      audio.startLine();
      await wait(0.6);
      audio.breathOnLine(0.6);
      await wait(1.2);
      for (const l of lines) await dialog.say('UNKNOWN', typeof l === 'function' ? l() : l, { voice: 'caller' });
      audio.hangupClick();
      audio.stopLine();
      audio.dialTone(1.5);
      await liftHandset(false);
      game.lookBack();
      await wait(0.6);
    });
  }

  // dial a number on the rotary phone
  async function dialMode() {
    await block(async () => {
      audio.pickup();
      game.lookAt(phonePos(), { pos: phoneCamPos(), dur: 0.8 });
      await liftHandset(true);
      audio.dialTone(2.5);
      let number = '';
      let done = null;
      const finished = new Promise((r) => (done = r));
      dialog.show('ROTARY PHONE', 'type a number on your keyboard.\nenter to call · esc to hang up\n\n_');
      const prevMode = game.mode;
      game.mode = 'play-dial';
      const show = () => dialog.set(`type a number on your keyboard.\nenter to call · esc to hang up\n\n${number.split('').join(' ') || '_'}`);
      // digits queue up; the wheel has to come home before the next one
      const queue = [];
      let dialing = false, pendingCall = false;
      const pump = async () => {
        if (dialing) return;
        dialing = true;
        while (queue.length) {
          const d = queue.shift();
          number += d;
          show();
          const secs = phone.dialDigit(d);
          audio.dialClick(d === 0 ? 10 : d);
          await wait(Math.min(0.85, secs));
        }
        dialing = false;
        if (pendingCall && number) done(number);
      };
      const onKey = (e) => {
        if (/^[0-9]$/.test(e.key) && number.length + queue.length < 11) {
          queue.push(+e.key);
          pump();
        } else if (e.key === 'Enter' && (number || queue.length)) {
          if (dialing) pendingCall = true;
          else done(number);
        } else if (e.key === 'Escape') done(null);
        else if (e.key === 'Backspace' && !dialing) {
          number = number.slice(0, -1);
          show();
        }
      };
      window.addEventListener('keydown', onKey);
      const n = await finished;
      window.removeEventListener('keydown', onKey);
      game.mode = prevMode;
      dialog.hide();
      if (n) await placeCall(n);
      audio.hangupClick();
      await liftHandset(false);
      game.lookBack();
      await wait(0.5);
    }, false);
  }

  async function placeCall(n) {
    await wait(0.8);
    audio.startLine();
    await wait(1);
    if (n === '911') {
      secret('phone911');
      await dialog.say('911', '911, what is your emergency?', { voice: 'female' });
      const c = await dialog.choose('911', 'Hello? Are you there?', ['someone is blackmailing me', '...sorry. wrong number.']);
      if (c === 0) {
        await dialog.say('911', 'Sir — ma\'am — we know. Officers are already on their way to your address.', { voice: 'female' });
        await dialog.say('911', 'Please stay exactly where you are.', { voice: 'female' });
        addHeat(4, '911 call from suspect\'s landline. Location confirmed.');
      } else {
        await dialog.say('911', 'Misuse of this line is a crime. Your number has been logged.', { voice: 'female' });
        addHeat(2, '911 hang-up traced to suspect\'s landline.');
      }
    } else if (n === '8675309') {
      await dialog.say('???', 'Jenny? ...there\'s no Jenny here. There has never been a Jenny.', { voice: 'caller' });
    } else if (n === '666') {
      audio.whisper({ gain: 0.2, pan: 0 });
      await wait(1.2);
      await dialog.say('', '...breathing. on the other end. it sounds like it\'s right behind you.', {});
      audio.stinger(0.2);
    } else if (n === '0') {
      await dialog.say('OPERATOR', 'Operator. ...I\'m sorry, this line is currently being monitored.', { voice: 'female' });
    } else if (/^555/.test(n)) {
      await dialog.say('RECORDING', 'The number you have reached is fictional. Please try again in a movie.', { voice: 'female' });
    } else {
      [950, 1400, 1800].forEach((f, i) => audio.osc('sine', f, audio.now + i * 0.33, 0.3, { gain: 0.12, hold: 0.25, dest: audio.phoneLine }));
      await wait(1.1);
      await dialog.say('RECORDING', 'We\'re sorry. The number you have dialed is not in service. Please check the number and try again.', { voice: 'female' });
    }
    audio.stopLine();
  }

  on('phoneClick', () => {
    if (ringing) ringing(true);
    else if (!busy) dialMode();
  });

  // ───────────────── beats ─────────────────
  const beats = [
    {
      when: () => G.elapsed > 2,
      run: () => {
        ghost('wallet address is in this thread. $1,000,000. not a cent less.');
        setTimeout(() => ghost('I\'d start with the miner. then I\'d get creative.'), 5000);
      },
    },
    { when: () => G.money >= 1000, run: () => ghost('a thousand dollars. adorable.') },
    {
      when: () => G.heat >= 8,
      run: () => {
        scannerLog('Dispatch: all units, trace complete. Suspect landline located. Units en route.', 'bad');
        audio.radio('all units trace complete suspect landline located units en route', { gain: 0.35 });
        caption('(police radio — somewhere far away)', 4);
        setTimeout(() => audio.siren(0.95, 10), 2500);
      },
    },
    { when: () => G.money >= 10000, run: () => ghost('ten grand. keep going. they are.') },
    {
      when: () => G.elapsed > 150,
      run: () =>
        burner.push('bank', 'BANK ALERTS: Suspicious sign-in detected on your account. Verify within 10 minutes or your account will be locked.', {
          link: { label: 'VERIFY ACCOUNT →', fn: () => emit('trap', 'phish') },
        }),
    },
    { when: () => G.heat >= 22, run: () => burner.push('mom', 'Honey the police just called asking where you are?? Call me back') },
    {
      when: () => G.heat >= 28,
      run: () =>
        ghostCall(
          [
            'Still breathing? Good.',
            () => `${money(G.money)}. ${G.money < 50000 ? 'That\'s not a lot.' : 'Not bad.'} And they\'re about ${(4.2 * (1 - G.heat / 100)).toFixed(1)} miles out.`,
            () => (G.flags.google ? 'Oh, and thanks for linking your Google account. Saved me a lot of work.' : 'Whatever you do, don\'t do anything stupid. Like signing into things.'),
            'Tick tock.',
          ],
          'pick up next time.',
        ),
    },
    {
      when: () => G.heat >= 40,
      run: () =>
        block(async () => {
          // headlights sweep through the window
          caption('a car slows down outside.', 4);
          audio.noise(audio.now, 4, { gain: 0.08, color: 'brown', filter: { type: 'lowpass', freq: 300 } });
          const f = P.flash;
          game.lookAt(new THREE.Vector3(1.05, 1.9, -1.7), { dur: 1.2 });
          await wait(0.6);
          await engine.animate(3.2, (p) => {
            f.intensity = Math.sin(p * Math.PI) * 26;
            f.target.position.set(1.8 - p * 3.6, 0.6, 0.6 - p * 0.4);
          });
          f.intensity = 0;
          caption('it keeps going.', 2.5);
          await wait(1);
          game.lookBack();
          await wait(0.8);
        }, false),
    },
    { when: () => G.heat >= 50, run: () => ghost('they\'re halfway to you. are you halfway to me?') },
    { when: () => G.money >= 100000, run: () => ghost('100k. maybe you\'re not useless.') },
    { when: () => G.money >= 250000, run: () => ghost('a quarter of the way. I\'ve already spent it in my head.') },
    {
      when: () => G.money >= 500000,
      run: () =>
        ghostCall(['Halfway.', 'I\'m impressed. Really.', 'They\'re impressed too. They\'re almost at your door.', 'Don\'t stop now.'], 'half a million. don\'t get comfortable.'),
    },
    { when: () => G.heat >= 55, run: () => burner.push('mom', 'They came to the house. I didn\'t tell them anything. Where ARE you') },
    {
      when: () => G.heat >= 62,
      run: () => {
        audio.siren(0.4, 12);
        scannerLog('Unit 12: entering the neighbourhood. Lights, no sirens from here.', 'bad');
        caption('(sirens. close.)', 4);
        policeLights(10);
        audio.startHeart(84, 0.35);
        setTimeout(() => audio.stopHeart(), 12000);
      },
    },
    { when: () => G.money >= 750000, run: () => ghost('so close. I can hear the sirens from here. can you?') },
    {
      when: () => G.heat >= 72,
      run: () =>
        block(async () => {
          audio.footsteps(6, 0.5, 0.6);
          caption('footsteps. upstairs.', 4);
          game.lookAt(new THREE.Vector3(-0.6, 2.3, -0.4), { dur: 1.4 });
          await wait(3.4);
          audio.knock(4, true);
          game.fx.glitch = 0.4;
          await dialog.say('UPSTAIRS', '*POLICE.* OPEN THE DOOR.', { danger: true, auto: 2.4 });
          game.lookAt(P.door.pos, { pos: P.door.camPos, dur: 1.2 });
          walkFeet(4);
          await wait(2.6);
          game.lookBack();
          await wait(0.6);
          burner.push('mom', 'Please just call me');
        }),
    },
    {
      when: () => G.heat >= 83,
      run: () => {
        scannerLog('Unit 12: we\'re inside. Clearing the ground floor.', 'bad');
        audio.radio('we are inside clearing ground floor', { gain: 0.5 });
        audio.footsteps(10, 0.4, 0.75);
        walkFeet(8);
        policeLights(14);
        audio.startScore();
      },
    },
    {
      when: () => G.heat >= 92,
      run: () => {
        audio.knock(5, true);
        setTimeout(() => audio.impact(0.6), 2400);
        caption('they found the basement door.', 4);
        game.cam.shake = 0.6;
        walkFeet(10);
        game.fx.glitch = 0.6;
      },
    },
    { when: () => G.money >= GOAL, run: () => ghost('that\'s the number. SEND IT.') },
  ];
  const fired = new Set();

  // shadows of someone pacing behind the basement door
  function walkFeet(seconds) {
    const c = P.crack;
    const start = engine.time;
    const off = engine.onUpdate(() => {
      const t = engine.time - start;
      const shadow = Math.max(0, Math.sin(t * 2.3)) * Math.max(0, Math.sin(t * 0.9 + 1));
      c.mat.opacity = 0.85 * (1 - shadow * 0.9);
      c.light.intensity = c.base * (1 - shadow * 0.85);
      if (t > seconds) {
        c.mat.opacity = 0.85;
        c.light.intensity = c.base;
        off();
      }
    });
  }
  function policeLights(seconds) {
    const { red, blue } = P.police;
    const start = engine.time;
    engine.u.uSat.value = 0.55;
    const off = engine.onUpdate(() => {
      const t = engine.time - start;
      const k = Math.min(1, t, seconds - t);
      red.intensity = (Math.sin(t * 9) > 0 ? 9 : 0) * Math.max(0, k);
      blue.intensity = (Math.sin(t * 9) <= 0 ? 9 : 0) * Math.max(0, k);
      if (t > seconds) {
        red.intensity = blue.intensity = 0;
        engine.u.uSat.value = 0.22;
        off();
      }
    });
  }

  // ───────────────── per-frame ─────────────────
  let wasRunning = false;
  const api = {
    update(dt) {
      if (ended) return;
      if (G.running && game.mode === 'play') {
        G.elapsed += dt;
        const m = mining();
        addMoney(m.rate * dt, 'mine');
        G.heat = Math.min(100, G.heat + heatRate() * dt);
        audio.setScore(Math.max(0, (G.heat - 35) / 65));
        if (G.heat > 35 && !audio.loops.score) audio.startScore();
      }
      for (const b of beats) {
        if (fired.has(b) || busy || ringing) continue;
        if (b.when()) {
          fired.add(b);
          b.run();
          break;
        }
      }
      if (G.heat >= 100 && !ended && !busy) {
        ended = true;
        endings.run('caught');
      }
    },
    end() {
      ended = true;
    },
    policeLights,
    walkFeet,
  };

  on('pay', () => {
    if (ended) return;
    ended = true;
    endings.run('win');
  });
  on('surrender', () => {
    if (ended) return;
    ended = true;
    endings.run('surrender');
  });

  return api;
}
