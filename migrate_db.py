import sqlite3
import os

# Path to database
db_path = r"c:\Users\Avargas\OneDrive - OVERALL\Documentos\Antigravity\backend\data\inventory.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Attempting to add lead_time column...")
    try:
        cursor.execute("ALTER TABLE maestro_articulos ADD COLUMN lead_time REAL DEFAULT 0")
        conn.commit()
        print("Success: Column 'lead_time' added.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
             print("Info: Column 'lead_time' already exists.")
        else:
             print(f"Error executing ALTER TABLE: {e}")
             
    conn.close()

except Exception as e:
    print(f"Connection failed: {e}")
