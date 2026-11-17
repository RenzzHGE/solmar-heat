// Drawing only: the world's state and the current screen in, pixels out. A top-down
// camera follows the player over the city; the HUD, the minimap and the menus are drawn
// in screen space on top. Flat shapes and canvas text, warm sun-soaked colours.
import { CAR, CITY, FONT, PALETTE } from './config.js';
import { clamp } from './utils.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

/** World units shown across the view's width. */
const VIEW_WIDTH = 1150;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, w: 0, h: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.w = Math.round(window.innerWidth * ratio);
    view.h = Math.round(window.innerHeight * ratio);
    canvas.width = view.w;
    canvas.height = view.h;
    view.scale = view.w / VIEW_WIDTH;
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`.trim());
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGround(state) {
    const { city } = state;
    const W = CITY.world;
    // A wide grass base so the camera never shows the void past the world's edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(-900, -900, W + 1800, W + 1800);
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, W, W);
    // Beach and sea along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, city.beach.y0, W, city.beach.y1 - city.beach.y0);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, city.beach.seaY, W, W - city.beach.seaY);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < W; x += 90) {
      ctx.fillRect(x, city.beach.seaY + 12 + ((x * 7) % 20), 44, 3);
    }
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.sea;
      ctx.beginPath();
      ctx.ellipse(park.x + park.w * 0.68, park.y + park.h * 0.62, 46, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Parking lots.
    for (const lot of city.lots) {
      ctx.fillStyle = '#565b63';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        ctx.strokeRect(lot.x + 42 + i * 52, lot.y + 52, 40, 66);
        ctx.strokeRect(lot.x + 42 + i * 52, lot.y + lot.h - 118, 40, 66);
      }
    }
    // Sidewalks (the block edges) then the road bands.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let i = 0; i <= CITY.grid; i += 1) {
      ctx.fillRect(i * CITY.pitch - 4, 0, CITY.road + 8, W);
      ctx.fillRect(0, i * CITY.pitch - 4, W, CITY.road + 8);
    }
    ctx.fillStyle = PALETTE.road;
    for (const r of city.vertical) ctx.fillRect(r.x0, 0, CITY.road, W);
    for (const r of city.horizontal) ctx.fillRect(0, r.y0, W, CITY.road);
    // Lane dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const r of city.vertical) {
      for (let y = 0; y < W; y += 56) {
        if (isIntersection(y)) continue;
        ctx.fillRect(r.center - 2, y, 4, 26);
      }
    }
    for (const r of city.horizontal) {
      for (let x = 0; x < W; x += 56) {
        if (isIntersection(x)) continue;
        ctx.fillRect(x, r.center - 2, 26, 4);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const v of city.vertical) {
      for (const h of city.horizontal) {
        for (let s = -30; s <= 30; s += 14) {
          ctx.fillRect(v.center - 34 + s, h.y0 + 8, 8, 18);
          ctx.fillRect(v.center - 34 + s, h.y1 - 26, 8, 18);
          ctx.fillRect(v.x0 + 8, h.center - 34 + s, 18, 8);
          ctx.fillRect(v.x1 - 26, h.center - 34 + s, 18, 8);
        }
      }
    }
    // Garage / hideout: a distinct building with a sign.
    const g = city.garage;
    ctx.fillStyle = '#3d4450';
    ctx.fillRect(g.x - 6, g.y - 6, g.w + 12, g.h + 12);
    ctx.fillStyle = '#e8b23a';
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(g.x + 8, g.y + 10, g.w - 16, 22);
    text('GARAGE', g.x + g.w / 2, g.y + 27, 13, '#f2c94c', 'center', 'bold');
    // Buildings: shadow, body, roof inset, windows.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3 + b.floors) % 4 === 0) continue;
          ctx.fillRect(b.x + 14 + c * 34, b.y + 14 + r * 34, 16, 12);
        }
      }
      if (b.roof) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 6);
      }
    }
    // Trees.
    for (const t of city.trees) drawTree(t.x, t.y, t.s, t.palm);
  }

  function isIntersection(v) {
    const r = ((v % CITY.pitch) + CITY.pitch) % CITY.pitch;
    return r < CITY.road + 20;
  }

  function drawTree(x, y, s, palm) {
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x - 2 * s, y - 4 * s, 4 * s, 10 * s);
    if (palm) {
      ctx.strokeStyle = PALETTE.treeLight;
      ctx.lineWidth = 3 * s;
      for (let a = 0; a < 5; a += 1) {
        const ang = (a / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 4 * s);
        ctx.quadraticCurveTo(x + Math.cos(ang) * 14 * s, y - 4 * s + Math.sin(ang) * 14 * s - 6 * s, x + Math.cos(ang) * 20 * s, y - 4 * s + Math.sin(ang) * 20 * s + 4 * s);
        ctx.stroke();
      }
      ctx.fillStyle = '#7a5a35';
      ctx.beginPath();
      ctx.arc(x, y - 4 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(x, y - 8 * s, 11 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(x - 4 * s, y - 12 * s, 6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, isPlayer, time) {
    const kind = car.kind;
    const len = CAR.length;
    const wid = CAR.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(-len / 2 + 3, -wid / 2 + 4, len, wid, 8);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-len / 2, -wid / 2, len, wid, 8);
    ctx.fill();
    // Roof + windshield.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(-len / 2 + 12, -wid / 2 + 4, len - 26, wid - 8, 5);
    ctx.fill();
    ctx.fillStyle = '#bcd8ea';
    ctx.fillRect(len / 2 - 16, -wid / 2 + 5, 8, wid - 10);
    // Wheels.
    ctx.fillStyle = '#15181d';
    ctx.fillRect(-len / 2 + 4, -wid / 2 - 3, 12, 5);
    ctx.fillRect(-len / 2 + 4, wid / 2 - 2, 12, 5);
    ctx.fillRect(len / 2 - 16, -wid / 2 - 3, 12, 5);
    ctx.fillRect(len / 2 - 16, wid / 2 - 2, 12, 5);
    // Headlights.
    ctx.fillStyle = '#fff6b0';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 4, 3, 5);
    ctx.fillRect(len / 2 - 2, wid / 2 - 9, 3, 5);
    // Police light bar, flashing.
    if (kind === 'police') {
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff4d4d' : '#2f6fed';
      ctx.fillRect(-6, -wid / 2 + 2, 12, 8);
      ctx.fillStyle = flash ? '#2f6fed' : '#ff4d4d';
      ctx.fillRect(-6, wid / 2 - 10, 12, 8);
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(-len / 2 + 2, -wid / 2 + 2, 10, wid - 4);
    }
    // Player marker: a small white ring so the eye finds your car.
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, len / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped, time) {
    if (ped.state === 'down') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = ped.state === 'flee' ? Math.sin(time * 14) * 1.5 : Math.sin(time * 6 + ped.x) * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob - 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (!p.onFoot) return;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0) return;
    const bob = p.moving ? Math.sin(time * (p.run ? 16 : 11)) * 1.6 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob - 3, 6, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12 + bob);
    ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20 + bob);
    ctx.stroke();
    // Punch flash.
    if (p.punchFlash > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${p.punchFlash / 0.18})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30, p.angle - 1.1, p.angle + 1.1);
      ctx.stroke();
    }
  }

  function drawMarkers(state, time) {
    const m = state.missions;
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    const drawTarget = (t, color, label) => {
      if (!t) return;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, (t.radius ?? 34) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, (t.radius ?? 34) * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Beacon pillar.
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(-4, -140, 8, 140);
      ctx.globalAlpha = 1;
      // Star.
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 11 : 5;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r - 46);
      }
      ctx.closePath();
      ctx.fill();
      text(label, 0, -62, 13, '#ffffff', 'center', 'bold');
      ctx.restore();
    };
    if (m.target) drawTarget(m.target, '#f2c94c', m.target.label ?? 'Go');
    for (const pk of m.packages) {
      if (pk.got) continue;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#8a6d1d';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.fillStyle = '#8a6d1d';
      text('$', 0, 5, 14, '#8a6d1d', 'center', 'bold');
      ctx.restore();
    }
  }

  function drawEvents(state) {
    for (const e of state.events) {
      const a = 1 - e.t / 0.9;
      if (e.kind === 'crash') {
        ctx.fillStyle = `rgba(255,170,40,${a})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 8 + e.t * 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 4 + e.t * 22, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'punch' || e.kind === 'hit') {
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 10 + e.t * 34, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'pickup') {
        text('+$', e.x, e.y - e.t * 40, 20, `rgba(242,201,76,${a})`, 'center', 'bold');
      } else if (e.kind === 'mission') {
        text('JOB DONE', e.x, e.y - e.t * 46, 22, `rgba(242,201,76,${a})`, 'center', 'bold');
      } else if (e.kind === 'clean') {
        text('CLEAN', e.x, e.y - e.t * 40, 20, `rgba(120,220,140,${a})`, 'center', 'bold');
      }
    }
  }

  function drawMinimap(state) {
    const S = 172;
    const x0 = view.w / view.scale - S - 16;
    const y0 = 16;
    const sc = S / CITY.world;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.panel;
    roundRect(x0 * view.scale, y0 * view.scale, S * view.scale, S * view.scale, 10 * view.scale);
    ctx.fill();
    ctx.save();
    ctx.translate(x0 * view.scale, y0 * view.scale);
    ctx.scale(view.scale * sc, view.scale * sc);
    // City base.
    ctx.fillStyle = '#3d4a3a';
    ctx.fillRect(0, 0, CITY.world, CITY.world);
    // Roads.
    ctx.fillStyle = '#9aa2ad';
    for (const r of state.city.vertical) ctx.fillRect(r.x0, 0, CITY.road, CITY.world);
    for (const r of state.city.horizontal) ctx.fillRect(0, r.y0, CITY.world, CITY.road);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, state.city.beach.seaY, CITY.world, CITY.world - state.city.beach.seaY);
    // Mission target.
    const m = state.missions;
    if (m.target) {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(m.target.x, m.target.y, 90, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pk of m.packages) {
      if (pk.got) continue;
      ctx.fillStyle = '#7be07b';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 60, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cars.
    for (const car of state.cars) {
      if (car.driver === 'player') continue;
      ctx.fillStyle = car.driver === 'traffic' ? '#f2c94c' : '#e8ecf0';
      ctx.beginPath();
      ctx.arc(car.x, car.y, 80, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police (flashing red/blue).
    const flash = Math.floor(state.time * 5) % 2 === 0;
    for (const cop of state.police) {
      if (cop.state === 'down') continue;
      ctx.fillStyle = flash ? '#ff4d4d' : '#2f6fed';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y, 95, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text('SOLMAR', (x0 + 8) * view.scale, (y0 + S - 8) * view.scale, 13 * view.scale, '#ffffff', 'left', 'bold');
    ctx.restore();
  }

  function drawHud(state) {
    const s = view.scale;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Top-left: cash, stars, health.
    ctx.fillStyle = PALETTE.panel;
    roundRect(16 * s, 16 * s, 218 * s, 92 * s, 10 * s);
    ctx.fill();
    text(`$${state.cash}`, 30 * s, 46 * s, 26 * s, PALETTE.gold, 'left', 'bold');
    const stars = state.wanted.stars;
    for (let i = 0; i < 5; i += 1) {
      text('★', (96 + i * 24) * s, 46 * s, 24 * s, i < stars ? '#ff5a5a' : 'rgba(255,255,255,0.25)', 'left');
    }
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(30 * s, 62 * s, 150 * s, 12 * s, 6 * s);
    ctx.fill();
    ctx.fillStyle = state.player.health > 35 ? '#2fd67a' : '#ff5a5a';
    roundRect(30 * s, 62 * s, 150 * s * clamp(state.player.health / 100, 0, 1), 12 * s, 6 * s);
    ctx.fill();
    text(`HP ${Math.ceil(state.player.health)}`, 188 * s, 74 * s, 13 * s, '#ffffff', 'left');
    // Bottom-left: speed / vehicle.
    const car = state.cars.find((c) => c.driver === 'player');
    ctx.fillStyle = PALETTE.panel;
    roundRect(16 * s, view.h - 66 * s, 210 * s, 50 * s, 10 * s);
    ctx.fill();
    if (car) {
      const kmh = Math.round(Math.abs(car.speed) * 0.36);
      text(`${kmh} km/h`, 30 * s, view.h - 32 * s, 24 * s, '#ffffff', 'left', 'bold');
      text(car.kind, 128 * s, view.h - 32 * s, 15 * s, PALETTE.muted, 'left');
    } else {
      text('On foot', 30 * s, view.h - 32 * s, 22 * s, '#ffffff', 'left', 'bold');
      text('E near a car to drive', 118 * s, view.h - 32 * s, 13 * s, PALETTE.muted, 'left');
    }
    // Bottom-centre: mission objective.
    const m = state.missions;
    const label = m.index < 3 ? `JOB ${m.index + 1}/3 — ${['First Job', 'Hot Package', 'Lose the Heat'][m.index]}` : 'FREE ROAM';
    ctx.fillStyle = PALETTE.panel;
    const ow = 460 * s;
    roundRect((view.w - ow) / 2, view.h - 66 * s, ow, 50 * s, 10 * s);
    ctx.fill();
    text(label, view.w / 2, view.h - 44 * s, 13 * s, PALETTE.gold, 'center', 'bold');
    text(m.objective, view.w / 2, view.h - 24 * s, 15 * s, '#ffffff', 'center');
    // Bottom-right: controls hint.
    text('WASD drive/walk · E car · F punch · P pause · M mute', view.w - 16 * s, view.h - 24 * s, 12 * s, 'rgba(255,255,255,0.55)', 'right');
    // Wanted vignette pulse.
    if (stars > 0) {
      const pulse = 0.10 + 0.06 * Math.sin(state.time * 5);
      const grad = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.42, view.w / 2, view.h / 2, view.h * 0.75);
      grad.addColorStop(0, 'rgba(255,40,40,0)');
      grad.addColorStop(1, `rgba(255,40,40,${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.restore();
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt, accent) {
    const s = view.scale;
    const w = 620 * s;
    const h = (150 + lines.length * 34 + 66) * s;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = PALETTE.panel;
    roundRect(x, y, w, h, 14 * s);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2 * s;
    roundRect(x, y, w, h, 14 * s);
    ctx.stroke();
    text(title, view.w / 2, y + 72 * s, 46 * s, accent, 'center', 'bold');
    lines.forEach((line, i) => {
      text(line, view.w / 2, y + (128 + i * 34) * s, 19 * s, '#dfe5ec', 'center');
    });
    text(prompt, view.w / 2, y + h - 30 * s, 20 * s, PALETTE.gold, 'center', 'bold');
    ctx.restore();
  }

  function drawWorld(state) {
    const cam = state.camera;
    const s = view.scale;
    const cx = cam.x;
    const cy = cam.y;
    ctx.setTransform(s, 0, 0, s, view.w / 2 - cx * s, view.h / 2 - cy * s);
    drawGround(state);
    drawMarkers(state, state.time);
    for (const car of state.cars) drawCar(car, car.driver === 'player', state.time);
    for (const cop of state.police) {
      if (cop.onFoot) {
        // Foot cop: a dark-blue figure with a cap.
        ctx.fillStyle = '#1b3f8f';
        ctx.beginPath();
        ctx.arc(cop.x, cop.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0c8a0';
        ctx.beginPath();
        ctx.arc(cop.x, cop.y - 3, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawCar(cop, false, state.time);
      }
    }
    for (const ped of state.peds) drawPed(ped, state.time);
    drawPlayer(state, state.time);
    drawEvents(state);
    // Off-screen mission arrow: point toward the target at the screen edge.
    if (state.screen === 'play' && state.missions.target) {
      const t = state.missions.target;
      const dx = t.x - state.player.x;
      const dy = t.y - state.player.y;
      const d = Math.hypot(dx, dy);
      if (d > 520) {
        const a = Math.atan2(dy, dx);
        const ex = state.player.x + Math.cos(a) * 430;
        const ey = state.player.y + Math.sin(a) * 430;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Paint one frame for the screen the game is on. */
  function draw(state, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, view.w, view.h);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR HEAT', [
        'A sun-soaked open-world crime game.',
        'Steal cars, outrun the police, run jobs for Mara.',
        'Drive, fight and finish all 3 jobs to own the city.',
        '',
        `Best cash $${state.bestCash} · Missions done ${state.missionsDone}`,
      ], 'Press Enter to start', '#f2c94c');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'Press P to resume', '#dfe5ec');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The Solmar PD caught Rex.`, `Cash kept $${state.cash} · Best $${Math.max(state.bestCash, state.cash)}`], 'Press Enter to try again', '#ff5a5a');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Rex is down. Solmar keeps moving.', `Cash kept $${state.cash}`], 'Press Enter to try again', '#ff5a5a');
    } else if (screen === SCREEN_WIN) {
      drawPanel('YOU OWN SOLMAR', ['All three jobs done. Mara is impressed.', `Total cash $${state.cash} · Best $${Math.max(state.bestCash, state.cash)}`, 'Free roam: grab packages for cash.'], 'Press Enter to keep playing', '#f2c94c');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
