# SOLMAR HEAT

![gta6-01](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/RenzzHGE/solmar-heat/rank.svg)
![Reward](https://make.fun/badge/gta6-01/RenzzHGE/solmar-heat/reward.svg)

An open-world crime game built for the [make.fun gta6-01 bounty ($1,666)](https://make.fun/bounty/gta6-01).

## The game

You are **Rex**, a driver for hire in **Solmar**, a sun-soaked coastal city.
Take jobs from **Mara** the fixer, steal cars, outrun the Solmar PD, and finish
all three jobs to own the city:

1. **First Job** ($200) — drive to the pickup point and meet Mara.
2. **Hot Package** ($500) — collect 3 packages across the city, then deliver them to the garage.
3. **Lose the Heat** ($800) — the cops are on you. Reach the hideout and lose them.

After the third job, free roam: grab packages for cash while the heat stays off you.

## What's in the city

- A 7×7 street-grid city to explore **on foot and by car**: buildings, a park,
  a parking lot, and a beach with the sea along the south edge.
- **Traffic** (sedans, taxis, sports cars, trucks) that follows the road grid,
  turns at intersections and brakes for the car ahead; **pedestrians** who walk
  the sidewalks and flee from danger.
- **Cars to steal** — walk up to any parked or traffic car and take it (the
  driver bails and runs). Five car kinds with different speed and handling.
- A **wanted level** (0–5 stars): crimes raise it, staying clean lowers it.
  **Police** cars chase and ram you; foot cops chase and punch. Get caught on
  foot and you're **busted**; run out of health and you're **wasted**.
- **Combat** on foot (punch), car crashes, health regen when the heat is off.
- A **HUD** with cash, wanted stars, health bar, speedometer and a **minimap**
  of the whole city, plus a mission objective bar and an off-screen target arrow.
- **Start screen**, pause, busted / wasted / win screens, and a **save** in
  localStorage (best cash, missions done).
- **Sound**, all synthesised live with WebAudio: engine hum, a two-tone siren,
  and cues for pickups, missions, crashes and busts. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrows | Drive / walk |
| Shift | Run (on foot) |
| Space | Handbrake |
| E | Enter / steal a car, exit a car |
| F or click | Punch |
| P or Esc | Pause |
| M | Mute |
| Enter | Start / confirm |

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: every script, image, sound and font is a
file under `game/` or a `data:` URI. `?seed=N` fixes the city; `?shot=start|drive|chase|mission`
stages a screenshot scene.

## Layout

- `game/index.html` — the page; `game/src/` — the game's own source, one file per job
  (`config`, `city`, `world`, `player`, `traffic`, `police`, `missions`, `render`,
  `shots`, `audio`, `input`, `utils`, `random`, `main`).
- `main.ts` — the entrypoint program: copies `game/` + `screenshots/` to `/output`
  and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- `screenshots/` — 4 real renders of the game in a headless browser (start, drive,
  police chase, mission).

All names, characters, art, sounds and music are original — nothing from any
commercial game.

MIT licensed — see [LICENSE](LICENSE).
