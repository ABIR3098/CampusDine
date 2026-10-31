const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { createOtp, verifyOtp } = require("../utils/otp");
const { sendOtpEmail } = require("../utils/mailer");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createAttemptLock } = require("../utils/attemptLock");
const router = express.Router();
// 5 wrong passwords for the same ID from the same address lock Hall Admin login for 10 minutes.
const hallLoginLock = createAttemptLock({ max: 5, lockMs: 10 * 60 * 1000 });
setInterval(() => hallLoginLock.sweep(), 5 * 60 * 1000).unref();
const clean = v => typeof v === "string" ? v.trim() : "";
async function schema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS hall_admin_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, item_type ENUM('complaint','service','notice','incident','leave','visitor','booking','lost_found','event') NOT NULL,
    title VARCHAR(180) NOT NULL, details TEXT NULL, status VARCHAR(32) NOT NULL DEFAULT 'Pending',
    student_id INT NULL, created_by INT NOT NULL, assigned_to VARCHAR(120) NULL, expires_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_hall_item_type_status(item_type,status), KEY idx_hall_created(created_at)
  )`);
}
async function withHallAdminRegistrationLock(createAccount) {
  const conn = await pool.getConnection();
  let acquired = false;
  try {
    const [[result]] = await conn.query("SELECT GET_LOCK(?, 10) AS acquired", ["campusdine_hall_admin_registration"]);
    if (Number(result.acquired) !== 1) {
      const error = new Error("Hall Admin registration is busy. Please try again.");
      error.status = 503;
      throw error;
    }
    acquired = true;
    const [[count]] = await conn.query("SELECT COUNT(*) AS n FROM users WHERE role='hall_admin'");
    if (Number(count.n) > 0) return null;
    return await createAccount(conn);
  } finally {
    try {
      if (acquired) await conn.query("SELECT RELEASE_LOCK(?)", ["campusdine_hall_admin_registration"]);
    } finally {
      conn.release();
    }
  }
}
router.post('/auth/send-otp', async (req,res,next)=>{ try {
  await schema(); const email=clean(req.body.email).toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:'Enter a valid email address'});
  const [[count]]=await pool.query("SELECT COUNT(*) AS n FROM users WHERE role='hall_admin'");
  if(Number(count.n)>0) return res.status(409).json({error:'Hall Admin account already exists. Only one is allowed.'});
  const otp=await createOtp(pool,email,'signup'); if(!otp.ok) return res.status(otp.status).json({error:otp.error});
  const mail=await sendOtpEmail(email,otp.code,'signup',otp.expiresInMin);
  res.json({success:true,emailed:!!mail.sent,message:mail.sent?'OTP sent to email':'Email not configured; check backend console only in development'});
  if(!mail.sent && process.env.NODE_ENV!=='production') console.log(`[Hall Admin OTP for ${email}] ${otp.code}`);
 }catch(e){next(e)}});
router.post('/auth/register', async(req,res,next)=>{try{
 await schema(); const name=clean(req.body.name), email=clean(req.body.email).toLowerCase(), externalId=clean(req.body.externalId), password=String(req.body.password||''), otpCode=clean(req.body.otp);
 if(!name||!email||!externalId||password.length<8) return res.status(400).json({error:'Name, email, ID and password (minimum 8 characters) are required'});
 const [[count]]=await pool.query("SELECT COUNT(*) AS n FROM users WHERE role='hall_admin'"); if(Number(count.n)>0) return res.status(409).json({error:'Hall Admin account already exists'});
 const [existing]=await pool.query('SELECT id FROM users WHERE external_id=? OR email=?',[externalId,email]); if(existing.length) return res.status(409).json({error:'ID or email is already registered'});
 const checked=await verifyOtp(pool,email,'signup',otpCode); if(!checked.ok) return res.status(checked.status).json({error:checked.error});
 const hash=await bcrypt.hash(password,12);
 const id=await withHallAdminRegistrationLock(async conn=>{
  const [r]=await conn.query("INSERT INTO users (name,email,external_id,role,password_hash,wallet_balance,account_type) VALUES (?,?,?,'hall_admin',?,0,'regular')",[name,email,externalId,hash]);
  return r.insertId;
 });
 if(!id)return res.status(409).json({error:'Hall Admin account already exists'});
 res.status(201).json({success:true,message:'Hall Admin account created. Please log in.',id});
}catch(e){next(e)}});
router.post('/auth/login', async(req,res,next)=>{try{
 const id=clean(req.body.identifier), password=String(req.body.password||''); if(!id||!password)return res.status(400).json({error:'Enter ID/email and password'});
 const lockKey=`${req.ip}|${id.toLowerCase()}`, wait=hallLoginLock.lockedFor(lockKey);
 if(wait>0)return res.status(429).json({error:`Too many failed attempts. Try again in ${Math.ceil(wait/60000)} minute(s).`});
 const [rows]=await pool.query("SELECT * FROM users WHERE role='hall_admin' AND (external_id=? OR email=?) LIMIT 1",[id,id.toLowerCase()]);
 const user=rows[0]; if(!user||!(await bcrypt.compare(password,user.password_hash))){hallLoginLock.noteFail(lockKey);return res.status(401).json({error:'Invalid Hall Admin credentials'});}
 hallLoginLock.clear(lockKey);
 const otp=await createOtp(pool,user.email,'login2fa'); if(!otp.ok) return res.status(otp.status).json({error:otp.error});
 const mail=await sendOtpEmail(user.email,otp.code,'login2fa',otp.expiresInMin); if(!mail.sent && process.env.NODE_ENV!=='production') console.log(`[Hall Admin login OTP for ${user.email}] ${otp.code}`);
 const challenge=jwt.sign({uid:user.id,purpose:'hall_admin_login'},process.env.JWT_SECRET,{expiresIn:'10m'});
 res.json({otpRequired:true,challenge,emailed:!!mail.sent,email:user.email.replace(/^(.).*?(@.*)$/,'$1***$2')});
}catch(e){next(e)}});
router.post('/auth/verify-login', async(req,res,next)=>{try{
 let c; try{c=jwt.verify(String(req.body.challenge||''),process.env.JWT_SECRET)}catch(_){return res.status(401).json({error:'Login challenge expired'})}
 if(c.purpose!=='hall_admin_login')return res.status(401).json({error:'Invalid login challenge'});
 const [rows]=await pool.query("SELECT * FROM users WHERE id=? AND role='hall_admin'",[c.uid]); const user=rows[0]; if(!user)return res.status(401).json({error:'Hall Admin account not found'});
 const checked=await verifyOtp(pool,user.email,'login2fa',req.body.otp); if(!checked.ok)return res.status(checked.status).json({error:checked.error});
 const token=jwt.sign({id:user.id,name:user.name,role:'hall_admin'},process.env.JWT_SECRET,{expiresIn:'8h'});
 res.json({token,user:{id:user.id,name:user.name,email:user.email,role:'hall_admin'}});
}catch(e){next(e)}});
router.use(verifyToken,requireRole('hall_admin'));
router.get('/requests',async(req,res,next)=>{try{
 const [rows]=await pool.query(`SELECT r.id,r.user_id,r.type,r.title,r.description,r.location,DATE_FORMAT(r.requested_date,'%Y-%m-%d') requested_date,r.status,r.admin_note,r.created_at,r.updated_at,u.name AS student_name,u.external_id AS student_external_id FROM hall_requests r LEFT JOIN users u ON u.id=r.user_id ORDER BY FIELD(r.status,'submitted','approved','in_progress','resolved','rejected','cancelled'),r.created_at DESC LIMIT 300`);
 res.json(rows);
}catch(e){next(e)}});
router.patch('/requests/:id',async(req,res,next)=>{try{
 const statuses=['submitted','approved','in_progress','resolved','rejected','cancelled']; const status=clean(req.body.status); const note=clean(req.body.adminNote).slice(0,500);
 if(!statuses.includes(status))return res.status(400).json({error:'Invalid request status'});
 const [r]=await pool.query('UPDATE hall_requests SET status=?,admin_note=? WHERE id=?',[status,note||null,Number(req.params.id)]);
 if(!r.affectedRows)return res.status(404).json({error:'Student request not found'});
 const [[owner]]=await pool.query('SELECT user_id FROM hall_requests WHERE id=?',[Number(req.params.id)]);
 if(owner){await pool.query('INSERT INTO hall_notifications(user_id,title,body,kind) VALUES(?,?,?,?)',[owner.user_id,'Hall request updated',`Your hall request #${req.params.id} status is now ${status.replaceAll('_',' ')}.`,'service']);}
 res.json({success:true,id:Number(req.params.id),status});
}catch(e){next(e)}});
router.get('/notices',async(req,res,next)=>{try{const [rows]=await pool.query('SELECT id,title,body,category,pinned,expires_at,created_at FROM hall_notices WHERE expires_at IS NULL OR expires_at>NOW() ORDER BY pinned DESC,created_at DESC LIMIT 200');res.json(rows)}catch(e){next(e)}});
router.post('/notices',async(req,res,next)=>{try{const title=clean(req.body.title),body=clean(req.body.body),category=clean(req.body.category)||'General';if(title.length<3||!body)return res.status(400).json({error:'Notice title and body are required'});const expiry=req.body.expires_at||null;const [r]=await pool.query('INSERT INTO hall_notices(title,body,category,pinned,expires_at,created_by) VALUES(?,?,?,?,?,?)',[title,body,category,req.body.pinned?1:0,expiry,req.user.id]);res.status(201).json({success:true,id:r.insertId})}catch(e){next(e)}});
router.delete('/notices/:id',async(req,res,next)=>{try{await pool.query('DELETE FROM hall_notices WHERE id=?',[Number(req.params.id)]);res.json({success:true})}catch(e){next(e)}});
router.get('/dashboard',async(req,res,next)=>{try{await schema(); const [counts]=await pool.query("SELECT item_type,status,COUNT(*) AS total FROM hall_admin_items GROUP BY item_type,status"); const [recent]=await pool.query('SELECT * FROM hall_admin_items ORDER BY created_at DESC LIMIT 100');res.json({counts,recent})}catch(e){next(e)}});
router.post('/items',async(req,res,next)=>{try{await schema(); const allowed=['complaint','service','notice','incident','leave','visitor','booking','lost_found','event']; const type=clean(req.body.item_type),title=clean(req.body.title),details=clean(req.body.details);if(!allowed.includes(type)||!title)return res.status(400).json({error:'Choose a valid type and enter a title'});const [r]=await pool.query('INSERT INTO hall_admin_items(item_type,title,details,status,student_id,created_by,assigned_to,expires_at) VALUES(?,?,?, ?,?,?,?,?)',[type,title,details||null, 'Pending',req.body.student_id||null,req.user.id,clean(req.body.assigned_to)||null,req.body.expires_at||null]);res.status(201).json({success:true,id:r.insertId})}catch(e){next(e)}});
router.patch('/items/:id',async(req,res,next)=>{try{const status=clean(req.body.status),allowed=['Pending','In Progress','Resolved','Approved','Rejected','Closed','Pinned'];if(!allowed.includes(status))return res.status(400).json({error:'Invalid status'});const [r]=await pool.query('UPDATE hall_admin_items SET status=?,assigned_to=COALESCE(?,assigned_to) WHERE id=?',[status,req.body.assigned_to?clean(req.body.assigned_to):null,req.params.id]);if(!r.affectedRows)return res.status(404).json({error:'Item not found'});res.json({success:true})}catch(e){next(e)}});
module.exports=router;
