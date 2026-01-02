/**
 * Payload Validation Utilities
 * 
 * Basic validation for socket event payloads.
 * Prevents malformed data from reaching game engines.
 * 
 * Future: Replace with Zod or Joi for production validation
 */

import {
    JoinRoomPayload,
    GameStartPayload,
    GameActionPayload
} from '../socket/types';

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate room code format
 * Must be 4-8 alphanumeric characters
 */
export function validateRoomCode(roomCode: unknown): ValidationResult {
    if (typeof roomCode !== 'string') {
        return { valid: false, error: 'Room code must be a string' };
    }

    if (roomCode.length < 4 || roomCode.length > 8) {
        return { valid: false, error: 'Room code must be 4-8 characters' };
    }

    if (!/^[A-Z0-9]+$/i.test(roomCode)) {
        return { valid: false, error: 'Room code must be alphanumeric' };
    }

    return { valid: true };
}

/**
 * Validate session ID format
 * Must be non-empty string
 */
export function validateSessionId(sessionId: unknown): ValidationResult {
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
        return { valid: false, error: 'Session ID must be a non-empty string' };
    }

    return { valid: true };
}

/**
 * Validate username
 * Must be 1-20 characters, printable
 */
export function validateUsername(username: unknown): ValidationResult {
    if (typeof username !== 'string') {
        return { valid: false, error: 'Username must be a string' };
    }

    const trimmed = username.trim();
    if (trimmed.length < 1 || trimmed.length > 20) {
        return { valid: false, error: 'Username must be 1-20 characters' };
    }

    return { valid: true };
}

/**
 * Validate JoinRoomPayload
 */
export function validateJoinRoomPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Payload must be an object' };
    }

    const p = payload as Partial<JoinRoomPayload>;

    const roomCheck = validateRoomCode(p.roomCode);
    if (!roomCheck.valid) return roomCheck;

    const sessionCheck = validateSessionId(p.sessionId);
    if (!sessionCheck.valid) return sessionCheck;

    const usernameCheck = validateUsername(p.username);
    if (!usernameCheck.valid) return usernameCheck;

    return { valid: true };
}

/**
 * Validate GameStartPayload
 */
export function validateGameStartPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Payload must be an object' };
    }

    const p = payload as Partial<GameStartPayload>;

    return validateRoomCode(p.roomCode);
}

/**
 * Validate GameActionPayload
 */
export function validateGameActionPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Payload must be an object' };
    }

    const p = payload as Partial<GameActionPayload>;

    const roomCheck = validateRoomCode(p.roomCode);
    if (!roomCheck.valid) return roomCheck;

    if (p.action !== 'roll' && p.action !== 'move') {
        return { valid: false, error: 'Action must be "roll" or "move"' };
    }

    if (p.action === 'move') {
        if (!p.data || typeof p.data.tokenIndex !== 'number') {
            return { valid: false, error: 'Move action requires tokenIndex' };
        }

        if (p.data.tokenIndex < 0 || p.data.tokenIndex > 3) {
            return { valid: false, error: 'Token index must be 0-3' };
        }
    }

    return { valid: true };
}

/**
 * Create validation middleware wrapper
 * Usage: wrapWithValidation(validator, handler)
 */
export function createValidationWrapper<T>(
    validator: (payload: unknown) => ValidationResult,
    onError: (error: string) => void
): (payload: T, handler: (payload: T) => void) => void {
    return (payload: T, handler: (payload: T) => void) => {
        const result = validator(payload);
        if (!result.valid) {
            onError(result.error || 'Validation failed');
            return;
        }
        handler(payload);
    };
}
