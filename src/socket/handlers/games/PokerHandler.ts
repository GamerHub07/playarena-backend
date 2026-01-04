import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { PokerEngine } from '../../../games/poker/PokerEngine';
import { gameStore } from '../../../services/gameStore';
import Room from '../../../models/Room';

export class PokerHandler extends BaseHandler {
    register(socket: Socket): void {
        // Start the game (Host only)
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: any) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Handle Poker Actions (Fold, Call, Raise)
        socket.on(
            SOCKET_EVENTS.GAME_ACTION,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_ACTION, (payload: any) =>
                this.handleGameAction(socket, payload)
            )
        );

        // Handle Reconnection / Late Join to Game
        socket.on(
            SOCKET_EVENTS.ROOM_JOIN,
            this.wrapHandler(socket, SOCKET_EVENTS.ROOM_JOIN, (payload: any) =>
                this.handleRoomJoin(socket, payload)
            )
        );
    }

    private async handleGameStart(socket: Socket, payload: any): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room) return this.emitError(socket, 'Room not found');

        // Logic check: Ensure host is the one starting
        if (room.players.find(p => p.isHost)?.sessionId !== socket.data.sessionId) {
            return this.emitError(socket, 'Only the host can start the game');
        }

        // Initialize Poker Engine through your GameStore factory
        const engine = gameStore.createGame('poker', code) as PokerEngine;

        // Sync players from DB Room to Engine
        room.players.forEach(p => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position
            });
        });

        // Trigger 'init' to deal first hand and post blinds
        const initialState = engine.handleAction(socket.data.sessionId, 'init', null);

        // Update Room Status in DB
        room.status = 'playing';
        room.gameState = initialState as any;
        await room.save();

        // Broadcast starting state (Masked)
        this.broadcastState(code, engine);
        console.log(`♠️ Poker game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: any): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();
        const engine = gameStore.getGame(code) as PokerEngine | undefined;

        if (!engine) return this.emitError(socket, 'Game not found');

        // Execute action in engine
        const newState = engine.handleAction(socket.data.sessionId, action, data);

        // Save progress to DB
        await Room.updateOne({ code }, { gameState: newState });

        // Broadcast to all players
        this.broadcastState(code, engine);

        // Check if game ended (Showdown)
        if (engine.isGameOver()) {
            this.handleGameOver(code, engine);
        }
    }

    /**
     * BROADCAST WITH SECURITY
     * We loop through each socket in the room and strip out the 'hand' 
     * of other players so no one can cheat using DevTools.
     */
    private broadcastState(roomCode: string, engine: PokerEngine) {
        // Get a snapshot of the current state
        const rawState = engine.getState();
        const playersInRoom = Array.from(this.io.sockets.adapter.rooms.get(roomCode) || []);

        playersInRoom.forEach(socketId => {
            const clientSocket = this.io.sockets.sockets.get(socketId);
            if (!clientSocket) return;

            const mySessionId = clientSocket.data.sessionId;

            // Deep clone per player to avoid shared mutations
            const pState = JSON.parse(JSON.stringify(rawState));

            // Masking Logic
            Object.values(pState.players).forEach((player: any) => {
                const shouldMask = player.sessionId !== mySessionId && pState.currentPhase !== 'showdown';
                // console.log(`[POKER MASK] ${player.username} (${player.sessionId}) vs Me (${mySessionId}). Phase: ${pState.currentPhase}. Mask: ${shouldMask}`);

                if (shouldMask) {
                    player.hand = [];
                    // Force empty hand for safety
                    if (player.hand.length !== 0) player.hand = [];
                }
            });

            clientSocket.emit(SOCKET_EVENTS.GAME_STATE, {
                state: pState,
                lastAction: { by: mySessionId }
            });
        });
    }

    /**
     * When a player joins/rejoins a room that is IN_PROGRESS ('playing'),
     * we must send them the current game state immediately.
     */
    private async handleRoomJoin(socket: Socket, payload: any): Promise<void> {
        const { roomCode } = payload;
        const code = roomCode.toUpperCase();

        // 1. Check if game is running in memory
        const engine = gameStore.getGame(code) as PokerEngine | undefined;

        // If no engine, maybe the game hasn't started or is finished. 
        // We do nothing as RoomHandler covers basic join.
        if (!engine) return;

        // 2. Send the current state ONLY to this user (masked)
        this.sendStateToSocket(socket, engine);
    }

    /**
     * Send masked state to a single socket
     */
    private sendStateToSocket(socket: Socket, engine: PokerEngine) {
        const rawState = engine.getState();
        const mySessionId = socket.data.sessionId;

        // Deep clone
        const pState = JSON.parse(JSON.stringify(rawState));

        // Masking Logic
        Object.values(pState.players).forEach((player: any) => {
            if (player.sessionId !== mySessionId && pState.currentPhase !== 'showdown') {
                player.hand = [];
            }
        });

        socket.emit(SOCKET_EVENTS.GAME_STATE, {
            state: pState,
            lastAction: { by: mySessionId }
        });
    }

    private async handleGameOver(code: string, engine: PokerEngine) {
        // Standard cleanup similar to your LudoHandler
        await Room.updateOne({ code }, { status: 'finished' });
        // gameStore.deleteGame(code); // Optional: Keep in memory for a bit for animations
    }
}