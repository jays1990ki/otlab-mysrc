import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString('hex');
export const digest = text => createHash('sha256').update(text).digest('hex');
export const validName = name => typeof name === 'string' && /^[a-z0-9_.-]{3,48}$/.test(name);
export const validPassword = password => typeof password === 'string' && password.length >= 12 && password.length <= 128;
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return salt + ':' + derived.toString('hex');
}
export async function checkPassword(password, saved) {
  if (typeof password !== 'string' || password.length > 128 || !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(saved || '')) return false;
  const [salt, expected] = saved.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
