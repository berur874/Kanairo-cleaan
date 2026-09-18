-- Kanairo-Klean starter data
-- Run with: mysql -u root -p kanairo < seed.sql
-- Safe to re-run: clears existing rows first (respects FK order).

USE kanairo;

SET FOREIGN_KEY_CHECKS = 0;
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

INSERT INTO hotspots (name, area, primary_material_id, activity, stock_kg, active) VALUES
  ('Dandora', 'Dandora', 'PET', 94, 2840, 1),
  ('Gikomba', 'Gikomba', 'PAPER', 78, 1920, 1),
  ('Industrial Area', 'Industrial Area', 'EWASTE', 87, 640, 1),
  ('Kibera', 'Kibera', 'ALU', 40, 430, 0),
  ('Westlands', 'Westlands', 'GLASS', 35, 290, 0),
  ('Eastleigh', 'Eastleigh', 'ALU', 60, 430, 1),
  ('Karen', 'Karen', 'GLASS', 20, 290, 0),
  ('Ruiru', 'Ruiru', 'PAPER', 70, 3200, 1);

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

INSERT INTO scrap_logs (hotspot_id, material_id, quantity_kg, logged_at) VALUES
  (1, 'PET', 12.50, NOW() - INTERVAL 3 DAY),
  (2, 'PAPER', 8.00, NOW() - INTERVAL 2 DAY),
  (3, 'EWASTE', 5.25, NOW() - INTERVAL 1 DAY);
