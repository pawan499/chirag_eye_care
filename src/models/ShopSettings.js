import { ownedSchema } from '../utils/ownership.js';
import mongoose from 'mongoose';
const schema = new mongoose.Schema({ doctorName: String, shopName: String, mobile: String, email: String, address: String, registrationNumber: String, defaultConsultationFee: { type: Number, min: 0, default: 0 }, defaultSettings: { type: mongoose.Schema.Types.Mixed, default: {} } }, { timestamps: true });
ownedSchema(schema);
schema.index({ owner: 1 }, { unique: true, partialFilterExpression: { owner: { $type: 'objectId' } } });
export default mongoose.model('ShopSettings', schema);
