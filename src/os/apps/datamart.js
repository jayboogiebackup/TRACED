import { C, FONT, HEAD, TYPE, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, addMoney, spend, emit, addHeat, secret } from '../../game/state.js';
import { info } from '../../game/userinfo.js';

const HEX = ['1C', '55', 'BD', 'E9', '7A', 'FF', '3F', 'A0'];
const TARGETS = [
  { id: 'pizza', name: "Tony's Pizza (online orders)", records: 12000, len: 3, time: 14, grid: 4, shuffle: 0, risk: 0.5 },
  { id: 'dentist', name: 'Bright Smile Dental', records: 48000, len: 4, time: 14, grid: 5, shuffle: 0, risk: 1 },
  { id: 'gym', name: 'IronPump Gym Chain', records: 140000, len: 5, time: 15, grid: 5, shuffle: 3.5, risk: 1.5 },
  { id: 'exchange', name: 'CoinVault Exchange', records: 420000, len: 6, time: 16, grid: 6, shuffle: 2.5, risk: 2.5 },
  { id: 'police', name: 'Metro Police Dept. — case files', records: 0, len: 7, time: 17, grid: 6, shuffle: 2, risk: 4, special: true },
];
const BUYERS = ['n0name_crew', 'sp4mlord', 'ad_tech_llc', 'ransom_rick', 'insurance_co (legit?)', 'data_brokers_inc'];

export const DataMart = {
  title: 'DATAMART — buy · sell · leak',
  label: 'DataMart',
  icon: 'datamart',
  w: 1000,
  h: 680,
  create(os) {
    let tab = 0;
    const S = { records: 0, hack: null, bids: BUYERS.map((b) => ({ who: b, per1k: 30 + Math.random() * 50 })), bidT: 0, done: {}, scanner: false, doxxBought: 0 };
    G.datamart = S;

    function startHack(t) {
      const n = t.grid;
      const cells = Array.from({ length: n * n }, () => HEX[(Math.random() * HEX.length) | 0]);
      const seq = Array.from({ length: t.len }, () => HEX[(Math.random() * HEX.length) | 0]);
      // guarantee the sequence exists in the grid
      const spots = [...cells.keys()].sort(() => Math.random() - 0.5).slice(0, t.len);
      spots.forEach((s, i) => (cells[s] = seq[i]));
      S.hack = { t, cells, seq, i: 0, time: t.time, shuffleT: t.shuffle, state: 'run', flash: 0 };
      audio.powerUp();
    }
    function shuffle(h) {
      const need = new Set(h.seq.slice(h.i));
      for (let k = 0; k < h.cells.length; k++) if (Math.random() < 0.5 && !need.has(h.cells[k])) h.cells[k] = HEX[(Math.random() * HEX.length) | 0];
      // keep the next needed code somewhere
      if (!h.cells.includes(h.seq[h.i])) h.cells[(Math.random() * h.cells.length) | 0] = h.seq[h.i];
    }
    function finish(h, ok) {
      h.state = ok ? 'win' : 'fail';
      if (ok) {
        audio.win(1);
        if (h.t.special) {
          if (!S.done.police) {
            S.done.police = true;
            addHeat(-18, 'Records system error: suspect file corrupted. Units re-checking address.');
            secret('copsdb');
            os.notify('YOUR FILE IS GONE', 'Police lost a chunk of their trail. For now.', { app: 'scanner', color: C.green });
          }
        } else {
          const r = Math.round(h.t.records * (0.8 + Math.random() * 0.4));
          S.records += r;
          G.stats.records += r;
          os.notify('Breach complete', `${short(r)} records exfiltrated from ${h.t.name}`, { app: 'datamart', color: C.green });
        }
      } else {
        audio.error();
        addHeat(h.t.risk, `Intrusion detected at ${h.t.name}. Trace attempt in progress.`);
      }
    }

    function drawHack(g, w, h, dt) {
      const k = S.hack;
      if (k.state === 'run') {
        k.time -= dt;
        if (k.t.shuffle) {
          k.shuffleT -= dt;
          if (k.shuffleT <= 0) {
            k.shuffleT = k.t.shuffle;
            shuffle(k);
            audio.blip(180, 0.03, 0.04);
          }
        }
        if (k.time <= 0) finish(k, false);
      }
      k.flash = Math.max(0, k.flash - dt * 4);
      g.text(`BREACHING: ${k.t.name}`, 24, 30, { size: 20, bold: true, color: C.green });
      g.text(k.state === 'run' ? `${k.time.toFixed(1)}s` : '', w - 24, 30, { size: 26, font: HEAD, align: 'right', color: k.time < 4 ? C.red : C.amber });
      g.progress(24, 42, w - 48, 6, Math.max(0, k.time / k.t.time), k.time < 4 ? C.red : C.green);
      // sequence
      // phones: sequence on the left, a big grid on the right
      const M = g.mobile;
      const sy = M ? 72 : 92, sw = M ? 50 : 60, sp = M ? 56 : 70;
      g.text('SEQUENCE', 24, sy - 10, { size: 14, bold: true, color: C.dim });
      k.seq.forEach((s, i) => {
        const x = 24 + i * sp;
        g.rect(x, sy, sw, 44, i < k.i ? '#163a24' : i === k.i ? '#2a2a12' : '#0c1010');
        g.stroke(x, sy, sw, 44, i === k.i ? C.amber : C.border, 2);
        g.text(s, x + sw / 2, sy + 24, { align: 'center', base: 'middle', size: 24, font: HEAD, color: i < k.i ? C.green : C.text });
      });
      if (M) g.para(`tap the codes in order.\nwrong codes cost 2 seconds.`, 24, sy + 82, 380, { size: 15, color: C.dim });
      // grid
      const n = k.t.grid, cs = M ? Math.min(58, (h - 66) / n) : Math.min(70, (h - 200) / n);
      const gx = M ? w - n * cs - 20 : (w - n * cs) / 2, gy = M ? 58 : 160;
      if (k.flash > 0) g.rect(gx - 10, gy - 10, n * cs + 20, n * cs + 20, `rgba(255,92,92,${k.flash * 0.3})`);
      k.cells.forEach((c, i) => {
        const x = gx + (i % n) * cs, y = gy + Math.floor(i / n) * cs;
        const over = g.over(x + 3, y + 3, cs - 6, cs - 6);
        g.rect(x + 3, y + 3, cs - 6, cs - 6, over ? '#1c2a22' : '#0d1311');
        g.text(c, x + cs / 2, y + cs / 2 + 1, { align: 'center', base: 'middle', size: cs * 0.4, font: HEAD, color: over ? C.green : '#7fb08f' });
        if (k.state === 'run' && g.hit('cell' + i, x + 3, y + 3, cs - 6, cs - 6, { onPress: true })) {
          if (c === k.seq[k.i]) {
            k.i++;
            k.cells[i] = '··';
            audio.blip(600 + k.i * 120, 0.05, 0.07);
            if (k.i >= k.seq.length) finish(k, true);
          } else {
            k.time -= 2;
            k.flash = 1;
            audio.error();
          }
        }
      });
      if (k.state !== 'run') {
        g.rect(0, h / 2 - 60, w, 120, 'rgba(0,0,0,0.8)');
        g.text(k.state === 'win' ? 'ACCESS GRANTED' : 'TRACE DETECTED — CONNECTION DROPPED', w / 2, h / 2 - 10, { align: 'center', size: 40, font: HEAD, color: k.state === 'win' ? C.green : C.red });
        if (g.button('hackdone', w / 2 - 90, h / 2 + 12, 180, 40, 'continue', { kind: 'primary' })) S.hack = null;
      }
    }

    return {
      tick(dt) {
        S.bidT -= dt;
        if (S.bidT <= 0) {
          S.bidT = 3;
          for (const b of S.bids) b.per1k = Math.max(8, Math.min(140, b.per1k * (1 + (Math.random() - 0.5) * 0.25)));
        }
      },
      draw(g, w, h, dt) {
        g.rect(0, 0, w, h, '#080b0a');
        g.rect(0, 0, w, 64, '#0d1512');
        g.text('DATAMART', 20, 44, { size: 44, font: HEAD, color: C.green });
        g.text(`your records: ${short(S.records)}`, 230, 42, { size: 16, bold: true, color: C.text });
        g.text(money(G.money), w - 20, 42, { size: 22, bold: true, align: 'right', color: C.green });
        if (S.hack) {
          g.push(0, 64);
          drawHack(g, w, h - 64, dt);
          g.pop();
          return;
        }
        tab = g.tabs('dmtabs', 14, 72, ['HACK', 'SELL RECORDS', 'LISTINGS'], tab);
        // phones: the tab pages are taller than the screen, so they scroll
        const tabBody = (ch) => {
        if (tab === 0) {
          g.para('Pick a target. Click the hex codes in the order shown before the timer runs out. Wrong codes cost time. Failing makes noise.', 24, 30, w - 48, { size: 15, color: C.dim });
          TARGETS.forEach((t, i) => {
            const y = 66 + i * 90;
            g.rect(20, y, w - 40, 80, i % 2 ? '#0d1311' : '#0f1513');
            g.text(t.name, 40, y + 32, { size: 19, bold: true, color: t.special ? C.blue : C.text });
            const d = t.special ? (S.done.police ? 'already wiped. they rebuilt the backup.' : 'delete your own file. police lose your trail.') : `~${short(t.records)} records · ${t.len}-code sequence${t.shuffle ? ' · grid reshuffles' : ''}`;
            g.text(d, 40, y + 58, { size: 15, color: C.dim });
            const dif = ['EASY', 'MEDIUM', 'HARD', 'VERY HARD', 'INSANE'][i];
            g.text(dif, w - 260, y + 46, { size: 16, bold: true, align: 'right', color: [C.green, C.amber, C.amber, C.red, C.red][i] });
            const dis = t.special && S.done.police;
            if (g.button('hk' + t.id, w - 230, y + 20, 190, 40, 'BREACH', { kind: dis ? undefined : 'primary', disabled: dis })) startHack(t);
          });
        } else if (tab === 1) {
          g.para('Buyers bid per 1,000 records. Bids move every few seconds. Every sale gets noticed by someone.', 24, 30, w - 48, { size: 15, color: C.dim });
          S.bids.forEach((b, i) => {
            const y = 60 + i * 66;
            const v = Math.round((S.records / 1000) * b.per1k);
            g.rect(20, y, w - 40, 58, i % 2 ? '#0d1311' : '#0f1513');
            g.text(b.who, 40, y + 36, { size: 18, bold: true });
            g.text(`${money(b.per1k, 2)} / 1k`, 420, y + 36, { size: 18, color: C.amber });
            if (g.button('sellto' + i, w - 330, y + 9, 290, 40, S.records ? `SELL ALL  ${money(v)}` : 'no records', { kind: 'primary', disabled: !S.records })) {
              addMoney(v, 'data');
              addHeat(0.6 + Math.min(3, v / 30000), `Leaked records surfaced online. Origin traced toward this region.`);
              S.records = 0;
              audio.cash(v > 20000);
            }
          });
        } else {
          const items = [
            {
              id: 'tip',
              name: 'Insider Tip — next ST0NKS move',
              desc: 'Know the next big headline ~20 seconds early.',
              price: 4000,
              go: () => {
                const tip = os.app('stonks').buyTip();
                os.notify('Insider tip', `$${tip.sym} will move ${tip.k > 0 ? 'UP' : 'DOWN'} ~${Math.round(Math.abs(tip.k) * 100)}% soon.`, { app: 'stonks', color: C.amber });
              },
            },
            {
              id: 'scan',
              name: 'Police Scanner Decryption Key',
              desc: 'Hear the police coming. Exact ETA in the Scanner app.',
              price: 3000,
              once: true,
              go: () => {
                S.scanner = true;
                G.flags.scannerKey = true;
                os.notify('Scanner decrypted', 'Open SCANNER to listen in.', { app: 'scanner', color: C.blue });
              },
            },
            {
              id: 'doxx',
              name: `FULL DOX — ${info.os} user, ${info.city || 'your city'} — ${info.browser}`,
              desc: `passwords · photos · search history · home address · screen ${info.screen} · ${info.gpu || 'gpu'} · sold ${(2341 + S.doxxBought).toLocaleString()} times`,
              price: 4.99,
              go: () => {
                S.doxxBought++;
                secret('doxx');
                os.modal({
                  title: 'Purchase complete',
                  body: `You bought your own data back for $4.99.\n\nThe seller still has ${(2340 + S.doxxBought).toLocaleString()} copies.\n\nThat's not how data works. Once it's out, it's out.`,
                  buttons: [{ label: 'oh.' }],
                });
                audio.stinger(0.12);
              },
            },
          ];
          items.forEach((it, i) => {
            const y = 26 + i * 110;
            const owned = it.once && S[it.id === 'scan' ? 'scanner' : it.id];
            g.rect(20, y, w - 40, 98, it.id === 'doxx' ? '#1a0e0e' : '#0f1513');
            g.text(it.name, 40, y + 34, { size: 18, bold: true, color: it.id === 'doxx' ? C.red : C.text, max: w - 340 });
            g.para(it.desc, 40, y + 60, w - 360, { size: 14, color: C.dim });
            if (g.button('li' + it.id, w - 260, y + 28, 220, 42, owned ? 'OWNED' : money(it.price, it.price < 10 ? 2 : 0), { kind: owned ? undefined : 'primary', disabled: owned })) {
              if (spend(it.price)) {
                audio.cash();
                it.go();
              } else audio.error();
            }
          });
        }
        };
        if (g.mobile) g.scrollArea('dmBody' + tab, 0, 112, w, h - 112, 520, () => tabBody(520));
        else {
          g.push(0, 112);
          tabBody(h - 112);
          g.pop();
        }
      },
    };
  },
};
