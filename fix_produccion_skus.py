import sqlite3
import os

db_path = os.path.join(os.getcwd(), 'backend', 'data', 'inventory.db')
if not os.path.exists(db_path):
    # Try parent if running from different locations
    db_path = os.path.join(os.getcwd(), 'Sistema-Integrado-de-PCP', 'backend', 'data', 'inventory.db')

print(f"Connecting to database: {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Normalize SKU (Finished Product)
print("Normalizing 'sku' column in plan_produccion...")
cursor.execute("SELECT id, sku FROM plan_produccion WHERE sku IS NOT NULL")
rows = cursor.fetchall()
for id_, sku in rows:
    normalized = str(sku).strip().lstrip('0')
    if not normalized or normalized in ['nan', 'None', '0']:
        normalized = None
    if normalized != sku:
        cursor.execute("UPDATE plan_produccion SET sku = ? WHERE id = ?", (normalized, id_))

# 2. Normalize Materia Prima (Raw Material / Consumption)
print("Normalizing 'materia_prima' column in plan_produccion...")
cursor.execute("SELECT id, materia_prima FROM plan_produccion WHERE materia_prima IS NOT NULL")
rows = cursor.fetchall()
for id_, mp in rows:
    normalized = str(mp).strip().lstrip('0')
    if not normalized or normalized in ['nan', 'None', '0']:
        normalized = None
    if normalized != mp:
        cursor.execute("UPDATE plan_produccion SET materia_prima = ? WHERE id = ?", (normalized, id_))

conn.commit()
print("Migration completed successfully.")
conn.close()
