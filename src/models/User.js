import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, mobile: String, passwordHash: { type: String, required: true, select: false }, isActive: { type: Boolean, default: true }, lastLoginAt: Date }, { timestamps: true });
schema.methods.verifyPassword = function (password) { return bcrypt.compare(password, this.passwordHash); };
export default mongoose.model('User', schema);
