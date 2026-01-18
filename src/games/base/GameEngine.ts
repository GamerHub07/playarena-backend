/**
 * Abstract Base Class for All Game Engines
 * 
 * ⚠️ PRODUCTION CONTRACT - MODIFY WITH CARE ⚠️
 * All game engines must extend this class.
 * Changes here affect ALL games.
 */

export interface GamePlayer {
    sessionId: string;
    username: string;
    position: number;
}

/**
 * Serialized game state for persistence/Redis
 * Used by serialize() and restore()
 */
export interface SerializedGame<TState = unknown> {
    gameType: string;
    roomCode: string;
    players: GamePlayer[];
    state: TState;
    createdAt: number;
    updatedAt: number;
}

/**
 * State returned when a player reconnects or needs state update
 * Each game can customize what state/actions to return
 */
export interface ReconnectionState<TState = unknown> {
    state: TState;
    availableActions: string[];
}

export abstract class GameEngine<TState = unknown> {
    protected roomCode: string;
    protected players: GamePlayer[];
    protected state: TState;
    protected createdAt: number;
    protected updatedAt: number;

    constructor(roomCode: string) {
        this.roomCode = roomCode;
        this.players = [];
        this.state = this.getInitialState();
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
    }

    // ═══════════════════════════════════════════════════════════════
    // ABSTRACT METHODS - Must be implemented by each game
    // ═══════════════════════════════════════════════════════════════

    /** Returns the game type identifier (e.g., 'ludo', 'snake-ladder') */
    abstract getGameType(): string;

    /** Create initial empty game state */
    abstract getInitialState(): TState;

    /** Minimum players required to start */
    abstract getMinPlayers(): number;

    /** Maximum players allowed */
    abstract getMaxPlayers(): number;

    /** 
     * Handle a player action
     * @param playerId - Session ID of the acting player
     * @param action - Action type (e.g., 'roll', 'move')
     * @param payload - Action-specific data
     * @returns Updated game state
     */
    abstract handleAction(playerId: string, action: string, payload: unknown): TState;

    /** Check if game has ended */
    abstract isGameOver(): boolean;

    /** Get winner index, or null if no winner yet */
    abstract getWinner(): number | null;

    /**
     * Get the index of the player whose turn it currently is
     */
    abstract getCurrentPlayerIndex(): number;

    /**
     * Auto-play for a player who has timed out
     * @param playerIndex The index of the player to auto-play for
     */
    abstract autoPlay(playerIndex: number): TState;

    /**
     * Eliminate a player from the game (e.g. after too many timeouts)
     * @param playerIndex The index of the player to eliminate
     */
    abstract eliminatePlayer(playerIndex: number): void;

    // ═══════════════════════════════════════════════════════════════
    // RECONNECTION STATE - Override in game engines that need custom behavior
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get game state for a specific player (for reconnection or state updates)
     * Override in game-specific engines if special handling is needed
     * (e.g., hiding opponent cards in Poker)
     * 
     * @param sessionId - The player's session ID
     * @returns State and available actions for this player
     */
    getStateForPlayer(sessionId: string): ReconnectionState<TState> {
        // Default implementation: return full state, no actions
        // Games like Poker override this to mask opponent cards
        void sessionId; // Mark as intentionally unused in base implementation
        return {
            state: this.state,
            availableActions: [],
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // SERIALIZATION - For Redis scaling and reconnections
    // ═══════════════════════════════════════════════════════════════

    /**
     * Serialize the entire game to a JSON-safe object
     * Used for Redis persistence and reconnections
     */
    serialize(): SerializedGame<TState> {
        this.updatedAt = Date.now();
        return {
            gameType: this.getGameType(),
            roomCode: this.roomCode,
            players: [...this.players],
            state: JSON.parse(JSON.stringify(this.state)), // Deep clone
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    /**
     * Restore game state from serialized data
     * Used when recovering from Redis or reconnection
     */
    restore(data: SerializedGame<TState>): void {
        this.roomCode = data.roomCode;
        this.players = [...data.players];
        this.state = data.state;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    // ═══════════════════════════════════════════════════════════════
    // PLAYER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    addPlayer(player: GamePlayer): boolean {
        if (this.players.length >= this.getMaxPlayers()) {
            return false;
        }
        this.players.push(player);
        this.updatedAt = Date.now();
        return true;
    }

    removePlayer(sessionId: string): boolean {
        const index = this.players.findIndex(p => p.sessionId === sessionId);
        if (index !== -1) {
            this.players.splice(index, 1);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    canStart(): boolean {
        return this.players.length >= this.getMinPlayers();
    }

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════

    getState(): TState {
        return this.state;
    }

    getPlayers(): GamePlayer[] {
        return this.players;
    }

    getRoomCode(): string {
        return this.roomCode;
    }

    getCreatedAt(): number {
        return this.createdAt;
    }

    getUpdatedAt(): number {
        return this.updatedAt;
    }
}
