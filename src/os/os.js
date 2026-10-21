import { GUI, C, FONT, HEAD, TYPE, money, short } from './gui.js';
import { audio } from '../core/audio.js';
import { G, GOAL, milesAway, etaSeconds, emit, secret } from '../game/state.js';
import { drawIcon } from './icons.js';

// GH0ST//OS — the desktop running on the laptop in the basement.

const TASK_H = 48;
const TITLE_H = 34;

export class OS {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = new GUI(canvas);
    this.W = canvas.width;
    this.H = canvas.height;
    this.apps = {};
    this.order = [];
    this.windows = [];
    this.notes = [];
    this.modalQ = [];
    this.overlay = null;
    this.startOpen = false;
    this.booted = false;
    this.bootT = 0;
    this.t = 0;
    this.glitch = 0;
    this.konami = [];
    this.dragging = null;
    this.locked = false;
  }

  register(id, def) {
    this.apps[id] = { id, def, inst: null };
    this.order.push(id);
  }
  app(id) {
    const a = this.apps[id];
    if (!a.inst) a.inst = a.def.create(this);
    return a.inst;
  }
  isOpen(id) {
    return this.windows.some((w) => w.id === id);
  }

  open(id, o = {}) {
    const a = this.apps[id];
    if (!a) return;
    const inst = this.app(id);
    let win = this.windows.find((w) => w.id === id);
    if (win) {
      win.min = false;
      this.focus(win);
    } else {
      const w = Math.min(inst.w || a.def.w || 760, this.W - 40);
      const h = Math.min(inst.h || a.def.h || 560, this.H - TASK_H - 30);
      const n = this.windows.length;
      const x = o.x ?? Math.round(Math.min(this.W - w - 20, 300 + ((n * 36) % 220)));
      const y = o.y ?? Math.round(Math.min(this.H - TASK_H - h - 10, 24 + ((n * 30) % 160)));
      win = { id, x, y, w, h, min: false, born: this.t };
      this.windows.push(win);
      if (!o.silent) audio.open();
      inst.onOpen && inst.onOpen();
      emit('appopen', id);
    }
    this.startOpen = false;
    return win;
  }
  close(win) {
    this.windows = this.windows.filter((w) => w !== win);
    const inst = this.apps[win.id].inst;
    inst && inst.onClose && inst.onClose();
    audio.close();
  }
  focus(win) {
    this.windows = this.windows.filter((w) => w !== win);
    this.windows.push(win);
  }

  notify(title, body = '', o = {}) {
    this.notes.push({ title, body, app: o.app, color: o.color || C.green, t: 0, life: o.life || 6, icon: o.icon || o.app });
    if (this.notes.length > 4) this.notes.shift();
    if (!o.silent) (o.creepy ? audio.creepyNotify() : audio.notify());
  }

  // in-OS modal dialog; buttons: [{label, kind, fn}]
  modal(m) {
    this.modalQ.push(m);
  }

  // ── input from the 3D scene
  pointer(x, y) {
    this.g.move(x, y);
  }
  press() {
    this.g.press();
  }
  release() {
    this.g.release();
  }
  wheel(d) {
    this.g.scroll(d);
  }
  key(e) {
    this.g.key(e);
    // konami
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.konami.push(k);
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    this.konami = this.konami.slice(-10);
    if (this.konami.join() === code.join()) {
      this.konami = [];
      emit('konami');
    }
  }

  // ── frame
  draw(dt) {
    this.t += dt;
    const g = this.g;
    const ctx = g.ctx;
    g.begin(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (!this.booted) {
      this.drawBoot(dt);
      g.end();
      return;
    }

    // who gets the mouse?
    const modal = this.modalQ[0];
    let owner = null;
    if (!modal && !this.overlay && !this.locked) {
      if (g.my >= this.H - TASK_H || (this.startOpen && this.overStart())) owner = 'taskbar';
      else
        for (let i = this.windows.length - 1; i >= 0; i--) {
          const w = this.windows[i];
          if (w.min) continue;
          if (g.mx >= w.x && g.mx < w.x + w.w && g.my >= w.y && g.my < w.y + w.h) {
            owner = w;
            break;
          }
        }
    }
    if (g.pressed && owner && owner !== 'taskbar' && owner !== this.windows.at(-1)) this.focus(owner);
    if (g.pressed && owner !== 'taskbar' && this.startOpen) this.startOpen = false;

    this.drawWallpaper();
    g.inputOK = owner === null && !modal && !this.overlay && !this.locked;
    this.drawIcons();

    for (const w of this.windows) {
      if (w.min) continue;
      g.inputOK = owner === w;
      this.drawWindow(w, dt, w === this.windows.at(-1));
    }

    g.inputOK = owner === 'taskbar';
    this.drawTaskbar();
    if (this.startOpen) this.drawStart();

    g.inputOK = !modal && !this.overlay && !this.locked;
    this.drawNotes(dt);

    if (modal) {
      g.inputOK = !this.overlay;
      this.drawModal(modal);
    }
    if (this.overlay) {
      g.inputOK = true;
      const done = this.overlay.draw(g, dt, this);
      if (done) this.overlay = null;
    }

    // tracking damage on the panel when they're close
    const gl = Math.max(this.glitch, G.heat > 80 ? (G.heat - 80) / 60 : 0);
    if (gl > 0 && Math.random() < gl) this.tear(gl);
    this.glitch = Math.max(0, this.glitch - dt * 1.5);

    g.drawCursor();
    g.end();
  }

  tear(k) {
    const ctx = this.g.ctx;
    const n = 1 + ((Math.random() * 4 * k) | 0);
    for (let i = 0; i < n; i++) {
      const y = Math.random() * this.H, h = 4 + Math.random() * 40 * k;
      const dx = (Math.random() - 0.5) * 80 * k;
      try {
        ctx.drawImage(this.canvas, 0, y, this.W, h, dx, y, this.W, h);
      } catch (e) {
        /* ignore */
      }
    }
  }

  drawBoot(dt) {
    const g = this.g;
    this.bootT += dt;
    g.rect(0, 0, this.W, this.H, '#000');
    const lines = [
      'GH0ST BIOS v4.04  (c) nobody',
      'CPU: C0RE i3 @ 1.70GHz ........ OK',
      'RAM: 4096MB ................... OK',
      'Webcam ........................ ON',
      'Microphone .................... ON',
      'Location services ............. ON',
      '',
      'Loading GH0ST//OS',
    ];
    const n = Math.min(lines.length, Math.floor(this.bootT * 5));
    for (let i = 0; i < n; i++) g.text(lines[i], 60, 90 + i * 34, { size: 30, font: HEAD, color: i >= 3 && i <= 5 ? C.amber : '#b9c4bd' });
    if (this.bootT > 1.8) {
      const p = Math.min(1, (this.bootT - 1.8) / 1.6);
      g.progress(60, 400, 500, 14, p, '#b9c4bd');
      if (this.bootT > 3.6) {
        this.booted = true;
        audio.bootChime();
        emit('booted');
      }
    }
    if (Math.floor(this.bootT * 3) % 2 === 0) g.rect(60, 90 + n * 34 - 22, 14, 26, '#b9c4bd');
  }

  drawWallpaper() {
    const g = this.g, ctx = g.ctx, W = this.W, H = this.H;
    const grd = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, W * 0.75);
    grd.addColorStop(0, '#141a1c');
    grd.addColorStop(1, '#050607');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    // the eye opens as they get closer
    const cx = W / 2 + 120, cy = H * 0.44;
    const open = 0.06 + (G.heat / 100) * 0.94;
    ctx.save();
    ctx.globalAlpha = 0.16 + G.heat / 500;
    ctx.strokeStyle = '#7d8a85';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 170, cy);
    ctx.quadraticCurveTo(cx, cy - 150 * open, cx + 170, cy);
    ctx.quadraticCurveTo(cx, cy + 150 * open, cx - 170, cy);
    ctx.stroke();
    ctx.clip();
    // pupil follows the cursor
    const px = cx + Math.max(-60, Math.min(60, (g.mx - cx) * 0.08)), py = cy + Math.max(-30, Math.min(30, (g.my - cy) * 0.08));
    ctx.beginPath();
    ctx.arc(px, py, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#7d8a85';
    ctx.beginPath();
    ctx.arc(px, py, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    g.text('GH0ST//OS', cx, cy + 210, { align: 'center', size: 64, font: HEAD, color: 'rgba(125,138,133,0.13)' });
    g.text('everything is logged', cx, cy + 244, { align: 'center', size: 20, font: TYPE, color: 'rgba(125,138,133,0.13)' });
  }

  drawIcons() {
    const g = this.g;
    const ids = this.order.filter((id) => !this.apps[id].def.hidden);
    const colH = 5;
    ids.forEach((id, i) => {
      const def = this.apps[id].def;
      const x = 22 + Math.floor(i / colH) * 112, y = 18 + (i % colH) * 136;
      const over = g.over(x, y, 100, 124);
      if (over) g.rrect(x, y, 100, 124, 6, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)');
      if (g.hit('icon:' + id, x, y, 100, 124)) this.open(id);
      drawIcon(g.ctx, def.icon || id, x + 50, y + 46, 64, this.t);
      g.text(def.label || def.title, x + 50, y + 106, { align: 'center', size: 16, bold: true, color: over ? '#fff' : C.text, max: 104 });
      const badge = this.apps[id].inst && this.apps[id].inst.badge;
      if (badge) {
        g.circle(x + 80, y + 18, 13, C.red);
        g.text(String(badge), x + 80, y + 19, { align: 'center', base: 'middle', size: 15, bold: true, color: '#fff' });
      }
    });
  }

  drawWindow(w, dt, top) {
    const g = this.g;
    const inst = this.app(w.id);
    const def = this.apps[w.id].def;
    // open animation
    const age = this.t - w.born;
    const s = Math.min(1, age * 7);
    g.ctx.save();
    if (s < 1) {
      g.ctx.globalAlpha = s;
      g.ctx.translate(w.x + w.w / 2, w.y + w.h / 2);
      g.ctx.scale(0.94 + s * 0.06, 0.94 + s * 0.06);
      g.ctx.translate(-(w.x + w.w / 2), -(w.y + w.h / 2));
    }
    // shadow
    g.rect(w.x + 8, w.y + 10, w.w, w.h, 'rgba(0,0,0,0.45)');
    g.rect(w.x, w.y, w.w, w.h, C.win);
    g.rect(w.x, w.y, w.w, TITLE_H, top ? C.titleOn : C.title);
    g.stroke(w.x, w.y, w.w, w.h, top ? C.borderOn : C.border, 2);
    drawIcon(g.ctx, def.icon || w.id, w.x + 20, w.y + TITLE_H / 2, 22, this.t);
    g.text(inst.title || def.title, w.x + 38, w.y + TITLE_H / 2 + 1, { base: 'middle', size: 17, bold: true, color: top ? C.text : C.dim, max: w.w - 130 });

    // title bar drag
    const dragId = 'drag:' + w.id;
    if (g.over(w.x, w.y, w.w - 80, TITLE_H)) {
      g.cursor = 'hand';
      if (g.pressed) {
        this.dragging = { w, dx: g.mx - w.x, dy: g.my - w.y };
        g.active = dragId;
        g.consumed = true;
      }
    }
    if (this.dragging && this.dragging.w === w) {
      if (g.down) {
        w.x = Math.round(Math.max(-w.w + 120, Math.min(this.W - 120, g.mx - this.dragging.dx)));
        w.y = Math.round(Math.max(0, Math.min(this.H - TASK_H - TITLE_H, g.my - this.dragging.dy)));
      } else this.dragging = null;
    }
    // buttons
    if (g.button('min:' + w.id, w.x + w.w - 76, w.y + 5, 32, 24, '_', { size: 16, r: 3 })) w.min = true;
    if (g.button('x:' + w.id, w.x + w.w - 40, w.y + 5, 32, 24, '×', { size: 20, r: 3, kind: 'danger' })) {
      g.ctx.restore();
      this.close(w);
      return;
    }

    g.clip(w.x + 2, w.y + TITLE_H, w.w - 4, w.h - TITLE_H - 2);
    g.push(w.x + 2, w.y + TITLE_H);
    inst.draw(g, w.w - 4, w.h - TITLE_H - 2, dt, w);
    g.pop();
    g.unclip();
    g.ctx.restore();
  }

  overStart() {
    return this.g.mx < 340 && this.g.my > this.H - TASK_H - 520;
  }

  drawTaskbar() {
    const g = this.g, W = this.W, H = this.H, y = H - TASK_H;
    g.rect(0, y, W, TASK_H, '#0d1112');
    g.line(0, y, W, y, C.border, 2);
    if (g.button('start', 6, y + 6, 116, TASK_H - 12, '', {
      draw: (x, yy, w, h) => {
        g.circle(x + 20, yy + h / 2, 8, null, C.green, 3);
        g.text('GH0ST', x + 36, yy + h / 2 + 1, { base: 'middle', size: 18, bold: true, font: FONT });
      },
    }))
      this.startOpen = !this.startOpen;
    // open windows
    let x = 132;
    for (const w of this.windows) {
      const def = this.apps[w.id].def;
      const top = w === this.windows.at(-1) && !w.min;
      if (g.button('task:' + w.id, x, y + 6, 150, TASK_H - 12, '', {
        bg: top ? '#23302f' : C.btn,
        draw: (bx, by, bw, bh) => {
          drawIcon(g.ctx, def.icon || w.id, bx + 18, by + bh / 2, 20, this.t);
          g.text(def.label || def.title, bx + 34, by + bh / 2 + 1, { base: 'middle', size: 15, bold: true, max: bw - 40, color: top ? C.text : C.dim });
        },
      })) {
        if (top) w.min = true;
        else {
          w.min = false;
          this.focus(w);
        }
      }
      x += 154;
      if (x > W - 640) break;
    }

    // right: balance, police, clock
    const now = new Date();
    const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    g.text(clock, W - 16, y + TASK_H / 2 + 1, { align: 'right', base: 'middle', size: 18, bold: true });

    const miles = milesAway();
    const px = W - 420;
    const danger = G.heat > 75;
    const blink = danger && Math.floor(this.t * 3) % 2 === 0;
    g.text('POLICE', px, y + 18, { size: 13, bold: true, color: blink ? C.red : C.dim });
    g.text(miles.toFixed(2) + ' mi', px + 62, y + 18, { size: 15, bold: true, color: danger ? C.red : C.amber });
    g.progress(px, y + 26, 170, 10, G.heat / 100, danger ? C.red : C.amber);

    const mx = W - 236;
    g.text('WALLET', mx, y + 18, { size: 13, bold: true, color: C.dim });
    g.text(money(G.money), mx, y + 38, { size: 18, bold: true, color: G.money >= GOAL ? C.green : C.text });
    g.progress(mx + 66, y + 9, 70, 6, G.money / GOAL, C.green);
  }

  drawStart() {
    const g = this.g;
    const ids = this.order.filter((id) => !this.apps[id].def.hidden);
    const rowH = 30;
    const h = ids.length * rowH + 110;
    const x = 6, y = this.H - TASK_H - h - 4;
    g.rect(x, y, 330, h, '#101516');
    g.stroke(x, y, 330, h, C.borderOn, 2);
    g.rect(x, y, 330, 48, '#162022');
    g.text('GH0ST//OS', x + 16, y + 32, { size: 30, font: HEAD, color: C.green });
    g.text('user: you', x + 180, y + 31, { size: 15, color: C.dim });
    ids.forEach((id, i) => {
      const def = this.apps[id].def;
      const yy = y + 56 + i * rowH;
      const over = g.over(x + 4, yy, 322, rowH);
      if (over) g.rect(x + 4, yy, 322, rowH, '#1f2a2c');
      if (g.hit('sm:' + id, x + 4, yy, 322, rowH)) this.open(id);
      drawIcon(g.ctx, def.icon || id, x + 24, yy + rowH / 2, 20, this.t);
      g.text(def.title, x + 44, yy + rowH / 2 + 1, { base: 'middle', size: 16, bold: true });
    });
    if (g.button('shutdown', x + 10, y + h - 44, 310, 34, '⏻  Shut down', { kind: 'danger' })) {
      this.startOpen = false;
      emit('shutdown');
    }
  }

  drawNotes(dt) {
    const g = this.g;
    let y = this.H - TASK_H - 14;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.t += dt;
      if (n.t > n.life) {
        this.notes.splice(i, 1);
        continue;
      }
      const a = Math.min(1, n.t * 5, (n.life - n.t) * 2);
      const w = 400;
      g.ctx.font = `15px ${FONT}`;
      const bodyH = n.body ? g.para(n.body, 0, 0, w - 70, { size: 15, measure: true }) : 0;
      const h = 48 + bodyH;
      const x = this.W - w - 14 + (1 - a) * 60;
      y -= h + 8;
      g.ctx.save();
      g.ctx.globalAlpha = a;
      g.rect(x + 5, y + 6, w, h, 'rgba(0,0,0,0.5)');
      g.rect(x, y, w, h, '#121819');
      g.rect(x, y, 4, h, n.color);
      g.stroke(x, y, w, h, C.border, 1.5);
      if (n.icon) drawIcon(g.ctx, n.icon, x + 30, y + 26, 30, this.t);
      g.text(n.title, x + 56, y + 28, { size: 17, bold: true, max: w - 70 });
      if (n.body) g.para(n.body, x + 56, y + 50, w - 70, { size: 15, color: C.dim });
      if (g.hit('note:' + i + n.title, x, y, w, h)) {
        if (n.app) this.open(n.app);
        n.life = n.t + 0.2;
      }
      g.ctx.restore();
    }
  }

  drawModal(m) {
    const g = this.g, W = this.W, H = this.H;
    g.rect(0, 0, W, H, 'rgba(0,0,0,0.55)');
    const w = m.w || 560;
    g.ctx.font = `17px ${FONT}`;
    const bodyH = g.para(m.body || '', 0, 0, w - 60, { size: 17, measure: true });
    const h = 140 + bodyH + (m.extraH || 0);
    const x = (W - w) / 2, y = (H - TASK_H - h) / 2;
    g.rect(x + 10, y + 12, w, h, 'rgba(0,0,0,0.6)');
    g.rect(x, y, w, h, '#121718');
    g.rect(x, y, w, TITLE_H, m.danger ? '#3a1818' : C.titleOn);
    g.stroke(x, y, w, h, m.danger ? C.red : C.borderOn, 2);
    g.text(m.title, x + 16, y + TITLE_H / 2 + 1, { base: 'middle', size: 17, bold: true });
    if (m.draw) m.draw(g, x, y + TITLE_H, w);
    g.para(m.body || '', x + 30, y + TITLE_H + 38 + (m.extraH || 0), w - 60, { size: 17, color: C.text });
    const btns = m.buttons || [{ label: 'OK' }];
    let bx = x + w - 20;
    for (let i = btns.length - 1; i >= 0; i--) {
      const b = btns[i];
      const bw = Math.max(110, g.measure(b.label, 17, FONT, true) + 36);
      bx -= bw;
      if (g.button('modal:' + i + b.label, bx, y + h - 56, bw, 38, b.label, { kind: b.kind })) {
        this.modalQ.shift();
        b.fn && b.fn();
        return;
      }
      bx -= 12;
    }
  }
}
