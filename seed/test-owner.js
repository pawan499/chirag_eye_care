import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import User from '../src/models/User.js';

if (env.nodeEnv === 'production') throw new Error('Testing account seed is only available outside production.');

const email = 'test@chirag.example';
const password = 'ChiragTest@123';
try {
  await connectDatabase();
  await User.findOneAndUpdate({ email }, {
    name: 'Chirag Test Owner', email,
    passwordHash: await bcrypt.hash(password, 12), isActive: true,
  }, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true });
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user?.isActive || !await user.verifyPassword(password)) throw new Error('Seeded account verification failed.');
  console.info(`Testing account ready: ${email}`);
} catch (error) {
  console.error(`Testing account seed failed (${error.name}). Check MongoDB connectivity and configuration.`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
