import request from 'supertest'; import mongoose from 'mongoose'; import { MongoMemoryServer } from 'mongodb-memory-server'; import bcrypt from 'bcryptjs';
let mongo, app; beforeAll(async()=>{mongo=await MongoMemoryServer.create();process.env.NODE_ENV='test';process.env.MONGODB_URI=mongo.getUri();process.env.JWT_SECRET='test-secret-not-for-production-123456';({default:app}=await import('../src/app.js'));await mongoose.connect(process.env.MONGODB_URI);const User=(await import('../src/models/User.js')).default;await User.create({name:'Owner',email:'owner@test.local',passwordHash:await bcrypt.hash('password123',10)});});afterAll(async()=>{await mongoose.disconnect();if(mongo)await mongo.stop();});
test('login succeeds and unauthenticated requests are rejected',async()=>{const login=await request(app).post('/api/v1/auth/login').send({email:'owner@test.local',password:'password123'}).expect(200);expect(login.body.data.token).toBeTruthy();await request(app).get('/api/v1/patients').expect(401);});
test('patient can be created and searched',async()=>{const login=await request(app).post('/api/v1/auth/login').send({email:'owner@test.local',password:'password123'});const api=request(app);const created=await api.post('/api/v1/patients').set('Authorization',`Bearer ${login.body.data.token}`).send({name:'Test Patient',mobile:'9876543210'}).expect(201);expect(created.body.data.patientId).toMatch(/^P-/);const found=await api.get('/api/v1/patients?search=Test').set('Authorization',`Bearer ${login.body.data.token}`).expect(200);expect(found.body.data).toHaveLength(1);});

test('patient form payload persists all fields and can be edited and cleared', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'owner@test.local', password: 'password123' }).expect(200);
  const authorization = `Bearer ${login.body.data.token}`;
  const payload = { name: 'Full Form Patient', mobile: '+91 9876543210', age: 0, dateOfBirth: '2026-09-01', gender: 'PREFER_NOT_TO_SAY', address: 'Patient address', bloodGroup: 'AB+', allergies: 'Known allergy', medicalNotes: 'Follow-up notes' };
  const created = await request(app).post('/api/v1/patients').set('Authorization', authorization).send(payload).expect(201);
  const id = created.body.data._id;
  const saved = await request(app).get(`/api/v1/patients/${id}`).set('Authorization', authorization).expect(200);
  expect(saved.body.data).toMatchObject({ ...payload, dateOfBirth: '2026-09-01T00:00:00.000Z' });
  await request(app).patch(`/api/v1/patients/${id}`).set('Authorization', authorization).send({ name: 'Updated Form Patient', age: 130, gender: 'FEMALE', medicalNotes: 'Updated notes' }).expect(200);
  const details = await request(app).get(`/api/v1/patients/${id}/details`).set('Authorization', authorization).expect(200);
  expect(details.body.data.patient).toMatchObject({ name: 'Updated Form Patient', age: 130, gender: 'FEMALE', medicalNotes: 'Updated notes' });
  const cleared = await request(app).patch(`/api/v1/patients/${id}`).set('Authorization', authorization).send({ mobile: null, age: null, dateOfBirth: null, gender: null, address: null, bloodGroup: null, allergies: null, medicalNotes: null }).expect(200);
  for (const field of Object.keys(payload).filter((field) => field !== 'name')) expect(cleared.body.data[field]).toBeUndefined();
  expect(cleared.body.data.name).toBe('Updated Form Patient');
});

test('patient accepts name only and rejects invalid form values without saving', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'owner@test.local', password: 'password123' }).expect(200);
  const authorization = `Bearer ${login.body.data.token}`;
  const created = await request(app).post('/api/v1/patients').set('Authorization', authorization).send({ name: 'A' }).expect(201);
  expect(created.body.data.age).toBeUndefined();
  for (const values of [{ name: '' }, { name: 'Invalid', age: 131 }, { name: 'Invalid', age: -1 }, { name: 'Invalid', age: 1.5 }, { name: 'Invalid', mobile: 'abc' }, { name: 'Invalid', gender: 'Male' }, { name: 'Invalid', dateOfBirth: 'not-a-date' }]) {
    const failed = await request(app).post('/api/v1/patients').set('Authorization', authorization).send(values).expect(400);
    expect(failed.body.errors.length).toBeGreaterThan(0);
  }
  const found = await request(app).get('/api/v1/patients?search=Invalid').set('Authorization', authorization).expect(200);
  expect(found.body.data).toHaveLength(0);
});

test('clinic workflow persists prescription, orders and cash/QR collections', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({email:'owner@test.local',password:'password123'}).expect(200);
  const token = `Bearer ${login.body.data.token}`;
  const post = (path, payload) => request(app).post(`/api/v1${path}`).set('Authorization',token).send(payload);
  const patient = (await post('/patients',{name:'Clinic Workflow Patient'}).expect(201)).body.data._id;
  const medicine = (await post('/medicines',{name:'Clinic test medicine',defaultPrice:125}).expect(201)).body.data._id;
  const eye = {sph:0,cyl:-0.5,axis:90,add:1.25,va:'6/6'};
  const visit = (await post('/visits',{patient,complaint:'Blurred vision',eyeExamination:{rightEye:eye,leftEye:{sph:-1.25},pd:62},medicines:[{medicine,quantity:2,dosage:'As prescribed',frequency:'Recorded frequency',duration:'Recorded duration'}],charges:{consultation:200}}).expect(201)).body.data;
  expect(visit.charges.total).toBe(450);
  expect(visit.eyeExamination.rightEye).toMatchObject(eye);
  expect(visit.eyeExamination.leftEye.cyl).toBeUndefined();
  const order = (await post('/spectacle-orders',{patient,visit:visit._id,rightEye:eye,pd:62,frameName:'Frame A',lensType:'Single vision',framePrice:1000,lensPrice:1500,discount:100}).expect(201)).body.data;
  expect(order.totalAmount).toBe(2400);
  expect(order.pd).toBe(62);
  expect(order.rightEye.va).toBe('6/6');
  await post('/payments',{patient,visit:visit._id,amount:450,paymentMethod:'CASH'}).expect(201);
  await post('/payments',{patient,spectacleOrder:order._id,amount:1000,paymentMethod:'UPI',referenceNumber:'manual-qr-reference'}).expect(201);
  await post('/payments',{patient,spectacleOrder:order._id,amount:1401,paymentMethod:'CASH'}).expect(400);
  const details = (await request(app).get(`/api/v1/patients/${patient}/details`).set('Authorization',token).expect(200)).body.data;
  expect(details.paymentSummary).toEqual({totalBilled:2850,totalPaid:1450,due:1400});
  const patch = payload => request(app).patch(`/api/v1/spectacle-orders/${order._id}`).set('Authorization',token).send(payload);
  await patch({status:'CANCELLED'}).expect(400);
  await patch({framePrice:0,lensPrice:500}).expect(400);
  await patch({status:'READY'}).expect(200);
  await patch({status:'ORDERED'}).expect(400);
  await post('/payments',{patient,spectacleOrder:order._id,amount:1400,paymentMethod:'CASH'}).expect(201);
  const delivered = (await patch({status:'DELIVERED'}).expect(200)).body.data;
  expect(delivered.remainingAmount).toBe(0);
  expect(delivered.advanceAmount).toBe(2400);
  const cancelled = (await post('/spectacle-orders',{patient,framePrice:100}).expect(201)).body.data;
  await request(app).patch(`/api/v1/spectacle-orders/${cancelled._id}`).set('Authorization',token).send({status:'CANCELLED'}).expect(200);
  await post('/payments',{patient,spectacleOrder:cancelled._id,amount:1,paymentMethod:'CASH'}).expect(400);
  await post('/visits',{patient,eyeExamination:{rightEye:{axis:181}}}).expect(400);
  const otherPatient = (await post('/patients',{name:'Another patient'}).expect(201)).body.data._id;
  await post('/spectacle-orders',{patient:otherPatient,visit:visit._id}).expect(400);
  await post('/payments',{patient:otherPatient,visit:visit._id,amount:1,paymentMethod:'CASH'}).expect(400);
  const report = (await request(app).get('/api/v1/reports/collection/daily').set('Authorization',token).expect(200)).body.data;
  expect(report.totalCollection).toBe(2850);
  expect(report.paymentMethods.CASH).toBe(1850);
  expect(report.paymentMethods.UPI).toBe(1000);
});

test('receipts show itemised bills, prescriptions and individual payment amounts', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email:'owner@test.local', password:'password123' }).expect(200);
  const authorization = `Bearer ${login.body.data.token}`;
  const post = (path, data) => request(app).post(`/api/v1${path}`).set('Authorization', authorization).send(data);
  const get = path => request(app).get(`/api/v1${path}`).set('Authorization', authorization);
  await request(app).patch('/api/v1/settings').set('Authorization', authorization).send({shopName:'Receipt Test Clinic',doctorName:'Doctor',address:'Clinic address'}).expect(200);
  const patient = (await post('/patients', {name:'Receipt Patient',mobile:'9876543210',age:0}).expect(201)).body.data;
  const visit = (await post('/visits',{patient:patient._id,complaint:'Recorded complaint',doctorNotes:'Private clinical note',eyeExamination:{rightEye:{sph:0,cyl:-0.5,axis:90},pd:62},medicines:[{medicineName:'Test drops',quantity:2,unitPrice:50,dosage:'Recorded dosage',frequency:'Recorded frequency',duration:'Recorded duration'}],charges:{consultation:200,discount:20}}).expect(201)).body.data;
  const unpaid = (await get(`/receipts/visit/${visit._id}`).expect(200)).body.data;
  expect(unpaid).toMatchObject({kind:'visit',number:visit.visitId,total:280,paid:0,due:280,settings:{shopName:'Receipt Test Clinic'},patient:{name:'Receipt Patient',age:0}});
  expect(unpaid.visit.medicines[0]).toMatchObject({quantity:2,unitPrice:50,totalPrice:100,dosage:'Recorded dosage'});
  expect(unpaid.visit.eyeExamination.rightEye.sph).toBe(0);
  const first = (await post('/payments',{patient:patient._id,visit:visit._id,amount:100,paymentMethod:'UPI',referenceNumber:'UPI-test'}).expect(201)).body.data;
  await post('/payments',{patient:patient._id,visit:visit._id,amount:180,paymentMethod:'CASH'}).expect(201);
  const receipt = (await get(`/receipts/payment/${first._id}`).expect(200)).body.data;
  expect(receipt).toMatchObject({number:first.paymentId,billNumber:visit.visitId,total:280,paid:280,due:0,payment:{amount:100,paymentMethod:'UPI',referenceNumber:'UPI-test'},visit:null,order:null});
  expect(receipt.payments).toHaveLength(2);
  const order = (await post('/spectacle-orders',{patient:patient._id,frameName:'Frame',framePrice:500,lensPrice:300,discount:50,rightEye:{sph:-1},pd:61}).expect(201)).body.data;
  expect((await get(`/receipts/order/${order._id}`).expect(200)).body.data).toMatchObject({number:order.orderId,total:750,due:750,order:{framePrice:500,lensPrice:300,discount:50,pd:61}});
  await request(app).patch(`/api/v1/spectacle-orders/${order._id}`).set('Authorization',authorization).send({status:'CANCELLED'}).expect(200);
  expect((await get(`/receipts/order/${order._id}`).expect(200)).body.data).toMatchObject({cancelled:true,due:0});
  await request(app).get(`/api/v1/receipts/payment/${first._id}`).expect(401);
  await get(`/receipts/unknown/${first._id}`).expect(400);
  await get('/receipts/payment/invalid').expect(400);
  await get(`/receipts/payment/${new mongoose.Types.ObjectId()}`).expect(404);
});

test('vision, diagnoses and prescription details survive creation, history and printing', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'owner@test.local', password: 'password123' }).expect(200);
  const authorization = `Bearer ${login.body.data.token}`;
  const post = (path, payload) => request(app).post(`/api/v1${path}`).set('Authorization', authorization).send(payload);
  const get = path => request(app).get(`/api/v1${path}`).set('Authorization', authorization);
  const investigation = { rightEye: { unaidedVision: 'PL+', correctedVision: '6/60', pinholeVision: '6/36', nearVision: 'N12', iop: 0 }, leftEye: { unaidedVision: '6/9' } };
  const patient = (await post('/patients', { name: 'Vision workflow', investigation }).expect(201)).body.data;
  expect((await get(`/receipts/patient/${patient._id}`).expect(200)).body.data.patient.investigation).toMatchObject(investigation);
  const diagnoses = [{ name: 'Recorded condition', eye: 'OD', status: 'PROVISIONAL' }, { name: 'Another condition', eye: 'OS', status: 'CONFIRMED' }];
  const symptoms = ['Redness', 'Watering'];
  const medicine = { medicineName: 'Clinician-entered product', strength: 'Recorded strength / form', eye: 'OD', quantity: 1, unitPrice: 0, dosage: 'Recorded dose', frequency: 'Recorded frequency', duration: 'Recorded duration', instructions: 'Recorded instructions' };
  const visit = (await post('/visits', { patient: patient._id, diagnoses, symptoms, eyeExamination: investigation, medicines: [medicine] }).expect(201)).body.data;
  expect(visit).toMatchObject({ diagnoses, symptoms, eyeExamination: investigation, medicines: [medicine] });
  const printed = (await get(`/receipts/visit/${visit._id}`).expect(200)).body.data;
  expect(printed.visit).toMatchObject({ diagnoses, symptoms, eyeExamination: investigation, medicines: [medicine] });
  expect((await get(`/visits?patient=${patient._id}`).expect(200)).body.data[0].diagnoses).toEqual(diagnoses);
  const noPrescription = (await post('/visits', { patient: patient._id, diagnoses }).expect(201)).body.data;
  expect(noPrescription.medicines).toEqual([]);
  for (const payload of [
    { diagnoses: [{ name: ' ', eye: 'OD', status: 'CONFIRMED' }] },
    { diagnoses: [{ name: 'Condition', eye: 'INVALID', status: 'CONFIRMED' }] },
    { diagnoses: [{ name: 'Condition', eye: 'OD', status: 'INVALID' }] },
    { medicines: [{ ...medicine, eye: 'INVALID' }] },
    { eyeExamination: { rightEye: { iop: -1 } } },
  ]) await post('/visits', { patient: patient._id, ...payload }).expect(400);
});
