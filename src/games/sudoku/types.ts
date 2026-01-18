export type SudokuDifficulty = 'easy' | 'medium' | 'hard';

export interface SudokuCell {
    row: number;
    col: number;
    value: number | null; // The number (1-9) or null if empty
    isFixed: boolean;     // True if this was an initial clue
    isError: boolean;     // True if currently conflicting causing an error
}

export interface SudokuState {
    board: SudokuCell[][]; // 9x9 grid
    difficulty: SudokuDifficulty;
    mistakes: number;
    isComplete: boolean;
    startTime: number;
    endTime: number | null;
    challengeMode: boolean;
    timeLimit: number | null;
    isWon: boolean;
}

export interface SudokuMovePayload {
    row: number;
    col: number;
    value: number | null;
}

export type SudokuActionType = 'move' | 'reset' | 'new_game';
