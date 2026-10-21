import { C, FONT, HEAD, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, HARDWARE, COOLING, OPSEC, MISC, mining, clickValue, addMoney, spend, costOf, emit, powerDraw, heatMultiplier, heatRate, addHeat } from '../../game/state.js';
import { info } from '../../game/userinfo.js';

const hex = () => Array.from({ length: 16 }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');

// ───────────────────────── BITMINER ─────────────────────────
export const Miner = {
  title: 'BITMINER 0.3',
  label: 'Bitminer',
  icon: 'miner',
  w: 860,
  h: 590,
  create(os) {
    const log = [];
    const floats = [];
    let blockT = 0, nextBlock = 35 + Math.random() * 20;
    let press = 0;
    const self = {
      tick(dt) {
        if (!G.running) return;
        const m = mining();
        blockT += dt;
        if (blockT > nextBlock && m.raw > 1) {
          blockT = 0;
          nextBlock = 30 + Math.random() * 30;
          const bonus = Math.round(m.rate * 22 + 40);
          addMoney(bonus, 'block');
          log.push({ s: `BLOCK FOUND  +${money(bonus)}`, c: C.amber });
          os.notify('Block found!', `+${money(bonus)} mining reward`, { app: 'miner', color: C.amber });
          audio.cash();
        }
        if (Math.random() < dt * Math.min(12, 1 + m.raw / 20)) {
          log.push({ s: `${hex()}${hex()}  ${(m.rate * 0.37).toFixed(2)} TH/s`, c: '#3f7a52' });
        }
        if (log.length > 40) log.splice(0, log.length - 40);
      },
      draw(g, w, h, dt) {
        const m = mining();
        // ── MINE button
        const bx = 24, by = 24, bw = 300, bh = 300;
        const over = g.over(bx, by, bw, bh);
        if (g.hit('mine', bx, by, bw, bh, { onPress: true })) {
          const v = clickValue();
          addMoney(v, 'click');
          G.stats.clicks++;
          press = 1;
          audio.coin();
          floats.push({ x: bx + bw / 2 + (Math.random() - 0.5) * 120, y: by + bh / 2, t: 0, s: '+' + money(v, v < 100 ? 2 : 0) });
          log.push({ s: `${hex()}${hex()}  share accepted`, c: C.green });
        }
        press = Math.max(0, press - dt * 6);
        const r = 130 - press * 8;
        g.circle(bx + bw / 2, by + bh / 2, r + 12, '#0b0f0f', over ? C.amber : C.border, 3);
        g.circle(bx + bw / 2, by + bh / 2, r, over ? '#2b2414' : '#1c1a12', '#6b5a2a', 2);
        g.text('₿', bx + bw / 2, by + bh / 2 + 12, { align: 'center', base: 'middle', size: 150, bold: true, font: 'Arial', color: over ? '#ffd56e' : C.amber });
        g.text('CLICK TO MINE', bx + bw / 2, by + bh + 36, { align: 'center', size: 22, font: HEAD, color: C.dim });
        g.text(`+${money(clickValue(), 2)} / click`, bx + bw / 2, by + bh + 60, { align: 'center', size: 16, color: C.faint });
        if (G.elapsed < G.clickBoostUntil) g.text('⚡ VOLT BOOST', bx + bw / 2, by + bh + 82, { align: 'center', size: 16, bold: true, color: C.green });
        for (let i = floats.length - 1; i >= 0; i--) {
          const f = floats[i];
          f.t += dt;
          f.y -= dt * 90;
          g.ctx.globalAlpha = Math.max(0, 1 - f.t);
          g.text(f.s, f.x, f.y, { align: 'center', size: 24, bold: true, color: C.green });
          g.ctx.globalAlpha = 1;
          if (f.t > 1) floats.splice(i, 1);
        }

        // ── stats
        const sx = 360;
        let y = 40;
        const row = (k, v, col = C.text) => {
          g.text(k, sx, y, { size: 16, color: C.dim });
          g.text(v, w - 24, y, { size: 20, bold: true, align: 'right', color: col });
          y += 32;
        };
        row('Hashrate', `${(m.rate * 0.37).toFixed(2)} TH/s`);
        row('Income', `${money(m.rate, m.rate < 100 ? 2 : 0)} / sec`, C.green);
        row('Power draw', `${powerDraw().toFixed(1)} kW`, powerDraw() > 15 ? C.red : C.text);
        const tc = m.temp > 82 ? C.red : m.temp > 70 ? C.amber : C.green;
        row('Temperature', `${Math.round(m.temp)} °C`, tc);
        g.progress(sx, y - 18, w - 24 - sx, 10, (m.temp - 20) / 100, tc);
        y += 8;
        row('Efficiency', `${Math.round(m.eff * 100)}%`, m.eff < 1 ? C.red : C.text);
        if (m.eff < 1) {
          g.text('THERMAL THROTTLING — buy cooling at RIGMART', sx, y, { size: 15, bold: true, color: Math.floor(g.t * 3) % 2 ? C.red : C.amber });
          y += 26;
        }
        g.text('Next block', sx, y, { size: 16, color: C.dim });
        g.progress(sx + 110, y - 12, w - 24 - sx - 110, 10, blockT / nextBlock, C.amber);
        y += 30;

        // ── owned hardware
        g.text('HARDWARE', sx, y + 6, { size: 22, font: HEAD, color: C.dim });
        y += 16;
        let any = false;
        for (const it of [...HARDWARE, ...COOLING]) {
          const n = G.owned[it.id] || 0;
          if (!n) continue;
          any = true;
          y += 22;
          g.text(`${n}×  ${it.name}`, sx + 4, y, { size: 15, color: C.text, max: w - sx - 40 });
        }
        if (!any) g.text('just a laptop. for now.', sx + 4, y + 22, { size: 15, color: C.faint });

        // ── log
        const ly = h - 150;
        g.rect(0, ly, w, 150, '#060808');
        g.line(0, ly, w, ly, C.border);
        const shown = log.slice(-6);
        shown.forEach((l, i) => g.text(l.s, 18, ly + 26 + i * 21, { size: 15, color: l.c, font: FONT }));
        if (g.button('openshop', w - 230, ly + 96, 206, 40, 'RIGMART →', { kind: 'gold' })) os.open('rigmart');
      },
    };
    return self;
  },
};

// ───────────────────────── RIGMART ─────────────────────────
function shopList(g, os, items, w, h, o) {
  const rowH = 86;
  g.scrollArea(o.id, 0, 0, w, h, items.length * rowH + 16, (cw) => {
    items.forEach((it, i) => {
      const y = 8 + i * rowH;
      const n = o.count(it);
      const cost = costOf(it);
      const maxed = (it.once && n > 0) || (it.max && n >= it.max);
      const afford = G.money >= cost;
      g.rect(10, y, cw - 20, rowH - 8, i % 2 ? '#131819' : '#151b1c');
      g.text(it.name, 26, y + 28, { size: 19, bold: true, color: maxed ? C.dim : C.text, max: cw - 330 });
      g.para(it.desc, 26, y + 52, cw - 330, { size: 14, color: C.dim });
      const extra = o.extra ? o.extra(it) : '';
      if (extra) g.text(extra, cw - 284, y + 30, { size: 15, bold: true, color: C.green, align: 'right' });
      if (n && !it.once) g.text(`owned ${n}${it.max ? '/' + it.max : ''}`, cw - 284, y + 54, { size: 14, color: C.dim, align: 'right' });
      const label = maxed ? (it.once ? 'OWNED' : 'MAXED') : money(cost);
      if (g.button(o.id + it.id, cw - 260, y + 18, 230, 44, label, { kind: maxed ? undefined : afford ? 'primary' : undefined, disabled: maxed, color: !maxed && !afford ? C.red : undefined })) {
        if (!afford) {
          audio.error();
        } else if (spend(cost)) {
          o.buy(it);
        }
      }
    });
  });
}

export const RigMart = {
  title: 'RIGMART — no questions asked',
  label: 'RigMart',
  icon: 'rigmart',
  w: 900,
  h: 620,
  create(os) {
    let tab = 0;
    return {
      draw(g, w, h) {
        g.rect(0, 0, w, 64, '#0f1416');
        g.text('RIGMART', 20, 44, { size: 44, font: HEAD, color: C.blue });
        g.text('cash only · no receipts · no refunds', 190, 42, { size: 15, color: C.dim });
        g.text(money(G.money), w - 20, 42, { size: 22, bold: true, align: 'right', color: C.green });
        tab = g.tabs('rmtabs', 14, 72, ['MINING', 'COOLING', 'MISC'], tab, { accent: C.blue });
        g.push(0, 112);
        const list = tab === 0 ? HARDWARE : tab === 1 ? COOLING : MISC;
        shopList(g, os, list, w, h - 112, {
          id: 'rm' + tab,
          count: (it) => G.owned[it.id] || 0,
          extra: (it) => (it.rate ? `+${money(it.rate, it.rate < 10 ? 1 : 0)}/s` : it.cool ? `+${it.cool} cooling` : ''),
          buy: (it) => {
            G.owned[it.id] = (G.owned[it.id] || 0) + 1;
            audio.cash();
            emit('buy', it);
          },
        });
        g.pop();
      },
    };
  },
};

// ───────────────────────── SAFE//NET ─────────────────────────
export const SafeNet = {
  title: 'SAFE//NET — privacy tools',
  label: 'SafeNet',
  icon: 'safenet',
  w: 920,
  h: 640,
  create(os) {
    let tab = 0;
    return {
      draw(g, w, h) {
        g.rect(0, 0, w, 64, '#0d1512');
        g.text('SAFE//NET', 20, 44, { size: 44, font: HEAD, color: C.green });
        g.text('the only honest store on the dark web', 210, 42, { size: 15, color: C.dim });
        g.text(money(G.money), w - 20, 42, { size: 22, bold: true, align: 'right', color: C.green });
        tab = g.tabs('sntabs', 14, 72, ['OPSEC', 'WHAT THIS SITE KNOWS ABOUT YOU'], tab);
        g.push(0, 112);
        if (tab === 0) {
          const ch = h - 112;
          g.rect(0, 0, w, 50, '#0a100d');
          const eta = (100 - G.heat) / heatRate();
          g.text(`Police speed: ${Math.round(heatMultiplier() * 100)}%`, 20, 32, { size: 17, bold: true, color: heatMultiplier() < 1 ? C.green : C.amber });
          g.text(`Arrival in ~${Math.floor(eta / 60)}m ${String(Math.floor(eta % 60)).padStart(2, '0')}s at this rate`, w - 20, 32, { size: 17, align: 'right', color: C.dim });
          g.push(0, 50);
          shopList(g, os, OPSEC, w, ch - 50, {
            id: 'sn',
            count: (it) => (it.once ? (G.ownedOpsec[it.id] ? 1 : 0) : G.owned[it.id] || 0),
            extra: (it) => (it.mult ? `-${Math.round((1 - it.mult) * 100)}% speed` : it.heatDrop ? `push back ${it.heatDrop}%` : ''),
            buy: (it) => {
              if (it.once) G.ownedOpsec[it.id] = 1;
              else G.owned[it.id] = (G.owned[it.id] || 0) + 1;
              if (it.heatDrop) addHeat(-it.heatDrop, it.id === 'bribe' ? 'Dispatch: "...we seem to have lost the file. Stand by."' : 'Trace lost. Units re-routing.');
              audio.cash();
              emit('buy', it);
            },
          });
          g.pop();
        } else {
          // the honest part
          const lines = [
            ['Operating system', info.os],
            ['Browser', info.browser],
            ['Local time', new Date().toLocaleTimeString()],
            ['Time zone', info.tz || 'unknown'],
            ['Language', info.lang],
            ['Screen', info.screen],
            ['CPU threads', info.cores || '?'],
            ['Memory', info.memory ? `${info.memory} GB+` : 'hidden'],
            ['Graphics card', info.gpu || 'hidden'],
            ['Battery', info.battery != null ? `${info.battery}% ${info.charging ? '(charging)' : '(on battery)'}` : 'hidden'],
            ['Dark mode', info.dark ? 'yes' : 'no'],
            ['Touchscreen', info.touch ? 'yes' : 'no'],
            ['Do Not Track', info.dnt ? 'on (most sites ignore it)' : 'off'],
          ];
          g.para('This is not part of the game. This is your real device, read by this web page the moment you opened it — no permission prompt, no pop-up. It never left your computer. Most sites aren\'t that polite.', 24, 34, w - 48, { size: 16, color: C.amber });
          let y = 120;
          for (const [k, v] of lines) {
            g.text(k, 40, y, { size: 17, color: C.dim });
            g.text(String(v), 330, y, { size: 18, bold: true, max: w - 360 });
            y += 30;
          }
          g.para('Add your IP address and every site you visit can sketch you in under a second. A VPN hides the IP. Saying no to "Sign in with Google", face scans and ID uploads hides the rest.', 24, y + 20, w - 48, { size: 16, color: C.green });
        }
        g.pop();
      },
    };
  },
};
