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
import { ChessMovePayload, positionToAlgebraic } from '../../../games/chess/ChessTypes';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';

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

        console.log(`♟️ Chess game started in room ${code}`);
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
