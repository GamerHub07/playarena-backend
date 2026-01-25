import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db';
import Room, { IRoom } from '../models/Room';

// Load env vars
dotenv.config();

const listRooms = async () => {
  try {
    await connectDB();
    console.log('\n🔍 Searching for active rooms...\n');

    // Find rooms that are waiting or playing
    const rooms = await Room.find({
      status: { $in: ['waiting', 'playing'] }
    }).sort({ createdAt: -1 });

    if (rooms.length === 0) {
      console.log('❌ No active rooms found.');
    } else {
      console.log(`✅ Found ${rooms.length} active room(s):\n`);
      console.log('--------------------------------------------------------------------------------');
      console.log('| CODE   | GAME TYPE       | STATUS   | PLAYERS | CREATED              |');
      console.log('--------------------------------------------------------------------------------');

      rooms.forEach((room: IRoom) => {
        const code = room.code.padEnd(6);
        const gameType = room.gameType.padEnd(15);
        const status = room.status.padEnd(8);
        const playerCount = `${room.players.length}/${room.maxPlayers}`.padEnd(7);
        const created = new Date(room.createdAt).toLocaleTimeString();

        console.log(`| ${code} | ${gameType} | ${status} | ${playerCount} | ${created} |`);
      });
      console.log('--------------------------------------------------------------------------------');
    }

  } catch (error) {
    console.error('❌ Error listing rooms:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

listRooms();
