const express = require('express');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();
const { restaurantOf, isRestaurantId } = require('../catalog');
const { loadItemRestaurants } = require('../restaurants');
let ready;
async function ensureSchema(){
  if(ready) return ready;
  ready=(async()=>{
    await pool.query(`CREATE TABLE IF NOT EXISTS campus_lost_found (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, item_type ENUM('lost','found') NOT NULL,
      title VARCHAR(160) NOT NULL, description TEXT NULL, location VARCHAR(180) NOT NULL,
      contact VARCHAR(100) NULL, image_data MEDIUMTEXT NULL, status ENUM('open','claimed','returned','closed') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_lost_found_status(status), KEY idx_lost_found_created(created_at),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS campus_emergencies (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, emergency_type VARCHAR(60) NOT NULL,
      details VARCHAR(1000) NULL, location VARCHAR(180) NOT NULL, contact VARCHAR(100) NULL,
      status ENUM('open','acknowledged','responding','resolved','false_alarm') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_emergency_status(status), KEY idx_emergency_created(created_at),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS campus_waste_challenge_members (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL UNIQUE, joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      saved_meals INT NOT NULL DEFAULT 0, last_pledge_date DATE NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS campus_food_waste (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, admin_id INT NOT NULL, restaurant_id VARCHAR(30) NOT NULL DEFAULT 'amitie', meal_name VARCHAR(120) NOT NULL,
      cooked_portions INT NOT NULL, leftover_portions INT NOT NULL, notes VARCHAR(500) NULL,
      waste_percent DECIMAL(6,2) NOT NULL, log_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, KEY idx_waste_date(log_date), KEY idx_waste_restaurant_date(restaurant_id,log_date)
    )`);
  })().catch(e=>{ready=null;throw e;});
  return ready;
}
const clean=v=>typeof v==='string'?v.trim():'';
const ioEmit=(req,room,event,payload)=>{const io=req.app.get('io');if(io)io.to(room).emit(event,payload)};
router.use(verifyToken);

// Existing order status + queue data powers the student's live tracking panel.
router.get('/queue',requireRole('student','teacher','admin'),async(req,res,next)=>{try{
  const [joined]=await pool.query(`SELECT o.id,o.status,o.created_at,o.pickup_time,oi.menu_item_id,oi.name AS item_name
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
    WHERE o.status IN ('Received','Cooking','Ready') ORDER BY COALESCE(o.pickup_time,o.created_at),o.id`);
  const grouped=new Map();
  for(const row of joined){if(!grouped.has(row.id))grouped.set(row.id,{id:row.id,status:row.status,created_at:row.created_at,pickup_time:row.pickup_time,item_lines:0,items:[]});const o=grouped.get(row.id);if(row.item_name){o.item_lines++;o.items.push({name:row.item_name,id:row.menu_item_id})}}
  let orders=[...grouped.values()];
  if(req.user.role==='admin'){
    const restaurant=String(req.query.restaurant||'');
    if(!isRestaurantId(restaurant))return res.status(400).json({error:'Select a valid canteen to view its command center'});
    const extra=await loadItemRestaurants();
    orders=orders.filter(o=>o.items.some(i=>restaurantOf(i.name,i.id,extra)===restaurant));
  }
  const summary={active_orders:orders.length,received:orders.filter(o=>o.status==='Received').length,cooking:orders.filter(o=>o.status==='Cooking').length,ready:orders.filter(o=>o.status==='Ready').length,est_wait_for_new_order:orders.length*4};
  res.json({summary,orders:orders.map(({items,...o})=>o)});
}catch(e){next(e)}});

router.get('/live-tracking',requireRole('teacher'),async(req,res,next)=>{try{
  const [rows]=await pool.query(`SELECT o.id,o.token,o.status,o.created_at,o.rider_assignment_status,
    ru.name AS rider_name,l.latitude,l.longitude,l.updated_at AS location_updated_at,
    CASE WHEN l.updated_at>=NOW()-INTERVAL 30 SECOND AND l.active=1 THEN 1 ELSE 0 END AS rider_live
    FROM orders o LEFT JOIN users ru ON ru.id=o.rider_id LEFT JOIN rider_locations l ON l.rider_id=o.rider_id
    WHERE o.user_id=? AND o.rider_id IS NOT NULL AND o.status IN ('Received','Cooking','Ready') AND o.picked_up_at IS NULL
    ORDER BY o.created_at DESC LIMIT 20`,[req.user.id]);
  res.json(rows.map(x=>({...x,latitude:x.latitude==null?null:Number(x.latitude),longitude:x.longitude==null?null:Number(x.longitude),rider_live:!!x.rider_live})));
}catch(e){next(e)}});

// Lightweight explainable recommendation: personal purchase frequency + popularity + current availability.
router.get('/recommendations',requireRole('student','teacher'),async(req,res,next)=>{try{
  const [rows]=await pool.query(`SELECT m.id,m.name,m.name_bn,m.category,m.price,m.stock,m.image,m.is_veg,
    COALESCE(mine.ordered,0) personal_orders, COALESCE(pop.popular,0) campus_orders
    FROM menu_items m
    LEFT JOIN (SELECT oi.menu_item_id, SUM(oi.qty) ordered FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.user_id=? AND o.status<>'Cancelled' AND oi.menu_item_id IS NOT NULL GROUP BY oi.menu_item_id) mine ON mine.menu_item_id=m.id
    LEFT JOIN (SELECT oi.menu_item_id,SUM(oi.qty) popular FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.created_at>=NOW()-INTERVAL 30 DAY AND o.status<>'Cancelled' AND oi.menu_item_id IS NOT NULL GROUP BY oi.menu_item_id) pop ON pop.menu_item_id=m.id
    WHERE m.availability='available' AND m.stock>0 ORDER BY (COALESCE(mine.ordered,0)*3+COALESCE(pop.popular,0)) DESC,m.stock DESC LIMIT 8`,[req.user.id]);
  res.json(rows.map((x,i)=>({...x,reason:Number(x.personal_orders)>0?'Based on your previous orders':i<3?'Popular on campus':'Available now'})));
}catch(e){next(e)}});

router.get('/lost-found',requireRole('student','teacher','hall_admin'),async(req,res,next)=>{try{await ensureSchema();const [rows]=await pool.query(`SELECT l.id,l.item_type,l.title,l.description,l.location,CASE WHEN ?='hall_admin' THEN l.contact ELSE NULL END AS contact,l.image_data,l.status,l.created_at,u.name AS posted_by FROM campus_lost_found l JOIN users u ON u.id=l.user_id WHERE l.status IN ('open','claimed') ORDER BY l.created_at DESC LIMIT 100`,[req.user.role]);res.json(rows)}catch(e){next(e)}});
router.post('/lost-found',requireRole('student','teacher'),async(req,res,next)=>{try{await ensureSchema();const type=clean(req.body.item_type),title=clean(req.body.title),location=clean(req.body.location),description=clean(req.body.description),contact=clean(req.body.contact);const image=typeof req.body.image_data==='string'?req.body.image_data:'';if(!['lost','found'].includes(type)||title.length<3||!location)return res.status(400).json({error:'Choose lost/found and provide a title and location'});if(image.length>2800000)return res.status(413).json({error:'Image is too large. Please upload an image under 2 MB.'});if(image&&!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(image))return res.status(400).json({error:'Only PNG, JPG or WEBP images are supported'});const [r]=await pool.query('INSERT INTO campus_lost_found(user_id,item_type,title,description,location,contact,image_data) VALUES(?,?,?,?,?,?,?)',[req.user.id,type,title.slice(0,160),description.slice(0,2000),location.slice(0,180),contact.slice(0,100),image||null]);ioEmit(req,'hall_admins','campus:lost-found:new',{id:r.insertId,title,type,location});res.status(201).json({success:true,id:r.insertId})}catch(e){next(e)}});
router.patch('/lost-found/:id',requireRole('hall_admin'),async(req,res,next)=>{try{await ensureSchema();const status=clean(req.body.status);if(!['open','claimed','returned','closed'].includes(status))return res.status(400).json({error:'Invalid status'});const [r]=await pool.query('UPDATE campus_lost_found SET status=? WHERE id=?',[status,Number(req.params.id)]);if(!r.affectedRows)return res.status(404).json({error:'Post not found'});res.json({success:true})}catch(e){next(e)}});

router.post('/emergency',requireRole('student','teacher'),async(req,res,next)=>{try{await ensureSchema();const type=clean(req.body.emergency_type)||'General emergency',location=clean(req.body.location),details=clean(req.body.details),contact=clean(req.body.contact);if(!location)return res.status(400).json({error:'Please provide your current location or a clear landmark'});const [[recent]]=await pool.query("SELECT COUNT(*) AS total FROM campus_emergencies WHERE user_id=? AND status IN ('open','acknowledged','responding') AND created_at>=NOW()-INTERVAL 2 MINUTE",[req.user.id]);if(Number(recent.total)>0)return res.status(429).json({error:'You already have an active emergency alert. Please update or contact the Hall Admin instead of sending duplicates.'});const [r]=await pool.query('INSERT INTO campus_emergencies(user_id,emergency_type,details,location,contact) VALUES(?,?,?,?,?)',[req.user.id,type.slice(0,60),details.slice(0,1000),location.slice(0,180),contact.slice(0,100)]);const payload={id:r.insertId,student:req.user.name,type,location,details,created_at:new Date().toISOString(),status:'open'};ioEmit(req,'hall_admins','campus:emergency:new',payload);res.status(201).json({success:true,id:r.insertId,message:'Emergency alert sent to campus administrators. If there is immediate danger, contact local emergency services too.'})}catch(e){next(e)}});
router.get('/emergency',requireRole('hall_admin'),async(req,res,next)=>{try{await ensureSchema();const [rows]=await pool.query(`SELECT e.*,u.name AS student_name,u.external_id FROM campus_emergencies e JOIN users u ON u.id=e.user_id ORDER BY FIELD(e.status,'open','acknowledged','responding','resolved','false_alarm'),e.created_at DESC LIMIT 100`);res.json(rows)}catch(e){next(e)}});
router.patch('/emergency/:id',requireRole('hall_admin'),async(req,res,next)=>{try{await ensureSchema();const status=clean(req.body.status);if(!['acknowledged','responding','resolved','false_alarm'].includes(status))return res.status(400).json({error:'Invalid emergency status'});const [r]=await pool.query('UPDATE campus_emergencies SET status=? WHERE id=?',[status,Number(req.params.id)]);if(!r.affectedRows)return res.status(404).json({error:'Emergency not found'});res.json({success:true})}catch(e){next(e)}});

router.get('/waste-challenge',requireRole('admin','hall_admin','student','teacher'),async(req,res,next)=>{try{
  await ensureSchema();let scope=null;
  if(req.user.role==='admin'){scope=String(req.query.restaurant||'');if(!isRestaurantId(scope))return res.status(400).json({error:'Select a valid canteen'});}
  const where=scope?' AND restaurant_id=?':'';const params=scope?[scope]:[];
  const [[totals]]=await pool.query(`SELECT COALESCE(SUM(cooked_portions),0) cooked,COALESCE(SUM(leftover_portions),0) leftover,COUNT(*) logs FROM campus_food_waste WHERE log_date>=CURDATE()-INTERVAL 30 DAY${where}`,params);
  const [days]=await pool.query(`SELECT log_date,SUM(cooked_portions) cooked,SUM(leftover_portions) leftover,ROUND(100*SUM(leftover_portions)/NULLIF(SUM(cooked_portions),0),1) waste_percent FROM campus_food_waste WHERE log_date>=CURDATE()-INTERVAL 7 DAY${where} GROUP BY log_date ORDER BY log_date`,params);
  const [leaderboard]=await pool.query(`SELECT u.id,u.name,m.saved_meals,m.joined_at FROM campus_waste_challenge_members m JOIN users u ON u.id=m.user_id ORDER BY m.saved_meals DESC,m.joined_at ASC LIMIT 10`);
  const [[member]]=await pool.query('SELECT id,saved_meals,(last_pledge_date=CURDATE()) AS pledged_today FROM campus_waste_challenge_members WHERE user_id=?',[req.user.id]);
  const [[members]]=await pool.query('SELECT COUNT(*) AS total FROM campus_waste_challenge_members');
  res.json({totals,days,leaderboard,participants:Number(members.total),joined:!!member,my_saved_meals:member?Number(member.saved_meals):0,pledged_today:member?!!member.pledged_today:false});
}catch(e){next(e)}});
router.post('/waste-challenge/join',requireRole('student','teacher'),async(req,res,next)=>{try{await ensureSchema();await pool.query('INSERT IGNORE INTO campus_waste_challenge_members(user_id) VALUES(?)',[req.user.id]);res.status(201).json({success:true,message:'You joined the Campus Food Waste Challenge.'})}catch(e){next(e)}});
router.post('/waste-challenge/pledge',requireRole('student','teacher'),async(req,res,next)=>{try{await ensureSchema();const [r]=await pool.query('UPDATE campus_waste_challenge_members SET saved_meals=saved_meals+1,last_pledge_date=CURDATE() WHERE user_id=? AND (last_pledge_date IS NULL OR last_pledge_date<CURDATE())',[req.user.id]);if(!r.affectedRows)return res.status(409).json({error:'You have already recorded today’s no-waste pledge.'});res.json({success:true,message:'Great work! Your no-waste pledge was recorded.'})}catch(e){next(e)}});
router.post('/waste-challenge',requireRole('admin'),async(req,res,next)=>{try{await ensureSchema();const meal=clean(req.body.meal_name),cooked=Number(req.body.cooked_portions),left=Number(req.body.leftover_portions),notes=clean(req.body.notes);if(!meal||!Number.isInteger(cooked)||cooked<1||!Number.isInteger(left)||left<0||left>cooked)return res.status(400).json({error:'Enter a meal, cooked portions and leftover portions (leftover cannot exceed cooked)'});const restaurant=String(req.body.restaurant_id||'');if(!isRestaurantId(restaurant))return res.status(400).json({error:'Select a valid canteen'});const waste=Number((left/cooked*100).toFixed(2));await pool.query('INSERT INTO campus_food_waste(admin_id,restaurant_id,meal_name,cooked_portions,leftover_portions,notes,waste_percent,log_date) VALUES(?,?,?,?,?,?,?,CURDATE())',[req.user.id,restaurant,meal,cooked,left,notes.slice(0,500),waste]);res.status(201).json({success:true,waste_percent:waste})}catch(e){next(e)}});
module.exports=router;
