-- schema.sql
CREATE TABLE IF NOT EXISTS plan_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    subjects_count INTEGER NOT NULL,
    total_hours REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timestamp ON plan_stats(timestamp);