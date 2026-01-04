/**
 * Poker Game Handler
 * Handles Poker-specific game events
 */

import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload } from '../../types';
import { PokerEngine } from '../../../games/poker/PokerEngine';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';

export class PokerHandler extends BaseHandler {
    register(socket: Socket): void {
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        socket.on(
            SOCKET_EVENTS.GAME_ACTION,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_ACTION, (payload: GameActionPayload) =>
                this.handleGameAction(socket, payload)
            )
        );
    }

    private async handleGameStart(
        socket: Socket,
        payload: GameStartPayload
    ): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        if (room.players.length < room.minPlayers) {
            this.emitError(socket, `Need at least ${room.minPlayers} players`);
            return;
        }

        const sender = room.players.find(
            p => p.sessionId === socket.data.sessionId
        );

        if (!sender?.isHost) {
            this.emitError(socket, 'Only host can start the game');
            return;
        }

        const engine = gameStore.createGame('poker', code) as PokerEngine;

        room.players.forEach(p => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position,
            });
        });

        engine.startGame();

        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        // ✅ ONLY SEND STATE (PokerState already contains players)
        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
        });

        console.log(`🃏 Poker game started in room ${code}`);
    }

    private async handleGameAction(
        socket: Socket,
        payload: GameActionPayload
    ): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();

        const engine = gameStore.getGame(code) as PokerEngine | undefined;

        if (!engine) {
            this.emitError(socket, 'Game not found');
            return;
        }

        const sessionId = socket.data.sessionId;

        const newState = engine.handleAction(sessionId, action, data);

        // ✅ ALWAYS emit PokerState only
        this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
            state: newState,
            lastAction: { action, by: sessionId, data },
        });

        await Room.updateOne(
            { code },
            { gameState: newState, currentTurn: newState.currentTurn }
        );

        if (engine.isGameOver()) {
            const state = engine.getState();
            const winnerIndex = engine.getWinner();

            if (winnerIndex === null) {
                this.emitError(socket, 'Game ended but winner could not be determined');
                return;
            }

            const winnerPlayer = state.players[winnerIndex];

            this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                winner: {
                    position: winnerIndex,
                    username: winnerPlayer.username,
                    sessionId: winnerPlayer.sessionId,
                },
            });

            console.log(
                `🏆 Poker finished in room ${code}. Winner: ${winnerPlayer.username}`
            );
        }
    }
}
