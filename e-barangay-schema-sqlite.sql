-- Active: 1790130249534@@127.0.0.1@3306
-- E-Barangay SQLite Schema
-- SQLite version — connect directly to e-barangay.db (no CREATE DATABASE needed)
-- Run this once against a fresh/empty e-barangay.db file

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS residents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    birth_date TEXT,
    gender TEXT,
    civil_status TEXT,
    address TEXT,
    purok TEXT,
    contact TEXT,
    occupation TEXT,
    voter INTEGER DEFAULT 0,
    senior INTEGER DEFAULT 0,
    pwd INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    verified INTEGER DEFAULT 0,
    verified_by TEXT,
    verified_date TEXT,
    registered TEXT,
    proof TEXT,
    nationality TEXT DEFAULT 'Filipino',
    birthplace TEXT,
    email TEXT,
    national_id TEXT,
    id_verified INTEGER DEFAULT 0,
    id_verified_date TEXT,
    id_image TEXT,
    ocr_text TEXT,
    ocr_name TEXT,
    profile_pic TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_name ON residents (last_name, first_name);

CREATE TRIGGER IF NOT EXISTS trg_residents_updated_at
AFTER UPDATE ON residents
FOR EACH ROW
BEGIN
    UPDATE residents SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin','Secretary','Treasurer','Resident')),
    name TEXT,
    resident_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS doc_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    fee REAL DEFAULT 0,
    template TEXT,
    pdf_asset TEXT,
    required_fields TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resident_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    purpose TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','For Payment','Paid','Verified','Released','Rejected','Cancelled')),
    request_date TEXT,
    approved_date TEXT,
    release_date TEXT,
    fee REAL DEFAULT 0,
    payment_id INTEGER,
    extra_data TEXT,
    remarks TEXT,
    processed_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_status ON documents (status);
CREATE INDEX IF NOT EXISTS idx_resident ON documents (resident_id);

CREATE TRIGGER IF NOT EXISTS trg_documents_updated_at
AFTER UPDATE ON documents
FOR EACH ROW
BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,
    resident_id INTEGER,
    amount REAL NOT NULL,
    method TEXT DEFAULT 'Cash',
    reference TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Rejected')),
    payment_date TEXT,
    verified_by TEXT,
    verified_date TEXT,
    receipt_image TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document ON payments (document_id);

CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT,
    location TEXT,
    status TEXT DEFAULT 'Upcoming' CHECK (status IN ('Upcoming','Ongoing','Completed','Cancelled')),
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    for_role TEXT,
    resident_id INTEGER,
    category TEXT DEFAULT 'general',
    is_read INTEGER DEFAULT 0,
    time_label TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pending_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    middle_name TEXT,
    username TEXT,
    password TEXT,
    birth_date TEXT,
    gender TEXT,
    civil_status TEXT,
    address TEXT,
    purok TEXT,
    contact TEXT,
    occupation TEXT,
    proof TEXT,
    submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Pending'
);

CREATE TABLE IF NOT EXISTS profiling (
    id INTEGER PRIMARY KEY,
    name TEXT,
    city TEXT,
    municipality TEXT,
    province TEXT,
    population INTEGER DEFAULT 0,
    households INTEGER DEFAULT 0,
    puroks INTEGER DEFAULT 8,
    captain TEXT,
    contact TEXT,
    email TEXT,
    address TEXT,
    land_area TEXT,
    established TEXT,
    captain_signature TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_profiling_updated_at
AFTER UPDATE ON profiling
FOR EACH ROW
BEGIN
    UPDATE profiling SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS settings (
    `key` TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
AFTER UPDATE ON settings
FOR EACH ROW
BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE `key` = OLD.`key`;
END;

CREATE TABLE IF NOT EXISTS transaction_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    performed_by TEXT,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed data
INSERT OR IGNORE INTO users (username, password, role, name) VALUES
('admin', 'admin123', 'Admin', 'Hon. Amy A. Diwara'),
('captain', 'cap123', 'Admin', 'Hon. Amy A. Diwara'),
('secretary', 'sec123', 'Secretary', 'Barangay Secretary'),
('treasurer', 'treas123', 'Treasurer', 'Barangay Treasurer');

INSERT INTO profiling (id, name, city, municipality, province, population, households, puroks, captain, contact, email, address, land_area, established)
VALUES (1, 'Barangay Dumanguena', 'Narra', 'Narra', 'Palawan', 0, 0, 8, 'Hon. Amy A. Diwara', '0985-180-2847', 'barangay.dumanguena@email.com', 'Barangay Hall, Dumanguena, Narra, Palawan', '2.5 sq. km', '1975')
ON CONFLICT(id) DO UPDATE SET name = excluded.name;

INSERT INTO settings (`key`, value) VALUES
('gcash_number', '0985-180-2847'),
('gcash_name', 'Barangay Dumanguena — Treasurer')
ON CONFLICT(`key`) DO UPDATE SET value = excluded.value;

INSERT OR IGNORE INTO doc_types (name, fee, template, pdf_asset, required_fields) VALUES
('Barangay Clearance', 50.00, '', 'assets/Barangay Clearance.pdf', '["purpose"]'),
('Certificate of Indigency', 0.00, '', 'assets/Barangay Certificate of Indigency.pdf', '["purpose","monthlyIncome","employmentStatus","beneficiaryName"]'),
('Certificate of Residency', 50.00, '', 'assets/Barangay Certificate of Residency.pdf', '["purpose","yearsResiding","completeAddress"]'),
('Barangay Certification', 50.00, '', 'assets/Barangay Certification.pdf', '["purpose","completeAddress"]'),
('Business Permit', 200.00, '', 'assets/Business Permit.pdf', '["businessName","ownerName","businessAddress","businessPurpose"]'),
('Blotter / Incident Report', 0.00, '', 'assets/Blotter&Incident Report.pdf', '["incidentDetails"]'),
('Certificate of Solo Parent', 0.00, '', 'assets/Barangay Certificate of Solo Parent.pdf', '["soloCircumstance","childrenCount"]'),
('Certificate of Low Income', 0.00, '', 'assets/Certificate of Low Income.pdf', '["purpose","monthlyIncome"]'),
('Barangay Endorsement', 50.00, '', 'assets/Barangay Endorsement.pdf', '["Date","receivingOffice","Officeaddress","Full Name","civilStatus","endorsementReason"]'),
('Certificate of No Pending Case', 50.00, '', 'assets/Certificate of No Pending Case.pdf', '["Full Name","civilStatus","purpose"]'),
('Certificate of Good Moral Character', 50.00, '', 'assets/Barangay Certificate of Residency.pdf', '["purpose"]');
