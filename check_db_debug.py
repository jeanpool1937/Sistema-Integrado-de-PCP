import sqlite3
import os

DB_DIR = os.path.join(os.path.dirname(__file__), "backend", "data")
db_path = os.path.join(DB_DIR, "inventory.db")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check columns in movimientos_stock
    cursor.execute("PRAGMA table_info(movimientos_stock)")
    cols = cursor.fetchall()
    print("Columns in movimientos_stock:", [c[1] for c in cols])
    
    # Check last 5 entries with type STOCK
    cursor.execute("SELECT codigo, centro, almacen, cantidad FROM movimientos_stock WHERE clase_movimiento = 'STOCK' ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    print("\nLast 5 STOCK entries:")
    for r in rows:
        print(f"SKU: {r[0]} | Centro: {r[1]} | Almacen: {r[2]} | Cant: {r[3]}")
    
    conn.close()
else:
    print(f"Database {db_path} not found.")
