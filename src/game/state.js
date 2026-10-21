// Shared game state, economy and the police clock.

export const GOAL = 1_000_000;
// minutes until the police arrive if you do nothing to speed them up or slow them down
export const BASE_ETA_MIN = 18;

const listeners = {};
export const on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)));
export const emit = (ev, ...a) => (listeners[ev] || []).forEach((f) => f(...a));

// Mining hardware — every one shows up in the room
export const HARDWARE = [
  { id: 'oc', name: 'Overclock the CPU', desc: 'Unsafe voltages. What could go wrong.', cost: 15, rate: 1, heat: 1, power: 0.05, max: 5, model: null },
  { id: 'egpu', name: 'Used GTX 1060 (eGPU)', desc: 'Pulled out of a crypto bro\'s divorce sale.', cost: 90, rate: 3.2, heat: 3, power: 0.2, max: 6, model: 'egpu' },
  { id: 'gpu', name: 'RTX 4090', desc: 'Hot. Loud. Absolutely worth it.', cost: 1100, rate: 22, heat: 8, power: 0.5, max: 8, model: 'gpu' },
  { id: 'rig', name: '6× GPU Mining Rig', desc: 'Open-air frame. Smells like burning dust.', cost: 9000, rate: 165, heat: 30, power: 2, max: 6, model: 'rig' },
  { id: 'asic', name: 'Antminer S19', desc: 'Sounds like a jet engine in a closet.', cost: 38000, rate: 620, heat: 50, power: 3.2, max: 8, model: 'asic' },
  { id: 'rack', name: 'Server Rack (42U)', desc: '"Fell off a truck" outside a data center.', cost: 160000, rate: 2700, heat: 160, power: 9, max: 4, model: 'rack' },
];
export const COOLING = [
  { id: 'fan', name: 'Box Fan', desc: 'Pointed directly at the problem.', cost: 250, cool: 15, max: 6, model: 'boxfan' },
  { id: 'liquid', name: 'Liquid Cooling Kit', desc: 'Do not let it leak onto the rigs. Or you.', cost: 6000, cool: 70, max: 4, model: null },
  { id: 'ac', name: 'Stolen AC Unit', desc: 'Still has the neighbour\'s name on it.', cost: 30000, cool: 260, max: 3, model: null },
];
export const OPSEC = [
  { id: 'vpn', name: 'VPN Subscription', desc: 'Hides your traffic. Police slow down 18%. You should have one in real life too.', cost: 400, mult: 0.82, once: true },
  { id: 'proxy', name: '7-hop Proxy Chain', desc: 'Bounce through seven countries. Police slow down 10%.', cost: 6000, mult: 0.9, once: true },
  { id: 'burner', name: 'Burner Phone', desc: 'Pay cash. Use once. Police slow down 6%.', cost: 2500, mult: 0.94, once: true },
  { id: 'faraday', name: 'Faraday Bag', desc: 'Your phone goes in. Signals don\'t come out. Police slow down 6%.', cost: 9000, mult: 0.94, once: true },
  { id: 'tap', name: 'Tap the Neighbour\'s Power', desc: 'Your power bill stops snitching. Halves the heat from your rigs.', cost: 12000, once: true },
  { id: 'wipe', name: 'LogWiper.exe', desc: 'Scrubs your trail. Police fall back a bit. Gets pricier each use.', cost: 8000, heatDrop: 6, scale: 1.7 },
  { id: 'bribe', name: 'Bribe a 911 Dispatcher', desc: 'He "loses" your file for a while. Big setback for the police.', cost: 90000, heatDrop: 15, once: true },
];
export const MISC = [
  { id: 'tape', name: 'Webcam Tape', desc: 'That little green light has been on this whole time.', cost: 5, once: true },
  { id: 'tinfoil', name: 'Tinfoil Hat', desc: 'Blocks 0% of signals. 100% of dignity.', cost: 50, once: true },
  { id: 'cans', name: 'VOLT Energy 24-pack', desc: '+50% clicking power for 60 seconds. Heart sold separately.', cost: 60, scale: 1.25 },
  { id: 'stash', name: 'Bigger Stash Box', desc: 'Hold 20 more units on the Velvet Road.', cost: 3000, scale: 2.2 },
];

export const G = {
  money: 0,
  earned: 0,
  spent: 0,
  heat: 0, // 0 → 100 = they're at the door
  elapsed: 0,
  running: false,
  owned: {},
  ownedOpsec: {},
  temp: 34,
  clickBoostUntil: 0,
  organs: { kidneyL: 0, kidneyR: 0, liver: 0, corneaL: 0, corneaR: 0, lung: 0, marrow: 0, blood: 0, heart: 0 },
  flags: {},
  stats: { clicks: 0, gambled: 0, gambleWon: 0, organs: 0, tweets: 0, deals: 0, records: 0, traps: 0 },
  scanner: [],
  secrets: new Set(),
  bestDistance: 4,
};

export function reset() {
  Object.assign(G, {
    money: 0,
    earned: 0,
    spent: 0,
    heat: 0,
    elapsed: 0,
    running: false,
    owned: {},
    ownedOpsec: {},
    temp: 34,
    clickBoostUntil: 0,
    organs: { kidneyL: 0, kidneyR: 0, liver: 0, corneaL: 0, corneaR: 0, lung: 0, marrow: 0, blood: 0, heart: 0 },
    flags: {},
    stats: { clicks: 0, gambled: 0, gambleWon: 0, organs: 0, tweets: 0, deals: 0, records: 0, traps: 0 },
    scanner: [],
  });
}

export const owned = (id) => G.owned[id] || 0;
export const costOf = (item) => {
  const n = item.once ? 0 : G.owned[item.id] || 0;
  return Math.round(item.cost * Math.pow(item.scale || 1.15, n));
};

export function addMoney(n, source = '') {
  if (!isFinite(n)) return;
  G.money += n;
  if (n > 0) G.earned += n;
  emit('money', n, source);
}
export function spend(n) {
  if (G.money < n - 1e-6) return false;
  G.money -= n;
  G.spent += n;
  emit('money', -n, 'spend');
  return true;
}

// ── police clock
export function heatMultiplier() {
  let m = 1;
  for (const o of OPSEC) if (o.mult && G.ownedOpsec[o.id]) m *= o.mult;
  if (G.flags.lightsOn) m *= 1.25;
  return m;
}
export function powerDraw() {
  let kw = 0.08;
  for (const h of HARDWARE) kw += (G.owned[h.id] || 0) * h.power;
  return kw;
}
export function heatRate() {
  const base = 100 / (BASE_ETA_MIN * 60);
  const power = powerDraw() * 0.001 * (G.ownedOpsec.tap ? 0.5 : 1);
  return (base + power) * heatMultiplier();
}
export function addHeat(n, reason) {
  G.heat = Math.max(0, Math.min(100, G.heat + n));
  if (reason) scannerLog(reason, n > 0 ? 'bad' : 'good');
  emit('heat', n, reason);
}
export function scannerLog(text, kind = '') {
  G.scanner.push({ t: G.elapsed, text, kind });
  if (G.scanner.length > 60) G.scanner.shift();
  emit('scanner', text, kind);
}
export const milesAway = () => Math.max(0, (1 - G.heat / 100) * 4.2);
export function etaSeconds() {
  return (100 - G.heat) / Math.max(1e-6, heatRate());
}

// ── mining
export function mining() {
  let rate = 0.3, load = 1, cooling = 12;
  for (const h of HARDWARE) {
    const n = G.owned[h.id] || 0;
    rate += n * h.rate;
    load += n * h.heat;
  }
  for (const c of COOLING) cooling += (G.owned[c.id] || 0) * c.cool;
  const temp = 30 + 52 * (load / cooling);
  const eff = temp <= 82 ? 1 : Math.max(0.35, 1 - (temp - 82) / 45);
  return { rate: rate * eff, raw: rate, load, cooling, temp, eff };
}
export function clickValue() {
  const m = mining();
  const boost = G.elapsed < G.clickBoostUntil ? 1.5 : 1;
  return (2 + m.raw * 0.05) * boost;
}

export function secret(id) {
  if (G.secrets.has(id)) return false;
  G.secrets.add(id);
  try {
    const all = JSON.parse(localStorage.getItem('traced.secrets') || '[]');
    if (!all.includes(id)) all.push(id);
    localStorage.setItem('traced.secrets', JSON.stringify(all));
  } catch (e) {
    /* storage unavailable */
  }
  emit('secret', id);
  return true;
}
export function loadSecrets() {
  try {
    return JSON.parse(localStorage.getItem('traced.secrets') || '[]');
  } catch (e) {
    return [];
  }
}

export const SECRETS = {
  dashie: ['WHAAAT\'S UP', 'Found Dashie on the arcade'],
  dashieBeat: ['Better Than Dashie', 'Beat dashiexp\'s HELI score'],
  duck: ['Rubber Duck Debugging', 'Talked to the duck'],
  tape: ['Covered', 'Taped over the webcam'],
  tinfoil: ['Protected (Not Really)', 'Bought a tinfoil hat'],
  konami: ['↑↑↓↓←→←→BA', 'Entered the code from the sticky note'],
  hunter2: ['*******', 'Typed the wifi password'],
  doxx: ['Bought Yourself Back', 'Tried to buy your own data back'],
  photo: ['Smile', 'Opened IMG_0001.jpg'],
  doll: ['It Moved', 'Caught the doll looking at you'],
  rat: ['Roommate', 'Spotted the rat'],
  scrawl: ['They Hear Everything', 'Read the wall'],
  copsdb: ['Clean Record', 'Hacked the police database'],
  motherlode: ['motherlode', 'Used an old cheat'],
  rug: ['Rug Pull', 'Pumped and dumped your own coin'],
  phone911: ['Wrong Number', 'Dialed 911 on the rotary phone'],
  allorgans: ['Hollow', 'Sold everything you could spare'],
  noTraps: ['Paranoid (Correctly)', 'Won without falling for a single trap'],
  ignore: ['Unknown Caller', 'Never picked up'],
  surrender: ['Hands Up', 'Turned yourself in'],
  heart: ['Priceless', 'Sold your heart'],
  blind: ['Lights Out', 'Sold both corneas'],
  kidneys: ['Renal Failure', 'Sold both kidneys'],
  win: ['Paid In Full', 'Made $1,000,000 in time'],
  lose: ['Traced', 'They found you'],
  chain: ['Click', 'Pulled the chain on a dead bulb'],
  bsod: ['Have You Tried Turning It Off', 'Tried to shut down'],
};
