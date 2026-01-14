import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import connectDB from '../config/db';

dotenv.config();

const listUsers = async () => {
  try {
    await connectDB();
    const users = await User.find({}).select('-password');

    console.log('\n👥 User Registry:');
    console.log('----------------------------------------');

    if (users.length === 0) {
      console.log('No users found.');
    } else {
      console.table(users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        points: u.points,
        playtime: `${Math.floor((u.totalPlaytimeSeconds || 0) / 60)}m`
      })));
    }

    console.log('----------------------------------------\n');
    process.exit(0);
  } catch (error) {
    console.error('Error fetching users:', error);
    process.exit(1);
  }
};

listUsers();
