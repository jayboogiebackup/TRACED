import { audio } from '../core/audio.js';

// Bottom-of-screen dialog box, typewriter text, optional voice, choices.

const $ = (s) => document.querySelector(s);
const box = $('#dialog');
const elSpeaker = box.querySelector('.dlg-speaker');
const elText = box.querySelector('.dlg-text');
const elChoices = box.querySelector('.dlg-choices');
const elCaption = $('#caption');
const elHint = $('#hint');

let skip = null;
box.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (skip) skip();
});
window.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && skip && !box.classList.contains('hidden') && !box.classList.contains('has-choices')) {
    e.preventDefault();
    skip();
  }
});

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

// *word* → shaking text
function toNodes(text) {
  const parts = [];
  const re = /\*([^*]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index) });
    parts.push({ t: m[1], shake: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last) });
  return parts;
}

function typeInto(el, text, speed) {
  el.innerHTML = '';
  const parts = toNodes(text);
  const spans = parts.map((p) => {
    const s = document.createElement('span');
    if (p.shake) s.className = 'shake';
    el.appendChild(s);
    return s;
  });
  let pi = 0, ci = 0, cancelled = false;
  let resolveFn;
  const done = new Promise((r) => (resolveFn = r));
  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    parts.forEach((p, i) => (spans[i].innerHTML = escapeHtml(p.t)));
    resolveFn();
  };
  const step = () => {
    if (cancelled) return;
    if (pi >= parts.length) return finish();
    const p = parts[pi];
    ci++;
    spans[pi].innerHTML = escapeHtml(p.t.slice(0, ci));
    const ch = p.t[ci - 1];
    if (ch && ch !== ' ') audio.typeTick();
    if (ci >= p.t.length) {
      pi++;
      ci = 0;
    }
    let d = 1000 / speed;
    if (ch === '.' || ch === '?' || ch === '!') d *= 9;
    else if (ch === ',' || ch === '—' || ch === '…') d *= 5;
    setTimeout(step, d);
  };
  step();
  return { done, finish };
}

export const dialog = {
  active: false,

  // voice: 'caller' (phone voice), 'radio', 'none'
  say(speaker, text, o = {}) {
    return new Promise(async (resolve) => {
      this.active = true;
      box.classList.remove('hidden', 'done', 'has-choices');
      box.classList.toggle('no-click', !!o.auto);
      elChoices.innerHTML = '';
      elSpeaker.textContent = speaker || '';
      elSpeaker.classList.toggle('danger', !!o.danger);

      const typing = typeInto(elText, text, o.speed ?? 34);
      let voiceDone = Promise.resolve();
      if (o.voice === 'caller') {
        voiceDone = audio.speak(text, { pitch: o.pitch, rate: o.rate }).then((spoke) => {
          if (!spoke) return new Promise((r) => setTimeout(r, audio.babble(text) * 1000));
        });
      } else if (o.voice === 'radio') {
        audio.radio(text);
      } else if (o.voice === 'female') {
        voiceDone = audio.speak(text, { female: true, pitch: 0.9, rate: 0.95 });
      }

      skip = () => typing.finish();
      await typing.done;
      box.classList.add('done');

      const close = () => {
        skip = null;
        audio.stopSpeaking();
        if (!o.keep) this.hide();
        resolve();
      };
      if (o.auto !== undefined) {
        await Promise.race([Promise.all([voiceDone, new Promise((r) => setTimeout(r, o.auto * 1000))]), new Promise((r) => (skip = r))]);
        close();
      } else {
        skip = close;
      }
    });
  },

  choose(speaker, text, choices, o = {}) {
    return new Promise(async (resolve) => {
      this.active = true;
      box.classList.remove('hidden', 'done', 'no-click');
      box.classList.add('has-choices');
      elSpeaker.textContent = speaker || '';
      elSpeaker.classList.toggle('danger', !!o.danger);
      elChoices.innerHTML = '';
      const typing = typeInto(elText, text, o.speed ?? 34);
      if (o.voice === 'caller') audio.speak(text).then((ok) => !ok && audio.babble(text));
      skip = () => typing.finish();
      await typing.done;
      skip = null;
      choices.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'dlg-choice';
        d.textContent = c;
        d.addEventListener('pointerenter', () => audio.hover());
        d.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          audio.click();
          audio.stopSpeaking();
          this.hide();
          resolve(i);
        });
        elChoices.appendChild(d);
      });
    });
  },

  // show a box whose text you update yourself (rotary dial)
  show(speaker, text) {
    box.classList.remove('hidden', 'done', 'has-choices');
    box.classList.add('no-click');
    elChoices.innerHTML = '';
    elSpeaker.textContent = speaker;
    elSpeaker.classList.remove('danger');
    elText.textContent = text;
    this.active = true;
  },
  set(text) {
    elText.textContent = text;
  },

  hide() {
    box.classList.add('hidden');
    box.classList.remove('no-click');
    this.active = false;
    skip = null;
  },
};

let capTimer = null;
export function caption(text, seconds = 3) {
  elCaption.textContent = text;
  elCaption.classList.add('show');
  clearTimeout(capTimer);
  if (seconds > 0) capTimer = setTimeout(() => elCaption.classList.remove('show'), seconds * 1000);
}
export function hideCaption() {
  elCaption.classList.remove('show');
}

export function hint(text) {
  elHint.textContent = text || '';
  elHint.style.opacity = text ? 1 : 0;
}

export function toast(title, sub = '', seconds = 4) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${escapeHtml(title)}${sub ? `<small>${escapeHtml(sub)}</small>` : ''}`;
  document.querySelector('#toasts').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 600);
  }, seconds * 1000);
}

const fadeEl = document.querySelector('#fade');
export function fade(to, seconds = 1) {
  fadeEl.style.transition = `opacity ${seconds}s ease`;
  fadeEl.style.opacity = to;
  return new Promise((r) => setTimeout(r, seconds * 1000));
}
