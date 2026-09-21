import dotenv from 'dotenv';
dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length && process.env.NODE_ENV !== 'test') throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be at least 32 characters');

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development', port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI, jwtSecret: process.env.JWT_SECRET || 'test-secret-not-for-production-123456',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d', corsOrigin: process.env.CORS_ORIGIN || '*',
  swagger: process.env.ENABLE_SWAGGER !== 'false'
});
