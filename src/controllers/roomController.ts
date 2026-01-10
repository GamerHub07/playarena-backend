import { Request, Response } from 'express';
import Room, { IPlayer } from '../models/Room';
import GuestSession from '../models/GuestSession';
import { v4 as uuidv4 } from 'uuid';

// Generate 6-character room code
const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId, gameType } = req.body;

        if (!sessionId || !gameType) {
            res.status(400).json({
                success: false,
                message: 'sessionId and gameType are required',
            });
            return;
        }

        // Verify guest session
        const guest = await GuestSession.findOne({ sessionId });
        if (!guest) {
            res.status(401).json({
                success: false,
                message: 'Invalid session',
            });
            return;
        }

        // Generate unique room code
        let code = generateRoomCode();
        let attempts = 0;
        while (await Room.findOne({ code }) && attempts < 10) {
            code = generateRoomCode();
            attempts++;
        }

        const player: IPlayer = {
            odId: uuidv4(),
            sessionId: guest.sessionId,
            username: guest.username,
            position: 0,
            isHost: true,
            isConnected: true,
        };

        const room = await Room.create({
            code,
            gameType,
            players: [player],
            maxPlayers: gameType === 'ludo' ? 4 : gameType === 'monopoly' ? 6 : gameType === 'snake-ladder' ? 4 : gameType === 'poker' ? 8 : 4,
            minPlayers: 2,
        });

        res.status(201).json({
            success: true,
            data: {
                code: room.code,
                gameType: room.gameType,
                players: room.players,
                status: room.status,
            },
        });
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create room',
        });
    }
};

export const getRoom = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code } = req.params;

        const room = await Room.findOne({ code: code.toUpperCase() });

        if (!room) {
            res.status(404).json({
                success: false,
                message: 'Room not found',
            });
            return;
        }

        res.json({
            success: true,
            data: {
                code: room.code,
                gameType: room.gameType,
                players: room.players,
                status: room.status,
                maxPlayers: room.maxPlayers,
                minPlayers: room.minPlayers,
                // MASKED GAME STATE
                gameState: (() => {
                    if (!room.gameState || room.gameType !== 'poker') return room.gameState;

                    // We need the requester's session ID to know who to unmask.
                    // This might come from headers if your auth middleware attaches it,
                    // or we might have to be conservative and mask everything if not sure.
                    // For now, let's look for a header 'x-session-id' or query param.
                    // If not found, we mask ALL hands (observer mode).
                    const requesterSessionId = req.headers['x-session-id'] || req.query.sessionId;

                    const pState = JSON.parse(JSON.stringify(room.gameState));
                    if (pState.players && typeof pState.players === 'object') {
                        Object.values(pState.players).forEach((player: any) => {
                            if (player.sessionId !== requesterSessionId && pState.currentPhase !== 'showdown') {
                                player.hand = [];
                            }
                        });
                    }
                    return pState;
                })(),
            },
        });
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get room',
        });
    }
};

export const joinRoom = async (req: Request, res: Response): Promise<void> => {
    try {
        const { code } = req.params;
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({
                success: false,
                message: 'sessionId is required',
            });
            return;
        }

        const guest = await GuestSession.findOne({ sessionId });
        if (!guest) {
            res.status(401).json({
                success: false,
                message: 'Invalid session',
            });
            return;
        }

        const room = await Room.findOne({ code: code.toUpperCase() });

        if (!room) {
            res.status(404).json({
                success: false,
                message: 'Room not found',
            });
            return;
        }

        if (room.status !== 'waiting') {
            res.status(400).json({
                success: false,
                message: 'Game already started',
            });
            return;
        }

        if (room.players.length >= room.maxPlayers) {
            res.status(400).json({
                success: false,
                message: 'Room is full',
            });
            return;
        }

        // Check if already in room
        const existingPlayer = room.players.find(p => p.sessionId === sessionId);
        if (existingPlayer) {
            res.json({
                success: true,
                data: {
                    code: room.code,
                    gameType: room.gameType,
                    players: room.players,
                    status: room.status,
                },
            });
            return;
        }

        const newPlayer: IPlayer = {
            odId: uuidv4(),
            sessionId: guest.sessionId,
            username: guest.username,
            position: room.players.length,
            isHost: false,
            isConnected: true,
        };

        room.players.push(newPlayer);
        await room.save();

        res.json({
            success: true,
            data: {
                code: room.code,
                gameType: room.gameType,
                players: room.players,
                status: room.status,
            },
        });
    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join room',
        });
    }
};
