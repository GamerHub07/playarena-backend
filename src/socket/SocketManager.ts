/**
 * Socket Manager
 * Centralized management of socket connections and game engines
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { LudoEngine } from '../games/ludo/LudoEngine';

export type GameEngine = LudoEngine; // Extend with other game engines as needed

interface RoomConnection {
    sockets: Set<string>;
    gameEngine?: GameEngine;
}

class SocketManager {
    private static instance: SocketManager;
    private io: SocketServer | null = null;
    private rooms: Map<string, RoomConnection> = new Map();
    private socketToRoom: Map<string, string> = new Map();

    private constructor() { }

    static getInstance(): SocketManager {
        if (!SocketManager.instance) {
            SocketManager.instance = new SocketManager();
        }
        return SocketManager.instance;
    }

    /**
     * Initialize the Socket.io server
     */
    initialize(httpServer: HttpServer): SocketServer {
        if (this.io) {
            return this.io;
        }

        this.io = new SocketServer(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            // Connection settings for stability
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        console.log('🔌 Socket Manager initialized');
        return this.io;
    }

    /**
     * Get the Socket.io server instance
     */
    getIO(): SocketServer {
        if (!this.io) {
            throw new Error('SocketManager not initialized. Call initialize() first.');
        }
        return this.io;
    }

    /**
     * Add a socket to a room
     */
    joinRoom(socket: Socket, roomCode: string): void {
        const normalizedCode = roomCode.toUpperCase();

        // Leave any existing room
        const existingRoom = this.socketToRoom.get(socket.id);
        if (existingRoom) {
            this.leaveRoom(socket);
        }

        // Join the socket to the room
        socket.join(normalizedCode);
        this.socketToRoom.set(socket.id, normalizedCode);

        // Track room connections
        let roomConnection = this.rooms.get(normalizedCode);
        if (!roomConnection) {
            roomConnection = { sockets: new Set() };
            this.rooms.set(normalizedCode, roomConnection);
        }
        roomConnection.sockets.add(socket.id);

        console.log(`📥 Socket ${socket.id} joined room ${normalizedCode}`);
    }

    /**
     * Remove a socket from its room
     */
    leaveRoom(socket: Socket): string | undefined {
        const roomCode = this.socketToRoom.get(socket.id);
        if (!roomCode) return undefined;

        socket.leave(roomCode);
        this.socketToRoom.delete(socket.id);

        const roomConnection = this.rooms.get(roomCode);
        if (roomConnection) {
            roomConnection.sockets.delete(socket.id);

            // Clean up empty rooms (but keep game engine if game is in progress)
            if (roomConnection.sockets.size === 0 && !roomConnection.gameEngine) {
                this.rooms.delete(roomCode);
                console.log(`🗑️ Room ${roomCode} cleaned up (empty)`);
            }
        }

        console.log(`📤 Socket ${socket.id} left room ${roomCode}`);
        return roomCode;
    }

    /**
     * Get or create game engine for a room
     */
    setGameEngine(roomCode: string, engine: GameEngine): void {
        const normalizedCode = roomCode.toUpperCase();
        let roomConnection = this.rooms.get(normalizedCode);

        if (!roomConnection) {
            roomConnection = { sockets: new Set() };
            this.rooms.set(normalizedCode, roomConnection);
        }

        roomConnection.gameEngine = engine;
        console.log(`🎮 Game engine set for room ${normalizedCode}`);
    }

    /**
     * Get game engine for a room
     */
    getGameEngine(roomCode: string): GameEngine | undefined {
        const normalizedCode = roomCode.toUpperCase();
        return this.rooms.get(normalizedCode)?.gameEngine;
    }

    /**
     * Remove game engine from a room
     */
    removeGameEngine(roomCode: string): void {
        const normalizedCode = roomCode.toUpperCase();
        const roomConnection = this.rooms.get(normalizedCode);
        if (roomConnection) {
            roomConnection.gameEngine = undefined;
            console.log(`🗑️ Game engine removed for room ${normalizedCode}`);
        }
    }

    /**
     * Get the room code for a socket
     */
    getSocketRoom(socketId: string): string | undefined {
        return this.socketToRoom.get(socketId);
    }

    /**
     * Emit to all sockets in a room
     */
    emitToRoom(roomCode: string, event: string, data: unknown): void {
        const normalizedCode = roomCode.toUpperCase();
        this.io?.to(normalizedCode).emit(event, data);
    }

    /**
     * Get number of connections in a room
     */
    getRoomSize(roomCode: string): number {
        const normalizedCode = roomCode.toUpperCase();
        return this.rooms.get(normalizedCode)?.sockets.size || 0;
    }
}

// Export singleton instance
export const socketManager = SocketManager.getInstance();
export default socketManager;
