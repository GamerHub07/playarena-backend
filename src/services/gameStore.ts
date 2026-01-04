/**
 * Game Store Service
 * 
 * Centralized registry for active game instances.
 * Manages game lifecycle: create, get, list, delete.
 * 
 * ⚠️ This is currently IN-MEMORY ONLY ⚠️
 * Future: Redis adapter for horizontal scaling
 * 
 * Usage:
 *   gameStore.createGame('ludo', 'ROOM123', engine);
 *   const game = gameStore.getGame('ROOM123');
 *   gameStore.deleteGame('ROOM123');
 */

import { GameEngine, SerializedGame } from '../games/base/GameEngine';
import { LudoEngine } from '../games/ludo/LudoEngine';
import { SnakeLadderEngine } from '../games/snake-ladder/SnakeLadderEngine';
import { MonopolyEngine } from '../games/monopoly';
import { featureFlags } from '../config/featureFlags';

import { PokerEngine } from '../games/poker/PokerEngine'
// Game type registry - add new games here

export type GameType = 'ludo' | 'snake-ladder' | 'monopoly' | 'poker';


// Factory function type for creating game engines
type GameEngineFactory = (roomCode: string) => GameEngine;

// Registry of game factories
// ⚠️ Snake & Ladder is implemented but NOT exposed via socket handlers yet
const gameFactories: Record<GameType, GameEngineFactory> = {
    'ludo': (roomCode) => new LudoEngine(roomCode),
    'snake-ladder': (roomCode) => new SnakeLadderEngine(roomCode),

    'poker': (roomCode) => new PokerEngine(roomCode),

    'monopoly': (roomCode) => new MonopolyEngine(roomCode),

};


interface GameEntry {
    engine: GameEngine;
    gameType: GameType;
    createdAt: number;
    lastActivity: number;
}

class GameStore {
    private static instance: GameStore;
    private games: Map<string, GameEntry> = new Map();

    private constructor() { }

    static getInstance(): GameStore {
        if (!GameStore.instance) {
            GameStore.instance = new GameStore();
        }
        return GameStore.instance;
    }

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE OPERATIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Create a new game instance
     * @param gameType - Type of game to create
     * @param roomCode - Unique room identifier
     * @returns The created game engine
     */
    createGame(gameType: GameType, roomCode: string): GameEngine {
        const normalizedCode = roomCode.toUpperCase();

        if (this.games.has(normalizedCode)) {
            throw new Error(`Game already exists for room ${normalizedCode}`);
        }

        const factory = gameFactories[gameType];
        if (!factory) {
            throw new Error(`Unknown game type: ${gameType}`);
        }

        const engine = factory(normalizedCode);
        const entry: GameEntry = {
            engine,
            gameType,
            createdAt: Date.now(),
            lastActivity: Date.now(),
        };

        this.games.set(normalizedCode, entry);

        if (featureFlags.DEBUG_SOCKET_EVENTS) {
            console.log(`🎮 GameStore: Created ${gameType} game in room ${normalizedCode}`);
        }

        return engine;
    }

    /**
     * Get an existing game by room code
     * @param roomCode - Room identifier
     * @returns Game engine or undefined
     */
    getGame(roomCode: string): GameEngine | undefined {
        const normalizedCode = roomCode.toUpperCase();
        const entry = this.games.get(normalizedCode);

        if (entry) {
            entry.lastActivity = Date.now();
        }

        return entry?.engine;
    }

    /**
     * Get game with type info
     */
    getGameEntry(roomCode: string): GameEntry | undefined {
        const normalizedCode = roomCode.toUpperCase();
        return this.games.get(normalizedCode);
    }

    /**
     * Check if a game exists
     */
    hasGame(roomCode: string): boolean {
        return this.games.has(roomCode.toUpperCase());
    }

    /**
     * Delete a game instance
     * @param roomCode - Room identifier
     * @returns true if deleted, false if not found
     */
    deleteGame(roomCode: string): boolean {
        const normalizedCode = roomCode.toUpperCase();
        const existed = this.games.has(normalizedCode);

        if (existed) {
            this.games.delete(normalizedCode);

            if (featureFlags.DEBUG_SOCKET_EVENTS) {
                console.log(`🗑️ GameStore: Deleted game in room ${normalizedCode}`);
            }
        }

        return existed;
    }

    // ═══════════════════════════════════════════════════════════════
    // QUERY OPERATIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get all active games
     */
    getAllGames(): Map<string, GameEntry> {
        return new Map(this.games);
    }

    /**
     * Get count of active games
     */
    getGameCount(): number {
        return this.games.size;
    }

    /**
     * Get games by type
     */
    getGamesByType(gameType: GameType): string[] {
        const roomCodes: string[] = [];
        this.games.forEach((entry, code) => {
            if (entry.gameType === gameType) {
                roomCodes.push(code);
            }
        });
        return roomCodes;
    }

    // ═══════════════════════════════════════════════════════════════
    // SERIALIZATION (for future Redis support)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Serialize a game for persistence
     */
    serializeGame(roomCode: string): SerializedGame | undefined {
        const entry = this.getGameEntry(roomCode);
        if (!entry) return undefined;
        return entry.engine.serialize();
    }

    /**
     * Restore a game from serialized state
     */
    restoreGame(data: SerializedGame): GameEngine {
        const gameType = data.gameType as GameType;
        const engine = this.createGame(gameType, data.roomCode);
        engine.restore(data);
        return engine;
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════

    /**
     * Remove stale games (no activity for given duration)
     * @param maxAgeMs - Maximum age in milliseconds
     * @returns Number of games removed
     */
    cleanupStaleGames(maxAgeMs: number = 3600000): number {
        const now = Date.now();
        let removed = 0;

        this.games.forEach((entry, code) => {
            if (now - entry.lastActivity > maxAgeMs) {
                this.games.delete(code);
                removed++;
                console.log(`🧹 GameStore: Cleaned up stale game in room ${code}`);
            }
        });

        return removed;
    }

    /**
     * Clear all games (for testing)
     */
    clear(): void {
        this.games.clear();
    }
}

// Export singleton instance
export const gameStore = GameStore.getInstance();
export default gameStore;
