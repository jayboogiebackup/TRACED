import { C, FONT, HEAD, TYPE, money } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, emit } from '../../game/state.js';

export const ORGANS = [
  { id: 'kidneyL', name: 'Kidney (left)', price: 28000, note: 'You have a spare. Probably.' },
  { id: 'kidneyR', name: 'Kidney (right)', price: 28000, note: 'Your LAST kidney if the other is gone.', danger: (o) => o.kidneyL },
  { id: 'liver', name: 'Liver (half)', price: 64000, note: 'It grows back. Mostly. Don\'t drink.' },
  { id: 'corneaL', name: 'Cornea (left eye)', price: 18000, note: 'Who needs depth perception.' },
  { id: 'corneaR', name: 'Cornea (right eye)', price: 18000, note: 'You will not be able to see.', danger: (o) => o.corneaL },
  { id: 'lung', name: 'Lung', price: 92000, note: 'You\'ll be a little out of breath.' },
  { id: 'marrow', name: 'Bone Marrow', price: 9000, note: 'A really big needle. In your hip.' },
  { id: 'blood', name: 'Blood (1 pint)', price: 420, note: 'Renewable! Sort of. 20 sec cooldown.', repeat: true },
  { id: 'heart', name: 'Heart', price: 1000000, note: 'Exactly what you need. Final sale.', hidden: true },
];

function drawOrgan(ctx, id, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ff9a9a';
  ctx.fillStyle = 'rgba(255,90,90,0.18)';
  ctx.beginPath();
  if (id.startsWith('kidney')) {
    ctx.moveTo(4, -26);
    ctx.bezierCurveTo(-34, -30, -34, 30, 4, 26);
    ctx.bezierCurveTo(20, 24, 22, 10, 10, 5);
    ctx.bezierCurveTo(3, 1, 3, -1, 10, -5);
    ctx.bezierCurveTo(22, -10, 20, -24, 4, -26);
  } else if (id === 'liver') {
    ctx.moveTo(-34, -8);
    ctx.bezierCurveTo(-30, -26, 20, -28, 34, -18);
    ctx.bezierCurveTo(30, 0, 10, 22, -10, 20);
    ctx.bezierCurveTo(-28, 18, -36, 6, -34, -8);
  } else if (id.startsWith('cornea')) {
    ctx.ellipse(0, 0, 32, 18, 0, 0, Math.PI * 2);
    ctx.moveTo(14, 0);
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
  } else if (id === 'lung') {
    ctx.moveTo(-4, -26);
    ctx.bezierCurveTo(-30, -20, -34, 26, -8, 26);
    ctx.bezierCurveTo(-2, 26, -4, 0, -4, -26);
    ctx.moveTo(4, -26);
    ctx.bezierCurveTo(30, -20, 34, 26, 8, 26);
    ctx.bezierCurveTo(2, 26, 4, 0, 4, -26);
  } else if (id === 'marrow') {
    ctx.roundRect(-30, -8, 60, 16, 8);
    ctx.moveTo(-30, -12);
    ctx.arc(-30, -12, 8, 0, Math.PI * 2);
    ctx.moveTo(-22, 12);
    ctx.arc(-30, 12, 8, 0, Math.PI * 2);
    ctx.moveTo(38, -12);
    ctx.arc(30, -12, 8, 0, Math.PI * 2);
    ctx.moveTo(38, 12);
    ctx.arc(30, 12, 8, 0, Math.PI * 2);
  } else if (id === 'blood') {
    ctx.moveTo(0, -28);
    ctx.bezierCurveTo(20, -4, 22, 8, 22, 12);
    ctx.arc(0, 12, 22, 0, Math.PI);
    ctx.bezierCurveTo(-22, 8, -20, -4, 0, -28);
  } else {
    const b = 1 + Math.max(0, Math.sin(t * 7)) * 0.06;
    ctx.scale(b, b);
    ctx.moveTo(0, 26);
    ctx.bezierCurveTo(-40, 0, -26, -32, 0, -14);
    ctx.bezierCurveTo(26, -32, 40, 0, 0, 26);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export const Organs = {
  title: 'BODY//MARKET — discreet. sterile-ish.',
  label: 'Body Market',
  icon: 'organs',
  w: 960,
  h: 660,
  create(os) {
    let bloodCd = 0;
    return {
      tick(dt) {
        bloodCd = Math.max(0, bloodCd - dt);
      },
      draw(g, w, h) {
        const o = G.organs;
        g.rect(0, 0, w, 64, '#160b0b');
        g.text('BODY//MARKET', 20, 46, { size: 46, font: HEAD, color: '#ff8a8a' });
        g.text('doctors on call 24/7 · ice bath included', 280, 42, { size: 15, color: C.dim });
        g.text(money(G.money), w - 20, 42, { size: 22, bold: true, align: 'right', color: C.green });
        const soldCount = ORGANS.filter((x) => !x.repeat && x.id !== 'heart' && o[x.id]).length;
        const list = ORGANS.filter((x) => !x.hidden || soldCount >= 3);
        const cols = g.mobile ? 2 : 3, cw = (w - 40) / cols, chh = g.mobile ? 160 : 176;
        g.scrollArea('organs', 0, 70, w, h - 70, Math.ceil(list.length / cols) * (chh + 12) + 20, (aw) => {
          list.forEach((it, i) => {
            const x = 14 + (i % cols) * ((aw - 14) / cols), y = 10 + Math.floor(i / cols) * (chh + 12);
            const cwid = (aw - 14) / cols - 12;
            const sold = !it.repeat && o[it.id];
            const heart = it.id === 'heart';
            g.rect(x, y, cwid, chh, heart ? '#2a0c0c' : '#151112');
            g.stroke(x, y, cwid, chh, heart ? C.red : '#3a2626', heart ? 2 : 1);
            g.ctx.globalAlpha = sold ? 0.3 : 1;
            drawOrgan(g.ctx, it.id, x + 60, y + 66, 1.1, g.t);
            g.text(it.name, x + 120, y + 40, { size: 18, bold: true, max: cwid - 130 });
            g.text(money(it.price), x + 120, y + 70, { size: 24, bold: true, font: FONT, color: heart ? C.red : C.green });
            g.para(it.note, x + 120, y + 96, cwid - 130, { size: 13, color: C.dim });
            g.ctx.globalAlpha = 1;
            if (sold) {
              g.ctx.save();
              g.ctx.translate(x + cwid / 2, y + chh / 2);
              g.ctx.rotate(-0.2);
              g.text('SOLD', 0, 0, { align: 'center', base: 'middle', size: 54, font: HEAD, color: 'rgba(255,92,92,0.75)' });
              g.ctx.restore();
              return;
            }
            const cd = it.repeat && bloodCd > 0;
            const label = cd ? `wait ${Math.ceil(bloodCd)}s` : it.repeat ? `DRAW (${o.blood} sold)` : 'SELL';
            if (g.button('sell' + it.id, x + 14, y + chh - 50, cwid - 28, 38, label, { kind: heart || (it.danger && it.danger(o)) ? 'danger' : 'primary', disabled: cd })) {
              const go = () => {
                if (it.repeat) bloodCd = 20;
                emit('organ', it);
              };
              if (heart) {
                os.modal({
                  title: 'FINAL SALE',
                  danger: true,
                  body: 'You understand that you need this one.\n\nThe buyer is waiting. $1,000,000. Exactly what you need. You just won\'t be around to send it.',
                  buttons: [{ label: 'no.' }, { label: 'SELL MY HEART', kind: 'danger', fn: go }],
                });
              } else if (it.danger && it.danger(o)) {
                os.modal({
                  title: 'Are you sure?',
                  danger: true,
                  body: it.id === 'kidneyR' ? 'That is your last kidney. People need at least one.' : 'That is your last working eye.',
                  buttons: [{ label: 'cancel' }, { label: 'do it', kind: 'danger', fn: go }],
                });
              } else go();
            }
          });
        });
      },
    };
  },
};
