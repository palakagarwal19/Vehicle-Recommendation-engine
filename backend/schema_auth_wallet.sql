-- =============================================================
-- CarbonWise  —  User Auth + Carbon Wallet Schema
-- Run once against your PostgreSQL database.
-- =============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Carbon wallet  (one row per user — yearly budget)
CREATE TABLE IF NOT EXISTS carbon_wallet (
    user_id              INT     PRIMARY KEY,
    year                 INT     NOT NULL,
    total_credits_kg     FLOAT   NOT NULL DEFAULT 2300,
    remaining_credits_kg FLOAT   NOT NULL DEFAULT 2300,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Travel log
CREATE TABLE IF NOT EXISTS travel_log (
    id          SERIAL PRIMARY KEY,
    user_id     INT    NOT NULL,
    vehicle_id  INT,                          -- nullable: vehicle may be deleted
    distance_km FLOAT  NOT NULL,
    emissions_kg FLOAT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_travel_log_user ON travel_log (user_id, created_at DESC);
