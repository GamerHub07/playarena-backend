import { Router, Request, Response } from 'express';
import guestRoutes from './guestRoutes';
import roomRoutes from './roomRoutes';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'PlayArena API is running!',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// API Routes
router.use('/guest', guestRoutes);
router.use('/rooms', roomRoutes);

export default router;
