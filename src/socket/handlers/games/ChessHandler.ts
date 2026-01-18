import { Socket } from "socket.io";
import { BaseHandler } from "../BaseHandler";
import { gameStore } from "../../../services/gameStore";
import { SOCKET_EVENTS } from "../../events";
import { GameStartPayload } from "../../types";
import { ChessEngine } from "../../../games/chess/ChessEngine";
import Room from "../../../models/Room";

export class ChessHandler extends BaseHandler {
    register(socket: Socket): void {
        // Game start
        socket.on(
            SOCKET_EVENTS.GAME_START,
            this.wrapHandler(socket, SOCKET_EVENTS.GAME_START, (payload: GameStartPayload) =>
                this.handleGameStart(socket, payload)
            )
        );

        // Game actions (move, offerDraw, acceptDraw, etc.)
        socket.on(
            "game:action",
            this.wrapHandler(socket, "game:action", ({ roomCode, action, payload }) => {
                const code = roomCode?.toUpperCase();
                console.log(`🎯 Chess action received: ${action}`, { roomCode: code, payload });

                const game = gameStore.getGame(code);
                if (!game) {
                    console.log(`❌ No game found for room ${code}`);
                    return;
                }
                if (game.getGameType() !== "chess") {
                    console.log(`❌ Game is not chess: ${game.getGameType()}`);
                    return;
                }

                const { sessionId, username } = this.getSocketData(socket);
                console.log(`👤 Session ID: ${sessionId}`);
                console.log(`🎮 Game players:`, game.getPlayers());
                console.log(`🎨 Player colors:`, (game as ChessEngine).getState().playerColors);

                if (!sessionId) {
                    this.emitError(socket, "Session not found");
                    return;
                }

                // Handle special actions that need specific events
                if (action === "offerDraw") {
                    this.emitToRoom(code, "game:drawOffer", {
                        from: sessionId,
                        username: payload?.username || username || "Opponent"
                    });
                    return;
                }

                if (action === "acceptDraw") {
                    const newState = game.handleAction(sessionId, action, payload);
                    this.emitToRoom(code, "game:drawAccepted", {});
                    this.emitToRoom(code, "game:state", { state: newState });
                    if (game.isGameOver()) {
                        this.emitToRoom(code, "game:winner", { state: newState });
                    }
                    return;
                }

                if (action === "rejectDraw") {
                    game.handleAction(sessionId, action, payload);
                    this.emitToRoom(code, "game:drawRejected", {});
                    return;
                }

                if (action === "abort") {
                    const newState = game.handleAction(sessionId, action, payload);
                    this.emitToRoom(code, "game:aborted", {
                        by: username || "Player",
                        state: newState
                    });
                    this.emitToRoom(code, "game:state", { state: newState });
                    return;
                }

                if (action === "resign") {
                    const newState = game.handleAction(sessionId, action, payload);
                    this.emitToRoom(code, "game:resigned", {
                        by: username || "Player",
                        state: newState
                    });
                    this.emitToRoom(code, "game:state", { state: newState });
                    if (game.isGameOver()) {
                        this.emitToRoom(code, "game:winner", { state: newState });
                    }
                    return;
                }

                if (action === "offerRematch") {
                    this.emitToRoom(code, "game:rematchOffer", {
                        from: sessionId,
                        username: payload?.username || username || "Opponent"
                    });
                    return;
                }

                if (action === "acceptRematch") {
                    // Reset the game engine for a new game
                    const engine = game as ChessEngine;
                    engine.resetGame();
                    const newState = engine.getState();
                    this.emitToRoom(code, "game:rematchAccepted", {});
                    this.emitToRoom(code, "game:state", { state: newState });
                    this.emitToRoom(code, "game:start", {
                        state: newState,
                        players: engine.getPlayers(),
                    });
                    return;
                }

                if (action === "rejectRematch") {
                    this.emitToRoom(code, "game:rematchRejected", {});
                    return;
                }

                // Normal move handling
                const stateBefore = JSON.stringify(game.getState());
                const newState = game.handleAction(
                    sessionId,
                    action,
                    payload
                );
                const stateAfter = JSON.stringify(newState);

                console.log(`📊 State changed: ${stateBefore !== stateAfter}`);

                this.emitToRoom(code, "game:state", { state: newState });

                if (game.isGameOver()) {
                    this.emitToRoom(code, "game:winner", { state: newState });
                }
            })
        );
    }

    private async handleGameStart(socket: Socket, payload: GameStartPayload): Promise<void> {
        const code = payload.roomCode.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room) {
            this.emitError(socket, 'Room not found');
            return;
        }

        // Only handle chess rooms
        if (room.gameType !== 'chess') {
            return; // Let other handlers deal with it
        }

        // Get or create engine
        let engine = gameStore.getGame(code) as ChessEngine | undefined;

        // Check if game already started (has players)
        if (engine && engine.getPlayers().length > 0) {
            console.log(`♟️ Game already started in room ${code}`);
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

        // Create game engine if it doesn't exist
        if (!engine) {
            engine = gameStore.createGame('chess', code) as ChessEngine;
        }

        room.players.forEach(p => {
            engine.addPlayer({
                sessionId: p.sessionId,
                username: p.username,
                position: p.position,
            });
        });

        // Initialize game
        engine.onGameStart();

        // Update room status
        room.status = 'playing';
        room.gameState = engine.getState() as unknown as Record<string, unknown>;
        await room.save();

        // Emit game start to all players
        this.emitToRoom(code, SOCKET_EVENTS.GAME_START, {
            state: engine.getState(),
            players: engine.getPlayers(),
            timeControl: payload.timeControl || 3, // Default 3 min if not specified
        });

        console.log(`♟️ Chess game started in room ${code}`);
    }
}

