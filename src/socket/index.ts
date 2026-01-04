/**
 * Socket.io Server Initialization
 * Main entry point for socket server setup
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { socketManager } from './SocketManager';
import { RoomHandler, LudoHandler } from './handlers';
import { PokerHandler } from './handlers/games/PokerHandler';
import { featureFlags } from '../config/featureFlags';
import { SOCKET_EVENTS } from './events';

/**
 * Initialize Socket.io server with all handlers
 */
export const initializeSocket = (httpServer: HttpServer): SocketServer => {
    // Initialize the socket manager
    const io = socketManager.initialize(httpServer);

    // Handle new connections
    io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
        console.log(`🎮 Player connected: ${socket.id}`);

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

    // Poker game events
    if (featureFlags.ENABLE_POKER) {
        const pokerHandler = new PokerHandler();
        pokerHandler.register(socket);
    }

    // Add more game handlers here as needed:
    // const chessHandler = new ChessHandler();
    // chessHandler.register(socket);
}

// Re-export for convenience
export { socketManager } from './SocketManager';
export { SOCKET_EVENTS } from './events';
export * from './types';
