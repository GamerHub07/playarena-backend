/**
 * Snake & Ladder Game Handler
 * 
 * Handles all Snake & Ladder game events including dice rolls and animations.
 * Follows the same pattern as LudoHandler for consistency.
 */

import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload } from '../../types';
import { SnakeLadderEngine } from '../../../games/snake-ladder/SnakeLadderEngine';
import { SnakeLadderMoveStep } from '../../../games/snake-ladder/SnakeLadderTypes';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';
import { playtimeTracker } from '../../../services/playtimeTracker';
import { socketManager } from '../../SocketManager';

export class SnakeLadderHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (roll)
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

        // Only handle if this is a snake-ladder game
        if (room.gameType !== 'snake-ladder') {
            return; // Let other handlers handle it
        }

        // Check if game already exists (prevent duplicate starts)
        if (gameStore.hasGame(code)) {
            // Force reset if starting again from waiting room
            gameStore.deleteGame(code);
        }

        if (room.players.length < room.minPlayers) {
            this.emitError(socket, `Need at least ${room.minPlayers} players`);
            return;
        }

        // Check if sender is host
        const senderPlayer = room.players.find(p => p.sessionId === socket.data.sessionId);
        if (!senderPlayer?.isHost) {
            this.emitError(socket, 'Only host can start the game');
            return;
        }

        // Create game engine via GameStore
        const engine = gameStore.createGame('snake-ladder', code) as SnakeLadderEngine;

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

        // Emit game start to all players
        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: engine.getPlayers(),
        });

        // Start playtime tracking for all users in the room
        const sockets = socketManager.getRoomSockets(code);
        sockets.forEach(s => {
            if (s.data.userId) {
                playtimeTracker.startSession(s.data.userId);
            }
        });

        console.log(`🐍 Snake & Ladder game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action } = payload;
        const code = roomCode.toUpperCase();

        // Get game from GameStore
        const engine = gameStore.getGame(code) as SnakeLadderEngine | undefined;

        if (!engine) {
            // No game found - might be for another handler
            return;
        }

        // Verify this is a snake-ladder game
        if (engine.getGameType() !== 'snake-ladder') {
            return; // Let other handlers handle it
        }

        const sessionId = socket.data.sessionId;
        const stateBefore = JSON.parse(JSON.stringify(engine.getState())); // Deep copy

        try {
            // Handle the action
            const newState = engine.handleAction(sessionId, action, null);

            // Always emit state update for all actions
            this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
                state: newState,
                lastAction: { action, by: sessionId },
            });

            // For move actions, emit animation steps (movement now happens on 'move', not 'roll')
            if (action === 'move') {
                const lastMove = engine.getLastMove();

                if (lastMove) {
                    const moveSteps = engine.generateMoveSteps(
                        lastMove.player,
                        lastMove.from,
                        lastMove.to,
                        lastMove.diceValue,
                        lastMove.usedSnake,
                        lastMove.usedLadder,
                        lastMove.snakeEnd,
                        lastMove.ladderEnd
                    );

                    if (moveSteps.length > 0) {
                        // Emit step-by-step animation
                        this.emitToRoom(code, SOCKET_EVENTS.GAME_TOKEN_MOVE, {
                            steps: moveSteps,
                            finalState: newState,
                            move: lastMove,
                        });
                    }
                }
            }

            // Update room game state in database
            await Room.updateOne(
                { code },
                { gameState: newState, currentTurn: newState.currentPlayer }
            );

            // Check for winner
            if (engine.isGameOver()) {
                const winnerIndex = engine.getWinner();
                const winner = engine.getPlayers()[winnerIndex!];

                await Room.updateOne({ code }, { status: 'finished' });

                // Clean up game from store
                gameStore.deleteGame(code);

                // STOP TRACKING FOR ALL PLAYERS
                const sockets = socketManager.getRoomSockets(code);
                sockets.forEach(s => {
                    if (s.data.userId) {
                        playtimeTracker.endSession(s.data.userId);
                    }
                });

                this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                    winner: {
                        position: winnerIndex,
                        username: winner.username,
                        sessionId: winner.sessionId,
                    },
                });

                console.log(`🏆 ${winner.username} won Snake & Ladder in room ${code}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.emitError(socket, message);
        }
    }
}
