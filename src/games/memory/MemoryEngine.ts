import { GameEngine } from '../base/GameEngine';
import { MemoryState, MemoryCard, MemoryMovePayload } from './types';

const EMOJIS = ['🍎', '🍌', '🍒', '🍇', '🍉', '🍓', '🍑', '🍍'];

export class MemoryEngine extends GameEngine<MemoryState> {
    constructor(roomCode: string) {
        super(roomCode);
    }

    getGameType(): string {
        return 'memory';
    }

    getMinPlayers(): number {
        return 1;
    }

    getMaxPlayers(): number {
        return 1; // Single player for now, could be 2 later
    }

    getInitialState(): MemoryState {
        return this.startNewGame();
    }

    isGameOver(): boolean {
        return this.state.isComplete;
    }

    getWinner(): number | null {
        return this.state.isComplete ? 0 : null;
    }

    getCurrentPlayerIndex(): number {
        return 0;
    }

    autoPlay(playerIndex: number): MemoryState {
        const availableCards = this.state.cards.filter(c => !c.isMatched && !c.isFlipped);
        if (availableCards.length > 0) {
            const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
            return this.flipCard(randomCard.id);
        }
        return this.state;
    }

    eliminatePlayer(playerIndex: number): void {
        if (playerIndex === 0) {
            this.state.isComplete = true;
        }
    }

    handleAction(playerId: string, action: string, payload: unknown): MemoryState {
        switch (action) {
            case 'flip':
                return this.flipCard((payload as MemoryMovePayload).cardId);
            case 'restart':
                return this.startNewGame();
            default:
                return this.state;
        }
    }

    private startNewGame(): MemoryState {
        const cards: MemoryCard[] = [];
        // Duplicate emojis to create pairs
        const items = [...EMOJIS, ...EMOJIS];

        // Fisher-Yates Shuffle
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }

        items.forEach((item, index) => {
            cards.push({
                id: `card-${index}`,
                content: item,
                isFlipped: false,
                isMatched: false
            });
        });

        this.state = {
            cards,
            moves: 0,
            matches: 0,
            isComplete: false,
            bestScore: this.state?.bestScore || 0
        };

        return this.state;
    }

    private flipCard(cardId: string): MemoryState {
        const cardIndex = this.state.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return this.state;

        const card = this.state.cards[cardIndex];

        // Ignore if already matched or flipped
        if (card.isMatched || card.isFlipped) return this.state;

        // Check currently flipped (but not matched) cards
        const flipped = this.state.cards.filter(c => c.isFlipped && !c.isMatched);

        if (flipped.length === 2) {
            // Third click: Reset the previous two mismatches
            flipped.forEach(c => c.isFlipped = false);
            // Flip the new one
            this.state.cards[cardIndex].isFlipped = true;
        } else if (flipped.length === 1) {
            // Second click: Flip and check match
            this.state.cards[cardIndex].isFlipped = true;
            this.state.moves++;

            const otherCard = flipped[0];
            if (otherCard.content === card.content) {
                // Match!
                otherCard.isMatched = true;
                this.state.cards[cardIndex].isMatched = true;
                this.state.matches++;

                // Check Win
                if (this.state.matches === EMOJIS.length) {
                    this.state.isComplete = true;
                    if (this.state.bestScore === 0 || this.state.moves < this.state.bestScore) {
                        this.state.bestScore = this.state.moves;
                    }
                }
            } else {
                // Mismatch. Leave them flipped so user can see them.
                // Next click will reset them.
            }
        } else {
            // First click
            this.state.cards[cardIndex].isFlipped = true;
        }

        this.updatedAt = Date.now();
        return this.state;
    }
}
