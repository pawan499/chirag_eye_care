import mongoose from 'mongoose';
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true, index: true }, genericName: String, unit: String, defaultPrice: { type: Number, min: 0, default: 0 }, description: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ name: 'text', genericName: 'text' });
export default mongoose.model('Medicine', schema);
