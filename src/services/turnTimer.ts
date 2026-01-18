/**
 * Turn Timer Service
 * 
 * Manages turn timeouts for games to handle disconnected players.
 * When a player disconnects and it's their turn, a timer is started.
 * If they don't reconnect and take their turn before the timer expires,
 * the game auto-plays for them (or skips their turn).
 */

import { socketManager } from '../socket/SocketManager';
import { SOCKET_EVENTS } from '../socket/events';
import { gameStore } from './gameStore';
import { GameEngine } from '../games/base/GameEngine';
import Room from '../models/Room';

// Timeout duration in milliseconds (15 seconds)
export const TURN_TIMEOUT_MS = 15000;

// Interval for sending countdown updates (every second)
const COUNTDOWN_INTERVAL_MS = 1000;

// Maximum number of consecutive auto-plays before a player is eliminated
export const MAX_AUTO_PLAYS = 3;

interface TurnTimerEntry {
  roomCode: string;
  playerIndex: number;
  sessionId: string;
  startedAt: number;
  timeoutId: NodeJS.Timeout;
  countdownIntervalId: NodeJS.Timeout;
}

class TurnTimerService {
  private static instance: TurnTimerService;
  private activeTimers: Map<string, TurnTimerEntry> = new Map();

  // Track auto-play counts per player per room: Map<roomCode, Map<playerIndex, count>>
  private autoPlayCounts: Map<string, Map<number, number>> = new Map();

  private constructor() { }

  static getInstance(): TurnTimerService {
    if (!TurnTimerService.instance) {
      TurnTimerService.instance = new TurnTimerService();
    }
    return TurnTimerService.instance;
  }

  /**
   * Start a turn timer for a disconnected player
   */
  startTimer(roomCode: string, playerIndex: number, sessionId: string): void {
    const normalizedCode = roomCode.toUpperCase();

    // Clear any existing timer for this room
    this.clearTimer(normalizedCode);

    const startedAt = Date.now();

    // Start countdown interval to notify clients
    const countdownIntervalId = setInterval(() => {
      const remaining = Math.max(0, TURN_TIMEOUT_MS - (Date.now() - startedAt));
      const secondsRemaining = Math.ceil(remaining / 1000);

      socketManager.emitToRoom(normalizedCode, SOCKET_EVENTS.TURN_TIMEOUT_WARNING, {
        playerIndex,
        sessionId,
        secondsRemaining,
        isDisconnected: true,
      });

      if (remaining <= 0) {
        clearInterval(countdownIntervalId);
      }
    }, COUNTDOWN_INTERVAL_MS);

    // Set the actual timeout
    const timeoutId = setTimeout(async () => {
      await this.handleTimeout(normalizedCode);
    }, TURN_TIMEOUT_MS);

    const entry: TurnTimerEntry = {
      roomCode: normalizedCode,
      playerIndex,
      sessionId,
      startedAt,
      timeoutId,
      countdownIntervalId,
    };

    this.activeTimers.set(normalizedCode, entry);

    console.log(`⏱️ Turn timer started for player ${playerIndex} in room ${normalizedCode}`);

    // Immediately notify clients about the timer start
    socketManager.emitToRoom(normalizedCode, SOCKET_EVENTS.TURN_TIMEOUT_WARNING, {
      playerIndex,
      sessionId,
      secondsRemaining: Math.ceil(TURN_TIMEOUT_MS / 1000),
      isDisconnected: true,
    });
  }

  /**
   * Clear the timer for a room (e.g., when player reconnects or takes turn)
   */
  clearTimer(roomCode: string): void {
    const normalizedCode = roomCode.toUpperCase();
    const entry = this.activeTimers.get(normalizedCode);

    if (entry) {
      clearTimeout(entry.timeoutId);
      clearInterval(entry.countdownIntervalId);
      this.activeTimers.delete(normalizedCode);

      // Notify clients that timer is cleared
      socketManager.emitToRoom(normalizedCode, SOCKET_EVENTS.TURN_TIMEOUT_CLEARED, {
        playerIndex: entry.playerIndex,
        sessionId: entry.sessionId,
      });

      console.log(`⏱️ Turn timer cleared for room ${normalizedCode}`);
    }
  }

  /**
   * Handle turn timeout - auto-play for disconnected player
   */
  private async handleTimeout(roomCode: string): Promise<void> {
    const entry = this.activeTimers.get(roomCode);
    if (!entry) return;

    // Clear the timer first
    this.activeTimers.delete(roomCode);
    clearInterval(entry.countdownIntervalId);

    console.log(`⏱️ Turn timeout for player ${entry.playerIndex} in room ${roomCode}`);

    const engine = gameStore.getGame(roomCode);
    if (!engine) {
      console.log(`⏱️ No game found for room ${roomCode}, skipping timeout handling`);
      return;
    }

    // Only handle auto-play for games that support it (Ludo, Snake-Ladder, Poker, Monopoly)
    // Tic Tac Toe, Sudoku, etc don't use auto-play timeouts
    const gameType = engine.getGameType();
    const NO_TIMER_GAMES = ['tictactoe', 'sudoku', '2048', 'memory', 'candy-chakachak', 'chess'];

    if (NO_TIMER_GAMES.includes(gameType)) {
      console.log(`⏱️ Skipping auto-play for ${gameType} game in room ${roomCode}`);
      return;
    }

    // Check if game is still in progress
    if (engine.isGameOver()) {
      return;
    }

    const currentPlayerIdx = engine.getCurrentPlayerIndex();

    // Verify it's still this player's turn
    if (currentPlayerIdx !== entry.playerIndex) {
      console.log(`⏱️ Player ${entry.playerIndex} is no longer current player, skipping`);
      return;
    }

    try {
      // Check auto-play count for this player
      const autoPlayCount = this.getAutoPlayCount(roomCode, entry.playerIndex);

      if (autoPlayCount >= MAX_AUTO_PLAYS) {
        // Player has exceeded max auto-plays, eliminate them
        console.log(`⏱️ Player ${entry.playerIndex} exceeded max auto-plays (${MAX_AUTO_PLAYS}), eliminating from game`);

        // Mark player as eliminated in the engine
        engine.eliminatePlayer(entry.playerIndex);

        const newState = engine.getState();

        // Emit the updated state to all clients
        socketManager.emitToRoom(roomCode, SOCKET_EVENTS.GAME_STATE, {
          state: newState,
          lastAction: {
            action: 'player_eliminated',
            by: entry.sessionId,
            data: { reason: 'max_auto_plays_exceeded' }
          },
        });

        // Notify clients that player was eliminated
        socketManager.emitToRoom(roomCode, SOCKET_EVENTS.TURN_AUTO_PLAYED, {
          playerIndex: entry.playerIndex,
          sessionId: entry.sessionId,
          reason: 'eliminated',
          autoPlayCount: autoPlayCount,
          maxAutoPlays: MAX_AUTO_PLAYS,
        });

        // Update room game state in database
        await Room.updateOne(
          { code: roomCode },
          { gameState: newState, currentTurn: engine.getCurrentPlayerIndex() }
        );

        // Check if game is over after elimination
        if (engine.isGameOver()) {
          await this.handleGameOver(roomCode, engine);
        } else {
          // Check if the new current player is also disconnected
          await this.checkCurrentPlayerConnection(roomCode);
        }

        return;
      }

      // Increment auto-play count
      this.incrementAutoPlayCount(roomCode, entry.playerIndex);
      const newAutoPlayCount = this.getAutoPlayCount(roomCode, entry.playerIndex);

      // Auto-play for the disconnected player
      const newState = engine.autoPlay(entry.playerIndex);

      // Emit the updated state to all clients
      socketManager.emitToRoom(roomCode, SOCKET_EVENTS.GAME_STATE, {
        state: newState,
        lastAction: {
          action: 'auto_play',
          by: entry.sessionId,
          data: { reason: 'timeout' }
        },
        autoPlayed: true,
      });

      // Notify clients that auto-play occurred
      socketManager.emitToRoom(roomCode, SOCKET_EVENTS.TURN_AUTO_PLAYED, {
        playerIndex: entry.playerIndex,
        sessionId: entry.sessionId,
        reason: 'timeout',
        autoPlayCount: newAutoPlayCount,
        maxAutoPlays: MAX_AUTO_PLAYS,
      });

      // Update room game state in database
      await Room.updateOne(
        { code: roomCode },
        { gameState: newState, currentTurn: engine.getCurrentPlayerIndex() }
      );

      console.log(`⏱️ Auto-played for player ${entry.playerIndex} in room ${roomCode} (${newAutoPlayCount}/${MAX_AUTO_PLAYS})`);

      // Check if game is over after auto-play
      if (engine.isGameOver()) {
        await this.handleGameOver(roomCode, engine);
      } else {
        // Check if the new current player is also disconnected
        await this.checkCurrentPlayerConnection(roomCode);
      }
    } catch (error) {
      console.error(`⏱️ Error during auto-play for room ${roomCode}:`, error);
    }
  }

  /**
   * Handle game over after auto-play
   */
  private async handleGameOver(roomCode: string, engine: GameEngine): Promise<void> {
    const state = engine.getState() as any; // Cast to any to access finishedPlayers if available
    const players = engine.getPlayers();
    const leaderboard: Array<{ position: number, username: string, sessionId: string, rank: number }> = [];

    // Add finished players (Ludo conceptual logic, applicable if game has it)
    if (state.finishedPlayers) {
      state.finishedPlayers.forEach((playerIndex: number, idx: number) => {
        const p = players.find(pl => pl.position === playerIndex) || players[playerIndex];
        if (p) {
          leaderboard.push({
            position: playerIndex,
            username: p.username,
            sessionId: p.sessionId,
            rank: idx + 1,
          });
        }
      });
    }

    // Determine winner purely from engine if leaderboard is empty
    const winnerIdx = engine.getWinner();

    // Fallback leaderboard generation
    players.forEach((p, idx) => {
      const pIndex = p.position !== undefined ? p.position : idx;
      if (!leaderboard.some(l => l.position === pIndex)) {
        leaderboard.push({
          position: pIndex,
          username: p.username,
          sessionId: p.sessionId,
          rank: winnerIdx === pIndex ? 1 : leaderboard.length + 1
        });
      }
    });

    // Sort logic handled by specific games usually, but here we just ensure we have something

    await Room.updateOne({ code: roomCode }, { status: 'finished' });
    gameStore.deleteGame(roomCode);

    socketManager.emitToRoom(roomCode, SOCKET_EVENTS.GAME_WINNER, {
      winner: leaderboard.find(l => l.rank === 1) || leaderboard[0],
      leaderboard,
    });

    console.log(`🏆 Game finished in room ${roomCode} (via timeout). Winner: ${leaderboard[0]?.username}`);
  }

  /**
   * Check if the current player is connected, start timer if not
   */
  async checkCurrentPlayerConnection(roomCode: string): Promise<void> {
    const normalizedCode = roomCode.toUpperCase();

    const engine = gameStore.getGame(normalizedCode);
    if (!engine || engine.isGameOver()) return;

    // Skip turn timer for games that don't support it or are single-player
    const gameType = engine.getGameType();
    const NO_TIMER_GAMES = ['tictactoe', 'sudoku', '2048', 'memory', 'candy-chakachak', 'chess'];

    if (NO_TIMER_GAMES.includes(gameType)) {
      return;
    }

    const currentPlayerIndex = engine.getCurrentPlayerIndex();
    const players = engine.getPlayers();

    // Need to find player object. 
    // In Ludo: players is array, index matches.
    // In Poker: players is array, but position property matters.
    const currentPlayer = players.find(p => p.position === currentPlayerIndex) || players[currentPlayerIndex];

    if (!currentPlayer) return;

    // Check if this player is connected in the room
    const room = await Room.findOne({ code: normalizedCode });
    if (!room) return;

    const roomPlayer = room.players.find(p => p.sessionId === currentPlayer.sessionId);

    if (roomPlayer && !roomPlayer.isConnected) {
      // Player is disconnected, start timer
      this.startTimer(normalizedCode, currentPlayerIndex, currentPlayer.sessionId);
    }
  }

  /**
   * Called when a player reconnects - clear their timer if active
   */
  onPlayerReconnected(roomCode: string, sessionId: string): void {
    const normalizedCode = roomCode.toUpperCase();
    const entry = this.activeTimers.get(normalizedCode);

    if (entry && entry.sessionId === sessionId) {
      this.clearTimer(normalizedCode);
      console.log(`⏱️ Timer cleared - player ${sessionId} reconnected to room ${normalizedCode}`);
    }
  }

  /**
   * Called when a turn is successfully taken - clear any active timer and reset auto-play count
   */
  onTurnTaken(roomCode: string, playerIndex?: number): void {
    const normalizedCode = roomCode.toUpperCase();
    this.clearTimer(normalizedCode);

    // Reset auto-play count for this player since they took a manual action
    if (playerIndex !== undefined) {
      this.resetAutoPlayCount(normalizedCode, playerIndex);
    }
  }

  /**
   * Check if there's an active timer for a room
   */
  hasActiveTimer(roomCode: string): boolean {
    return this.activeTimers.has(roomCode.toUpperCase());
  }

  /**
   * Get remaining time for a room's timer
   */
  getRemainingTime(roomCode: string): number | null {
    const entry = this.activeTimers.get(roomCode.toUpperCase());
    if (!entry) return null;

    const elapsed = Date.now() - entry.startedAt;
    return Math.max(0, TURN_TIMEOUT_MS - elapsed);
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTO-PLAY COUNT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get the auto-play count for a player in a room
   */
  private getAutoPlayCount(roomCode: string, playerIndex: number): number {
    const roomCounts = this.autoPlayCounts.get(roomCode);
    if (!roomCounts) return 0;
    return roomCounts.get(playerIndex) || 0;
  }

  /**
   * Increment the auto-play count for a player
   */
  private incrementAutoPlayCount(roomCode: string, playerIndex: number): void {
    let roomCounts = this.autoPlayCounts.get(roomCode);
    if (!roomCounts) {
      roomCounts = new Map();
      this.autoPlayCounts.set(roomCode, roomCounts);
    }

    const currentCount = roomCounts.get(playerIndex) || 0;
    roomCounts.set(playerIndex, currentCount + 1);
  }

  /**
   * Reset the auto-play count for a player (when they take a manual action or reconnect)
   */
  resetAutoPlayCount(roomCode: string, playerIndex: number): void {
    const normalizedCode = roomCode.toUpperCase();
    const roomCounts = this.autoPlayCounts.get(normalizedCode);
    if (roomCounts) {
      roomCounts.set(playerIndex, 0);
      console.log(`⏱️ Reset auto-play count for player ${playerIndex} in room ${normalizedCode}`);
    }
  }

  /**
   * Clean up auto-play counts for a room (when game ends)
   */
  cleanupRoom(roomCode: string): void {
    const normalizedCode = roomCode.toUpperCase();
    this.autoPlayCounts.delete(normalizedCode);
    this.clearTimer(normalizedCode);
  }
}

// Export singleton instance
export const turnTimer = TurnTimerService.getInstance();
export default turnTimer;
