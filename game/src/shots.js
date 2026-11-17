// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame. Driving uses road-following waypoints (Manhattan path on
// the road grid) so the car stays on roads instead of cutting through buildings.
import { CITY, STEP } from './config.js';
import { resetWorld, stepWorld } from './world.js';
import { playerCar } from './player.js';
import { angleDiff } from './utils.js';
import { roadCenter } from './city.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 4;
const CHASE_SECONDS = 4;
const MISSION_SECONDS = 10;

function blankInput() {
  return {
    up: false, down: false, left: false, right: false,
    run: false, handbrake: false, enter: false, punch: false,
    confirm: false, pause: false, mute: false,
  };
}

/** Centre of the vertical/horizontal road nearest to a coordinate. */
function nearestRoad(v) {
  const i = Math.round((v - CITY.road / 2) / CITY.pitch);
  return roadCenter(Math.max(0, Math.min(CITY.grid, i)));
}

/**
 * A Manhattan route on the road grid from (fx, fy) to (tx, ty): a list of waypoints
 * that stays on roads. The car follows them in order.
 */
function roadRoute(fx, fy, tx, ty) {
  const vx = nearestRoad(fx);
  const hy = nearestRoad(fy);
  const tvx = nearestRoad(tx);
  const thy = nearestRoad(ty);
  const onVertical = Math.abs(fx - vx) <= Math.abs(fy - hy);
  const points = [];
  if (onVertical) {
    points.push({ x: vx, y: thy });
    points.push({ x: tvx, y: thy });
    points.push({ x: tvx, y: ty });
  } else {
    points.push({ x: tvx, y: hy });
    points.push({ x: tvx, y: thy });
    points.push({ x: tx, y: thy });
  }
  points.push({ x: tx, y: ty });
  return points;
}

/** Drive through a route's waypoints: gas on, steer toward the current one. */
function makeRouteDriver(route) {
  let index = 0;
  return function driveRoute(state) {
    const input = blankInput();
    const car = playerCar(state);
    if (!car) return input;
    while (index < route.length - 1) {
      const wp = route[index];
      const d = Math.hypot(wp.x - car.x, wp.y - car.y);
      if (d < 55) index += 1;
      else break;
    }
    const wp = route[Math.min(index, route.length - 1)];
    const target = Math.atan2(wp.y - car.y, wp.x - car.x);
    const diff = angleDiff(car.angle, target);
    // Ease off the gas on a sharp turn so the car slows and turns tighter.
    input.up = Math.abs(diff) < 0.6;
    if (Math.abs(diff) >= 0.6 && Math.abs(car.speed) > 260) input.down = true;
    if (diff > 0.1) input.right = true;
    else if (diff < -0.1) input.left = true;
    return input;
  };
}

/** Walk toward a point on foot. */
function walkToward(state, tx, ty) {
  const input = blankInput();
  const p = state.player;
  const target = Math.atan2(ty - p.y, tx - p.x);
  const dx = Math.cos(target);
  const dy = Math.sin(target);
  input.right = dx > 0.3;
  input.left = dx < -0.3;
  input.down = dy > 0.3;
  input.up = dy < -0.3;
  input.run = true;
  return input;
}

/**
 * Set `state` to the named scene (start, drive, chase or mission; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  resetWorld(state);
  state.screen = 'play';
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    // Title: let traffic and pedestrians move for a few seconds over a busy crossing.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      stepWorld(state, blankInput(), STEP);
    }
    state.screen = 'title';
    return { screen: 'title' };
  }
  if (name === 'drive') {
    // Get in the sport car and drive the road route to the current job objective.
    stepWorld(state, { ...blankInput(), enter: true }, STEP);
    const t = state.missions.target ?? state.missions.pickup;
    const route = roadRoute(state.player.x, state.player.y, t.x, t.y);
    const drive = makeRouteDriver(route);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      stepWorld(state, drive(state), STEP);
      if (state.screen !== 'play') break;
    }
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // Steal the sport car and set the heat to exactly 3 stars, then run the road route
    // toward the far corner — with two police cars placed close enough to be in the frame.
    stepWorld(state, { ...blankInput(), enter: true }, STEP);
    state.wanted.stars = 3;
    state.wanted.cleanTimer = 0;
    const p = state.player;
    const behind = p.angle + Math.PI;
    state.police.push({
      id: 9001, x: p.x + Math.cos(behind) * 520, y: p.y + Math.sin(behind) * 520,
      angle: p.angle, speed: 420, kind: 'police', driver: 'police', onFoot: false,
      health: 60, state: 'chase', stagger: 0, down: 0, bustTimer: 0, siren: 0,
    });
    state.police.push({
      id: 9002, x: p.x + Math.cos(behind + 0.6) * 640, y: p.y + Math.sin(behind + 0.6) * 640,
      angle: p.angle, speed: 400, kind: 'police', driver: 'police', onFoot: false,
      health: 60, state: 'chase', stagger: 0, down: 0, bustTimer: 0, siren: 1,
    });
    // A long two-leg run — south, then east — so the car keeps moving for the whole
    // scene instead of stopping at a dead end, with the police chasing behind it.
    const far = { x: roadCenter(6), y: roadCenter(6) };
    const route = roadRoute(p.x, p.y, far.x, far.y);
    const drive = makeRouteDriver(route);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      stepWorld(state, drive(state), STEP);
      if (state.screen !== 'play') break;
    }
    return { screen: 'play' };
  }
  // mission: on foot, walk to the first package of the Hot Package job.
  state.missions.index = 1;
  state.missions.phase = 'collect';
  state.missions.packageCount = 0;
  state.missions.packages.forEach((pk) => { pk.got = false; });
  state.missions.target = state.missions.packages[0];
  state.missions.objective = 'Collect the 3 packages (0/3).';
  // Put the player near the first package.
  const pk = state.missions.packages[0];
  state.player.x = pk.x - 180;
  state.player.y = pk.y + 60;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    stepWorld(state, walkToward(state, pk.x, pk.y), STEP);
    if (state.screen !== 'play') break;
  }
  return { screen: 'play' };
}
