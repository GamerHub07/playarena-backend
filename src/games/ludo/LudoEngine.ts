import { GameEngine, GamePlayer } from '../base/GameEngine';
import {
    LudoGameState,
    PlayerState,
    TokenPosition,
    DiceRollResult,
    PLAYER_COLORS,
    PLAYER_START_POSITIONS,
    SAFE_POSITIONS,
    PATH_LENGTH,
    HOME_STRETCH_LENGTH,
    PlayerColor,
    HOME_ENTRY_POSITIONS,
} from './LudoTypes';

export class LudoEngine extends GameEngine<LudoGameState> {

    getGameType(): string {
        return 'ludo';
    }

    getMinPlayers(): number {
        return 2;
    }

    getMaxPlayers(): number {
        return 4;
    }

    getInitialState(): LudoGameState {
        return {
            players: {},
            currentPlayer: 0,
            diceValue: null,
            lastRoll: null,
            canRollAgain: false,
            turnPhase: 'roll',
            winner: null,
            finishedPlayers: [],
            eliminatedPlayers: [],
            moveHistory: [],
        };
    }

    initializeGame(): void {
        // Initialize player states based on joined players
        this.players.forEach((player, index) => {
            const color = PLAYER_COLORS[index];
            this.state.players[index] = {
                color,
                tokens: Array(4).fill(null).map(() => ({ zone: 'home' as const, index: 0 })),
                finishedTokens: 0,
            };
        });
        this.state.currentPlayer = 0;
        this.state.turnPhase = 'roll';
        this.state.finishedPlayers = [];
        this.state.eliminatedPlayers = [];
        this.state.winner = null;
    }

    handleAction(playerId: string, action: string, payload: unknown): LudoGameState {
        const playerIndex = this.players.findIndex(p => p.sessionId === playerId);

        if (playerIndex === -1) {
            throw new Error('Player not found');
        }

        // Check if player has already finished
        if (action !== 'init' && this.state.players[playerIndex]?.rank) {
            throw new Error('You have already finished the game');
        }

        if (playerIndex !== this.state.currentPlayer && action !== 'init') {
            throw new Error('Not your turn');
        }

        switch (action) {
            case 'init':
                this.initializeGame();
                break;
            case 'roll':
                return this.rollDice(playerIndex);
            case 'move':
                return this.moveToken(playerIndex, payload as { tokenIndex: number });
            default:
                throw new Error('Unknown action');
        }

        return this.state;
    }

    private rollDice(playerIndex: number): LudoGameState {
        if (this.state.turnPhase !== 'roll') {
            throw new Error('Cannot roll now');
        }

        const diceValue = Math.floor(Math.random() * 6) + 1;
        this.state.diceValue = diceValue;
        this.state.lastRoll = diceValue;

        const movableTokens = this.getMovableTokens(playerIndex, diceValue);

        // Store movable tokens in state for frontend access
        this.state.movableTokens = movableTokens;

        if (movableTokens.length === 0) {
            // No moves available, pass turn
            if (diceValue !== 6) {
                this.nextTurn();
            } else {
                // Got 6 but no moves, still can roll again
                this.state.canRollAgain = true;
                this.state.turnPhase = 'roll';
            }
        } else {
            // Always let user choose which token to move
            this.state.turnPhase = 'move';
        }

        return this.state;
    }

    private getMovableTokens(playerIndex: number, diceValue: number): number[] {
        const playerState = this.state.players[playerIndex];
        const movable: number[] = [];

        playerState.tokens.forEach((token, index) => {
            if (token.zone === 'home') {
                // Can only leave home with a 6
                if (diceValue === 6) {
                    movable.push(index);
                }
            } else if (token.zone === 'path' || token.zone === 'safe') {
                // Check if move is valid
                if (this.isValidMove(playerIndex, index, diceValue)) {
                    movable.push(index);
                }
            }
            // Tokens in 'finish' zone cannot move
        });

        return movable;
    }

    private isValidMove(playerIndex: number, tokenIndex: number, diceValue: number): boolean {
        const playerState = this.state.players[playerIndex];
        const token = playerState.tokens[tokenIndex];
        const color = playerState.color;

        if (token.zone === 'finish') return false;
        if (token.zone === 'home') return diceValue === 6;

        const homeEntry = HOME_ENTRY_POSITIONS[color];
        const stepsToHome =
            (homeEntry - token.index + PATH_LENGTH) % PATH_LENGTH;

        if (token.zone === 'path') {
            // can move on path or enter home stretch
            return diceValue <= stepsToHome + HOME_STRETCH_LENGTH;
        }

        if (token.zone === 'safe') {
            // inside home stretch → exact roll only
            return token.index + diceValue < HOME_STRETCH_LENGTH;
        }

        return false;
    }

    private moveToken(
        playerIndex: number,
        payload: { tokenIndex: number }
    ): LudoGameState {
        const { tokenIndex } = payload;
        const playerState = this.state.players[playerIndex];
        const token = playerState.tokens[tokenIndex];
        const diceValue = this.state.diceValue!;
        const color = playerState.color;

        const fromPosition = { ...token };
        let captured = false;

        // 1️⃣ Move out of home
        if (token.zone === 'home') {
            if (diceValue !== 6) return this.state;

            token.zone = 'path';
            token.index = PLAYER_START_POSITIONS[color];
            captured = this.checkCapture(playerIndex, token.index);
        }

        // 2️⃣ Token on main path
        else if (token.zone === 'path') {
            const homeEntry = HOME_ENTRY_POSITIONS[color];
            const currentPos = token.index;

            const stepsToHome =
                (homeEntry - currentPos + PATH_LENGTH) % PATH_LENGTH;

            if (diceValue <= stepsToHome) {
                // stay on main path
                token.zone = 'path';
                token.index = (currentPos + diceValue) % PATH_LENGTH;
                captured = this.checkCapture(playerIndex, token.index);
            } else {
                // enter home stretch
                const homeSteps = diceValue - stepsToHome - 1;

                if (homeSteps < HOME_STRETCH_LENGTH - 1) {
                    token.zone = 'safe';
                    token.index = homeSteps;
                } else if (homeSteps === HOME_STRETCH_LENGTH - 1) {
                    token.zone = 'finish';
                    token.index = 0;
                    playerState.finishedTokens++;
                } else {
                    // overshoot = invalid
                    return this.state;
                }
            }
        }

        // 3️⃣ Token already in home stretch
        else if (token.zone === 'safe') {
            const newIndex = token.index + diceValue;

            if (newIndex < HOME_STRETCH_LENGTH - 1) {
                token.index = newIndex;
            } else if (newIndex === HOME_STRETCH_LENGTH - 1) {
                token.zone = 'finish';
                token.index = 0;
                playerState.finishedTokens++;
            } else {
                // overshoot
                return this.state;
            }
        }

        // 4️⃣ Record move
        this.state.moveHistory.push({
            player: playerIndex,
            tokenIndex,
            from: fromPosition,
            to: { ...token },
            captured,
            timestamp: Date.now(),
        });

        // 5️⃣ Check if player finished
        const finished = token.zone === 'finish' && fromPosition.zone !== 'finish';

        if (playerState.finishedTokens === 4) {
            // Player finished the game
            if (!this.state.finishedPlayers.includes(playerIndex)) {
                this.state.finishedPlayers.push(playerIndex);
                playerState.rank = this.state.finishedPlayers.length;

                // If this is the first winner, set the legacy winner field
                if (this.state.winner === null) {
                    this.state.winner = playerIndex;
                }
            }
        }

        // 6️⃣ Turn handling
        // If game is over completely
        if (this.isGameOver()) {
            this.state.turnPhase = 'wait';
            // If there's one player left who hasn't finished, they technically "lose" or are last.
            // But we don't strictly need to do anything here, the handler will end the game.
            return this.state;
        }

        // If this player finished just now, they don't get an extra turn, turn passes to next.
        // UNLESS, well, if they finish, they are done.

        if (playerState.finishedTokens === 4) {
            this.nextTurn();
        }
        // Grant extra turn if:
        // 1. Rolled a 6
        // 2. Captured an opponent
        // 3. Token reached finish (home) - BUT only if they haven't finished the whole game logic above
        else if (diceValue === 6 || captured || finished) {
            this.state.canRollAgain = true;
            this.state.turnPhase = 'roll';
        } else {
            this.nextTurn();
        }

        this.state.diceValue = null;
        return this.state;
    }


    private checkCapture(playerIndex: number, position: number): boolean {
        if (SAFE_POSITIONS.includes(position)) return false;

        let captured = false;
        Object.entries(this.state.players).forEach(([idx, player]) => {
            if (parseInt(idx) === playerIndex) return;

            // Find all tokens of this opponent at the current position
            const opponentTokensAtPos = player.tokens.filter(
                token => token.zone === 'path' && token.index === position
            );

            // If 2 or more tokens of same color, it's a safe block -> No capture
            if (opponentTokensAtPos.length >= 2) {
                return;
            }

            opponentTokensAtPos.forEach(token => {
                token.zone = 'home';
                token.index = 0;
                captured = true;
            });
        });

        return captured;
    }

    private nextTurn(): void {
        const totalPlayers = this.players.length;
        let nextPlayerIndex = (this.state.currentPlayer + 1) % totalPlayers;

        // Skip players who have finished or been eliminated
        // Safety check: if all players finished/eliminated, break (should be handled by isGameOver)
        let attempts = 0;
        while (
            (this.state.players[nextPlayerIndex]?.rank ||
                this.state.eliminatedPlayers.includes(nextPlayerIndex)) &&
            attempts < totalPlayers
        ) {
            nextPlayerIndex = (nextPlayerIndex + 1) % totalPlayers;
            attempts++;
        }

        if (attempts >= totalPlayers) {
            // Everyone finished or eliminated?
            this.state.turnPhase = 'wait';
            return;
        }

        this.state.currentPlayer = nextPlayerIndex;
        this.state.turnPhase = 'roll';
        this.state.canRollAgain = false;
        this.state.diceValue = null;
    }

    isGameOver(): boolean {
        const totalPlayers = this.players.length;
        const eliminatedCount = this.state.eliminatedPlayers.length;
        const finishedCount = this.state.finishedPlayers.length;
        const activePlayers = totalPlayers - eliminatedCount - finishedCount;

        // Game ends when:
        // 1. Only one active player remains (everyone else finished or eliminated)
        // 2. All players finished (in case of 1 player testing mode)
        if (totalPlayers === 1) {
            return finishedCount === 1 || eliminatedCount === 1;
        }

        // Game ends when only 1 active player remains
        return activePlayers <= 1;
    }

    getWinner(): number | null {
        return this.state.winner;
    }

    /**
     * Eliminate a player from the game (after max auto-plays exceeded)
     * The player's tokens remain where they are, but they no longer get turns
     */
    eliminatePlayer(playerIndex: number): void {
        if (this.state.eliminatedPlayers.includes(playerIndex)) {
            return; // Already eliminated
        }

        if (this.state.players[playerIndex]?.rank) {
            return; // Already finished
        }

        this.state.eliminatedPlayers.push(playerIndex);
        console.log(`🚫 Player ${playerIndex} has been eliminated from the game`);

        // If it was this player's turn, move to next player
        if (this.state.currentPlayer === playerIndex) {
            this.nextTurn();
        }
    }

    /**
     * Auto-play for a disconnected player
     * This is called when a player's turn times out due to disconnection
     * It will automatically roll the dice and make a move (or pass if no moves available)
     */
    autoPlay(playerIndex: number): LudoGameState {
        // Check if it's actually this player's turn
        if (this.state.currentPlayer !== playerIndex) {
            return this.state;
        }

        // Check if player has already finished
        if (this.state.players[playerIndex]?.rank) {
            return this.state;
        }

        // If in roll phase, auto-roll
        if (this.state.turnPhase === 'roll') {
            this.rollDice(playerIndex);
        }

        // If now in move phase, make a random valid move
        if (this.state.turnPhase === 'move' && this.state.movableTokens && this.state.movableTokens.length > 0) {
            // Pick a random movable token (simple AI)
            // Priority: prefer tokens that can reach finish, then tokens on path, then tokens in home
            const playerState = this.state.players[playerIndex];
            const movableTokens = this.state.movableTokens;

            // Simple strategy: pick the first movable token
            // Could be enhanced to pick more strategically
            const tokenToMove = movableTokens[0];

            this.moveToken(playerIndex, { tokenIndex: tokenToMove });
        }

        // If still this player's turn (got a 6, captured, etc.) and can roll again, 
        // continue auto-playing until turn passes
        let safetyCounter = 0;
        const maxIterations = 10; // Prevent infinite loops

        while (
            this.state.currentPlayer === playerIndex &&
            !this.state.players[playerIndex]?.rank &&
            !this.isGameOver() &&
            safetyCounter < maxIterations
        ) {
            safetyCounter++;

            if (this.state.turnPhase === 'roll') {
                this.rollDice(playerIndex);
            }

            if (this.state.turnPhase === 'move' && this.state.movableTokens && this.state.movableTokens.length > 0) {
                const tokenToMove = this.state.movableTokens[0];
                this.moveToken(playerIndex, { tokenIndex: tokenToMove });
            } else if (this.state.turnPhase === 'move') {
                // No movable tokens, this shouldn't happen but break to be safe
                break;
            }
        }

        return this.state;
    }

    getDiceResult(): DiceRollResult | null {
        if (this.state.diceValue === null) return null;

        const movableTokens = this.getMovableTokens(
            this.state.currentPlayer,
            this.state.diceValue
        );

        return {
            value: this.state.diceValue,
            canMove: movableTokens.length > 0,
            movableTokens,
        };
    }
    getCurrentPlayerIndex(): number {
        return this.state.currentPlayer;
    }
}
