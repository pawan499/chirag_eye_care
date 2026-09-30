import { ownedSchema } from '../utils/ownership.js';
import mongoose from 'mongoose';
const registrationEye = new mongoose.Schema({ unaidedVision: { type: String, maxlength: 40 }, correctedVision: { type: String, maxlength: 40 }, pinholeVision: { type: String, maxlength: 40 }, nearVision: { type: String, maxlength: 40 }, sph: { type: Number, min: -50, max: 50 }, cyl: { type: Number, min: -50, max: 50 }, axis: { type: Number, min: 0, max: 180 }, add: { type: Number, min: -50, max: 50 }, iop: { type: Number, min: 0, max: 100 } }, { _id: false });
const investigation = new mongoose.Schema({ rightEye: registrationEye, leftEye: registrationEye, pd: { type: Number, min: 0, max: 100 }, remarks: { type: String, maxlength: 2000 } }, { _id: false });
const schema = new mongoose.Schema({ patientId: { type: String, unique: true, immutable: true, index: true }, name: { type: String, required: true, trim: true, index: true }, mobile: { type: String, trim: true, index: true }, age: { type: Number, min: 0, max: 130 }, dateOfBirth: Date, gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] }, address: String, bloodGroup: String, allergies: String, medicalNotes: String, investigation: investigation, isActive: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ name: 1, mobile: 1 });
ownedSchema(schema);
export default mongoose.model('Patient', schema);
