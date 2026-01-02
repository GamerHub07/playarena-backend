/**
 * Snake & Ladder Game Types
 * 
 * ⚠️ NOT PRODUCTION READY ⚠️
 * This game is not yet exposed via socket handlers.
 * Proof of architecture extensibility only.
 */

export interface SnakeLadderGameState {
    players: Record<number, SnakeLadderPlayerState>;
    currentPlayer: number;
    diceValue: number | null;
    lastRoll: number | null;
    turnPhase: 'roll' | 'move' | 'wait';
    winner: number | null;
    moveHistory: SnakeLadderMove[];
}

export interface SnakeLadderPlayerState {
    position: number;  // 0-100, 0 = not started, 100 = finished
    color: string;
}

export interface SnakeLadderMove {
    player: number;
    from: number;
    to: number;
    diceValue: number;
    usedSnake: boolean;
    usedLadder: boolean;
    timestamp: number;
}

/**
 * Standard Snake & Ladder board configuration
 * Key = head/bottom, Value = tail/top
 */
export const SNAKES: Record<number, number> = {
    16: 6,
    47: 26,
    49: 11,
    56: 53,
    62: 19,
    64: 60,
    87: 24,
    93: 73,
    95: 75,
    98: 78,
};

export const LADDERS: Record<number, number> = {
    1: 38,
    4: 14,
    9: 31,
    21: 42,
    28: 84,
    36: 44,
    51: 67,
    71: 91,
    80: 100,
};

export const BOARD_SIZE = 100;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const PLAYER_COLORS = ['#E53935', '#43A047', '#FDD835', '#1E88E5'];
