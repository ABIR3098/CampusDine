const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { noticeScope } = require("../noticeScope");
const router = express.Router();
const TYPES = new Set(["maintenance","cleaning","laundry","guest","lost_found","facility_booking","feedback","emergency","event","leave","complaint","incident"]);
const STATUSES = new Set(["submitted","approved","in_progress","resolved","rejected","cancelled"]);
const sendNotice = async (userId,title,body,kind='service') => {
  await pool.query('INSERT INTO hall_notifications(user_id,title,body,kind) VALUES(?,?,?,?)',[userId,title,body,kind]);
  try { const io=global.__campusdineHallIO; if(io) io.to(`user:${userId}`).emit('hall:notification',{title,body,kind,createdAt:new Date().toISOString()});
    if(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS){const [u]=await pool.query('SELECT email FROM users WHERE id=?',[userId]);if(u[0]?.email){const nodemailer=require('nodemailer');const t=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});await t.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:u[0].email,subject:`CampusDine Hall: ${title}`,text:body});}}
  } catch(e){console.warn('Hall notification delivery failed:',e.message);}
};
const audit = async (userId, action, type, id, details={}) => {
  const [tenant] = await pool.query('SELECT university_id FROM users WHERE id=?',[userId]);
  await pool.query("INSERT INTO hall_audit_log (user_id,action,entity_type,entity_id,details,university_id) VALUES (?,?,?,?,?,?)",
    [userId, action, type, id || null, JSON.stringify(details), tenant[0]?.university_id || null]);
};

// Hall service requests: students can create and see their own; admins can manage all.
router.get("/services", catchAsync(async (req,res) => {
  const type = String(req.query.type || "");
  if (type && !TYPES.has(type)) return res.status(400).json({error:"Invalid service type"});
  const admin = req.user.role === "admin";
  const where = []; const args = [];
  if (!admin) { where.push("r.user_id = ?"); args.push(req.user.id); } else if (req.user.universityId) { where.push('r.university_id = ?'); args.push(req.user.universityId); }
  if (type) { where.push("r.type = ?"); args.push(type); }
  if (req.query.status && STATUSES.has(String(req.query.status))) { where.push("r.status = ?"); args.push(String(req.query.status)); }
  const sql = `SELECT r.id,r.user_id,r.type,r.title,r.description,r.location,DATE_FORMAT(r.requested_date,'%Y-%m-%d') requested_date,r.status,r.admin_note,r.created_at,r.updated_at,u.name AS student_name,u.external_id AS student_id
    FROM hall_requests r LEFT JOIN users u ON u.id=r.user_id ${where.length ? "WHERE "+where.join(" AND ") : ""}
    ORDER BY FIELD(r.status,'submitted','approved','in_progress','resolved','rejected','cancelled'),r.created_at DESC LIMIT 300`;
  const [rows] = await pool.query(sql,args); res.json(rows);
}));
router.post("/services", catchAsync(async (req,res) => {
  const b=req.body||{}, type=String(b.type||"");
  const title=String(b.title||"").trim(), description=String(b.description||"").trim(), location=String(b.location||"").trim();
  if (!TYPES.has(type)) return res.status(400).json({error:"Choose a valid service type"});
  if (title.length<3 || title.length>180) return res.status(400).json({error:"Title must be 3–180 characters"});
  if (description.length>5000 || location.length>180) return res.status(400).json({error:"Description or location is too long"});
  const date=b.requestedDate ? String(b.requestedDate) : null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({error:"Date must be YYYY-MM-DD"});
  const [r]=await pool.query("INSERT INTO hall_requests (user_id,type,title,description,location,requested_date,university_id) VALUES (?,?,?,?,?,?,?)",
    [req.user.id,type,title,description||null,location||null,date,req.user.universityId||null]);
  await audit(req.user.id,"created",type,r.insertId,{title});
  await sendNotice(req.user.id,"Hall request submitted",`Your ${type.replaceAll("_"," ")} request #${r.insertId} was submitted.`);
  const [admins] = await pool.query("SELECT id FROM users WHERE role='admin' AND (? IS NULL OR university_id=?)",[req.user.universityId||null,req.user.universityId||null]);
  for (const a of admins) await sendNotice(a.id,'New Hall service request',`A student submitted ${type.replaceAll("_"," ")} request #${r.insertId}.`,'admin_action');
  res.status(201).json({id:r.insertId,type,title,status:"submitted",message:"Request submitted"});
}));
router.patch("/services/:id", requireRole("admin"), catchAsync(async(req,res)=>{
  const id=Number(req.params.id), b=req.body||{}, status=String(b.status||"");
  if(!Number.isSafeInteger(id)||id<1) return res.status(400).json({error:"Invalid request ID"});
  if(!STATUSES.has(status)) return res.status(400).json({error:"Invalid status"});
  const note=String(b.adminNote||"").trim().slice(0,500);
  const [r]=await pool.query("UPDATE hall_requests SET status=?,admin_note=? WHERE id=? AND (? IS NULL OR university_id=?)",[status,note||null,id,req.user.universityId||null,req.user.universityId||null]);
  if(!r.affectedRows) return res.status(404).json({error:"Request not found"});
  await audit(req.user.id,"status_changed","request",id,{status,adminNote:note});
  const [owner]=await pool.query("SELECT user_id FROM hall_requests WHERE id=?",[id]); if(owner.length) await sendNotice(owner[0].user_id,"Hall request updated",`Your request #${id} status is now ${status}.`);
  res.json({id,status,adminNote:note});
}));
router.delete("/services/:id", catchAsync(async(req,res)=>{
  const id=Number(req.params.id);
  const [rows]=await pool.query("SELECT id,user_id,status,type,university_id FROM hall_requests WHERE id=? AND (? IS NULL OR university_id=?)",[id,req.user.universityId||null,req.user.universityId||null]);
  if(!rows.length) return res.status(404).json({error:"Request not found"});
  const r=rows[0];
  if(req.user.role!=="admin" && Number(r.user_id)!==Number(req.user.id)) return res.status(403).json({error:"Not allowed"});
  if(req.user.role!=="admin" && !["submitted","approved"].includes(r.status)) return res.status(400).json({error:"This request can no longer be cancelled"});
  await pool.query("UPDATE hall_requests SET status='cancelled' WHERE id=? AND (? IS NULL OR university_id=?)",[id,req.user.universityId||null,req.user.universityId||null]);
  await audit(req.user.id,"cancelled","request",id,{type:r.type});
  res.json({id,status:"cancelled"});
}));

router.get("/notices", catchAsync(async(req,res)=>{
  const scope=noticeScope(req.user.universityId);
  const [rows]=await pool.query(`SELECT id,title,body,category,pinned,expires_at,created_at FROM hall_notices WHERE (expires_at IS NULL OR expires_at > NOW()) AND ${scope.sql} ORDER BY pinned DESC,created_at DESC LIMIT 100`,scope.params);
  res.json(rows);
}));
router.post("/notices", requireRole("admin"), catchAsync(async(req,res)=>{
  const b=req.body||{}, title=String(b.title||"").trim(), body=String(b.body||"").trim(), category=String(b.category||"General").trim().slice(0,50);
  if(title.length<3||title.length>180||!body||body.length>10000) return res.status(400).json({error:"Enter a title and notice body"});
  const expiry=b.expiresAt?new Date(b.expiresAt):null;
  if(expiry && Number.isNaN(expiry.getTime())) return res.status(400).json({error:"Invalid expiry date"});
  const [r]=await pool.query("INSERT INTO hall_notices (title,body,category,pinned,expires_at,created_by,university_id) VALUES (?,?,?,?,?,?,?)",
    [title,body,category,b.pinned?1:0,expiry,req.user.id,req.user.universityId||null]);
  await audit(req.user.id,"created","notice",r.insertId,{title});
  res.status(201).json({id:r.insertId,title,body,category,pinned:!!b.pinned});
}));
router.delete("/notices/:id", requireRole("admin"), catchAsync(async(req,res)=>{
  await pool.query("DELETE FROM hall_notices WHERE id=? AND (? IS NULL OR university_id=?)",[Number(req.params.id),req.user.universityId||null,req.user.universityId||null]);
  await audit(req.user.id,"deleted","notice",Number(req.params.id));
  res.json({ok:true});
}));

router.get("/inventory", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query("SELECT * FROM hall_inventory WHERE (? IS NULL OR university_id=?) ORDER BY category,item_name",[req.user.universityId||null,req.user.universityId||null]); res.json(rows);
}));
router.post("/inventory", requireRole("admin"), catchAsync(async(req,res)=>{
  const b=req.body||{}, name=String(b.itemName||"").trim(), category=String(b.category||"General").trim().slice(0,80), unit=String(b.unit||"pcs").trim().slice(0,30);
  const quantity=Number(b.quantity), min=Number(b.minQuantity||0);
  if(!name||name.length>180||!Number.isFinite(quantity)||quantity<0||!Number.isFinite(min)||min<0) return res.status(400).json({error:"Enter a valid item and non-negative quantities"});
  const [existing] = await pool.query('SELECT id FROM hall_inventory WHERE item_name=? AND university_id <=> ? LIMIT 1',[name,req.user.universityId||null]);
  if(existing.length) await pool.query('UPDATE hall_inventory SET category=?,quantity=?,unit=?,min_quantity=?,updated_by=? WHERE id=?',[category,quantity,unit,min,req.user.id,existing[0].id]);
  else await pool.query('INSERT INTO hall_inventory(item_name,category,quantity,unit,min_quantity,updated_by,university_id) VALUES(?,?,?,?,?,?,?)',[name,category,quantity,unit,min,req.user.id,req.user.universityId||null]);
  await audit(req.user.id,"upserted","inventory",null,{name,quantity,unit});
  res.json({ok:true});
}));
router.delete("/inventory/:id", requireRole("admin"), catchAsync(async(req,res)=>{
  await pool.query("DELETE FROM hall_inventory WHERE id=? AND (? IS NULL OR university_id=?)",[Number(req.params.id),req.user.universityId||null,req.user.universityId||null]); res.json({ok:true});
}));

router.get("/students", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query("SELECT id,name,external_id,email,department,hall_name,room_number,hall_id,phone,account_type FROM users WHERE role='student' AND account_type='hall' AND (? IS NULL OR university_id=?) ORDER BY hall_name,room_number,name LIMIT 1000",[req.user.universityId||null,req.user.universityId||null]);
  res.json(rows);
}));
router.patch("/students/:id/room", requireRole("admin"), catchAsync(async(req,res)=>{
  const id=Number(req.params.id), b=req.body||{};
  const hallName=String(b.hallName||"").trim().slice(0,60), roomNumber=String(b.roomNumber||"").trim().slice(0,20), hallId=String(b.hallId||"").trim().slice(0,20);
  if(!Number.isSafeInteger(id)||id<1||!hallName||!roomNumber) return res.status(400).json({error:"Hall name and room number are required"});
  try {
    const [r]=await pool.query("UPDATE users SET hall_name=?,room_number=?,hall_id=? WHERE id=? AND role='student' AND account_type='hall' AND (? IS NULL OR university_id=?)",[hallName,roomNumber,hallId||null,id,req.user.universityId||null,req.user.universityId||null]);
    if(!r.affectedRows) return res.status(404).json({error:"Hall student not found"});
    await audit(req.user.id,"room_assigned","hall_student",id,{hallName,roomNumber,hallId});
    res.json({ok:true,id,hallName,roomNumber,hallId:hallId||null});
  } catch(e) {
    if(e.code==="ER_DUP_ENTRY") return res.status(409).json({error:"That Hall ID is already assigned"});
    throw e;
  }
}));

router.get("/overview", requireRole("admin"), catchAsync(async(req,res)=>{
  const [[counts]] = await pool.query(`SELECT
    (SELECT COUNT(*) FROM hall_requests WHERE status IN ('submitted','approved','in_progress') AND (? IS NULL OR university_id=?)) open_requests,
    (SELECT COUNT(*) FROM hall_requests WHERE type='maintenance' AND status NOT IN ('resolved','rejected','cancelled') AND (? IS NULL OR university_id=?)) maintenance_open,
    (SELECT COUNT(*) FROM hall_requests WHERE type='guest' AND status='submitted' AND (? IS NULL OR university_id=?)) guest_pending,
    (SELECT COUNT(*) FROM hall_requests WHERE type='feedback' AND created_at >= DATE_SUB(NOW(),INTERVAL 30 DAY) AND (? IS NULL OR university_id=?)) feedback_30d,
    (SELECT COUNT(*) FROM hall_notices WHERE (expires_at IS NULL OR expires_at>NOW()) AND (? IS NULL OR university_id=?)) active_notices,
    (SELECT COUNT(*) FROM hall_inventory WHERE quantity<=min_quantity AND (? IS NULL OR university_id=?)) low_stock`,Array(6).fill(req.user.universityId||null).flatMap(x=>[x,x]));
  res.json(counts);
}));
router.get("/audit", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query("SELECT a.id,a.user_id,u.name AS actor,a.action,a.entity_type,a.entity_id,a.details,a.created_at FROM hall_audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE (? IS NULL OR a.university_id=?) ORDER BY a.created_at DESC LIMIT 200",[req.user.universityId||null,req.user.universityId||null]);
  res.json(rows);
}));

// Food-waste recording and a simple historical demand estimate (no AI service/API required).

// Meal pickup QR/token. The token only verifies collection; it never charges a wallet.
router.get("/pickup-tokens", catchAsync(async(req,res)=>{
  const date=String(req.query.date||new Date().toISOString().slice(0,10));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({error:"Date must be YYYY-MM-DD"});
  const admin=req.user.role==="admin";
  const [rows]=await pool.query(`SELECT t.id,t.user_id,t.the_date,t.slot,t.token_code,t.status,t.created_at,t.served_at,u.name AS student_name,u.external_id
    FROM hall_pickup_tokens t LEFT JOIN users u ON u.id=t.user_id
    WHERE t.the_date=? AND (? IS NULL OR t.university_id=?) ${admin?"":"AND t.user_id=?"} ORDER BY FIELD(t.slot,'breakfast','lunch','dinner'),t.created_at`,
    admin?[date,req.user.universityId||null,req.user.universityId||null]:[date,req.user.universityId||null,req.user.universityId||null,req.user.id]);
  res.json(rows);
}));
router.post("/pickup-tokens", requireRole("student","teacher"), catchAsync(async(req,res)=>{
  const b=req.body||{}, slot=String(b.slot||""), date=String(b.date||new Date().toISOString().slice(0,10));
  if(!["breakfast","lunch","dinner"].includes(slot)||!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({error:"Choose a valid date and meal"});
  const [meal]=await pool.query("SELECT status FROM hall_meal_state WHERE user_id=? AND the_date=? AND slot=?",[req.user.id,date,slot]);
  if(!meal.length||meal[0].status!=="on") return res.status(400).json({error:"Turn this meal ON before creating a pickup token"});
  const crypto=require("crypto"), code=crypto.randomBytes(6).toString("hex").toUpperCase();
  await pool.query(`INSERT INTO hall_pickup_tokens(user_id,the_date,slot,token_code,university_id) VALUES(?,?,?,?,?)
    ON DUPLICATE KEY UPDATE token_code=IF(status='served',token_code,VALUES(token_code))`,
    [req.user.id,date,slot,code,req.user.universityId||null]);
  const [rows]=await pool.query("SELECT id,user_id,the_date,slot,token_code,status,created_at,served_at FROM hall_pickup_tokens WHERE user_id=? AND the_date=? AND slot=?",[req.user.id,date,slot]);
  res.status(201).json(rows[0]);
}));
router.patch("/pickup-tokens/:code/serve", requireRole("admin"), catchAsync(async(req,res)=>{
  const code=String(req.params.code||"").toUpperCase().slice(0,24);
  const [r]=await pool.query("UPDATE hall_pickup_tokens SET status='served',served_by=?,served_at=NOW() WHERE token_code=? AND status='issued' AND (? IS NULL OR university_id=?)",[req.user.id,code,req.user.universityId||null,req.user.universityId||null]);
  if(!r.affectedRows) return res.status(404).json({error:"Token not found or already served"});
  await audit(req.user.id,"served","pickup_token",null,{code});
  res.json({ok:true,status:"served"});
}));

router.get("/waste", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query("SELECT id,DATE_FORMAT(waste_date,'%Y-%m-%d') waste_date,slot,prepared_plates,served_plates,wasted_plates,notes,created_at FROM hall_food_waste WHERE (? IS NULL OR university_id=?) ORDER BY waste_date DESC,FIELD(slot,'breakfast','lunch','dinner') LIMIT 120",[req.user.universityId||null,req.user.universityId||null]);
  res.json(rows);
}));
router.post("/waste", requireRole("admin"), catchAsync(async(req,res)=>{
  const b=req.body||{}, date=String(b.date||""), slot=String(b.slot||"");
  const prepared=Number(b.preparedPlates), served=Number(b.servedPlates), wasted=Number(b.wastedPlates);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!["breakfast","lunch","dinner"].includes(slot)||
    ![prepared,served,wasted].every(Number.isInteger)||prepared<0||served<0||wasted<0||served+wasted>prepared)
    return res.status(400).json({error:"Use a valid date, meal and whole-plate counts; served + wasted cannot exceed prepared"});
  const notes=String(b.notes||"").trim().slice(0,500);
  const [r]=await pool.query("INSERT INTO hall_food_waste(waste_date,slot,prepared_plates,served_plates,wasted_plates,notes,recorded_by,university_id) VALUES(?,?,?,?,?,?,?,?)",
    [date,slot,prepared,served,wasted,notes||null,req.user.id,req.user.universityId||null]);
  await audit(req.user.id,"recorded","food_waste",r.insertId,{date,slot,prepared,served,wasted});
  res.status(201).json({id:r.insertId,date,slot,preparedPlates:prepared,servedPlates:served,wastedPlates:wasted});
}));
router.get("/forecast", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query(`SELECT DAYOFWEEK(the_date) dow,slot,AVG(daily_count) avg_plates,COUNT(*) sample_days FROM
    (SELECT the_date,slot,SUM(CASE WHEN status='on' THEN 1 ELSE 0 END)+SUM(guest_count) daily_count
     FROM hall_meal_state JOIN users ON users.id=hall_meal_state.user_id LEFT JOIN hall_guests USING(user_id,the_date,slot)
     WHERE (? IS NULL OR users.university_id=?) AND hall_meal_state.the_date >= DATE_SUB(CURDATE(),INTERVAL 56 DAY) AND hall_meal_state.the_date < CURDATE()
     GROUP BY hall_meal_state.the_date,hall_meal_state.slot) d GROUP BY dow,slot`,[req.user.universityId||null,req.user.universityId||null]);
  const [todayRows]=await pool.query("SELECT DAYOFWEEK(CURDATE()) dow");
  const dow=Number(todayRows[0].dow);
  res.json(["breakfast","lunch","dinner"].map(slot=>{
    const r=rows.find(x=>Number(x.dow)===dow&&x.slot===slot);
    return {slot,estimatedPlates:r?Math.max(0,Math.round(Number(r.avg_plates))):0,sampleDays:r?Number(r.sample_days):0,confidence:r&&Number(r.sample_days)>=4?"moderate":"low"};
  }));
}));

module.exports=router;
