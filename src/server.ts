import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables FIRST (before any imports that use them)
dotenv.config();

import connectDB from './config/db';
import { logFeatureFlags } from './config/featureFlags';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { initializeSocket } from './socket';
import { gameStore } from './services/gameStore';

const app: Application = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Log feature flags status
logFeatureFlags();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Schedule cleanup of stale games every 5 minutes
setInterval(() => {
  // Remove games that haven't been active for 10 minutes
  const cleaned = gameStore.cleanupStaleGames(10 * 60 * 1000);
  if (cleaned > 0) {
    console.log(`🧹 Scheduled cleanup removed ${cleaned} stale games`);
  }
}, 5 * 60 * 1000); // Run check every 5 minutes

// Start server
httpServer.listen(PORT, () => {
  console.log(`
  🎮 ========================================
     PlayArena API Server
     Running on: http://localhost:${PORT}
     WebSocket: ws://localhost:${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}
  ========================================= 🎮
  `);
});

export { app, io };
