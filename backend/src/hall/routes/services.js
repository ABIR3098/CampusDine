const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const router = express.Router();
const TYPES = new Set(["maintenance","cleaning","laundry","guest","lost_found","facility_booking","feedback","emergency","event"]);
const STATUSES = new Set(["submitted","approved","in_progress","resolved","rejected","cancelled"]);
const audit = async (userId, action, type, id, details={}) => {
  await pool.query("INSERT INTO hall_audit_log (user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)",
    [userId, action, type, id || null, JSON.stringify(details)]);
};

// Hall service requests: students can create and see their own; admins can manage all.
router.get("/services", catchAsync(async (req,res) => {
  const type = String(req.query.type || "");
  if (type && !TYPES.has(type)) return res.status(400).json({error:"Invalid service type"});
  const admin = req.user.role === "admin";
  const where = []; const args = [];
  if (!admin) { where.push("r.user_id = ?"); args.push(req.user.id); }
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
  const [r]=await pool.query("INSERT INTO hall_requests (user_id,type,title,description,location,requested_date) VALUES (?,?,?,?,?,?)",
    [req.user.id,type,title,description||null,location||null,date]);
  await audit(req.user.id,"created",type,r.insertId,{title});
  res.status(201).json({id:r.insertId,type,title,status:"submitted",message:"Request submitted"});
}));
router.patch("/services/:id", requireRole("admin"), catchAsync(async(req,res)=>{
  const id=Number(req.params.id), b=req.body||{}, status=String(b.status||"");
  if(!Number.isSafeInteger(id)||id<1) return res.status(400).json({error:"Invalid request ID"});
  if(!STATUSES.has(status)) return res.status(400).json({error:"Invalid status"});
  const note=String(b.adminNote||"").trim().slice(0,500);
  const [r]=await pool.query("UPDATE hall_requests SET status=?,admin_note=? WHERE id=?",[status,note||null,id]);
  if(!r.affectedRows) return res.status(404).json({error:"Request not found"});
  await audit(req.user.id,"status_changed","request",id,{status,adminNote:note});
  res.json({id,status,adminNote:note});
}));
router.delete("/services/:id", catchAsync(async(req,res)=>{
  const id=Number(req.params.id);
  const [rows]=await pool.query("SELECT id,user_id,status,type FROM hall_requests WHERE id=?",[id]);
  if(!rows.length) return res.status(404).json({error:"Request not found"});
  const r=rows[0];
  if(req.user.role!=="admin" && Number(r.user_id)!==Number(req.user.id)) return res.status(403).json({error:"Not allowed"});
  if(req.user.role!=="admin" && !["submitted","approved"].includes(r.status)) return res.status(400).json({error:"This request can no longer be cancelled"});
  await pool.query("UPDATE hall_requests SET status='cancelled' WHERE id=?",[id]);
  await audit(req.user.id,"cancelled","request",id,{type:r.type});
  res.json({id,status:"cancelled"});
}));
router.get("/notices", catchAsync(async(req,res)=>{
  const [rows]=await pool.query("SELECT id,title,body,category,pinned,expires_at,created_at FROM hall_notices WHERE expires_at IS NULL OR expires_at > NOW() ORDER BY pinned DESC,created_at DESC LIMIT 100");
  res.json(rows);
}));
router.post("/notices", requireRole("admin"), catchAsync(async(req,res)=>{
  const b=req.body||{}, title=String(b.title||"").trim(), body=String(b.body||"").trim(), category=String(b.category||"General").trim().slice(0,50);
  if(title.length<3||title.length>180||!body||body.length>10000) return res.status(400).json({error:"Enter a title and notice body"});
  const expiry=b.expiresAt?new Date(b.expiresAt):null;
  if(expiry && Number.isNaN(expiry.getTime())) return res.status(400).json({error:"Invalid expiry date"});
  const [r]=await pool.query("INSERT INTO hall_notices (title,body,category,pinned,expires_at,created_by) VALUES (?,?,?,?,?,?)",
    [title,body,category,b.pinned?1:0,expiry,req.user.id]);
  await audit(req.user.id,"created","notice",r.insertId,{title});
  res.status(201).json({id:r.insertId,title,body,category,pinned:!!b.pinned});
}));
router.delete("/notices/:id", requireRole("admin"), catchAsync(async(req,res)=>{
  await pool.query("DELETE FROM hall_notices WHERE id=?",[Number(req.params.id)]);
  await audit(req.user.id,"deleted","notice",Number(req.params.id));
  res.json({ok:true});
}));
router.get("/inventory", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query("SELECT * FROM hall_inventory ORDER BY category,item_name"); res.json(rows);
}));
router.post("/inventory", requireRole("admin"), catchAsync(async(req,res)=>{
  const b=req.body||{}, name=String(b.itemName||"").trim(), category=String(b.category||"General").trim().slice(0,80), unit=String(b.unit||"pcs").trim().slice(0,30);
  const quantity=Number(b.quantity), min=Number(b.minQuantity||0);
  if(!name||name.length>180||!Number.isFinite(quantity)||quantity<0||!Number.isFinite(min)||min<0) return res.status(400).json({error:"Enter a valid item and non-negative quantities"});
  await pool.query(`INSERT INTO hall_inventory(item_name,category,quantity,unit,min_quantity,updated_by) VALUES(?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE category=VALUES(category),quantity=VALUES(quantity),unit=VALUES(unit),min_quantity=VALUES(min_quantity),updated_by=VALUES(updated_by)`,
    [name,category,quantity,unit,min,req.user.id]);
  await audit(req.user.id,"upserted","inventory",null,{name,quantity,unit});
  res.json({ok:true});
}));
router.delete("/inventory/:id", requireRole("admin"), catchAsync(async(req,res)=>{
  await pool.query("DELETE FROM hall_inventory WHERE id=?",[Number(req.params.id)]); res.json({ok:true});
}));
router.get("/waste", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query("SELECT id,DATE_FORMAT(waste_date,'%Y-%m-%d') waste_date,slot,prepared_plates,served_plates,wasted_plates,notes,created_at FROM hall_food_waste ORDER BY waste_date DESC,FIELD(slot,'breakfast','lunch','dinner') LIMIT 120");
  res.json(rows);
}));
router.post("/waste", requireRole("admin"), catchAsync(async(req,res)=>{
  const b=req.body||{}, date=String(b.date||""), slot=String(b.slot||"");
  const prepared=Number(b.preparedPlates), served=Number(b.servedPlates), wasted=Number(b.wastedPlates);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!["breakfast","lunch","dinner"].includes(slot)||
    ![prepared,served,wasted].every(Number.isInteger)||prepared<0||served<0||wasted<0||served+wasted>prepared)
    return res.status(400).json({error:"Use a valid date, meal and whole-plate counts; served + wasted cannot exceed prepared"});
  const notes=String(b.notes||"").trim().slice(0,500);
  const [r]=await pool.query("INSERT INTO hall_food_waste(waste_date,slot,prepared_plates,served_plates,wasted_plates,notes,recorded_by) VALUES(?,?,?,?,?,?,?)",
    [date,slot,prepared,served,wasted,notes||null,req.user.id]);
  await audit(req.user.id,"recorded","food_waste",r.insertId,{date,slot,prepared,served,wasted});
  res.status(201).json({id:r.insertId,date,slot,preparedPlates:prepared,servedPlates:served,wastedPlates:wasted});
}));
router.get("/forecast", requireRole("admin"), catchAsync(async(req,res)=>{
  const [rows]=await pool.query(`SELECT DAYOFWEEK(the_date) dow,slot,AVG(daily_count) avg_plates,COUNT(*) sample_days FROM
    (SELECT the_date,slot,SUM(CASE WHEN status='on' THEN 1 ELSE 0 END)+SUM(guest_count) daily_count
     FROM hall_meal_state LEFT JOIN hall_guests USING(user_id,the_date,slot)
     WHERE hall_meal_state.the_date >= DATE_SUB(CURDATE(),INTERVAL 56 DAY) AND hall_meal_state.the_date < CURDATE()
     GROUP BY hall_meal_state.the_date,hall_meal_state.slot) d GROUP BY dow,slot`);
  const [todayRows]=await pool.query("SELECT DAYOFWEEK(CURDATE()) dow");
  const dow=Number(todayRows[0].dow);
  res.json(["breakfast","lunch","dinner"].map(slot=>{
    const r=rows.find(x=>Number(x.dow)===dow&&x.slot===slot);
    return {slot,estimatedPlates:r?Math.max(0,Math.round(Number(r.avg_plates))):0,sampleDays:r?Number(r.sample_days):0,confidence:r&&Number(r.sample_days)>=4?"moderate":"low"};
  }));
}));
module.exports=router;
