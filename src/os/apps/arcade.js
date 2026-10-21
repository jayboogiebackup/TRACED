import { C, FONT, HEAD, TYPE, money } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, addMoney, secret } from '../../game/state.js';

const DASHIE_SCORE = 1337;

// Optional: drop a picture at public/img/dashie.png and it replaces the cartoon.
const dashieImg = new Image();
let dashieImgOk = false;
dashieImg.onload = () => (dashieImgOk = true);
dashieImg.src = 'img/dashie.png';

function drawDashie(ctx, x, y, r, t, yell) {
  ctx.save();
  ctx.translate(x, y);
  const bob = yell ? Math.sin(t * 30) * 3 : Math.sin(t * 2) * 2;
  ctx.translate(0, bob);
  if (dashieImgOk) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(dashieImg, -r, -r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  const tilt = yell ? Math.sin(t * 18) * 0.06 : Math.sin(t * 1.3) * 0.03;
  ctx.rotate(tilt);
  // badge behind the head
  ctx.fillStyle = '#2a1a3a';
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b48cff';
  ctx.lineWidth = r * 0.05;
  ctx.stroke();
  // face
  ctx.fillStyle = '#9a6a48';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.82, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = '#16100d';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.42, r * 0.84, r * 0.5, 0, Math.PI, 0);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.3, 0, -r * 0.4);
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.3, -r * 0.84, -r * 0.42);
  ctx.fill();
  // headphones: band + round cups + mic boom
  ctx.strokeStyle = '#222';
  ctx.lineWidth = r * 0.13;
  ctx.beginPath();
  ctx.arc(0, -r * 0.02, r * 0.93, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(s * r * 0.86, r * 0.02, r * 0.2, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b48cff';
    ctx.beginPath();
    ctx.ellipse(s * r * 0.9, r * 0.02, r * 0.1, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#222';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.moveTo(-r * 0.86, r * 0.2);
  ctx.quadraticCurveTo(-r * 0.75, r * 0.62, -r * 0.3, r * 0.62);
  ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(-r * 0.28, r * 0.62, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // eyes, wide when he yells
  const eh = yell ? 0.2 : 0.14;
  for (const ex of [-0.32, 0.32]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex * r, -r * 0.08, r * 0.15, r * eh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1010';
    ctx.beginPath();
    ctx.arc(ex * r, -r * 0.06, r * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex * r + r * 0.03, -r * 0.09, r * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  // brows jump up when he yells
  ctx.strokeStyle = '#16100d';
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  const by = yell ? -r * 0.4 : -r * 0.3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.47, by + r * 0.03);
  ctx.quadraticCurveTo(-r * 0.32, by - r * 0.05, -r * 0.18, by + r * 0.02);
  ctx.moveTo(r * 0.47, by + r * 0.03);
  ctx.quadraticCurveTo(r * 0.32, by - r * 0.05, r * 0.18, by + r * 0.02);
  ctx.stroke();
  // short beard
  ctx.fillStyle = 'rgba(22,16,13,0.8)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.58, r * 0.46, 0, 0.1, Math.PI - 0.1);
  ctx.quadraticCurveTo(0, r * 0.62, r * 0.57, r * 0.47);
  ctx.fill();
  // mouth: big grin, or a full WHAAAT'S UP
  const open = yell ? 0.26 + Math.abs(Math.sin(t * 20)) * 0.08 : 0.1;
  ctx.fillStyle = '#3a0d0d';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.36, r * 0.3, r * open, 0, 0, Math.PI);
  ctx.lineTo(-r * 0.3, r * 0.36);
  ctx.fill();
  ctx.fillStyle = '#f2ede4';
  ctx.fillRect(-r * 0.24, r * 0.36, r * 0.48, r * 0.06);
  if (yell) {
    ctx.fillStyle = '#c4505a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.36 + r * open * 0.7, r * 0.15, r * open * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── HELI.swf
function makeHeli() {
  const S = { state: 'ready', y: 200, vy: 0, dist: 0, speed: 240, cols: [], blocks: [], smoke: [], best: 0, payout: 0, t: 0 };
  const COLW = 16;
  function reset(gh) {
    S.state = 'ready';
    S.y = gh / 2;
    S.vy = 0;
    S.dist = 0;
    S.speed = 240;
    S.cols = [];
    S.blocks = [];
    S.smoke = [];
    S.paid = false;
    S.off = 0;
    let top = 40, gap = gh - 80;
    for (let i = 0; i < 80; i++) S.cols.push({ top, bot: top + gap });
    S.gh = gh;
  }
  S.reset = reset;
  S.update = (dt, hold, gw, gh) => {
    if (!S.cols.length || S.gh !== gh) reset(gh);
    if (S.state === 'ready') {
      if (hold) S.state = 'fly';
      return;
    }
    if (S.state !== 'fly') return;
    S.t += dt;
    S.vy += (hold ? -1500 : 950) * dt;
    S.vy = Math.max(-420, Math.min(520, S.vy));
    S.y += S.vy * dt;
    S.speed += dt * 6;
    const dx = S.speed * dt;
    S.dist += dx;
    S.off = (S.off || 0) + dx;
    while (S.off >= COLW) {
      S.off -= COLW;
      S.cols.shift();
      const last = S.cols.at(-1);
      const gap = Math.max(150, gh - 80 - S.dist / 40);
      let top = last.top + (Math.random() - 0.5) * 26;
      top = Math.max(10, Math.min(gh - gap - 10, top));
      S.cols.push({ top, bot: top + gap });
      if (Math.random() < 0.035 && S.dist > 400) {
        const bh = 60 + Math.random() * 50;
        S.blocks.push({ x: gw + 20, y: top + 20 + Math.random() * Math.max(10, gap - bh - 40), h: bh });
      }
    }
    for (const b of S.blocks) b.x -= dx;
    S.blocks = S.blocks.filter((b) => b.x > -40);
    if (Math.random() < 0.6) S.smoke.push({ x: 110, y: S.y + 6, t: 0 });
    for (const s of S.smoke) {
      s.x -= dx;
      s.t += dt;
    }
    S.smoke = S.smoke.filter((s) => s.t < 0.8);
    // collide
    const hx = 120, ci = Math.floor((hx + S.off) / COLW);
    const col = S.cols[ci] || S.cols[0];
    let dead = S.y - 10 < col.top || S.y + 10 > col.bot;
    for (const b of S.blocks) if (hx + 22 > b.x && hx - 22 < b.x + 26 && S.y + 10 > b.y && S.y - 10 < b.y + b.h) dead = true;
    if (dead) {
      S.state = 'dead';
      audio.boom();
    }
  };
  S.score = () => Math.floor(S.dist / 10);
  S.draw = (g, gw, gh) => {
    const ctx = g.ctx;
    g.rect(0, 0, gw, gh, '#0b1008');
    ctx.fillStyle = '#4c8a2c';
    S.cols.forEach((c, i) => {
      const x = i * COLW - (S.off || 0);
      ctx.fillRect(x, 0, COLW + 1, c.top);
      ctx.fillRect(x, c.bot, COLW + 1, gh - c.bot);
    });
    ctx.fillStyle = '#4c8a2c';
    for (const b of S.blocks) ctx.fillRect(b.x, b.y, 26, b.h);
    for (const s of S.smoke) {
      ctx.globalAlpha = 0.5 * (1 - s.t / 0.8);
      ctx.fillStyle = '#cfd8c4';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4 + s.t * 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // heli
    ctx.save();
    ctx.translate(120, S.y);
    ctx.rotate(Math.max(-0.4, Math.min(0.4, S.vy / 900)));
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-34, -3, 20, 5);
    ctx.fillStyle = '#6ab7ff';
    ctx.fillRect(4, -6, 10, 7);
    ctx.fillStyle = '#e8e8e8';
    const blade = Math.sin(g.t * 60) * 22;
    ctx.fillRect(-blade, -16, blade * 2, 3);
    ctx.fillRect(-2, -14, 4, 6);
    ctx.restore();
    g.rect(0, 0, gw, 38, 'rgba(0,0,0,0.6)');
    g.text(`DISTANCE ${S.score()}`, 14, 28, { size: 22, font: HEAD, color: '#cfe8c0' });
    g.text(`BEST ${S.best}`, gw - 14, 28, { size: 22, font: HEAD, color: '#cfe8c0', align: 'right' });
    if (S.state === 'ready') g.text(g.touch ? 'HOLD YOUR FINGER DOWN TO FLY' : 'HOLD MOUSE BUTTON TO FLY', gw / 2, gh / 2, { align: 'center', base: 'middle', size: 34, font: HEAD, color: '#fff' });
  };
  return S;
}

// ── WHACK-A-FED.swf
function makeWhack() {
  const S = { state: 'ready', t: 0, holes: Array(9).fill(null), spawnT: 0, hits: 0, oops: 0, earned: 0, combo: 0, cd: 0 };
  S.update = (dt) => {
    if (S.cd > 0) S.cd -= dt;
    if (S.state !== 'play') return;
    S.t += dt;
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      S.spawnT = 0.45 + Math.random() * 0.4;
      const free = S.holes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
      if (free.length) {
        const i = free[(Math.random() * free.length) | 0];
        S.holes[i] = { kind: Math.random() < 0.8 ? 'fed' : 'nana', t: 0, life: 0.75 + Math.random() * 0.35, hit: 0 };
      }
    }
    S.holes.forEach((h, i) => {
      if (!h) return;
      h.t += dt;
      if (h.hit) h.hit += dt;
      if (h.t > h.life || h.hit > 0.25) {
        if (!h.hit && h.kind === 'fed') S.combo = 0;
        S.holes[i] = null;
      }
    });
    if (S.t >= 30) {
      S.state = 'over';
      S.cd = 35;
      if (S.earned > 0) audio.cash();
    }
  };
  S.draw = (g, gw, gh, os) => {
    g.rect(0, 0, gw, gh, '#14100b');
    const cell = Math.min((gw - 40) / 3, (gh - 60) / 3);
    const ox = (gw - cell * 3) / 2, oy = 50;
    S.holes.forEach((h, i) => {
      const cx = ox + (i % 3) * cell + cell / 2, cy = oy + Math.floor(i / 3) * cell + cell * 0.62;
      const ctx = g.ctx;
      ctx.fillStyle = '#050403';
      ctx.beginPath();
      ctx.ellipse(cx, cy + cell * 0.18, cell * 0.36, cell * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      if (h) {
        const up = Math.min(1, h.t * 8, (h.life - h.t) * 8);
        const y = cy + cell * 0.18 - up * cell * 0.42;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - cell / 2, cy - cell, cell, cell * 1.18);
        ctx.clip();
        // head
        ctx.fillStyle = h.kind === 'fed' ? '#c69c7a' : '#e2c3a8';
        ctx.beginPath();
        ctx.arc(cx, y, cell * 0.2, 0, Math.PI * 2);
        ctx.fill();
        if (h.kind === 'fed') {
          ctx.fillStyle = '#111';
          ctx.fillRect(cx - cell * 0.16, y - cell * 0.05, cell * 0.32, cell * 0.07);
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(cx - cell * 0.22, y + cell * 0.18, cell * 0.44, cell * 0.3);
          ctx.fillStyle = '#eee';
          ctx.fillRect(cx - cell * 0.04, y + cell * 0.18, cell * 0.08, cell * 0.16);
        } else {
          ctx.fillStyle = '#cfcfcf';
          ctx.beginPath();
          ctx.arc(cx, y - cell * 0.2, cell * 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 3;
          ctx.strokeRect(cx - cell * 0.13, y - cell * 0.04, cell * 0.1, cell * 0.07);
          ctx.strokeRect(cx + cell * 0.03, y - cell * 0.04, cell * 0.1, cell * 0.07);
          ctx.fillStyle = '#7a4a6a';
          ctx.fillRect(cx - cell * 0.22, y + cell * 0.18, cell * 0.44, cell * 0.3);
        }
        if (h.hit) {
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${cell * 0.2}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(h.kind === 'fed' ? 'BONK' : 'NANA!', cx, y - cell * 0.28);
        }
        ctx.restore();
        if (S.state === 'play' && !h.hit && up > 0.5 && g.hit('whack' + i, cx - cell * 0.3, y - cell * 0.25, cell * 0.6, cell * 0.6, { onPress: true })) {
          h.hit = 0.001;
          if (h.kind === 'fed') {
            S.combo++;
            const v = 250 * Math.min(5, 1 + Math.floor(S.combo / 3));
            S.hits++;
            S.earned += v;
            addMoney(v, 'arcade');
            audio.blip(300, 0.08, 0.12);
            audio.coin();
          } else {
            S.oops++;
            S.combo = 0;
            S.earned -= 1000;
            addMoney(-Math.min(1000, G.money), 'arcade');
            audio.error();
          }
        }
      }
    });
    g.text(`TIME ${Math.max(0, 30 - S.t).toFixed(1)}`, 14, 30, { size: 26, font: HEAD, color: '#f2d9b0' });
    g.text(`EARNED ${money(S.earned)}`, gw - 14, 30, { size: 26, font: HEAD, color: '#f2d9b0', align: 'right' });
    if (S.combo >= 3) g.text(`COMBO ×${Math.min(5, 1 + Math.floor(S.combo / 3))}`, gw / 2, 30, { size: 26, font: HEAD, color: C.amber, align: 'center' });
    if (S.state !== 'play') {
      g.rect(0, gh / 2 - 70, gw, 140, 'rgba(0,0,0,0.75)');
      const title = S.state === 'over' ? `${S.hits} feds bonked · ${S.oops} grandmas · ${money(S.earned)}` : 'BONK THE FEDS. NOT THE GRANDMAS.';
      g.text(title, gw / 2, gh / 2 - 20, { align: 'center', size: 30, font: HEAD, color: '#fff' });
      const label = S.cd > 0 ? `ad break… ${Math.ceil(S.cd)}s` : 'START (30s)';
      if (g.button('whackstart', gw / 2 - 120, gh / 2 + 6, 240, 46, label, { kind: 'primary', disabled: S.cd > 0 })) {
        Object.assign(S, { state: 'play', t: 0, holes: Array(9).fill(null), spawnT: 0.5, hits: 0, oops: 0, earned: 0, combo: 0 });
      }
    }
  };
  return S;
}

export const Arcade = {
  title: 'FLASHBANG.swf — free online games',
  label: 'FlashBang',
  icon: 'arcade',
  w: 1000,
  h: 690,
  create(os) {
    let page = 'home';
    let yell = 0;
    const heli = makeHeli();
    const whack = makeWhack();
    let heliPrizeClaimed = false;
    function dashie() {
      yell = 2.6;
      audio.dashie();
      if (secret('dashie')) os.notify('WHAAAAAT\'S UP', 'it\'s Dashie.', { app: 'arcade', color: C.purple, silent: true });
    }
    const board = () =>
      [
        ['dashiexp', DASHIE_SCORE],
        ['xX_n00bslayer_Xx', 1104],
        ['tom_fulp', 977],
        ['you', heli.best],
        ['grandma_whacker', 412],
        ['egoraptor', 388],
      ].sort((a, b) => b[1] - a[1]);

    return {
      tick(dt) {
        yell = Math.max(0, yell - dt);
        whack.update(dt);
      },
      draw(g, w, h, dt) {
        // site header
        g.rect(0, 0, w, 60, '#1a1024');
        g.text('FLASHBANG', 20, 44, { size: 46, font: HEAD, color: C.purple });
        g.text('.swf', 196, 44, { size: 26, font: HEAD, color: C.dim });
        if (page === 'home' || !g.mobile) g.text('the internet\'s #1 source of free games since 2003', 250, 40, { size: 15, color: C.dim, max: w - 400 });
        if (page !== 'home' && g.button('back', w - 140, 12, 120, 36, '← games')) {
          page = 'home';
          heli.state = heli.state === 'fly' ? 'dead' : heli.state;
        }
        g.push(0, 60);
        const ch = h - 60;
        // the home page is taller than a phone screen, so there it scrolls
        const home = (ch) => {
          const gw = w - 300;
          const games = [
            ['HELI.swf', 'hold to fly. don\'t touch the walls. $5 per point. beat 1000 for a $10,000 prize.', 'heli'],
            ['WHACK-A-FED.swf', 'bonk the feds. not the grandmas. 30 second rounds.', 'whack'],
            ['???.swf', 'coming soon', 'locked'],
          ];
          games.forEach(([name, desc, id], i) => {
            const y = 20 + i * 190;
            g.rect(20, y, gw - 30, 170, '#120d18');
            g.stroke(20, y, gw - 30, 170, '#3a2a4a');
            // thumbnail
            g.rect(34, y + 14, 220, 142, id === 'heli' ? '#0b1008' : id === 'whack' ? '#14100b' : '#0a0a0a');
            if (id === 'heli') {
              g.rect(34, y + 14, 220, 30, '#4c8a2c');
              g.rect(34, y + 126, 220, 30, '#4c8a2c');
              g.text('🚁', 140, y + 88, { align: 'center', base: 'middle', size: 48, font: 'Arial' });
            } else if (id === 'whack') {
              g.text('🔨', 144, y + 86, { align: 'center', base: 'middle', size: 56, font: 'Arial' });
            } else g.text('?', 144, y + 86, { align: 'center', base: 'middle', size: 80, font: HEAD, color: C.faint });
            g.text(name, 274, y + 46, { size: 28, font: HEAD, color: id === 'locked' ? C.faint : C.text });
            g.para(desc, 274, y + 76, gw - 330, { size: 15, color: C.dim });
            if (g.button('play' + id, 274, y + 112, 160, 40, id === 'locked' ? 'PLAY' : 'PLAY ▶', { kind: id === 'locked' ? undefined : 'primary' })) {
              if (id === 'locked') {
                os.modal({ title: 'Adobe Flash Player', body: 'This content requires Adobe Flash Player 10.\n\nFlash Player was discontinued on December 31, 2020. It\'s gone. Like your privacy.', buttons: [{ label: 'rip' }] });
              } else {
                page = id;
                if (id === 'heli') heli.reset(ch - 90);
              }
            }
          });
          // sidebar: featured let's player + scores
          const sx = gw + 10, sw = w - gw - 20;
          g.rect(sx, 20, sw, 300, '#120d18');
          g.stroke(sx, 20, sw, 300, '#3a2a4a');
          g.text('FEATURED LET\'S PLAYER', sx + sw / 2, 46, { align: 'center', size: 16, bold: true, color: C.purple });
          const over = g.over(sx + sw / 2 - 80, 60, 160, 170);
          drawDashie(g.ctx, sx + sw / 2, 150, over ? 72 : 66, g.t, yell > 0);
          if (g.hit('dashie', sx + sw / 2 - 80, 60, 160, 170)) dashie();
          g.text('DASHIE', sx + sw / 2, 258, { align: 'center', size: 34, font: HEAD, color: C.text });
          g.text(yell > 0 ? 'WHAAAAAT\'S UP' : g.touch ? 'tap to say hi' : 'click to say hi', sx + sw / 2, 290, { align: 'center', size: 15, color: yell > 0 ? C.amber : C.faint });
          g.rect(sx, 336, sw, ch - 356, '#120d18');
          g.stroke(sx, 336, sw, ch - 356, '#3a2a4a');
          g.text('HELI.swf HIGH SCORES', sx + sw / 2, 364, { align: 'center', size: 16, bold: true, color: C.purple });
          board().forEach(([n, s], i) => {
            const yy = 396 + i * 30;
            g.text(`${i + 1}. ${n}`, sx + 16, yy, { size: 16, bold: n === 'you', color: n === 'you' ? C.green : n === 'dashiexp' ? C.amber : C.text, max: sw - 90 });
            g.text(String(s), sx + sw - 16, yy, { size: 16, align: 'right', color: C.dim });
          });
        };
        if (page === 'home') {
          if (g.mobile) g.scrollArea('arcadeHome', 0, 0, w, ch, 600, () => home(600));
          else home(ch);
        } else if (page === 'heli') {
          const gw = w - 40, gh = ch - 90;
          const hold = (g.down && g.inputOK && g.over(20, 10, gw, gh)) || g.keys.some((k) => k.key === ' ');
          heli.hold = hold || (heli.hold && g.down);
          heli.update(dt, heli.hold, gw, gh);
          g.push(20, 10);
          g.clip(0, 0, gw, gh);
          heli.draw(g, gw, gh);
          g.unclip();
          g.pop();
          if (heli.state === 'dead') {
            if (!heli.paid) {
              heli.paid = true;
              const s = heli.score();
              const prev = heli.best;
              heli.best = Math.max(heli.best, s);
              heli.payout = s * 5;
              if (s >= 1000 && !heliPrizeClaimed) {
                heliPrizeClaimed = true;
                heli.payout += 10000;
                os.notify('PRIZE UNLOCKED', '$10,000 for breaking 1000', { app: 'arcade', color: C.amber });
              }
              if (s > DASHIE_SCORE && prev <= DASHIE_SCORE) {
                if (secret('dashieBeat')) os.notify('New #1 above dashiexp', 'he\'s going to be so mad', { app: 'arcade', color: C.purple });
                audio.dashie();
              }
              addMoney(heli.payout, 'arcade');
              audio.cash();
            }
            g.rect(20, gh / 2 - 60, gw, 120, 'rgba(0,0,0,0.7)');
            g.text(`CRASHED · ${heli.score()} · +${money(heli.payout)}`, w / 2, gh / 2 - 6, { align: 'center', size: 34, font: HEAD, color: '#fff' });
            if (g.button('heliagain', w / 2 - 110, gh / 2 + 14, 220, 40, 'AGAIN', { kind: 'primary' })) {
              heli.reset(gh);
              heli.paid = false;
            }
          }
          g.text(g.touch ? 'hold your finger on the screen to climb' : 'hold the mouse button (or space) to climb', 24, ch - 46, { size: 15, color: C.dim });
          g.text(`dashiexp: ${DASHIE_SCORE}`, w - 24, ch - 46, { size: 15, color: C.amber, align: 'right' });
        } else if (page === 'whack') {
          g.push(20, 10);
          whack.draw(g, w - 40, ch - 30, os);
          g.pop();
        }
        g.pop();
      },
    };
  },
};
