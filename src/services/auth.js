import { first, query } from '../db/index.js';
import { digest, httpError } from './security.js';

export const secureCookies = () => process.env.COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production';
export const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: secureCookies(), path: '/' });
export function getCookie(req, name) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='));
  return value?.slice(name.length + 1) || '';
}
export async function identify(req, res, next) {
  try {
    const raw = getCookie(req, 'ot_session');
    req.user = /^[a-f0-9]{64}$/.test(raw) ? await first(
      'SELECT u.id,u.username,u.display_name,u.role,s.token,s.csrf FROM ot_sessions s JOIN ot_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1',
      [digest(raw),Date.now()]) : undefined;
    if (req.user) await query('UPDATE ot_sessions SET last_seen=? WHERE token=?', [Date.now(),req.user.token]);
    res.locals.user = req.user;
    res.locals.csrf = req.user?.csrf || '';
    next();
  } catch (error) { next(error); }
}
export function requireUser(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith('/api/')) return next(httpError(401,'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'));
  res.redirect('/login');
}
export function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  next(httpError(403,'หน้านี้สำหรับผู้ดูแลระบบ'));
}
export function verifyCsrf(req, res, next) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  if (req.path === '/login') return next();
  const submitted = req.get('x-csrf-token') || req.body?.csrf;
  if (!req.user || submitted !== req.user.csrf) return next(httpError(403,'คำขอหมดอายุ กรุณาเปิดหน้าใหม่'));
  next();
}
