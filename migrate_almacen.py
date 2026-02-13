import sqlite3
import os

# Database path as defined in backend/database/db.py
DB_DIR = os.path.join(os.path.dirname(__file__), "backend", "data")
db_path = os.path.join(DB_DIR, "inventory.db")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE movimientos_stock ADD COLUMN almacen VARCHAR(50)")
        print(f"Column 'almacen' added to 'movimientos_stock' successfully in {db_path}.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'almacen' already exists.")
        else:
            print(f"Error: {e}")
    
    conn.commit()
    conn.close()
else:
    print(f"Database {db_path} not found.")
