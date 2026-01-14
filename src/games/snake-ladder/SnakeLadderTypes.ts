/**
 * Snake & Ladder Game Types
 * 
 * Production-ready type definitions for Snake & Ladder gameplay.
 * Follows the same patterns as LudoTypes.ts for consistency.
 */

// ═══════════════════════════════════════════════════════════════
// GAME STATE INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface SnakeLadderGameState {
    players: Record<number, SnakeLadderPlayerState>;
    currentPlayer: number;
    diceValue: number | null;
    lastRoll: number | null;
    turnPhase: 'roll' | 'wait';
    winner: number | null;
    moveHistory: SnakeLadderMove[];
    /** Track if current player can roll again (rolled 6) */
    canRollAgain: boolean;
    /** Number of consecutive 6s rolled (3 in a row = skip turn) */
    consecutiveSixes: number;
}

export interface SnakeLadderPlayerState {
    /** Position on board: 0 = not started, 1-100 = on board, 100 = finished */
    position: number;
    /** Player color for UI rendering */
    color: string;
}

export interface SnakeLadderMove {
    player: number;
    from: number;
    to: number;
    diceValue: number;
    /** If landed on snake head */
    usedSnake: boolean;
    /** Position after snake (if any) */
    snakeEnd?: number;
    /** If landed on ladder bottom */
    usedLadder: boolean;
    /** Position after ladder (if any) */
    ladderEnd?: number;
    timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION INTERFACES
// ═══════════════════════════════════════════════════════════════

/**
 * Step-by-step animation data for token movement
 * Used by frontend to animate tokens cell-by-cell
 */
export interface SnakeLadderMoveStep {
    playerIndex: number;
    position: number;
    row: number;
    col: number;
    stepNumber: number;
    totalSteps: number;
    /** Special move type for visual effects */
    moveType: 'normal' | 'snake' | 'ladder' | 'win' | 'bounce';
}

export interface DiceRollResult {
    value: number;
    canMove: boolean;
    isExtraTurn: boolean;
    skipTurn: boolean;
}

// ═══════════════════════════════════════════════════════════════
// BOARD CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Board configuration - snakes (head → tail)
export const SNAKES: Record<number, number> = {
    98: 40, // Super Punishment
    87: 66, // Late annoyance
    84: 58, // Upper setback
    73: 15, // Disaster
    56: 8,  // Early reset
    49: 30, // Minor setback
    33: 6,  // Start setback
    23: 2,  // Very early setback
};

// Ladders (bottom → top)
export const LADDERS: Record<number, number> = {
    4: 25,  // Start boost
    21: 39, // Mid boost
    29: 74, // Huge mid-game boost
    43: 76, // Upper mid boost
    63: 80, // Late game help
    71: 89, // End game boost
};

// ═══════════════════════════════════════════════════════════════
// GAME CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const BOARD_SIZE = 100;
export const BOARD_ROWS = 10;
export const BOARD_COLS = 10;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;
export const MAX_CONSECUTIVE_SIXES = 3;

/** Player colors matching the design system */
export const PLAYER_COLORS = [
    '#E53935',  // Red
    '#43A047',  // Green
    '#FDD835',  // Yellow
    '#1E88E5',  // Blue
];

// ═══════════════════════════════════════════════════════════════
// BOARD LAYOUT HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Convert board position (1-100) to grid coordinates (row, col)
 * Board is arranged in a boustrophedon (snake-like) pattern:
 * 
 * 100 99 98 97 96 95 94 93 92 91  (row 0, right to left)
 *  81 82 83 84 85 86 87 88 89 90  (row 1, left to right)
 *  80 79 78 77 76 75 74 73 72 71  (row 2, right to left)
 *  ...
 *   1  2  3  4  5  6  7  8  9 10  (row 9, left to right)
 */
export function positionToGrid(position: number): { row: number; col: number } {
    if (position < 1 || position > 100) {
        return { row: 9, col: 0 }; // Default to start area
    }

    // Calculate row from bottom (row 9 = positions 1-10, row 0 = positions 91-100)
    const row = 9 - Math.floor((position - 1) / 10);

    // Calculate column based on row direction
    const posInRow = (position - 1) % 10;
    const isLeftToRight = (9 - row) % 2 === 0; // Rows 0, 2, 4... from bottom go left-to-right

    const col = isLeftToRight ? posInRow : 9 - posInRow;

    return { row, col };
}

/**
 * Get all positions between start and end (inclusive) for animation
 */
export function getPathPositions(start: number, end: number): number[] {
    const positions: number[] = [];
    const direction = end > start ? 1 : -1;

    for (let pos = start; direction > 0 ? pos <= end : pos >= end; pos += direction) {
        positions.push(pos);
    }

    return positions;
}
