export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
    suit: Suit;
    rank: Rank;
}

export interface PlayerState {
    sessionId: string;
    username: string;
    chips: number;
    currentBet: number;
    hasFolded: boolean;
    isAllIn: boolean;
    hasActed: boolean;
    hand: Card[];
    position: number;
}

export interface PokerGameState {
    players: Record<number, PlayerState>;
    communityCards: Card[];
    pot: number;
    currentPlayer: number;
    dealerIndex: number;
    currentPhase: 'wait' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
    minBet: number;
    winner: number[] | null;
    lastAction?: {
        type: string;
        playerIndex: number;
        amount?: number;
    };
}