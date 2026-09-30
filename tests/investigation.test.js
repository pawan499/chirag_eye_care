import { describe, test, expect } from '@jest/globals';
import { patientInput, patientPatch } from '../src/validators/schemas.js';
import Patient from '../src/models/Patient.js';

describe('registration investigation', () => {
  test('preserves both eyes and zero values through validation and storage', () => {
    const investigation = {
      rightEye: { unaidedVision: '6/18', correctedVision: '6/6', pinholeVision: '6/9', nearVision: 'N6', sph: -1.5, cyl: 0, axis: 0, add: 1.25, iop: 16 },
      leftEye: { unaidedVision: '6/12', correctedVision: '6/6', sph: -1, axis: 180 },
      pd: 62, remarks: 'Review findings',
    };
    const input = patientInput.parse({ name: 'Test patient', investigation });
    const patient = new Patient({ ...input, owner: '507f1f77bcf86cd799439011' });
    expect(patient.validateSync()).toBeUndefined();
    expect(patient.toObject().investigation).toEqual(investigation);
  });
  test('supports old patients, blank investigations and clearing on edit', () => {
    expect(patientInput.parse({ name: 'Test patient' }).investigation).toBeUndefined();
    expect(patientInput.parse({ name: 'Test patient', investigation: { rightEye: {} } }).investigation.rightEye).toEqual({});
    expect(patientPatch.parse({ investigation: null }).investigation).toBeNull();
  });
  test.each([{ axis: 181 }, { iop: -1 }, { sph: 51 }, { correctedVision: 'a'.repeat(41) }])('rejects invalid readings %j', (rightEye) => {
    expect(patientInput.safeParse({ name: 'Test', investigation: { rightEye } }).success).toBe(false);
  });
});
