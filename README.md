# Billy Bubs · Bubble Craps

Unlisted test build. Practice chips only. No real money. 18+.

The playable app is `index.html`. Rules live in `docs/two-games-spec.md` (App 1). Mockups are in `docs/mockups/`. Brand files are in `assets/`. `reference/billy-bubs-practice/` is reference only and is not the app.

GitHub Pages: https://wjenson27-cpu.github.io/bb-bc-yrkv/

`robots.txt` disallows the whole site. Every HTML page sends `noindex, nofollow`.

## Run

ES modules need a static server.

```bash
python3 -m http.server 8765
```

Open http://127.0.0.1:8765/

## Test

```bash
npm test
```

That runs `node --test tests/*.test.mjs`. The suite covers the chip set, come-out, Don't Pass bar 12, odds and lay odds, Crapless points, come and don't come, place and buy vig, Field, hardways, Horn, C&E at 3 to 1 and 7 to 1, Hard Way All Day and ATS progress locks, Repeaters, all 21 hops, PRESS, POWER PRESS, auto-press, Billy's Way, strategies B1–B12 including B5 reopening and B11's 100 rolls, the Blazing meter copy, and the rejection-sampled RNG. The swipe test drives system Chrome through Playwright when both are installed; otherwise that one case skips.

## Spec coverage

### Implemented

- Regular and Crapless bubble craps, one bankroll, practice chips labeled on every balance.
- Chips $1, $5, $25, $100, $500. Table $5–$500. Starting bankroll $1,000. No negative bankroll. No $10 chip. No Fire Bet.
- Field: 2 and 12 pay 2:1; 3, 4, 9, 10, 11 pay 1:1.
- Pass odds 3-4-5x in Regular. Crapless odds 3x on 2/3/4/10/11/12, 4x on 5/9, 5x on 6/8. True odds 6:1, 3:1, 2:1, 3:2, 6:5.
- Lay odds on Don't Pass and Don't Come, Regular only, up to 6x, paid at 3x/4x/5x. No number lays.
- Buy on every point number, 5% commission on wins only, floored to the cent.
- Hard Way All Day 165 for 1, stays up, lamps reset on a hit, only a 7 loses it. Easy ways do not count. Once any lamp is lit the stake is locked. Any takedown clears the lamps.
- ATS Low / High / Roll 'Em All at 31 / 31 / 156 for 1, Regular only, hidden in Crapless, stay up and re-arm. Any 7 loses. Same lamp lock and takedown rule as Hard Way All Day.
- Repeaters on all ten numbers, both modes, the spec FOR-1 table, $1–$25, any 7 loses, stay up and re-arm. A takedown clears the tally.
- 21 hops: 6 hard at 30 to 1, 15 easy at 15 to 1. Horn singles are the same bets as the board. Horn 4-way is separate, in $4 units.
- Any 7 at 4 to 1, Any Craps at 7 to 1. C&E is a split bet: 3 to 1 on 2, 3, or 12 and 7 to 1 on 11, on the whole stake, posted in $2 units. One-roll bets stay up on a win.
- Place and Buy off on the come-out unless the setting is on. Hardways work on the come-out (that switch is in the locked Premium list). Come odds are off on the come-out. The flat Come still works. Bets Off parks Place and Buy only.
- Pass cannot be taken down after a point. Come-point flats cannot be taken down. Don't Pass and Don't Come can, with a Tutor warning. Regular/Crapless and Home → Play refuse to switch while a point is on or a Pass, Don't, or Come bet is working.
- PRESS and POWER PRESS, including the rounding examples in the build prompt. Undo and Clear before the next roll. Both keys show their grey-out reason and stay off while the dice are tumbling. "Capped at $500" only appears when the bet actually lands on the table max.
- Auto-press (B-28) is a free Settings control: Off, PRESS, or POWER PRESS, max 1–5 per number. It presses the Billy's Way spot that won and does not change that bet's original amount. Off still lets the B5 coach press up to 3 times.
- Billy's Way: Regular Buy 4/5/9/10 and Place 6/8; Crapless also buys 2/3/11/12. A $5 chip is $32 Regular and $52 Crapless. Take down Billy's Way clears those spots.
- Strategies B1–B12 with All / Regular / Crapless / Lessons. B9 is a lesson. Auto-bet maintains the set. B5 reopens after a seven-out and pauses after three lost opening spreads. B5 presses add to the bet. B8 can post a new outside set after it takes the first one down. B11 rolls 100 times, then pauses.
- Tutor: Dealer Billy, beginner and experienced tracks, seven-step tour, edge colors, Bubbles Billie on big wins and seven-out. Mute this tip mutes that tip only.
- Fair Dice: totals versus expected, chi-square in plain words, per-die chi-square, hard 4/6/8/10 against 1/36, streaks, the most repeated number in a hand, last 20, above and below expected. Secure RNG with rejection sampling, Math.random fallback labeled.
- Blazing meter is cosmetic and can be turned off in Settings. The HUD reads the hand length. The first time Warm, Hot, or Blazing appears, Dealer Billy says the dice have no memory. A seven-out from a longer hand says the hand cooled off.
- 15-second bet timer, default on, manual ROLL always works.
- Three-screen swipe, including a sideways drag that starts on a bet button. The dots follow the page. Pinned HUD and dock. Mini roll toast off the dice screen.
- WebAudio after a gesture, haptics where the device allows, reduced motion. Cinzel, Cinzel Decorative, Archivo, Fredoka, Orbitron, and VT323 are self-hosted.
- Premium is a locked preview: Regular and Crapless, presets (Standard, MGM, Caesars, Custom, Downtown 10x), B-1 through B-30, and an Edge Preview. Nothing on that screen changes the live table. No payments.

### Simplified

- Wide screens (900px and up) center the phone column. They do not switch to a side-by-side board and dice, or a three-column layout.
- The roll log keeps 8,000 compact records, not 100,000. A larger log would blow `localStorage`.
- Fair Dice CSV is locked, as specified. There is no feedback form for a very rare chi-square.
- Premium shows every B-setting, the presets, and an Edge Preview, and all of them stay locked. It does not edit live payouts.
- Phones in landscape (500px tall or less) move the dock to a 132px right column so the stage stays on screen. Wider windows still center the phone column.
- The full A1.8 tutor state table is not wired. The tour, come-out and point tips, press and power tips, a first hop, Place 2/3/11/12, the first swipe to side bets, and the Blazing lesson are.
- A $500 chip on Billy's Way wants Place 6 and 8 at $600. The $500 table max rejects that part.
- Horn is $4 units. C&E is $2 units. A $5 chip posts $4 of either and leaves $1 in practice chips. A $25 Horn posts $24. $100 and $500 divide evenly.
- Any Craps, C&E, and Horn 4-way sit on the felt next to the Horn box. The left screen is Repeaters and hops.
- Felt cells are shorter than 44px so the Pass Line fits on a 390×844 screen. Dock, chips, tabs, and bet-panel steppers are at least 44px, and those steppers cover the same bets.

### Not in this build

- App 2 (table craps), payments, accounts, analytics, and external fonts or CDNs.
- Shooter-skill simulation.

## Known bugs

- The felt is dense. Pass Line is the last row. Bets Off, Billy's Way, and Reset stay in the dock. The bet panel opens from BETS.
- A small win is a roll toast. A seven-out is a toast and never says +$0. A big win (25× the winning wager, or an ATS, Hard Way All Day, or Repeater hit) is an overlay that leaves ROLL free and does not pause auto-roll.
- A Place 6 or 8 tap posts the chip in $6 units ($5 becomes $6, $25 becomes $30, $100 becomes $120).
- The layout matches the mockup structure and the brand colors. It is not a pixel-identical recreation of `docs/mockups/`.

## QA

`docs/qa/QA-REPORT.md` records the before/after pass. Screenshots are in `docs/qa/before/` and `docs/qa/after/`.
