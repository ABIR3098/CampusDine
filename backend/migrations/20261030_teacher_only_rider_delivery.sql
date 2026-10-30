-- CampusDine: only teacher orders use rider delivery.
-- Run once against the existing CampusDine database during deployment.
UPDATE orders o
JOIN users u ON u.id = o.user_id
SET o.rider_id = NULL,
    o.rider_assignment_status = 'Unassigned'
WHERE u.role = 'student'
  AND o.status IN ('Received', 'Cooking', 'Ready')
  AND o.picked_up_at IS NULL;
