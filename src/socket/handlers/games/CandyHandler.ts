import { BaseHandler } from '../BaseHandler';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload, JoinRoomPayload } from '../../types';
import { CandyEngine } from '../../../games/candy-curse/CandyEngine';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';
import { playtimeTracker } from '../../../services/playtimeTracker';
import { socketManager } from '../../SocketManager';

export class CandyHandler extends BaseHandler {
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

        socket.on(
            SOCKET_EVENTS.ROOM_JOIN,
            this.wrapHandler(socket, SOCKET_EVENTS.ROOM_JOIN, (payload: JoinRoomPayload) =>
                this.handleRoomJoin(socket, payload)
            )
        );
    }

    private async handleRoomJoin(socket: Socket, payload: JoinRoomPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });
        if (!room || room.gameType !== 'candy-curse') return;

        let engine = gameStore.getGame(code) as CandyEngine;

        if (!engine || room.status === 'waiting') {
            if (!engine) {
                engine = gameStore.createGame('candy-curse', code) as CandyEngine;
                room.players.forEach(p => {
                    engine.addPlayer({
                        sessionId: p.sessionId,
                        username: p.username,
                        position: p.position,
                    });
                });
            }

            if (room.status === 'waiting') {
                room.status = 'playing'; // Auto-start
                room.gameState = engine.getState() as unknown as Record<string, unknown>;
                await room.save();

                this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
                    state: engine.getState(),
                    players: engine.getPlayers(),
                });

                // START TRACKING
                const sockets = socketManager.getRoomSockets(code);
                sockets.forEach(s => {
                    if (s.data.userId) {
                        playtimeTracker.startSession(s.data.userId);
                    }
                });
            }
        } else if (room.status === 'playing' && engine) {
            socket.emit(SOCKET_EVENTS.GAME_START, {
                state: engine.getState(),
                players: engine.getPlayers(),
            });
        }
    }

    private async handleGameStart(socket: Socket, payload: GameStartPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room || room.gameType !== 'candy-curse') return;

        let engine = gameStore.getGame(code) as CandyEngine;
        if (!engine) {
            engine = gameStore.createGame('candy-curse', code) as CandyEngine;
        }

        room.players.forEach(p => engine.addPlayer({
            sessionId: p.sessionId,
            username: p.username,
            position: p.position,
        }));

        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: engine.getPlayers(),
        });

        // START TRACKING
        const sockets = socketManager.getRoomSockets(code);
        sockets.forEach(s => {
            if (s.data.userId) {
                playtimeTracker.startSession(s.data.userId);
            }
        });
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();
        const engine = gameStore.getGame(code) as CandyEngine;

        if (!engine || engine.getGameType() !== 'candy-curse') return;

        const newState = engine.handleAction(socket.data.sessionId, action, data);

        this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
            state: newState,
            lastAction: { action, by: socket.data.sessionId, data }
        });

        await Room.updateOne({ code }, { gameState: newState });

        // End playtime session if game is complete
        if ((newState as any).isComplete) {
            const sockets = socketManager.getRoomSockets(code);
            sockets.forEach(s => {
                if (s.data.userId) {
                    playtimeTracker.endSession(s.data.userId);
                }
            });
        }
    }
}
