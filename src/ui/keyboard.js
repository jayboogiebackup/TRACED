// Touch devices: text fields on the laptop are drawn on a canvas, which can't summon the
// phone's keyboard. A hidden real <input> stands in for whichever field has focus.

export function createKeyboard() {
  const el = document.createElement('input');
  el.id = 'kbd';
  el.type = 'text';
  el.autocomplete = 'off';
  el.autocapitalize = 'off';
  el.spellcheck = false;
  el.setAttribute('enterkeyhint', 'send');
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);

  const k = {
    id: null,
    value: '',
    lastOut: null,
    submitted: false,
    max: 200,
    bind(id, value, max) {
      k.id = id;
      k.max = max;
      k.set(value);
      k.lastOut = value;
    },
    set(v) {
      k.value = v;
      el.value = v;
    },
    unbind() {
      k.id = null;
      if (document.activeElement === el) el.blur();
    },
    // must run inside a tap handler, or phones refuse to open the keyboard
    focus() {
      if (k.id && document.activeElement !== el) el.focus({ preventScroll: true });
    },
  };
  el.addEventListener('input', () => {
    if (el.value.length > k.max) el.value = el.value.slice(0, k.max);
    k.value = el.value;
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      k.submitted = true;
    }
    // keep these keys away from the game's own keyboard shortcuts
    e.stopPropagation();
  });
  return k;
}
