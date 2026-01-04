export enum HandRank {
    HIGH_CARD = 0,
    PAIR = 1,
    TWO_PAIR = 2,
    THREE_OF_A_KIND = 3,
    STRAIGHT = 4,
    FLUSH = 5,
    FULL_HOUSE = 6,
    FOUR_OF_A_KIND = 7,
    STRAIGHT_FLUSH = 8,
    ROYAL_FLUSH = 9,
}

export interface HandResult {
    rank: HandRank;
    score: number; // For breaking ties
    name: string;
    winningCards: string[];
}

export class HandEvaluator {
    private static readonly RANKS = "23456789TJQKA";
    private static readonly SUITS = "HDCS";

    static evaluate(holeCards: string[], communityCards: string[]): HandResult {
        const allCards = [...holeCards, ...communityCards];
        if (allCards.length === 0) {
            return { rank: HandRank.HIGH_CARD, score: 0, name: "No Cards", winningCards: [] };
        }

        const { ranks, suits, values, rawValues } = this.parseCards(allCards);

        const flushSuit = this.checkFlush(suits);
        const straightHigh = this.checkStraight(values);

        // Straight Flush / Royal Flush
        if (flushSuit && straightHigh !== -1) {
            // Must verify if straight cards are of the flush suit
            const flushCards = allCards.filter(c => c.endsWith(flushSuit!));
            const { values: fValues } = this.parseCards(flushCards);
            const fStraightHigh = this.checkStraight(fValues);

            if (fStraightHigh !== -1) {
                if (fStraightHigh === 14) {
                    return { rank: HandRank.ROYAL_FLUSH, score: 900000, name: "Royal Flush", winningCards: this.getBestCards(allCards, 5) };
                }
                return { rank: HandRank.STRAIGHT_FLUSH, score: 800000 + fStraightHigh, name: "Straight Flush", winningCards: this.getBestCards(allCards, 5) };
            }
        }

        // Four of a Kind
        const fourKind = this.checkMultiples(rawValues, 4);
        if (fourKind) {
            return { rank: HandRank.FOUR_OF_A_KIND, score: 700000 + fourKind, name: "Four of a Kind", winningCards: this.getBestCards(allCards, 5) };
        }

        // Full House
        const threeKind = this.checkMultiples(rawValues, 3);
        if (threeKind) {
            const remaining = rawValues.filter(v => v !== threeKind);
            const pair = this.checkMultiples(remaining, 2); // Check pair in remaining
            // Or check two 3-kinds
            const secondThree = this.checkMultiples(remaining, 3);

            if (pair || secondThree) {
                const secondary = secondThree ? secondThree : pair!;
                return { rank: HandRank.FULL_HOUSE, score: 600000 + threeKind * 100 + secondary, name: "Full House", winningCards: this.getBestCards(allCards, 5) };
            }
        }

        // Flush
        if (flushSuit) {
            // Score based on high cards of flush
            const flushCards = allCards.filter(c => c.endsWith(flushSuit!));
            const { values: fValues } = this.parseCards(flushCards);
            fValues.sort((a, b) => b - a);
            const score = fValues.slice(0, 5).reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);

            return { rank: HandRank.FLUSH, score: 500000 + score, name: "Flush", winningCards: this.getBestCards(flushCards, 5) };
        }

        // Straight
        if (straightHigh !== -1) {
            return { rank: HandRank.STRAIGHT, score: 400000 + straightHigh, name: "Straight", winningCards: this.getBestCards(allCards, 5) };
        }

        // Three of a Kind
        if (threeKind) {
            return { rank: HandRank.THREE_OF_A_KIND, score: 300000 + threeKind, name: "Three of a Kind", winningCards: this.getBestCards(allCards, 5) };
        }

        // Two Pair
        const pair1 = this.checkMultiples(rawValues, 2);
        if (pair1) {
            const remaining = rawValues.filter(v => v !== pair1);
            const pair2 = this.checkMultiples(remaining, 2);
            if (pair2) {
                return { rank: HandRank.TWO_PAIR, score: 200000 + Math.max(pair1, pair2) * 100 + Math.min(pair1, pair2), name: "Two Pair", winningCards: this.getBestCards(allCards, 5) };
            }

            // One Pair
            return { rank: HandRank.PAIR, score: 100000 + pair1, name: "Pair", winningCards: this.getBestCards(allCards, 5) };
        }

        // High Card
        values.sort((a, b) => b - a);
        const score = values.slice(0, 5).reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
        return { rank: HandRank.HIGH_CARD, score: score, name: "High Card", winningCards: this.getBestCards(allCards, 5) };
    }

    private static parseCards(cards: string[]) {
        const ranks = cards.map(c => c.charAt(0));
        const suits = cards.map(c => c.charAt(1));
        const values = ranks.map(r => this.getRankValue(r));
        return { ranks, suits, values, rawValues: values };
    }

    private static getRankValue(rank: string): number {
        const idx = this.RANKS.indexOf(rank);
        return idx + 2; // 2=2, ..., A=14
    }

    private static checkFlush(suits: string[]): string | null {
        const counts: Record<string, number> = {};
        for (const s of suits) {
            counts[s] = (counts[s] || 0) + 1;
            if (counts[s] >= 5) return s;
        }
        return null;
    }

    private static checkStraight(values: number[]): number {
        const unique = Array.from(new Set(values)).sort((a, b) => a - b);

        // Handle Ace low straight (A, 2, 3, 4, 5) -> values: 2,3,4,5,14
        if (unique.includes(14)) {
            unique.unshift(1); // logical 1 for Ace
        }

        let consecutive = 0;
        let highCard = -1;

        for (let i = 0; i < unique.length - 1; i++) {
            if (unique[i + 1] === unique[i] + 1) {
                consecutive++;
                if (consecutive >= 4) { // 5 cards total
                    highCard = unique[i + 1];
                }
            } else {
                consecutive = 0;
            }
        }
        return highCard;
    }

    private static checkMultiples(values: number[], count: number): number | null {
        const counts: Record<number, number> = {};
        for (const v of values) counts[v] = (counts[v] || 0) + 1;

        const matches = Object.entries(counts)
            .filter(([, c]) => c >= count)
            .map(([v]) => parseInt(v))
            .sort((a, b) => b - a); // Return highest

        return matches.length > 0 ? matches[0] : null;
    }

    // Simplified winner card picker (just returns all cards for now, can be improved)
    private static getBestCards(allCards: string[], count: number): string[] {
        return allCards.slice(0, count);
    }
}
