import { C, FONT, HEAD, TYPE, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, addMoney, spend, emit, addHeat } from '../../game/state.js';

// The Velvet Road: a darknet market. Buy low from suppliers, wait for the package,
// sell high on the street. Every sale makes noise. Some buyers are cops.

const GOODS = [
  { id: 'moon', name: 'Moon Rocks', base: 40, spread: 1.9 },
  { id: 'lotus', name: 'Blue Lotus', base: 120, spread: 2.1 },
  { id: 'pharma', name: 'Pharma Pack', base: 300, spread: 1.8 },
  { id: 'powder', name: 'Mystery Powder', base: 900, spread: 2.0 },
  { id: 'gummy', name: 'Shroom Gummies', base: 60, spread: 2.4 },
  { id: 'brownie', name: 'Grandma\'s Brownies', base: 15, spread: 3.0 },
];

export const Velvet = {
  title: 'velvetroad.onion',
  label: 'Velvet Road',
  icon: 'velvet',
  w: 1000,
  h: 680,
  create(os) {
    const S = {
      inv: {},
      ship: [],
      buy: {},
      sell: {},
      qty: 5,
      events: [],
      evT: 20,
      log: [],
    };
    G.velvet = S;
    GOODS.forEach((g) => {
      S.inv[g.id] = 0;
      S.buy[g.id] = g.base;
      S.sell[g.id] = g.base * g.spread;
    });
    const cap = () => 20 + (G.owned.stash || 0) * 20;
    const held = () => Object.values(S.inv).reduce((a, b) => a + b, 0) + S.ship.reduce((a, s) => a + s.n, 0);

    function drift(dt) {
      for (const g of GOODS) {
        const tb = g.base, ts = g.base * g.spread;
        S.buy[g.id] += (tb - S.buy[g.id]) * dt * 0.05 + S.buy[g.id] * (Math.random() - 0.5) * 0.04 * dt * 4;
        S.sell[g.id] += (ts - S.sell[g.id]) * dt * 0.04 + S.sell[g.id] * (Math.random() - 0.5) * 0.05 * dt * 4;
        S.buy[g.id] = Math.max(g.base * 0.4, S.buy[g.id]);
        S.sell[g.id] = Math.max(g.base * 0.6, S.sell[g.id]);
      }
    }
    function event() {
      const g = GOODS[(Math.random() * GOODS.length) | 0];
      const r = Math.random();
      if (r < 0.45) {
        S.sell[g.id] *= 2.4 + Math.random() * 1.2;
        S.events.unshift({ text: `SHORTAGE: ${g.name} street price is through the roof`, c: C.green });
      } else if (r < 0.75) {
        S.buy[g.id] *= 0.35;
        S.events.unshift({ text: `FIRE SALE: supplier dumping ${g.name} cheap`, c: C.amber });
      } else {
        S.sell[g.id] *= 0.4;
        S.events.unshift({ text: `BUST: ${g.name} flooded the market. prices crashed`, c: C.red });
      }
      if (S.events.length > 4) S.events.pop();
      os.notify('velvetroad.onion', S.events[0].text, { app: 'velvet', color: S.events[0].c, silent: !os.isOpen('velvet') });
    }

    function buy(g, n) {
      n = Math.min(n, cap() - held());
      if (n <= 0) {
        os.notify('Stash full', 'Buy a bigger stash box at RigMart.', { app: 'rigmart', color: C.amber });
        audio.error();
        return;
      }
      const cost = Math.round(S.buy[g.id] * n * (G.flags.idDiscount ? 0.8 : 1));
      if (!spend(cost)) {
        audio.error();
        return;
      }
      S.ship.push({ id: g.id, n, t: 0, dur: 7 + Math.random() * 4 });
      audio.blip(700, 0.05, 0.06);
    }
    function sell(g, n) {
      n = Math.min(n, S.inv[g.id]);
      if (n <= 0) return;
      // undercover buyer?
      if (Math.random() < 0.06) {
        S.inv[g.id] -= n;
        addHeat(6, 'Undercover buy went sideways. Suspect profile updated.');
        S.log.unshift({ text: `the buyer was a cop. lost ${n}× ${g.name}`, c: C.red });
        audio.stinger(0.2);
        os.notify('IT WAS A COP', `You lost ${n}× ${g.name}. They know more about you now.`, { app: 'velvet', color: C.red, creepy: true });
        return;
      }
      const v = Math.round(S.sell[g.id] * n);
      S.inv[g.id] -= n;
      addMoney(v, 'velvet');
      G.stats.deals++;
      addHeat(0.35 + Math.min(2.5, v / 25000), null);
      S.sell[g.id] *= 1 - Math.min(0.3, n * 0.011);
      S.log.unshift({ text: `sold ${n}× ${g.name} for ${money(v)}`, c: C.green });
      if (S.log.length > 5) S.log.pop();
      audio.cash();
      emit('deal', v);
    }

    return {
      tick(dt) {
        drift(dt);
        S.evT -= dt;
        if (S.evT <= 0) {
          S.evT = 25 + Math.random() * 25;
          event();
        }
        for (let i = S.ship.length - 1; i >= 0; i--) {
          const s = S.ship[i];
          s.t += dt;
          if (s.t >= s.dur) {
            S.inv[s.id] += s.n;
            S.ship.splice(i, 1);
            const g = GOODS.find((x) => x.id === s.id);
            os.notify('Package delivered', `${s.n}× ${g.name} is in your stash`, { app: 'velvet', color: C.pink });
            emit('package');
          }
        }
      },
      draw(g, w, h) {
        // phones get the same page in a scrolling column with tighter columns
        if (g.mobile) g.scrollArea('velvetPage', 0, 0, w, h, 650, (aw) => page(g, aw, 650));
        else page(g, w, h);
      },
    };
    function page(g, w, h) {
        const M = g.mobile;
        g.rect(0, 0, w, h, '#0e0a0d');
        g.rect(0, 0, w, 64, '#1a0f16');
        g.text('the velvet road', 20, 44, { size: 34, font: TYPE, color: '#ff9ad9' });
        g.text('est. 2014 · escrow · 4.6★', 330, 42, { size: 15, color: C.dim });
        g.text(money(G.money), w - 20, 42, { size: 22, bold: true, align: 'right', color: C.green });

        // ID upload trap
        let y = 72;
        if (!G.flags.idUploaded) {
          if (g.button('vbuyer', 20, y, w - 40, 38, '', {
            bg: '#22121c',
            border: '#5a2a48',
            draw: (bx, by, bw, bh) => {
              g.text(M ? '★ VERIFIED BUYER — upload your ID, get 20% off forever' : '★ Become a VERIFIED BUYER — upload a photo of your ID, get 20% off everything forever', bx + bw / 2, by + bh / 2 + 1, { align: 'center', base: 'middle', size: 15, bold: true, color: '#ffb3e6', max: bw - 20 });
            },
          }))
            os.modal({
              title: 'Verified Buyer Program',
              body: 'Upload a clear photo of the front and back of your government ID.\n\nYour information is stored securely and never shared.*\n\n* on most days',
              buttons: [{ label: 'nope' }, { label: 'UPLOAD ID', kind: 'primary', fn: () => emit('trap', 'id') }],
            });
          y += 46;
        } else y += 8;

        g.text(`stash ${held()}/${cap()}`, 20, y + 20, { size: 15, bold: true, color: held() >= cap() ? C.red : C.dim });
        if (G.flags.idDiscount) g.text('verified buyer (they have your ID)', 180, y + 20, { size: 15, color: C.pink });
        const qs = [1, 5, 10, 25];
        let qx = w - 20 - qs.length * 70;
        g.text('qty', qx - 36, y + 20, { size: 15, color: C.dim });
        for (const q of qs) {
          if (g.button('vq' + q, qx, y, 64, 30, String(q), { kind: S.qty === q ? 'gold' : undefined })) S.qty = q;
          qx += 70;
        }
        y += 40;
        // table header
        const cols = M ? [16, 214, 318, 422, 494] : [20, 280, 420, 560, 700];
        const bw = M ? 136 : 130;
        g.rect(14, y, w - 28, 30, '#1a1218');
        ['PRODUCT', 'SUPPLIER', 'STREET', 'STASH', ''].forEach((t, i) => g.text(t, cols[i], y + 21, { size: 14, bold: true, color: C.dim }));
        y += 34;
        const disc = G.flags.idDiscount ? 0.8 : 1;
        GOODS.forEach((gd, i) => {
          const ry = y + i * 52;
          g.rect(14, ry, w - 28, 48, i % 2 ? '#120d11' : '#150f14');
          g.text(gd.name, cols[0], ry + 30, { size: M ? 16 : 18, bold: true, max: cols[1] - cols[0] - 10 });
          g.text(money(S.buy[gd.id] * disc, 0), cols[1], ry + 30, { size: 18, color: S.buy[gd.id] < gd.base * 0.6 ? C.amber : C.text });
          const hot = S.sell[gd.id] > gd.base * gd.spread * 1.6;
          g.text(money(S.sell[gd.id], 0) + (hot ? ' 🔥' : ''), cols[2], ry + 30, { size: 18, bold: hot, color: hot ? C.green : S.sell[gd.id] < gd.base * gd.spread * 0.6 ? C.red : C.text });
          const inTransit = S.ship.filter((s) => s.id === gd.id).reduce((a, s) => a + s.n, 0);
          g.text(`${S.inv[gd.id]}${inTransit ? ` (+${inTransit} 📦)` : ''}`, cols[3], ry + 30, { size: 18 });
          if (g.button('vb' + gd.id, cols[4], ry + 7, bw, 34, `BUY ${S.qty}`, { kind: 'primary', size: 15 })) buy(gd, S.qty);
          if (g.button('vs' + gd.id, cols[4] + bw + 10, ry + 7, bw, 34, `SELL ${Math.min(S.qty, S.inv[gd.id])}`, { kind: 'gold', size: 15, disabled: !S.inv[gd.id] })) sell(gd, S.qty);
        });
        y += GOODS.length * 52 + 12;
        // shipments + events
        const half = (w - 40) / 2;
        g.rect(20, y, half - 10, h - y - 14, '#0b0809');
        g.text('IN TRANSIT', 34, y + 26, { size: 14, bold: true, color: C.dim });
        S.ship.slice(0, 4).forEach((s, i) => {
          const gd = GOODS.find((x) => x.id === s.id);
          g.text(`📦 ${s.n}× ${gd.name}`, 34, y + 54 + i * 28, { size: 15 });
          g.progress(260, y + 42 + i * 28, half - 270, 10, s.t / s.dur, C.pink);
        });
        if (!S.ship.length) g.text('nothing on the way. postal service thanks you.', 34, y + 54, { size: 14, color: C.faint });
        g.rect(20 + half + 10, y, half - 10, h - y - 14, '#0b0809');
        g.text('MARKET NEWS', 34 + half + 10, y + 26, { size: 14, bold: true, color: C.dim });
        [...S.events.slice(0, 2), ...S.log.slice(0, 3)].forEach((e, i) => g.text(e.text, 34 + half + 10, y + 54 + i * 24, { size: 14, color: e.c, max: half - 40 }));
        g.text('every sale is noise. some buyers are cops.', w - 30, h - 24, { size: 13, color: C.faint, align: 'right' });
    }
  },
};
