import mongoose from 'mongoose';
const counters = new mongoose.Schema({ _id: String, sequence: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model('Counter', counters);
export async function nextPublicId(prefix) { const counter = await Counter.findByIdAndUpdate(prefix, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }); return `${prefix}-${String(counter.sequence).padStart(6, '0')}`; }
