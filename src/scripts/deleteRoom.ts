import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db';
import Room from '../models/Room';

// Load env vars
dotenv.config();

const deleteRoom = async () => {
  const arg = process.argv[2];

  if (!arg) {
    console.error('❌ Please provide a room code or --all.');
    console.log('Usage: npm run delete:room <ROOM_CODE>');
    console.log('Usage: npm run delete:room --all');
    process.exit(1);
  }

  try {
    await connectDB();

    if (arg === '--all' || arg === 'all') {
      const result = await Room.deleteMany({
        status: { $in: ['waiting', 'playing'] }
      });
      console.log(`✅ Deleted ${result.deletedCount} active rooms.`);
    } else {
      const roomCode = arg.toUpperCase();
      const result = await Room.deleteOne({ code: roomCode });

      if (result.deletedCount === 0) {
        console.log(`❌ Room ${roomCode} not found.`);
      } else {
        console.log(`✅ Room ${roomCode} deleted successfully.`);
      }
    }

  } catch (error) {
    console.error('❌ Error deleting room:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

deleteRoom();
