import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { ready, query, audit } from './db/index.js';
import { identify, verifyCsrf } from './services/auth.js';
import { httpError, token } from './services/security.js';
import { authRouter } from './routes/auth.js';
import { labRouter } from './routes/labs.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app=express();
  app.disable('x-powered-by');
  app.set('view engine','ejs');
  app.set('views',fileURLToPath(new URL('./views',import.meta.url)));
  app.use(helmet({
    contentSecurityPolicy:{directives:{'default-src':["'self'"],'script-src':["'self'"],'style-src':["'self'"],'img-src':["'self'"],'form-action':["'self'"],'frame-ancestors':["'none'"],'upgrade-insecure-requests':process.env.NODE_ENV==='production'?[]:null}},
    strictTransportSecurity:process.env.NODE_ENV==='production'
  }));
  app.use('/assets',express.static(fileURLToPath(new URL('../public',import.meta.url)),{index:false,dotfiles:'deny',maxAge:0}));
  app.use((req,res,next)=>{
    res.set('Cache-Control','no-store');
    res.locals.user=null;
    res.locals.csrf='';
    res.locals.settings={site_name:'OT/ICS Basic Lab',organization:'ME Corporation',intro:''};
    res.locals.version='1.1.0';
    next();
  });
  app.use(express.urlencoded({extended:false,limit:'32kb'}));
  app.use(express.json({limit:'8kb'}));
  app.get('/health',async(req,res)=>{
    try {
      await ready();
      await query('SELECT 1');
      res.json({status:'ok',version:'1.1.0',database:'connected'});
    } catch { res.status(503).json({status:'unavailable',version:'1.1.0'}); }
  });
  app.use(async(req,res,next)=>{
    try {
      await ready();
      res.locals.settings=Object.fromEntries((await query('SELECT setting_key,setting_value FROM ot_settings')).map(row=>[row.setting_key,row.setting_value]));
      next();
    } catch(error) {
      console.error('Initialization failed:',error.code || error.message);
      next(httpError(503,'ระบบยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจค่าฐานข้อมูลและ ADMIN_PASSWORD ใน Plesk แล้วกด Restart App'));
    }
  });
  app.use(identify);
  app.use(verifyCsrf);
  app.use(authRouter);
  app.use('/admin',adminRouter);
  app.use(labRouter);
  app.use((req,res,next)=>next(httpError(404,'ไม่พบหน้านี้')));
  app.use(async(error,req,res,next)=>{
    if(res.headersSent) return next(error);
    const status=error.status || (error.type==='entity.too.large'?413:500);
    const reference=token().slice(0,12);
    if(status>=500) {
      console.error('Request failed',reference,error.code || error.message);
      try { await audit(req.user?.username || 'system','SYSTEM_ERROR',reference+' '+(error.code || 'INTERNAL_ERROR')); } catch {}
    }
    const message=status<500 || status===503 ? error.message : 'ระบบทำรายการไม่สำเร็จ รหัสอ้างอิง '+reference;
    if(req.path.startsWith('/api/')) return res.status(status).json({error:message});
    res.status(status).render('error',{title:'สถานะระบบ',status,message});
  });
  return app;
}
