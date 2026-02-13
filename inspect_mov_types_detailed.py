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
types = db.query(
    DBMovimientoStock.tipo_movimiento, 
    func.min(DBMovimientoStock.fecha), 
    func.max(DBMovimientoStock.fecha),
    func.count(DBMovimientoStock.id)
).group_by(DBMovimientoStock.tipo_movimiento).all()

for t, mini, maxi, count in types:
    print(f"Tipo: '{t}' | Range: {mini} to {maxi} | Count: {count}")

db.close()
