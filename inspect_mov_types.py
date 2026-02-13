import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database.db import DBMovimientoStock
from sqlalchemy import func

DB_URL = "sqlite:///./backend/data/inventory.db"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("--- Tipos de Movimiento en DB ---")
types = db.query(DBMovimientoStock.tipo_movimiento, func.count(DBMovimientoStock.id)).group_by(DBMovimientoStock.tipo_movimiento).all()
for t, count in types:
    print(f"Tipo: '{t}', Count: {count}")

print("\n--- Clases de Movimiento en DB ---")
clases = db.query(DBMovimientoStock.clase_movimiento, func.count(DBMovimientoStock.id)).group_by(DBMovimientoStock.clase_movimiento).all()
for cl, count in clases:
    print(f"Clase: '{cl}', Count: {count}")

print("\n--- Fechas de Movimiento ---")
dates = db.query(func.min(DBMovimientoStock.fecha), func.max(DBMovimientoStock.fecha)).first()
print(f"Min: {dates[0]}, Max: {dates[1]}")

db.close()
