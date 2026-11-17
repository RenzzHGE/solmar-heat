// Traffic and pedestrians: the city that lives around the player. Traffic cars follow
// the road grid in lanes, turn at intersections and brake for the car ahead.
// Pedestrians walk the sidewalks, cross at crosswalks and flee from danger.
import { CAR, CAR_KINDS, CITY, TRAFFIC } from './config.js';
import { angleDiff, clamp, int, pick } from './utils.js';
import { isOnRoad, roadCenter } from './city.js';

const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'taxi', 'sport', 'truck'];
const PED_COLORS = ['#e5484d', '#4f8ef7', '#f2c94c', '#9b7ede', '#f28c38', '#38b6a6'];

let nextCarId = 1;

/** Spawn a traffic car on a road near the player. */
export function spawnTrafficCar(state, rng) {
  const p = state.player;
  const vertical = rng() < 0.5;
  const road = int(rng, 0, CITY.grid);
  const dir = rng() < 0.5 ? 1 : -1;
  const along = p.x + (rng() - 0.5) * 1600;
  const across = p.y + (rng() - 0.5) * 1600;
  let x, y, angle;
  if (vertical) {
    x = roadCenter(road) + (dir > 0 ? 12 : -12);
    y = clamp(along, 40, CITY.world - 40);
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = clamp(across, 40, CITY.world - 40);
    y = roadCenter(road) + (dir > 0 ? 12 : -12);
    angle = dir > 0 ? 0 : Math.PI;
  }
  const kind = pick(rng, TRAFFIC_KINDS);
  return {
    id: nextCarId++, x, y, angle, speed: TRAFFIC.carSpeed + (rng() - 0.5) * TRAFFIC.carSpeedJitter,
    kind, driver: 'traffic', vertical, road, dir,
    color: CAR_KINDS[kind].color, brake: 0,
  };
}

/** Spawn a pedestrian on a sidewalk near the player. */
export function spawnPed(state, rng) {
  const p = state.player;
  const x = clamp(p.x + (rng() - 0.5) * 1400, 30, CITY.world - 30);
  const y = clamp(p.y + (rng() - 0.5) * 1400, 30, CITY.world - 30);
  return {
    x, y, angle: rng() * Math.PI * 2,
    speed: TRAFFIC.pedSpeed + (rng() - 0.5) * TRAFFIC.pedSpeedJitter,
    state: 'walk', timer: 2 + rng() * 6, color: pick(rng, PED_COLORS),
    down: 0, vx: 0, vy: 0, target: null,
  };
}

/** Keep the traffic and pedestrian counts topped up around the player. */
export function maintainCrowd(state, rng, dt) {
  const p = state.player;
  // Traffic cars: remove the far ones, add near ones.
  state.cars = state.cars.filter((c) => {
    if (c.driver !== 'traffic') return true;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    return d < 1500;
  });
  const trafficCount = state.cars.filter((c) => c.driver === 'traffic').length;
  for (let i = trafficCount; i < TRAFFIC.cars; i += 1) {
    state.cars.push(spawnTrafficCar(state, rng));
  }
  state.peds = state.peds.filter((ped) => {
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    return d < 1300;
  });
  for (let i = state.peds.length; i < TRAFFIC.peds; i += 1) {
    state.peds.push(spawnPed(state, rng));
  }
}

/** Is there a car directly ahead of this car (same lane, close)? */
function carAhead(state, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = Infinity;
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 10 || along > 110) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 26 && along < best) best = along;
  }
  return best;
}

/** Step one traffic car: follow its lane, turn at intersections, brake for traffic. */
export function stepTrafficCar(state, car, dt) {
  const ahead = carAhead(state, car);
  const want = TRAFFIC.carSpeed;
  if (ahead < 70) {
    car.speed = Math.max(0, car.speed - 500 * dt);
  } else if (ahead < 130) {
    car.speed = Math.max(want * 0.4, car.speed - 260 * dt);
  } else {
    car.speed = Math.min(want, car.speed + 130 * dt);
  }
  // At an intersection centre, sometimes turn onto the crossing road.
  const cx = car.x;
  const cy = car.y;
  if (car.vertical) {
    const near = Math.abs(((cy % CITY.pitch) + CITY.pitch) % CITY.pitch - CITY.road / 2) < 6;
    if (near && Math.random() < 0.012) {
      car.vertical = false;
      car.dir = Math.random() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = roadCenter(Math.round((cy - CITY.road / 2) / CITY.pitch)) + (car.dir > 0 ? 12 : -12);
    }
  } else {
    const near = Math.abs(((cx % CITY.pitch) + CITY.pitch) % CITY.pitch - CITY.road / 2) < 6;
    if (near && Math.random() < 0.012) {
      car.vertical = true;
      car.dir = Math.random() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = roadCenter(Math.round((cx - CITY.road / 2) / CITY.pitch)) + (car.dir > 0 ? 12 : -12);
    }
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 20, CITY.world - 20);
  car.y = clamp(car.y, 20, CITY.world - 20);
  // Keep it on the road: if it drifted onto a block, nudge it back to its lane.
  if (!isOnRoad(car.x, car.y)) {
    if (car.vertical) {
      const centre = roadCenter(Math.round((car.x - CITY.road / 2) / CITY.pitch));
      car.x += (centre + (car.dir > 0 ? 12 : -12) - car.x) * 0.2;
    } else {
      const centre = roadCenter(Math.round((car.y - CITY.road / 2) / CITY.pitch));
      car.y += (centre + (car.dir > 0 ? 12 : -12) - car.y) * 0.2;
    }
  }
  // Gentle separation from other cars.
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 52 * 52 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      car.x += (dx / d) * 1.2;
      car.y += (dy / d) * 1.2;
    }
  }
}

/** Step one pedestrian: walk, cross, flee, or lie down after being hit. */
export function stepPed(state, ped, dt) {
  if (ped.state === 'down') {
    ped.down -= dt;
    ped.x += (ped.vx ?? 0) * dt;
    ped.y += (ped.vy ?? 0) * dt;
    ped.vx = (ped.vx ?? 0) * (1 - 4 * dt);
    ped.vy = (ped.vy ?? 0) * (1 - 4 * dt);
    if (ped.down <= 0) {
      ped.state = 'flee';
      ped.timer = 2.5;
    }
    return;
  }
  ped.timer -= dt;
  const p = state.player;
  const dPlayer = Math.hypot(ped.x - p.x, ped.y - p.y);
  const playerCar = state.cars.find((c) => c.driver === 'player');
  const threat = playerCar && Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y) < 120 && Math.abs(playerCar.speed) > 120;
  if ((dPlayer < 90 && !p.onFoot) || threat || ped.state === 'flee') {
    if (ped.state !== 'flee') { ped.state = 'flee'; ped.timer = 2; }
    const away = Math.atan2(ped.y - p.y, ped.x - p.x);
    ped.angle = away;
    ped.x += Math.cos(away) * 150 * dt;
    ped.y += Math.sin(away) * 150 * dt;
    if (ped.timer <= 0) { ped.state = 'walk'; ped.timer = 2 + Math.random() * 6; }
    return;
  }
  if (ped.state === 'walk' && ped.timer <= 0) {
    // Pick a new heading: mostly along a sidewalk, sometimes across a road.
    ped.angle = Math.floor(Math.random() * 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.3;
    ped.timer = 2 + Math.random() * 6;
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  ped.x = clamp(ped.x, 20, CITY.world - 20);
  ped.y = clamp(ped.y, 20, CITY.world - 20);
  // Stay out of buildings.
  for (const b of state.city.buildings) {
    if (ped.x > b.x - 6 && ped.x < b.x + b.w + 6 && ped.y > b.y - 6 && ped.y < b.y + b.h + 6) {
      ped.angle += Math.PI / 2;
      ped.x = clamp(ped.x, b.x - 8, b.x + b.w + 8);
      ped.y = clamp(ped.y, b.y - 8, b.y + b.h + 8);
    }
  }
}
