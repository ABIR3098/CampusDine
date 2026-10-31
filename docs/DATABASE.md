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
