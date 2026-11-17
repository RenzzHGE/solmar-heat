// Every tuning number and colour in one place. SOLMAR HEAT is a top-down open-world
// crime game: the playfield is a fixed world (WORLD x WORLD) and the camera follows the
// player; the renderer scales the view to the window, so no rule depends on screen size.

export const STEP = 1 / 60;

/** The city: a grid of blocks separated by roads. */
export const CITY = {
  world: 3008,
  grid: 7,
  block: 320,
  road: 96,
  pitch: 416,
  sidewalk: 18,
};

/** The player's on-foot movement. */
export const PLAYER = {
  radius: 14,
  walk: 175,
  run: 265,
  health: 100,
  punchRange: 34,
  punchArc: 1.1,
  punchDamage: 25,
  punchCooldown: 0.35,
  enterRange: 72,
};

/** Car kinds: speed, acceleration, handling and colour. */
export const CAR_KINDS = {
  sedan: { name: 'Sedan', topSpeed: 520, accel: 430, reverse: 190, grip: 3.5, brake: 620, color: '#e8b23a', dark: '#a87c1e' },
  sport: { name: 'Sport', topSpeed: 690, accel: 560, reverse: 210, grip: 4.2, brake: 700, color: '#e5484d', dark: '#9c2b2f' },
  taxi: { name: 'Taxi', topSpeed: 545, accel: 450, reverse: 190, grip: 3.6, brake: 640, color: '#f5c542', dark: '#b8931d' },
  truck: { name: 'Truck', topSpeed: 420, accel: 330, reverse: 160, grip: 2.8, brake: 520, color: '#7fb069', dark: '#4d7a3d' },
  police: { name: 'Police', topSpeed: 640, accel: 540, reverse: 210, grip: 4.0, brake: 720, color: '#2f6fed', dark: '#1b3f8f' },
};

export const CAR = {
  length: 52,
  width: 26,
  radius: 26,
  damageOnHit: 12,
  ramDamage: 18,
};

/** Traffic and pedestrians. */
export const TRAFFIC = {
  cars: 14,
  peds: 26,
  carSpeed: 150,
  carSpeedJitter: 55,
  pedSpeed: 42,
  pedSpeedJitter: 18,
  spawnMargin: 700,
};

/** The wanted system: 0-5 stars, police response and decay. */
export const WANTED = {
  max: 5,
  decaySeconds: 18,
  stealCar: 1,
  hitPed: 1,
  hitCop: 2,
  punchCop: 2,
  ramPolice: 1,
  policePerStar: [0, 1, 2, 3, 4, 5],
  bustSeconds: 2.0,
};

/** Missions: id, name, briefing and reward. */
export const MISSIONS = [
  { id: 'first-job', name: 'First Job', reward: 200, brief: 'Drive to the pickup point and meet Mara.' },
  { id: 'hot-package', name: 'Hot Package', reward: 500, brief: 'Collect 3 packages, then drop them at the garage.' },
  { id: 'lose-the-heat', name: 'Lose the Heat', reward: 800, brief: 'The cops are on you. Reach the hideout and lose them.' },
];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6b9a4b',
  sand: '#e8d5a0',
  sea: '#3f8fb5',
  seaDeep: '#2f6f92',
  road: '#3a3f47',
  roadLine: '#e8d44f',
  sidewalk: '#9aa0a8',
  crosswalk: '#d8dce2',
  buildingA: '#c98f5f',
  buildingB: '#7fa3c9',
  buildingC: '#b06a7a',
  buildingD: '#8fa98a',
  buildingE: '#d9b36c',
  roof: '#5b5348',
  window: '#ffe9a8',
  windowDark: '#3d4a5c',
  park: '#5e9a4e',
  tree: '#2f7a3d',
  treeLight: '#4da34d',
  player: '#2fd67a',
  playerDark: '#1a8f4f',
  police: '#2f6fed',
  policeLight: '#ff4d4d',
  pedShirt: ['#e5484d', '#4f8ef7', '#f2c94c', '#9b7ede', '#f28c38', '#38b6a6'],
  text: '#f4f6f8',
  muted: '#aab2bd',
  panel: 'rgba(12, 16, 24, 0.78)',
  gold: '#f2c94c',
  danger: '#ff5a5a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat.save.v1';
