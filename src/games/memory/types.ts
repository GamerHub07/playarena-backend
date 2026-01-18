export interface MemoryCard {
    id: string;
    content: string; // Emoji or Icon name
    isFlipped: boolean;
    isMatched: boolean;
}

export interface MemoryState {
    cards: MemoryCard[];
    moves: number;
    matches: number;
    isComplete: boolean;
    bestScore: number; // Minimum moves
}

export interface MemoryMovePayload {
    cardId: string;
}
