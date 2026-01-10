/**
 * Ludo Game Handler
 * Handles all Ludo-specific game events including dice rolls, moves, and animations
 */

import { Socket } from 'socket.io';
import { BaseHandler } from '../BaseHandler';
import { SOCKET_EVENTS } from '../../events';
import { GameActionPayload, GameStartPayload, TokenMoveStep } from '../../types';
import { LudoEngine } from '../../../games/ludo/LudoEngine';
import { TokenPosition, PLAYER_START_POSITIONS, PATH_LENGTH, PLAYER_COLORS } from '../../../games/ludo/LudoTypes';
import Room from '../../../models/Room';
import { MAIN_TRACK, HOME_STRETCH, getTokenGridPosition, PLAYER_COLOR_MAP } from '../../../games/ludo/LudoBoardLayout';
import { gameStore } from '../../../services/gameStore';
import { turnTimer } from '../../../services/turnTimer';

export class LudoHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (roll, move)
        socket.on(
            SOCKET_EVENTS.GAME_ACTION,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_ACTION, (payload: GameActionPayload) =>
                this.handleGameAction(socket, payload)
            )
        );
    }

    private async handleGameStart(socket: Socket, payload: GameStartPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        // Only handle Ludo rooms
        if (room.gameType !== 'ludo') {
            return; // Let other handlers deal with it
        }

        // Check if game already exists (prevent duplicate starts)
        if (gameStore.hasGame(code)) {
            return; // Game already started
        }

        if (room.players.length < room.minPlayers) {
            this.emitError(socket, `Need at least ${room.minPlayers} players`);
            return;
        }

        // Check if sender is host
        const senderPlayer = room.players.find(p => p.sessionId === socket.data.sessionId);
        if (!senderPlayer?.isHost) {
            this.emitError(socket, 'Only host can start the game');
            return;
        }

        // Create game engine via GameStore
        const engine = gameStore.createGame('ludo', code) as LudoEngine;

        room.players.forEach(p => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position,
            });
        });

        // Initialize game
        engine.handleAction(socket.data.sessionId, 'init', null);

        // Update room status
        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        // Emit game start to all players
        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: engine.getPlayers(),
        });

        console.log(`🎲 Ludo game started in room ${code}`);
    }

    private async handleGameAction(socket: Socket, payload: GameActionPayload): Promise<void> {
        const { roomCode, action, data } = payload;
        const code = roomCode.toUpperCase();

        // Get game from GameStore
        const engine = gameStore.getGame(code) as LudoEngine | undefined;

        if (!engine) {
            this.emitError(socket, 'Game not found');
            return;
        }

        const sessionId = socket.data.sessionId;
        const stateBefore = JSON.parse(JSON.stringify(engine.getState())); // Deep copy
        const previousPlayer = stateBefore.currentPlayer;

        // Find the player index for this session
        const playerIndex = engine.getPlayers().findIndex(p => p.sessionId === sessionId);

        // Clear any active turn timer and reset auto-play count since a player is taking their turn
        turnTimer.onTurnTaken(code, playerIndex >= 0 ? playerIndex : undefined);

        // Handle the action
        const newState = engine.handleAction(sessionId, action, data);

        // Always emit state update for all actions
        this.emitToRoom(code, SOCKET_EVENTS.GAME_STATE, {
            state: newState,
            lastAction: { action, by: sessionId, data },
        });

        // Additionally, for move actions, emit animation steps
        if (action === 'move' && data?.tokenIndex !== undefined) {
            const moveSteps = this.generateMoveSteps(
                engine,
                stateBefore,
                newState,
                data.tokenIndex
            );

            if (moveSteps.length > 0) {
                // Emit step-by-step animation (clients can optionally animate)
                this.emitToRoom(code, SOCKET_EVENTS.GAME_TOKEN_MOVE, {
                    steps: moveSteps,
                    finalState: newState,
                });
            }
        }

        // Update room game state in database
        await Room.updateOne(
            { code },
            { gameState: newState, currentTurn: newState.currentPlayer }
        );

        // Check for winner
        if (engine.isGameOver()) {
            // Construct leaderboard
            // 1. Players who finished (in order)
            // 2. Remaining players (should be just one loser, or multiple if we stop early)

            const state = engine.getState();
            const players = engine.getPlayers();
            const leaderboard: Array<{ position: number, username: string, sessionId: string, rank: number }> = [];

            // Add finished players
            state.finishedPlayers.forEach((playerIndex, idx) => {
                const p = players[playerIndex];
                leaderboard.push({
                    position: playerIndex,
                    username: p.username,
                    sessionId: p.sessionId,
                    rank: idx + 1 // 1st, 2nd, 3rd...
                });
            });

            // Add remaining players (who didn't finish)
            Object.entries(players).forEach(([idxStr, p]) => {
                const idx = parseInt(idxStr);
                if (!state.finishedPlayers.includes(idx)) {
                    leaderboard.push({
                        position: idx,
                        username: p.username,
                        sessionId: p.sessionId,
                        rank: leaderboard.length + 1 // Last place(s)
                    });
                }
            });

            await Room.updateOne({ code }, { status: 'finished' });

            // Clean up game from store
            gameStore.deleteGame(code);

            this.emitToRoom(code, SOCKET_EVENTS.GAME_WINNER, {
                winner: leaderboard[0], // Keep for backward compatibility if frontend uses it
                leaderboard // Full list
            });

            console.log(`🏆 Game finished in room ${code}. Winner: ${leaderboard[0].username}`);
        } else {
            // Game not over - check if turn changed and if new player is disconnected
            if (newState.currentPlayer !== previousPlayer) {
                // Turn changed, check if new current player is connected
                turnTimer.checkCurrentPlayerConnection(code);
            }
        }
    }

    /**
     * Generate step-by-step animation data for a token move
     */
    private generateMoveSteps(
        engine: LudoEngine,
        stateBefore: ReturnType<LudoEngine['getState']>,
        stateAfter: ReturnType<LudoEngine['getState']>,
        tokenIndex: number
    ): TokenMoveStep[] {
        const steps: TokenMoveStep[] = [];
        const currentPlayer = stateBefore.currentPlayer;
        const playerState = stateBefore.players[currentPlayer];
        const tokenBefore = playerState.tokens[tokenIndex];
        const tokenAfter = stateAfter.players[currentPlayer].tokens[tokenIndex];
        const diceValue = stateBefore.diceValue || 0;
        const color = playerState.color;
        const playerColorKey = PLAYER_COLOR_MAP[currentPlayer];

        if (!playerColorKey) return steps;

        // Handle moving out of home
        if (tokenBefore.zone === 'home' && tokenAfter.zone !== 'home') {
            // Single step: home to start position
            const pos = getTokenGridPosition(currentPlayer, tokenAfter.zone, tokenAfter.index, tokenIndex);
            if (pos) {
                steps.push({
                    playerIndex: currentPlayer,
                    tokenIndex,
                    position: { zone: tokenAfter.zone, index: tokenAfter.index },
                    row: pos.row,
                    col: pos.col,
                    stepNumber: 1,
                    totalSteps: 1,
                });
            }
            return steps;
        }

        // Handle path/safe zone movement
        if ((tokenBefore.zone === 'path' || tokenBefore.zone === 'safe') && tokenAfter.zone !== 'home') {
            const startPos = PLAYER_START_POSITIONS[color];
            const currentPathIndex = tokenBefore.index;

            // Calculate each step
            for (let step = 1; step <= diceValue; step++) {
                let newZone: TokenPosition['zone'] = 'path';
                let newIndex: number;

                const distanceTraveled = (currentPathIndex - startPos + PATH_LENGTH) % PATH_LENGTH;
                const newDistance = distanceTraveled + step;

                if (newDistance >= PATH_LENGTH) {
                    // In home stretch
                    const homeStretchPos = newDistance - PATH_LENGTH;
                    if (homeStretchPos >= 5) {
                        newZone = 'finish';
                        newIndex = 0;
                    } else {
                        newZone = 'safe';
                        newIndex = homeStretchPos;
                    }
                } else {
                    newZone = 'path';
                    newIndex = (currentPathIndex + step) % PATH_LENGTH;
                }

                const pos = getTokenGridPosition(currentPlayer, newZone, newIndex, tokenIndex);
                if (pos) {
                    const isFinalStep = step === diceValue;
                    const capturedList = isFinalStep ? this.wasTokenCaptured(stateBefore, stateAfter, currentPlayer) : [];

                    steps.push({
                        playerIndex: currentPlayer,
                        tokenIndex,
                        position: { zone: newZone, index: newIndex },
                        row: pos.row,
                        col: pos.col,
                        stepNumber: step,
                        totalSteps: diceValue,
                        // @ts-ignore - extending type dynamically
                        capturedTokens: capturedList.length > 0 ? capturedList : undefined,
                        captured: capturedList.length > 0,
                    });
                }
            }
        }

        return steps;
    }

    /**
     * Check if a token was captured in this move
     */
    private wasTokenCaptured(
        stateBefore: ReturnType<LudoEngine['getState']>,
        stateAfter: ReturnType<LudoEngine['getState']>,
        movingPlayer: number
    ): { playerIndex: number; tokenIndex: number }[] {
        const captured: { playerIndex: number; tokenIndex: number }[] = [];

        // Check if any opponent token went back to home
        for (const [idx, playerState] of Object.entries(stateAfter.players)) {
            const playerIdx = parseInt(idx);
            if (playerIdx === movingPlayer) continue;

            const beforeState = stateBefore.players[playerIdx];
            for (let i = 0; i < playerState.tokens.length; i++) {
                if (
                    beforeState.tokens[i].zone !== 'home' &&
                    playerState.tokens[i].zone === 'home'
                ) {
                    captured.push({ playerIndex: playerIdx, tokenIndex: i });
                }
            }
        }
        return captured;
    }
}
