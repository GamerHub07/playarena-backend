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
            // Always let user choose which token to move (removed auto-move)
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

        // 5️⃣ Win check
        if (playerState.finishedTokens === 4) {
            this.state.winner = playerIndex;
            this.state.turnPhase = 'wait';
            return this.state;
        }

        // 6️⃣ Turn handling
        // Grant extra turn if:
        // 1. Rolled a 6
        // 2. Captured an opponent
        // 3. Token reached finish (home)
        const finished = token.zone === 'finish' && fromPosition.zone !== 'finish';

        if (diceValue === 6 || captured || finished) {
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
