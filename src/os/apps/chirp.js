import { C, FONT, HEAD, money, short } from '../gui.js';
import { audio } from '../../core/audio.js';
import { G, addMoney, spend, emit, addHeat, secret } from '../../game/state.js';
import { info } from '../../game/userinfo.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

const PLAIN = [
  'gm',
  'anyone else up at 3am staring at charts',
  'just mined my first block. we are so back',
  'the system is rigged and I am the rig',
  'hot take: sleep is a psyop',
  'rate my setup: one laptop, one basement, zero windows',
  'buying a lambo with money I don\'t have yet 🏎️',
  'if you\'re reading this it\'s not too late (it is)',
  'new personal record: 0 hours of sleep',
  'my landlord thinks I\'m a "digital entrepreneur" 💼',
];
const HYPE = [
  'gm. {c} is going to the moon 🚀🚀🚀',
  'not financial advice but {c} 100x incoming',
  'just bought more {c}. diamond hands 💎🙌',
  'if you\'re not in {c} by tonight you\'re ngmi',
  '{c} devs are cooking. wagmi 🔥',
  'they laughed at me. now look at {c} 📈📈',
  'elon just followed me. {c}. that\'s the tweet',
  '{c} to $1. I have done the math (I have not)',
];
const KEYWORDS = ['moon', '🚀', '100x', 'lambo', 'wagmi', 'gm', 'hodl', 'pump', 'elon', 'ape', 'diamond', '💎', 'bull', 'ngmi', 'send it', 'giveaway', 'free', '$rug', 'crypto', 'nft', 'ai'];

const NPCS = [
  ['moonboi_88', 'moon boi', () => '$DOGG to $1 by friday. screenshot this.'],
  ['sat0shi_jr', 'satoshi jr.', () => 'just lost my house on 100x leverage. buying the dip.'],
  ['crypto_karen', 'Karen 🌸', () => 'can someone explain bitcoin to me in one tweet. my son says it\'s "a vibe"'],
  ['gainz_guru', 'GAINZ GURU', () => 'I made $40k this morning. my course is $999. link in bio.'],
  ['mom_1961', 'Mom', () => pick(['how do I post on here. is this private', 'Call me back honey', 'Did you eat today'])],
  ['BreakingNewz', 'Breaking Newz', () => pick(['FBI hunts "GHOSTWIRE", hacker behind the largest data leak in history', 'Dark web data dumps now cost less than a coffee, experts warn', 'Report: 9 in 10 people have had their data leaked at least once'])],
  ['DashieXP', 'Dashie', () => pick(['WHAAAAAAT\'S UP everybody it\'s DASHIE and today we\'re playing HELI.swf', 'whoever keeps beating my heli score on flashbang. i see you.'])],
  ['lowtaxlarry', 'Larry', () => 'remember when the internet was just flash games and forums. we were happy'],
];

export const Chirp = {
  title: 'Chirp',
  label: 'Chirp',
  icon: 'chirp',
  w: 1000,
  h: 690,
  create(os) {
    const handle = 'anon' + ((Math.random() * 9000 + 1000) | 0);
    const S = {
      followers: 14,
      posts: [],
      drafts: [],
      text: '',
      cd: 0,
      npcT: 3,
      sponsor: null,
      coin: { launched: false, price: 0.0005, tokens: 10_000_000, hist: [], pulled: false },
    };
    G.chirp = S;

    const coinTag = () => (S.coin.launched && !S.coin.pulled ? '$RUG' : null);
    function makeDrafts() {
      S.drafts = [0, 1, 2].map((i) => {
        const c = coinTag();
        if (c && i < 2) return pick(HYPE).replace('{c}', c);
        return pick(PLAIN);
      });
    }
    makeDrafts();

    function npcPost() {
      const pd = G.heat > 20;
      let p;
      if (pd && Math.random() < 0.3) {
        const city = info.city || 'your';
        p = {
          who: 'Metro Police Dept.',
          h: 'MetroPD',
          verified: true,
          text:
            G.heat > 65
              ? `Units are closing in on a residential address in the ${city} area. Suspect believed to be hiding in a basement. Stay indoors.`
              : G.heat > 40
                ? `We are tracing a phone call connected to a wanted cyber criminal. ${city} residents: check your locks.`
                : `Officers responding to a cyber incident in the ${city} area. Please stay off the roads.`,
        };
      } else if (G.heat > 40 && Math.random() < 0.15) {
        p = { who: 'gh0stwire', h: 'gh0stwire', text: pick(['tick tock', 'I can see your screen, you know', `nice ${info.os} you got there`, 'they\'re close. are you?']) };
      } else {
        const [h, who, fn] = pick(NPCS);
        p = { who, h, text: fn(), verified: h === 'BreakingNewz' || h === 'DashieXP' };
      }
      p.likes = (Math.random() * 400) | 0;
      S.posts.unshift(p);
      if (S.posts.length > 50) S.posts.pop();
    }
    for (let i = 0; i < 6; i++) npcPost();

    function hypeScore(t) {
      const s = t.toLowerCase();
      let n = 0;
      for (const k of KEYWORDS) if (s.includes(k)) n++;
      return n;
    }

    function post(text) {
      if (S.cd > 0 || !text.trim()) return;
      let shown = text.trim().slice(0, 180);
      const lower = shown.toLowerCase();
      if (lower.includes('hunter2')) {
        shown = shown.replace(/hunter2/gi, '*******');
        if (secret('hunter2')) os.notify('*******', 'your password shows as stars to everyone else. (it doesn\'t.)', { color: C.purple });
      }
      S.cd = 3.5;
      G.stats.tweets++;
      const hype = hypeScore(shown);
      let gain = Math.round((4 + hype * 7) * Math.pow(1 + S.followers / 300, 0.82) * rand(0.6, 1.4));
      let viral = Math.random() < 0.06 + hype * 0.01;
      if (viral) gain *= 8;
      S.followers += gain;
      const mine = { who: 'you', h: handle, text: shown, mine: true, likes: Math.round(gain * rand(2, 6)), viral };
      S.posts.unshift(mine);
      audio.blip(1400, 0.04, 0.05);
      if (viral) {
        os.notify('You went viral 🔥', `+${short(gain)} followers`, { app: 'chirp', color: C.blue });
        audio.win(1);
      }
      // $RUG pump
      if (S.coin.launched && !S.coin.pulled && /\$rug/i.test(shown)) {
        const k = 0.05 + Math.min(0.65, S.followers / 22000) * rand(0.6, 1.4) * (viral ? 2 : 1);
        S.coin.price *= 1 + k;
        mine.text += `   📈 $RUG +${Math.round(k * 100)}%`;
      }
      // sponsorship money
      if (S.sponsor) {
        addMoney(S.sponsor.per, 'chirp');
        audio.cash();
        os.notify('Sponsored post', `+${money(S.sponsor.per)} from @${S.sponsor.who}`, { app: 'chirp', color: C.green, silent: true });
        if (--S.sponsor.left <= 0) S.sponsor = null;
      } else if (S.followers > 250 && Math.random() < 0.35) {
        const who = pick(['LuckyStrikeCasino', 'VOLTenergy', 'NordShieldVPN', 'RigMartDeals', 'FlashBangGames']);
        const per = Math.round(S.followers * rand(0.5, 0.9));
        os.modal({
          title: 'Sponsorship offer',
          body: `@${who} wants to sponsor your next 5 posts.\n\n${money(per)} per post.`,
          buttons: [{ label: 'decline' }, { label: 'ACCEPT', kind: 'primary', fn: () => (S.sponsor = { who, per, left: 5 }) }],
        });
      }
      // replies
      if (/dashie/i.test(shown)) {
        setTimeout(() => {
          S.posts.unshift({ who: 'Dashie', h: 'DashieXP', verified: true, text: `@${handle} WHAAAAAAAT'S UP`, likes: 9001 });
          audio.dashie();
          secret('dashie');
        }, 1200);
      }
      if (/\b(police|cops|help|911)\b/i.test(shown)) {
        setTimeout(() => {
          S.posts.unshift({ who: 'Metro Police Dept.', h: 'MetroPD', verified: true, text: `@${handle} We see you. Help is on the way 🙂`, likes: 2 });
          addHeat(3, 'Social media post flagged near suspect location.');
          audio.creepyNotify();
        }, 1500);
      }
      if (/\d+\s+\w+\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd)\b/i.test(shown) || /my address/i.test(shown)) {
        setTimeout(() => {
          addHeat(12, 'Suspect posted a home address publicly. Units diverted.');
          emit('trap', 'doxx-self');
        }, 800);
      }
      makeDrafts();
    }

    return {
      get badge() {
        return 0;
      },
      tick(dt) {
        S.cd = Math.max(0, S.cd - dt);
        S.npcT -= dt;
        if (S.npcT <= 0) {
          S.npcT = rand(5, 11);
          npcPost();
        }
        // creator fund trickle
        if (G.running && S.followers > 100) addMoney(S.followers * 0.0012 * dt, 'chirp-fund');
        // $RUG drift + FOMO
        if (S.coin.launched && !S.coin.pulled) {
          S.coin.price *= 1 + (Math.random() - 0.47) * 0.012 * dt * 10;
          S.coin.histT = (S.coin.histT || 0) + dt;
          if (S.coin.histT > 0.5) {
            S.coin.histT = 0;
            S.coin.hist.push(S.coin.price);
            if (S.coin.hist.length > 120) S.coin.hist.shift();
          }
        }
      },
      draw(g, w, h) {
        // ── left column (on phones it's taller than the screen, so it scrolls)
        const lw = 400;
        const left = (h) => {
        g.rect(0, 0, lw, h, '#0d1215');
        g.circle(46, 50, 30, '#1f2a30', C.blue, 2);
        g.text('?', 46, 52, { align: 'center', base: 'middle', size: 32, bold: true, color: C.blue });
        g.text('you', 90, 42, { size: 20, bold: true });
        if (G.flags.google) g.text('✓', 136, 42, { size: 20, bold: true, color: C.blue });
        g.text('@' + handle, 90, 66, { size: 15, color: C.dim });
        g.text(short(S.followers), 330, 46, { size: 24, bold: true, align: 'right', color: C.blue });
        g.text('followers', 330, 66, { size: 13, align: 'right', color: C.dim });

        if (!G.flags.google) {
          if (g.button('verify', 20, 92, lw - 40, 34, '✓ Get verified — log in with Google', { size: 15, bg: '#13202b', border: '#2d4a63', color: C.blue }))
            os.modal({
              title: 'Log in with Google',
              body: 'Chirp would like to:\n\n•  Upload your contacts to "find friends"\n•  Read your Gmail to "verify your identity"\n•  Access your location\n\nVerified accounts get 2× followers!',
              buttons: [{ label: 'Cancel' }, { label: 'Allow', kind: 'primary', fn: () => emit('trap', 'google') }],
            });
        }

        let y = 146;
        g.text('POST SOMETHING', 20, y, { size: 22, font: HEAD, color: C.dim });
        y += 12;
        S.drafts.forEach((d, i) => {
          if (g.button('draft' + i, 20, y, lw - 40, 52, '', {
            disabled: S.cd > 0,
            draw: (bx, by, bw, bh, fg) => {
              g.clip(bx, by, bw, bh);
              g.para(d, bx + 12, by + 22, bw - 24, { size: 15, color: S.cd > 0 ? C.faint : C.text });
              g.unclip();
            },
          }))
            post(d);
          y += 58;
        });
        const r = g.input('chirpin', 20, y + 4, lw - 130, 40, S.text, { placeholder: 'or write your own…', max: 180 });
        S.text = r.value;
        if ((g.button('postbtn', lw - 104, y + 4, 84, 40, S.cd > 0 ? Math.ceil(S.cd) + 's' : 'POST', { kind: 'primary', disabled: S.cd > 0 }) || r.submit) && S.text.trim()) {
          post(S.text);
          S.text = '';
        }
        y += 60;
        if (S.sponsor) {
          g.text(`💰 sponsored by @${S.sponsor.who}: ${money(S.sponsor.per)} × ${S.sponsor.left} posts left`, 20, y, { size: 14, color: C.green, max: lw - 40 });
        }
        y += 20;

        // ── $RUG panel
        g.rect(14, y, lw - 28, h - y - 14, '#0a0f12');
        g.stroke(14, y, lw - 28, h - y - 14, C.border);
        const c = S.coin;
        g.text('MEMECOIN', 28, y + 30, { size: 24, font: HEAD, color: C.purple });
        if (!c.launched) {
          g.para('Launch your own coin. Hype it with posts that mention $RUG. Then pull the rug. (This is a crime. So is everything else here.)', 28, y + 58, lw - 60, { size: 14, color: C.dim });
          const can = S.followers >= 250;
          if (g.button('launch', 28, h - 70, lw - 56, 44, can ? 'LAUNCH $RUG — ' + money(5000) : `need 250 followers (${S.followers})`, { kind: can ? 'gold' : undefined, disabled: !can })) {
            if (spend(5000)) {
              c.launched = true;
              c.hist = [c.price];
              makeDrafts();
              audio.cash();
              os.notify('$RUG is live', 'Now go hype it. Posts mentioning $RUG pump the price.', { app: 'chirp', color: C.purple });
            } else audio.error();
          }
        } else {
          const val = c.tokens * c.price;
          g.text(c.pulled ? '$RUG  (rugged)' : `$RUG  $${c.price.toFixed(5)}`, 28, y + 58, { size: 18, bold: true, color: c.pulled ? C.red : C.text });
          g.text(`your bag: ${money(c.pulled ? 0 : val)}`, 28, y + 82, { size: 16, color: C.green });
          // sparkline
          const sx = 28, sy = y + 96, sw = lw - 56, sh = h - y - 190;
          if (c.hist.length > 1) {
            const mx = Math.max(...c.hist), mn = Math.min(...c.hist);
            g.ctx.strokeStyle = c.pulled ? C.red : C.purple;
            g.ctx.lineWidth = 2.5;
            g.ctx.beginPath();
            c.hist.forEach((p, i) => {
              const xx = sx + (i / (c.hist.length - 1)) * sw;
              const yy = sy + sh - ((p - mn) / Math.max(1e-9, mx - mn)) * sh;
              i ? g.ctx.lineTo(xx, yy) : g.ctx.moveTo(xx, yy);
            });
            g.ctx.stroke();
          }
          if (!c.pulled) {
            if (g.button('rugpull', 28, h - 70, lw - 56, 44, `RUG PULL  (+${money(val * 0.9)})`, { kind: 'danger' })) {
              const payout = Math.round(val * 0.9);
              addMoney(payout, 'rug');
              c.pulled = true;
              c.price = 0.000001;
              c.hist.push(c.price);
              S.followers = Math.round(S.followers * 0.35);
              addHeat(9, 'SEC flagged a pump-and-dump. Wallet traced to this region.');
              audio.cash(true);
              audio.stinger(0.15);
              secret('rug');
              S.posts.unshift({ who: 'crypto_karen', h: 'crypto_karen', text: 'I PUT MY RETIREMENT IN $RUG. WHERE DID IT GO', likes: 3 });
              makeDrafts();
            }
          } else g.text('nobody will ever trust you again. worth it.', 28, h - 40, { size: 14, color: C.dim });
        }
        };
        if (g.mobile) g.scrollArea('chirpL', 0, 0, lw, h, 640, () => left(640));
        else left(h);

        // ── feed
        const fx = lw + 10, fw = w - lw - 20;
        g.text('FEED', fx + 10, 34, { size: 24, font: HEAD, color: C.dim });
        let total = 0;
        const heights = S.posts.map((p) => {
          const hh = 64 + g.para(p.text, 0, 0, fw - 90, { size: 16, measure: true });
          total += hh + 8;
          return hh;
        });
        g.scrollArea('feed', fx, 48, fw, h - 56, total, (aw) => {
          let yy = 0;
          S.posts.forEach((p, i) => {
            const hh = heights[i];
            g.rect(0, yy, aw, hh, p.mine ? '#101a20' : '#0f1314');
            g.circle(30, yy + 30, 18, p.h === 'MetroPD' ? '#1a2440' : p.h === 'gh0stwire' ? '#300' : '#1d2528');
            g.text((p.who[0] || '?').toUpperCase(), 30, yy + 31, { align: 'center', base: 'middle', size: 18, bold: true, color: p.h === 'gh0stwire' ? C.red : C.text });
            const nw = g.text(p.who, 60, yy + 26, { size: 16, bold: true, color: p.h === 'gh0stwire' ? C.red : C.text });
            g.text((p.verified ? '✓ ' : '') + '@' + p.h, 66 + nw, yy + 26, { size: 14, color: p.verified ? C.blue : C.dim });
            g.para(p.text, 60, yy + 50, aw - 90, { size: 16, color: C.text });
            g.text(`♥ ${short(p.likes || 0)}${p.viral ? '  🔥 viral' : ''}`, aw - 14, yy + 26, { size: 13, align: 'right', color: C.faint });
            if (p.h === 'DashieXP' && g.hit('dashpost' + i, 0, yy, aw, hh)) {
              audio.dashie();
              secret('dashie');
            }
            yy += hh + 8;
          });
        });
      },
    };
  },
};
