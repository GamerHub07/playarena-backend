/**
 * Tic Tac Toe Game Handler
 * 
 * Handles all Tic Tac Toe game events including game start and moves.
 * Follows the same pattern as LudoHandler for consistency.
 */

import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameStartPayload, GameActionPayload } from '../../types';
import { TicTacToeEngine } from '../../../games/tictactoe';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';

export class TicTacToeHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start (host only)
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (moves)
        socket.on(
            SOCKET_EVENTS.GAME_ACTION,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_ACTION, (payload: GameActionPayload) =>
                this.handleGameAction(socket, payload)
            )
        );
    }

    private async handleGameStart(socket: Socket, payload: GameStartPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const { sessionId } = this.getSocketData(socket);

        if (!sessionId) {
            this.emitError(socket, 'Not authenticated');
            return;
        }

        // Find room
        const room = await Room.findOne({ code });
        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        // Check if this is a Tic Tac Toe room
        if (room.gameType !== 'tictactoe') {
            return; // Let another handler deal with it
        }

        // Check if game already exists (prevent duplicate starts)
        if (gameStore.hasGame(code)) {
            return; // Game already started
        }

        // Check if sender is host
        const player = room.players.find(p => p.sessionId === sessionId);
        if (!player || !player.isHost) {
            this.emitError(socket, 'Only the host can start the game');
            return;
        }

        // Check minimum players
        if (room.players.length < 2) {
            this.emitError(socket, 'Need 2 players to start');
            return;
        }

        // Create game engine via GameStore
        const engine = gameStore.createGame('tictactoe', code) as TicTacToeEngine;

        // Add players to engine
        room.players.forEach((p, index) => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: index,
            });
        });

        // Initialize game
        engine.initializeGame();

        // Update room status
        room.status = 'playing';
        await room.save();

        // Emit game start to all players
        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: room.players.map((p, i) => ({
                username: p.username,
                sessionId: p.sessionId,
                symbol: i === 0 ? 'X' : 'O',
            })),
        });

        console.log(`🎮 Tic Tac Toe game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();
        const { sessionId } = this.getSocketData(socket);

        if (!sessionId) {
            this.emitError(socket, 'Not authenticated');
            return;
        }

        // Get engine
        const engine = gameStore.getGame(code) as TicTacToeEngine;
        if (!engine || engine.getGameType() !== 'tictactoe') {
            return; // Let another handler deal with it
        }

        try {
            // Handle restart action specially
            if (action === 'restart') {
                const newState = engine.handleAction(sessionId, action, data);

                // Update room status back to playing
                const room = await Room.findOne({ code });
                if (room) {
                    room.status = 'playing';
                    await room.save();
                }

                // Emit game restart to all
                this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
                    state: newState,
                    players: engine.getPlayers().map((p, i) => ({
                        username: p.username,
                        sessionId: p.sessionId,
                        symbol: i === 0 ? 'X' : 'O',
                    })),
                });

                console.log(`🔄 Tic Tac Toe restarted in room ${code}`);
                return;
            }

            // Handle the action
            const newState = engine.handleAction(sessionId, action, data);

            // Emit state update to all
            this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
                state: newState,
            });

            // Check for game over
            if (engine.isGameOver()) {
                const winnerIndex = engine.getWinner();
                const players = engine.getPlayers();

                // Update room status but DON'T delete game (allow restart)
                const room = await Room.findOne({ code });
                if (room) {
                    room.status = 'finished';
                    await room.save();
                }

                if (winnerIndex !== null) {
                    const winner = players[winnerIndex];
                    this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                        winner: {
                            position: winnerIndex,
                            username: winner.username,
                            symbol: winnerIndex === 0 ? 'X' : 'O',
                        },
                        isDraw: false,
                    });
                    console.log(`🏆 ${winner.username} won Tic Tac Toe in room ${code}`);
                } else {
                    // Draw
                    this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                        winner: null,
                        isDraw: true,
                    });
                    console.log(`🤝 Tic Tac Toe ended in draw in room ${code}`);
                }

                // NOTE: We do NOT delete the game here to allow restart
                // Game will be cleaned up by stale game cleanup or when room is left
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.emitError(socket, message);
        }
    }
}
