import sqlite3
import os

# Robust path detection
db_path = os.path.join(os.getcwd(), 'backend', 'data', 'inventory.db')
if not os.path.exists(db_path):
    parent_dir = os.path.dirname(os.getcwd())
    db_path = os.path.join(parent_dir, 'Sistema-Integrado-de-PCP', 'backend', 'data', 'inventory.db')

if not os.path.exists(db_path):
    db_path = os.path.join(os.getcwd(), 'Sistema-Integrado-de-PCP', 'backend', 'data', 'inventory.db')

if not os.path.exists(db_path):
    print(f"Error: Database not found. Tried various paths including {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print(f"--- Checking database: {db_path} ---")
print("--- Checking for normalized materia_prima (Consumos) ---")
cursor.execute("""
    SELECT materia_prima, COUNT(*) 
    FROM plan_produccion 
    WHERE materia_prima IS NOT NULL 
      AND materia_prima NOT IN ('0', 'None', 'nan', '')
    GROUP BY materia_prima 
    LIMIT 10
""")

rows = cursor.fetchall()
if not rows:
    print("No valid consumptions found in plan_produccion (excluding '0', 'None', etc.).")
else:
    for mp, count in rows:
        print(f"SKU: {mp} | Count: {count}")

conn.close()
