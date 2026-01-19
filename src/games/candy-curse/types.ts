export type GemType = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'PURPLE' | 'ORANGE' | null;

export type SpecialType = 'HORIZONTAL' | 'VERTICAL' | 'BOMB' | null;

export interface CandyGem {
    id: string; // Unique ID for keying/animations
    type: GemType;
    row: number;
    col: number;
    special?: SpecialType;
    isNew?: boolean; // For entry animation
    isMatched?: boolean; // For exit animation
}

export interface CandyState {
    grid: CandyGem[][]; // 8x8
    score: number;
    movesLeft: number;
    targetScore: number;
    isComplete: boolean;
    comboMultiplier: number;
}

export interface CandyMovePayload {
    row1: number;
    col1: number;
    row2: number;
    col2: number;
}
