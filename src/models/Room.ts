import mongoose, { Schema, Document } from 'mongoose';


export type GameType = 'ludo' | 'chess' | 'snake-ladder' | 'monopoly';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface IPlayer {
    odId: string;
    sessionId: string;
    username: string;
    position: number; // 0-3 for ludo
    isHost: boolean;
    isConnected: boolean;
}

export interface IRoom extends Document {
    code: string;
    gameType: GameType;
    status: RoomStatus;
    players: IPlayer[];
    maxPlayers: number;
    minPlayers: number;
    gameState: Record<string, unknown>;
    currentTurn: number;
    createdAt: Date;
    updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayer>({
    odId: { type: String, required: true },
    sessionId: { type: String, required: true },
    username: { type: String, required: true },
    position: { type: Number, required: true },
    isHost: { type: Boolean, default: false },
    isConnected: { type: Boolean, default: true },
});

const RoomSchema = new Schema<IRoom>({
    code: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        length: 6,
    },
    gameType: {
        type: String,
        required: true,

        enum: ['ludo', 'chess', 'snake-ladder', 'monopoly'],

    },
    status: {
        type: String,
        default: 'waiting',
        enum: ['waiting', 'playing', 'finished'],
    },
    players: {
        type: [PlayerSchema],
        default: [],
    },
    maxPlayers: {
        type: Number,
        default: 4,
    },
    minPlayers: {
        type: Number,
        default: 2,
    },
    gameState: {
        type: Schema.Types.Mixed,
        default: {},
    },
    currentTurn: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Auto-delete rooms after 2 hours
RoomSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7200 });

export default mongoose.model<IRoom>('Room', RoomSchema);
