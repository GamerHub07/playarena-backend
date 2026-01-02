/**
 * Snake & Ladder Game Engine
 * 
 * ⚠️ NOT PRODUCTION READY ⚠️
 * This game is not yet exposed via socket handlers.
 * Proof of architecture extensibility only.
 * 
 * Implements GameEngine contract for seamless integration
 * with GameStore and future game routing.
 */

import { GameEngine } from '../base/GameEngine';
import {
    SnakeLadderGameState,
    SnakeLadderPlayerState,
    SnakeLadderMove,
    SNAKES,
    LADDERS,
    BOARD_SIZE,
    MIN_PLAYERS,
    MAX_PLAYERS,
    PLAYER_COLORS,
} from './SnakeLadderTypes';

export class SnakeLadderEngine extends GameEngine<SnakeLadderGameState> {

    getGameType(): string {
        return 'snake-ladder';
    }

    getMinPlayers(): number {
        return MIN_PLAYERS;
    }

    getMaxPlayers(): number {
        return MAX_PLAYERS;
    }

    getInitialState(): SnakeLadderGameState {
        return {
            players: {},
            currentPlayer: 0,
            diceValue: null,
            lastRoll: null,
            turnPhase: 'roll',
            winner: null,
            moveHistory: [],
        };
    }

    /**
     * Initialize game with joined players
     */
    initializeGame(): void {
        this.players.forEach((player, index) => {
            this.state.players[index] = {
                position: 0,  // Start off the board
                color: PLAYER_COLORS[index] || '#888888',
            };
        });
        this.state.currentPlayer = 0;
        this.state.turnPhase = 'roll';
    }

    handleAction(playerId: string, action: string, payload: unknown): SnakeLadderGameState {
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
            default:
                throw new Error('Unknown action');
        }

        return this.state;
    }

    private rollDice(playerIndex: number): SnakeLadderGameState {
        if (this.state.turnPhase !== 'roll') {
            throw new Error('Cannot roll now');
        }

        const diceValue = Math.floor(Math.random() * 6) + 1;
        this.state.diceValue = diceValue;
        this.state.lastRoll = diceValue;

        const playerState = this.state.players[playerIndex];
        const currentPos = playerState.position;
        let newPos = currentPos + diceValue;

        // Must land exactly on 100 to win
        if (newPos > BOARD_SIZE) {
            // Bounce back
            newPos = BOARD_SIZE - (newPos - BOARD_SIZE);
        }

        // Check for snakes
        let usedSnake = false;
        if (SNAKES[newPos]) {
            newPos = SNAKES[newPos];
            usedSnake = true;
        }

        // Check for ladders
        let usedLadder = false;
        if (LADDERS[newPos]) {
            newPos = LADDERS[newPos];
            usedLadder = true;
        }

        // Record move
        const move: SnakeLadderMove = {
            player: playerIndex,
            from: currentPos,
            to: newPos,
            diceValue,
            usedSnake,
            usedLadder,
            timestamp: Date.now(),
        };
        this.state.moveHistory.push(move);

        // Update position
        playerState.position = newPos;

        // Check for winner
        if (newPos === BOARD_SIZE) {
            this.state.winner = playerIndex;
            this.state.turnPhase = 'wait';
            return this.state;
        }

        // Next turn (6 gives extra turn in some variants, but keeping simple)
        this.nextTurn();

        return this.state;
    }

    private nextTurn(): void {
        this.state.currentPlayer = (this.state.currentPlayer + 1) % this.players.length;
        this.state.turnPhase = 'roll';
        this.state.diceValue = null;
    }

    isGameOver(): boolean {
        return this.state.winner !== null;
    }

    getWinner(): number | null {
        return this.state.winner;
    }

    /**
     * Get player position on board
     */
    getPlayerPosition(playerIndex: number): number {
        return this.state.players[playerIndex]?.position ?? 0;
    }

    /**
     * Check if a position has a snake
     */
    hasSnake(position: number): boolean {
        return position in SNAKES;
    }

    /**
     * Check if a position has a ladder
     */
    hasLadder(position: number): boolean {
        return position in LADDERS;
    }
}
