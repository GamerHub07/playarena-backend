import * as PokerSolver from 'pokersolver';
const Hand = PokerSolver.Hand;
import { Card, PlayerState } from './PokerTypes';

export const PokerUtils = {
    /**
     * Converts our internal Card objects into the format pokersolver expects.
     * Example: { rank: '10', suit: 'H' } -> 'Th'
     * Note: Pokersolver specifically uses 'T' for 10.
     */
    formatCardsForSolver(cards: Card[]): string[] {
        return cards.map(c => {
            const rank = c.rank === '10' ? 'T' : c.rank;
            return `${rank}${c.suit.toLowerCase()}`;
        });
    },

    /**
     * Evaluates all active players' hands and returns the indices of the winner(s).
     * Handles split pots (multiple winners) automatically.
     */
    evaluateWinners(players: PlayerState[], communityCards: Card[]): { indices: number[], handName: string } {
        // 1. Filter out players who have folded
        const activePlayers = players.filter(p => !p.hasFolded);

        if (activePlayers.length === 0) return { indices: [], handName: '' };
        if (activePlayers.length === 1) return { indices: [activePlayers[0].position], handName: 'Last Man Standing' };

        // 2. Format community cards
        const formattedCommunity = this.formatCardsForSolver(communityCards);

        // 3. Solve each player's hand
        const solvedHands = activePlayers.map(p => {
            const playerHand = this.formatCardsForSolver(p.hand);
            // Combine hole cards + community cards
            const solved = Hand.solve([...playerHand, ...formattedCommunity]);

            // Attach the player's position index to the solved hand object 
            // so we can identify them after the solver ranks them.
            solved.playerIndex = p.position;
            return solved;
        });

        // 4. Use pokersolver to determine the winning hand(s)
        const winningHands = Hand.winners(solvedHands);

        // 5. Extract the playerIndex we attached earlier
        const indices = winningHands.map((w: any) => w.playerIndex);

        return {
            indices: indices,
            handName: winningHands[0]?.descr || 'High Card' // descr gives e.g. 'Full House', 'Two Pair'
        };
    },

    /**
     * Optional: Returns the name of the hand (e.g., "Full House", "Flush")
     * Useful for broadcasting the winning reason to the frontend.
     */
    getHandDescription(playerHand: Card[], communityCards: Card[]): string {
        const fullHand = this.formatCardsForSolver([...playerHand, ...communityCards]);
        const solved = Hand.solve(fullHand);
        return solved.descr;
    },
    getHandStrength(holeCards: Card[], communityCards: Card[]): string {
        const combined = this.formatCardsForSolver([...holeCards, ...communityCards]);
        const solved = Hand.solve(combined);
        return solved.descr; // Returns string like "Full House, Kings over 8s"
    }

};