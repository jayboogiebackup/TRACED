import { C, FONT, HEAD, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, addMoney, spend } from '../../game/state.js';

const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// tickers: drift (per tick), vol (per tick)
const TICKERS = [
  { sym: 'DOGG', name: 'Doggcoin', price: 0.42, drift: 0.0004, vol: 0.035, color: '#ffc857' },
  { sym: 'NVDUH', name: 'Nvduh Corp', price: 118, drift: 0.0004, vol: 0.012, color: '#5cf08a' },
  { sym: 'COPS', name: 'CellBlock Inc. (private prisons)', price: 41, drift: 0.0, vol: 0.009, color: '#6ab7ff' },
  { sym: 'GOLD', name: 'Shiny Rock ETF', price: 230, drift: 0.0002, vol: 0.004, color: '#dfe6df' },
];

const NEWS = [
  { sym: 'DOGG', k: 0.45, text: 'Billionaire posts picture of his dog. $DOGG explodes.' },
  { sym: 'DOGG', k: -0.4, text: 'Doggcoin founder "just wants to go outside". $DOGG collapses.' },
  { sym: 'NVDUH', k: 0.22, text: 'Nvduh beats earnings: "everyone is mining in their basement".' },
  { sym: 'NVDUH', k: -0.18, text: 'Nvduh recalls GPUs after "a few small fires".' },
  { sym: 'GOLD', k: 0.08, text: 'Markets panic. People buy shiny rocks.' },
  { sym: 'COPS', k: 0.15, text: 'CellBlock Inc. wins new contract. "Business is booming."' },
  { sym: 'COPS', k: -0.12, text: 'Prison reform bill advances. $COPS dips.' },
];

export const Stonks = {
  title: 'ST0NKS — trade like nobody\'s watching',
  label: 'St0nks',
  icon: 'stonks',
  w: 1000,
  h: 660,
  create(os) {
    const T = TICKERS.map((t) => ({ ...t, hist: Array.from({ length: 160 }, () => t.price), held: 0, cost: 0, pendingNews: null }));
    const S = { sel: 0, qty: 10, tickT: 0, newsT: 25, tape: [], tip: null };
    G.stonks = S;
    T.forEach((t) => {
      // pre-roll some history so the charts aren't flat
      for (let i = 0; i < 160; i++) step(t, true);
    });

    function step(t, quiet) {
      let d = t.drift + t.vol * gauss();
      if (t.sym === 'COPS') d += (G.heat / 100) * 0.0009; // it rises as they get closer
      t.price = Math.max(0.01, t.price * (1 + d));
      t.hist.push(t.price);
      if (t.hist.length > 160) t.hist.shift();
    }

    function fireNews(n) {
      const t = T.find((x) => x.sym === n.sym);
      t.price *= 1 + n.k;
      t.hist.push(t.price);
      S.tape.unshift({ text: n.text, k: n.k });
      if (S.tape.length > 6) S.tape.pop();
      if (t.held) os.notify(`$${n.sym} ${n.k > 0 ? '▲' : '▼'} ${Math.round(Math.abs(n.k) * 100)}%`, n.text, { app: 'stonks', color: n.k > 0 ? C.green : C.red });
    }

    const api = {
      // DATAMART sells this
      buyTip() {
        const n = NEWS[(Math.random() * NEWS.length) | 0];
        S.tip = { ...n, at: 20 + Math.random() * 10 };
        S.newsT = S.tip.at;
        return S.tip;
      },
      tick(dt) {
        S.tickT += dt;
        while (S.tickT > 0.5) {
          S.tickT -= 0.5;
          T.forEach((t) => step(t));
        }
        S.newsT -= dt;
        if (S.newsT <= 0) {
          if (S.tip) {
            fireNews(S.tip);
            S.tip = null;
          } else fireNews(NEWS[(Math.random() * NEWS.length) | 0]);
          S.newsT = 35 + Math.random() * 35;
        }
      },
      draw(g, w, h) {
        const t = T[S.sel];
        // left: ticker list
        const lw = 270;
        g.rect(0, 0, lw, h, '#0c1011');
        g.text('ST0NKS', 18, 42, { size: 40, font: HEAD, color: C.green });
        let pv = 0;
        T.forEach((x, i) => {
          const y = 64 + i * 78;
          const ch = x.price / x.hist[x.hist.length - 21] - 1;
          const on = i === S.sel;
          if (g.hit('tk' + i, 8, y, lw - 16, 70)) S.sel = i;
          g.rect(8, y, lw - 16, 70, on ? '#17201f' : g.over(8, y, lw - 16, 70) ? '#131a1a' : '#0f1414');
          if (on) g.rect(8, y, 4, 70, x.color);
          g.text('$' + x.sym, 22, y + 28, { size: 20, bold: true, color: x.color });
          g.text(price(x.price), lw - 22, y + 28, { size: 18, bold: true, align: 'right' });
          g.text(`${ch >= 0 ? '▲' : '▼'} ${(ch * 100).toFixed(1)}%`, lw - 22, y + 54, { size: 15, align: 'right', color: ch >= 0 ? C.green : C.red });
          if (x.held) g.text(`held ${short(x.held)}`, 22, y + 54, { size: 14, color: C.dim });
          pv += x.held * x.price;
        });
        // $RUG mirror
        const rug = G.chirp && G.chirp.coin.launched ? G.chirp.coin : null;
        if (rug) {
          const y = 64 + T.length * 78;
          g.rect(8, y, lw - 16, 56, '#140f1a');
          g.text('$RUG', 22, y + 24, { size: 20, bold: true, color: C.purple });
          g.text(rug.pulled ? 'rugged' : '$' + rug.price.toFixed(5), lw - 22, y + 24, { size: 16, bold: true, align: 'right', color: rug.pulled ? C.red : C.text });
          g.text('trade it on Chirp', 22, y + 46, { size: 13, color: C.dim });
        }
        g.text('PORTFOLIO', 18, h - 48, { size: 15, bold: true, color: C.dim });
        g.text(money(pv), 18, h - 20, { size: 22, bold: true, color: C.text });

        // right: chart
        const cx = lw + 20, cw = w - lw - 40;
        g.text(t.name, cx, 36, { size: 22, bold: true });
        g.text(price(t.price), cx + cw, 38, { size: 30, font: HEAD, align: 'right', color: t.color });
        const gy = 56, gh = h - 330;
        g.rect(cx, gy, cw, gh, '#070a0b');
        g.stroke(cx, gy, cw, gh, C.border);
        const mx = Math.max(...t.hist), mn = Math.min(...t.hist);
        for (let i = 1; i < 4; i++) {
          const yy = gy + (gh * i) / 4;
          g.line(cx, yy, cx + cw, yy, '#10171a');
          g.text(price(mx - ((mx - mn) * i) / 4), cx + cw - 6, yy - 4, { size: 12, align: 'right', color: C.faint });
        }
        const ctx = g.ctx;
        const up = t.price >= t.hist[0];
        const grd = ctx.createLinearGradient(0, gy, 0, gy + gh);
        grd.addColorStop(0, up ? 'rgba(92,240,138,0.25)' : 'rgba(255,92,92,0.25)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        t.hist.forEach((p, i) => {
          const xx = cx + (i / (t.hist.length - 1)) * cw;
          const yy = gy + gh - 8 - ((p - mn) / Math.max(1e-9, mx - mn)) * (gh - 16);
          i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        });
        ctx.strokeStyle = up ? C.green : C.red;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.lineTo(cx + cw, gy + gh);
        ctx.lineTo(cx, gy + gh);
        ctx.fillStyle = grd;
        ctx.fill();
        if (t.held) {
          const avg = t.cost / t.held;
          const yy = gy + gh - 8 - ((avg - mn) / Math.max(1e-9, mx - mn)) * (gh - 16);
          if (yy > gy && yy < gy + gh) {
            ctx.setLineDash([6, 6]);
            g.line(cx, yy, cx + cw, yy, C.amber, 1.5);
            ctx.setLineDash([]);
            g.text(`your avg ${price(avg)}`, cx + 8, yy - 6, { size: 13, color: C.amber });
          }
        }

        // trade panel
        let y = gy + gh + 22;
        const pnl = t.held * t.price - t.cost;
        g.text(`You own ${short(t.held)} $${t.sym}  =  ${money(t.held * t.price)}`, cx, y + 4, { size: 18, bold: true });
        if (t.held) g.text(`P/L ${pnl >= 0 ? '+' : ''}${money(pnl)}`, cx + cw, y + 4, { size: 18, bold: true, align: 'right', color: pnl >= 0 ? C.green : C.red });
        y += 22;
        const qs = [1, 10, 100, 1000, 10000];
        let bx = cx;
        for (const q of qs) {
          if (g.button('q' + q, bx, y, 74, 34, short(q), { kind: S.qty === q ? 'gold' : undefined })) S.qty = q;
          bx += 80;
        }
        if (g.button('qmax', bx, y, 90, 34, 'MAX', { kind: S.qty === 'max' ? 'gold' : undefined })) S.qty = 'max';
        y += 46;
        const qBuy = S.qty === 'max' ? Math.floor(G.money / t.price) : S.qty;
        const qSell = S.qty === 'max' ? t.held : Math.min(S.qty, t.held);
        if (g.button('buy', cx, y, (cw - 12) / 2, 50, `BUY ${short(qBuy)}  (${money(qBuy * t.price)})`, { kind: 'primary', disabled: qBuy <= 0 })) {
          const c = qBuy * t.price;
          if (spend(c)) {
            t.held += qBuy;
            t.cost += c;
            audio.blip(900, 0.06, 0.08);
          } else audio.error();
        }
        if (g.button('sell', cx + (cw + 12) / 2, y, (cw - 12) / 2, 50, `SELL ${short(qSell)}  (${money(qSell * t.price)})`, { kind: 'danger', disabled: qSell <= 0 })) {
          const frac = qSell / t.held;
          addMoney(qSell * t.price, 'stonks');
          t.cost -= t.cost * frac;
          t.held -= qSell;
          audio.cash();
        }
        y += 66;
        // news tape
        g.rect(cx, y, cw, h - y - 12, '#0a0d0e');
        g.text('NEWS', cx + 12, y + 24, { size: 14, bold: true, color: C.dim });
        if (S.tip) g.text(`INSIDER TIP: $${S.tip.sym} ${S.tip.k > 0 ? 'UP' : 'DOWN'} ~${Math.round(Math.abs(S.tip.k) * 100)}% in ${Math.ceil(S.newsT)}s`, cx + cw - 12, y + 24, { size: 15, bold: true, align: 'right', color: C.amber });
        S.tape.slice(0, 3).forEach((n, i) => g.text(`${n.k > 0 ? '▲' : '▼'} ${n.text}`, cx + 12, y + 50 + i * 22, { size: 14, color: i ? C.dim : n.k > 0 ? C.green : C.red, max: cw - 24 }));
      },
    };
    return api;
  },
};

function price(p) {
  return p < 10 ? '$' + p.toFixed(3) : '$' + p.toFixed(2);
}
