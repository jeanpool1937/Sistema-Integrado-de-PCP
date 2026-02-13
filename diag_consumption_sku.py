import sqlite3
import os
from datetime import date

db_path = os.path.join(os.getcwd(), 'backend', 'data', 'inventory.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

sku = "300000"
print(f"--- Diagnostic for SKU: {sku} ---")

# 1. Total rows for this SKU as materia_prima
c.execute("SELECT COUNT(*) FROM plan_produccion WHERE materia_prima = ?", (sku,))
count = c.fetchone()[0]
print(f"Total consumption records: {count}")

# 2. Date range of consumptions
c.execute("SELECT MIN(fecha), MAX(fecha) FROM plan_produccion WHERE materia_prima = ?", (sku,))
min_f, max_f = c.fetchone()
print(f"Consumption date range: {min_f} to {max_f}")

# 3. Sample records
print("\nSample records for this SKU (first 10):")
c.execute("SELECT fecha, sku, materia_prima, consumo, clase_proceso FROM plan_produccion WHERE materia_prima = ? LIMIT 10", (sku,))
for r in c.fetchall():
    print(r)

# 4. Check if there are ANY consumptions in the future (from Jan 15, 2026)
test_date = "2026-01-15"
c.execute("SELECT COUNT(*) FROM plan_produccion WHERE materia_prima = ? AND fecha >= ?", (sku, test_date))
future_count = c.fetchone()[0]
print(f"\nConsumptions from {test_date} onwards: {future_count}")

# 5. Check processes
c.execute("SELECT DISTINCT clase_proceso FROM plan_produccion WHERE materia_prima = ?", (sku,))
processes = [r[0] for r in c.fetchall()]
print(f"Processes involved: {processes}")

conn.close()
