import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import GuestSession from '../models/GuestSession';

export const createGuest = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.body;

        if (!username || username.length < 2 || username.length > 20) {
            res.status(400).json({
                success: false,
                message: 'Username must be 2-20 characters',
            });
            return;
        }

        const sessionId = uuidv4();

        const guest = await GuestSession.create({
            sessionId,
            username: username.trim(),
        });

        res.status(201).json({
            success: true,
            data: {
                sessionId: guest.sessionId,
                username: guest.username,
            },
        });
    } catch (error) {
        console.error('Create guest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create guest session',
        });
    }
};

export const getGuest = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;

        const guest = await GuestSession.findOne({ sessionId });

        if (!guest) {
            res.status(404).json({
                success: false,
                message: 'Session not found',
            });
            return;
        }

        // Update last active
        guest.lastActive = new Date();
        await guest.save();

        res.json({
            success: true,
            data: {
                sessionId: guest.sessionId,
                username: guest.username,
            },
        });
    } catch (error) {
        console.error('Get guest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get guest session',
        });
    }
};
