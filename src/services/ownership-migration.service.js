import mongoose from 'mongoose';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Visit from '../models/Visit.js';
import SpectacleOrder from '../models/SpectacleOrder.js';
import Payment from '../models/Payment.js';
import Medicine from '../models/Medicine.js';
import ShopSettings from '../models/ShopSettings.js';

const models = [Patient, Visit, SpectacleOrder, Payment, Medicine, ShopSettings];
const links = new Map([
  [Visit, [['patient', Patient], ['medicines.medicine', Medicine]]],
  [SpectacleOrder, [['patient', Patient], ['visit', Visit]]],
  [Payment, [['patient', Patient], ['visit', Visit], ['spectacleOrder', SpectacleOrder]]],
]);
// This is an explicit administrative migration, never called by an API request.
// Only unowned records are changed. Re-running cannot transfer existing ownership.
export async function migrateLegacyOwnership(email, apply = false) {
  const user = await User.findOne({ email: email.trim().toLowerCase(), isActive: true }).select('_id email').lean();
  if (!user) throw new Error('Target account does not exist or is inactive');
  const counts = {};
  for (const model of models) counts[model.collection.name] = await model.collection.countDocuments({ owner: null });
  const legacySettings = counts[ShopSettings.collection.name];
  if (legacySettings > 1 || (legacySettings && await ShopSettings.exists({ owner: user._id }))) {
    throw new Error('Clinic settings conflict: reconcile existing settings before migration');
  }
  for (const [model, references] of links) {
    for (const [path, target] of references) {
      const refs = await model.collection.distinct(path, { owner: null });
      const ids = refs.filter(Boolean);
      const foreign = await target.collection.findOne({ _id: { $in: ids }, owner: { $nin: [null, user._id] } }, { projection: { _id: 1 } });
      if (foreign) throw new Error(`Cannot migrate ${model.modelName}: a linked ${target.modelName} belongs to another account`);
    }
  }
  const result = { email: user.email, counts, applied: false };
  if (!apply || Object.values(counts).every(count => count === 0)) return result;
  const audit = mongoose.connection.collection('ownership_migration_audit');
  const batch = new mongoose.Types.ObjectId();
  await audit.insertOne({ _id: batch, targetOwner: user._id, email: user.email, counts, startedAt: new Date(), status: 'started' });
  // Persist the exact IDs and previous owner state before each update. These
  // audit rows allow an operator to undo a partial batch without touching data.
  for (const model of models) {
    const collection = model.collection;
    for await (const row of collection.find({ owner: null }, { projection: { _id: 1, owner: 1 } })) {
      await audit.insertOne({ batch, collection: collection.name, documentId: row._id, targetOwner: user._id, hadOwnerField: Object.hasOwn(row, 'owner'), previousOwner: row.owner ?? null });
      await collection.updateOne({ _id: row._id, owner: null }, { $set: { owner: user._id } });
    }
  }
  await audit.updateOne({ _id: batch }, { $set: { status: 'complete', completedAt: new Date() } });
  return { ...result, applied: true, batch: String(batch) };
}
