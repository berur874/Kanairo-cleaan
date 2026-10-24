-- Kanairo-Klean starter data
-- Run with: mysql -u root -p kanairo < seed.sql
-- Safe to re-run: clears existing rows first (respects FK order).

USE kanairo;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE sessions;
TRUNCATE TABLE users;
TRUNCATE TABLE drop_offs;
TRUNCATE TABLE scrap_logs;
TRUNCATE TABLE hotspot_materials;
TRUNCATE TABLE transactions;
TRUNCATE TABLE hotspots;
TRUNCATE TABLE materials;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO materials (id, name, type, price, unit, change_pct, trend, stock_kg) VALUES
  ('ALU', 'Aluminium', 'metal', 85.00, 'KES/kg', -1.20, 'down', 430),
  ('EWASTE', 'E-Waste', 'e-waste', 120.00, 'KES/kg', 5.10, 'up', 640),
  ('GLASS', 'Clear Glass', 'glass', 8.50, 'KES/kg', 0.20, 'up', 290),
  ('HDPE', 'HDPE Plastic', 'plastic', 35.00, 'KES/kg', 1.50, 'up', 1100),
  ('PAPER', 'Cardboard', 'paper', 12.00, 'KES/kg', -0.40, 'down', 3200),
  ('PET', 'PET Plastic', 'plastic', 28.50, 'KES/kg', 2.30, 'up', 2840);

INSERT INTO hotspots (name, area, county, primary_material_id, activity, stock_kg, active, lat, lng) VALUES
  ('Dandora', 'Dandora', 'Nairobi', 'PET', 94, 2840, 1, -1.249600, 36.899000),
  ('Gikomba', 'Gikomba', 'Nairobi', 'PAPER', 78, 1920, 1, -1.286000, 36.837000),
  ('Industrial Area', 'Industrial Area', 'Nairobi', 'EWASTE', 87, 640, 1, -1.307000, 36.851000),
  ('Kibera', 'Kibera', 'Nairobi', 'ALU', 40, 430, 0, -1.313300, 36.786900),
  ('Westlands', 'Westlands', 'Nairobi', 'GLASS', 35, 290, 0, -1.267600, 36.810800),
  ('Eastleigh', 'Eastleigh', 'Nairobi', 'ALU', 60, 430, 1, -1.274100, 36.850000),
  ('Karen', 'Karen', 'Nairobi', 'GLASS', 20, 290, 0, -1.319700, 36.707300),
  ('Ruiru', 'Ruiru', 'Kiambu', 'PAPER', 70, 3200, 1, -1.146600, 36.960900);

INSERT INTO hotspot_materials (hotspot_id, material_name, quantity) VALUES
  (1, 'PET Plastic', 2840),
  (2, 'Cardboard', 1920),
  (3, 'E-Waste', 640),
  (4, 'Aluminium', 430),
  (5, 'Clear Glass', 290),
  (6, 'Aluminium', 430),
  (7, 'Clear Glass', 290),
  (8, 'Cardboard', 3200);

INSERT INTO transactions (id, material, quantity, amount, created_at) VALUES
  ('KAN0000001', 'PET Plastic', 50, 1425.00, NOW() - INTERVAL 6 DAY),
  ('KAN0000002', 'Cardboard', 120, 1440.00, NOW() - INTERVAL 5 DAY),
  ('KAN0000003', 'E-Waste', 20, 2400.00, NOW() - INTERVAL 4 DAY),
  ('KAN0000004', 'Aluminium', 15, 1275.00, NOW() - INTERVAL 3 DAY),
  ('KAN0000005', 'Clear Glass', 80, 680.00, NOW() - INTERVAL 2 DAY),
  ('KAN0000006', 'PET Plastic', 30, 855.00, NOW() - INTERVAL 1 DAY),
  ('KAN0000007', 'Cardboard', 200, 2400.00, NOW());

INSERT INTO scrap_logs (log_id, job_id, artisan_id, material_type, hotspot_id, material_id, quantity_kg, notes, logged_at) VALUES
  ('log-0001', 'job-1001', 'art-101', 'plastic', 1, 'PET', 12.50, 'Post-sort PET offcuts', NOW() - INTERVAL 3 DAY),
  ('log-0002', 'job-1002', 'art-102', 'paper', 2, 'PAPER', 8.00, 'Clean cardboard trims', NOW() - INTERVAL 2 DAY),
  ('log-0003', 'job-1003', 'art-103', 'e-waste', 3, 'EWASTE', 5.25, 'Mixed small e-waste parts', NOW() - INTERVAL 1 DAY);

-- Demo accounts, one per role. Password for all three: kanairo123
INSERT INTO users (name, phone, password_hash, role, hotspot_id, accessibility_needs) VALUES
  ('Wanjiru (demo seller)', '0711000001', 'scrypt$6b5ea272c885471c3ee1e0933cf157d4$8e85e1354d5d27443ecf1f88c91f211bbda129a3cf8b74b8eefd7e4f95b120f12b3f8d03df6094852639a280d54d9e0f74cd49bdabaae84b93204a791067212f', 'seller', NULL, '["ramp", "accessibleToilet"]'),
  ('Otieno (demo buyer)', '0711000002', 'scrypt$6b5ea272c885471c3ee1e0933cf157d4$8e85e1354d5d27443ecf1f88c91f211bbda129a3cf8b74b8eefd7e4f95b120f12b3f8d03df6094852639a280d54d9e0f74cd49bdabaae84b93204a791067212f', 'buyer', NULL, '[]'),
  ('Achieng (demo hub manager, Dandora)', '0711000003', 'scrypt$6b5ea272c885471c3ee1e0933cf157d4$8e85e1354d5d27443ecf1f88c91f211bbda129a3cf8b74b8eefd7e4f95b120f12b3f8d03df6094852639a280d54d9e0f74cd49bdabaae84b93204a791067212f', 'hub_manager', 1, '[]');
