import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
let mongo, app, User, Patient, a, b;
const send = (user, method, path, body) => request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`).send(body);
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'isolation-test-secret-not-production-1234';
  ({ default: app } = await import('../src/app.js'));
  await mongoose.connect(mongo.getUri());
  ({ default: User } = await import('../src/models/User.js'));
  ({ default: Patient } = await import('../src/models/Patient.js'));
  async function fixture(email, amount) {
    const user = await User.create({ name: email, email, passwordHash: await bcrypt.hash('password123', 4) });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'password123' }).expect(200);
    const account = { id: String(user._id), token: login.body.data.token };
    const create = async (path, body) => (await send(account, 'post', path, body).expect(201)).body.data;
    account.patient = await create('/patients', { name: 'Same name', mobile: '9876543210' });
    account.medicine = await create('/medicines', { name: 'Same medicine', defaultPrice: 5 });
    account.visit = await create('/visits', { patient: account.patient._id, charges: { consultation: amount } });
    account.order = await create('/spectacle-orders', { patient: account.patient._id, visit: account.visit._id, framePrice: amount });
    account.payment = await create('/payments', { patient: account.patient._id, visit: account.visit._id, amount, paymentMethod: 'CASH' });
    await send(account, 'patch', '/settings', { shopName: email }).expect(200);
    return account;
  }
  a = await fixture('a@test.local', 100);
  b = await fixture('b@test.local', 200);
}, 30000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test('lists, pagination, search and patient subresources are account scoped', async () => {
  for (const [path, key] of [['patients', 'patient'], ['visits', 'visit'], ['spectacle-orders', 'order'], ['payments', 'payment'], ['medicines', 'medicine']]) {
    for (const user of [a, b]) {
      const result = (await send(user, 'get', `/${path}?owner=${user === a ? b.id : a.id}`).expect(200)).body;
      expect(result.data.map(row => row._id)).toEqual([user[key]._id]);
      expect(result.pagination.total).toBe(1);
    }
  }
  const found = (await send(a, 'get', '/patients?search=Same').expect(200)).body.data;
  expect(found.map(row => row._id)).toEqual([a.patient._id]);
  for (const path of ['visits', 'spectacle-orders', 'payments']) {
    expect((await send(b, 'get', `/${path}?patient=${a.patient._id}`).expect(200)).body.data).toEqual([]);
  }
  expect((await send(b, 'get', `/patients/${a.patient._id}/payments`).expect(200)).body.data).toEqual([]);
  const details = (await send(a, 'get', `/patients/${a.patient._id}/details`).expect(200)).body.data;
  expect(details.paymentSummary).toEqual({ totalBilled: 200, totalPaid: 100, due: 100 });
  expect((await send(a, 'get', `/patients/${a.patient._id}/timeline`).expect(200)).body.data).toHaveLength(3);
});

test('foreign IDs cannot be read, edited, deleted or printed', async () => {
  for (const path of [`/patients/${a.patient._id}`, `/patients/${a.patient._id}/details`, `/patients/${a.patient._id}/timeline`, `/visits/${a.visit._id}`, `/medicines/${a.medicine._id}`]) await send(b, 'get', path).expect(404);
  for (const [kind, key] of [['patient', 'patient'], ['visit', 'visit'], ['order', 'order'], ['payment', 'payment']]) await send(b, 'get', `/receipts/${kind}/${a[key]._id}`).expect(404);
  for (const [path, body] of [[`/patients/${a.patient._id}`, { name: 'Stolen' }], [`/medicines/${a.medicine._id}`, { name: 'Stolen' }], [`/spectacle-orders/${a.order._id}`, { status: 'READY' }], [`/payments/${a.payment._id}`, { amount: 1, editNote: 'Cross-account' }]]) await send(b, 'patch', path, body).expect(404);
  await send(b, 'delete', `/patients/${a.patient._id}`).expect(404);
  await send(b, 'delete', `/medicines/${a.medicine._id}`).expect(404);
  expect((await send(a, 'get', `/patients/${a.patient._id}`).expect(200)).body.data.name).toBe('Same name');
});

test('foreign linked patient, medicine, visit and order cannot be used for new records', async () => {
  await send(b, 'post', '/visits', { patient: a.patient._id }).expect(404);
  await send(b, 'post', '/spectacle-orders', { patient: a.patient._id }).expect(404);
  await send(b, 'post', '/payments', { patient: a.patient._id, visit: a.visit._id, amount: 1, paymentMethod: 'CASH' }).expect(404);
  await send(b, 'post', '/visits', { patient: b.patient._id, medicines: [{ medicine: a.medicine._id, quantity: 1 }] }).expect(400);
  await send(b, 'post', '/spectacle-orders', { patient: b.patient._id, visit: a.visit._id }).expect(400);
  await send(b, 'post', '/payments', { patient: b.patient._id, spectacleOrder: a.order._id, amount: 1, paymentMethod: 'CASH' }).expect(400);
  await send(b, 'post', '/payments', { patient: b.patient._id, visit: a.visit._id, amount: 1, paymentMethod: 'CASH' }).expect(400);
});

test('ownership is server assigned and cannot be changed by payload', async () => {
  await send(b, 'patch', `/patients/${b.patient._id}`, { owner: a.id, name: 'Same name' }).expect(200);
  expect(String((await Patient.findById(b.patient._id)).owner)).toBe(b.id);
  const made = (await send(b, 'post', '/patients', { name: 'Owner spoof test', owner: a.id }).expect(201)).body.data;
  expect(made.owner).toBe(b.id);
  await send(a, 'get', `/patients/${made._id}`).expect(404);
});

test('dashboard, all reports and receipt branding are isolated', async () => {
  for (const [user, amount] of [[a, 100], [b, 200]]) {
    const dashboard = (await send(user, 'get', '/dashboard/summary').expect(200)).body.data;
    expect(dashboard).toMatchObject({ todayPatients: 1, todayCollection: amount, pendingDue: amount, spectacleOrders: { ORDERED: 1 } });
    for (const period of ['daily', 'weekly', 'monthly', '']) {
      const report = (await send(user, 'get', `/reports/collection${period ? '/' + period : ''}`).expect(200)).body.data;
      expect(report.totalCollection).toBe(amount);
    }
    const receipt = (await send(user, 'get', `/receipts/payment/${user.payment._id}`).expect(200)).body.data;
    expect(receipt.paid).toBe(amount);
    expect(receipt.payments.map(p => p._id)).toEqual([user.payment._id]);
    expect(receipt.settings.shopName).toBe(user === a ? 'a@test.local' : 'b@test.local');
    expect((await send(user, 'get', '/settings').expect(200)).body.data.shopName).toBe(receipt.settings.shopName);
  }
});

test('legacy unowned records are hidden and services fail closed without an owner', async () => {
  const legacy = await Patient.collection.insertOne({ name: 'Unassigned legacy', patientId: 'P-LEGACY', isActive: true });
  for (const user of [a, b]) {
    await send(user, 'get', `/patients/${legacy.insertedId}`).expect(404);
    expect((await send(user, 'get', '/patients?search=Unassigned').expect(200)).body.data).toEqual([]);
  }
  const { listPatients } = await import('../src/services/patient.service.js');
  await expect(listPatients({})).rejects.toThrow('Authenticated owner');
});

test('legacy migration assigns only unowned data, is repeat-safe and records an audit', async () => {
  const { migrateLegacyOwnership } = await import('../src/services/ownership-migration.service.js');
  const preview = await migrateLegacyOwnership('a@test.local');
  expect(preview.applied).toBe(false);
  expect(preview.counts.patients).toBe(1);
  const result = await migrateLegacyOwnership('a@test.local', true);
  expect(result.applied).toBe(true);
  expect((await send(a, 'get', '/patients?search=Unassigned').expect(200)).body.data).toHaveLength(1);
  expect((await send(b, 'get', '/patients?search=Unassigned').expect(200)).body.data).toHaveLength(0);
  expect(String((await Patient.findById(b.patient._id)).owner)).toBe(b.id);
  const again = await migrateLegacyOwnership('a@test.local', true);
  expect(Object.values(again.counts).every(count => count === 0)).toBe(true);
  expect(again.applied).toBe(false);
  const audit = await mongoose.connection.collection('ownership_migration_audit').findOne({ _id: new mongoose.Types.ObjectId(result.batch) });
  expect(audit.status).toBe('complete');
});
