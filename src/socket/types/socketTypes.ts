/**
 * Socket Type Definitions
 * All socket-related payload interfaces
 */

import { SnakeLadderGameState, SnakeLadderMoveStep } from '../../games/snake-ladder/SnakeLadderTypes';

// Socket data attached to each connection
export interface SocketData {
    roomCode: string;
    sessionId: string;
    username: string;
}

// Room Events Payloads
export interface JoinRoomPayload {
    roomCode: string;
    sessionId: string;
    username: string;
}

export interface RoomUpdatePayload {
    players: PlayerInfo[];
    status: string;
}

export interface PlayerInfo {
    odId: string;
    sessionId: string;
    username: string;
    position: number;
    isHost: boolean;
    isConnected: boolean;
}

// Game Events Payloads
export interface GameStartPayload {
    roomCode: string;
}

export interface GameActionPayload {
    roomCode: string;
    action: 'roll' | 'move';
    data?: unknown;
}

export interface GameStatePayload {
    state: SnakeLadderGameState | any; // Allow any for Poker
    lastAction?: {
        action: string;
        by: string;
        data?: unknown;
    };
}

export interface TokenMovePayload {
    roomCode: string;
    steps: SnakeLadderMoveStep[];
    finalState: SnakeLadderGameState;
    move?: any;
}

// Error Payload
export interface ErrorPayload {
    message: string;
    code?: string;
}

// Winner Payload
export interface WinnerPayload {
    winner: {
        position: number;
        username: string;
        sessionId: string;
    };
}
