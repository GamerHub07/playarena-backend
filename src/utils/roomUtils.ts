/**
 * Room Utilities
 * 
 * Standardized room naming conventions for multi-game support.
 * All rooms follow: game:{gameType}:{matchId}
 * 
 * Examples:
 *   game:ludo:ROOM123
 *   game:snake-ladder:ROOM456
 */

import { GameType } from '../services/gameStore';

/**
 * Create a standardized room name
 * Format: game:{gameType}:{matchId}
 */
export function createRoomName(gameType: GameType, matchId: string): string {
    const normalizedId = matchId.toUpperCase();
    return `game:${gameType}:${normalizedId}`;
}

/**
 * Parse a room name into components
 * Returns null if format is invalid
 */
export function parseRoomName(roomName: string): {
    gameType: GameType;
    matchId: string
} | null {
    const parts = roomName.split(':');

    if (parts.length !== 3 || parts[0] !== 'game') {
        return null;
    }

    const gameType = parts[1] as GameType;
    const matchId = parts[2];

    // Validate game type
    const validGameTypes: GameType[] = ['ludo', 'snake-ladder'];
    if (!validGameTypes.includes(gameType)) {
        return null;
    }

    return { gameType, matchId };
}

/**
 * Check if a room name follows the standard format
 */
export function isValidRoomName(roomName: string): boolean {
    return parseRoomName(roomName) !== null;
}

/**
 * Get legacy room name (for backward compatibility)
 * During migration, we support both formats
 */
export function getLegacyRoomName(matchId: string): string {
    return matchId.toUpperCase();
}

/**
 * Create room names for both legacy and new formats
 * Used during migration period
 */
export function getRoomNames(gameType: GameType, matchId: string): {
    legacy: string;
    standard: string;
} {
    return {
        legacy: getLegacyRoomName(matchId),
        standard: createRoomName(gameType, matchId),
    };
}
