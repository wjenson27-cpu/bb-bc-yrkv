// Set-dice orientation math (SHIPS). Right-handed die: opposite faces sum to 7, and with
// 1 on top and 2 facing you, 3 is on the right (Western standard; same rule as bb-bc-yrkv css/dice-cube.css).
// Canonical normals in maths coords (x right, y up, z toward the viewer).
const N = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0] };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const faceOf = (v) => +Object.keys(N).find((k) => N[k].every((c, i) => c === v[i]));
/** right face for a (top, front) pair; null if they are the same face or opposite. */
export function rightOf(top, front) {
  if (top === front || top + front === 7) return null;
  return faceOf(cross(N[top], N[front]));
}
export const orient = (top, front) => { const right = rightOf(top, front); return right && { top, front, right, bottom: 7 - top, back: 7 - front, left: 7 - right }; };
// Gestures (the shooter screen): quarter turns, always legal, always right-handed.
export const turn = {
  flipUp:    (o) => orient(o.front, o.bottom), // drag up: front rolls to the top
  flipDown:  (o) => orient(o.back, o.top),     // drag down: back rolls to the top
  spinLeft:  (o) => orient(o.top, o.right),    // drag left: top stays, right comes to the front
  spinRight: (o) => orient(o.top, o.left),     // drag right
};
/** CSS matrix3d for the cube element so `top` faces up and `front` faces the viewer. Faces are laid out
 *  at their canonical normals (see tc-dice.css). CSS has y down, so conjugate with diag(1,-1,1). */
export function cssMatrix(top, front) {
  const o = orient(top, front); if (!o) return "none";
  const R = [N[o.right], N[top], N[front]];            // rows: world x,y,z in die coords
  const S = [1, -1, 1];
  const m = (i, j) => S[i] * R[i][j] * S[j];            // CSS-space rotation (row i, col j)
  // matrix3d is column-major
  return `matrix3d(${m(0,0)},${m(1,0)},${m(2,0)},0,${m(0,1)},${m(1,1)},${m(2,1)},0,${m(0,2)},${m(1,2)},${m(2,2)},0,0,0,0,1)`;
}
// Named sets (spec A2.5). Each die: top + front. On-axis faces are the 4 faces round the throw axis (x).
export const SETS = {
  "3V":       { name: "3V", aka: "hardway set", note: "Hard 6 top · no 7s on axis", dice: [{ top: 3, front: 5 }, { top: 3, front: 1 }] },
  "2V":       { name: "2V", aka: "", note: "Hard 4 top · 4/10 on axis", dice: [{ top: 2, front: 4 }, { top: 2, front: 6 }] },
  "STRAIGHT": { name: "Straight Hardway", aka: "1–6 axis", note: "2-2 · 3-3 · 4-4 · 5-5 on axis", dice: [{ top: 2, front: 3 }, { top: 2, front: 3 }] },
  "SEVENS":   { name: "All-Sevens", aka: "come-out", note: "7 on every face", dice: [{ top: 1, front: 2 }, { top: 6, front: 5 }] },
};
/** The four on-axis totals for a set (top, front, bottom, back) as the dice roll forward together. */
export function axisTotals(set) {
  const [a, b] = set.dice.map((d) => orient(d.top, d.front));
  return [["top", a.top + b.top], ["front", a.front + b.front], ["bottom", a.bottom + b.bottom], ["back", a.back + b.back]];
}
