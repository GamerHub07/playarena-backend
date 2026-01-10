/**
 * Socket Error Handler Middleware
 * Wraps socket event handlers with error handling
 */

import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../events';

/**
 * Wraps a socket event handler with error handling
 */
export function withErrorHandling<T>(
    socket: Socket,
    handler: (payload: T) => Promise<void> | void
): (payload: T) => Promise<void> {
    return async (payload: T) => {
        try {
            await handler(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unexpected error occurred';
            console.error(`[Socket Error] ${socket.id}:`, error);
            socket.emit(SOCKET_EVENTS.ERROR, { message });
        }
    };
}

/**
 * Logs socket events for debugging
 */
export function logSocketEvent(eventName: string, socketId: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Socket ${socketId}] ${eventName}`, data ? JSON.stringify(data).slice(0, 100) : '');
}
