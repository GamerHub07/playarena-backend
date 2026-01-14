/**
 * Poker Game Handler
 * 
 * Handles all Poker game events including betting actions, hand dealing, and showdowns.
 * Follows the same pattern as ChessHandler for consistency.
 */

import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload } from '../../types';
import { PokerEngine } from '../../../games/poker/PokerEngine';
import { PokerActionPayload } from '../../../games/poker/PokerTypes';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';
import { turnTimer } from '../../../services/turnTimer';

export class PokerHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (fold, call, raise, check, all-in)
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

        // Only handle Poker rooms
        if (room.gameType !== 'poker') {
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
        const engine = gameStore.createGame('poker', code) as PokerEngine;

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

        // Emit game start to each player with their own masked state
        const players = engine.getPlayers();
        for (const player of players) {
            const maskedState = engine.getMaskedStateForPlayer(player.sessionId);
            const playerSocket = this.getSocketBySessionId(player.sessionId);
            if (playerSocket) {
                playerSocket.emit(SOCKET_EVENTS.GAME_START, {
                    state: maskedState,
                    players: players,
                    availableActions: engine.getAvailableActions(player.position),
                });
            }
        }

        console.log(`🃏 Poker game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();

        // Get game from GameStore
        const engine = gameStore.getGame(code) as PokerEngine | undefined;

        if (!engine) {
            // No game found - might be for another handler
            return;
        }

        // Verify this is a poker game
        if (engine.getGameType() !== 'poker') {
            return; // Let other handlers handle it
        }

        const sessionId = socket.data.sessionId;
        const stateBefore = engine.getState();
        const previousPlayerIndex = stateBefore.currentPlayerIndex;

        // Find the player index for this session
        const playerIndex = engine.getPlayers().findIndex(p => p.sessionId === sessionId);

        // Clear any active turn timer and reset auto-play count since a player is taking their turn
        turnTimer.onTurnTaken(code, playerIndex >= 0 ? playerIndex : undefined);

        try {
            // Construct poker action payload
            const pokerPayload: PokerActionPayload = {
                action: (data as any)?.action || action,
                amount: (data as any)?.amount,
            };

            // Handle the action
            const newState = engine.handleAction(sessionId, 'action', pokerPayload);

            // Emit state update to each player with their own masked state
            const players = engine.getPlayers();
            for (const player of players) {
                const maskedState = engine.getMaskedStateForPlayer(player.sessionId);
                const playerSocket = this.getSocketBySessionId(player.sessionId);
                if (playerSocket) {
                    playerSocket.emit(SOCKET_EVENTS.GAME_STATE, {
                        state: maskedState,
                        lastAction: {
                            action: pokerPayload.action,
                            by: sessionId,
                            amount: pokerPayload.amount
                        },
                        availableActions: engine.getAvailableActions(player.position),
                    });
                }
            }

            // Update room game state in database
            const currentPlayerIdx = newState.currentPlayerIndex;
            await Room.updateOne(
                { code },
                {
                    $set: {
                        gameState: newState,
                        currentTurn: currentPlayerIdx >= 0 ? currentPlayerIdx : 0
                    }
                }
            );

            // Check for game over
            if (engine.isGameOver()) {
                const winnerIndex = engine.getWinner();
                const allPlayers = engine.getPlayers();

                await Room.updateOne({ code }, { status: 'finished' });

                // Clean up game from store
                gameStore.deleteGame(code);

                const winnerData = winnerIndex !== null ? {
                    position: winnerIndex,
                    username: allPlayers.find(p => p.position === winnerIndex)?.username,
                    sessionId: allPlayers.find(p => p.position === winnerIndex)?.sessionId,
                } : null;

                this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                    winner: winnerData,
                    handWinners: newState.winners,
                    isGameOver: true,
                });

                console.log(`🃏 Poker game finished in room ${code}. Winner: ${winnerData?.username}`);
            } else if (newState.phase === 'showdown') {
                // Hand is over but game continues
                this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                    handWinners: newState.winners,
                    isGameOver: false,
                });

                console.log(`🃏 Hand finished in room ${code}. Winners: ${newState.winners?.map(w => w.handName).join(', ')}`);
            } else {
                // Game not over - check if turn changed and if new player is disconnected
                if (newState.currentPlayerIndex !== previousPlayerIndex) {
                    // Turn changed, check if new current player is connected
                    turnTimer.checkCurrentPlayerConnection(code);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.emitError(socket, message);
        }
    }

    /**
     * Get socket by session ID from the room
     */
    private getSocketBySessionId(sessionId: string): Socket | undefined {
        const sockets = this.io.sockets.sockets;

        for (const [, socket] of sockets) {
            if (socket.data.sessionId === sessionId) {
                return socket;
            }
        }
        return undefined;
    }
}
