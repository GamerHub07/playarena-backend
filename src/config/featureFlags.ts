/**
 * Feature Flags Configuration
 * 
 * Enable features via environment variables for gradual rollout.
 * Usage: if (featureFlags.DEBUG_SOCKET_EVENTS) { ... }
 */

export interface FeatureFlags {
    /**
     * Enable unified game router
     * When true: Routes game actions through central router
     * When false: Direct handler routing
     */
    USE_GAME_ROUTER: boolean;

    /**
     * Use standardized room naming: game:{gameType}:{matchId}
     * When true: Uses new naming convention
     * When false: Uses legacy room codes only
     */
    USE_STANDARD_ROOM_NAMES: boolean;

    /**
     * Enable debug logging for socket events
     * WARNING: Verbose - disable in production
     */
    DEBUG_SOCKET_EVENTS: boolean;

    /**
     * Enable Poker game
     * When true: Poker handler is registered
     * When false: Poker game is disabled
     */
    ENABLE_POKER: boolean;
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
}

/**
 * Feature flags with safe defaults
 */
export const featureFlags: FeatureFlags = {
    USE_GAME_ROUTER: parseBoolean(process.env.USE_GAME_ROUTER, false),
    USE_STANDARD_ROOM_NAMES: parseBoolean(process.env.USE_STANDARD_ROOM_NAMES, false),
    DEBUG_SOCKET_EVENTS: parseBoolean(process.env.DEBUG_SOCKET_EVENTS, false),
    ENABLE_POKER: parseBoolean(process.env.ENABLE_POKER, true),
};

/**
 * Log current feature flag status on startup
 */
export function logFeatureFlags(): void {
    console.log('🚩 Feature Flags:');
    Object.entries(featureFlags).forEach(([key, value]) => {
        const status = value ? '✅ ENABLED' : '⬜ disabled';
        console.log(`   ${key}: ${status}`);
    });
}

export default featureFlags;
