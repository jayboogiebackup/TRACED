# TRACED

A ringing phone in the dark. A blackmailer who bought your whole life off the dark web.
A police trace you set off by picking up. A basement, a laptop, and one goal:
**make $1,000,000 before they find you.**

Everything is real-time 3D (Three.js), every sound is synthesized in code (Web Audio),
and the whole thing runs through a VHS shader modeled on exorciseyourex.com/kit
(their exact vignette + scanline CSS sits on top).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Headphones help.

## Put it on your website

```bash
npm run build
```

The build lands in `traced/`. Upload that folder to your site's web root
(e.g. `public_html/traced/` → `yoursite.com/traced/`). It's all relative paths,
so any sub-folder name works. No server code, no database, and no third-party
requests (the fonts are bundled).

## Things you'll probably want to change

| What | Where |
| --- | --- |
| **The final message** | `src/scenes/endings.js` → `MESSAGE` at the top |
| Ending text per ending | `src/scenes/endings.js` → `ENDING_LINES` |
| The blackmailer's phone call | `src/story.js` → `theCall()` |
| Police timer (minutes) | `src/game/state.js` → `BASE_ETA_MIN` |
| Prices, income, upgrades | `src/game/state.js` (`HARDWARE`, `COOLING`, `OPSEC`, `MISC`) |
| Story beats (calls, sirens, knocks) | `src/game/director.js` → `beats` |
| VHS look | `src/core/vhs.js` (uniform defaults at the top) |

### The Dashie easter egg

FlashBang.swf (the arcade app) has a "featured let's player" with a cartoon face.
Click it and it plays an air horn plus a synthesized "WHAAAAAT'S UP, IT'S DASHIE".

To use the real clip and picture instead, drop these files in a `public/` folder
before you build:

- `public/sounds/dashie.mp3` (used automatically if it exists)
- `public/img/dashie.png` (square image, replaces the cartoon)

Only ship a clip or picture you have permission to use.

## Controls

- **Mouse**: use the laptop (the cursor moves on the 3D screen)
- **Scroll** outside the screen, or **TAB**: lean back from the laptop
- **Hold right-click**: look around the basement
- **Esc**: pause (volume, VHS strength, spoken voice on/off)

## How to play

Start in **Bitminer** (click the coin), buy hardware in **RigMart**, keep it cool.
Everything else makes money faster but makes noise (the police get closer):
Casino, Body Market, Chirp ($RUG pump-and-dump), FlashBang, St0nks, the Velvet Road,
DataMart. **SAFE//NET** slows the police down. When you hit $1,000,000, open
**Messages** and press SEND.

Some offers are traps: Sign in with Google, the casino face scan, the ID upload,
a text with a link. They cost you, and that's the lesson.

## Secrets

There are 27. A few hints: the sticky note on the desk, the rubber duck, the doll on
the shelf, the rotary phone (try dialing), the terminal (`help` isn't everything),
hidden files, the Files app's Pictures folder, and Dashie's HELI score.

## Privacy note

The game reads the same things any website can read without asking (OS, browser,
time zone, screen size, GPU, battery) and says them back to you, which is the point.
None of it is stored or sent anywhere. Found secrets are saved in your browser's
localStorage so they carry over between runs.

## Debug

`?debug` exposes `G`, `game`, `engine`, `audio` in the console.
`?skip` jumps straight to the basement. `?debug&speed=10` runs the clock 10× faster.
