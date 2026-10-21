import { C, FONT, HEAD, TYPE, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, GOAL, emit, milesAway, etaSeconds, heatRate } from '../../game/state.js';

// ── BURNER: text messages. The blackmailer lives here. So does the SEND button.
export const Burner = {
  title: 'Burner — messages',
  label: 'Messages',
  icon: 'burner',
  w: 860,
  h: 620,
  create(os) {
    const threads = {
      ghost: { name: 'UNKNOWN', sub: 'wallet bc1q-gh0st-w1r3', msgs: [], unread: 0, color: C.red },
      mom: { name: 'Mom', sub: 'mobile', msgs: [], unread: 0, color: C.text },
      bank: { name: 'BANK ALERTS', sub: 'short code 72-265', msgs: [], unread: 0, color: C.blue },
      doc: { name: 'Doc', sub: 'do not save this number', msgs: [], unread: 0, color: C.pink },
    };
    let cur = 'ghost';
    const S = { threads };
    const api = {
      get badge() {
        return Object.values(threads).reduce((a, t) => a + t.unread, 0);
      },
      // add a message. from: 'them' | 'me'
      push(thread, text, o = {}) {
        const t = threads[thread];
        t.msgs.push({ text, me: !!o.me, link: o.link, t: Date.now() });
        if (!o.me && !(os.isOpen('burner') && cur === thread)) t.unread++;
        if (!o.me && !o.quiet) {
          os.notify(t.name, text, { app: 'burner', color: t.color, creepy: thread === 'ghost', icon: 'burner' });
        }
      },
      open(thread) {
        cur = thread;
        threads[thread].unread = 0;
      },
      onOpen() {
        threads[cur].unread = 0;
      },
      draw(g, w, h) {
        const lw = 250;
        g.rect(0, 0, lw, h, '#0d1112');
        Object.entries(threads).forEach(([id, t], i) => {
          const y = i * 72;
          const on = id === cur;
          if (g.hit('th' + id, 0, y, lw, 70)) {
            cur = id;
            t.unread = 0;
          }
          g.rect(0, y, lw, 70, on ? '#1a2224' : g.over(0, y, lw, 70) ? '#141a1b' : '#0d1112');
          g.circle(34, y + 35, 20, id === 'ghost' ? '#2a0e0e' : '#1d2528');
          g.text(id === 'ghost' ? '?' : t.name[0], 34, y + 36, { align: 'center', base: 'middle', size: 18, bold: true, color: t.color });
          g.text(t.name, 66, y + 30, { size: 17, bold: true, color: t.color });
          const last = t.msgs.at(-1);
          g.text(last ? last.text : t.sub, 66, y + 52, { size: 13, color: C.dim, max: lw - 90 });
          if (t.unread) {
            g.circle(lw - 22, y + 35, 11, C.red);
            g.text(String(t.unread), lw - 22, y + 36, { align: 'center', base: 'middle', size: 13, bold: true, color: '#fff' });
          }
        });

        const t = threads[cur];
        t.unread = 0;
        const cx = lw, cw = w - lw;
        g.rect(cx, 0, cw, 56, '#121718');
        g.text(t.name, cx + 20, 34, { size: 20, bold: true, color: t.color });
        g.text(t.sub, cx + cw - 20, 34, { size: 14, color: C.dim, align: 'right' });

        // the payment panel
        let top = 56;
        if (cur === 'ghost') {
          const ready = G.money >= GOAL;
          g.rect(cx, 56, cw, 92, ready ? '#163a24' : '#141010');
          g.text(`${money(G.money)} / ${money(GOAL)}`, cx + 20, 92, { size: 24, bold: true, color: ready ? C.green : C.text });
          g.progress(cx + 20, 106, cw - 300, 14, G.money / GOAL, ready ? C.green : C.red);
          if (g.button('pay', cx + cw - 260, 72, 240, 60, ready ? 'SEND $1,000,000' : 'NOT ENOUGH', { kind: ready ? 'primary' : undefined, disabled: !ready, size: 20 })) {
            emit('pay');
          }
          top = 148;
        }
        // bubbles
        const bw = cw - 140;
        let total = 16;
        const hs = t.msgs.map((m) => {
          const hh = g.para(m.text, 0, 0, bw - 28, { size: 16, measure: true }) + 22 + (m.link ? 44 : 0);
          total += hh + 12;
          return hh;
        });
        const s = g.scrollArea('chat' + cur, cx, top, cw, h - top, total, (aw) => {
          let y = 12;
          t.msgs.forEach((m, i) => {
            const hh = hs[i];
            const tw = Math.min(bw, g.measure(m.text, 16) + 30);
            const x = m.me ? aw - tw - 16 : 16;
            g.rrect(x, y, tw, hh, 12, m.me ? '#1d3a5a' : cur === 'ghost' ? '#2a1414' : '#1e2629');
            g.para(m.text, x + 14, y + 24, tw - 28, { size: 16, color: m.me ? '#e6f1ff' : C.text });
            if (m.link) {
              const used = m.link.used;
              if (g.button('lnk' + i, x + 14, y + hh - 40, tw - 28, 30, used ? 'link expired' : m.link.label, { size: 14, kind: used ? undefined : 'primary', disabled: used })) {
                m.link.used = true;
                m.link.fn();
              }
            }
            y += hh + 12;
          });
        });
        s.stick = true;
        if (!t.msgs.length) g.text('no messages', cx + cw / 2, top + 60, { align: 'center', size: 16, color: C.faint });
      },
    };
    return api;
  },
};

// ── SCANNER: police radio
export const Scanner = {
  title: 'SCANNER — 460.125 MHz',
  label: 'Scanner',
  icon: 'scanner',
  w: 820,
  h: 600,
  create(os) {
    return {
      draw(g, w, h) {
        g.rect(0, 0, w, h, '#0a0c0d');
        // road map: car → house
        const mx = 30, my = 30, mw = w - 60, mh = 130;
        g.rect(mx, my, mw, mh, '#0d1214');
        g.stroke(mx, my, mw, mh, C.border);
        g.line(mx + 40, my + mh / 2, mx + mw - 70, my + mh / 2, '#2a3236', 6);
        g.ctx.setLineDash([16, 14]);
        g.line(mx + 40, my + mh / 2, mx + mw - 70, my + mh / 2, '#5a6468', 2);
        g.ctx.setLineDash([]);
        const p = G.heat / 100;
        const carX = mx + 40 + p * (mw - 140);
        const blink = Math.floor(g.t * 4) % 2;
        g.rect(carX - 22, my + mh / 2 - 12, 44, 22, '#ddd');
        g.rect(carX - 10, my + mh / 2 - 20, 20, 9, blink ? C.red : C.blue);
        g.text('🏠', mx + mw - 40, my + mh / 2 + 2, { align: 'center', base: 'middle', size: 40, font: 'Arial' });
        g.text('you', mx + mw - 40, my + mh - 10, { align: 'center', size: 14, color: C.dim });
        g.text(`${milesAway().toFixed(2)} miles`, mx + 16, my + 26, { size: 20, bold: true, color: G.heat > 75 ? C.red : C.amber });
        if (G.flags.scannerKey) {
          const eta = etaSeconds();
          g.text(`ETA ${Math.floor(eta / 60)}:${String(Math.floor(eta % 60)).padStart(2, '0')}`, mx + mw - 16, my + 26, { size: 20, bold: true, align: 'right', color: C.red });
        } else g.text('ETA: encrypted (DataMart sells the key)', mx + mw - 16, my + 26, { size: 14, align: 'right', color: C.faint });

        // radio log
        const ly = my + mh + 20;
        g.text('DISPATCH LOG', 30, ly + 18, { size: 14, bold: true, color: C.dim });
        const entries = G.scanner.slice().reverse();
        let total = entries.length * 30 + 10;
        g.scrollArea('scanlog', 30, ly + 30, w - 60, h - ly - 110, total, (aw) => {
          entries.forEach((e, i) => {
            const m = Math.floor(e.t / 60), s = Math.floor(e.t % 60);
            g.text(`[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`, 0, 22 + i * 30, { size: 15, color: C.faint });
            g.text(e.text, 80, 22 + i * 30, { size: 15, color: e.kind === 'good' ? C.green : e.kind === 'bad' ? C.amber : C.text, max: aw - 90 });
          });
        });
        if (!entries.length) g.text('...static...', w / 2, ly + 80, { align: 'center', size: 16, color: C.faint });

        if (g.button('surrender', 30, h - 66, w - 60, 46, 'TURN YOURSELF IN', { kind: 'danger' })) {
          os.modal({
            title: 'Turn yourself in?',
            danger: true,
            body: 'Walk upstairs. Open the door. Put your hands up. Tell them about the call.\n\nThey might believe you.',
            buttons: [{ label: 'not yet' }, { label: 'open the door', kind: 'danger', fn: () => emit('surrender') }],
          });
        }
      },
    };
  },
};
