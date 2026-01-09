/**
 * Room Handler
 * Handles room join/leave, connection management, and chat
 */

import { Socket } from 'socket.io';
import { BaseHandler } from './BaseHandler';
import { socketManager } from '../SocketManager';
import { SOCKET_EVENTS } from '../events';
import { JoinRoomPayload } from '../types';
import Room from '../../models/Room';
import { gameStore } from '../../services/gameStore';

// In-memory chat history per room (limited to last 50 messages)
interface ChatMessage {
    id: string;
    roomCode: string;
    sessionId: string;
    username: string;
    message: string;
    timestamp: number;
}
const chatHistory: Map<string, ChatMessage[]> = new Map();
const MAX_CHAT_HISTORY = 50;

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

        // Chat handlers
        socket.on('chat:join', this.wrapHandler(socket, 'chat:join', () =>
            this.handleChatJoin(socket)
        ));

        socket.on('chat:send', this.wrapHandler(socket, 'chat:send', (payload: { roomCode: string; message: string }) =>
            this.handleChatSend(socket, payload)
        ));

        // Handle disconnect
        socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
            await this.handleDisconnect(socket);
        });
    }

    private async handleJoin(socket: Socket, payload: JoinRoomPayload): Promise<void> {
        const { roomCode, sessionId, username } = payload;
        const code = roomCode.toUpperCase();

        // Find room in database
        const room = await Room.findOne({ code });
        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        // Join socket.io room via manager
        socketManager.joinRoom(socket, code);

        // Store session data on socket
        socket.data.roomCode = code;
        socket.data.sessionId = sessionId;
        socket.data.username = username;

        // Update player connection status
        const player = room.players.find(p => p.sessionId === sessionId);
        if (player) {
            player.isConnected = true;
            await room.save();
        }

        // Emit room update to all players
        this.emitToRoom(code, SOCKET_EVENTS.ROOM_UPDATE, {
            players: room.players,
            status: room.status,
        });

        // If game is in progress, send current game state to the rejoining player
        if (room.status === 'playing') {
            const engine = gameStore.getGame(code);
            if (engine) {
                // For poker games, use the masked state to hide opponent cards
                // Also send availableActions so action buttons show correctly
                const gameType = engine.getGameType();
                let stateToSend: unknown;
                let availableActions: string[] = [];

                if (gameType === 'poker' && 'getMaskedStateForPlayer' in engine && 'getAvailableActions' in engine) {
                    const pokerEngine = engine as unknown as {
                        getMaskedStateForPlayer: (sid: string) => unknown;
                        getAvailableActions: (idx: number) => string[];
                        getState: () => { currentPlayerIndex: number; players: Record<number, { sessionId: string; position: number }> };
                    };
                    stateToSend = pokerEngine.getMaskedStateForPlayer(sessionId);

                    // Find the player's position to get their available actions
                    const state = pokerEngine.getState();
                    const playerEntry = Object.values(state.players).find(p => p.sessionId === sessionId);
                    if (playerEntry) {
                        availableActions = pokerEngine.getAvailableActions(playerEntry.position);
                    }
                } else {
                    stateToSend = engine.getState();
                }

                socket.emit(SOCKET_EVENTS.GAME_STATE, {
                    state: stateToSend,
                    availableActions,
                    reconnected: true, // Flag to indicate this is a reconnection
                });

                console.log(`🔄 ${username} reconnected to in-progress game in room ${code}`);
            }
        }

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

    private handleChatJoin(socket: Socket): void {
        const { roomCode } = this.getSocketData(socket);
        if (!roomCode) return;

        // Send chat history to the socket
        const history = chatHistory.get(roomCode) || [];
        socket.emit('chat:history', history);
    }

    private handleChatSend(socket: Socket, payload: { roomCode: string; message: string }): void {
        const { sessionId, username } = this.getSocketData(socket);
        const { roomCode, message } = payload;
        const code = roomCode.toUpperCase();

        if (!sessionId || !username) {
            this.emitError(socket, 'Not authenticated');
            return;
        }

        const trimmedMessage = message.trim();
        if (!trimmedMessage || trimmedMessage.length > 200) {
            return; // Silently ignore empty or too long messages
        }

        // Create message
        const chatMessage: ChatMessage = {
            id: `${Date.now()}-${sessionId.substring(0, 8)}`,
            roomCode: code,
            sessionId,
            username,
            message: trimmedMessage,
            timestamp: Date.now(),
        };

        // Store in history (keep last 50)
        if (!chatHistory.has(code)) {
            chatHistory.set(code, []);
        }
        const history = chatHistory.get(code)!;
        history.push(chatMessage);
        if (history.length > MAX_CHAT_HISTORY) {
            history.shift(); // Remove oldest
        }

        // Broadcast to all in room
        this.emitToRoom(code, 'chat:message', chatMessage);
    }
}

