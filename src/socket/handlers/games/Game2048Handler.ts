import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload, JoinRoomPayload } from '../../types';
import { Engine2048 } from '../../../games/2048/Engine2048';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';
import { socketManager } from '../../SocketManager';
import { playtimeTracker } from '../../../services/playtimeTracker';

export class Game2048Handler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (move, restart, keep_playing)
        socket.on(
            SOCKET_EVENTS.GAME_ACTION,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_ACTION, (payload: GameActionPayload) =>
                this.handleGameAction(socket, payload)
            )
        );

        // Room join (to auto-start game)
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
        if (!room || room.gameType !== '2048') return;

        let engine = gameStore.getGame(code) as Engine2048;

        if (!engine || room.status === 'waiting') {
            if (!engine) {
                engine = gameStore.createGame('2048', code) as Engine2048;
                room.players.forEach(p => {
                    engine.addPlayer({
                        sessionId: p.sessionId,
                        username: p.username,
                        position: p.position,
                    });
                });
            }

            if (room.status === 'waiting') {
                room.status = 'playing';
                room.gameState = engine.getState() as unknown as Record<string, unknown>;
                await room.save();

                console.log(`🔢 2048 auto-started on join in room ${code}`);

                this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
                    state: engine.getState(),
                    players: engine.getPlayers(),
                });

                const sockets = socketManager.getRoomSockets(code);
                sockets.forEach(s => {
                    if (s.data.userId) {
                        playtimeTracker.startSession(s.data.userId);
                    }
                });
            }
        } else if (room.status === 'playing' && engine) {
            // Game is already running, send state to the new/re-joining player
            socket.emit(SOCKET_EVENTS.GAME_START, {
                state: engine.getState(),
                players: engine.getPlayers(),
            });
            console.log(`🔢 2048 state sent to joining player ${socket.data.username} in room ${code}`);
        }
    }

    private async handleGameStart(socket: Socket, payload: GameStartPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        if (room.gameType !== '2048') {
            return;
        }

        // Similar logic to Sudoku - ensure engine
        let engine = gameStore.getGame(code) as Engine2048;
        if (!engine) {
            engine = gameStore.createGame('2048', code) as Engine2048;
        }

        room.players.forEach(p => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position,
            });
        });

        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: engine.getPlayers(),
        });

        // Start playtime tracking
        const sockets = socketManager.getRoomSockets(code);
        sockets.forEach(s => {
            if (s.data.userId) {
                playtimeTracker.startSession(s.data.userId);
            }
        });

        console.log(`🔢 2048 game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();

        const engine = gameStore.getGame(code) as Engine2048 | undefined;

        if (!engine) return;
        if (engine.getGameType() !== '2048') return;

        const sessionId = socket.data.sessionId;

        const newState = engine.handleAction(sessionId, action, data);

        this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
            state: newState,
            lastAction: { action, by: sessionId, data },
        });

        await Room.updateOne(
            { code },
            { gameState: newState }
        );

        if ((newState as any).gameOver) {
            const sockets = socketManager.getRoomSockets(code);
            sockets.forEach(s => {
                if (s.data.userId) {
                    playtimeTracker.endSession(s.data.userId);
                }
            });
        }
    }
}
