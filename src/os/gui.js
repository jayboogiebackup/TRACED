import { audio } from '../core/audio.js';

// Tiny immediate-mode GUI drawn into the laptop's screen canvas.

export const FONT = '"Anonymous Pro", monospace';
export const HEAD = '"VT323", monospace';
export const TYPE = '"Special Elite", serif';

export const C = {
  bg: '#07090a',
  win: '#111516',
  win2: '#161b1c',
  title: '#1b2123',
  titleOn: '#243034',
  border: '#39454a',
  borderOn: '#5b6c72',
  text: '#dfe6df',
  dim: '#a2afa9',
  faint: '#66716d',
  green: '#5cf08a',
  red: '#ff5c5c',
  amber: '#ffc857',
  blue: '#6ab7ff',
  purple: '#b48cff',
  pink: '#ff7ad9',
  btn: '#1f2729',
  btnHi: '#2b373a',
  btnDown: '#151b1c',
};

export const money = (n, dec) => {
  const neg = n < 0;
  n = Math.abs(n);
  let s;
  if (dec === undefined) dec = n < 100 ? 2 : 0;
  s = n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (neg ? '-$' : '$') + s;
};
export const short = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
  return Math.round(n).toLocaleString('en-US');
};

export class GUI {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.mx = -9999;
    this.my = -9999;
    this.down = false;
    this.pressed = false;
    this.released = false;
    this.wheel = 0;
    this.keys = [];
    this.typed = '';
    this.hot = null;
    this.hotPrev = null;
    this.active = null;
    this.focus = null;
    this.ox = 0;
    this.oy = 0;
    this.stack = [];
    this.clips = [];
    this.inputOK = true;
    this.cursor = 'arrow';
    this.scrolls = {};
    this.t = 0;
    this.consumed = false;
  }

  // ── host input
  move(x, y) {
    this.mx = x;
    this.my = y;
  }
  press() {
    this.down = true;
    this.pressed = true;
  }
  release() {
    this.down = false;
    this.released = true;
  }
  scroll(d) {
    this.wheel += d;
  }
  key(e) {
    this.keys.push(e);
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.typed += e.key;
  }

  begin(dt) {
    this.t += dt;
    this.hotPrev = this.hot;
    this.hot = null;
    this.cursor = 'arrow';
    this.ox = this.oy = 0;
    this.consumed = false;
  }
  end() {
    if (this.hot && this.hot !== this.hotPrev && !this.down) audio.hover();
    if (this.pressed && !this.consumed && this.focus) this.focus = null;
    this.pressed = this.released = false;
    this.wheel = 0;
    this.keys = [];
    this.typed = '';
    if (!this.down) this.active = null;
  }

  get lx() {
    return this.mx - this.ox;
  }
  get ly() {
    return this.my - this.oy;
  }

  push(x, y) {
    this.stack.push([this.ox, this.oy]);
    this.ox += x;
    this.oy += y;
    this.ctx.save();
    this.ctx.translate(x, y);
  }
  pop() {
    const [x, y] = this.stack.pop();
    this.ox = x;
    this.oy = y;
    this.ctx.restore();
  }
  clip(x, y, w, h) {
    const ax = x + this.ox, ay = y + this.oy;
    let r = [ax, ay, w, h];
    const p = this.clips.at(-1);
    if (p) {
      const x0 = Math.max(ax, p[0]), y0 = Math.max(ay, p[1]);
      const x1 = Math.min(ax + w, p[0] + p[2]), y1 = Math.min(ay + h, p[1] + p[3]);
      r = [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
    }
    this.clips.push(r);
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }
  unclip() {
    this.clips.pop();
    this.ctx.restore();
  }

  over(x, y, w, h) {
    if (!this.inputOK) return false;
    const mx = this.mx, my = this.my;
    const ax = x + this.ox, ay = y + this.oy;
    if (mx < ax || my < ay || mx >= ax + w || my >= ay + h) return false;
    const c = this.clips.at(-1);
    if (c && (mx < c[0] || my < c[1] || mx >= c[0] + c[2] || my >= c[1] + c[3])) return false;
    return true;
  }

  // generic clickable region; returns true on click
  hit(id, x, y, w, h, o = {}) {
    const over = this.over(x, y, w, h);
    if (over) {
      this.hot = id;
      if (!o.disabled) this.cursor = 'hand';
      if (this.pressed && !o.disabled) {
        this.active = id;
        this.consumed = true;
        if (o.onPress) {
          audio.click();
          return true;
        }
      }
    }
    if (!o.onPress && this.released && this.active === id && over && !o.disabled) {
      if (!o.silent) audio.click();
      return true;
    }
    return false;
  }

  // ── drawing
  rect(x, y, w, h, fill) {
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(x, y, w, h);
  }
  stroke(x, y, w, h, color, lw = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lw;
    this.ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  }
  rrect(x, y, w, h, r, fill, stroke) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  line(x0, y0, x1, y1, color, lw = 1) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  circle(x, y, r, fill, stroke, lw = 2) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  text(s, x, y, o = {}) {
    const ctx = this.ctx;
    ctx.font = `${o.bold ? 'bold ' : ''}${o.size || 18}px ${o.font || FONT}`;
    ctx.fillStyle = o.color || C.text;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.max) s = this.fit(String(s), o.max);
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  }
  measure(s, size = 18, font = FONT, bold = false) {
    this.ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    return this.ctx.measureText(s).width;
  }
  fit(s, max) {
    if (this.ctx.measureText(s).width <= max) return s;
    while (s.length > 1 && this.ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }
  // word-wrapped paragraph; returns height used
  para(s, x, y, w, o = {}) {
    const size = o.size || 17;
    const lh = o.lh || size * 1.35;
    const ctx = this.ctx;
    ctx.font = `${o.bold ? 'bold ' : ''}${size}px ${o.font || FONT}`;
    ctx.fillStyle = o.color || C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let yy = y;
    for (const raw of String(s).split('\n')) {
      const words = raw.split(' ');
      let line = '';
      for (const wd of words) {
        const test = line ? line + ' ' + wd : wd;
        if (ctx.measureText(test).width > w && line) {
          if (!o.measure) ctx.fillText(line, x, yy);
          yy += lh;
          line = wd;
        } else line = test;
      }
      if (!o.measure) ctx.fillText(line, x, yy);
      yy += lh;
    }
    return yy - y;
  }

  // ── widgets
  button(id, x, y, w, h, label, o = {}) {
    const dis = !!o.disabled;
    const over = this.over(x, y, w, h);
    const clicked = this.hit(id, x, y, w, h, { disabled: dis, silent: o.silent });
    const pressed = this.active === id && over && this.down;
    let bg = o.bg || C.btn, fg = o.color || C.text, br = o.border || C.border;
    if (o.kind === 'primary') {
      bg = '#163a24';
      br = C.green;
      fg = C.green;
    } else if (o.kind === 'danger') {
      bg = '#3a1616';
      br = C.red;
      fg = '#ffb3b3';
    } else if (o.kind === 'gold') {
      bg = '#3a3016';
      br = C.amber;
      fg = C.amber;
    }
    if (dis) {
      bg = '#141818';
      fg = C.faint;
      br = '#252c2e';
    } else if (pressed) bg = C.btnDown;
    else if (over) {
      bg = o.kind ? shade(bg, 1.5) : C.btnHi;
      br = o.kind ? br : C.borderOn;
    }
    this.rrect(x, y + (pressed ? 1 : 0), w, h, o.r ?? 4, bg, br);
    if (o.draw) o.draw(x, y + (pressed ? 1 : 0), w, h, fg);
    else
      this.text(label, x + w / 2, y + h / 2 + (pressed ? 1 : 0) + 1, {
        align: 'center',
        base: 'middle',
        size: o.size || 17,
        bold: o.bold ?? true,
        color: fg,
        font: o.font,
        max: w - 8,
      });
    return clicked;
  }

  progress(x, y, w, h, v, color = C.green, bg = '#0b0e0f') {
    this.rect(x, y, w, h, bg);
    this.rect(x, y, Math.max(0, Math.min(1, v)) * w, h, color);
    this.stroke(x, y, w, h, C.border);
  }

  tabs(id, x, y, names, cur, o = {}) {
    let xx = x;
    const h = o.h || 34;
    names.forEach((n, i) => {
      const w = o.w || this.measure(n, 16, FONT, true) + 28;
      const on = i === cur;
      if (this.hit(id + ':' + i, xx, y, w, h)) cur = i;
      const over = this.over(xx, y, w, h);
      this.rect(xx, y, w, h, on ? C.titleOn : over ? C.btnHi : C.btn);
      if (on) this.rect(xx, y + h - 3, w, 3, o.accent || C.green);
      this.text(n, xx + w / 2, y + h / 2 + 1, { align: 'center', base: 'middle', size: 16, bold: true, color: on ? C.text : C.dim });
      xx += w + 2;
    });
    return cur;
  }

  // single-line text field. returns {value, submit}
  input(id, x, y, w, h, value, o = {}) {
    const focused = this.focus === id;
    if (this.hit(id, x, y, w, h, { onPress: true })) this.focus = id;
    if (this.over(x, y, w, h)) this.cursor = 'text';
    let submit = false;
    if (focused) {
      for (const e of this.keys) {
        if (e.key === 'Backspace') value = value.slice(0, -1);
        else if (e.key === 'Enter') submit = true;
        else if (e.key === 'Escape') this.focus = null;
      }
      const add = this.typed.replace(/[\r\n]/g, '');
      if (add) value = (value + add).slice(0, o.max || 200);
    }
    this.rect(x, y, w, h, '#0a0d0e');
    this.stroke(x, y, w, h, focused ? C.borderOn : C.border);
    const size = o.size || 17;
    this.clip(x + 4, y, w - 8, h);
    let shown = value;
    this.ctx.font = `${size}px ${FONT}`;
    while (shown.length && this.ctx.measureText(shown).width > w - 24) shown = shown.slice(1);
    const tw = this.text(shown || (focused ? '' : o.placeholder || ''), x + 10, y + h / 2 + 1, {
      base: 'middle',
      size,
      color: shown ? C.text : C.faint,
    });
    if (focused && Math.floor(this.t * 2) % 2 === 0) this.rect(x + 11 + (shown ? tw : 0), y + 8, 2, h - 16, C.text);
    this.unclip();
    return { value, submit };
  }

  // scrollable region. draw(contentY) is called inside a clip; returns nothing
  scrollArea(id, x, y, w, h, contentH, draw) {
    const s = (this.scrolls[id] = this.scrolls[id] || { y: 0, v: 0 });
    const max = Math.max(0, contentH - h);
    if (this.over(x, y, w, h) && this.wheel) s.v += this.wheel * 0.9;
    s.y += s.v * 0.35;
    s.v *= 0.65;
    if (s.stick && s.atBottom) s.y = max;
    s.y = Math.max(0, Math.min(max, s.y));
    s.atBottom = s.y >= max - 4;
    this.clip(x, y, w, h);
    this.push(x, y - s.y);
    draw(w - (max > 0 ? 12 : 0));
    this.pop();
    this.unclip();
    if (max > 0) {
      const bh = Math.max(30, (h / contentH) * h);
      const by = y + (s.y / max) * (h - bh);
      this.rect(x + w - 8, y, 6, h, '#0c0f10');
      this.rrect(x + w - 8, by, 6, bh, 3, C.faint);
    }
    return s;
  }

  // vector cursor drawn last
  drawCursor() {
    if (this.mx < 0 || this.my < 0 || this.mx > this.W || this.my > this.H) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(this.mx), Math.round(this.my));
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (this.cursor === 'hand') {
      // pointing hand
      ctx.moveTo(6, 0);
      ctx.lineTo(10, 0);
      ctx.lineTo(10, 10);
      ctx.lineTo(20, 12);
      ctx.lineTo(22, 26);
      ctx.lineTo(8, 28);
      ctx.lineTo(0, 17);
      ctx.lineTo(3, 14);
      ctx.lineTo(6, 17);
      ctx.closePath();
    } else if (this.cursor === 'text') {
      ctx.rect(-1, -10, 3, 22);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(7, 20);
      ctx.lineTo(12, 30);
      ctx.lineTo(16, 28);
      ctx.lineTo(11, 18);
      ctx.lineTo(19, 18);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k) | 0, g = Math.min(255, ((n >> 8) & 255) * k) | 0, b = Math.min(255, (n & 255) * k) | 0;
  return `rgb(${r},${g},${b})`;
}
