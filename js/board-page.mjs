/**
 * Which pager page holds a lingo board link.
 * Bubble and Table: 0 side bets, 1 board, 2 dome / shooter.
 */

const SIDE = {
  hop: 0,
  repeater: 0,
  hardway: 0,
  yo: 0,
  any7: 0,
  horn: 0,
  ce: 0,
  anyCraps: 0,
  fire: 0,
  small: 0,
  tall: 0,
  all: 0,
  hardAllDay: 0,
};

export function pageForLink(link, app) {
  if (!link || link === "ui:rail") return null;
  const kind = String(link).split(":")[0];
  if (Object.prototype.hasOwnProperty.call(SIDE, kind)) return 0;
  if (app === "table" && (kind === "pass" || kind === "dontPass" || kind === "field" || kind === "come" || kind === "dontCome" || kind === "place" || kind === "buy" || kind === "lay")) return 1;
  if (kind === "dice" || kind === "shooter") return 2;
  return 1;
}
