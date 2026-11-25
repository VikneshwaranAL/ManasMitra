#!/usr/bin/env python3
"""
ManasMitra Database Initializer
Creates and seeds manasmitra.db using standard library sqlite3.
"""

import os
import sqlite3
import sys

# Ensure UTF-8 output on Windows consoles
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'manasmitra.db')
SCHEMA_PATH = os.path.join(BASE_DIR, 'schema.sql')
SEED_PATH = os.path.join(BASE_DIR, 'seed.sql')

def init_database():
    print("=" * 60)
    print("[ManasMitra] Initializing Database...")
    print("=" * 60)
    print(f"Target Database File: {DB_PATH}")

    # Remove existing DB file if clean reset requested
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            print("[OK] Removed existing database for clean setup.")
        except Exception as e:
            print(f"[!] Warning: Could not remove old db ({e}), overwriting tables.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Read and execute schema
    print(f"Executing schema from: {SCHEMA_PATH} ...")
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    cursor.executescript(schema_sql)
    print("[OK] Schema tables and indexes created successfully.")

    # Read and execute seed data
    print(f"Executing seed data from: {SEED_PATH} ...")
    with open(SEED_PATH, 'r', encoding='utf-8') as f:
        seed_sql = f.read()
    cursor.executescript(seed_sql)
    conn.commit()
    print("[OK] Starter seed data inserted successfully.")

    # Verification of tables and row counts
    print("\n" + "-" * 45)
    print(f"{'Table Name':<25} | {'Row Count':<15}")
    print("-" * 45)

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    tables = [row[0] for row in cursor.fetchall()]

    total_rows = 0
    for tbl in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
        count = cursor.fetchone()[0]
        total_rows += count
        print(f"{tbl:<25} | {count:<15}")

    print("-" * 45)
    print(f"Total Tables: {len(tables)} | Total Records: {total_rows}")
    print("=" * 60)
    print("[SUCCESS] ManasMitra Database ready to use!\n")

    conn.close()

if __name__ == '__main__':
    try:
        init_database()
    except Exception as err:
        print(f"[ERROR] Database setup failed: {err}", file=sys.stderr)
        sys.exit(1)
