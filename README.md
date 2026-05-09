# RACEGRID

Real-time multiplayer 3D car racing game in the browser. Race 3 laps against a bot or other players, collect coins, dodge rock obstacles, and see your finish time on the leaderboard.

![React](https://img.shields.io/badge/React-18-blue) ![Three.js](https://img.shields.io/badge/Three.js-R3F-black) ![Node](https://img.shields.io/badge/Node.js-WebSockets-green) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

---

## Features

- **3D rendering** — React Three Fiber with ACES filmic tone mapping, shadows, and city scenery along the track
- **Multiplayer** — Authoritative WebSocket server at 20 Hz with client-side physics prediction at 60 fps
- **Bot opponent** — Sine-wave AI with obstacle avoidance; auto-fills the room when racing solo
- **Coin system** — 75 coins spread across all 3 laps; swept collision detection prevents missed pickups at high speed
- **Rock obstacles** — 22 randomly placed boulder clusters; hitting one stuns your car for 1.5 s
- **Car-to-car collision** — Proximity-based stun when rammed from behind
- **HUD** — Arc speedometer, race timer, lap counter, position tracker, coin count, and mini-map
- **Traffic light countdown** — Animated 3-2-1-GO! signal with sound before each race
- **Celebration overlay** — Confetti and banner on finish; auto-navigates to the results board
- **Results page** — Finish time, coins collected, and score (10 / 7 / 5 / 3 pts by position)
- **Auth & history** — Supabase-backed login with race history persisted to PostgreSQL

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript (strict), React Three Fiber, Tailwind CSS, Vite |
| Backend | Node.js, `ws` WebSockets, TypeScript, ts-node / nodemon |
| Auth / DB | Supabase (Auth + PostgreSQL) |
| 3D | Three.js via `@react-three/fiber` |

---

## Project Structure

```
racegrid/
├── client/
│   └── src/
│       ├── constants/       # Shared game constants (speed, laps, track length)
│       ├── controllers/     # WebSocket client, auth controller
│       ├── game/r3f/        # Three.js scene, car meshes, road, scenery, coins
│       ├── models/services/ # Sound service, match history API
│       └── views/           # Pages (Game, Lobby, Results) and HUD components
├── server/
│   └── src/
│       ├── controllers/     # WebSocket handler, authoritative game loop
│       └── models/          # GameState, player types, Supabase services
└── database/
    └── migrations/          # Supabase SQL migration files (run in order)
```

---

## Quick Start

### 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL files in `database/migrations/` in order
3. Note your project URL, anon key, and service-role key

### 2. Environment variables

**`client/.env.development`**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WEBSOCKET_SERVER_URL=ws://localhost:4000
VITE_NODE_ENV=development
```

**`server/.env.development`**
```env
PORT=4000
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### 3. Install and run

```bash
# Terminal 1 — server
cd server && npm install && npm run dev

# Terminal 2 — client
cd client && npm install && npm run dev
```

Client: `http://localhost:5173` · Server: `ws://localhost:4000`

---

## Game Rules

- 3 laps to finish; first human across the line ends the race
- Scoring: 1st = 10 pts · 2nd = 7 pts · 3rd = 5 pts · 4th = 3 pts
- Hitting a rock or being rammed stuns your car for ~1.5 s
- Controls: `W / ↑` accelerate · `S / ↓` brake · `A D / ← →` steer

---

## Architecture Notes

- **Authoritative server** — all physics run server-side; client predicts locally and reconciles on each broadcast
- **Prediction drift compensation** — obstacle/coin hitboxes extend forward by one server tick (~4 units at max speed) so collisions appear simultaneous with the visual contact
- **MVC** — `models/` (data + Supabase), `views/` (React UI), `controllers/` (game logic + WebSocket)
