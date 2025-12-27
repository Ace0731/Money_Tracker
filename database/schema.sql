-- ACCOUNTS
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('bank','cash','investment')) NOT NULL,
  opening_balance REAL NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT CHECK(kind IN ('income','expense','transfer')) NOT NULL,
  notes TEXT
);

-- CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  client_id INTEGER,
  expected_amount REAL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- TAGS
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- TRANSACTIONS (CORE TABLE)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  date DATE NOT NULL,
  amount REAL NOT NULL,
  direction TEXT CHECK(direction IN ('income','expense','transfer')) NOT NULL,

  from_account_id INTEGER,
  to_account_id INTEGER,

  category_id INTEGER NOT NULL,
  client_id INTEGER,
  project_id INTEGER,

  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (from_account_id) REFERENCES accounts(id),
  FOREIGN KEY (to_account_id) REFERENCES accounts(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- TRANSACTION TAGS (MANY-TO-MANY)
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, tag_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- TAX PROFILES (OPTIONAL / FUTURE)
CREATE TABLE IF NOT EXISTS tax_profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  tax_type TEXT CHECK(tax_type IN ('income_tax','gst','tds')),
  calculation_mode TEXT CHECK(calculation_mode IN ('manual','slab')),
  notes TEXT
);

-- TRANSACTION TAX LINKS (OPTIONAL)
CREATE TABLE IF NOT EXISTS transaction_taxes (
  transaction_id INTEGER NOT NULL,
  tax_profile_id INTEGER NOT NULL,
  tax_amount REAL,
  PRIMARY KEY (transaction_id, tax_profile_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (tax_profile_id) REFERENCES tax_profiles(id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON transaction_tags(tag_id);
