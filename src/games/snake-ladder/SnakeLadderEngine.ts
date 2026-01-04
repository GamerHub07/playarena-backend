/**
 * Snake & Ladder Game Engine
 * 
 * Production-ready game engine with full game rules:
 * - Roll dice and move token
 * - Snakes slide tokens down
 * - Ladders climb tokens up
 * - Rolling 6 grants extra turn
 * - 3 consecutive 6s = skip turn
 * - Must land exactly on 100 to win (bounce back)
 * - Step-by-step animation support
 */

import { GameEngine } from '../base/GameEngine';
import {
    SnakeLadderGameState,
    SnakeLadderPlayerState,
    SnakeLadderMove,
    SnakeLadderMoveStep,
    DiceRollResult,
    SNAKES,
    LADDERS,
    BOARD_SIZE,
    MIN_PLAYERS,
    MAX_PLAYERS,
    MAX_CONSECUTIVE_SIXES,
    PLAYER_COLORS,
    positionToGrid,
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
            canRollAgain: false,
            consecutiveSixes: 0,
        };
    }

    /**
     * Initialize game with joined players
     * All players start at Position 1
     */
    initializeGame(): void {
        this.players.forEach((player, index) => {
            this.state.players[index] = {
                position: 1, // Start at 1 (standard board rule)
                color: PLAYER_COLORS[index] || '#888888',
            };
        });
        this.state.currentPlayer = 0;
        this.state.turnPhase = 'roll';
        this.state.canRollAgain = false;
        this.state.consecutiveSixes = 0;
        this.state.winner = null;
        this.state.moveHistory = [];
    }

    handleAction(playerId: string, action: string, payload: unknown): SnakeLadderGameState {
        const playerIndex = this.players.findIndex(p => p.sessionId === playerId);

        if (playerIndex === -1) {
            throw new Error('Player not found');
        }

        if (action === 'init') {
            const senderPlayer = this.players[playerIndex];
            // Ideally only host calls init, but simplified checks here
            this.initializeGame();
            return this.state;
        }

        if (this.state.winner !== null) {
            throw new Error('Game is over');
        }

        if (playerIndex !== this.state.currentPlayer) {
            throw new Error('Not your turn');
        }

        switch (action) {
            case 'roll':
                return this.rollDice(playerIndex);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE LOGIC
    // ═══════════════════════════════════════════════════════════════

    private rollDice(playerIndex: number): SnakeLadderGameState {
        if (this.state.turnPhase !== 'roll') {
            throw new Error('Cannot roll now (waiting phase)');
        }

        const diceValue = Math.floor(Math.random() * 6) + 1;
        this.state.diceValue = diceValue;
        this.state.lastRoll = diceValue;

        // 6 Handling
        if (diceValue === 6) {
            this.state.consecutiveSixes++;
            if (this.state.consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
                // Penalty: Skip turn immediately
                this.state.consecutiveSixes = 0;
                this.nextTurn();
                return this.state;
            }
            this.state.canRollAgain = true;
        } else {
            this.state.consecutiveSixes = 0;
            this.state.canRollAgain = false;
        }

        // Calculate Movement
        const player = this.state.players[playerIndex];
        const currentPos = player.position;
        let newPos = currentPos + diceValue;

        // Bounce Check
        if (newPos > BOARD_SIZE) {
            const overshoot = newPos - BOARD_SIZE;
            newPos = BOARD_SIZE - overshoot;
        }

        // Initialize Move Record
        const move: SnakeLadderMove = {
            player: playerIndex,
            from: currentPos,
            to: newPos, // Temporary, updates after snake/ladder checks
            diceValue,
            usedSnake: false,
            usedLadder: false,
            timestamp: Date.now(),
        };

        // Check Interactions (Snake -> Tail, Ladder -> Top)
        // Priority: In standard games, snakes/ladders don't chain (land on snake tail which is ladder bottom -> doesn't climb).
        // We check ONCE.

        if (SNAKES[newPos]) {
            move.usedSnake = true;
            move.snakeEnd = SNAKES[newPos];
            newPos = SNAKES[newPos];
        } else if (LADDERS[newPos]) {
            move.usedLadder = true;
            move.ladderEnd = LADDERS[newPos];
            newPos = LADDERS[newPos];
        }

        // Update Position
        move.to = newPos;
        this.state.players[playerIndex].position = newPos;
        this.state.moveHistory.push(move);

        // Win Condition
        if (newPos === BOARD_SIZE) {
            this.state.winner = playerIndex;
            this.state.turnPhase = 'wait';
            return this.state;
        }

        // Turn Management
        if (this.state.canRollAgain) {
            this.state.turnPhase = 'roll'; // Same player rolls again
        } else {
            this.nextTurn();
        }

        return this.state;
    }

    private nextTurn(): void {
        // Find next player
        this.state.currentPlayer = (this.state.currentPlayer + 1) % this.players.length;
        this.state.turnPhase = 'roll';
        this.state.canRollAgain = false;
        this.state.consecutiveSixes = 0;
        this.state.diceValue = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    isGameOver(): boolean {
        return this.state.winner !== null;
    }

    getWinner(): number | null {
        return this.state.winner;
    }

    getDiceResult(): DiceRollResult | null {
        if (this.state.diceValue === null) return null;
        return {
            value: this.state.diceValue,
            canMove: true,
            isExtraTurn: this.state.canRollAgain,
            skipTurn: this.state.consecutiveSixes >= MAX_CONSECUTIVE_SIXES,
        };
    }

    getPlayerPosition(playerIndex: number): number {
        return this.state.players[playerIndex]?.position ?? 1;
    }

    hasSnake(position: number): boolean {
        return position in SNAKES;
    }

    hasLadder(position: number): boolean {
        return position in LADDERS;
    }

    getLastMove(): SnakeLadderMove | null {
        const history = this.state.moveHistory;
        return history.length > 0 ? history[history.length - 1] : null;
    }

    generateMoveSteps(
        playerIndex: number,
        fromPos: number,
        toPos: number,
        diceValue: number,
        usedSnake: boolean,
        usedLadder: boolean,
        snakeEnd?: number,
        ladderEnd?: number
    ): SnakeLadderMoveStep[] {
        const steps: SnakeLadderMoveStep[] = [];
        let stepCount = 0;
        let p = fromPos;

        // 1. Dice Movement (1..diceValue)
        for (let i = 1; i <= diceValue; i++) {
            // Forward
            if (p < BOARD_SIZE && (diceValue <= (BOARD_SIZE - fromPos) || i <= (BOARD_SIZE - fromPos))) {
                p++;
            } else {
                // Bounce back
                p--;
            }

            stepCount++;
            const grid = positionToGrid(p);
            steps.push({
                playerIndex,
                position: p,
                row: grid.row,
                col: grid.col,
                stepNumber: stepCount,
                totalSteps: 0, // Fill later if needed, mostly for FE progress
                moveType: (i === diceValue && !usedSnake && !usedLadder) ? (p === BOARD_SIZE ? 'win' : 'normal') : 'normal'
            });
        }

        // 2. Snake Slide
        if (usedSnake && snakeEnd) {
            stepCount++;
            const grid = positionToGrid(snakeEnd);
            steps.push({
                playerIndex,
                position: snakeEnd,
                row: grid.row,
                col: grid.col,
                stepNumber: stepCount,
                totalSteps: 0,
                moveType: 'snake'
            });
            p = snakeEnd;
        }

        // 3. Ladder Climb
        if (usedLadder && ladderEnd) {
            stepCount++;
            const grid = positionToGrid(ladderEnd);
            steps.push({
                playerIndex,
                position: ladderEnd,
                row: grid.row,
                col: grid.col,
                stepNumber: stepCount,
                totalSteps: 0,
                moveType: 'ladder'
            });
            p = ladderEnd;
        }

        // Add 'win' type if final step is 100
        if (p === BOARD_SIZE && steps.length > 0) {
            steps[steps.length - 1].moveType = 'win';
        }

        // Fill totalSteps
        return steps.map(s => ({ ...s, totalSteps: stepCount }));
    }
}
