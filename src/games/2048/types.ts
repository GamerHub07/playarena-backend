export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Tile {
    id: string; // Unique ID for animations
    val: number;
    row: number;
    col: number;
    mergedFrom?: string[]; // IDs of tiles that merged into this one
    isNew?: boolean;       // For appear animation
}

export interface Game2048State {
    grid: (Tile | null)[][]; // 4x4 grid
    score: number;
    bestScore: number;
    gameOver: boolean;
    won: boolean;
    keepPlaying: boolean; // Continue after 2048
}

export interface Game2048MovePayload {
    direction: Direction;
}

export type Game2048ActionType = 'move' | 'restart' | 'keep_playing';
