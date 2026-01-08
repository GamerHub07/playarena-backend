# Backend Folder Structure: playarena-backend

This document describes the detailed folder and file structure of the backend project.

```
playarena-backend/
│
├── ARCHITECTURE.md           # Architecture overview and design notes
├── PROMPT.md                 # Project prompt or requirements
├── README.md                 # Project documentation and setup instructions
├── package.json              # NPM dependencies and scripts
├── tsconfig.json             # TypeScript configuration
│
└── src/                      # Source code root
    ├── server.ts             # Main server entry point
    │
    ├── config/               # Configuration files
    │   ├── db.ts             # Database configuration
    │   └── featureFlags.ts   # Feature flag toggles
    │
    ├── controllers/          # Express route controllers
    │   ├── guestController.ts
    │   └── roomController.ts
    │
    ├── games/                # Game logic and engines
    │   ├── base/             # Base game engine
    │   │   └── GameEngine.ts
    │   ├── ludo/             # Ludo game implementation
    │   │   ├── LudoBoardLayout.ts
    │   │   ├── LudoEngine.ts
    │   │   └── LudoTypes.ts
    │   ├── monopoly/         # Monopoly game implementation
    │   │   ├── index.ts
    │   │   ├── data/
    │   │   │   ├── board.ts
    │   │   │   ├── chanceCards.ts
    │   │   │   └── communityChest.ts
    │   │   ├── engine/
    │   │   │   ├── BoardResolver.ts
    │   │   │   ├── MonopolyEngine.ts
    │   │   │   ├── RuleValidator.ts
    │   │   │   └── TurnManager.ts
    │   │   └── types/
    │   │       └── monopoly.types.ts
    │   ├── chess/            # Chess game implementation
    │   │   ├── index.ts
    │   │   ├── ChessEngine.ts
    │   │   └── ChessTypes.ts
    │   └── snake-ladder/     # Snake and Ladder game implementation
    │       ├── index.ts
    │       ├── SnakeLadderEngine.ts
    │       └── SnakeLadderTypes.ts
    │
    ├── middleware/           # Express middleware
    │   └── errorHandler.ts
    │
    ├── models/               # Database models (e.g., Mongoose schemas)
    │   ├── GuestSession.ts
    │   └── Room.ts
    │
    ├── routes/               # Express route definitions
    │   ├── guestRoutes.ts
    │   ├── index.ts
    │   └── roomRoutes.ts
    │
    ├── services/             # Business logic and services
    │   ├── gameStore.ts
    │   └── index.ts
    │
    ├── socket/               # Socket.io logic
    │   ├── index.ts
    │   ├── SocketManager.ts
    │   ├── events/
    │   │   ├── index.ts
    │   │   └── socketEvents.ts
    │   ├── handlers/
    │   │   ├── BaseHandler.ts
    │   │   ├── index.ts
    │   │   ├── RoomHandler.ts
    │   │   └── games/
    │   │       ├── index.ts
    │   │       ├── LudoHandler.ts
    │   │       ├── SnakeLadderHandler.ts
    │   │       ├── MonopolyHandler.ts
    │   │       └── ChessHandler.ts
    │   ├── middleware/
    │   │   ├── errorHandler.ts
    │   │   └── index.ts
    │   └── types/
    │       ├── index.ts
    │       └── socketTypes.ts
    │
    └── utils/                # Utility/helper functions
        ├── index.ts
        ├── roomUtils.ts
        └── validation.ts
```

## Notes
- Each folder is organized by feature or concern (e.g., games, socket, models).
- Game logic is modularized by game type under `games/`.
- Socket.io logic is separated into events, handlers, middleware, and types for maintainability.
- Models, controllers, routes, and services follow standard Express/MVC conventions.
