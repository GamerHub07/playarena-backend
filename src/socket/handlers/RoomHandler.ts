/**
 * Room Handler
 * Handles room join/leave and connection management
 */

import { Socket } from 'socket.io';
import { BaseHandler } from './BaseHandler';
import { socketManager } from '../SocketManager';
import { SOCKET_EVENTS } from '../events';
import { JoinRoomPayload } from '../types';
import Room from '../../models/Room';
import { gameStore } from '../../services/gameStore';
import { ChessEngine } from '../../games/chess/ChessEngine';


export class RoomHandler extends BaseHandler {
    register(socket: Socket): void {
        // Room join
        socket.on(
            SOCKET_EVENTS.ROOM_JOIN,
            this.wrapHandler(socket, SOCKET_EVENTS.ROOM_JOIN, (payload: JoinRoomPayload) =>
                this.handleJoin(socket, payload)
            )
        );

        // Room leave
        socket.on(
            SOCKET_EVENTS.ROOM_LEAVE,
            this.wrapHandler(socket, SOCKET_EVENTS.ROOM_LEAVE, () =>
                this.handleLeave(socket)
            )
        );

        // Theme change (host only)
        socket.on(
            SOCKET_EVENTS.ROOM_THEME,
            this.wrapHandler(socket, SOCKET_EVENTS.ROOM_THEME, (payload: { themeId: string }) =>
                this.handleThemeChange(socket, payload)
            )
        );

        // Handle disconnect
        socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
            await this.handleDisconnect(socket);
        });
    }

    private async handleJoin(socket: Socket, payload: JoinRoomPayload): Promise<void> {
        const { roomCode, sessionId, username } = payload;
        const code = roomCode.toUpperCase();

        const room = await Room.findOne({ code });
        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        socketManager.joinRoom(socket, code);

        socket.data.roomCode = code;
        socket.data.sessionId = sessionId;
        socket.data.username = username;

        const player = room.players.find(p => p.sessionId === sessionId);
        if (player) {
            player.isConnected = true;
            await room.save();
        }

        this.emitToRoom(code, SOCKET_EVENTS.ROOM_UPDATE, {
            players: room.players,
            status: room.status,
        });

        // NOTE: Auto-start disabled for chess so host can choose time control
        // Game will start when host clicks "Start Game" button
        // The timeControl is passed in the game:start event from ChessHandler
        /*
        const connectedCount = room.players.filter(p => p.isConnected).length;
        if (
            room.gameType === 'chess' &&
            room.status === 'waiting' &&
            connectedCount >= room.minPlayers
        ) {
            // ... auto-start code disabled
        }
        */

        console.log(`👤 ${username} joined room ${code}`);
    }

    private async handleLeave(socket: Socket): Promise<void> {
        await this.handleDisconnect(socket);
    }

    private async handleDisconnect(socket: Socket): Promise<void> {
        const { roomCode, sessionId } = this.getSocketData(socket);

        // Leave room via manager
        socketManager.leaveRoom(socket);

        if (!roomCode || !sessionId) return;

        try {
            const room = await Room.findOne({ code: roomCode });
            if (!room) return;

            // Update player connection status
            const player = room.players.find(p => p.sessionId === sessionId);
            if (player) {
                player.isConnected = false;
                await room.save();

                // Notify other players
                this.emitToRoom(roomCode, SOCKET_EVENTS.ROOM_UPDATE, {
                    players: room.players,
                    status: room.status,
                });
            }

            console.log(`👋 Player ${sessionId} disconnected from room ${roomCode}`);
        } catch (error) {
            console.error('Disconnect handler error:', error);
        }
    }

    private async handleThemeChange(socket: Socket, payload: { themeId: string }): Promise<void> {
        const { roomCode, sessionId } = this.getSocketData(socket);
        const { themeId } = payload;

        if (!roomCode || !sessionId) {
            this.emitError(socket, 'Not in a room');
            return;
        }

        try {
            const room = await Room.findOne({ code: roomCode });
            if (!room) {
                this.emitError(socket, 'Room not found');
                return;
            }

            // Check if the sender is the host
            const player = room.players.find(p => p.sessionId === sessionId);
            if (!player || !player.isHost) {
                this.emitError(socket, 'Only the host can change the theme');
                return;
            }

            // Broadcast theme change to all players in the room
            this.emitToRoom(roomCode, SOCKET_EVENTS.ROOM_THEME, {
                themeId,
            });

            console.log(`🎨 Theme changed to ${themeId} in room ${roomCode} by host`);
        } catch (error) {
            console.error('Theme change handler error:', error);
            this.emitError(socket, 'Failed to change theme');
        }
    }
}

