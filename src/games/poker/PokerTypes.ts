/**
 * Poker Game Types
 * 
 * Type definitions for Texas Hold'em Poker gameplay.
 * Follows the same patterns as ChessTypes.ts for consistency.
 */

// ═══════════════════════════════════════════════════════════════
// CARD DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
    suit: Suit;
    rank: Rank;
}

// Full deck constants
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// ═══════════════════════════════════════════════════════════════
// PLAYER STATE
// ═══════════════════════════════════════════════════════════════

export interface PokerPlayerState {
    sessionId: string;
    username: string;
    position: number;          // Seat position (0-7)
    hand: Card[];              // Player's hole cards (2 cards)
    chips: number;             // Current chip count
    currentBet: number;        // Amount bet in current betting round
    totalBetThisHand: number;  // Total amount bet this hand (for pot calculation)
    folded: boolean;           // Has player folded this hand
    allIn: boolean;            // Is player all-in
    isDealer: boolean;         // Is current dealer
    isSmallBlind: boolean;     // Is small blind this hand
    isBigBlind: boolean;       // Is big blind this hand
    hasActed: boolean;         // Has acted in current betting round
    isActive: boolean;         // Is still in the game (has chips)
    lastAction?: PlayerAction; // Last action taken
}

// ═══════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════

export type BettingPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in' | 'eliminated';

export interface PokerGameState {
    // Core game state
    players: Record<number, PokerPlayerState>; // Indexed by seat position
    communityCards: Card[];    // Shared cards (0-5)
    deck: Card[];              // Remaining cards in deck

    // Betting state
    pot: number;               // Main pot
    sidePots: SidePot[];       // Side pots for all-in situations
    currentBet: number;        // Current bet to match
    minRaise: number;          // Minimum raise amount

    // Blinds
    smallBlind: number;
    bigBlind: number;

    // Turn management
    currentPlayerIndex: number; // Seat position of current player
    dealerIndex: number;        // Seat position of dealer
    lastRaiserIndex: number;    // Who made the last raise (for round end detection)

    // Game phase
    phase: BettingPhase;

    // Hand tracking
    handNumber: number;

    // Winner info (set at showdown)
    winners: WinnerInfo[] | null;

    // Game over
    gameWinner: number | null;  // Seat position of overall winner
    isGameOver: boolean;
}

export interface SidePot {
    amount: number;
    eligiblePlayers: number[]; // Seat positions of eligible players
}

export interface WinnerInfo {
    playerIndex: number;
    amount: number;
    handName: string;         // e.g., "Full House", "Two Pair"
    handCards: Card[];        // Best 5 cards
}

// ═══════════════════════════════════════════════════════════════
// ACTION PAYLOADS
// ═══════════════════════════════════════════════════════════════

export interface PokerActionPayload {
    action: PlayerAction | 'start_hand';
    amount?: number;          // For raise/all-in
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const STARTING_CHIPS = 1000;
export const DEFAULT_SMALL_BLIND = 10;
export const DEFAULT_BIG_BLIND = 20;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Create a full 52-card deck
 */
export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

/**
 * Shuffle deck using Fisher-Yates algorithm
 */
export function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Convert card to pokersolver format (e.g., "Ah" for Ace of hearts)
 */
export function cardToSolverFormat(card: Card): string {
    const rankMap: Record<Rank, string> = {
        '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
        '7': '7', '8': '8', '9': '9', '10': 'T',
        'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
    };
    const suitMap: Record<Suit, string> = {
        'hearts': 'h', 'diamonds': 'd', 'clubs': 'c', 'spades': 's'
    };
    return rankMap[card.rank] + suitMap[card.suit];
}

/**
 * Get display string for a card
 */
export function cardToString(card: Card): string {
    const suitSymbols: Record<Suit, string> = {
        'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠'
    };
    return `${card.rank}${suitSymbols[card.suit]}`;
}

/**
 * Get next active player index (not folded, not all-in with no more action needed)
 */
export function getNextActivePlayerIndex(
    state: PokerGameState,
    currentIndex: number,
    activePlayers: number[]
): number {
    if (activePlayers.length === 0) return -1;

    const currentPos = activePlayers.indexOf(currentIndex);
    const nextPos = (currentPos + 1) % activePlayers.length;
    return activePlayers[nextPos];
}

/**
 * Get list of players who can still act (not folded, not all-in)
 */
export function getActivePlayers(state: PokerGameState): number[] {
    return Object.values(state.players)
        .filter(p => !p.folded && p.isActive && !p.allIn)
        .map(p => p.position)
        .sort((a, b) => a - b);
}

/**
 * Get list of players still in the hand (not folded)
 */
export function getPlayersInHand(state: PokerGameState): number[] {
    return Object.values(state.players)
        .filter(p => !p.folded && p.isActive)
        .map(p => p.position)
        .sort((a, b) => a - b);
}
