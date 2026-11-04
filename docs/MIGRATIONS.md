# Migrations

SQL files in `backend/migrations/`. Run one with:

```
mysql --default-character-set=utf8mb4 -u root -p campusdine < backend/migrations/<file>.sql
```

## `20261030_campus_command_center.sql`
CampusDine Campus Command Center additions.
The Express route also creates these tables lazily on first use.

## `20261030_teacher_only_rider_delivery.sql`
CampusDine: only teacher orders use rider delivery.
Run once against the existing CampusDine database during deployment.
