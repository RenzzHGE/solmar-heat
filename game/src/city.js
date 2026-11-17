// SOLMAR, the city: a grid of roads and blocks, built once from a seed so the same seed
// always gives the same city. Roads are bands; blocks hold buildings, a park, a parking
// lot, and a beach along the south edge. Everything here is pure data: the world and the
// renderer read it, nothing in it moves.
import { CITY, PALETTE } from './config.js';
import { int, pick } from './utils.js';

const BUILDING_COLORS = [PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC, PALETTE.buildingD, PALETTE.buildingE];

/** Road band i (vertical) spans [i*pitch, i*pitch+road]; its centre is the middle. */
export function roadCenter(i) {
  return i * CITY.pitch + CITY.road / 2;
}

/** Is the point on a road (either a vertical or a horizontal band)? */
export function isOnRoad(x, y) {
  const rx = ((x % CITY.pitch) + CITY.pitch) % CITY.pitch;
  const ry = ((y % CITY.pitch) + CITY.pitch) % CITY.pitch;
  return rx < CITY.road || ry < CITY.road || x < CITY.road || y < CITY.road;
}

/** Build the whole city from a seed. */
export function buildCity(rng) {
  const { world, grid, block, road, pitch, sidewalk } = CITY;
  const vertical = [];
  const horizontal = [];
  for (let i = 0; i <= grid; i += 1) {
    vertical.push({ x0: i * pitch, x1: i * pitch + road, center: roadCenter(i) });
    horizontal.push({ y0: i * pitch, y1: i * pitch + road, center: roadCenter(i) });
  }

  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const parked = [];

  // The park block and the parking-lot block, picked once per seed.
  const parkBlock = { i: int(rng, 1, grid - 2), j: int(rng, 1, grid - 3) };
  let lotBlock = { i: int(rng, 1, grid - 2), j: int(rng, 1, grid - 3) };
  if (lotBlock.i === parkBlock.i && lotBlock.j === parkBlock.j) lotBlock = { i: (parkBlock.i + 2) % (grid - 1) + 1, j: parkBlock.j };

  for (let i = 0; i < grid; i += 1) {
    for (let j = 0; j < grid; j += 1) {
      const bx = i * pitch + road;
      const by = j * pitch + road;
      // South row is the beach: sand, palms and the sea at the bottom edge.
      if (j === grid - 1) {
        for (let t = 0; t < 6; t += 1) {
          trees.push({ x: bx + 30 + rng() * (block - 60), y: by + 40 + rng() * 120, palm: true, s: 0.8 + rng() * 0.5 });
        }
        continue;
      }
      if (i === parkBlock.i && j === parkBlock.j) {
        parks.push({ x: bx, y: by, w: block, h: block });
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: bx + 24 + rng() * (block - 48), y: by + 24 + rng() * (block - 48), palm: rng() < 0.3, s: 0.8 + rng() * 0.6 });
        }
        continue;
      }
      if (i === lotBlock.i && j === lotBlock.j) {
        lots.push({ x: bx, y: by, w: block, h: block });
        // Parked cars in two rows.
        for (let c = 0; c < 5; c += 1) {
          parked.push({ x: bx + 50 + c * 52, y: by + 70, angle: 0, kind: pick(rng, ['sedan', 'sedan', 'sport', 'taxi', 'truck']) });
          parked.push({ x: bx + 50 + c * 52, y: by + block - 90, angle: Math.PI, kind: pick(rng, ['sedan', 'sport', 'taxi', 'sedan']) });
        }
        for (let t = 0; t < 3; t += 1) {
          trees.push({ x: bx + 20 + rng() * (block - 40), y: by + 20 + rng() * 40, palm: false, s: 0.8 + rng() * 0.4 });
        }
        continue;
      }
      // A normal block: 1-4 buildings with a sidewalk margin.
      const count = int(rng, 1, 4);
      const inset = sidewalk + 10;
      if (count === 1) {
        buildings.push(makeBuilding(rng, bx + inset, by + inset, block - inset * 2, block - inset * 2));
      } else if (count === 2) {
        const w = (block - inset * 2 - 24) / 2;
        buildings.push(makeBuilding(rng, bx + inset, by + inset, w, block - inset * 2));
        buildings.push(makeBuilding(rng, bx + inset + w + 24, by + inset, w, block - inset * 2));
      } else {
        const w = (block - inset * 2 - 24) / 2;
        const h = (block - inset * 2 - 24) / 2;
        buildings.push(makeBuilding(rng, bx + inset, by + inset, w, h));
        buildings.push(makeBuilding(rng, bx + inset + w + 24, by + inset, w, h));
        buildings.push(makeBuilding(rng, bx + inset, by + inset + h + 24, w, h));
        if (count === 4) buildings.push(makeBuilding(rng, bx + inset + w + 24, by + inset + h + 24, w, h));
      }
      // A couple of street trees on the block corners.
      for (let t = 0; t < 2; t += 1) {
        trees.push({ x: bx + 8 + rng() * (block - 16), y: by + 8 + rng() * 24, palm: rng() < 0.5, s: 0.7 + rng() * 0.4 });
      }
    }
  }

  // Street trees along the road edges, spaced out.
  for (let i = 0; i <= grid; i += 1) {
    for (let j = 0; j < grid; j += 1) {
      if (rng() < 0.5) trees.push({ x: roadCenter(i) - CITY.road / 2 + 8, y: j * pitch + road + 30 + rng() * 200, palm: true, s: 0.8 + rng() * 0.4 });
      if (rng() < 0.5) trees.push({ x: i * pitch + road + 30 + rng() * 200, y: roadCenter(j) - CITY.road / 2 + 8, palm: rng() < 0.5, s: 0.8 + rng() * 0.4 });
    }
  }

  const beach = { y0: (grid - 1) * pitch + road, y1: world, seaY: world - 46 };
  const garage = { x: lotBlock.i * pitch + road + 40, y: lotBlock.j * pitch + road + block / 2 - 30, w: 110, h: 60 };
  const playerSpawn = { x: roadCenter(3), y: roadCenter(3) + 40, angle: -Math.PI / 2 };

  return { world, vertical, horizontal, buildings, parks, lots, trees, parked, beach, garage, playerSpawn, parkBlock, lotBlock };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    color: pick(rng, BUILDING_COLORS),
    floors: int(rng, 2, 6),
    roof: rng() < 0.5,
  };
}
