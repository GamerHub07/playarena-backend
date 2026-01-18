import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload, JoinRoomPayload } from '../../types';
import { SudokuEngine } from '../../../games/sudoku/SudokuEngine';
import Room from '../../../models/Room';
import { gameStore } from '../../../services/gameStore';
import { turnTimer } from '../../../services/turnTimer';
import { playtimeTracker } from '../../../services/playtimeTracker';
import { socketManager } from '../../SocketManager';

export class SudokuHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (move, new_game)
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
        // We can rely on gameStore check first to avoid DB hit if game exists? 
        // But we need to check gameType if not sure.
        // Let's check DB to be safe and set status.

        const room = await Room.findOne({ code });
        if (!room || room.gameType !== 'sudoku') return;

        // Check if game engine exists or needs creation
        let engine = gameStore.getGame(code) as SudokuEngine;

        // If game not running or room in waiting state, initialize/start it
        if (!engine || room.status === 'waiting') {
            if (!engine) {
                engine = gameStore.createGame('sudoku', code) as SudokuEngine;
                // Add players from room
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

                console.log(`🧩 Sudoku auto-started on join in room ${code}`);

                // Emit game start/state to room (so the joining player gets it)
                // Note: RoomHandler might have already run but it wouldn't send state if status was waiting.
                this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
                    state: engine.getState(),
                    players: engine.getPlayers(),
                });

                // Also ensures playtime tracking
                const sockets = socketManager.getRoomSockets(code);
                sockets.forEach(s => {
                    if (s.data.userId) {
                        playtimeTracker.startSession(s.data.userId);
                    }
                });
            }
        }
        else if (room.status === 'playing' && engine) {
            // Game is already running, send state to the new/re-joining player
            socket.emit(SOCKET_EVENTS.GAME_START, {
                state: engine.getState(),
                players: engine.getPlayers(),
            });
            console.log(`🧩 Sudoku state sent to joining player ${socket.data.username} in room ${code}`);
        }
    }

    private async handleGameStart(socket: Socket, payload: GameStartPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        // Only handle Sudoku rooms
        if (room.gameType !== 'sudoku') {
            return;
        }

        // Check if game already exists (prevent duplicate starts)
        // For Sudoku, "start" might just mean "ensure engine is ready" or "restart"
        // But typically the frontend calls "new_game" action to restart.
        // We'll use this to initialize if not present.

        let engine = gameStore.getGame(code) as SudokuEngine;
        if (!engine) {
            engine = gameStore.createGame('sudoku', code) as SudokuEngine;
        }

        // Add/Update player in engine
        room.players.forEach(p => {
            // Sudoku is single player usually, or multiplayer competition.
            // If multiple players in room, adding them all is fine.
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position,
            });
        });

        // Initialize/Ensure state
        // If it's a fresh create, it might already have state from getInitialState
        // If restarting, use new_game action.

        // Update room status
        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        // Emit game start/state to all players
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

        console.log(`🧩 Sudoku game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();

        const engine = gameStore.getGame(code) as SudokuEngine | undefined;

        if (!engine) return;
        if (engine.getGameType() !== 'sudoku') return;

        const sessionId = socket.data.sessionId;

        // Handle the action
        const newState = engine.handleAction(sessionId, action, data);

        // Emit state update
        this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
            state: newState,
            lastAction: { action, by: sessionId, data },
        });

        // Update room game state
        await Room.updateOne(
            { code },
            { gameState: newState }
        );

        // Check for completion/winner
        if (engine.isGameOver()) {
            // Sudoku completion doesn't necessarily mean "Game Over" in a multiplayer sense unless competitive.
            // But let's follow the general pattern.
            // For single player Sudoku in a room, maybe we just notify "Puzzle Solved".
            // If we want to persist "Finished" status:

            // If it's just a solo play, we might not close the room, allowing "New Game".
            // So we might NOT set room status to 'finished' here, or maybe we do?
            // The engine sets isComplete = true. 
            // Let's Just finish it for now if that's the standard flow, 
            // OR keep it open for "New Game".
            // Given the frontend has a "New Game" button in controls even after win,
            // we probably shouldn't kill the room. 
            // But existing Ludo handler finishes room.
            // Sudoku seems to support "New Game" action which resets state.
            // So we WON'T set room.status = 'finished' automatically unless it's a specific competitive mode.
            // We'll just emit the state which says "isComplete: true".
        }
    }
}
