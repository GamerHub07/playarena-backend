# Realtime Game Backend

## Developer Onboarding & Game Extension Guide

This document is written for **new developers joining the project**. It explains:

* how the backend is structured
* how Socket.IO and game engines work together
* how to safely add a new game (without breaking production)

This project already has **Ludo live in production**, so safety and consistency are critical.

---

## 1. Big Picture (Read This First)

### What kind of backend is this?

This is a **real‑time multiplayer game backend** built with:

* Node.js + TypeScript
* Express (HTTP APIs)
* Socket.IO (real‑time gameplay)

### Core philosophy

* **One WebSocket server** for all games
* **One room per match**
* **Server is authoritative** (clients never decide game state)
* **Game logic is isolated** from socket/network logic

This architecture allows us to add new games (Snake & Ladder, Chess, etc.) **without touching existing games**.

---

## 2. High-Level Architecture

```
Client (Browser / Mobile)
        │
        ▼
Socket.IO Events
        │
        ▼
Socket Router  ───► Game Engine (Ludo / Snake / Future Games)
        │                    │
        │                    ▼
        └────────── Broadcast Authoritative State
```

* Clients send **actions** (roll dice, move piece)
* Server validates and applies rules via a **GameEngine**
* Server broadcasts the updated state to all players in the match

---

## 3. Folder Structure Overview

```
src/
 ├── games/          # All game logic (rules only)
 ├── socket/         # Real-time communication layer
 ├── services/       # Shared services (game store, Redis later)
 ├── controllers/    # HTTP controllers
 ├── routes/         # HTTP routes
 ├── models/         # Database models
 └── server.ts       # App entry point
```

Each section has a **single responsibility**.

---

## 4. The `games/` Folder (MOST IMPORTANT)

### Purpose

Contains **pure game logic only**.

❌ No Socket.IO imports
❌ No `emit`, `join`, `broadcast`

✅ Only rules, state, validation

---

### Structure

```
games/
 ├── base/
 │    └── GameEngine.ts
 │
 ├── ludo/
 │    ├── engine/LudoEngine.ts
 │    ├── types/ludo.types.ts
 │    └── index.ts
 │
 └── snake-ladder/
      ├── engine/SnakeLadderEngine.ts
      ├── types/snake.types.ts
      └── index.ts
```

---

### `GameEngine` Contract

All games must follow the same interface.

```ts
interface GameEngine {
  handleAction(playerId: string, action: any): GameEvent[];
  getState(): GameState;
  serialize(): any;
  restore(data: any): void;
}
```

This ensures **all games plug into the system the same way**.

---

## 5. The `socket/` Folder

### Purpose

Handles **network communication only**.

Responsibilities:

* authenticate users
* validate payloads
* route events to the correct game engine
* broadcast state updates

---

### Structure

```
socket/
 ├── index.ts            # Socket.IO initialization
 ├── SocketManager.ts    # Room & socket helpers
 ├── router.ts           # Routes events to game engines
 ├── handlers/           # Thin event handlers
 ├── middleware/         # Auth & error handling
 └── events/             # Event name constants
```

---

### Key Rule

> **Socket handlers never contain game rules.**

They only call game engines.

---

## 6. Rooms & Matches

Each match has **one room**:

```
game:{gameType}:{matchId}
```

Examples:

* `game:ludo:abc123`
* `game:snake_ladder:xyz789`

Why rooms matter:

* players only receive updates for their match
* multiple matches run safely in parallel

---

## 7. Game Lifecycle (Simplified)

1. Player joins a match
2. Server creates or loads game engine
3. Player joins the match room
4. Player sends `game:action`
5. Server updates engine state
6. Server broadcasts `game:update`

The client **never mutates state directly**.

---

## 8. `GameStore` (Game Lifecycle Manager)

Located at:

```
services/gameStore.ts
```

Responsibilities:

* create game instances
* store them in memory
* fetch them by `matchId`
* delete them when match ends

Later, this can be backed by Redis **without changing game code**.

---

## 9. Adding a New Game (Step-by-Step)

### Example: Adding `Snake & Ladder`

#### Step 1: Create the folder

```
src/games/snake-ladder/
```

#### Step 2: Implement engine

```ts
class SnakeLadderEngine implements GameEngine {
  handleAction(playerId, action) { /* rules */ }
  getState() { /* state */ }
}
```

#### Step 3: Export it

```ts
export { SnakeLadderEngine };
```

#### Step 4: Register in router

Add mapping **without touching Ludo**:

```ts
if (gameType === "snake_ladder") {
  return new SnakeLadderEngine();
}
```

✅ No changes to socket events
✅ No changes to Ludo

---

## 10. Production Safety Rules (VERY IMPORTANT)

When working on this project:

❌ Do NOT rename socket events
❌ Do NOT change payload formats
❌ Do NOT break backward compatibility
❌ Do NOT refactor multiple layers at once

Always:

* work behind feature flags
* keep old logic until new logic is proven

---

## 11. Common Mistakes to Avoid

❌ Putting game logic inside socket handlers
❌ Emitting socket events from game engines
❌ Creating a new socket server per game
❌ Sharing state between matches

---

## 12. Why This Architecture Works

* Easy to add games
* Safe for live production
* Scales horizontally
* Easy for new developers to understand

This structure is used by **real multiplayer game platforms**, not just demos.

---

## 13. TL;DR for New Developers

* `games/` = rules only
* `socket/` = networking only
* One game = one engine
* One match = one room
* Never break existing socket events

If you follow this, **you will not break production**.

---

Welcome to the project 🚀
Build games, not bugs.
