/**
 * Socket Event Constants
 * Centralized event names for type-safety and consistency
 */

export const SOCKET_EVENTS = {
    // Connection events
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',

    // Room events
    ROOM_JOIN: 'room:join',
    ROOM_LEAVE: 'room:leave',
    ROOM_UPDATE: 'room:update',

    // Game lifecycle events
    GAME_START: 'game:start',
    GAME_STATE: 'game:state',
    GAME_WINNER: 'game:winner',

    // Game action events
    GAME_ACTION: 'game:action',
    GAME_TOKEN_MOVE: 'game:tokenMove',
    GAME_DICE_ROLL: 'game:diceRoll',

    // System events
    ERROR: 'error',
} as const;

// Type for event names
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
