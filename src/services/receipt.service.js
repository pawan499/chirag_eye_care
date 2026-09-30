import { ownerScope } from '../utils/ownership.js';
import Visit from '../models/Visit.js';
import SpectacleOrder from '../models/SpectacleOrder.js';
import Payment from '../models/Payment.js';
import Patient from '../models/Patient.js';
import ShopSettings from '../models/ShopSettings.js';
import { ApiError } from '../utils/ApiError.js';

export async function getReceipt(kind, id, userId) {
  const model = { visit: Visit, order: SpectacleOrder, payment: Payment, patient: Patient }[kind];
  const record = await model.findOne({ ...ownerScope(userId), _id: id }).lean();
  if (!record) throw new ApiError(404, 'Receipt record not found');
  if (kind === 'patient') {
    const settings = await ShopSettings.findOne(ownerScope(userId)).select('shopName doctorName mobile email address registrationNumber').lean();
    return { kind, number: record.patientId, date: record.createdAt, generatedAt: new Date(), patient: record, settings: settings || {}, visit: null, order: null, payment: null, payments: [], total: 0, paid: 0, due: 0, cancelled: false };
  }
  const payment = kind === 'payment' ? record : null;
  let visit = kind === 'visit' ? record : null;
  let order = kind === 'order' ? record : null;
  if (payment) {
    if (payment.status !== 'COMPLETED') throw new ApiError(400, 'Payment is not completed');
    if (payment.spectacleOrder) order = await SpectacleOrder.findOne({ ...ownerScope(userId), _id: payment.spectacleOrder }).lean();
    else if (payment.visit) visit = await Visit.findOne({ ...ownerScope(userId), _id: payment.visit }).lean();
    if (!(order || visit)) throw new ApiError(404, 'Linked bill not found');
    if (String((order || visit).patient) !== String(payment.patient)) throw new ApiError(400, 'Payment does not match bill patient');
  }
  const [patient, settings, payments] = await Promise.all([
    Patient.findOne({ ...ownerScope(userId), _id: record.patient }).select(payment ? 'patientId name mobile age gender address' : 'patientId name mobile age gender address investigation').lean(),
    ShopSettings.findOne(ownerScope(userId)).select('shopName doctorName mobile email address registrationNumber').lean(),
    Payment.find({ ...ownerScope(userId), patient: record.patient, ...(order ? { spectacleOrder: order._id } : { visit: visit._id }), status: 'COMPLETED' }).sort({ paymentDate: 1, _id: 1 }).select('paymentId amount paymentMethod paymentDate referenceNumber').lean(),
  ]);
  if (!patient) throw new ApiError(404, 'Patient not found');
  const total = order ? order.totalAmount : visit.charges.total;
  const paid = +payments.reduce((sum, item) => sum + item.amount, 0).toFixed(2);
  return {
    kind, number: payment?.paymentId || order?.orderId || visit.visitId,
    date: payment?.paymentDate || order?.createdAt || visit.visitDate,
    generatedAt: new Date(), patient, settings: settings || {},
    // Payment receipts contain billing information, not clinical notes.
    visit: payment ? null : visit, order: payment ? null : order, payment,
    billNumber: order?.orderId || visit?.visitId,
    total, paid, due: order?.status === 'CANCELLED' ? 0 : Math.max(0, +(total - paid).toFixed(2)),
    cancelled: order?.status === 'CANCELLED', payments,
  };
}
