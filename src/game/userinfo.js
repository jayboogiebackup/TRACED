// What any website can learn about you without asking.
// Everything here is read locally from browser APIs and is never sent anywhere —
// the game only says it back to you, which is the point.

export const info = {
  os: 'your computer',
  browser: 'your browser',
  time: '',
  hour: 0,
  weekday: '',
  city: '',
  tz: '',
  lang: '',
  screen: '',
  cores: 0,
  memory: 0,
  gpu: '',
  battery: null,
  charging: null,
  dnt: false,
  dark: false,
  touch: false,
};

export async function gatherInfo() {
  const ua = navigator.userAgent;
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/iphone|ipad|ipod/i.test(ua)) info.os = /ipad/i.test(ua) ? 'an iPad' : 'an iPhone';
  else if (/android/i.test(ua)) info.os = 'Android';
  else if (/win/i.test(plat) || /windows/i.test(ua)) info.os = 'Windows';
  else if (/mac/i.test(plat)) info.os = 'a Mac';
  else if (/cros/i.test(ua)) info.os = 'a Chromebook';
  else if (/linux/i.test(plat)) info.os = 'Linux';

  if (/edg\//i.test(ua)) info.browser = 'Edge';
  else if (/opr\//i.test(ua)) info.browser = 'Opera';
  else if (/firefox/i.test(ua)) info.browser = 'Firefox';
  else if (/chrome/i.test(ua)) info.browser = 'Chrome';
  else if (/safari/i.test(ua)) info.browser = 'Safari';

  refreshTime();
  try {
    info.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const last = info.tz.split('/').pop() || '';
    info.city = last.replace(/_/g, ' ');
  } catch (e) {
    /* ignore */
  }
  info.lang = navigator.language || '';
  info.screen = `${screen.width}×${screen.height}`;
  info.cores = navigator.hardwareConcurrency || 0;
  info.memory = navigator.deviceMemory || 0;
  info.dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  info.dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  info.touch = navigator.maxTouchPoints > 0;

  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      let g = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
      // "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 ...)" → "NVIDIA GeForce RTX 3070"
      const m = g.match(/ANGLE \([^,]+,\s*([^,(]+?)(?:\s+Direct3D|\s+\(|,|$)/);
      if (m) g = m[1];
      g = g.replace(/\s*\(0x[0-9a-f]+\)/gi, '').trim();
      if (g && !/swiftshader|llvmpipe|basic render/i.test(g)) info.gpu = g;
    }
  } catch (e) {
    /* ignore */
  }

  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      info.battery = Math.round(b.level * 100);
      info.charging = b.charging;
    }
  } catch (e) {
    /* ignore */
  }
  return info;
}

export function refreshTime() {
  const d = new Date();
  info.time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  info.hour = d.getHours();
  info.weekday = d.toLocaleDateString([], { weekday: 'long' });
  return info.time;
}

export function partOfDay() {
  const h = info.hour;
  if (h < 5) return 'the middle of the night';
  if (h < 12) return 'morning';
  if (h < 17) return 'the afternoon';
  if (h < 21) return 'evening';
  return 'late';
}
