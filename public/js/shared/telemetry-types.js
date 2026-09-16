/**
 * APEX Telemetry Types & Conversion Constants
 */

export const MPS_TO_MPH = 2.236936;
export const MPS_TO_KMH = 3.6;
export const GRAVITY_MS2 = 9.80665;
export const RAD_TO_DEG = 180 / Math.PI;

export const CAR_CLASSES = {
  0: 'E',
  1: 'D',
  2: 'C',
  3: 'B',
  4: 'A',
  5: 'S',
  6: 'R',
  7: 'P',
  8: 'X'
};

export const DRIVETRAIN_TYPES = {
  0: 'FWD',
  1: 'RWD',
  2: 'AWD'
};

/**
 * Normalizes 0..255 byte input to 0..1.0 float (e.g. Accel, Brake, Clutch)
 * @param {number} val 
 * @returns {number}
 */
export function normalizeByteInput(val) {
  if (val === undefined || val === null) return 0;
  return Math.min(1.0, Math.max(0.0, val / 255.0));
}

/**
 * Normalizes -127..127 signed byte steer to -1.0..1.0 float
 * @param {number} val 
 * @returns {number}
 */
export function normalizeSteerInput(val) {
  if (val === undefined || val === null) return 0;
  return Math.min(1.0, Math.max(-1.0, val / 127.0));
}

/**
 * Converts m/s speed to mph
 * @param {number} speedMps 
 * @returns {number}
 */
export function mpsToMph(speedMps) {
  return (speedMps || 0) * MPS_TO_MPH;
}

/**
 * Converts m/s speed to km/h
 * @param {number} speedMps 
 * @returns {number}
 */
export function mpsToKmh(speedMps) {
  return (speedMps || 0) * MPS_TO_KMH;
}

/**
 * Converts acceleration in m/s² to Gs
 * @param {number} accelMs2 
 * @returns {number}
 */
export function accelToG(accelMs2) {
  return (accelMs2 || 0) / GRAVITY_MS2;
}
