import sys
import os
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database.db import Base
import services.projection as proj
from database import DBMaestroArticulo

DB_URL = "sqlite:///./backend/data/inventory.db"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

sku = "301107"
horizon = 30

print(f"--- Diagnosing SKU: {sku} ---")
# 1. Check Maestro
m = db.query(DBMaestroArticulo).filter(DBMaestroArticulo.codigo == sku).first()
if m:
    print(f"Maestro: Code={m.codigo}, Safety={m.safety_stock}")
else:
    print("Maestro: NOT FOUND")
    # Try with leading zeros?
    m2 = db.query(DBMaestroArticulo).filter(DBMaestroArticulo.codigo.ilike(f"%{sku}")).first()
    if m2:
        print(f"Maestro (Alternative): Code={m2.codigo}, Safety={m2.safety_stock}")
        sku = m2.codigo

# 2. Check Initial Stock
stock, breakdown = proj.get_initial_stock(db, sku)
print(f"Initial Stock: {stock}")
print(f"Breakdown: {breakdown}")

# 3. Check Projection
today = date.today()
demand = proj.get_demand_out(db, sku, today, today + timedelta(days=horizon))
supply = proj.get_supply_in(db, sku, today, today + timedelta(days=horizon))

print(f"Demand count: {len(demand)}")
print(f"Supply count: {len(supply)}")

# 4. Check Alerts logic
alerts = proj.get_stockout_alerts(db, horizon_days=horizon)
print(f"Total Alerts from function: {len(alerts)}")

# Check if this specific SKU is in alerts
my_alert = next((a for a in alerts if a['sku'] == sku or a['sku'].lstrip('0') == sku), None)
print(f"Alert found for {sku}: {my_alert}")

db.close()
