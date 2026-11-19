import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { first, query, transaction, audit } from '../db/index.js';
import { token, digest, validPassword, checkPassword, hashPassword, httpError } from '../services/security.js';
import { getCookie, cookieOptions, requireUser } from '../services/auth.js';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false, message: 'มีคำขอมากเกินไป กรุณารอหนึ่งนาที' });
function loginPage(req, res, notice = '', status = 200) {
  const nonce = token();
  res.cookie('ot_login', nonce, { ...cookieOptions(), maxAge: 600_000 });
  res.status(status).render('login', { title: 'เข้าสู่ระบบ', nonce, notice });
}
authRouter.get('/login', (req,res) => req.user ? res.redirect('/labs') : loginPage(req,res));
authRouter.post('/login', limiter, async (req,res) => {
  if (!getCookie(req,'ot_login') || getCookie(req,'ot_login') !== req.body.login_token) return loginPage(req,res,'กรุณาลองเข้าสู่ระบบใหม่',403);
  const username = String(req.body.username || '').trim().toLowerCase();
  if (username.length > 48) return loginPage(req,res,'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',401);
  const identity = digest(username);
  const now = Date.now();
  const limit = await first('SELECT * FROM ot_login_limits WHERE identity=?', [identity]);
  if (limit && Number(limit.expires_at) > now && limit.failures >= 10) return loginPage(req,res,'ลองเข้าสู่ระบบอีกครั้งใน 15 นาที',429);
  const user = await first('SELECT * FROM ot_users WHERE username=?', [username]);
  if (!user?.active || !await checkPassword(req.body.password,user.password_hash)) {
    await query('INSERT INTO ot_login_limits(identity,failures,expires_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE failures=IF(expires_at>?,failures+1,1),expires_at=IF(expires_at>?,expires_at,?)',
      [identity,now+900_000,now,now,now+900_000]);
    await audit(username || 'unknown','LOGIN_FAILED');
    return loginPage(req,res,'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',401);
  }
  const raw = token();
  await transaction(async connection => {
    const current = await first('SELECT active,password_hash FROM ot_users WHERE id=? FOR UPDATE',[user.id],connection);
    if (!current?.active || current.password_hash !== user.password_hash) throw httpError(401,'บัญชีมีการเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
    if (req.user) await query('DELETE FROM ot_sessions WHERE token=?',[req.user.token],connection);
    await query('DELETE FROM ot_sessions WHERE expires_at<=?',[now],connection);
    await query('DELETE FROM ot_login_limits WHERE expires_at<=? OR identity=?',[now,identity],connection);
    await query('INSERT INTO ot_sessions(token,user_id,csrf,expires_at,last_seen) VALUES(?,?,?,?,?)',[digest(raw),user.id,token(),now+28_800_000,now],connection);
    await audit(username,'LOGIN','',connection);
  });
  res.cookie('ot_session',raw,{...cookieOptions(),maxAge:28_800_000});
  res.clearCookie('ot_login',cookieOptions());
  res.redirect(user.role === 'admin' ? '/admin' : '/labs');
});
authRouter.post('/logout',requireUser,async(req,res)=>{
  await transaction(async connection=>{
    await query('DELETE FROM ot_sessions WHERE token=?',[req.user.token],connection);
    await audit(req.user.username,'LOGOUT','',connection);
  });
  res.clearCookie('ot_session',cookieOptions());
  res.redirect('/');
});
authRouter.get('/account',requireUser,(req,res)=>res.render('account',{title:'บัญชีของฉัน',notice:''}));
authRouter.post('/account',requireUser,async(req,res)=>{
  const user=await first('SELECT password_hash FROM ot_users WHERE id=?',[req.user.id]);
  if (!await checkPassword(req.body.current_password,user.password_hash)) throw httpError(400,'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  if (!validPassword(req.body.password) || req.body.password !== req.body.confirm_password) throw httpError(400,'รหัสผ่านใหม่ต้องมี 12–128 ตัวอักษร และยืนยันให้ตรงกัน');
  const password = await hashPassword(req.body.password);
  await transaction(async connection=>{
    const current = await first('SELECT password_hash FROM ot_users WHERE id=? FOR UPDATE',[req.user.id],connection);
    if (current.password_hash !== user.password_hash) throw httpError(409,'บัญชีถูกเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
    await query('UPDATE ot_users SET password_hash=? WHERE id=?',[password,req.user.id],connection);
    await query('DELETE FROM ot_sessions WHERE user_id=?',[req.user.id],connection);
    await audit(req.user.username,'PASSWORD_CHANGED','',connection);
  });
  res.clearCookie('ot_session',cookieOptions());
  res.redirect('/login');
});
