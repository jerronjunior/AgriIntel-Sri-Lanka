"""Local SQLite store (one file, no server). Safe to re-run: every write is an upsert."""
import json
import sqlite3
from datetime import UTC, datetime

SCHEMA = """
CREATE TABLE IF NOT EXISTS observations (
  dataset TEXT NOT NULL, place TEXT NOT NULL, obs_date TEXT NOT NULL, metric TEXT NOT NULL,
  value REAL NOT NULL, units TEXT, extra TEXT, fetched_at TEXT NOT NULL,
  PRIMARY KEY (dataset, place, obs_date, metric));
CREATE INDEX IF NOT EXISTS ix_obs_metric ON observations(metric, place, obs_date);
CREATE TABLE IF NOT EXISTS normals (
  place TEXT NOT NULL, month INTEGER NOT NULL, param TEXT NOT NULL, value REAL, elevation_m REAL, fetched_at TEXT NOT NULL,
  PRIMARY KEY (place, month, param));
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY, dataset TEXT NOT NULL, scope TEXT NOT NULL, window_start TEXT, window_end TEXT,
  product TEXT, layer TEXT, keys TEXT, meta TEXT, status TEXT NOT NULL, rows INTEGER DEFAULT 0, error TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runs (
  dataset TEXT PRIMARY KEY, last_success_at TEXT, last_error TEXT, last_error_at TEXT);
"""


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def connect(path: str) -> sqlite3.Connection:
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db


def upsert(db: sqlite3.Connection, rows: list[dict]) -> int:
    t = now()
    db.executemany(
        "INSERT INTO observations (dataset, place, obs_date, metric, value, units, extra, fetched_at) VALUES (?,?,?,?,?,?,?,?) "
        "ON CONFLICT(dataset, place, obs_date, metric) DO UPDATE SET value=excluded.value, units=excluded.units, "
        "extra=excluded.extra, fetched_at=excluded.fetched_at",
        [(r["dataset"], r["place"], str(r["date"]), r["metric"], float(r["value"]), r.get("units", ""), json.dumps(r.get("extra") or {}), t) for r in rows])
    db.commit()
    return len(rows)


def mark(db: sqlite3.Connection, dataset: str, ok: bool, error: str | None = None) -> None:
    if ok:
        db.execute("INSERT INTO runs (dataset, last_success_at) VALUES (?, ?) ON CONFLICT(dataset) DO UPDATE SET last_success_at=excluded.last_success_at",
                   (dataset, now()))
    else:
        db.execute("INSERT INTO runs (dataset, last_error, last_error_at) VALUES (?, ?, ?) ON CONFLICT(dataset) DO UPDATE SET "
                   "last_error=excluded.last_error, last_error_at=excluded.last_error_at", (dataset, (error or "")[:1000], now()))
    db.commit()
