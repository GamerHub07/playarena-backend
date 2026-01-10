// Ludo Game Types and Interfaces

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export interface TokenPosition {
    zone: 'home' | 'path' | 'safe' | 'finish';
    index: number; // Position on board or token index in home (0-3)
}

export interface PlayerState {
    color: PlayerColor;
    tokens: TokenPosition[];
    finishedTokens: number;
    rank?: number; // 1 for 1st, 2 for 2nd, etc.
}

export interface LudoGameState {
    players: Record<number, PlayerState>;
    currentPlayer: number;
    diceValue: number | null;
    lastRoll: number | null;
    canRollAgain: boolean;
    turnPhase: 'roll' | 'move' | 'wait';
    winner: number | null; // Keeps track of the FIRST winner for backward compatibility logic if needed
    finishedPlayers: number[]; // Array of player indices in order of finishing
    eliminatedPlayers: number[]; // Array of player indices who were eliminated (exceeded max auto-plays)
    moveHistory: MoveRecord[];
    movableTokens?: number[]; // Tokens that can be moved after rolling
}

export interface MoveRecord {
    player: number;
    tokenIndex: number;
    from: TokenPosition;
    to: TokenPosition;
    captured: boolean;
    timestamp: number;
}

export interface DiceRollResult {
    value: number;
    canMove: boolean;
    movableTokens: number[];
}

// Board positions mapping
export const PLAYER_START_POSITIONS: Record<PlayerColor, number> = {
    red: 0,
    green: 13,
    yellow: 26,
    blue: 39,
};

export const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47]; // Star positions

export const PATH_LENGTH = 52;
export const HOME_STRETCH_LENGTH = 6;

export const HOME_ENTRY_POSITIONS: Record<PlayerColor, number> = {
    red: 50,
    green: 11,
    yellow: 24,
    blue: 37,
};
