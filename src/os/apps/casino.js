import { C, FONT, HEAD, TYPE, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, addMoney, spend, emit, addHeat } from '../../game/state.js';

const SYMS = ['7', '₿', '$', '◆', '♥', '☠'];
const WEIGHTS = [1, 2, 3, 4, 5, 3];
const PAY3 = { '7': 30, '₿': 15, $: 10, '◆': 6, '♥': 4 };
const SYM_COL = { '7': '#ff5c5c', '₿': '#ffc857', $: '#5cf08a', '◆': '#6ab7ff', '♥': '#ff7ad9', '☠': '#dfe6df' };
const UNVERIFIED_LIMIT = 25000;

function weighted() {
  let r = Math.random() * WEIGHTS.reduce((a, b) => a + b, 0);
  for (let i = 0; i < SYMS.length; i++) if ((r -= WEIGHTS[i]) < 0) return i;
  return 0;
}

export const Casino = {
  title: 'LUCKY☠STRIKE CASINO',
  label: 'Casino',
  icon: 'casino',
  w: 940,
  h: 700,
  create(os) {
    let tab = 0;
    let bet = 100;
    // slots
    const reels = [0, 1, 2].map(() => ({ pos: Math.random() * 6, speed: 0, target: 0, stopAt: 0, stopped: true }));
    let spinning = false, spinT = 0, slotMsg = 'pull the lever', slotWin = 0, lastTick = 0;
    // crash
    let crash = { state: 'idle', m: 1, at: 0, t: 0, stake: 0, pts: [], msg: 'set a bet and launch' };
    // coin
    let coin = { state: 'idle', t: 0, side: 0, msg: 'double or nothing' };

    const limit = () => (G.flags.faceVerified ? Infinity : UNVERIFIED_LIMIT);

    function takeBet() {
      if (bet > G.money) {
        audio.error();
        return false;
      }
      if (bet > limit()) {
        faceScanOffer();
        return false;
      }
      spend(bet);
      G.stats.gambled += bet;
      return true;
    }
    function payout(n) {
      addMoney(n, 'casino');
      G.stats.gambleWon += n;
    }

    function faceScanOffer() {
      if (G.flags.faceDeclined) {
        os.notify('Bet limit', `Unverified players are limited to ${money(UNVERIFIED_LIMIT)} per bet.`, { app: 'casino', color: C.amber });
        audio.error();
        return;
      }
      os.modal({
        title: 'High Roller Verification',
        body: `Bets over ${money(UNVERIFIED_LIMIT)} require a quick selfie face scan to verify your age and identity. It takes 3 seconds and unlocks unlimited bets!`,
        buttons: [
          {
            label: 'no thanks',
            fn: () => {
              G.flags.faceDeclined = true;
              os.notify('Good call.', 'Never give a website your face. The limit stays.', { color: C.green });
            },
          },
          { label: 'SCAN MY FACE', kind: 'primary', fn: () => emit('trap', 'face') },
        ],
      });
    }

    function googleOffer() {
      os.modal({
        title: 'Sign in with Google',
        body: 'LUCKY☠STRIKE wants to access your Google Account:\n\n•  See your name, email address and profile picture\n•  See and download your contacts\n•  See your location history\n•  See your saved passwords\n\n$500 sign-up bonus will be credited instantly.',
        buttons: [
          { label: 'Cancel' },
          { label: 'Continue', kind: 'primary', fn: () => emit('trap', 'google') },
        ],
      });
    }

    function betPicker(g, x, y, w) {
      g.text('BET', x, y + 24, { size: 26, font: HEAD, color: C.dim });
      g.text(money(bet), x + 56, y + 25, { size: 24, bold: true, color: bet > G.money ? C.red : C.text });
      const chips = [10, 100, 1000, 10000, 100000];
      let cx = x;
      const busy = spinning || crash.state === 'flying' || coin.state === 'flipping';
      for (const c of chips) {
        if (g.button('chip' + c, cx, y + 40, 84, 36, short(c), { disabled: busy, kind: bet === c ? 'gold' : undefined })) bet = c;
        cx += 90;
      }
      if (g.button('chipx2', cx, y + 40, 60, 36, '×2', { disabled: busy })) bet = Math.max(1, bet * 2);
      if (g.button('chiphalf', cx + 66, y + 40, 60, 36, '½', { disabled: busy })) bet = Math.max(1, Math.floor(bet / 2));
      if (g.button('chipall', cx + 132, y + 40, 110, 36, 'ALL IN', { disabled: busy, kind: 'danger' })) bet = Math.max(1, Math.floor(Math.min(G.money, limit())));
      if (!G.flags.faceVerified) g.text(`max bet ${money(UNVERIFIED_LIMIT)} (unverified)`, x, y + 100, { size: 14, color: C.faint });
    }

    // ── slots
    function startSpin() {
      if (spinning || !takeBet()) return;
      spinning = true;
      spinT = 0;
      slotWin = 0;
      slotMsg = '...';
      reels.forEach((r, i) => {
        r.speed = 26 + i * 3;
        r.stopped = false;
        r.result = weighted();
        r.stopAt = 0.9 + i * 0.38;
      });
    }
    function settleSlots() {
      const s = reels.map((r) => SYMS[r.result]);
      const counts = {};
      s.forEach((x) => (counts[x] = (counts[x] || 0) + 1));
      let mult = 0;
      if (counts['☠'] === 3) {
        mult = -1;
      } else {
        for (const k in counts) {
          if (k === '☠') continue;
          if (counts[k] === 3) mult = PAY3[k];
          else if (counts[k] === 2) mult = Math.max(mult, 1.8);
        }
      }
      if (mult > 0) {
        slotWin = Math.round(bet * mult);
        payout(slotWin);
        slotMsg = mult >= 10 ? `JACKPOT ×${mult}  +${money(slotWin)}` : `WIN ×${mult}  +${money(slotWin)}`;
        audio.win(mult >= 10 ? 2 : 1);
        if (mult >= 10) os.notify('JACKPOT', `${s.join(' ')}  +${money(slotWin)}`, { app: 'casino', color: C.amber });
      } else if (mult < 0) {
        const extra = Math.min(G.money, bet);
        spend(extra);
        slotMsg = `☠☠☠  THE HOUSE TAKES ANOTHER ${money(extra)}`;
        audio.lose();
        audio.stinger(0.12);
      } else {
        slotMsg = 'nothing. again?';
        audio.lose();
      }
    }
    function drawSlots(g, w, h, dt) {
      // reels advance
      if (spinning) {
        spinT += dt;
        let allStopped = true;
        reels.forEach((r) => {
          if (r.stopped) return;
          allStopped = false;
          if (spinT >= r.stopAt) {
            // snap to the chosen symbol
            r.pos = r.result + 6 * 4;
            r.stopped = true;
            audio.blip(220, 0.06, 0.08);
          } else {
            r.pos += r.speed * dt;
          }
        });
        if (spinT - lastTick > 0.06) {
          lastTick = spinT;
          audio.reelTick();
        }
        if (allStopped) {
          spinning = false;
          settleSlots();
        }
      }
      const rw = 170, rh = 250, gap = 24;
      const x0 = (w - (rw * 3 + gap * 2)) / 2, y0 = 26;
      g.rect(x0 - 20, y0 - 20, rw * 3 + gap * 2 + 40, rh + 40, '#1c0f10');
      g.stroke(x0 - 20, y0 - 20, rw * 3 + gap * 2 + 40, rh + 40, '#6b2a2a', 3);
      reels.forEach((r, i) => {
        const x = x0 + i * (rw + gap);
        g.rect(x, y0, rw, rh, '#0b0b0b');
        g.clip(x, y0, rw, rh);
        const symH = 100;
        const base = r.pos;
        for (let k = -2; k <= 2; k++) {
          const idx = Math.floor(base) + k;
          const frac = base - Math.floor(base);
          const sym = SYMS[((idx % 6) + 6) % 6];
          const yy = y0 + rh / 2 + (k - frac) * symH;
          const blur = !r.stopped;
          g.ctx.globalAlpha = blur ? 0.55 : 1;
          g.text(sym, x + rw / 2, yy, { align: 'center', base: 'middle', size: 78, bold: true, font: 'Arial', color: SYM_COL[sym] });
          g.ctx.globalAlpha = 1;
        }
        g.unclip();
        g.stroke(x, y0, rw, rh, '#3b2020', 2);
      });
      g.line(x0 - 20, y0 + rh / 2, x0 + rw * 3 + gap * 2 + 20, y0 + rh / 2, 'rgba(255,92,92,0.5)', 2);
      g.text(slotMsg, w / 2, y0 + rh + 46, { align: 'center', size: 26, font: HEAD, color: slotWin ? C.amber : C.dim });
      betPicker(g, 30, h - 150, w);
      if (g.button('spin', w - 250, h - 150, 220, 76, spinning ? '...' : 'SPIN', { kind: 'danger', size: 26, disabled: spinning })) startSpin();
      g.text('3×7 ×30   3×₿ ×15   3×$ ×10   3×◆ ×6   3×♥ ×4   pair ×1.8   ☠☠☠ lose double', w / 2, h - 18, { align: 'center', size: 13, color: C.faint });
    }

    // ── crash
    function startCrash() {
      if (crash.state === 'flying' || !takeBet()) return;
      const u = Math.random();
      crash = { state: 'flying', m: 1, at: Math.max(1, 0.97 / (1 - u)), t: 0, stake: bet, pts: [], msg: '' };
      if (Math.random() < 0.03) crash.at = 1.0;
      audio.powerUp();
    }
    function cashOut() {
      if (crash.state !== 'flying') return;
      const win = Math.round(crash.stake * crash.m);
      payout(win);
      crash.state = 'cashed';
      crash.msg = `CASHED OUT @ ${crash.m.toFixed(2)}×  +${money(win)}`;
      audio.win(crash.m > 5 ? 2 : 1);
    }
    function drawCrash(g, w, h, dt) {
      const gx = 30, gy = 20, gw = w - 60, gh = 330 - 40;
      g.rect(gx, gy, gw, gh, '#070a0b');
      g.stroke(gx, gy, gw, gh, C.border);
      if (crash.state === 'flying') {
        crash.t += dt;
        crash.m = Math.exp(0.16 * crash.t);
        crash.pts.push(crash.m);
        if (crash.m >= crash.at) {
          crash.m = crash.at;
          crash.state = 'crashed';
          crash.msg = `CRASHED @ ${crash.at.toFixed(2)}×`;
          audio.boom();
        }
      }
      const maxM = Math.max(2, ...crash.pts.slice(-1));
      const maxT = Math.max(8, crash.t);
      // grid
      for (let i = 1; i < 5; i++) g.line(gx, gy + (gh * i) / 5, gx + gw, gy + (gh * i) / 5, '#11181a');
      const ctx = g.ctx;
      ctx.strokeStyle = crash.state === 'crashed' ? C.red : C.green;
      ctx.lineWidth = 4;
      ctx.beginPath();
      const n = crash.pts.length;
      let lx = gx, ly = gy + gh;
      crash.pts.forEach((m, i) => {
        const tt = (i / Math.max(1, n - 1)) * crash.t;
        lx = gx + (tt / maxT) * gw;
        ly = gy + gh - ((m - 1) / (maxM - 1)) * (gh - 20);
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      });
      ctx.stroke();
      if (n) {
        g.text(crash.state === 'crashed' ? '💥' : '🚀', lx, ly, { align: 'center', base: 'middle', size: 34, font: 'Arial' });
      }
      const col = crash.state === 'crashed' ? C.red : crash.state === 'cashed' ? C.amber : C.green;
      g.text(`${crash.m.toFixed(2)}×`, gx + gw / 2, gy + gh / 2, { align: 'center', base: 'middle', size: 96, font: HEAD, color: col });
      g.text(crash.msg || 'it only goes up. until it doesn\'t.', gx + gw / 2, gy + gh / 2 + 66, { align: 'center', size: 22, font: HEAD, color: C.dim });
      if (crash.state === 'flying') g.text(`stake ${money(crash.stake)}  →  ${money(crash.stake * crash.m)}`, gx + 16, gy + 28, { size: 16, color: C.text });
      betPicker(g, 30, h - 150, w);
      if (crash.state === 'flying') {
        if (g.button('cashout', w - 250, h - 150, 220, 76, 'CASH OUT', { kind: 'gold', size: 26 })) cashOut();
      } else if (g.button('launch', w - 250, h - 150, 220, 76, 'LAUNCH', { kind: 'primary', size: 26 })) startCrash();
    }

    // ── coin
    function flip() {
      if (coin.state === 'flipping' || !takeBet()) return;
      coin = { state: 'flipping', t: 0, win: Math.random() < 0.485, stake: bet, msg: '' };
      audio.blip(1200, 0.05, 0.06);
    }
    function drawCoin(g, w, h, dt) {
      const cx = w / 2, cy = 150;
      let sx = 1, face = coin.side || 0;
      if (coin.state === 'flipping') {
        coin.t += dt;
        const spins = 9;
        const p = Math.min(1, coin.t / 1.6);
        const ang = (1 - Math.pow(1 - p, 3)) * spins * Math.PI + (coin.win ? 0 : Math.PI);
        sx = Math.cos(ang);
        face = sx >= 0 ? 0 : 1;
        if (Math.random() < 0.3) audio.reelTick();
        if (p >= 1) {
          coin.state = 'done';
          coin.side = coin.win ? 0 : 1;
          if (coin.win) {
            payout(coin.stake * 2);
            coin.msg = `DOUBLED  +${money(coin.stake * 2)}`;
            audio.win(coin.stake >= 50000 ? 2 : 1);
          } else {
            coin.msg = `GONE  -${money(coin.stake)}`;
            audio.lose();
          }
        }
      }
      const R = 100;
      g.ctx.save();
      g.ctx.translate(cx, cy);
      g.ctx.scale(Math.max(0.04, Math.abs(sx)), 1);
      g.circle(0, 0, R + 8, '#5a4510');
      g.circle(0, 0, R, face ? '#3a3a3a' : '#b8902a', face ? '#777' : '#ffd56e', 6);
      g.text(face ? '☠' : '₿', 0, 6, { align: 'center', base: 'middle', size: 130, bold: true, font: 'Arial', color: face ? '#ddd' : '#fff1c2' });
      g.ctx.restore();
      g.text(coin.msg || 'heads you win. skulls you don\'t.', cx, cy + R + 52, { align: 'center', size: 26, font: HEAD, color: coin.state === 'done' ? (coin.win ? C.amber : C.red) : C.dim });
      betPicker(g, 30, h - 150, w);
      if (g.button('flip', w - 250, h - 150, 220, 76, 'FLIP', { kind: 'gold', size: 26, disabled: coin.state === 'flipping' })) flip();
    }

    return {
      draw(g, w, h, dt) {
        // header w/ the google trap
        g.rect(0, 0, w, 64, '#1a0c0d');
        g.text('LUCKY☠STRIKE', 20, 46, { size: 46, font: HEAD, color: C.red });
        g.text(money(G.money), w - 20, 42, { size: 22, bold: true, align: 'right', color: C.green });
        if (!G.flags.google) {
          const pulse = 0.6 + 0.4 * Math.sin(g.t * 4);
          if (g.button('gsign', 300, 14, 300, 38, '', {
            bg: '#f1f1f1',
            border: '#ccc',
            draw: (x, y, bw, bh) => {
              g.circle(x + 22, y + bh / 2, 11, null, '#4285f4', 4);
              g.text('Sign in with Google  +$500', x + 42, y + bh / 2 + 1, { base: 'middle', size: 15, bold: true, color: '#222' });
              g.ctx.globalAlpha = pulse;
              g.text('FREE', x + bw - 10, y + bh / 2 + 1, { base: 'middle', align: 'right', size: 13, bold: true, color: '#d33' });
              g.ctx.globalAlpha = 1;
            },
          }))
            googleOffer();
        }
        tab = g.tabs('ctabs', 14, 72, ['SLOTS', 'CRASH', 'DOUBLE OR NOTHING'], tab, { accent: C.red });
        g.push(0, 112);
        const ch = h - 112;
        if (tab === 0) drawSlots(g, w, ch, dt);
        else if (tab === 1) drawCrash(g, w, ch, dt);
        else drawCoin(g, w, ch, dt);
        g.pop();
      },
    };
  },
};
