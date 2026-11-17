// Small math and collision helpers shared by the world, traffic and renderer.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed turn from angle `a` toward angle `b`, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** A point (circle of radius r) against an axis-aligned rectangle; returns the push-out. */
export function circleRectPush(px, py, r, rx, ry, rw, rh) {
  const cx = clamp(px, rx, rx + rw);
  const cy = clamp(py, ry, ry + rh);
  const dx = px - cx;
  const dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), y: (dy / d) * (r - d), depth: r - d };
  }
  // Centre inside the rectangle: push out along the smallest penetration axis.
  const left = px - rx;
  const right = rx + rw - px;
  const top = py - ry;
  const bottom = ry + rh - py;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), y: 0, depth: left + r };
  if (m === right) return { x: right + r, y: 0, depth: right + r };
  if (m === top) return { x: 0, y: -(top + r), depth: top + r };
  return { x: 0, y: bottom + r, depth: bottom + r };
}

/** Two circles overlapping; returns the push-out for the first, or null. */
export function circleCirclePush(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const d2 = dx * dx + dy * dy;
  const rr = ar + br;
  if (d2 >= rr * rr || d2 < 0.0001) return null;
  const d = Math.sqrt(d2);
  const push = (rr - d) / 2;
  return { x: (dx / d) * push, y: (dy / d) * push, depth: rr - d };
}

/** Pick one element of an array with a seeded random function. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** An integer in [lo, hi] from a seeded random function. */
export function int(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}
