/**
 * Base Handler
 * Abstract base class for socket event handlers
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { socketManager } from '../SocketManager';
import { withErrorHandling, logSocketEvent } from '../middleware';
import { SOCKET_EVENTS } from '../events';

export abstract class BaseHandler {
    protected io: SocketServer;

    constructor() {
        this.io = socketManager.getIO();
    }

    /**
     * Register event handlers on a socket
     */
    abstract register(socket: Socket): void;

    /**
     * Helper to wrap handler with error handling
     */
    protected wrapHandler<T>(
        socket: Socket,
        eventName: string,
        handler: (payload: T) => Promise<void> | void
    ): (payload: T) => Promise<void> {
        return withErrorHandling(socket, async (payload: T) => {
            logSocketEvent(eventName, socket.id, payload);
            await handler(payload);
        });
    }

    /**
     * Emit an error to a socket
     */
    protected emitError(socket: Socket, message: string): void {
        socket.emit(SOCKET_EVENTS.ERROR, { message });
    }

    /**
     * Emit to all sockets in a room
     */
    protected emitToRoom(roomCode: string, event: string, data: unknown): void {
        socketManager.emitToRoom(roomCode, event, data);
    }

    /**
     * Get socket data
     */
    protected getSocketData(socket: Socket): {
        roomCode?: string;
        sessionId?: string;
        username?: string;
    } {
        return socket.data || {};
    }
}
