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

That runs `node --test tests/*.test.mjs`. The suite covers the chip set, come-out, Don't Pass bar 12, odds and lay odds, Crapless points, come and don't come, place and buy vig, Field, hardways, Horn, C&E, Hard Way All Day, ATS, all 10 repeaters, all 21 hops, PRESS, POWER PRESS, Billy's Way, strategies B1–B12, and the rejection-sampled RNG.

## Spec coverage

### Implemented

- Regular and Crapless bubble craps, one bankroll, practice chips labeled on every balance.
- Chips $1, $5, $25, $100, $500. Table $5–$500. Starting bankroll $1,000. No negative bankroll. No $10 chip. No Fire Bet.
- Field: 2 and 12 pay 2:1; 3, 4, 9, 10, 11 pay 1:1.
- Pass odds 3-4-5x in Regular. Crapless odds 3x on 2/3/4/10/11/12, 4x on 5/9, 5x on 6/8. True odds 6:1, 3:1, 2:1, 3:2, 6:5.
- Lay odds on Don't Pass and Don't Come, Regular only, up to 6x, paid at 3x/4x/5x. No number lays.
- Buy on every point number, 5% commission on wins only, floored to the cent.
- Hard Way All Day 165 for 1, stays up, lamps reset on a hit, only a 7 loses it. Easy ways do not count.
- ATS Low / High / Roll 'Em All at 31 / 31 / 156 for 1, Regular only, hidden in Crapless, stay up and re-arm. Any 7 loses.
- Repeaters on all ten numbers, both modes, the spec FOR-1 table, $1–$25, any 7 loses, stay up and re-arm.
- 21 hops: 6 hard at 30 to 1, 15 easy at 15 to 1. Horn singles are the same bets as the board. Horn 4-way is separate, in $4 units.
- Any 7 at 4 to 1, Any Craps at 7 to 1, C&E at 7 to 1 / 15 to 1. One-roll bets stay up on a win.
- Place and Buy off on the come-out unless the setting is on. Hardways work on the come-out unless switched off. Come odds are off on the come-out by default; the flat Come still works. Bets Off parks Place and Buy only.
- Pass cannot be taken down after a point. Come-point flats cannot be taken down. Don't Pass and Don't Come can, with a Tutor warning.
- PRESS and POWER PRESS, including the rounding examples in the build prompt. Undo and Clear before the next roll.
- Billy's Way: Regular Buy 4/5/9/10 and Place 6/8; Crapless also buys 2/3/11/12. A $5 chip is $32 Regular and $52 Crapless.
- Strategies B1–B12 with All / Regular / Crapless / Lessons. B9 is a lesson. Auto-bet maintains the set.
- Tutor: Dealer Billy, beginner and experienced tracks, seven-step tour, edge colors, Bubbles Billie on big wins and seven-out.
- Fair Dice: totals versus expected, chi-square in plain words, per die, streaks, last 20, above and below expected. Secure RNG with rejection sampling, Math.random fallback labeled.
- Blazing meter is cosmetic. Come-out 7 does not reset it. Seven-out does.
- 15-second bet timer, default on, manual ROLL always works.
- Three-screen swipe, pinned HUD and dock, mini roll toast off the dice screen.
- WebAudio after a gesture, haptics where the device allows, reduced motion.
- Premium is a locked preview. No payments.

### Simplified

- Wide screens (900px and up) center the phone column. They do not switch to a side-by-side board and dice, or a three-column layout.
- The roll log keeps 8,000 compact records, not 100,000. A larger log would blow `localStorage`.
- Fair Dice CSV is locked, as specified. There is no feedback form for a very rare chi-square.
- Premium is a static locked list of Standard rules. It does not edit live payouts or switch B-1 through B-30.
- Landscape pan and zoom are not built.
- There is no auto-press setting (off / PRESS / POWER PRESS, max 1–5). Strategy B5 presses by posting the next unit itself.
- There is no separate "Take down Billy's Way" button. RESET clears the layout. Each number also has a minus.
- A $500 chip on Billy's Way wants Place 6 and 8 at $600. The $500 table max rejects that part.
- Horn is $4 units. A $5 chip posts $4 and a $25 chip posts $24. $100 and $500 divide evenly. The engine still refuses a raw amount that is not a multiple of $4.
- Any Craps, Horn 4-way, and C&E are an extra row under the locked prop grid so they can be bet. The mockup does not give them their own spots.
- Felt cells are shorter than 44px so the Pass Line fits on a 390×844 screen. Dock, chips, tabs, and bet-panel steppers are at least 44px, and those steppers cover the same bets.

### Not in this build

- App 2 (table craps), payments, accounts, analytics, and external fonts or CDNs.
- Shooter-skill simulation.

## Known bugs

- The felt is dense. On 390×844 the Pass Line is on screen; BETS OFF, Billy's Way, and the bet panel start just below the fold.
- Minor wins under $25 show in the roll toast. The full Bubbles Billie celebration is for a win of $25 or more, a bonus that re-arms, or a seven-out.
- The layout matches the mockup structure and the brand colors. It is not a pixel-identical recreation of `docs/mockups/`.

## QA

`docs/qa/QA-REPORT.md` records the before/after pass. Screenshots are in `docs/qa/before/` and `docs/qa/after/`.
