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
  primary_material_id varchar(20) DEFAULT NULL,
  activity int DEFAULT '0',
  stock_kg int DEFAULT '0',
  active tinyint(1) DEFAULT '1',
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

CREATE TABLE IF NOT EXISTS transactions (
  id varchar(20) NOT NULL,
  material varchar(100) NOT NULL,
  quantity decimal(10,2) NOT NULL,
  amount decimal(10,2) NOT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
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

