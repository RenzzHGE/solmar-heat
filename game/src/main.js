// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between screens: title, play, paused, busted, wasted and win.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createWorld, resetWorld, saveGame, stepWorld } from './world.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const state = createWorld(seed, audio);
const renderer = createRenderer(canvas);

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput();
  let accumulator = 0;
  let last = performance.now();
  audio.setMuted(state.muted);

  function startGame() {
    resetWorld(state);
    state.screen = 'play';
    accumulator = 0;
    announce('Playing. Drive to the pickup point. E enters a car.');
  }

  function handleInput() {
    if (input.mute) {
      input.mute = false;
      state.muted = !state.muted;
      audio.setMuted(state.muted);
      audio.ensure();
    }
    if (input.pause) {
      input.pause = false;
      if (state.screen === 'play') {
        state.paused = !state.paused;
        announce(state.paused ? 'Paused.' : 'Playing.');
      }
      return;
    }
    if (input.confirm || input.clicked) {
      input.confirm = false;
      input.clicked = false;
      audio.ensure();
      audio.play('click');
      if (state.screen === 'title') startGame();
      else if (state.screen === 'busted' || state.screen === 'wasted') startGame();
      else if (state.screen === 'win') {
        // Keep playing in free roam after the win screen.
        state.screen = 'play';
        announce('Free roam. Grab packages for cash.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleInput();
    if (state.screen === 'title') {
      // The title screen's backdrop: traffic and pedestrians move, nothing scores.
      while (accumulator >= STEP) {
        stepWorld(state, { up: false, down: false, left: false, right: false, run: false, handbrake: false, enter: false, punch: false, confirm: false, pause: false, mute: false }, STEP);
        accumulator -= STEP;
      }
    } else if (state.screen === 'play' && !state.paused) {
      while (accumulator >= STEP) {
        stepWorld(state, input, STEP);
        accumulator -= STEP;
        if (state.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, state.paused && state.screen === 'play' ? 'paused' : state.screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.paused = true;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Test hook: a small read-only snapshot of the live state for automated play tests.
window.__gameState = () => {
  const car = state.cars.find((c) => c.driver === 'player') ?? null;
  return {
    screen: state.screen,
    paused: state.paused,
    onFoot: state.player.onFoot,
    health: Math.round(state.player.health),
    cash: state.cash,
    stars: state.wanted.stars,
    speedKmh: car ? Math.round(Math.abs(car.speed) * 0.36) : 0,
    carKind: car ? car.kind : null,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    mission: state.missions.index + 1,
    objective: state.missions.objective,
  };
};
