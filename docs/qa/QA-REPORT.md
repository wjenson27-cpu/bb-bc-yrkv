# QA report — Billy Bubs Bubble Craps

Phone viewport 390×844, Chrome headless, local static server. No console errors or warnings on the capture pass. First-load transfer about 266 KB. No horizontal page scroll (`scrollWidth` equals the viewport).

Screenshots:

- Before: `docs/qa/before/`
- After: `docs/qa/after/`

## Before

`docs/qa/before/` is the first capture, before the visual and interaction pass.

| Shot | What was wrong |
| --- | --- |
| `01-home.jpg` | Home sat in the top half. The dome was small and the mode cards did not fill the phone. |
| `02-dome.jpg`, `02-dome-settled.jpg` | Dice were CSS 3D cubes. They did not read as dice inside the dome. |
| `03-board-regular.jpg` | Pass Line sat under the dock. Prop bets (Field, hardways, ATS, Big Red, C&E, Any Craps) could only come down with RESET. Horn 4-way was not on the felt. |
| `08-bet-lay.jpg` | A Don't Come that had already moved to a number offered a plus that the engine rejected as an unknown bet. |
| `06-fair.jpg` | Totals and the chi-square readout were present. Streaks were not. |
| `settings.jpg` | Place/Buy on the come-out was a switch. Hardways-on-come-out and come-odds-off were engine defaults with no switch. |

Severity: the Don't Come plus and the missing Horn bet were functional. The dice and the buried Pass Line were the visual blockers.

## Fixes

- Home is a column: logo, dome with two flat dice (5 and 2), disclaimer, mode cards, and the Regular call to action.
- Dome dice are 2D pip faces. They tumble with transform, then settle on the real faces. Reduced motion skips the tumble.
- Felt spacing was tightened so the Pass Line sits fully above the dock on 390×844. BETS OFF, Billy's Way, RESET, and the bet panel start just under that fold and scroll into view.
- Horn 4-way is on the felt. A $5 or $25 chip posts the largest $4 unit inside that chip and leaves the remainder in practice chips. A $1 chip is refused.
- Bets that are not on the current Place/Buy/Lay/Odds rows show under "Also on the layout" with a 44px minus.
- Don't Come on a number can only be taken down. The plus explains that.
- Settings: hardways working on the come-out (default on), come odds off on the come-out (default on).
- Fair Dice adds streak counts and says a long gap does not change the next roll.
- Footer on every screen is the one line `18+ · Practice only · No real money`.

## After

`docs/qa/after/` was recaptured after those fixes. Console errors: none. Transfer: 266,047 bytes. Document scroll width: 390.

| File | Screen |
| --- | --- |
| `01-home.jpg` | Home, disclaimer, Regular and Crapless, footer |
| `02-dome.jpg` | Dice screen before the tumble settles |
| `02-dome-settled.jpg` | Dome after a roll, puck, meter, last rolls |
| `03-board-regular.jpg` | Regular felt, ATS, Pass / Don't / odds / lay |
| `04-board-crapless.jpg` | Crapless: 2, 3, 11, 12 on the numbers; no Don't, no ATS, no Lay tab |
| `05-tutor.jpg` | Dealer Billy, step 1 of 7, education disclaimer |
| `06-fair.jpg` | Empty Fair Dice state, secure RNG, locked CSV |
| `07-win.jpg` | Bubbles Billie, Pass Line natural, +$100 practice chips |
| `07-after-roll.jpg` | Board after that roll, overlay closed |
| `08-bet-place.jpg` | Place tab, edges, 44px steppers |
| `08-bet-buy.jpg` | Buy tab |
| `08-bet-lay.jpg` | Lay tab, Don't Pass and lay odds |
| `08-bet-odds.jpg` | Odds tab |
| `09-learn.jpg` | Strategy library |
| `11-premium.jpg` | Locked preview, no purchase |
| `13-bet-crapless.jpg` | Crapless Place tab, 2 through 12 except 7 |
| `14-side.jpg` | Repeaters and 21 hops |
| `settings.jpg` | Sound, haptics, timer, come-out switches, tracks |

Checked in the live DOM, not only in the pictures: Crapless text has no Don't and no ATS, the Lay tab is absent, and the ten Crapless numbers are 2, 3, 4, 5, 6, 8, 9, 10, 11, 12. Pass Line bottom was 544px and the stage ended at 553px, so the line is on screen above the dock.

## Design review

The designer review (D1–D22) is applied on top of the rules pass. Brand fonts load from `css/fonts.css` before `css/app.css`: Cinzel on the felt, Archivo on the UI, Fredoka on speech, Orbitron on LED captions, VT323 on the tumble line, Cinzel Decorative on BIG WIN.

The middle board order is ATS, numbers, Come, Field, props, then Pass last. The cloth uses the emerald felt tile, a leather rail, the printed wordmark, and chip stacks. Big Red is `#C21F2E`. Any Craps, C&E (`C 3:1 · E 7:1`), and Horn 4-way sit beside the Horn box.

The Play view hides the tab bar. Home is a button in the HUD. There is no second bankroll bar. PRESS and POWER PRESS show the live amount and the reason they are off. Undo is a ↺ disc on PRESS. Bets Off, Billy's Way, and Reset stay under the dock. ROLL does not overlap those keys.

A seven-out is a toast (`Seven-out · new shooter` when nothing was lost). A small win is the roll toast. A big win overlay stops above the dock, dismisses itself, and does not call the auto-roll stop. Place 6 and 8 post in $6 units.

Landscape phones (500px tall or shorter) keep the chip and on-table row in the top bar and keep the legal line on its own 26px row. The dock is a right column. Wide desktop windows still center the phone column, now on a felt backdrop.

Side-by-side shots of this pass against the mockups are in `docs/qa/compare/`.

## Run 4

Both reviewers failed the previous build. This pass fixes the failures they could reproduce in the app.

- PRESS and POWER PRESS paint again after the dice settle, so a hit lights the keys. Before the first tap the line is the amount only. After a tap it adds the tap count.
- A mouse or trackpad click on the felt, a hop, or a repeater places the bet. Pointer capture starts only after a sideways drag passes 12px. Playwright clicks Pass Line and Place 6 with a mouse, then a forced 6, and checks that PRESS 6 is enabled.
- Auto-press counts reset on a seven-out, on Reset, when Billy's Way posts that number again, and when the bet is taken down. A power-press or auto-press message leaves off a $0 return.
- A roll that nets zero or a loss is never a BIG WIN, and the amount line is never +$0. ATS, Hard Way All Day, and Repeater wins use their own copy on a real win.
- The Blazing meter has four segments and no Fire footnote. Hot and Blazing fill different amounts.
- The bet sheet sits inside the stage, above the chip rack and ROLL, with a handle, a close button, and a tap-outside scrim.
- The board grows to fill the stage. At 390px the number faces measure 29.6px, SIX and NINE 18px, and BUY/PLACE 8px. The felt "practice" line is dropped because the footer already says it.
- The dome shows the full hood (glass, base, lights, air-jet floor) with one outline. The dice are CSS cubes from the cube handoff, rendered on `document.body` so the pager transform and the stage overflow do not flatten them. They tumble for about a second and settle on the rolled faces. Reduced motion fades instead.
- Dealer Billy (hello, tip, live, seven-out, winner) and Bubbles Billie (hello, cheer, winner) are the SVG poses. The home line "Bets down! Air's coming on." is a speech bubble on the hero. Billy calls the point on the dome. Billie cheers wins and hot streaks. Idle motion turns off when reduced motion is on.
- Landscape shows Chips and On table, and the legal line is fully on screen.
- Last 20 reads oldest to newest, with the newest chip marked. Fair Dice prints the verdict that matches the test (Need more rolls, Looks fair, A bit unusual, Rare result). The first time auto-press is turned on, a tip explains it. A $500 chip on Place 6 or 8 posts $498, the largest $6 unit under the table max.

## Still short of the mockups

The felt is the right material and order. It is still denser than mockup 15, and felt cells are under 44px so the Pass Line fits. Dock, chips, and bet-panel steppers are at least 44px.

Wide windows stay a centered phone column with a felt backdrop. They do not become a three-column layout. There is no long-press bet preview. The grey-out line for a Place 6 or 8 win under one unit still says the $6 unit.

## Rules pass

The rules review found a C&E overpay and a progress-banking hole, plus several missing Standard behaviors. Those are fixed in the engine and covered by tests.

- C&E pays 3 to 1 on 2, 3, and 12 and 7 to 1 on 11, on the whole stake. A $10 C&E wins $30 on craps and $70 on 11. The spot says `C 3:1 · E 7:1`. The bet is posted in $2 units. The old test that expected $75 and $35 on a $5 C&E was asserting the bug.
- Hard Way All Day and ATS reject more chips once any lamp is lit. Any takedown, including a partial one, clears the lamps. A Repeater takedown clears its tally the same way.
- Regular/Crapless and Home → Play do not refund a working Pass, Don't, or Come bet, and they do not clear a point that is on.
- Settings has auto-press (Off / PRESS / POWER PRESS, max 1–5). It adds to the Billy's Way spot that won and leaves the original bet alone. B5 uses the same control, reopens after a seven-out, and stops after three lost opening spreads.
- Premium lists B-1 through B-30, Regular and Crapless, the presets, and an Edge Preview. Every control on that screen is locked.
- A sideways drag changes screens even when it starts on a felt button, and the dot follows. Playwright drives that gesture when system Chrome is available.
- The Blazing meter can be switched off. The first time each tier appears, the copy says the dice have no memory. A seven-out from a longer hand says the hand cooled off.
- B8 can post a new Buy 4/5/9/10 set after it takes the first one down. B11 pauses after 100 rolls, not 99.
- PRESS and POWER PRESS show why they are grey, including while the dice are tumbling. The $500 cap toast only shows when the bet lands on the table max.

49 tests pass, including the browser swipe, after the design review as well. `robots` meta `noindex, nofollow` is still on the page.
