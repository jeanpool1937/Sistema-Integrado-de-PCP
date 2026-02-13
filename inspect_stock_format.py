import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path to import models
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database.db import DBMaestroArticulo, DBMovimientoStock, DBDemandaProyectada, DBPlanProduccion
from database import Base

DB_URL = "sqlite:///./backend/data/inventory.db"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("--- Maestro Articulos (Ejemplos) ---")
maestro = db.query(DBMaestroArticulo.codigo).limit(5).all()
for m in maestro:
    print(f"'{m.codigo}'")

print("\n--- Movimientos Stock (Ejemplos) ---")
movs = db.query(DBMovimientoStock.codigo).limit(5).all()
for m in movs:
    print(f"'{m.codigo}'")

print("\n--- Demanda Proyectada (Ejemplos) ---")
dem = db.query(DBDemandaProyectada.codigo).limit(5).all()
for m in dem:
    print(f"'{m.codigo}'")

print("\n--- Plan Produccion (Ejemplos) ---")
pp = db.query(DBPlanProduccion.sku, DBPlanProduccion.materia_prima).limit(5).all()
for p in pp:
    print(f"sku: '{p.sku}', mp: '{p.materia_prima}'")

db.close()
