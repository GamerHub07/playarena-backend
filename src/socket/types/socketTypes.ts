/**
 * Socket Type Definitions
 * All socket-related payload interfaces
 */

import { LudoGameState, TokenPosition } from '../../games/ludo/LudoTypes';

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
    timeControl?: number; // Time in minutes for the game (for chess)
}

export interface GameActionPayload {
    roomCode: string;
    action: 'roll' | 'move' | 'restart';
    data?: {
        tokenIndex?: number;
        cellIndex?: number;  // For Tic Tac Toe moves
    };
}

export interface GameStatePayload {
    state: LudoGameState;
    lastAction?: {
        action: string;
        by: string;
        data?: unknown;
    };
}

// Token Animation Payloads
export interface TokenMoveStep {
    playerIndex: number;
    tokenIndex: number;
    position: {
        zone: TokenPosition['zone'];
        index: number;
    };
    row: number;
    col: number;
    stepNumber: number;
    totalSteps: number;
    captured?: boolean;
}

export interface TokenMovePayload {
    roomCode: string;
    steps: TokenMoveStep[];
    finalState: LudoGameState;
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
