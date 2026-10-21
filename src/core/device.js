// What kind of device we're on. Phones get their own UI (a phone-sized laptop OS,
// touch controls, a rotate prompt); tablets keep the desktop OS but with touch controls.

const coarse = window.matchMedia ? matchMedia('(pointer: coarse)').matches : false;
const touch = coarse || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
const shortSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);

export const device = {
  touch,
  phone: touch && shortSide < 600,
  get portrait() {
    return innerHeight > innerWidth;
  },
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  // a light buzz in your hand (Android; iOS ignores it)
  vibrate(pattern) {
    try {
      if (touch && navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {
      /* not allowed yet */
    }
  },
};

document.documentElement.classList.toggle('touch', device.touch);
document.documentElement.classList.toggle('phone', device.phone);
