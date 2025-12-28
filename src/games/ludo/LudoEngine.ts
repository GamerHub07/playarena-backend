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
} from './LudoTypes';

export class LudoEngine extends GameEngine<LudoGameState> {

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
    }

    handleAction(playerId: string, action: string, payload: unknown): LudoGameState {
        const playerIndex = this.players.findIndex(p => p.sessionId === playerId);

        if (playerIndex === -1) {
            throw new Error('Player not found');
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

        if (movableTokens.length === 0) {
            // No moves available, pass turn
            if (diceValue !== 6) {
                this.nextTurn();
            } else {
                // Got 6 but no moves, still can roll again
                this.state.canRollAgain = true;
                this.state.turnPhase = 'roll';
            }
        } else if (movableTokens.length === 1) {
            // Only one option, auto-move
            this.moveToken(playerIndex, { tokenIndex: movableTokens[0] });
        } else {
            // Multiple options, wait for player choice
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
        if (token.zone === 'home' && diceValue !== 6) return false;

        // Calculate new position
        const startPos = PLAYER_START_POSITIONS[color];
        const currentPos = token.index;
        const newPos = (currentPos + diceValue) % PATH_LENGTH;

        // Check if entering home stretch
        const distanceTraveled = (currentPos - startPos + PATH_LENGTH) % PATH_LENGTH;
        const newDistance = distanceTraveled + diceValue;

        if (newDistance >= PATH_LENGTH) {
            const homeStretchPos = newDistance - PATH_LENGTH;
            return homeStretchPos <= HOME_STRETCH_LENGTH;
        }

        return true;
    }

    private moveToken(playerIndex: number, payload: { tokenIndex: number }): LudoGameState {
        const { tokenIndex } = payload;
        const playerState = this.state.players[playerIndex];
        const token = playerState.tokens[tokenIndex];
        const diceValue = this.state.diceValue!;
        const color = playerState.color;

        const fromPosition = { ...token };
        let captured = false;

        if (token.zone === 'home' && diceValue === 6) {
            // Move out of home to start position
            token.zone = 'path';
            token.index = PLAYER_START_POSITIONS[color];
            captured = this.checkCapture(playerIndex, token.index);
        } else if (token.zone === 'path' || token.zone === 'safe') {
            const startPos = PLAYER_START_POSITIONS[color];
            const currentPos = token.index;
            const distanceTraveled = (currentPos - startPos + PATH_LENGTH) % PATH_LENGTH;
            const newDistance = distanceTraveled + diceValue;

            if (newDistance >= PATH_LENGTH) {
                // Entering home stretch
                const homeStretchPos = newDistance - PATH_LENGTH;
                if (homeStretchPos === HOME_STRETCH_LENGTH) {
                    token.zone = 'finish';
                    token.index = 0;
                    playerState.finishedTokens++;
                } else {
                    token.zone = 'safe';
                    token.index = homeStretchPos;
                }
            } else {
                // Normal move
                const newPos = (currentPos + diceValue) % PATH_LENGTH;
                token.zone = SAFE_POSITIONS.includes(newPos) ? 'safe' : 'path';
                token.index = newPos;
                captured = this.checkCapture(playerIndex, newPos);
            }
        }

        // Record move
        this.state.moveHistory.push({
            player: playerIndex,
            tokenIndex,
            from: fromPosition,
            to: { ...token },
            captured,
            timestamp: Date.now(),
        });

        // Check win condition
        if (playerState.finishedTokens === 4) {
            this.state.winner = playerIndex;
            this.state.turnPhase = 'wait';
            return this.state;
        }

        // Handle turn progression
        if (diceValue === 6 || captured) {
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

            player.tokens.forEach(token => {
                if (token.zone === 'path' && token.index === position) {
                    token.zone = 'home';
                    token.index = 0;
                    captured = true;
                }
            });
        });

        return captured;
    }

    private nextTurn(): void {
        this.state.currentPlayer = (this.state.currentPlayer + 1) % this.players.length;
        this.state.turnPhase = 'roll';
        this.state.canRollAgain = false;
        this.state.diceValue = null;
    }

    isGameOver(): boolean {
        return this.state.winner !== null;
    }

    getWinner(): number | null {
        return this.state.winner;
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
}
