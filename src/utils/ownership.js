import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

// Owner always comes from the verified session, never request body/query data.
export function ownerScope(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new ApiError(401, 'Authenticated owner is required');
  }
  return { owner: new mongoose.Types.ObjectId(String(userId)) };
}
export function ownedSchema(schema) {
  schema.add({ owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true } });
  schema.index({ owner: 1, createdAt: -1 });
}
