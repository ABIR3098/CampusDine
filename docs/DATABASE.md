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
