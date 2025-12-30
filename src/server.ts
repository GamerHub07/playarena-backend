import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import connectDB from './config/db';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { initializeSocket } from './socket';

// Load environment variables
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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
     PlayArena API Server
     Running on: http://localhost:${PORT}
     WebSocket: ws://localhost:${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}
  ========================================= 🎮
  `);
});

export { app, io };
