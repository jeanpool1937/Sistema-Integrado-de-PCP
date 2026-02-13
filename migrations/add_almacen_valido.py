import sqlite3
import os

# Ruta de la base de datos
DB_PATH = r"c:\Users\Avargas\OneDrive - OVERALL\Documentos\Antigravity\Sistema-Integrado-de-PCP\backend\data\inventory.db"

def add_column():
    print(f"Connecting to database at: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Añadir columna almacen_valido si no existe
        print("Adding column 'almacen_valido' to 'movimientos_stock' table...")
        cursor.execute("ALTER TABLE movimientos_stock ADD COLUMN almacen_valido VARCHAR(20)")
        conn.commit()
        print("Column added successfully.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'almacen_valido' already exists. Skipping.")
        else:
            print(f"Error adding column: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_column()
