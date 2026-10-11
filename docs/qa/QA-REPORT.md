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

## Still short of the mockups

The felt follows the locked order (Horn 2×2, Big Red, Hard Way All Day, hardways, numbers with Buy above and Place below, Come, Field, Pass line). It is not a pixel copy. Type is Palatino and system UI, not the mockup's display face. Any Craps, Horn 4-way, and C&E sit on an extra row under the prop grid so those bets can be made; they are not separate spots in the locked mockup. Felt cells are under 44px so the Pass Line fits; the dock, chips, tabs, and bet-panel steppers are at least 44px, and every felt bet is also on a 44px stepper.

Wide windows center the phone column. They do not become the spec's side-by-side or three-column layout.

Side-by-side comparisons of the polished screens and the mockups are in `docs/qa/compare/`.

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

49 tests pass, including the browser swipe. `robots` meta `noindex, nofollow` is still on the page.
