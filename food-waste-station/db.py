"""Saves every tray and vote in a small local database (SQLite).

No student names or IDs are ever stored: only food, weights and votes.
"""
import json
import sqlite3
from datetime import datetime

from config import DB_PATH


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS trays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            served_date TEXT NOT NULL,
            total_leftover_grams REAL NOT NULL,
            photo_path TEXT
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS leftovers (
            tray_id INTEGER NOT NULL REFERENCES trays(id),
            item TEXT NOT NULL,
            served_grams REAL NOT NULL,
            fraction_left REAL NOT NULL,
            wasted_grams REAL NOT NULL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tray_id INTEGER REFERENCES trays(id),
            timestamp TEXT NOT NULL,
            served_date TEXT NOT NULL,
            reason TEXT NOT NULL
        )"""
    )
    return conn


def save_tray(conn, served_date, total_leftover_grams, leftovers, photo_path=None, timestamp=None):
    """leftovers: list of dicts with item, served_grams, fraction_left."""
    timestamp = timestamp or datetime.now().isoformat(timespec="seconds")
    cur = conn.execute(
        "INSERT INTO trays (timestamp, served_date, total_leftover_grams, photo_path) VALUES (?, ?, ?, ?)",
        (timestamp, served_date, total_leftover_grams, photo_path),
    )
    tray_id = cur.lastrowid
    for row in leftovers:
        frac = max(0.0, min(1.0, float(row["fraction_left"])))
        conn.execute(
            "INSERT INTO leftovers (tray_id, item, served_grams, fraction_left, wasted_grams) VALUES (?, ?, ?, ?, ?)",
            (tray_id, row["item"], row["served_grams"], frac, round(frac * row["served_grams"], 1)),
        )
    conn.commit()
    return tray_id


def save_vote(conn, served_date, reason, tray_id=None, timestamp=None):
    timestamp = timestamp or datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "INSERT INTO votes (tray_id, timestamp, served_date, reason) VALUES (?, ?, ?, ?)",
        (tray_id, timestamp, served_date, reason),
    )
    conn.commit()


def export_json(conn):
    """Handy for debugging: dump everything as JSON."""
    trays = [dict(r) for r in conn.execute("SELECT * FROM trays")]
    leftovers = [dict(r) for r in conn.execute("SELECT * FROM leftovers")]
    votes = [dict(r) for r in conn.execute("SELECT * FROM votes")]
    return json.dumps({"trays": trays, "leftovers": leftovers, "votes": votes}, indent=2)
