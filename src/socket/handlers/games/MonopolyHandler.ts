/**
 * Monopoly Game Handler
 * Handles all Monopoly-specific game events including dice rolls, property purchases, and turn management
 */

import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload } from '../../types';
import { MonopolyEngine } from '../../../games/monopoly';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';

export class MonopolyHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (ROLL_DICE, BUY_PROPERTY, END_TURN)
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

        // Only handle Monopoly rooms
        if (room.gameType !== 'monopoly') {
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

        // Check if sender is host
        const senderPlayer = room.players.find(p => p.sessionId === socket.data.sessionId);
        if (!senderPlayer?.isHost) {
            this.emitError(socket, 'Only host can start the game');
            return;
        }

        // Create game engine via GameStore
        const engine = gameStore.createGame('monopoly', code) as MonopolyEngine;

        room.players.forEach(p => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position,
            });
        });

        // Update room status
        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        // Emit game start to all players
        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: engine.getPlayers(),
        });

        console.log(`🎯 Monopoly game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();

        // Get game from GameStore
        const engine = gameStore.getGame(code) as MonopolyEngine | undefined;

        if (!engine) {
            // Game doesn't exist - might be a different game type, ignore silently
            return;
        }

        // Verify this is a Monopoly game
        if (engine.getGameType() !== 'monopoly') {
            return; // Let other handlers deal with it
        }

        const sessionId = socket.data.sessionId;

        try {
            // Handle the action - MonopolyEngine uses uppercase action names
            const newState = engine.handleAction(sessionId, action as string, data);

            // Emit state update
            this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
                state: newState,
                lastAction: { action, by: sessionId, data },
            });

            // Update room game state in database
            await Room.updateOne(
                { code },
                { gameState: newState }
            );

            // Check for winner
            if (engine.isGameOver()) {
                const players = engine.getPlayers();
                const winnerIndex = engine.getWinner();

                const winner = winnerIndex !== null ? {
                    position: winnerIndex,
                    username: players[winnerIndex]?.username,
                    sessionId: players[winnerIndex]?.sessionId,
                } : null;

                await Room.updateOne({ code }, { status: 'finished' });

                // Clean up game from store
                gameStore.deleteGame(code);

                this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, { winner });

                console.log(`🏆 Monopoly game finished in room ${code}. Winner: ${winner?.username}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.emitError(socket, message);
        }
    }
}
