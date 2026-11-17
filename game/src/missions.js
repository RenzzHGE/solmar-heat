// Missions and the story spine. Rex, a driver for hire in Solmar, takes jobs from Mara
// the fixer. Three jobs in order, then free roam with repeatable package runs for cash.
// A mission is a small state machine: an objective, a target point, and a reward.
import { CITY, MISSIONS, WANTED } from './config.js';
import { roadCenter } from './city.js';

function marker(x, y, label) {
  return { x, y, label, radius: 34 };
}

/** Build the mission set for a city: markers are placed on roads and in the lot. */
export function createMissions(state) {
  const g = state.city.garage;
  const pickup = marker(roadCenter(5) + 10, roadCenter(2), 'Pickup');
  const drop = marker(g.x + g.w / 2, g.y + g.h / 2, 'Garage');
  const hideout = marker(g.x + g.w / 2, g.y + g.h / 2, 'Hideout');
  const packages = [
    marker(roadCenter(1), roadCenter(5) + 20, 'Package 1'),
    marker(roadCenter(6) - 10, roadCenter(1), 'Package 2'),
    marker(roadCenter(4), roadCenter(6) - 20, 'Package 3'),
  ];
  return {
    index: 0,
    phase: 'go',
    done: [],
    cash: 0,
    objective: 'Drive to the pickup point.',
    target: pickup,
    packages: packages.map((m) => ({ ...m, got: false })),
    pickup, drop, hideout,
    packageCount: 0,
    heatTimer: 0,
  };
}

function completeMission(state, reward) {
  const m = state.missions;
  const job = MISSIONS[m.index];
  m.cash += reward;
  m.done.push(job.id);
  state.cash = (state.cash ?? 0) + reward;
  state.events.push({ kind: 'mission', x: state.player.x, y: state.player.y, t: 0 });
  state.audio?.play('mission');
  m.index += 1;
  if (m.index >= MISSIONS.length) {
    m.phase = 'freeroam';
    m.objective = 'You own Solmar. Grab packages for cash — watch the heat.';
    m.target = null;
    state.screen = 'win';
    state.audio?.play('win');
    return;
  }
  const next = MISSIONS[m.index];
  if (next.id === 'hot-package') {
    m.phase = 'collect';
    m.packageCount = 0;
    m.packages.forEach((pk) => { pk.got = false; });
    m.target = m.packages[0];
    m.objective = 'Collect the 3 packages (0/3).';
  } else if (next.id === 'lose-the-heat') {
    m.phase = 'heat';
    m.heatTimer = 0;
    state.wanted.add(3, state);
    m.target = m.hideout;
    m.objective = 'Wanted! Reach the hideout and lose the cops.';
  }
}

function near(state, target, radius = 46) {
  if (!target) return false;
  const dx = state.player.x - target.x;
  const dy = state.player.y - target.y;
  return dx * dx + dy * dy < radius * radius;
}

/** Step the mission logic for one fixed step. */
export function stepMissions(state, dt) {
  const m = state.missions;
  if (!m || m.index >= MISSIONS.length) {
    // Free roam: package respawns pay $150 each.
    if (m && m.phase === 'freeroam') {
      const pk = m.packages.find((p) => !p.got);
      if (pk && near(state, pk)) {
        pk.got = true;
        m.cash += 150;
        state.cash = (state.cash ?? 0) + 150;
        state.audio?.play('pickup');
        state.events.push({ kind: 'pickup', x: pk.x, y: pk.y, t: 0 });
        setTimeout(() => { pk.got = false; }, 20000);
        m.target = m.packages.find((p) => !p.got) ?? null;
        m.objective = m.target ? 'Package run: grab the next package.' : 'Package run: grab the next package.';
      }
    }
    return;
  }
  const job = MISSIONS[m.index];
  if (job.id === 'first-job') {
    m.target = m.pickup;
    m.objective = 'Drive to the pickup point.';
    if (near(state, m.pickup)) completeMission(state, job.reward);
    return;
  }
  if (job.id === 'hot-package') {
    if (m.phase === 'collect') {
      const next = m.packages.find((p) => !p.got);
      m.target = next ?? m.drop;
      m.objective = next ? `Collect the 3 packages (${m.packageCount}/3).` : 'Deliver the packages to the garage.';
      if (next && near(state, next)) {
        next.got = true;
        m.packageCount += 1;
        state.audio?.play('pickup');
        state.events.push({ kind: 'pickup', x: next.x, y: next.y, t: 0 });
        if (m.packageCount >= 3) m.phase = 'deliver';
      }
      return;
    }
    m.target = m.drop;
    m.objective = 'Deliver the packages to the garage.';
    if (near(state, m.drop)) completeMission(state, job.reward);
    return;
  }
  if (job.id === 'lose-the-heat') {
    m.target = m.hideout;
    m.heatTimer += dt;
    if (state.wanted.stars === 0) {
      m.objective = 'Clean! Reach the hideout to finish.';
      if (near(state, m.hideout, 70)) completeMission(state, job.reward);
    } else {
      m.objective = `Wanted ${'★'.repeat(state.wanted.stars)} — reach the hideout and lose them.`;
    }
  }
}
