/**
 * Type declarations for pokersolver package
 * @see https://github.com/goldfire/pokersolver
 */

declare module 'pokersolver' {
    export class Hand {
        /**
         * Create a hand from an array of card strings
         * Cards are in format: rank + suit (e.g., "Ah", "Ks", "2d", "Tc")
         * Ranks: A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2
         * Suits: s (spades), h (hearts), d (diamonds), c (clubs)
         */
        static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand;

        /**
         * Compare multiple hands and return the winner(s)
         */
        static winners(hands: Hand[]): Hand[];

        /**
         * Name of the hand (e.g., "Pair", "Flush", "Full House")
         */
        name: string;

        /**
         * Description with cards (e.g., "Pair of Aces")
         */
        descr: string;

        /**
         * Rank of the hand (higher is better)
         */
        rank: number;

        /**
         * The cards that make up the hand
         */
        cards: Card[];

        /**
         * Compare this hand to another
         * Returns positive if this hand wins, negative if it loses, 0 if tie
         */
        compare(other: Hand): number;

        /**
         * Convert hand to string
         */
        toString(): string;
    }

    export interface Card {
        value: string;
        suit: string;
        rank: number;
        wildValue?: string;
    }
}
