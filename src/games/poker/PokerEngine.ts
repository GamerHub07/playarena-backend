import { GameEngine } from '../GameEngine';
import { Card, PlayerState, PokerGameState, Suit, Rank } from './PokerTypes';
import { PokerUtils } from './PokerUtils';

export class PokerEngine implements GameEngine {
    private state: PokerGameState;
    private deck: Card[] = [];
    private players: PlayerState[] = [];
    private SMALL_BLIND = 10;
    private BIG_BLIND = 20;

    constructor() {
        this.state = {
            players: {},
            communityCards: [],
            pot: 0,
            currentBet: 0,
            dealerIndex: 0,
            currentPlayer: 0,
            gameId: '',
            status: 'waiting',
            currentPhase: 'wait',
            minBet: this.BIG_BLIND,
            smallBlind: this.SMALL_BLIND,
            bigBlind: this.BIG_BLIND,
            minRaise: this.BIG_BLIND,
            winner: null,
            winningHandDescription: ''
        };
    }

    init(gameId: string): void {
        this.state.gameId = gameId;
    }

    addPlayer(player: { sessionId: string; username: string; position: number }): void {
        const newPlayer: PlayerState = {
            sessionId: player.sessionId,
            username: player.username,
            chips: 1000,
            hand: [],
            currentBet: 0,
            hasFolded: false,
            isAllIn: false,
            position: player.position,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.username}`
        };
        this.players.push(newPlayer);
        this.state.players[player.position] = newPlayer;
    }

    removePlayer(sessionId: string): void {
        this.players = this.players.filter(p => p.sessionId !== sessionId);
        const key = Object.keys(this.state.players).find(k => this.state.players[Number(k)].sessionId === sessionId);
        if (key) delete this.state.players[Number(key)];
    }

    getMaxPlayers(): number {
        return 8;
    }

    getState(): PokerGameState {
        return this.state;
    }

    handleAction(sessionId: string, action: string, data?: any): PokerGameState {
        if (action === 'init') {
            this.startNewRound();
            return this.state;
        }

        const playerIndex = this.players.findIndex(p => p.sessionId === sessionId);
        if (playerIndex === -1 && action !== 'init') {
            // Player might be rejoining or socket mismatch?
            console.warn(`Player not found for session ${sessionId}`);
            return this.state;
        }

        // Logic for game actions
        switch (action) {
            case 'fold':
                this.state.players[playerIndex].hasFolded = true;
                this.checkRoundEnd();
                break;
            case 'call':
                // Match current bet
                const callAmount = this.state.currentBet - this.state.players[playerIndex].currentBet;
                this.executeBet(playerIndex, callAmount);
                this.moveToNextActivePlayer();
                this.checkRoundEnd();
                break;
            case 'check':
                if (this.state.players[playerIndex].currentBet < this.state.currentBet) {
                    throw new Error("Cannot check, need to call");
                }
                this.moveToNextActivePlayer();
                this.checkRoundEnd();
                break;
            case 'raise':
                const raiseAmount = data?.amount || (this.state.currentBet * 2);
                if (raiseAmount < this.state.minRaise) {
                    throw new Error(`Raise must be at least ${this.state.minRaise}`);
                }
                const diff = raiseAmount - this.state.players[playerIndex].currentBet;
                this.executeBet(playerIndex, diff);
                this.state.currentBet = raiseAmount;
                this.state.minRaise = raiseAmount * 2; // Simple raise logic

                // Reset other players to act? 
                // Simplified: Just move next. Real poker resets round actions for others.
                this.moveToNextActivePlayer();
                this.checkRoundEnd(); // Technically shouldn't end if raised
                break;
        }

        return this.state;
    }

    private startNewRound(): void {
        this.generateAndShuffleDeck();
        this.state.communityCards = [];
        this.state.pot = 0;
        this.state.currentBet = this.BIG_BLIND;
        this.state.winner = null;
        this.state.winningHandDescription = '';
        this.state.currentPhase = 'pre-flop';

        // Rotate dealer
        this.state.dealerIndex = (this.state.dealerIndex + 1) % this.players.length;

        // Reset players
        this.players.forEach(p => {
            p.hand = [this.deck.pop()!, this.deck.pop()!];
            p.currentBet = 0;
            p.hasFolded = false;
            p.isAllIn = false;
        });

        this.postBlinds();
    }

    private postBlinds(): void {
        const numPlayers = this.players.length;

        const getNextActive = (start: number): number => {
            let next = (start + 1) % numPlayers;
            let count = 0;
            while (this.state.players[next]?.chips === 0 && count < numPlayers) {
                next = (next + 1) % numPlayers;
                count++;
            }
            return next;
        };

        const sbIndex = getNextActive(this.state.dealerIndex);
        const bbIndex = getNextActive(sbIndex);

        this.executeBet(sbIndex, this.SMALL_BLIND);
        this.executeBet(bbIndex, this.BIG_BLIND);

        this.state.currentPlayer = getNextActive(bbIndex);
    }

    private executeBet(playerIndex: number, amount: number): void {
        const player = this.state.players[playerIndex];
        const actualBet = Math.min(player.chips, amount);

        player.chips -= actualBet;
        player.currentBet += actualBet;
        this.state.pot += actualBet;

        if (player.chips === 0) {
            player.isAllIn = true;
        }
    }

    private checkRoundEnd(): void {
        // Check if only 1 player left
        const active = this.players.filter(p => !p.hasFolded);
        if (active.length === 1) {
            this.handleShowdown(); // Or handleWin(active[0])
            return;
        }

        // Logic to check if all players have acted / matched bet
        // Simplified: Just checking if current player circled back to dealer or all acted
        // Real implementation needs 'lastRaiser' tracking.

        // FOR MPV: If we cycled through everyone without raises, go next phase
        // This is complex to track perfectly without detailed state.

        // HACK: Every 4 turns go next phase (Testing logic)
        // BETTER: Check if all active players matched the currentBet
        const allMatched = active.every(p => p.currentBet === this.state.currentBet || p.isAllIn);

        if (allMatched && this.state.currentPlayer === this.state.dealerIndex) {
            this.nextPhase();
        }
    }

    private nextPhase(): void {
        switch (this.state.currentPhase) {
            case 'pre-flop':
                this.state.currentPhase = 'flop';
                this.dealCommunity(3);
                break;
            case 'flop':
                this.state.currentPhase = 'turn';
                this.dealCommunity(1);
                break;
            case 'turn':
                this.state.currentPhase = 'river';
                this.dealCommunity(1);
                break;
            case 'river':
                this.handleShowdown();
                return;
        }

        // Reset bets for new phase
        this.state.currentBet = 0;
        this.players.forEach(p => {
            if (!p.hasFolded) {
                p.currentBet = 0;
            }
        });

        // Start from left of dealer
        let next = (this.state.dealerIndex + 1) % this.players.length;
        let attempts = 0;
        while (this.state.players[next].hasFolded && attempts < this.players.length) {
            this.state.currentPlayer = (this.state.currentPlayer + 1) % this.players.length;
            attempts++;
        }
    }

    private dealCommunity(count: number): void {
        for (let i = 0; i < count; i++) {
            const card = this.deck.pop();
            if (card) this.state.communityCards.push(card);
        }
    }

    private handleShowdown(): void {
        const result = PokerUtils.evaluateWinners(
            Object.values(this.state.players),
            this.state.communityCards
        );

        this.state.winner = result.indices;
        this.state.winningHandDescription = result.handName;
        this.state.currentPhase = 'showdown';

        if (result.indices.length > 0) {
            const share = Math.floor(this.state.pot / result.indices.length);
            result.indices.forEach(idx => {
                this.state.players[idx].chips += share;
            });
        }
    }

    private moveToNextActivePlayer(): void {
        let next = (this.state.currentPlayer + 1) % this.players.length;
        let attempts = 0;

        while (
            (this.state.players[next].hasFolded ||
                this.state.players[next].isAllIn ||
                this.state.players[next].chips === 0)
            && attempts < this.players.length
        ) {
            next = (next + 1) % this.players.length;
            attempts++;
        }
        this.state.currentPlayer = next;
    }

    private generateAndShuffleDeck(): void {
        const suits: Suit[] = ['H', 'D', 'C', 'S'];
        const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.deck = [];
        suits.forEach(s => ranks.forEach(r => this.deck.push({ suit: s, rank: r })));

        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    isGameOver(): boolean {
        return this.state.currentPhase === 'showdown' && (Object.values(this.state.players).filter(p => p.chips > 0).length <= 1);
    }

    getWinner(): number | null {
        if (this.isGameOver()) {
            const active = Object.values(this.state.players).filter(p => p.chips > 0);
            return active.length > 0 ? active[0].position : null;
        }
        return this.state.winner && this.state.winner.length > 0 ? this.state.winner[0] : null;
    }
}