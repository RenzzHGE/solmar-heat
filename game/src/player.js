// The player: on foot and behind the wheel. Cars are plain state objects in
// state.cars; the one with driver === 'player' is the one being driven. Stealing a
// car, getting out, punching and crashing all live here.
import { CAR, CAR_KINDS, CITY, PLAYER, WANTED } from './config.js';
import { angleDiff, circleCirclePush, circleRectPush, clamp } from './utils.js';
import { isOnRoad } from './city.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y, angle: spawn.angle,
    health: PLAYER.health, onFoot: true, car: null,
    punchCooldown: 0, punchFlash: 0, invulnerable: 0,
    run: false, moving: false,
  };
}

/** The car the player is driving, or null. */
export function playerCar(state) {
  return state.cars.find((c) => c.driver === 'player') ?? null;
}

/** Nearest car the player could enter (within enter range), or null. */
export function nearestCar(state, maxDist = PLAYER.enterRange) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}

function stealCar(state, car) {
  const wasTraffic = car.driver === 'traffic';
  if (wasTraffic) {
    // The driver bails and flees on foot.
    state.peds.push(makeFleeingPed(state, car.x, car.y));
  }
  car.driver = 'player';
  car.speed = 0;
  state.player.onFoot = false;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  // Stealing in front of a cop or a crowd is a crime; alone at night it is free.
  const seen = state.police.some((p) => distTo(state.player, p) < 420) || state.peds.some((p) => p.state !== 'down' && distTo(state.player, p) < 260);
  if (seen) state.wanted.add(WANTED.stealCar, state);
  state.events.push({ kind: 'steal', x: car.x, y: car.y, t: 0 });
  state.audio?.play('steal');
}

function distTo(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function makeFleeingPed(state, x, y) {
  return {
    x, y, angle: Math.random() * Math.PI * 2, speed: 120,
    state: 'flee', timer: 3, color: '#e5484d', down: 0,
  };
}

function exitCar(state) {
  const car = playerCar(state);
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  const side = state.player.angle + Math.PI / 2;
  state.player.x = car.x + Math.cos(side) * 34;
  state.player.y = car.y + Math.sin(side) * 34;
  state.player.onFoot = true;
  state.player.car = null;
}

/** A punch on foot: hits pedestrians and police in front of the player. */
function punch(state) {
  const p = state.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = PLAYER.punchCooldown;
  p.punchFlash = 0.18;
  state.audio?.play('punch');
  const range = PLAYER.punchRange + 14;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = distTo(p, ped);
    if (d > range) continue;
    const a = Math.atan2(ped.y - p.y, ped.x - p.x);
    if (Math.abs(angleDiff(p.angle, a)) > PLAYER.punchArc) continue;
    ped.state = 'down';
    ped.down = 2.2;
    ped.vx = Math.cos(a) * 260;
    ped.vy = Math.sin(a) * 260;
    state.wanted.add(WANTED.hitPed, state);
    state.events.push({ kind: 'punch', x: ped.x, y: ped.y, t: 0 });
  }
  for (const cop of state.police) {
    if (cop.onFoot === false) continue;
    const d = distTo(p, cop);
    if (d > range) continue;
    const a = Math.atan2(cop.y - p.y, cop.x - p.x);
    if (Math.abs(angleDiff(p.angle, a)) > PLAYER.punchArc) continue;
    cop.health -= PLAYER.punchDamage;
    cop.stagger = 0.5;
    state.wanted.add(WANTED.punchCop, state);
    state.events.push({ kind: 'punch', x: cop.x, y: cop.y, t: 0 });
    if (cop.health <= 0) {
      cop.state = 'down';
      cop.down = 3;
    }
  }
}

/** Drive the player's car with arcade physics. */
function driveCar(state, car, input, dt) {
  const kind = CAR_KINDS[car.kind];
  const up = input.up;
  const down = input.down;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (up) car.speed += kind.accel * dt;
  if (down) {
    if (car.speed > 10) car.speed -= kind.brake * dt;
    else car.speed -= kind.accel * 0.55 * dt;
  }
  // Rolling resistance and drag.
  car.speed -= car.speed * 0.55 * dt;
  car.speed -= Math.sign(car.speed) * 14 * dt;
  if (Math.abs(car.speed) < 4 && !up && !down) car.speed = 0;
  car.speed = clamp(car.speed, -kind.reverse, kind.topSpeed);
  // Steering bites harder the faster the car goes, and reverses when reversing; a
  // little bite at low speed keeps the car manoeuvrable out of tight spots.
  const spd = clamp(Math.abs(car.speed) / 240, 0.18, 1);
  car.angle += steer * kind.grip * spd * (car.speed >= 0 ? 1 : -1) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 20, CITY.world - 20);
  car.y = clamp(car.y, 20, CITY.world - 20);
  // Engine sound follows speed.
  state.audio?.engine(Math.abs(car.speed) / kind.topSpeed);
  if (input.handbrake) car.speed *= (1 - 3.2 * dt);
}

/** Collide the car with buildings, other cars and pedestrians. */
function collideCar(state, car, dt) {
  const r = CAR.radius;
  for (const b of state.city.buildings) {
    const push = circleRectPush(car.x, car.y, r, b.x, b.y, b.w, b.h);
    if (!push) continue;
    const impact = Math.abs(car.speed);
    car.x += push.x;
    car.y += push.y;
    // A hard hit is a crash (speed cut, damage). A light scrape just pushes the car
    // off the wall — it must not bleed speed every frame or the car wedges in a
    // corner and can never build speed again.
    if (impact > 240) {
      car.speed *= 0.35;
      state.events.push({ kind: 'crash', x: car.x, y: car.y, t: 0 });
      state.audio?.play('crash');
      damagePlayer(state, Math.min(18, impact / 40));
    }
  }
  for (const other of state.cars) {
    if (other === car) continue;
    const push = circleCirclePush(car.x, car.y, r, other.x, other.y, CAR.radius);
    if (!push) continue;
    car.x += push.x;
    car.y += push.y;
    other.x -= push.x;
    other.y -= push.y;
    const rel = Math.abs(car.speed - other.speed);
    if (rel > 200) {
      car.speed *= 0.6;
      other.speed *= 0.6;
      state.events.push({ kind: 'crash', x: (car.x + other.x) / 2, y: (car.y + other.y) / 2, t: 0 });
      state.audio?.play('crash');
      if (other.driver === 'police') state.wanted.add(WANTED.ramPolice, state);
      damagePlayer(state, Math.min(14, rel / 50));
    }
  }
  // Running over a pedestrian is a serious crime.
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = distTo(car, ped);
    if (d < CAR.radius + 10 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.down = 2.6;
      const a = Math.atan2(ped.y - car.y, ped.x - car.x);
      ped.vx = Math.cos(a) * 300;
      ped.vy = Math.sin(a) * 300;
      car.speed *= 0.92;
      state.wanted.add(WANTED.hitPed, state);
      state.events.push({ kind: 'hit', x: ped.x, y: ped.y, t: 0 });
      state.audio?.play('hit');
    }
  }
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0 || amount <= 0) return;
  p.health -= amount;
  p.invulnerable = 0.5;
  if (p.health <= 0) {
    p.health = 0;
    state.screen = 'wasted';
    state.audio?.play('wasted');
  }
}

/** Step the player (on foot or driving) for one fixed step. */
export function stepPlayer(state, input, dt) {
  const p = state.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.punchFlash = Math.max(0, p.punchFlash - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  if (input.enter) {
    input.enter = false;
    if (p.onFoot) {
      const car = nearestCar(state);
      if (car) stealCar(state, car);
    } else {
      exitCar(state);
    }
  }
  if (input.punch) {
    input.punch = false;
    if (p.onFoot) punch(state);
  }

  const car = playerCar(state);
  if (car) {
    driveCar(state, car, input, dt);
    collideCar(state, car, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    return;
  }

  // On foot.
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.moving = mx !== 0 || my !== 0;
  p.run = !!input.run;
  const speed = p.run ? PLAYER.run : PLAYER.walk;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    const nx = mx / len;
    const ny = my / len;
    p.angle = Math.atan2(ny, nx);
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
  }
  p.x = clamp(p.x, 20, CITY.world - 20);
  p.y = clamp(p.y, 20, CITY.world - 20);
  for (const b of state.city.buildings) {
    const push = circleRectPush(p.x, p.y, PLAYER.radius, b.x, b.y, b.w, b.h);
    if (push) { p.x += push.x; p.y += push.y; }
  }
  // A moving car that hits the player on foot hurts.
  for (const other of state.cars) {
    const d = distTo(p, other);
    if (d < CAR.radius + PLAYER.radius && Math.abs(other.speed) > 90) {
      const a = Math.atan2(p.y - other.y, p.x - other.x);
      p.x += Math.cos(a) * 40;
      p.y += Math.sin(a) * 40;
      damagePlayer(state, Math.min(22, Math.abs(other.speed) / 30));
      state.events.push({ kind: 'hit', x: p.x, y: p.y, t: 0 });
    } else if (d < CAR.radius + PLAYER.radius) {
      const push = circleCirclePush(p.x, p.y, PLAYER.radius, other.x, other.y, CAR.radius);
      if (push) { p.x += push.x; p.y += push.y; }
    }
  }
  state.audio?.engine(0);
}
