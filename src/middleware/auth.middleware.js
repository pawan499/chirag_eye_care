import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const authenticate = asyncHandler(async (req, _res, next) => { const token = req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7); if (!token) throw new ApiError(401, 'Authentication required'); let decoded; try { decoded = jwt.verify(token, env.jwtSecret); } catch { throw new ApiError(401, 'Invalid or expired token'); } const user = await User.findById(decoded.sub).select('-passwordHash'); if (!user || !user.isActive) throw new ApiError(401, 'Account is unavailable'); req.user = user; next(); });
