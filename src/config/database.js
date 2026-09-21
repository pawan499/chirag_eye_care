import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.info('MongoDB connected');
}

export async function disconnectDatabase() { await mongoose.connection.close(); }
