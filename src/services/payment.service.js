import { ownerScope } from '../utils/ownership.js';
import Payment from '../models/Payment.js'; import Patient from '../models/Patient.js'; import Visit from '../models/Visit.js'; import SpectacleOrder from '../models/SpectacleOrder.js'; import { nextPublicId } from '../utils/ids.js'; import { ApiError } from '../utils/ApiError.js'; import { getPagination, paginationMeta } from '../utils/pagination.js';
async function billFor({ patient, visit, spectacleOrder }, userId) { if (spectacleOrder) { const o = await SpectacleOrder.findOne({ ...ownerScope(userId), _id: spectacleOrder, patient }); if (!o) throw new ApiError(400, 'Spectacle order does not belong to patient'); if (o.status === 'CANCELLED') throw new ApiError(400, 'Cannot pay a cancelled order'); return { bill: o.totalAmount, filter: { spectacleOrder: o._id } }; } if (visit) { const v = await Visit.findOne({ ...ownerScope(userId), _id: visit, patient }); if (!v) throw new ApiError(400, 'Visit does not belong to patient'); return { bill: v.charges.total, filter: { visit: v._id } }; } throw new ApiError(400, 'A visit or spectacle order is required for a payment'); }
export async function createPayment(input, userId) { if (!await Patient.exists({ ...ownerScope(userId), _id: input.patient, isActive: true })) throw new ApiError(404, 'Patient not found'); if (input.visit && input.spectacleOrder) throw new ApiError(400, 'Payment must be linked to either a visit or spectacle order, not both'); const { bill, filter } = await billFor(input, userId); const paid = await Payment.aggregate([{ $match: { ...ownerScope(userId), ...filter, status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]); if ((paid[0]?.total || 0) + input.amount > bill + 0.001) throw new ApiError(400, 'Payment exceeds outstanding due'); const payment = await Payment.create({ ...input, ...ownerScope(userId), paymentId: await nextPublicId('PAY'), createdBy: userId, updatedBy: userId }); if (input.spectacleOrder) { const order = await SpectacleOrder.findOne({ ...ownerScope(userId), _id: input.spectacleOrder }); order.advanceAmount = (paid[0]?.total || 0) + input.amount; order.remainingAmount = Math.max(0, order.totalAmount - order.advanceAmount); await order.save(); } return payment; }
export async function listPayments(query, userId) { const { page, limit, skip } = getPagination(query); const filter = { ...ownerScope(userId), status: 'COMPLETED', ...(query.patient && { patient: query.patient }) }; const [data, total] = await Promise.all([Payment.find(filter).populate({ path: 'patient', select: 'patientId name', match: ownerScope(userId) }).sort({ paymentDate: -1 }).skip(skip).limit(limit).lean(), Payment.countDocuments(filter)]); return { data, pagination: paginationMeta({ page, limit, total }) }; }

export async function updatePayment(id, input, userId) {
  const payment = await Payment.findOne({ ...ownerScope(userId), _id: id });
  if (!payment) throw new ApiError(404, 'Payment not found');
  const { editNote, ...changes } = input;
  if (!editNote?.trim()) throw new ApiError(400, 'Reason for editing is required');
  const { bill, filter } = await billFor(payment, userId);
  const paid = await Payment.aggregate([{ $match: { ...ownerScope(userId), ...filter, _id: { $ne: payment._id }, status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const amount = changes.amount ?? payment.amount;
  if ((paid[0]?.total || 0) + amount > bill + 0.001) throw new ApiError(400, 'Payment exceeds outstanding due');
  const before = Object.fromEntries(Object.keys(changes).map(key => [key, payment[key]]));
  const editedAt = new Date();
  const updated = await Payment.findOneAndUpdate({ ...ownerScope(userId), _id: id, updatedAt: payment.updatedAt }, { $set: { ...changes, editedAt, updatedBy: userId }, $push: { editHistory: { note: editNote.trim(), editedAt, editedBy: userId, before, after: changes } } }, { new: true, runValidators: true });
  if (!updated) throw new ApiError(409, 'Payment changed. Reload and try again.');
  if (payment.spectacleOrder) {
    const total = await Payment.aggregate([{ $match: { ...ownerScope(userId), spectacleOrder: payment.spectacleOrder, status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const advanceAmount = total[0]?.total || 0;
    await SpectacleOrder.findOneAndUpdate({ ...ownerScope(userId), _id: payment.spectacleOrder }, { advanceAmount, remainingAmount: Math.max(0, bill - advanceAmount) });
  }
  return updated;
}
