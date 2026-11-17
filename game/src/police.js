// The wanted system and the police. Stars rise with crimes and fall when the player
// stays clean. Police cars chase and ram; foot cops chase and punch. A cop that holds
// the player on foot busts them; a player with no health is wasted.
import { CAR_KINDS, CITY, PLAYER, WANTED } from './config.js';
import { angleDiff, clamp } from './utils.js';
import { roadCenter } from './city.js';

let nextCopId = 1;

export function createWanted() {
  return {
    stars: 0,
    cleanTimer: 0,
    add(n, state) {
      if (state.screen !== 'play') return;
      this.stars = Math.min(WANTED.max, this.stars + n);
      this.cleanTimer = 0;
      if (this.stars > 0) state.audio?.play('siren-blip');
    },
    decay(dt, state) {
      if (this.stars === 0) return;
      this.cleanTimer += dt;
      if (this.cleanTimer >= WANTED.decaySeconds) {
        this.stars -= 1;
        this.cleanTimer = 0;
        if (this.stars === 0) state.events.push({ kind: 'clean', x: state.player.x, y: state.player.y, t: 0 });
      }
    },
  };
}

function spawnPoliceCar(state, rng) {
  const p = state.player;
  const angle = rng() * Math.PI * 2;
  const dist = 620 + rng() * 300;
  const x = clamp(p.x + Math.cos(angle) * dist, 40, CITY.world - 40);
  const y = clamp(p.y + Math.sin(angle) * dist, 40, CITY.world - 40);
  return {
    id: nextCopId++, x, y, angle: Math.atan2(p.y - y, p.x - x),
    speed: 0, kind: 'police', driver: 'police', onFoot: false,
    health: 60, state: 'chase', stagger: 0, down: 0, bustTimer: 0,
    siren: rng() * 2,
  };
}

function spawnFootCop(state, rng) {
  const p = state.player;
  const angle = rng() * Math.PI * 2;
  const dist = 320 + rng() * 200;
  return {
    id: nextCopId++, x: clamp(p.x + Math.cos(angle) * dist, 30, CITY.world - 30),
    y: clamp(p.y + Math.sin(angle) * dist, 30, CITY.world - 30),
    angle: 0, speed: 0, kind: 'police', driver: 'police', onFoot: true,
    health: 40, state: 'chase', stagger: 0, down: 0, bustTimer: 0, punchCooldown: 0,
  };
}

/** Keep the police count matched to the wanted level. */
export function maintainPolice(state, rng) {
  const want = WANTED.policePerStar[state.wanted.stars] ?? 0;
  const active = state.police.filter((c) => c.state !== 'down').length;
  if (active < want) {
    // At 3+ stars one of the responders comes on foot when the player is on foot.
    const foot = state.wanted.stars >= 3 && state.player.onFoot && !state.police.some((c) => c.onFoot && c.state !== 'down');
    state.police.push(foot ? spawnFootCop(state, rng) : spawnPoliceCar(state, rng));
  }
  // Drop far-away or downed cops once the heat is off.
  state.police = state.police.filter((c) => {
    if (c.state === 'down') return c.down > 0;
    if (state.wanted.stars === 0) return false;
    const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
    return d < 1600;
  });
}

/** One police unit's pursuit for a fixed step. */
export function stepPoliceUnit(state, cop, dt) {
  const p = state.player;
  cop.siren += dt;
  if (cop.state === 'down') {
    cop.down -= dt;
    return;
  }
  cop.stagger = Math.max(0, cop.stagger - dt);
  if (cop.stagger > 0) return;
  const dx = p.x - cop.x;
  const dy = p.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  const target = Math.atan2(dy, dx);

  if (!cop.onFoot) {
    // Police car: steer toward the player, ram on contact, slow near buildings.
    const kind = CAR_KINDS.police;
    cop.ramCooldown = Math.max(0, (cop.ramCooldown ?? 0) - dt);
    const diff = angleDiff(cop.angle, target);
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const want = dist > 320 ? kind.topSpeed : kind.topSpeed * 0.75;
    cop.speed = Math.min(want, cop.speed + kind.accel * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 20, CITY.world - 20);
    cop.y = clamp(cop.y, 20, CITY.world - 20);
    for (const b of state.city.buildings) {
      if (cop.x > b.x - 20 && cop.x < b.x + b.w + 20 && cop.y > b.y - 20 && cop.y < b.y + b.h + 20) {
        cop.speed *= 0.4;
        cop.angle += 1.2 * dt;
      }
    }
    // Ramming the player's car damages it (and the player); touching the player on foot busts.
    // A ram is one hit with a cooldown — without it, a cop in contact drains 4 HP every
    // frame (240/s) and pins the car at zero speed, which is an instant death.
    const car = state.cars.find((c) => c.driver === 'player');
    if (car && dist < 58 && (cop.ramCooldown ?? 0) <= 0) {
      cop.ramCooldown = 1.0;
      car.speed *= 0.55;
      cop.speed *= 0.6;
      state.events.push({ kind: 'crash', x: (car.x + cop.x) / 2, y: (car.y + cop.y) / 2, t: 0 });
      state.audio?.play('crash');
      p.health = Math.max(0, p.health - 4);
      if (p.health <= 0) { state.screen = 'wasted'; state.audio?.play('wasted'); }
    }
    if (p.onFoot && dist < 30) {
      cop.bustTimer += dt;
      if (cop.bustTimer >= WANTED.bustSeconds) {
        state.screen = 'busted';
        state.audio?.play('busted');
      }
    } else {
      cop.bustTimer = 0;
    }
    return;
  }

  // Foot cop: run at the player and punch in range.
  cop.punchCooldown = Math.max(0, (cop.punchCooldown ?? 0) - dt);
  const speed = 235;
  cop.angle = target;
  cop.x += Math.cos(target) * speed * dt;
  cop.y += Math.sin(target) * speed * dt;
  if (dist < 30) {
    cop.bustTimer += dt;
    if (cop.bustTimer >= WANTED.bustSeconds) {
      state.screen = 'busted';
      state.audio?.play('busted');
    }
  } else {
    cop.bustTimer = 0;
  }
  if (dist < 36 && cop.punchCooldown <= 0) {
    cop.punchCooldown = 0.8;
    p.health = Math.max(0, p.health - 8);
    p.invulnerable = 0.3;
    state.audio?.play('punch');
    state.events.push({ kind: 'punch', x: p.x, y: p.y, t: 0 });
    if (p.health <= 0) { state.screen = 'wasted'; state.audio?.play('wasted'); }
  }
}
