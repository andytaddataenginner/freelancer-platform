-- ═══════════════════════════════════════════════════════════════
-- Freelancer Platform Schema
-- Compatible with PostgreSQL (Supabase free tier)
-- Run this in the Supabase SQL editor to set up your database
-- ═══════════════════════════════════════════════════════════════

-- Users table (both freelancer and clients)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255)        NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255)        NOT NULL,
  role          VARCHAR(20)         NOT NULL DEFAULT 'client', -- 'freelancer' | 'client'
  company       VARCHAR(255),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Clients (extra info for client users, linked to users)
CREATE TABLE IF NOT EXISTS clients (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  notes      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time logs
CREATE TABLE IF NOT EXISTS time_logs (
  id               SERIAL PRIMARY KEY,
  client_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  freelancer_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  hours            NUMERIC(5,2) NOT NULL,
  task_description TEXT        NOT NULL,
  source           VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual' | 'timer'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schedule / bookings
CREATE TABLE IF NOT EXISTS bookings (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  freelancer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  time         TIME        NOT NULL,
  duration     NUMERIC(3,1) NOT NULL DEFAULT 1.0,  -- hours
  type         VARCHAR(50)  NOT NULL DEFAULT 'call', -- 'call'|'review'|'workshop'|'other'
  message      TEXT,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending', -- 'pending'|'confirmed'|'cancelled'
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Portfolio items
CREATE TABLE IF NOT EXISTS portfolio_items (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  category     VARCHAR(100),
  emoji        VARCHAR(10) DEFAULT '💻',
  url          TEXT,
  image_url    TEXT,
  sort_order   INTEGER DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contact form submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255),
  email      VARCHAR(255),
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_logs_client     ON time_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_freelancer ON time_logs(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date       ON time_logs(date);
CREATE INDEX IF NOT EXISTS idx_bookings_client      ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date        ON bookings(date);

-- ── Seed: default freelancer account ─────────────────────────
-- Password: changeme123 (bcrypt hash — change this immediately after setup!)
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Your Name',
  'you@example.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- "password"
  'freelancer'
)
ON CONFLICT (email) DO NOTHING;

-- ── Seed: sample portfolio items ─────────────────────────────
INSERT INTO portfolio_items (title, description, category, emoji, sort_order) VALUES
  ('E-commerce Platform', 'Full-stack online store with inventory and payments', 'Web App', '🛒', 1),
  ('Analytics Dashboard', 'Real-time logistics tracking dashboard for 50k+ daily events', 'Dashboard', '📊', 2),
  ('Mobile Field App', 'Progressive web app for field technicians with offline support', 'Mobile Web', '📱', 3)
ON CONFLICT DO NOTHING;
