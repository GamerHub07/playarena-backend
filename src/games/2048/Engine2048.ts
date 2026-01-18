import { GameEngine } from '../base/GameEngine';
import { Game2048State, Game2048MovePayload, Tile, Direction } from './types';
import { v4 as uuidv4 } from 'uuid'; // We might need a UUID generator, or just a simple counter if uuid isn't avail.
// Assuming we don't have uuid package, let's make a simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

export class Engine2048 extends GameEngine<Game2048State> {
    constructor(roomCode: string) {
        super(roomCode);
    }

    getGameType(): string {
        return '2048';
    }

    getMinPlayers(): number {
        return 1;
    }

    getMaxPlayers(): number {
        return 1;
    }

    getInitialState(): Game2048State {
        return this.startNewGame();
    }

    isGameOver(): boolean {
        return this.state.gameOver;
    }

    getWinner(): number | null {
        return this.state.won ? 0 : null;
    }

    handleAction(playerId: string, action: string, payload: unknown): Game2048State {
        if (this.state.gameOver && action !== 'restart') return this.state;

        switch (action) {
            case 'move':
                return this.move((payload as Game2048MovePayload).direction);
            case 'restart':
                return this.startNewGame();
            case 'keep_playing':
                this.state.keepPlaying = true;
                this.state.won = false; // Reset "won" trigger so we don't show modal again
                return this.state;
            default:
                return this.state;
        }
    }

    private startNewGame(): Game2048State {
        const emptyGrid = Array(4).fill(null).map(() => Array(4).fill(null));
        this.addRandomTile(emptyGrid);
        this.addRandomTile(emptyGrid);

        this.state = {
            grid: emptyGrid,
            score: 0,
            bestScore: this.state?.bestScore || 0,
            gameOver: false,
            won: false,
            keepPlaying: false
        };
        return this.state;
    }

    private addRandomTile(grid: (Tile | null)[][]) {
        const emptyCells: { r: number, c: number }[] = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (!grid[r][c]) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length === 0) return;

        const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        grid[r][c] = {
            id: generateId(),
            row: r,
            col: c,
            val: Math.random() < 0.9 ? 2 : 4,
            isNew: true
        };
    }

    private move(direction: Direction): Game2048State {
        // deep clone grid to track changes
        // A simple structured clone or manual copy needed because we mutate objects
        let grid = this.state.grid.map(row => row.map(tile => tile ? { ...tile } : null));
        let score = this.state.score;
        let moved = false;

        // Reset merger/new flags
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (grid[r][c]) {
                    grid[r][c]!.mergedFrom = undefined;
                    grid[r][c]!.isNew = false;
                }
            }
        }

        const rotate = (matrix: (Tile | null)[][]) => {
            return matrix[0].map((val, index) => matrix.map(row => row[index]).reverse());
        };

        const rotateLeft = (matrix: (Tile | null)[][]) => {
            return matrix[0].map((val, index) => matrix.map(row => row[row.length - 1 - index]));
        };

        // Align grid so we always process left moves
        let rotated = grid;
        let rotations = 0;
        if (direction === 'right') { rotated = rotate(rotate(grid)); rotations = 2; }
        if (direction === 'up') { rotated = rotateLeft(grid); rotations = 1; }
        if (direction === 'down') { rotated = rotate(grid); rotations = 3; } // rotate right 3 times = left 1 time? No. Down needs 1 right to utilize left logic? 
        // Let's stick to standard standard:
        // Left: 0
        // Down: rotate right 1 -> now "down" is "left" -> process -> rotate left 1 (inv)
        // Right: rotate right 2 
        // Up: rotate right 3 (or left 1)

        // Simpler: Just implement vectors.
        // Or stick to rotation logic correctly.
        // Rotations right:
        // Left: 0
        // Down: 1 (top becomes right, right becomes bottom... wait. 
        // If I rotate CW 90:
        // [1 2] -> [3 1]
        // [3 4]    [4 2]
        // Up was top row. Now it's right col. So Up -> Right.

        // Let's genericize "slide row left"
        const slideRow = (row: (Tile | null)[]) => {
            const newRow: (Tile | null)[] = row.filter(t => t !== null);
            for (let i = 0; i < newRow.length - 1; i++) {
                if (newRow[i]!.val === newRow[i + 1]!.val) {
                    const mergedVal = newRow[i]!.val * 2;
                    const mergedId = generateId();
                    newRow[i] = {
                        id: mergedId,
                        val: mergedVal,
                        row: 0, col: 0, // placeholders, fix later
                        mergedFrom: [newRow[i]!.id, newRow[i + 1]!.id]
                    };
                    newRow[i + 1] = null;
                    score += mergedVal;
                    moved = true;
                }
            }
            return newRow.filter(t => t !== null); // Remove nulls from merge
        };

        // Apply slide to all rows based on direction
        const vector = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 }
        }[direction];

        // We'll create a new grid state manually to be safe
        let cellMoved = false;

        const traverse = (callback: (r: number, c: number) => void) => {
            const range = [0, 1, 2, 3];
            const rows = direction === 'down' ? [...range].reverse() : range;
            const cols = direction === 'right' ? [...range].reverse() : range;

            rows.forEach(r => {
                cols.forEach(c => {
                    callback(r, c);
                });
            });
        };

        const inBounds = (r: number, c: number) => r >= 0 && r < 4 && c >= 0 && c < 4;

        traverse((r, c) => {
            const tile = grid[r][c];
            if (!tile) return;

            let nextR = r + vector.y;
            let nextC = c + vector.x;
            let destR = r;
            let destC = c;

            // Find farthest position
            while (inBounds(nextR, nextC) && !grid[nextR][nextC]) {
                destR = nextR;
                destC = nextC;
                nextR += vector.y;
                nextC += vector.x;
            }

            // Check merge
            if (inBounds(nextR, nextC) && grid[nextR][nextC]!.val === tile.val && !grid[nextR][nextC]!.mergedFrom) {
                // Merge!
                const target = grid[nextR][nextC]!;
                const newVal = tile.val * 2;

                grid[nextR][nextC] = {
                    id: generateId(),
                    val: newVal,
                    row: nextR,
                    col: nextC,
                    mergedFrom: [target.id, tile.id]
                };
                grid[r][c] = null;
                score += newVal;
                moved = true;

                if (newVal === 2048 && !this.state.won && !this.state.keepPlaying) {
                    this.state.won = true;
                }
            } else if (destR !== r || destC !== c) {
                // Just move
                grid[destR][destC] = {
                    ...tile,
                    row: destR,
                    col: destC
                };
                grid[r][c] = null;
                moved = true;
            }
        });

        if (moved) {
            this.addRandomTile(grid);

            // Check game over
            if (!this.movesAvailable(grid)) {
                this.state.gameOver = true;
            }

            this.state.bestScore = Math.max(score, this.state.bestScore);
        }

        this.state.grid = grid;
        this.state.score = score;
        this.updatedAt = Date.now();

        return this.state;
    }

    private movesAvailable(grid: (Tile | null)[][]): boolean {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (!grid[r][c]) return true;
                if (c < 3 && grid[r][c]!.val === grid[r][c + 1]!.val) return true;
                if (r < 3 && grid[r][c]!.val === grid[r + 1][c]!.val) return true;
            }
        }
        return false;
    }
}
