-- Kanairo-Klean MySQL schema
-- Run with: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS kanairo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE kanairo;

CREATE TABLE IF NOT EXISTS materials (
  id varchar(20) NOT NULL,
  name varchar(100) NOT NULL,
  type varchar(50) DEFAULT NULL,
  price decimal(10,2) NOT NULL,
  unit varchar(20) DEFAULT 'KES/kg',
  change_pct decimal(6,2) DEFAULT '0.00',
  trend enum('up','down') DEFAULT 'up',
  stock_kg int DEFAULT '0',
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hotspots (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  area varchar(100) DEFAULT NULL,
  county varchar(50) NOT NULL DEFAULT 'Nairobi',
  primary_material_id varchar(20) DEFAULT NULL,
  activity int DEFAULT '0',
  stock_kg int DEFAULT '0',
  active tinyint(1) DEFAULT '1',
  lat decimal(9,6) DEFAULT NULL,
  lng decimal(9,6) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY primary_material_id (primary_material_id),
  CONSTRAINT hotspots_ibfk_1 FOREIGN KEY (primary_material_id) REFERENCES materials (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hotspot_materials (
  id int NOT NULL AUTO_INCREMENT,
  hotspot_id int NOT NULL,
  material_name varchar(100) NOT NULL,
  quantity decimal(10,2) NOT NULL DEFAULT '0.00',
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_hotspot_material (hotspot_id, material_name),
  CONSTRAINT hotspot_materials_ibfk_1 FOREIGN KEY (hotspot_id) REFERENCES hotspots (id)
) ENGINE=InnoDB;

-- Webapp accounts. accessibility_needs is NULL until the onboarding question is answered,
-- then a JSON array of AccessMap feature names ([] = no needs).
CREATE TABLE IF NOT EXISTS users (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  phone varchar(20) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role enum('seller','buyer','hub_manager') NOT NULL,
  hotspot_id int DEFAULT NULL,
  accessibility_needs json DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_phone (phone),
  KEY hotspot_id (hotspot_id),
  CONSTRAINT users_ibfk_1 FOREIGN KEY (hotspot_id) REFERENCES hotspots (id)
) ENGINE=InnoDB;

-- Only a SHA-256 of each session token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash char(64) NOT NULL,
  user_id int NOT NULL,
  expires_at datetime NOT NULL,
  PRIMARY KEY (token_hash),
  KEY user_id (user_id),
  CONSTRAINT sessions_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Buyer orders. buyer_id/hotspot_id are NULL for rows from before the webapp.
CREATE TABLE IF NOT EXISTS transactions (
  id varchar(20) NOT NULL,
  material varchar(100) NOT NULL,
  quantity decimal(10,2) NOT NULL,
  amount decimal(10,2) NOT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  buyer_id int DEFAULT NULL,
  hotspot_id int DEFAULT NULL,
  material_id varchar(20) DEFAULT NULL,
  status enum('paid','collected') NOT NULL DEFAULT 'paid',
  collected_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY buyer_id (buyer_id),
  KEY hotspot_id (hotspot_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS scrap_logs (
  id int NOT NULL AUTO_INCREMENT,
  log_id varchar(30) DEFAULT NULL,
  job_id varchar(50) DEFAULT NULL,
  artisan_id varchar(50) DEFAULT NULL,
  material_type varchar(50) DEFAULT NULL,
  hotspot_id int DEFAULT NULL,
  material_id varchar(20) DEFAULT NULL,
  quantity_kg decimal(10,2) NOT NULL,
  notes text,
  logged_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_scrap_log_id (log_id),
  KEY hotspot_id (hotspot_id),
  KEY material_id (material_id),
  CONSTRAINT scrap_logs_ibfk_1 FOREIGN KEY (hotspot_id) REFERENCES hotspots (id),
  CONSTRAINT scrap_logs_ibfk_2 FOREIGN KEY (material_id) REFERENCES materials (id)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS drop_offs (
  id int NOT NULL AUTO_INCREMENT,
  drop_off_id varchar(30) DEFAULT NULL,
  hotspot_id int NOT NULL,
  material_type varchar(50) NOT NULL,
  quantity_kg decimal(10,2) NOT NULL,
  source varchar(120) NOT NULL,
  notes text,
  status enum('pending','received') NOT NULL DEFAULT 'pending',
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  -- Webapp sellers (NULL for drop-offs made by Group 1 through the partner API)
  seller_id int DEFAULT NULL,
  material_id varchar(20) DEFAULT NULL,
  received_kg decimal(10,2) DEFAULT NULL,
  payout_kes decimal(10,2) DEFAULT NULL,
  received_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_drop_off_id (drop_off_id),
  KEY hotspot_id (hotspot_id),
  KEY seller_id (seller_id),
  CONSTRAINT drop_offs_ibfk_1 FOREIGN KEY (hotspot_id) REFERENCES hotspots (id)
) ENGINE=InnoDB;
