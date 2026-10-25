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


module.exports=router;
