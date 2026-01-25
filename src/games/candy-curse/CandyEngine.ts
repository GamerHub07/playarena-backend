import { GameEngine } from '../base/GameEngine';
import { CandyState, CandyGem, GemType, CandyMovePayload } from './types';
import { v4 as uuidv4 } from 'uuid';

const ROWS = 8;
const COLS = 8;
const GEM_TYPES: GemType[] = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE'];

export class CandyEngine extends GameEngine<CandyState> {
    constructor(roomCode: string) {
        super(roomCode);
    }

    getGameType(): string {
        return 'candy-curse';
    }

    getMinPlayers(): number {
        return 1;
    }

    getMaxPlayers(): number {
        return 1;
    }

    getInitialState(): CandyState {
        return this.startNewGame();
    }

    isGameOver(): boolean {
        return this.state.isComplete;
    }

    getWinner(): number | null {
        return this.state.isComplete && this.state.score >= this.state.targetScore ? 0 : null;
    }

    getCurrentPlayerIndex(): number {
        return 0;
    }

    autoPlay(playerIndex: number): CandyState {
        return this.state;
    }

    eliminatePlayer(playerIndex: number): void {
        this.state.isComplete = true; // For single player, eliminating acts as giving up/game over
    }

    handleAction(playerId: string, action: string, payload: unknown): CandyState {
        if (this.state.isComplete && action !== 'restart') return this.state;

        switch (action) {
            case 'swap':
                const move = payload as CandyMovePayload;
                return this.handleSwap(move.row1, move.col1, move.row2, move.col2);
            case 'restart':
                return this.startNewGame();
            default:
                return this.state;
        }
    }

    private startNewGame(): CandyState {
        this.state = {
            grid: this.createInitialGrid(),
            score: 0,
            movesLeft: 20, // Example limit
            targetScore: 2000,
            isComplete: false,
            comboMultiplier: 1
        };
        return this.state;
    }

    private createInitialGrid(): CandyGem[][] {
        let grid: CandyGem[][] = [];
        // Loop until we generate a valid grid with no pre-existing matches
        do {
            grid = [];
            for (let r = 0; r < ROWS; r++) {
                const row: CandyGem[] = [];
                for (let c = 0; c < COLS; c++) {
                    row.push({
                        id: uuidv4(),
                        type: this.getRandomGem(),
                        row: r,
                        col: c
                    });
                }
                grid.push(row);
            }
        } while (this.hasMatches(grid));

        return grid;
    }

    private getRandomGem(): GemType {
        return GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
    }

    private hasMatches(grid: CandyGem[][]): boolean {
        // Horizontal
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS - 2; c++) {
                const type = grid[r][c].type;
                if (type && type === grid[r][c + 1].type && type === grid[r][c + 2].type) return true;
            }
        }
        // Vertical
        for (let r = 0; r < ROWS - 2; r++) {
            for (let c = 0; c < COLS; c++) {
                const type = grid[r][c].type;
                if (type && type === grid[r + 1][c].type && type === grid[r + 2][c].type) return true;
            }
        }
        return false;
    }

    private handleSwap(r1: number, c1: number, r2: number, c2: number): CandyState {
        if (this.state.movesLeft <= 0) return this.state;

        // Verify adjacency
        if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return this.state;

        // Perform Swap
        const grid = this.state.grid; // work on ref for now, but dangerous? No, strictly single threaded here.

        const temp = grid[r1][c1];
        grid[r1][c1] = grid[r2][c2];
        grid[r2][c2] = temp;

        // Update coords
        grid[r1][c1].row = r1;
        grid[r1][c1].col = c1;
        grid[r2][c2].row = r2;
        grid[r2][c2].col = c2;

        // Check Matches
        if (this.hasMatches(grid)) {
            this.state.movesLeft--;
            this.state.comboMultiplier = 1;
            this.resolveMatches(grid);
        } else {
            // Revert swap if invalid
            const tempRevert = grid[r1][c1];
            grid[r1][c1] = grid[r2][c2];
            grid[r2][c2] = tempRevert;

            grid[r1][c1].row = r1;
            grid[r1][c1].col = c1;
            grid[r2][c2].row = r2;
            grid[r2][c2].col = c2;
        }

        if (this.state.movesLeft === 0) {
            this.state.isComplete = true;
        }

        this.updatedAt = Date.now();
        return this.state;
    }

    private resolveMatches(grid: CandyGem[][]) {
        let loop = 0;
        // loop to handle cascades
        while (this.hasMatches(grid) && loop < 10) {
            loop++;
            const matches = new Set<string>(); // IDs to remove
            const specialCreations: { r: number, c: number, type: 'HORIZONTAL' | 'VERTICAL' | 'BOMB', color: GemType }[] = [];

            // 1. Find Matches & Detect Specials
            // Horizontal
            for (let r = 0; r < ROWS; r++) {
                let matchLen = 1;
                for (let c = 0; c < COLS; c++) {
                    const current = grid[r][c];
                    const next = c < COLS - 1 ? grid[r][c + 1] : null;

                    if (next && current.type && current.type === next.type) {
                        matchLen++;
                    } else {
                        if (matchLen >= 3) {
                            // End of a match sequence
                            for (let k = 0; k < matchLen; k++) {
                                matches.add(grid[r][c - k].id);
                            }
                            // Detect Special (Horizontal Match)
                            if (matchLen === 4) {
                                // Create Vertical Striped (matches horiz -> creates vertical line clearer usually, or vice versa depending on game rules. Let's say horiz match creates VERTICAL blaster)
                                specialCreations.push({ r: r, c: c - Math.floor(matchLen / 2), type: 'VERTICAL', color: grid[r][c - 1].type });
                            } else if (matchLen >= 5) {
                                // Create Color Bomb
                                specialCreations.push({ r: r, c: c - Math.floor(matchLen / 2), type: 'BOMB', color: null }); // Bomb has no color usually, or all colors
                            }
                        }
                        matchLen = 1;
                    }
                }
            }

            // Vertical
            for (let c = 0; c < COLS; c++) {
                let matchLen = 1;
                for (let r = 0; r < ROWS; r++) {
                    const current = grid[r][c];
                    const next = r < ROWS - 1 ? grid[r + 1][c] : null;

                    if (next && current.type && current.type === next.type) {
                        matchLen++;
                    } else {
                        if (matchLen >= 3) {
                            for (let k = 0; k < matchLen; k++) {
                                matches.add(grid[r - k][c].id);
                            }
                            // Detect Special (Vertical Match)
                            if (matchLen === 4) {
                                specialCreations.push({ r: r - Math.floor(matchLen / 2), c: c, type: 'HORIZONTAL', color: grid[r - 1][c].type });
                            } else if (matchLen >= 5) {
                                specialCreations.push({ r: r - Math.floor(matchLen / 2), c: c, type: 'BOMB', color: null });
                            }
                        }
                        matchLen = 1;
                    }
                }
            }

            // 1.5 Handle Special Candy Activations (If a special candy is in 'matches', trigger its effect)
            // This is recursive/iterative. For simple MVP, we just check if any matched gem was special.
            const bombsTriggered = new Set<string>();
            let setChanged = true;
            while (setChanged) {
                setChanged = false;
                // Check all gems currently marked for removal
                for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                        const gem = grid[r][c];
                        if (matches.has(gem.id) && !bombsTriggered.has(gem.id)) {
                            if (gem.special === 'HORIZONTAL') {
                                bombsTriggered.add(gem.id);
                                // Clear Row
                                for (let rc = 0; rc < COLS; rc++) {
                                    if (!matches.has(grid[r][rc].id)) {
                                        matches.add(grid[r][rc].id);
                                        setChanged = true;
                                    }
                                }
                            } else if (gem.special === 'VERTICAL') {
                                bombsTriggered.add(gem.id);
                                // Clear Col
                                for (let rr = 0; rr < ROWS; rr++) {
                                    if (!matches.has(grid[rr][c].id)) {
                                        matches.add(grid[rr][c].id);
                                        setChanged = true;
                                    }
                                }
                            } else if (gem.special === 'BOMB') {
                                bombsTriggered.add(gem.id);
                                // Clear area for now if matched normally
                                for (let rr = Math.max(0, r - 2); rr <= Math.min(ROWS - 1, r + 2); rr++) {
                                    for (let rc = Math.max(0, c - 2); rc <= Math.min(COLS - 1, c + 2); rc++) {
                                        if (!matches.has(grid[rr][rc].id)) {
                                            matches.add(grid[rr][rc].id);
                                            setChanged = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 2. Score
            const baseScore = matches.size * 10;
            const specialBonus = specialCreations.length * 500;
            const comboBonus = (this.state.comboMultiplier - 1) * 50;
            this.state.score += (baseScore + specialBonus + comboBonus);
            this.state.comboMultiplier++;

            // 3. Create New Specials (Remove them from the 'deletion' set so they stick around)
            specialCreations.forEach(spec => {
                const gem = grid[spec.r][spec.c];
                // Revive this gem, but change it
                matches.delete(gem.id);
                gem.special = spec.type;
                gem.type = spec.color || 'RED'; // Bomb defaults to RED if typeless, but frontend handles special look
                if (spec.type === 'BOMB') gem.type = null;
            });

            // 4. Remove & Shift
            for (let c = 0; c < COLS; c++) {
                let shift = 0;
                // Bottom up
                for (let r = ROWS - 1; r >= 0; r--) {
                    if (matches.has(grid[r][c].id)) {
                        shift++;
                    } else if (shift > 0) {
                        // Move gem down
                        grid[r + shift][c] = grid[r][c];
                        grid[r + shift][c].row = r + shift;
                    }
                }

                // Fill top holes
                for (let r = 0; r < shift; r++) {
                    grid[r][c] = {
                        id: uuidv4(),
                        type: this.getRandomGem(),
                        row: r,
                        col: c,
                        isNew: true
                    };
                }
            }
        }
    }
}
