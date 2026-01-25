/**
 * Tic Tac Toe Game Types
 * 
 * Type definitions for the Tic Tac Toe game state and actions.
 */

// Cell value: null (empty), 'X', or 'O'
export type CellValue = null | 'X' | 'O';

// Player symbols
export const PLAYER_SYMBOLS: ['X', 'O'] = ['X', 'O'];

// Board size
export const BOARD_SIZE = 9;
export const GRID_SIZE = 3;

// Min/Max players
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 2;

// Winning combinations (indices in the flattened 3x3 array)
export const WINNING_COMBINATIONS = [
    // Rows
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    // Columns
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    // Diagonals
    [0, 4, 8],
    [2, 4, 6],
];

/**
 * Individual player state
 */
export interface TicTacToePlayerState {
    symbol: 'X' | 'O';
    moves: number;  // Number of moves made
}

/**
 * Game state for Tic Tac Toe
 */
export interface TicTacToeGameState {
    board: CellValue[];           // 9 cells (3x3 grid, flattened)
    currentPlayer: number;        // 0 or 1 (index into players array)
    players: Record<number, TicTacToePlayerState>;
    winner: number | null;        // Player index of winner, or null
    isDraw: boolean;              // True if game ended in draw
    gameStarted: boolean;         // True once game has started
    winningLine: number[] | null; // Indices of winning cells for highlighting
    lastMove: number | null;      // Index of last move for animation
}

/**
 * Action payload for making a move
 */
export interface TicTacToeMovePayload {
    cellIndex: number;  // 0-8, the cell to place marker
}

/**
 * Helper to check if a cell index is valid
 */
export function isValidCellIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < BOARD_SIZE;
}

/**
 * Helper to convert cell index to row/col
 */
export function indexToRowCol(index: number): { row: number; col: number } {
    return {
        row: Math.floor(index / GRID_SIZE),
        col: index % GRID_SIZE,
    };
}

/**
 * Helper to convert row/col to cell index
 */
export function rowColToIndex(row: number, col: number): number {
    return row * GRID_SIZE + col;
}
