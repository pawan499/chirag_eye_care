import { ownedSchema } from '../utils/ownership.js';
import mongoose from 'mongoose';
const power = new mongoose.Schema({ sph: Number, cyl: Number, axis: { type: Number, min: 0, max: 180 }, add: Number, va: String }, { _id: false });
const schema = new mongoose.Schema({ orderId: { type: String, unique: true, immutable: true, index: true }, patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true }, visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' }, rightEye: power, leftEye: power, pd: { type: Number, min: 0, max: 100 }, frameName: String, framePrice: { type: Number, min: 0, default: 0 }, lensType: String, lensPrice: { type: Number, min: 0, default: 0 }, otherCharges: { type: Number, min: 0, default: 0 }, discount: { type: Number, min: 0, default: 0 }, totalAmount: { type: Number, min: 0, default: 0 }, advanceAmount: { type: Number, min: 0, default: 0 }, remainingAmount: { type: Number, min: 0, default: 0 }, status: { type: String, enum: ['ORDERED', 'IN_PROCESS', 'READY', 'DELIVERED', 'CANCELLED'], default: 'ORDERED', index: true }, deliveryDate: Date, notes: String }, { timestamps: true });
schema.index({ patient: 1, createdAt: -1 });
ownedSchema(schema);
export default mongoose.model('SpectacleOrder', schema);
