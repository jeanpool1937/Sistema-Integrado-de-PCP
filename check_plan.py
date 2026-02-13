import sqlite3
import os

db_path = "c:\\Users\\Avargas\\OneDrive - OVERALL\\Documentos\\Antigravity\\Sistema-Integrado-de-PCP\\backend\\data\\inventory.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

sku = "300000"

print(f"--- Checking plan_produccion for materia_prima = {sku} ---")
cursor.execute("SELECT * FROM plan_produccion WHERE materia_prima = ?", (sku,))
rows = cursor.fetchall()
for row in rows:
    print(row)

print(f"\n--- Checking plan_produccion for sku = {sku} ---")
cursor.execute("SELECT * FROM plan_produccion WHERE sku = ?", (sku,))
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()
