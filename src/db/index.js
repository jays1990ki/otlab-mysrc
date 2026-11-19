import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { hashPassword, validName, validPassword } from '../services/security.js';
import { benchTemplates } from '../services/bench.js';
import { templates } from '../services/simulation.js';

let pool;
let initializing;
export function getPool() {
  if (!pool) {
    for (const name of ['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD']) {
      if (!process.env[name]) throw new Error('Missing configuration: ' + name);
    }
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: true,
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 50,
      connectTimeout: 10000,
      multipleStatements: false
    });
    pool.on('connection', connection => connection.query("SET time_zone = '+00:00'"));
  }
  return pool;
}
export async function query(sql, parameters = [], connection = getPool()) {
  const [rows] = await connection.execute(sql, parameters);
  return rows;
}
export async function first(sql, parameters = [], connection) {
  return (await query(sql, parameters, connection))[0];
}
export async function transaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function audit(actor, action, detail = '', connection) {
  await query('INSERT INTO ot_audit(actor,action,detail) VALUES(?,?,?)', [actor, action, String(detail).slice(0,1000)], connection);
}
async function migrate() {
  const connection = await getPool().getConnection();
  let locked = false;
  try {
    const [lockRows] = await connection.execute("SELECT GET_LOCK(CONCAT('ot_lab_', LEFT(SHA2(DATABASE(),256),40)),30) acquired");
    if (Number(lockRows[0].acquired) !== 1) throw new Error('Database initialization is busy');
    locked = true;
    await connection.query("SET time_zone = '+00:00'");
    const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement);
    const migrations = await first('SELECT version FROM ot_migrations WHERE version=1', [], connection);
    if (!migrations) {
      await connection.beginTransaction();
      try {
        for (const [index, lab] of templates.slice(0,6).entries()) {
          await query('INSERT INTO ot_labs(title,summary,lesson,mission,simulator,image_id,target,sort_order) VALUES(?,?,?,?,?,?,?,?)',
            [lab.title,lab.summary,lab.lesson,lab.mission,lab.key,lab.image,lab.target,index+1],connection);
        }
        await query("INSERT INTO ot_settings(setting_key,setting_value) VALUES('site_name','OT/ICS Basic Lab'),('intro','เรียนรู้ระบบอุตสาหกรรมผ่านแล็บจำลองที่ควบคุมและตรวจผลได้'),('organization','ME Corporation')", [], connection);
        await query('INSERT INTO ot_migrations(version) VALUES(1)', [], connection);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
    }
    if (!await first('SELECT version FROM ot_migrations WHERE version=2', [], connection)) {
      await connection.beginTransaction();
      try {
        const lab = templates.find(template => template.key === 'conveyor');
        await query('INSERT INTO ot_labs(title,summary,lesson,mission,simulator,image_id,target,sort_order) VALUES(?,?,?,?,?,?,?,?)',
          [lab.title,lab.summary,lab.lesson,lab.mission,lab.key,lab.image,lab.target,7],connection);
        await query('INSERT INTO ot_migrations(version) VALUES(2)', [], connection);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
    }
    if (!await first('SELECT version FROM ot_migrations WHERE version=3', [], connection)) {
      await connection.beginTransaction();
      try {
        for(const [index,lab] of benchTemplates.entries()) {
          await query('INSERT INTO ot_labs(title,summary,lesson,mission,simulator,image_id,target,sort_order) VALUES(?,?,?,?,?,?,?,?)',
            [lab.title,lab.summary,lab.lesson,lab.mission,lab.key,lab.image,lab.target,8+index],connection);
        }
        await query('INSERT INTO ot_migrations(version) VALUES(3)', [], connection);
        await connection.commit();
      } catch(error){await connection.rollback();throw error;}
    }
    if (!await first("SELECT id FROM ot_users WHERE role='admin' LIMIT 1", [], connection)) {
      const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
      const password = process.env.ADMIN_PASSWORD;
      if (!validName(username) || !validPassword(password)) throw new Error('Set ADMIN_PASSWORD with 12–128 characters for first installation');
      await query("INSERT INTO ot_users(username,display_name,password_hash,role) VALUES(?,?,?,'admin')", [username,'Administrator',await hashPassword(password)],connection);
      await audit(username,'SYSTEM_INSTALLED','v1.4.0',connection);
    }
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(CONCAT('ot_lab_', LEFT(SHA2(DATABASE(),256),40)))");
    connection.release();
  }
}
export async function ready() {
  if (!initializing) {
    initializing = migrate().catch(error => { initializing = undefined; throw error; });
  }
  await initializing;
}
export async function closeDatabase() {
  if (pool) await pool.end();
  pool = undefined;
  initializing = undefined;
}
