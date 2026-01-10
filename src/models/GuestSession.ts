import mongoose, { Schema, Document } from 'mongoose';

export interface IGuestSession extends Document {
    sessionId: string;
    username: string;
    createdAt: Date;
    lastActive: Date;
}

const GuestSessionSchema = new Schema<IGuestSession>({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    username: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 20,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    lastActive: {
        type: Date,
        default: Date.now,
    },
});

// Auto-delete sessions after 24 hours
GuestSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IGuestSession>('GuestSession', GuestSessionSchema);
