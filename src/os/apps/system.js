import { C, FONT, HEAD, TYPE, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, addMoney, emit, addHeat, secret, scannerLog } from '../../game/state.js';
import { info, refreshTime } from '../../game/userinfo.js';

export const FILES = {
  'README.txt': `HOW TO NOT GO TO PRISON
(a guide, written at 3am)

1.  BITMINER — click the coin. Hardware mines for you.
2.  RIGMART — buy hardware. Buy fans so it doesn't cook.
3.  Everything else is faster money:
      casino · selling organs · Chirp · FlashBang · St0nks
      the Velvet Road · DataMart
    ...but most of it makes NOISE. Noise brings the police.
4.  SAFE//NET slows them down. Get the VPN first.
5.  Watch the POLICE meter on the taskbar.
6.  When you have $1,000,000 — open MESSAGES and hit SEND.

Scroll the mouse wheel to lean back from the laptop.
Hold right-click to look around the basement.

And never sign in with Google. Never scan your face.
Never upload your ID. Not here. Not anywhere.`,
  'passwords.txt': `email:     password123
bank:      password1234
netflix:   password123!
work:      Password123
wifi:      hunter2

(note to self: make better passwords)
(note to self from later: too late)`,
  'todo.txt': `[ ] pay rent
[ ] call mom back
[ ] stop answering unknown numbers
[x] answer unknown number`,
  'diary.txt': `oct 3
someone tried to log into my email from another country. changed the password to password1234. should be fine.

oct 9
got a text saying I won a cruise. clicked it. didn't win a cruise.

oct 14
the webcam light came on by itself again. probably a driver thing.

oct 20
heard footsteps upstairs. I live alone.

oct 21
the phone is ringing.`,
  '.they_see_you': `you found the hidden file.

they found it too.
a long time ago.`,
  'evidence.zip': `[archive is password protected]

hint: it's the wifi password.`,
};

// generic text viewer
export const Notepad = {
  title: 'Notepad',
  label: 'Notepad',
  icon: 'readme',
  hidden: true,
  w: 700,
  h: 560,
  create(os) {
    const api = {
      file: 'README.txt',
      get title() {
        return api.file + ' — Notepad';
      },
      draw(g, w, h) {
        g.rect(0, 0, w, h, '#14130f');
        const text = FILES[api.file] || '';
        const hh = g.para(text, 0, 0, w - 60, { size: 17, font: FONT, measure: true }) + 40;
        g.scrollArea('np' + api.file, 0, 0, w, h, hh, (aw) => {
          g.para(text, 24, 34, aw - 40, { size: 17, font: FONT, color: '#e4dcc4' });
        });
      },
    };
    return api;
  },
};

export const Files = {
  title: 'Files',
  label: 'Files',
  icon: 'files',
  w: 720,
  h: 500,
  create(os) {
    let folder = 'Documents';
    const tree = {
      Documents: ['README.txt', 'passwords.txt', 'todo.txt', 'diary.txt'],
      Pictures: ['IMG_0001.jpg', 'cat.jpg'],
      'Recycle Bin': ['evidence.zip'],
    };
    let showHidden = false;
    return {
      draw(g, w, h) {
        const lw = 190;
        g.rect(0, 0, lw, h, '#0d1112');
        Object.keys(tree).forEach((f, i) => {
          const y = 14 + i * 44;
          if (g.hit('fold' + f, 8, y, lw - 16, 38)) folder = f;
          g.rect(8, y, lw - 16, 38, folder === f ? '#1a2224' : g.over(8, y, lw - 16, 38) ? '#141a1b' : '#0d1112');
          g.text((f === 'Recycle Bin' ? '🗑 ' : '📁 ') + f, 20, y + 25, { size: 16, bold: folder === f });
        });
        if (g.button('hid', 12, h - 50, lw - 24, 34, showHidden ? 'hide hidden' : 'show hidden', { size: 14 })) showHidden = !showHidden;
        const files = tree[folder].concat(showHidden && folder === 'Documents' ? ['.they_see_you'] : []);
        files.forEach((f, i) => {
          const x = lw + 24 + (i % 4) * 124, y = 20 + Math.floor(i / 4) * 130;
          const over = g.over(x, y, 112, 118);
          if (over) g.rrect(x, y, 112, 118, 6, 'rgba(255,255,255,0.06)');
          const img = f.endsWith('.jpg');
          g.text(img ? '🖼' : f.endsWith('.zip') ? '🗜' : '📄', x + 56, y + 52, { align: 'center', base: 'middle', size: 48, font: 'Arial' });
          g.text(f, x + 56, y + 102, { align: 'center', size: 14, max: 110, color: f.startsWith('.') ? C.red : C.text });
          if (g.hit('file' + f, x, y, 112, 118)) {
            if (f === 'IMG_0001.jpg') os.open('photo');
            else if (f === 'cat.jpg') os.modal({ title: 'cat.jpg', body: 'This file is corrupted.\n\n(the cat is fine. the cat is outside. the cat is the only one of us who is fine.)', buttons: [{ label: 'ok' }] });
            else {
              const np = os.app('notepad');
              np.file = f;
              const win = os.windows.find((ww) => ww.id === 'notepad');
              if (win) os.focus(win);
              else os.open('notepad');
              if (f === '.they_see_you') audio.whisper({ gain: 0.1 });
            }
          }
        });
      },
    };
  },
};

// IMG_0001.jpg — a photo of you, from behind, taken just now
export const Photo = {
  title: 'IMG_0001.jpg',
  label: 'Photo',
  icon: 'photo',
  hidden: true,
  w: 880,
  h: 620,
  create(os) {
    let img = null;
    let opened = 0;
    return {
      onOpen() {
        img = os.takePhoto ? os.takePhoto() : null;
        opened = 0;
        secret('photo');
        audio.stinger(0.18);
        emit('photo');
      },
      draw(g, w, h, dt) {
        opened += dt;
        g.rect(0, 0, w, h, '#000');
        if (img) {
          const k = Math.min(w / img.width, (h - 40) / img.height);
          const iw = img.width * k, ih = img.height * k;
          g.ctx.globalAlpha = Math.min(1, opened * 0.8);
          g.ctx.drawImage(img, (w - iw) / 2, (h - 40 - ih) / 2, iw, ih);
          g.ctx.globalAlpha = 1;
        }
        const d = new Date();
        g.text(`IMG_0001.jpg   ·   taken ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}   ·   camera: unknown device`, 16, h - 14, { size: 14, color: C.dim });
      },
    };
  },
};

// ── TERMINAL
export const Terminal = {
  title: 'terminal',
  label: 'Terminal',
  icon: 'terminal',
  w: 820,
  h: 520,
  create(os) {
    const lines = [
      { s: 'GH0ST//OS shell — type "help"', c: C.dim },
      { s: '' },
    ];
    let input = '';
    const history = [];
    let matrix = 0;
    const drops = Array.from({ length: 60 }, () => Math.random() * -40);
    const used = {};
    const out = (s, c) => s.split('\n').forEach((l) => lines.push({ s: l, c }));

    function run(cmd) {
      const raw = cmd.trim();
      if (!raw) return;
      history.push(raw);
      lines.push({ s: '> ' + raw, c: C.green });
      const [c, ...args] = raw.split(/\s+/);
      const arg = args.join(' ');
      switch (c.toLowerCase()) {
        case 'help':
          out('ls [-a]    list files\ncat FILE   read a file\nwhoami     who are you\nneofetch   system info\ndate       what time is it\nmatrix     (you know)\nclear      clear the screen\nexit       close terminal\n\nthere are other commands. there always are.', C.text);
          break;
        case 'ls':
          out((arg.includes('-a') ? '.they_see_you  ' : '') + 'README.txt  passwords.txt  todo.txt  diary.txt  evidence.zip', C.text);
          break;
        case 'cat': {
          const f = FILES[arg];
          if (f) out(f, C.text);
          else out(`cat: ${arg || '???'}: no such file`, C.red);
          if (arg === '.they_see_you') audio.whisper({ gain: 0.1 });
          break;
        }
        case 'whoami':
          out(`you. on ${info.os}, ${info.browser}, in ${info.tz || 'somewhere'}.\nyou are also: a product.`, C.text);
          break;
        case 'neofetch':
          out(
            `   ▄▄▄▄▄        you@basement\n  █ ▄ ▄ █       -----------\n  █     █       OS: ${info.os} (pretending to be GH0ST//OS)\n  █ ▀▀▀ █       Browser: ${info.browser}\n   ▀▀▀▀▀        Screen: ${info.screen}\n                CPU threads: ${info.cores || '?'}\n                GPU: ${info.gpu || 'hidden'}\n                Battery: ${info.battery != null ? info.battery + '%' : 'hidden'}\n                Time zone: ${info.tz || '?'}`,
            C.text,
          );
          break;
        case 'date':
          refreshTime();
          out(new Date().toString(), C.text);
          break;
        case 'clear':
          lines.length = 0;
          break;
        case 'exit': {
          const w = os.windows.find((x) => x.id === 'terminal');
          if (w) os.close(w);
          break;
        }
        case 'matrix':
          matrix = 6;
          break;
        case 'sudo':
          out('you are not in the sudoers file. this incident will be reported.', C.red);
          scannerLog('Automated report: privilege escalation attempt on suspect device.', 'bad');
          addHeat(0.5);
          break;
        case 'rm':
          if (arg.includes('-rf')) out('deleting everything...\n\n...just kidding. that\'s how they get you.', C.amber);
          else out('rm: missing operand', C.red);
          break;
        case 'ping':
          out(`PING ${arg || 'localhost'}: 64 bytes, time=13ms\nPING ${arg || 'localhost'}: 64 bytes, time=12ms\n(someone else is pinging you back)`, C.text);
          break;
        case 'hack':
          out('hack what. try DATAMART. this isn\'t a movie.', C.text);
          break;
        case 'motherlode':
          if (used.motherlode) out('nice try.', C.dim);
          else {
            used.motherlode = true;
            addMoney(50000, 'cheat');
            addHeat(5, 'Suspicious $50,000 deposit flagged by bank AI.');
            secret('motherlode');
            audio.cash(true);
            out('+$50,000. the IRS would like a word.', C.amber);
          }
          break;
        case 'rosebud':
          if (used.rosebud) out(';;;;;;;;;;', C.dim);
          else {
            used.rosebud = true;
            addMoney(1000, 'cheat');
            audio.cash();
            out('+$1,000. classic.', C.amber);
          }
          break;
        case 'hunter2':
          if (secret('hunter2')) os.notify('*******', 'you typed the wifi password', { color: C.purple });
          out('*******', C.text);
          break;
        case 'dashie':
          audio.dashie();
          if (secret('dashie')) os.notify('WHAAAAAT\'S UP', 'it\'s Dashie.', { color: C.purple, silent: true });
          out('WHAAAAAAAAAAAT\'S UP', C.amber);
          break;
        case 'unzip':
          if (arg.includes('hunter2')) out('evidence.zip: 1 file\n  ghostwire_real_name.txt → "you don\'t get to know that. nobody does."', C.amber);
          else out('unzip: password required. usage: unzip evidence.zip PASSWORD', C.red);
          break;
        case 'whois':
          if (/ghost/i.test(arg)) out('GHOSTWIRE\n  wanted in 14 countries\n  last seen: on the other end of your phone line\n  known for: buying leaked data in bulk, then calling', C.red);
          else out('whois: who is anyone, really', C.dim);
          break;
        case '911':
        case 'call':
          out('you\'d need a phone for that. there\'s one on the desk.', C.dim);
          break;
        case 'konami':
          out('you have to actually type it. on the keyboard. ↑↑↓↓←→←→BA', C.dim);
          break;
        case 'history':
          out(history.join('\n'), C.text);
          break;
        case 'balance':
        case 'money':
          out(money(G.money), C.green);
          break;
        case 'shutdown':
          emit('shutdown');
          break;
        default:
          out(`${c}: command not found`, C.red);
      }
      while (lines.length > 300) lines.shift();
    }

    return {
      draw(g, w, h, dt) {
        g.rect(0, 0, w, h, '#050806');
        if (matrix > 0) {
          matrix -= dt;
          g.ctx.globalAlpha = Math.min(1, matrix);
          drops.forEach((d, i) => {
            drops[i] += dt * 18;
            if (drops[i] * 18 > h + 200) drops[i] = Math.random() * -20;
            for (let k = 0; k < 12; k++) {
              const ch = String.fromCharCode(0x30a0 + ((Math.random() * 96) | 0));
              g.text(ch, i * 14, (drops[i] - k) * 18, { size: 16, color: k === 0 ? '#dfffe6' : `rgba(92,240,138,${1 - k / 12})` });
            }
          });
          g.ctx.globalAlpha = 1;
        }
        // input
        const lh = 22;
        const r = g.input('termin', 0, h - 40, w, 40, input, { placeholder: 'type a command…' });
        if (!g.focus && os.isOpen('terminal') && os.windows.at(-1)?.id === 'terminal') g.focus = 'termin';
        input = r.value;
        if (r.submit) {
          run(input);
          input = '';
          audio.key();
        }
        const shown = lines.slice(-Math.floor((h - 52) / lh));
        shown.forEach((l, i) => g.text(l.s, 14, 26 + i * lh, { size: 17, color: l.c || C.text, font: FONT }));
      },
    };
  },
};
