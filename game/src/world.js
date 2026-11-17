// The world: one state object, one fixed step. It owns the city, the player, the cars,
// the pedestrians, the police, the wanted level and the missions, and steps them in
// order. Screens (title, play, pause, busted, wasted, win) live here too, as does the
// save in localStorage.
import { CITY, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createPlayer, stepPlayer } from './player.js';
import { maintainCrowd, stepPed, stepTrafficCar } from './traffic.js';
import { createWanted, maintainPolice, stepPoliceUnit } from './police.js';
import { createMissions, stepMissions } from './missions.js';
import { clamp, lerp } from './utils.js';

export function createWorld(seed, audio) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed, rng, city, audio,
    time: 0,
    screen: 'title',
    paused: false,
    cash: 0,
    bestCash: 0,
    missionsDone: 0,
    events: [],
    camera: { x: city.playerSpawn.x, y: city.playerSpawn.y },
    muted: false,
  };
  resetWorld(state);
  loadSave(state);
  return state;
}

export function resetWorld(state) {
  const { city, rng } = state;
  state.player = createPlayer(city.playerSpawn);
  state.cars = [];
  state.peds = [];
  state.police = [];
  state.wanted = createWanted();
  state.missions = createMissions(state);
  state.cash = 0;
  state.time = 0;
  state.events = [];
  // The screen is the caller's business: createWorld leaves it on 'title' (so the
  // title shows on first load), startGame and stageShot set it to 'play'.
  state.camera.x = city.playerSpawn.x;
  state.camera.y = city.playerSpawn.y;
  // A parked car right by the spawn, on the road centre and facing along it, so the
  // first thing a player can do is drive.
  state.cars.push({
    id: 0, x: city.playerSpawn.x, y: city.playerSpawn.y + 52, angle: -Math.PI / 2,
    speed: 0, kind: 'sport', driver: null, color: '#e5484d', vertical: true, road: 3, dir: -1,
  });
  for (const parked of city.parked) {
    state.cars.push({
      id: state.cars.length, x: parked.x, y: parked.y, angle: parked.angle,
      speed: 0, kind: parked.kind, driver: null, color: '#c9a227', vertical: false, road: 0, dir: 1,
    });
  }
  maintainCrowd(state, rng, 0);
  maintainPolice(state, rng);
}

export function loadSave(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    state.bestCash = save.bestCash ?? 0;
    state.missionsDone = save.missionsDone ?? 0;
    state.muted = !!save.muted;
  } catch { /* a corrupt save is just ignored */ }
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      bestCash: Math.max(state.bestCash, state.cash),
      missionsDone: state.missions.done.length,
      muted: state.muted,
    }));
  } catch { /* storage may be unavailable */ }
}

/** One fixed step of the whole simulation. */
export function stepWorld(state, input, dt) {
  state.time += dt;
  // Transient visual events age out.
  for (const e of state.events) e.t += dt;
  state.events = state.events.filter((e) => e.t < 0.9);

  if (state.screen !== 'play' || state.paused) {
    state.audio?.engine(0);
    state.audio?.siren(false);
    return;
  }

  stepPlayer(state, input, dt);
  for (const car of state.cars) {
    if (car.driver === 'traffic') stepTrafficCar(state, car, dt);
  }
  for (const ped of state.peds) stepPed(state, ped, dt);
  state.wanted.decay(dt, state);
  maintainPolice(state, state.rng);
  for (const cop of state.police) stepPoliceUnit(state, cop, dt);
  // Remove downed cops whose timer ran out.
  state.police = state.police.filter((c) => c.state !== 'down' || c.down > 0);
  maintainCrowd(state, state.rng, dt);
  stepMissions(state, dt);

  // Slow health regen when the heat is off.
  if (state.wanted.stars === 0 && state.player.health > 0) {
    state.player.health = Math.min(100, state.player.health + 2.2 * dt);
  }

  // Siren while any police are close.
  const nearCop = state.police.some((c) => c.state !== 'down' && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
  state.audio?.siren(nearCop && state.wanted.stars > 0);

  // The camera chases the player smoothly.
  const p = state.player;
  state.camera.x = lerp(state.camera.x, p.x, 1 - Math.pow(0.0015, dt));
  state.camera.y = lerp(state.camera.y, p.y, 1 - Math.pow(0.0015, dt));
  state.camera.x = clamp(state.camera.x, 0, CITY.world);
  state.camera.y = clamp(state.camera.y, 0, CITY.world);

  if (state.screen === 'busted' || state.screen === 'wasted' || state.screen === 'win') {
    saveGame(state);
  }
}
