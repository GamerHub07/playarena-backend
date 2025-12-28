import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import Room from '../models/Room';
import { LudoEngine } from '../games/ludo/LudoEngine';

// Store active game engines
const gameEngines = new Map<string, LudoEngine>();

interface JoinRoomPayload {
    roomCode: string;
    sessionId: string;
    username: string;
}

interface GameActionPayload {
    roomCode: string;
    action: string;
    data?: unknown;
}

export const initializeSocket = (httpServer: HttpServer): SocketServer => {
    const io = new SocketServer(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.on('connection', (socket: Socket) => {
        console.log(`🎮 Player connected: ${socket.id}`);

        // Join room
        socket.on('room:join', async (payload: JoinRoomPayload) => {
            try {
                const { roomCode, sessionId, username } = payload;
                const code = roomCode.toUpperCase();

                const room = await Room.findOne({ code });
                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                // Join socket room
                socket.join(code);
                socket.data.roomCode = code;
                socket.data.sessionId = sessionId;
                socket.data.username = username;

                // Update player connection status
                const player = room.players.find(p => p.sessionId === sessionId);
                if (player) {
                    player.isConnected = true;
                    await room.save();
                }

                // Emit room update to all players
                io.to(code).emit('room:update', {
                    players: room.players,
                    status: room.status,
                });

                console.log(`👤 ${username} joined room ${code}`);
            } catch (error) {
                console.error('Join room error:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        // Start game
        socket.on('game:start', async (payload: { roomCode: string }) => {
            try {
                const code = payload.roomCode.toUpperCase();
                const room = await Room.findOne({ code });

                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                if (room.players.length < room.minPlayers) {
                    socket.emit('error', { message: `Need at least ${room.minPlayers} players` });
                    return;
                }

                // Check if sender is host
                const senderPlayer = room.players.find(p => p.sessionId === socket.data.sessionId);
                if (!senderPlayer?.isHost) {
                    socket.emit('error', { message: 'Only host can start the game' });
                    return;
                }

                // Create game engine
                const engine = new LudoEngine(code);
                room.players.forEach(p => {
                    engine.addPlayer({
                        sessionId: p.sessionId,
                        username: p.username,
                        position: p.position,
                    });
                });

                // Initialize game
                engine.handleAction(socket.data.sessionId, 'init', null);
                gameEngines.set(code, engine);

                // Update room status
                room.status = 'playing';
                room.gameState = engine.getState() as unknown as Record<string, unknown>;
                await room.save();

                // Emit game start to all players
                io.to(code).emit('game:start', {
                    state: engine.getState(),
                    players: engine.getPlayers(),
                });

                console.log(`🎲 Game started in room ${code}`);
            } catch (error) {
                console.error('Start game error:', error);
                socket.emit('error', { message: 'Failed to start game' });
            }
        });

        // Game action (roll, move)
        socket.on('game:action', async (payload: GameActionPayload) => {
            try {
                const { roomCode, action, data } = payload;
                const code = roomCode.toUpperCase();

                const engine = gameEngines.get(code);
                if (!engine) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                const sessionId = socket.data.sessionId;
                const newState = engine.handleAction(sessionId, action, data);

                // Update room game state
                await Room.updateOne(
                    { code },
                    { gameState: newState, currentTurn: newState.currentPlayer }
                );

                // Emit state update to all players
                io.to(code).emit('game:state', {
                    state: newState,
                    lastAction: { action, by: sessionId, data },
                });

                // Check for winner
                if (engine.isGameOver()) {
                    const winnerIndex = engine.getWinner();
                    const winner = engine.getPlayers()[winnerIndex!];

                    await Room.updateOne({ code }, { status: 'finished' });
                    gameEngines.delete(code);

                    io.to(code).emit('game:winner', {
                        winner: {
                            position: winnerIndex,
                            username: winner.username,
                        },
                    });

                    console.log(`🏆 ${winner.username} won in room ${code}`);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Action failed';
                socket.emit('error', { message });
                console.error('Game action error:', error);
            }
        });

        // Leave room
        socket.on('room:leave', async () => {
            await handleDisconnect(socket, io);
        });

        // Disconnect
        socket.on('disconnect', async () => {
            await handleDisconnect(socket, io);
            console.log(`👋 Player disconnected: ${socket.id}`);
        });
    });

    return io;
};

async function handleDisconnect(socket: Socket, io: SocketServer) {
    const { roomCode, sessionId } = socket.data;
    if (!roomCode || !sessionId) return;

    try {
        const room = await Room.findOne({ code: roomCode });
        if (!room) return;

        const player = room.players.find(p => p.sessionId === sessionId);
        if (player) {
            player.isConnected = false;
            await room.save();

            io.to(roomCode).emit('room:update', {
                players: room.players,
                status: room.status,
            });
        }
    } catch (error) {
        console.error('Disconnect handler error:', error);
    }
}
