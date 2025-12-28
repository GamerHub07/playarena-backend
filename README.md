# PlayArena Backend API

Express.js + TypeScript + MongoDB backend for the PlayArena online gaming platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

## 📁 Project Structure

```
src/
├── config/         # Database & app configuration
├── controllers/    # Request handlers
├── middleware/     # Express middleware
├── models/         # Mongoose models
├── routes/         # API route definitions
├── utils/          # Helper functions
└── server.ts       # Entry point
```

## 🔧 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production server |

## 🔗 API Endpoints

- `GET /api/health` - Health check

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/playarena` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `JWT_SECRET` | JWT signing secret | - |
