# Database tables

A reference of the MySQL tables CampusDine creates, with their columns and types.
It is read from the `CREATE TABLE` statements in `backend/schema.sql` and the `backend/src/` setup files; keys and constraints are left out.

## `users`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `name` | VARCHAR(100) |
| `email` | VARCHAR(120) |
| `external_id` | VARCHAR(50) |
| `role` | ENUM('student','teacher','admin','rider','hall_admin') |
| `account_type` | ENUM('regular','hall') |
| `password_hash` | VARCHAR(255) |
| `wallet_balance` | DECIMAL(10,2) |
| `phone` | VARCHAR(20) |
| `address` | VARCHAR(255) |
| `department` | VARCHAR(100) |
| `father_phone` | VARCHAR(20) |
| `hall_name` | VARCHAR(60) |
| `room_number` | VARCHAR(20) |
| `hall_id` | VARCHAR(20) |
| `avatar` | MEDIUMTEXT |
| `created_at` | TIMESTAMP |

## `meal_rates`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `role` | ENUM('student','teacher') |
| `full_rate` | DECIMAL(10,2) |
| `half_rate` | DECIMAL(10,2) |

## `menu_items`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `name` | VARCHAR(100) |
| `name_bn` | VARCHAR(100) |
| `category` | ENUM('heavy','snacks','drinks') |
| `price` | DECIMAL(10,2) |
| `stock` | INT |
| `tag` | VARCHAR(30) |
| `is_veg` | TINYINT(1) |
| `availability` | VARCHAR(12) |
| `image` | VARCHAR(200) |
| `created_at` | TIMESTAMP |

## `favourites`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `item_id` | INT |
| `created_at` | TIMESTAMP |

## `stock_alerts`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `menu_item_id` | INT |
| `created_at` | TIMESTAMP |

## `orders`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `token` | VARCHAR(20) |
| `user_id` | INT |
| `total` | DECIMAL(10,2) |
| `discount_amount` | DECIMAL(10,2) |
| `discount_applied` | TINYINT(1) |
| `payment_method` | ENUM('wallet','cash') |
| `pickup_time` | DATETIME |
| `note` | VARCHAR(255) |
| `delivery_note` | VARCHAR(255) |
| `status` | ENUM('Received','Cooking','Ready','Cancelled') |
| `rider_id` | INT |
| `rider_assignment_status` | ENUM('Unassigned','Assigned','Accepted','Declined','Completed') |
| `delivery_lat` | DECIMAL(10,7) |
| `delivery_lng` | DECIMAL(10,7) |
| `picked_up_at` | DATETIME |
| `created_at` | TIMESTAMP |

## `rider_shifts`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `rider_id` | INT |
| `status` | ENUM('ON_DUTY','OFF_DUTY') |
| `max_orders` | INT |
| `started_at` | DATETIME |
| `ended_at` | DATETIME |
| `active_key` | TINYINT |

## `fraud_events`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | BIGINT |
| `user_id` | INT |
| `event_type` | VARCHAR(80) |
| `severity` | ENUM('LOW','MEDIUM','HIGH') |
| `details_json` | JSON |
| `ip_address` | VARCHAR(64) |
| `created_at` | TIMESTAMP |

## `audit_logs`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | BIGINT |
| `actor_user_id` | INT |
| `actor_role` | VARCHAR(20) |
| `action` | VARCHAR(80) |
| `entity_type` | VARCHAR(40) |
| `entity_id` | VARCHAR(80) |
| `details_json` | JSON |
| `ip_address` | VARCHAR(64) |
| `created_at` | TIMESTAMP |

## `group_orders`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `host_user_id` | INT |
| `title` | VARCHAR(100) |
| `join_code` | VARCHAR(12) |
| `closes_at` | DATETIME |
| `status` | ENUM('OPEN','CLOSED','CHECKED_OUT') |
| `created_at` | TIMESTAMP |

## `group_order_members`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `group_id` | INT |
| `user_id` | INT |
| `joined_at` | TIMESTAMP |

## `group_order_items`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `group_id` | INT |
| `user_id` | INT |
| `menu_item_id` | INT |
| `qty` | INT |
| `created_at` | TIMESTAMP |

## `direct_order_messages`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | BIGINT |
| `order_id` | INT |
| `sender_id` | INT |
| `recipient_id` | INT |
| `message` | VARCHAR(1000) |
| `created_at` | TIMESTAMP |
| `read_at` | DATETIME |

## `order_items`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `order_id` | INT |
| `menu_item_id` | INT |
| `name` | VARCHAR(100) |
| `price` | DECIMAL(10,2) |
| `qty` | INT |

## `wallet_transactions`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `label` | VARCHAR(150) |
| `amount` | DECIMAL(10,2) |
| `created_at` | TIMESTAMP |

## `meal_calendar`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `the_date` | DATE |
| `status` | ENUM('off','full','half') |
| `paid_amount` | DECIMAL(10,2) |
| `paid_at` | DATETIME |

## `order_feedback`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `order_id` | INT |
| `user_id` | INT |
| `rating` | TINYINT |
| `comment` | TEXT |
| `created_at` | TIMESTAMP |

## `general_feedback`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `category` | ENUM('food','service','hygiene','suggestion','other') |
| `rating` | TINYINT |
| `comment` | TEXT |
| `created_at` | TIMESTAMP |

## `coupons`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `code` | VARCHAR(50) |
| `discount_type` | ENUM('PERCENTAGE','FIXED') |
| `discount_value` | DECIMAL(10,2) |
| `min_order_amount` | DECIMAL(10,2) |
| `max_discount` | DECIMAL(10,2) |
| `usage_limit` | INT |
| `used_count` | INT |
| `expiry_date` | DATETIME |
| `description` | VARCHAR(255) |
| `applies_to_all_items` | TINYINT(1) |
| `is_active` | TINYINT(1) |
| `created_at` | TIMESTAMP |

## `coupon_items`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `coupon_id` | INT |
| `item_id` | INT |

## `coupon_usage`
Created in `backend/schema.sql`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `coupon_id` | INT |
| `order_id` | INT |
| `created_at` | TIMESTAMP |

## `hall_universities`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `name` | VARCHAR(180) |
| `code` | VARCHAR(40) |
| `created_at` | TIMESTAMP |

## `hall_blocks`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `university_id` | BIGINT UNSIGNED |
| `hall_name` | VARCHAR(180) |
| `block_name` | VARCHAR(100) |
| `created_at` | TIMESTAMP |

## `hall_rooms`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `block_id` | BIGINT UNSIGNED |
| `hall_name` | VARCHAR(180) |
| `block_name` | VARCHAR(100) |
| `floor_no` | VARCHAR(30) |
| `room_number` | VARCHAR(30) |
| `capacity` | INT |
| `occupied` | INT |
| `room_type` | VARCHAR(60) |
| `status` | ENUM('available','maintenance','inactive') |
| `created_at` | TIMESTAMP |

## `hall_room_applications`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `room_id` | BIGINT UNSIGNED |
| `preferred_hall` | VARCHAR(180) |
| `notes` | TEXT |
| `status` | ENUM('pending','approved','rejected','withdrawn') |
| `reviewed_by` | INT |
| `review_note` | VARCHAR(500) |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

## `hall_room_assignments`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `room_id` | BIGINT UNSIGNED |
| `status` | ENUM('active','checked_out','transferred') |
| `assigned_by` | INT |
| `assigned_at` | DATETIME |
| `ended_at` | DATETIME |
| `notes` | VARCHAR(500) |

## `hall_room_history`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `from_room_id` | BIGINT UNSIGNED |
| `to_room_id` | BIGINT UNSIGNED |
| `action` | ENUM('assigned','transferred','checked_out') |
| `actor_id` | INT |
| `note` | VARCHAR(500) |
| `created_at` | TIMESTAMP |

## `hall_visitors`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `visitor_name` | VARCHAR(180) |
| `visitor_phone` | VARCHAR(40) |
| `purpose` | VARCHAR(500) |
| `visit_date` | DATE |
| `expected_time` | TIME |
| `status` | ENUM('pending','approved','rejected','checked_in','checked_out','cancelled') |
| `reviewed_by` | INT |
| `created_at` | TIMESTAMP |

## `hall_facility_bookings`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `facility_name` | VARCHAR(160) |
| `booking_date` | DATE |
| `start_time` | TIME |
| `end_time` | TIME |
| `purpose` | VARCHAR(500) |
| `status` | ENUM('pending','approved','rejected','cancelled','completed') |
| `reviewed_by` | INT |
| `review_note` | VARCHAR(500) |
| `created_at` | TIMESTAMP |

## `hall_clearance`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `reason` | VARCHAR(500) |
| `status` | ENUM('pending','in_review','approved','rejected') |
| `review_note` | VARCHAR(500) |
| `reviewed_by` | INT |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

## `hall_laundry_vendors`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `name` | VARCHAR(180) |
| `contact_name` | VARCHAR(120) |
| `phone` | VARCHAR(40) |
| `email` | VARCHAR(120) |
| `service_area` | VARCHAR(180) |
| `active` | TINYINT(1) |
| `notes` | VARCHAR(500) |
| `created_by` | INT |
| `created_at` | TIMESTAMP |

## `hall_laundry_jobs`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `vendor_id` | BIGINT UNSIGNED |
| `description` | VARCHAR(500) |
| `pieces` | INT |
| `pickup_date` | DATE |
| `status` | ENUM('requested','accepted','picked_up','ready','delivered','cancelled') |
| `rating` | TINYINT |
| `feedback` | VARCHAR(500) |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

## `hall_suppliers`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `name` | VARCHAR(180) |
| `contact_name` | VARCHAR(120) |
| `phone` | VARCHAR(40) |
| `email` | VARCHAR(120) |
| `items_supplied` | VARCHAR(500) |
| `notes` | VARCHAR(500) |
| `created_by` | INT |
| `created_at` | TIMESTAMP |

## `hall_production_plans`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `plan_date` | DATE |
| `slot` | ENUM('breakfast','lunch','dinner') |
| `planned_plates` | INT |
| `actual_prepared` | INT |
| `notes` | VARCHAR(500) |
| `created_by` | INT |
| `created_at` | TIMESTAMP |

## `hall_notifications`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `title` | VARCHAR(180) |
| `body` | TEXT |
| `kind` | VARCHAR(60) |
| `read_at` | DATETIME |
| `created_at` | TIMESTAMP |

## `hall_student_profiles`
Created in `backend/src/hall/advancedSchema.js`.

| Column | Type |
| --- | --- |
| `user_id` | INT |
| `phone` | VARCHAR(40) |
| `emergency_contact` | VARCHAR(180) |
| `blood_group` | VARCHAR(8) |
| `department` | VARCHAR(120) |
| `updated_at` | TIMESTAMP |

## `hall_autopay`
Created in `backend/src/hall/autopaySchema.js`.

| Column | Type |
| --- | --- |
| `user_id` | INT |
| `enabled` | TINYINT(1) |
| `updated_at` | DATETIME |

## `hall_autopay_log`
Created in `backend/src/hall/autopaySchema.js`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `ym` | CHAR(7) |
| `status` | VARCHAR(12) |
| `amount` | DECIMAL(10,2) |
| `due` | DECIMAL(10,2) |
| `balance` | DECIMAL(10,2) |
| `created_at` | DATETIME |

## `hall_diet`
Created in `backend/src/hall/dietSchema.js`.

| Column | Type |
| --- | --- |
| `user_id` | INT |
| `avoid` | VARCHAR(200) |
| `allergies` | VARCHAR(200) |
| `note` | VARCHAR(160) |
| `updated_at` | DATETIME |

## `hall_requests`
Created in `backend/src/hall/extraSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `type` | ENUM('maintenance','cleaning','laundry','guest','lost_found','facility_booking','feedback','emergency','event') |
| `title` | VARCHAR(180) |
| `description` | TEXT |
| `location` | VARCHAR(180) |
| `requested_date` | DATE |
| `status` | ENUM('submitted','approved','in_progress','resolved','rejected','cancelled') |
| `admin_note` | VARCHAR(500) |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

## `hall_notices`
Created in `backend/src/hall/extraSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `title` | VARCHAR(180) |
| `body` | TEXT |
| `category` | VARCHAR(50) |
| `pinned` | TINYINT(1) |
| `expires_at` | DATETIME |
| `created_by` | INT |
| `created_at` | TIMESTAMP |

## `hall_inventory`
Created in `backend/src/hall/extraSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `item_name` | VARCHAR(180) |
| `category` | VARCHAR(80) |
| `quantity` | DECIMAL(10,2) |
| `unit` | VARCHAR(30) |
| `min_quantity` | DECIMAL(10,2) |
| `updated_by` | INT |
| `updated_at` | TIMESTAMP |

## `hall_pickup_tokens`
Created in `backend/src/hall/extraSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `the_date` | DATE |
| `slot` | ENUM('breakfast','lunch','dinner') |
| `token_code` | VARCHAR(24) |
| `status` | ENUM('issued','served','cancelled') |
| `served_by` | INT |
| `created_at` | TIMESTAMP |
| `served_at` | DATETIME |

## `hall_food_waste`
Created in `backend/src/hall/extraSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `waste_date` | DATE |
| `slot` | ENUM('breakfast','lunch','dinner') |
| `prepared_plates` | INT |
| `served_plates` | INT |
| `wasted_plates` | INT |
| `notes` | VARCHAR(500) |
| `recorded_by` | INT |
| `created_at` | TIMESTAMP |

## `hall_audit_log`
Created in `backend/src/hall/extraSchema.js`.

| Column | Type |
| --- | --- |
| `id` | BIGINT UNSIGNED |
| `user_id` | INT |
| `action` | VARCHAR(100) |
| `entity_type` | VARCHAR(60) |
| `entity_id` | BIGINT |
| `details` | JSON |
| `created_at` | TIMESTAMP |

## `hall_expenses`
Created in `backend/src/hall/financeSchema.js`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `expense_date` | DATE |
| `category` | VARCHAR(30) |
| `amount` | DECIMAL(10,2) |
| `supplier_id` | BIGINT UNSIGNED |
| `note` | VARCHAR(255) |
| `created_by` | INT |
| `university_id` | BIGINT UNSIGNED |
| `created_at` | DATETIME |

## `hall_lastcalls`
Created in `backend/src/hall/lastcallSchema.js`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `the_date` | DATE |
| `slot` | VARCHAR(12) |
| `plates` | INT |
| `price` | DECIMAL(10,2) |
| `note` | VARCHAR(160) |
| `status` | VARCHAR(8) |
| `created_by` | INT |
| `university_id` | BIGINT UNSIGNED |
| `created_at` | DATETIME |

## `hall_lastcall_claims`
Created in `backend/src/hall/lastcallSchema.js`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `lastcall_id` | INT |
| `user_id` | INT |
| `code` | VARCHAR(12) |
| `price` | DECIMAL(10,2) |
| `status` | VARCHAR(10) |
| `created_at` | DATETIME |
| `served_at` | DATETIME |

## `hall_meal_ratings`
Created in `backend/src/hall/ratingsSchema.js`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `the_date` | DATE |
| `slot` | VARCHAR(12) |
| `stars` | TINYINT |
| `comment` | VARCHAR(300) |
| `created_at` | DATETIME |
| `updated_at` | DATETIME |

## `hall_slots`
Created in `backend/src/hall/schema.js`.

| Column | Type |
| --- | --- |
| `slot` | VARCHAR(12) |
| `label` | VARCHAR(30) |
| `cutoff_days_before` | TINYINT |
| `cutoff_time` | TIME |
| `price` | DECIMAL(10,2) |
| `guest_price` | DECIMAL(10,2) |

## `hall_meal_state`
Created in `backend/src/hall/schema.js`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `the_date` | DATE |
| `slot` | VARCHAR(12) |
| `status` | ENUM('on','off') |
| `source` | ENUM('manual','auto') |
| `changed_at` | DATETIME |

## `hall_meal_log`
Created in `backend/src/hall/schema.js`.

| Column | Type |
| --- | --- |
| `id` | INT |
| `user_id` | INT |
| `the_date` | DATE |
| `slot` | VARCHAR(12) |
| `old_status` | ENUM('on','off') |
| `new_status` | ENUM('on','off') |
| `created_at` | DATETIME |

## `hall_menu`
Created in `backend/src/hall/schema.js`.

| Column | Type |
| --- | --- |
| `dow` | TINYINT |
| `slot` | VARCHAR(12) |
| `items` | VARCHAR(255) |
