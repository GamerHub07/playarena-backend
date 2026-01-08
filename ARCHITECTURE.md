# Backend Architecture Documentation

## Overview

This backend uses a **modular, scalable architecture** designed for:
- Multiple game types (Ludo, Snake & Ladder, Monopoly, Chess)
- Real-time WebSocket communication
- Horizontal scaling readiness (Redis-ready)
- Zero-downtime deployments via feature flags

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  (Frontend: Next.js + Socket.io-client)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SOCKET LAYER                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│  │RoomHandler│ │LudoHandler│ │ChessHndlr │ │Monopoly...│        │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│         │            │              │             │              │
│         └────────────┴──────────────┴─────────────┘              │
│                                          ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              SocketManager (connections, rooms)             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   GameStore                                 │ │
│  │   - createGame(type, roomCode)                              │ │
│  │   - getGame(roomCode)                                       │ │
│  │   - deleteGame(roomCode)                                    │ │
│  │   - serialize/restore (Redis-ready)                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GAME LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               GameEngine (Abstract Base)                    │ │
│  │   - getGameType(), getState(), handleAction()               │ │
│  │   - serialize(), restore()                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         ▲              ▲              ▲              ▲           │
│         │              │              │              │           │
│  ┌──────┴────┐  ┌──────┴────┐  ┌──────┴────┐  ┌──────┴────┐     │
│  │LudoEngine │  │SnakeLadder│  │ChessEngine│  │Monopoly   │     │
│  │  (LIVE)   │  │  (LIVE)   │  │  (LIVE)   │  │  (LIVE)   │     │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
backend/src/
├── config/
│   ├── db.ts               # MongoDB connection
│   └── featureFlags.ts     # Feature flag configuration
│
├── games/
│   ├── base/
│   │   └── GameEngine.ts   # Abstract base class
│   ├── ludo/
│   │   ├── LudoEngine.ts   # Ludo game logic
│   │   ├── LudoTypes.ts    # Type definitions
│   │   └── LudoBoardLayout.ts
│   ├── snake-ladder/
│   │   ├── SnakeLadderEngine.ts
│   │   └── SnakeLadderTypes.ts
│   ├── chess/
│   │   ├── ChessEngine.ts  # Full chess rules + check/checkmate
│   │   ├── ChessTypes.ts   # Pieces, board, moves
│   │   └── index.ts
│   └── monopoly/
│       ├── MonopolyEngine.ts
│       └── ...
│
├── services/
│   ├── gameStore.ts        # Centralized game registry
│   └── index.ts
│
├── socket/
│   ├── index.ts            # Socket initialization
│   ├── SocketManager.ts    # Connection management
│   ├── events/
│   │   └── socketEvents.ts # Event constants (FROZEN)
│   ├── handlers/
│   │   ├── BaseHandler.ts  # Abstract handler
│   │   ├── RoomHandler.ts  # Room lifecycle
│   │   └── games/
│   │       ├── LudoHandler.ts
│   │       ├── SnakeLadderHandler.ts
│   │       ├── ChessHandler.ts
│   │       └── MonopolyHandler.ts
│   └── types/
│       └── socketTypes.ts  # Payload types
│
├── utils/
│   └── roomUtils.ts        # Room naming utilities
│
└── server.ts               # Express + Socket.io setup
```

---

## Feature Flags

All new features are **disabled by default** for production safety.

| Flag | Default | Description |
|------|---------|-------------|
| `USE_NEW_LUDO_ENGINE` | `false` | Use refactored engine architecture |
| `USE_GAME_STORE` | `false` | Use GameStore instead of SocketManager |
| `USE_GAME_ROUTER` | `false` | Use central game router |
| `USE_STANDARD_ROOM_NAMES` | `false` | Use `game:{type}:{id}` format |
| `DEBUG_SOCKET_EVENTS` | `false` | Verbose socket logging |

**Enable via environment variables:**
```bash
USE_GAME_STORE=true npm run dev
```

---

## Socket Events (FROZEN API)

⚠️ **DO NOT MODIFY** - These are production events.

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{roomCode, sessionId, username}` | Join room |
| `room:leave` | `{}` | Leave room |
| `game:start` | `{roomCode}` | Start game |
| `game:action` | `{roomCode, action, data}` | Game action |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `room:update` | `{players, status}` | Room state |
| `game:start` | `{state, players}` | Game started |
| `game:state` | `{state, lastAction}` | State update |
| `game:winner` | `{winner}` | Game ended |
| `game:tokenMove` | `{steps, finalState}` | Animation |
| `error` | `{message}` | Error |

---

## Adding a New Game

1. **Create game directory**: `games/new-game/`
2. **Create types**: `NewGameTypes.ts`
3. **Create engine**: `NewGameEngine.ts` extending `GameEngine`
4. **Register in GameStore**: Add to `gameFactories`
5. **Create socket handler**: `NewGameHandler.ts`
6. **Add feature flag**: `USE_NEW_GAME=false`

---

## Redis Scaling (Future)

The architecture is prepared for Redis:

```typescript
// GameStore already has:
gameStore.serialize(roomCode);  // → JSON for Redis
gameStore.restore(data);        // ← JSON from Redis

// Future implementation:
class RedisGameStore {
    async saveGame(code: string) {
        const data = gameStore.serializeGame(code);
        await redis.set(`game:${code}`, JSON.stringify(data));
    }
}
```

---

## Testing Checklist

Before enabling feature flags in production:

- [ ] Run all existing Ludo tests
- [ ] Verify socket events unchanged
- [ ] Test game creation/deletion
- [ ] Test reconnection handling
- [ ] Load test with multiple rooms
- [ ] Verify database state consistency
