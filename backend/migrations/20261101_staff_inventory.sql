-- CampusDine: Staff role + kitchen inventory.
-- Safe to run more than once. The server also applies the same changes at start-up (src/inventory/schema.js).

ALTER TABLE users MODIFY COLUMN role ENUM('student','teacher','admin','rider','hall_admin','staff') NOT NULL;

