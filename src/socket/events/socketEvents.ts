/**
 * Socket Event Constants
 * Centralized event names for type-safety and consistency
 * 
 * ⚠️ PRODUCTION API - DO NOT MODIFY ⚠️
 * These events are used by live clients. Any changes require:
 * 1. Version negotiation
 * 2. Backward compatibility
 * 3. Staged rollout
 */

export const SOCKET_EVENTS = {
    // ⚠️ PROD EVENT — DO NOT CHANGE
    CONNECTION: 'connection',
    // ⚠️ PROD EVENT — DO NOT CHANGE
    DISCONNECT: 'disconnect',

    // Room events
    // ⚠️ PROD EVENT — DO NOT CHANGE
    ROOM_JOIN: 'room:join',
    // ⚠️ PROD EVENT — DO NOT CHANGE
    ROOM_LEAVE: 'room:leave',
    // ⚠️ PROD EVENT — DO NOT CHANGE
    ROOM_UPDATE: 'room:update',
    // Theme change event (host only)
    ROOM_THEME: 'room:theme',

    // Game lifecycle events
    // ⚠️ PROD EVENT — DO NOT CHANGE
    GAME_START: 'game:start',
    // ⚠️ PROD EVENT — DO NOT CHANGE
    GAME_STATE: 'game:state',
    // ⚠️ PROD EVENT — DO NOT CHANGE
    GAME_WINNER: 'game:winner',

    // Game action events
    // ⚠️ PROD EVENT — DO NOT CHANGE
    GAME_ACTION: 'game:action',
    // ⚠️ PROD EVENT — DO NOT CHANGE
    GAME_TOKEN_MOVE: 'game:tokenMove',
    // ⚠️ PROD EVENT — DO NOT CHANGE (unused but reserved)
    GAME_DICE_ROLL: 'game:diceRoll',

    // System events
    // ⚠️ PROD EVENT — DO NOT CHANGE
    ERROR: 'error',
} as const;

// Type for event names
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

