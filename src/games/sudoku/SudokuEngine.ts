import { GameEngine } from '../base/GameEngine';
import { SudokuState, SudokuMovePayload, SudokuCell, SudokuDifficulty } from './types';

export class SudokuEngine extends GameEngine<SudokuState> {
    private solution: number[][] = [];

    constructor(roomCode: string) {
        super(roomCode);
    }

    getGameType(): string {
        return 'sudoku';
    }

    getMinPlayers(): number {
        return 1;
    }

    getMaxPlayers(): number {
        return 1;
    }

    getInitialState(): SudokuState {
        return this.generateNewGame('easy', false);
    }

    isGameOver(): boolean {
        return this.state.isComplete;
    }

    getWinner(): number | null {
        return this.state.isWon ? 0 : null; // Single player is index 0
    }

    handleAction(playerId: string, action: string, payload: unknown): SudokuState {
        if (this.state.isComplete && action !== 'new_game') {
            return this.state;
        }

        switch (action) {
            case 'move':
                return this.handleMove(payload as SudokuMovePayload);
            case 'new_game':
                const params = payload as { difficulty?: SudokuDifficulty; challengeMode?: boolean };
                const difficulty = params.difficulty || 'easy';
                const isChallenge = !!params.challengeMode;
                return this.generateNewGame(difficulty, isChallenge);
            default:
                return this.state;
        }
    }

    private handleMove(payload: SudokuMovePayload): SudokuState {
        const { row, col, value } = payload;

        // Basic validation
        if (row < 0 || row > 8 || col < 0 || col > 8) return this.state;

        // Check timeout
        if (this.state.challengeMode && this.state.timeLimit) {
            const elapsed = (Date.now() - this.state.startTime) / 1000;
            if (elapsed > this.state.timeLimit) {
                this.state.isComplete = true; // Game Over
                this.state.isWon = false;
                this.state.endTime = Date.now();
                return this.state;
            }
        }

        const cell = this.state.board[row][col];
        if (cell.isFixed) return this.state; // Cannot change fixed cells

        // If in challenge mode, check against solution immediately
        if (this.state.challengeMode && value !== null) {
            const correctValue = this.solution[row][col];
            if (value !== correctValue) {
                // Wrong move
                this.state.mistakes++;

                // We typically show it's wrong in challenge mode instantly
                // We'll set the value but mark it as error? Or reject the move?
                // Standard apps usually show the wrong number in red, count a mistake.
                // Or some just flash error and don't fill it.
                // Let's fill it and mark error so they see what they typed.
                cell.value = value;
                cell.isError = true;

                if (this.state.mistakes >= 3) {
                    this.state.isComplete = true; // Game Over
                    this.state.isWon = false;
                    this.state.endTime = Date.now();
                }

                this.updatedAt = Date.now();
                return this.state;
            }
        }

        // Apply move
        cell.value = value;
        // Clear error if they fixed it (or if they cleared it)
        cell.isError = false;

        // Validate board (for non-challenge mode, or general consistency)
        if (!this.state.challengeMode) {
            this.validateBoard();
        }

        // Check completion
        this.checkCompletion();

        this.updatedAt = Date.now();
        return this.state;
    }

    private validateBoard(): void {
        // Reset errors first
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                this.state.board[r][c].isError = false;
            }
        }

        // Check rows, cols, and boxes for duplicates
        const checkGroup = (cells: SudokuCell[]) => {
            const seen = new Map<number, SudokuCell[]>();
            cells.forEach(cell => {
                if (cell.value !== null) {
                    if (!seen.has(cell.value)) seen.set(cell.value, []);
                    seen.get(cell.value)?.push(cell);
                }
            });
            seen.forEach((duplicates, val) => {
                if (duplicates.length > 1) {
                    duplicates.forEach(cell => cell.isError = true);
                }
            });
        };

        // Rows
        for (let r = 0; r < 9; r++) checkGroup(this.state.board[r]);

        // Cols
        for (let c = 0; c < 9; c++) checkGroup(this.state.board.map(row => row[c]));

        // Boxes
        for (let br = 0; br < 3; br++) {
            for (let bc = 0; bc < 3; bc++) {
                const boxCells: SudokuCell[] = [];
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        boxCells.push(this.state.board[br * 3 + r][bc * 3 + c]);
                    }
                }
                checkGroup(boxCells);
            }
        }
    }

    private checkCompletion() {
        let isFull = true;
        let hasErrors = false;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = this.state.board[r][c];
                if (cell.value === null) isFull = false;
                if (cell.isError) hasErrors = true;
            }
        }

        if (isFull && !hasErrors) {
            this.state.isComplete = true;
            this.state.isWon = true;
            this.state.endTime = Date.now();
        }
    }

    private generateNewGame(difficulty: SudokuDifficulty, challengeMode: boolean): SudokuState {
        // Start with a solved board then remove numbers
        const board = this.createEmptyBoard();
        this.fillBoard(board); // Simple filling algo

        // Save solution
        this.solution = board.map(row => row.map(cell => cell.value!));

        // Create playable board
        this.removeNumbers(board, difficulty);

        // Determine time limit (in seconds) - Example values
        let timeLimit: number | null = null;
        if (challengeMode) {
            switch (difficulty) {
                case 'easy': timeLimit = 5 * 60; break;
                case 'medium': timeLimit = 10 * 60; break;
                case 'hard': timeLimit = 15 * 60; break;
            }
        }

        this.state = {
            board,
            difficulty,
            mistakes: 0,
            isComplete: false,
            isWon: false,
            startTime: Date.now(),
            endTime: null,
            challengeMode: challengeMode,
            timeLimit: timeLimit
        };
        return this.state;
    }

    private createEmptyBoard(): SudokuCell[][] {
        return Array(9).fill(null).map((_, r) =>
            Array(9).fill(null).map((_, c) => ({
                row: r,
                col: c,
                value: null,
                isFixed: false,
                isError: false
            }))
        );
    }

    // Simple backtracking solver to fill board
    private fillBoard(board: SudokuCell[][]): boolean {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c].value === null) {
                    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
                    for (const num of nums) {
                        if (this.isValidMove(board, r, c, num)) {
                            board[r][c].value = num;
                            if (this.fillBoard(board)) return true;
                            board[r][c].value = null;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    private isValidMove(board: SudokuCell[][], row: number, col: number, num: number): boolean {
        // Row check
        for (let c = 0; c < 9; c++) if (board[row][c].value === num) return false;
        // Col check
        for (let r = 0; r < 9; r++) if (board[r][col].value === num) return false;
        // Box check
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (board[startRow + r][startCol + c].value === num) return false;
            }
        }
        return true;
    }

    private removeNumbers(board: SudokuCell[][], difficulty: SudokuDifficulty) {
        let attempts = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 45 : 55;
        // Adjust for challenge mode? Usually same puzzle, just stricter rules.

        while (attempts > 0) {
            let row = Math.floor(Math.random() * 9);
            let col = Math.floor(Math.random() * 9);
            while (board[row][col].value === null) {
                row = Math.floor(Math.random() * 9);
                col = Math.floor(Math.random() * 9);
            }
            board[row][col].value = null;
            attempts--;
        }

        // Mark remaining as fixed
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                board[r][c].isFixed = board[r][c].value !== null;
            }
        }
    }
}
