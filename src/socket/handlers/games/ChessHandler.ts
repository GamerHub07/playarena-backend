/**
 * Chess Game Handler
 * 
 * Handles all Chess game events including moves, resignations, and draw offers.
 * Follows the same pattern as LudoHandler and SnakeLadderHandler for consistency.
 */

import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload } from '../../types';
import { ChessEngine } from '../../../games/chess/ChessEngine';
import { ChessMovePayload, positionToAlgebraic, TIME_CONTROL_PRESETS } from '../../../games/chess/ChessTypes';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';

// Store timer intervals for each room
const timerIntervals: Map<string, NodeJS.Timeout> = new Map();

export class ChessHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (move, resign, draw offers)
        socket.on(
            SOCKET_EVENTS.GAME_ACTION,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_ACTION, (payload: GameActionPayload) =>
                this.handleGameAction(socket, payload)
            )
        );
    }

    private async handleGameStart(socket: Socket, payload: GameStartPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        // Only handle Chess rooms
        if (room.gameType !== 'chess') {
            return; // Let other handlers deal with it
        }

        // Check if game already exists (prevent duplicate starts)
        if (gameStore.hasGame(code)) {
            return; // Game already started
        }

        if (room.players.length < room.minPlayers) {
            this.emitError(socket, `Need at least ${room.minPlayers} players`);
            return;
        }

        if (room.players.length > 2) {
            this.emitError(socket, 'Chess requires exactly 2 players');
            return;
        }

        // Check if sender is host
        const senderPlayer = room.players.find(p => p.sessionId === socket.data.sessionId);
        if (!senderPlayer?.isHost) {
            this.emitError(socket, 'Only host can start the game');
            return;
        }

        // Create game engine via GameStore
        const engine = gameStore.createGame('chess', code) as ChessEngine;

        room.players.forEach(p => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position,
            });
        });

        // Initialize game
        engine.handleAction(socket.data.sessionId, 'init', null);

        // Set time control if provided (payload may have timeControlKey)
        const timeControlKey = (payload as GameStartPayload & { timeControlKey?: string }).timeControlKey;
        if (timeControlKey && TIME_CONTROL_PRESETS[timeControlKey]) {
            engine.setTimeControl(timeControlKey);
        }

        // Update room status
        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        // Get valid moves for the starting player (for UI hints)
        const validMoves = this.serializeValidMoves(engine.getAllValidMoves());

        // Emit game start to all players
        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: engine.getPlayers(),
            validMoves,
        });

        // Start timer interval if time control is set
        if (engine.getState().timeControl && engine.getState().timeControl!.type !== 'unlimited') {
            this.startTimerInterval(code, engine);
        }

        console.log(`♟️ Chess game started in room ${code}${timeControlKey ? ` (${TIME_CONTROL_PRESETS[timeControlKey]?.name})` : ''}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();

        // Get game from GameStore
        const engine = gameStore.getGame(code) as ChessEngine | undefined;

        if (!engine) {
            // No game found - might be for another handler
            return;
        }

        // Verify this is a chess game
        if (engine.getGameType() !== 'chess') {
            return; // Let other handlers handle it
        }

        const sessionId = socket.data.sessionId;

        try {
            // Handle the action
            const newState = engine.handleAction(sessionId, action, data);

            // Get valid moves for the next player
            const validMoves = engine.isGameOver()
                ? {}
                : this.serializeValidMoves(engine.getAllValidMoves());

            // Emit state update
            this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
                state: newState,
                lastAction: { action, by: sessionId, data },
                validMoves,
            });

            // Emit move animation for move actions
            if (action === 'move' && data) {
                const moveData = data as ChessMovePayload;
                const lastMove = newState.moveHistory[newState.moveHistory.length - 1];

                if (lastMove) {
                    this.emitToRoom(code, SOCKET_EVENTS.GAME_TOKEN_MOVE, {
                        from: moveData.from,
                        to: moveData.to,
                        move: lastMove,
                        notation: `${positionToAlgebraic(moveData.from)}${positionToAlgebraic(moveData.to)}`,
                    });
                }
            }

            // Update room game state in database
            // Use explicit $set to avoid MongoDB path collision issues
            const currentTurnValue = newState.currentPlayer === 'white' ? 0 : 1;
            await Room.updateOne(
                { code },
                {
                    $set: {
                        gameState: newState,
                        currentTurn: currentTurnValue
                    }
                }
            );

            // Check for game over
            if (engine.isGameOver()) {
                const winnerIndex = engine.getWinner();
                const players = engine.getPlayers();

                await Room.updateOne({ code }, { status: 'finished' });

                // Clean up timer interval
                this.stopTimerInterval(code);

                // Clean up game from store
                gameStore.deleteGame(code);

                const winnerData = winnerIndex !== null ? {
                    position: winnerIndex,
                    username: players[winnerIndex].username,
                    sessionId: players[winnerIndex].sessionId,
                } : null;

                this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                    winner: winnerData,
                    gameResult: newState.gameResult,
                    isDraw: newState.isDraw,
                });

                if (winnerData) {
                    console.log(`♟️ ${winnerData.username} won Chess (${newState.gameResult}) in room ${code}`);
                } else {
                    console.log(`♟️ Chess game ended in draw (${newState.gameResult}) in room ${code}`);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.emitError(socket, message);
        }
    }

    /**
     * Start timer interval to check for timeout and emit timer updates
     */
    private startTimerInterval(code: string, engine: ChessEngine): void {
        // Clear any existing interval
        this.stopTimerInterval(code);

        const interval = setInterval(async () => {
            // Check if game still exists
            if (!gameStore.hasGame(code)) {
                this.stopTimerInterval(code);
                return;
            }

            // Check for timeout
            const timedOutPlayer = engine.checkTimeout();
            if (timedOutPlayer) {
                const newState = engine.handleTimeout(timedOutPlayer);

                // Emit game state update
                this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
                    state: newState,
                    lastAction: { action: 'timeout', by: 'server' },
                    validMoves: {},
                });

                // Emit winner
                const winnerIndex = engine.getWinner();
                const players = engine.getPlayers();
                const winnerData = winnerIndex !== null ? {
                    position: winnerIndex,
                    username: players[winnerIndex].username,
                    sessionId: players[winnerIndex].sessionId,
                } : null;

                this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                    winner: winnerData,
                    gameResult: newState.gameResult,
                    isDraw: false,
                });

                // Update database and cleanup
                await Room.updateOne({ code }, { status: 'finished' });
                this.stopTimerInterval(code);
                gameStore.deleteGame(code);

                console.log(`♟️ ${timedOutPlayer === 'white' ? 'Black' : 'White'} wins by timeout in room ${code}`);
                return;
            }

            // Emit timer update to all clients
            this.emitToRoom(code, 'game:timer', {
                whiteTimeMs: engine.getTimeRemaining('white'),
                blackTimeMs: engine.getTimeRemaining('black'),
                currentPlayer: engine.getState().currentPlayer,
            });
        }, 1000); // Check every second

        timerIntervals.set(code, interval);
    }

    /**
     * Stop timer interval for a room
     */
    private stopTimerInterval(code: string): void {
        const interval = timerIntervals.get(code);
        if (interval) {
            clearInterval(interval);
            timerIntervals.delete(code);
        }
    }

    /**
     * Convert Map of valid moves to serializable object
     */
    private serializeValidMoves(moves: Map<string, { row: number; col: number }[]>): Record<string, { row: number; col: number }[]> {
        const result: Record<string, { row: number; col: number }[]> = {};
        moves.forEach((positions, key) => {
            result[key] = positions;
        });
        return result;
    }
}
