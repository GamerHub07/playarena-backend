/**
 * Socket.io Server Initialization
 * Main entry point for socket server setup
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { socketManager } from './SocketManager';
import { RoomHandler, LudoHandler, MonopolyHandler, SnakeLadderHandler } from './handlers';

import { SOCKET_EVENTS } from './events';

/**
 * Initialize Socket.io server with all handlers
 */
export const initializeSocket = (httpServer: HttpServer): SocketServer => {
    // Initialize the socket manager
    const io = socketManager.initialize(httpServer);

    // Middleware for Authentication
    io.use((socket: Socket, next) => {
        const token = socket.handshake.auth.token;

        if (token) {
            try {
                // Verify token (simple verify without database lookup for speed)
                // We assume the token is valid if it verifies against the secret
                // In production, we might want to check if user still exists in DB, 
                // but for socket performance, JWT verification is usually enough.
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
                socket.data.userId = decoded.id;
                console.log(`🔑 Authenticated socket connection for user: ${decoded.id}`);
            } catch (err) {
                console.log('⚠️ Invalid token provided for socket connection');
                // We allow connection even if token is invalid, they just won't be "logged in"
                // Alternatively, we could return next(new Error('Authentication error'));
            }
        }
        next();
    });

    // Handle new connections
    io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
        console.log(`🎮 Player connected: ${socket.id} ${socket.data.userId ? '(Authenticated)' : '(Guest)'}`);

        // Register all handlers for this socket
        registerHandlers(socket);
    });

    console.log('✅ Socket handlers registered');
    return io;
};

/**
 * Register all event handlers on a socket
 */
function registerHandlers(socket: Socket): void {
    // Room events (join, leave, disconnect)
    const roomHandler = new RoomHandler();
    roomHandler.register(socket);

    // Ludo game events
    const ludoHandler = new LudoHandler();
    ludoHandler.register(socket);
    // Snake & Ladder game events
    const snakeLadderHandler = new SnakeLadderHandler();
    snakeLadderHandler.register(socket);
    // Monopoly game events
    const monopolyHandler = new MonopolyHandler();
    monopolyHandler.register(socket);



    // Add more game handlers here as needed:
    // const chessHandler = new ChessHandler();
    // chessHandler.register(socket);
}

// Re-export for convenience
export { socketManager } from './SocketManager';
export { SOCKET_EVENTS } from './events';
export * from './types';
