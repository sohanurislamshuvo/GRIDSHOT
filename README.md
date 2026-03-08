# Shadow Arena: Tactical Ops

**Version 0.1.0** | Phaser 3 + Node.js + Socket.io | 2D Top-Down Multiplayer Tactical Shooter

---

## About

Shadow Arena: Tactical Ops is a 2D top-down multiplayer tactical shooter built with Phaser 3 and Node.js. Players fight in small arena-based maps using 360-degree aiming, projectile combat, and tactical abilities. The game supports offline solo play against AI bots, 1v1 online duels, and 2v2/3v3 team matches -- all powered by a server-authoritative architecture that prevents client-side cheating.

---

## Features

- **4 Game Modes** -- Solo Mission (wave survival), 1v1 Duel, 2v2 Team, 3v3 Team
- **4 Tactical Abilities** -- Dash, Shield, Radar, Heal with cooldown timers
- **AI Bot System** -- FSM-based bots (patrol/chase/attack/flee) with 5 enemy types
- **Boss Fights** -- Phase-based boss AI with charge attacks and AoE bursts every 5 waves
- **Wave System** -- Endless survival with exponential difficulty scaling
- **A* Pathfinding** -- Bots navigate around walls using grid-based pathfinding
- **Multiplayer Networking** -- Client-side prediction, server reconciliation, entity interpolation
- **Progression System** -- XP, levels, Elo-based ranking (Bronze/Silver/Gold/Platinum)
- **Persistence** -- SQLite database for player accounts, stats, match history, leaderboard
- **Anti-Cheat** -- Server-side hit detection, speed validation, rate limiting, suspicion scoring
- **Procedural Arena** -- Deterministic wall generation identical on client and server

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (included with Node.js)

### Install

```bash
cd Game1
npm install
```

### Run (Development)

Open **two terminals**:

```bash
# Terminal 1 -- Start the server
node server/src/index.js
```

```bash
# Terminal 2 -- Start the client dev server
cd client
npx vite --host
```

Open `http://localhost:5173` in your browser. Solo mode works without the server; online modes require the server running on port 3000.

### Build for Production

```bash
cd client
npx vite build
```

The server will serve the built client from `client/dist/` automatically.

---

## Controls

| Action | Key |
| ------ | --- |
| Move | W / A / S / D |
| Aim | Mouse |
| Shoot | Left Click (hold for auto-fire) |
| Dash | Q |
| Shield | E |
| Radar | R |
| Heal | F |
| Menu | ESC |

---

## Game Modes

### Solo Mission

Endless wave-based survival against AI bots. Waves increase in difficulty with new enemy types unlocking as you progress. A boss spawns every 5 waves with phase-based behavior (normal, aggressive, berserk).

### 1v1 Duel

Online match against another player. First to 10 kills wins, or highest kills after a 5-minute time limit.

### 2v2 / 3v3 Team

Team-based online matches with auto-assigned teams (red vs blue). Friendly fire is off. First team to 25 kills wins, or highest team score after 10 minutes.

---

## Abilities

| Ability | Key | Cooldown | Effect |
| ------- | --- | -------- | ------ |
| Dash | Q | 5s | Instant 200px burst in facing direction, brief invulnerability |
| Shield | E | 15s | 3 seconds of 80% damage reduction with visible bubble |
| Radar | R | 20s | 5 seconds of enemy positions revealed on minimap |
| Heal | F | 30s | Restore 50 HP over 5 seconds (10 HP per tick) |

Abilities unlock as you level up: Dash (Lv1), Heal (Lv3), Shield (Lv5), Radar (Lv7).

---

## Progression

- **XP** -- Earned from kills (bot +10, player +25, boss +100), winning (+100), surviving waves (+50)
- **Levels** -- Exponential curve: `XP needed = floor(100 * level^1.5)`
- **Ranking** -- Elo system (K=32) with tiers:
  - Bronze: 0-999
  - Silver: 1000-1499
  - Gold: 1500-1999
  - Platinum: 2000+

---

## Project Structure

```text
Game1/
├── package.json                  # npm workspace root
├── shared/                       # Pure game logic (no DOM, no Node.js APIs)
│   ├── config/                   # GameConfig, AbilityConfig, WaveConfig
│   ├── entities/                 # Entity, PlayerEntity, ProjectileEntity, BotEntity
│   ├── systems/                  # ProgressionSystem
│   └── utils/                    # Vector2, MessageTypes
├── client/                       # Phaser 3 frontend (Vite bundled)
│   └── src/
│       ├── scenes/               # Boot, Menu, Game, UI, GameOver
│       ├── entities/             # ClientPlayer, RemotePlayer, ClientBot, ClientProjectile
│       ├── systems/              # InputManager, NetworkManager
│       └── ui/                   # AbilityBar, Minimap, Scoreboard, DamageNumbers, etc.
└── server/                       # Node.js authoritative backend
    └── src/
        ├── game/
        │   ├── modes/            # SoloMode, DuelMode, TeamMode
        │   ├── ai/               # BotAI (FSM), BossAI (phases), Pathfinding (A*)
        │   ├── systems/          # CombatSystem, AbilitySystem, WaveSystem, AntiCheat
        │   └── matchmaking/      # RoomManager, MatchmakingQueue
        ├── persistence/          # Database (SQLite), PlayerRepository
        └── api/                  # REST routes (auth, leaderboard)
```

---

## Architecture

```text
Client (60fps)                    Server (60fps logic, 20fps broadcast)
─────────────────                 ──────────────────────────────────────
Capture input (WASD + mouse)      Receive input packets per player
Apply locally (prediction)   →    Validate + apply to authoritative state
                             ←    Broadcast snapshot { players[], bots[], projectiles[] }
Reconcile local player            Server-side hit detection + damage calc
Interpolate remote players        Ability cooldown validation
Render via Phaser                 Anti-cheat: speed, rate limit, suspicion score
```

- **Server-authoritative**: All damage, abilities, and movement are validated server-side
- **Client-side prediction**: Local player movement applied immediately, reconciled with server state
- **Entity interpolation**: Remote players rendered 100ms in the past, smoothly lerped between snapshots
- **Snapshot sync**: Full game state broadcast at 20fps; client buffers and interpolates

---

## API Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/api/auth/register` | Create account (username + password) |
| POST | `/api/auth/login` | Login, receive JWT token |
| GET | `/api/player/:id/stats` | Get player stats |
| GET | `/api/player/:id/matches` | Get match history |
| GET | `/api/leaderboard` | Top 100 players by rating |
| GET | `/api/health` | Server health check |

---

## Tech Stack

| Component | Technology |
| --------- | ---------- |
| Game Engine | Phaser 3 (Arcade Physics) |
| Client Bundler | Vite |
| Server | Node.js + Express |
| Real-time | Socket.io |
| Database | SQLite (better-sqlite3) |
| Auth | bcryptjs + JWT |
| Language | JavaScript (ES modules) |

---

## License

This project is for educational and experimental purposes.
