-- Coupons for the prizes shown by the Daily Spin and the Scratch Card.
-- Safe to run more than once: a coupon that already exists is left alone.
-- Run:  mysql -u root -p campusdine < backend/migrations/20261101_prize_coupons.sql

-- TEHARI10: 10% off Tehari (Daily Spin prize)
INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, description, applies_to_all_items, is_active)
SELECT 'TEHARI10', 'PERCENTAGE', 10, 0, 30, '10% off Tehari (Daily Spin prize)', 0, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE code = 'TEHARI10');
INSERT IGNORE INTO coupon_items (coupon_id, item_id)
SELECT c.id, m.id FROM coupons c JOIN menu_items m ON m.name IN ('Tehari') WHERE c.code = 'TEHARI10';

-- STUDY15: 15% off Singara, Fuchka and Chicken Roll (Daily Spin prize)
INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, description, applies_to_all_items, is_active)
SELECT 'STUDY15', 'PERCENTAGE', 15, 0, 40, '15% off Singara, Fuchka and Chicken Roll (Daily Spin prize)', 0, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE code = 'STUDY15');
INSERT IGNORE INTO coupon_items (coupon_id, item_id)
SELECT c.id, m.id FROM coupons c JOIN menu_items m ON m.name IN ('Singara', 'Fuchka', 'Chicken Roll') WHERE c.code = 'STUDY15';
