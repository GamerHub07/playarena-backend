/**
 * Poker Game Engine
 * 
 * Texas Hold'em No-Limit Poker implementation.
 * Handles full game logic including:
 * - Dealing cards
 * - Betting rounds (preflop, flop, turn, river)
 * - Hand evaluation using pokersolver
 * - Winner determination and pot distribution
 */

import { GameEngine, GamePlayer, ReconnectionState } from '../base/GameEngine';
import { Hand } from 'pokersolver';
import {
    PokerGameState,
    PokerPlayerState,
    PokerActionPayload,
    Card,
    SidePot,
    WinnerInfo,
    BettingPhase,
    PlayerAction,
    MIN_PLAYERS,
    MAX_PLAYERS,
    STARTING_CHIPS,
    DEFAULT_SMALL_BLIND,
    DEFAULT_BIG_BLIND,
    createDeck,
    shuffleDeck,
    cardToSolverFormat,
    getNextActivePlayerIndex,
    getActivePlayers,
    getPlayersInHand,
} from './PokerTypes';

export class PokerEngine extends GameEngine<PokerGameState> {

    getGameType(): string {
        return 'poker';
    }

    getMinPlayers(): number {
        return MIN_PLAYERS;
    }

    getMaxPlayers(): number {
        return MAX_PLAYERS;
    }

    getInitialState(): PokerGameState {
        return {
            players: {},
            communityCards: [],
            deck: [],
            pot: 0,
            sidePots: [],
            currentBet: 0,
            minRaise: DEFAULT_BIG_BLIND,
            smallBlind: DEFAULT_SMALL_BLIND,
            bigBlind: DEFAULT_BIG_BLIND,
            currentPlayerIndex: -1,
            dealerIndex: 0,
            lastRaiserIndex: -1,
            phase: 'waiting',
            handNumber: 0,
            winners: null,
            gameWinner: null,
            isGameOver: false,
        };
    }

    /**
     * Initialize the game with joined players
     */
    initializeGame(): void {
        // Create player states for all joined players
        this.players.forEach((player, index) => {
            this.state.players[player.position] = {
                sessionId: player.sessionId,
                username: player.username,
                position: player.position,
                hand: [],
                chips: STARTING_CHIPS,
                currentBet: 0,
                totalBetThisHand: 0,
                folded: false,
                allIn: false,
                isDealer: false,
                isSmallBlind: false,
                isBigBlind: false,
                hasActed: false,
                isActive: true,
            };
        });

        // Set first dealer randomly
        const positions = Object.keys(this.state.players).map(Number);
        this.state.dealerIndex = positions[Math.floor(Math.random() * positions.length)];

        // Start first hand
        this.startNewHand();
    }

    handleAction(playerId: string, action: string, payload: unknown): PokerGameState {
        // Handle init action before player validation (players don't exist yet)
        if (action === 'init') {
            this.initializeGame();
            return this.state;
        }

        const playerIndex = this.getPlayerIndexBySessionId(playerId);

        if (playerIndex === -1) {
            throw new Error('Player not found');
        }

        // Game already over
        if (this.state.isGameOver) {
            throw new Error('Game is already over');
        }

        const actionPayload = payload as PokerActionPayload;

        switch (actionPayload.action) {
            case 'start_hand':
                // Host can trigger new hand after showdown
                if (this.state.phase === 'showdown' || this.state.phase === 'ended') {
                    this.startNewHand();
                }
                return this.state;

            case 'fold':
                return this.handleFold(playerIndex);

            case 'check':
                return this.handleCheck(playerIndex);

            case 'call':
                return this.handleCall(playerIndex);

            case 'raise':
                return this.handleRaise(playerIndex, actionPayload.amount || 0);

            case 'all-in':
                return this.handleAllIn(playerIndex);

            default:
                throw new Error(`Unknown action: ${actionPayload.action}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // HAND MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    private startNewHand(): void {
        // Check if only one player has chips (game over)
        const playersWithChips = Object.values(this.state.players).filter(p => p.chips > 0);
        if (playersWithChips.length === 1) {
            this.state.gameWinner = playersWithChips[0].position;
            this.state.isGameOver = true;
            this.state.phase = 'ended';
            return;
        }

        // Reset for new hand
        this.state.handNumber++;
        this.state.communityCards = [];
        this.state.pot = 0;
        this.state.sidePots = [];
        this.state.currentBet = 0;
        this.state.minRaise = this.state.bigBlind;
        this.state.winners = null;

        // Move dealer button
        this.state.dealerIndex = this.getNextActivePosition(this.state.dealerIndex);

        // Reset player states
        Object.values(this.state.players).forEach(player => {
            player.hand = [];
            player.currentBet = 0;
            player.totalBetThisHand = 0;
            player.folded = player.chips <= 0;
            player.allIn = false;
            player.isDealer = false;
            player.isSmallBlind = false;
            player.isBigBlind = false;
            player.hasActed = false;
            player.isActive = player.chips > 0;
            player.lastAction = undefined;
        });

        // Assign positions
        const activePositions = Object.values(this.state.players)
            .filter(p => p.isActive)
            .map(p => p.position)
            .sort((a, b) => a - b);

        if (activePositions.length < 2) {
            this.state.isGameOver = true;
            this.state.phase = 'ended';
            return;
        }

        // Set dealer
        this.state.players[this.state.dealerIndex].isDealer = true;

        // Set blinds (handle 2-player and 3+ player cases)
        const smallBlindPos = this.getNextActivePosition(this.state.dealerIndex);
        const bigBlindPos = this.getNextActivePosition(smallBlindPos);

        this.state.players[smallBlindPos].isSmallBlind = true;
        this.state.players[bigBlindPos].isBigBlind = true;

        // Post blinds
        this.postBlind(smallBlindPos, this.state.smallBlind);
        this.postBlind(bigBlindPos, this.state.bigBlind);

        this.state.currentBet = this.state.bigBlind;
        this.state.lastRaiserIndex = bigBlindPos;

        // Create and shuffle deck
        this.state.deck = shuffleDeck(createDeck());

        // Deal 2 cards to each active player
        Object.values(this.state.players).forEach(player => {
            if (player.isActive) {
                player.hand = [this.state.deck.pop()!, this.state.deck.pop()!];
            }
        });

        // Set first player to act (left of big blind)
        this.state.currentPlayerIndex = this.getNextActivePosition(bigBlindPos);
        this.state.phase = 'preflop';
    }

    private postBlind(position: number, amount: number): void {
        const player = this.state.players[position];
        const actualAmount = Math.min(amount, player.chips);

        player.chips -= actualAmount;
        player.currentBet = actualAmount;
        player.totalBetThisHand = actualAmount;
        this.state.pot += actualAmount;

        if (player.chips === 0) {
            player.allIn = true;
        }
    }

    private getNextActivePosition(currentPosition: number): number {
        const positions = Object.values(this.state.players)
            .filter(p => p.isActive && !p.folded)
            .map(p => p.position)
            .sort((a, b) => a - b);

        if (positions.length === 0) return currentPosition;

        const currentIdx = positions.indexOf(currentPosition);
        if (currentIdx === -1) {
            // Current position not in list, find next higher or wrap
            for (const pos of positions) {
                if (pos > currentPosition) return pos;
            }
            return positions[0];
        }

        return positions[(currentIdx + 1) % positions.length];
    }

    private getPlayerIndexBySessionId(sessionId: string): number {
        const player = Object.values(this.state.players).find(p => p.sessionId === sessionId);
        return player ? player.position : -1;
    }

    // ═══════════════════════════════════════════════════════════════
    // PLAYER ACTIONS
    // ═══════════════════════════════════════════════════════════════

    private validateTurn(playerIndex: number): void {
        if (this.state.phase === 'waiting' || this.state.phase === 'showdown' || this.state.phase === 'ended') {
            throw new Error('Cannot act during this phase');
        }

        if (playerIndex !== this.state.currentPlayerIndex) {
            throw new Error('Not your turn');
        }

        const player = this.state.players[playerIndex];
        if (!player || player.folded || player.allIn) {
            throw new Error('Cannot act');
        }
    }

    private handleFold(playerIndex: number): PokerGameState {
        this.validateTurn(playerIndex);

        const player = this.state.players[playerIndex];
        player.folded = true;
        player.lastAction = 'fold';
        player.hasActed = true;

        this.advanceGame();
        return this.state;
    }

    private handleCheck(playerIndex: number): PokerGameState {
        this.validateTurn(playerIndex);

        const player = this.state.players[playerIndex];

        // Can only check if no bet to match or already matched
        if (player.currentBet < this.state.currentBet) {
            throw new Error('Cannot check - must call or fold');
        }

        player.lastAction = 'check';
        player.hasActed = true;

        this.advanceGame();
        return this.state;
    }

    private handleCall(playerIndex: number): PokerGameState {
        this.validateTurn(playerIndex);

        const player = this.state.players[playerIndex];
        const toCall = this.state.currentBet - player.currentBet;

        if (toCall <= 0) {
            throw new Error('Nothing to call');
        }

        const actualAmount = Math.min(toCall, player.chips);
        player.chips -= actualAmount;
        player.currentBet += actualAmount;
        player.totalBetThisHand += actualAmount;
        this.state.pot += actualAmount;

        if (player.chips === 0) {
            player.allIn = true;
            player.lastAction = 'all-in';
        } else {
            player.lastAction = 'call';
        }
        player.hasActed = true;

        this.advanceGame();
        return this.state;
    }

    private handleRaise(playerIndex: number, amount: number): PokerGameState {
        this.validateTurn(playerIndex);

        const player = this.state.players[playerIndex];
        const toCall = this.state.currentBet - player.currentBet;
        const totalNeeded = toCall + amount;

        if (amount < this.state.minRaise && player.chips > totalNeeded) {
            throw new Error(`Raise must be at least ${this.state.minRaise}`);
        }

        if (totalNeeded > player.chips) {
            throw new Error('Not enough chips');
        }

        player.chips -= totalNeeded;
        player.currentBet += totalNeeded;
        player.totalBetThisHand += totalNeeded;
        this.state.pot += totalNeeded;

        this.state.currentBet = player.currentBet;
        this.state.minRaise = amount;
        this.state.lastRaiserIndex = playerIndex;

        // Reset hasActed for other players since there's a new bet
        Object.values(this.state.players).forEach(p => {
            if (p.position !== playerIndex && !p.folded && !p.allIn) {
                p.hasActed = false;
            }
        });

        if (player.chips === 0) {
            player.allIn = true;
            player.lastAction = 'all-in';
        } else {
            player.lastAction = 'raise';
        }
        player.hasActed = true;

        this.advanceGame();
        return this.state;
    }

    private handleAllIn(playerIndex: number): PokerGameState {
        this.validateTurn(playerIndex);

        const player = this.state.players[playerIndex];
        const allInAmount = player.chips;
        const newTotal = player.currentBet + allInAmount;

        player.chips = 0;
        player.currentBet = newTotal;
        player.totalBetThisHand += allInAmount;
        this.state.pot += allInAmount;
        player.allIn = true;
        player.lastAction = 'all-in';
        player.hasActed = true;

        // If this is a raise, update state
        if (newTotal > this.state.currentBet) {
            const raiseAmount = newTotal - this.state.currentBet;
            this.state.currentBet = newTotal;
            this.state.minRaise = Math.max(this.state.minRaise, raiseAmount);
            this.state.lastRaiserIndex = playerIndex;

            // Reset hasActed for other players
            Object.values(this.state.players).forEach(p => {
                if (p.position !== playerIndex && !p.folded && !p.allIn) {
                    p.hasActed = false;
                }
            });
        }

        this.advanceGame();
        return this.state;
    }

    // ═══════════════════════════════════════════════════════════════
    // GAME PROGRESSION
    // ═══════════════════════════════════════════════════════════════

    private advanceGame(): void {
        // Check if only one player remains
        const playersInHand = getPlayersInHand(this.state);
        if (playersInHand.length === 1) {
            this.awardPotToLastPlayer(playersInHand[0]);
            return;
        }

        // Check if betting round is complete
        if (this.isBettingRoundComplete()) {
            this.advancePhase();
        } else {
            // Move to next player
            this.state.currentPlayerIndex = this.getNextPlayerToAct();
        }
    }

    private isBettingRoundComplete(): boolean {
        const activePlayers = Object.values(this.state.players)
            .filter(p => !p.folded && p.isActive && !p.allIn);

        // If no active players (all folded or all-in), round is complete
        if (activePlayers.length === 0) {
            return true;
        }

        // Check if all active players have acted and matched the bet
        return activePlayers.every(p =>
            p.hasActed && p.currentBet === this.state.currentBet
        );
    }

    private getNextPlayerToAct(): number {
        const positions = Object.values(this.state.players)
            .filter(p => !p.folded && p.isActive && !p.allIn)
            .map(p => p.position)
            .sort((a, b) => a - b);

        if (positions.length === 0) return -1;

        let nextPos = this.state.currentPlayerIndex;
        for (let i = 0; i < positions.length; i++) {
            nextPos = this.getNextActivePosition(nextPos);
            const player = this.state.players[nextPos];
            if (!player.hasActed || player.currentBet < this.state.currentBet) {
                return nextPos;
            }
        }

        return positions[0];
    }

    private advancePhase(): void {
        // Reset betting state for new round
        Object.values(this.state.players).forEach(p => {
            p.currentBet = 0;
            p.hasActed = false;
        });
        this.state.currentBet = 0;
        this.state.minRaise = this.state.bigBlind;
        this.state.lastRaiserIndex = -1;

        switch (this.state.phase) {
            case 'preflop':
                this.dealFlop();
                break;
            case 'flop':
                this.dealTurn();
                break;
            case 'turn':
                this.dealRiver();
                break;
            case 'river':
                this.goToShowdown();
                break;
        }
    }

    private dealFlop(): void {
        // Burn one card, deal three
        this.state.deck.pop();
        this.state.communityCards.push(
            this.state.deck.pop()!,
            this.state.deck.pop()!,
            this.state.deck.pop()!
        );
        this.state.phase = 'flop';
        this.setFirstToAct();
    }

    private dealTurn(): void {
        // Burn one card, deal one
        this.state.deck.pop();
        this.state.communityCards.push(this.state.deck.pop()!);
        this.state.phase = 'turn';
        this.setFirstToAct();
    }

    private dealRiver(): void {
        // Burn one card, deal one
        this.state.deck.pop();
        this.state.communityCards.push(this.state.deck.pop()!);
        this.state.phase = 'river';
        this.setFirstToAct();
    }

    private setFirstToAct(): void {
        // First to act is left of dealer (or first active player after dealer)
        const activePlayers = Object.values(this.state.players)
            .filter(p => !p.folded && p.isActive && !p.allIn);

        if (activePlayers.length === 0) {
            // All players are either folded or all-in, go to showdown
            this.goToShowdown();
            return;
        }

        this.state.currentPlayerIndex = this.getNextActivePosition(this.state.dealerIndex);
    }

    // ═══════════════════════════════════════════════════════════════
    // SHOWDOWN AND WINNER DETERMINATION
    // ═══════════════════════════════════════════════════════════════

    private awardPotToLastPlayer(playerIndex: number): void {
        const player = this.state.players[playerIndex];
        player.chips += this.state.pot;

        this.state.winners = [{
            playerIndex,
            amount: this.state.pot,
            handName: 'Last Player Standing',
            handCards: [],
        }];

        this.state.pot = 0;
        this.state.phase = 'showdown';
    }

    private goToShowdown(): void {
        this.state.phase = 'showdown';

        // Get all players still in the hand
        const playersInHand = Object.values(this.state.players)
            .filter(p => !p.folded && p.isActive);

        if (playersInHand.length === 1) {
            this.awardPotToLastPlayer(playersInHand[0].position);
            return;
        }

        // Evaluate all hands
        const evaluatedHands: { playerIndex: number; hand: any; player: PokerPlayerState }[] = [];

        for (const player of playersInHand) {
            const allCards = [...player.hand, ...this.state.communityCards]
                .map(c => cardToSolverFormat(c));

            const hand = Hand.solve(allCards);
            evaluatedHands.push({
                playerIndex: player.position,
                hand,
                player,
            });
        }

        // Find winner(s)
        const hands = evaluatedHands.map(e => e.hand);
        const winningHands = Hand.winners(hands);

        // Distribute pot to winner(s)
        const winners: WinnerInfo[] = [];
        const winningPlayers = evaluatedHands.filter(e => winningHands.includes(e.hand));
        const splitAmount = Math.floor(this.state.pot / winningPlayers.length);
        const remainder = this.state.pot % winningPlayers.length;

        winningPlayers.forEach((winner, index) => {
            const amount = splitAmount + (index === 0 ? remainder : 0);
            winner.player.chips += amount;

            winners.push({
                playerIndex: winner.playerIndex,
                amount,
                handName: winner.hand.name,
                handCards: winner.player.hand,
            });
        });

        this.state.winners = winners;
        this.state.pot = 0;

        // Check for overall game winner (one player with all chips)
        const playersWithChips = Object.values(this.state.players).filter(p => p.chips > 0);
        if (playersWithChips.length === 1) {
            this.state.gameWinner = playersWithChips[0].position;
            this.state.isGameOver = true;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GAME STATUS METHODS
    // ═══════════════════════════════════════════════════════════════

    isGameOver(): boolean {
        return this.state.isGameOver;
    }

    getWinner(): number | null {
        return this.state.gameWinner;
    }

    /**
     * Auto-play for a disconnected player (auto-fold)
     * Used by turnTimer when a player times out
     */
    autoPlay(playerIndex: number): PokerGameState {
        const player = this.state.players[playerIndex];

        if (!player || player.folded || player.allIn) {
            // Player can't act, just advance
            this.advanceGame();
            return this.state;
        }

        // Auto-fold for the player (bypass turn validation)
        player.folded = true;
        player.lastAction = 'fold';
        player.hasActed = true;

        this.advanceGame();
        return this.state;
    }

    /**
     * Eliminate a player from the game
     * Used by turnTimer when a player has timed out too many times
     */
    eliminatePlayer(playerIndex: number): void {
        const player = this.state.players[playerIndex];

        if (!player) return;

        // Mark player as eliminated
        player.folded = true;
        player.isActive = false;
        player.chips = 0;
        player.lastAction = 'eliminated';

        // Check if only one player remains with chips
        const playersWithChips = Object.values(this.state.players).filter(p => p.chips > 0 && p.isActive);
        if (playersWithChips.length === 1) {
            this.state.gameWinner = playersWithChips[0].position;
            this.state.isGameOver = true;
            this.state.phase = 'ended';
        } else if (playersWithChips.length === 0) {
            this.state.isGameOver = true;
            this.state.phase = 'ended';
        } else {
            // Advance the game if it was this player's turn
            if (this.state.currentPlayerIndex === playerIndex) {
                this.advanceGame();
            }
        }
    }

    /**
     * Override: Get poker-specific state for a player
     * Returns masked state (hiding opponent cards) and available actions
     */
    override getStateForPlayer(sessionId: string): ReconnectionState<PokerGameState> {
        const maskedState = this.getMaskedStateForPlayer(sessionId);
        const player = Object.values(this.state.players).find(p => p.sessionId === sessionId);
        const availableActions = player ? this.getAvailableActions(player.position) : [];

        return {
            state: maskedState,
            availableActions,
        };
    }

    /**
     * Get state with hands masked for a specific player
     */
    getMaskedStateForPlayer(sessionId: string): PokerGameState {
        const maskedState = JSON.parse(JSON.stringify(this.state)) as PokerGameState;

        // Only show player's own cards (unless showdown)
        if (maskedState.phase !== 'showdown') {
            Object.values(maskedState.players).forEach(player => {
                if (player.sessionId !== sessionId) {
                    player.hand = [];
                }
            });
        }

        // Never expose the deck
        maskedState.deck = [];

        return maskedState;
    }

    /**
     * Get available actions for current player
     */
    getAvailableActions(playerIndex: number): PlayerAction[] {
        if (playerIndex !== this.state.currentPlayerIndex) {
            return [];
        }

        const player = this.state.players[playerIndex];
        if (!player || player.folded || player.allIn) {
            return [];
        }

        const actions: PlayerAction[] = ['fold'];
        const toCall = this.state.currentBet - player.currentBet;

        if (toCall === 0) {
            actions.push('check');
        } else {
            actions.push('call');
        }

        if (player.chips > toCall) {
            actions.push('raise');
        }

        actions.push('all-in');

        return actions;
    }
}
