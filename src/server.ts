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

const app: Application = express();
const httpServer = createServer(app);
const PORT = process.env.PORT;

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

// Start server
httpServer.listen(PORT, () => {
  console.log(`
  🎮 ========================================
     PlayArena API Server ${process.env.NODE_ENV}
     Running on: http://localhost:${PORT}
     WebSocket: ws://localhost:${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}
  ========================================= 🎮
  `);
});

export { app, io };
