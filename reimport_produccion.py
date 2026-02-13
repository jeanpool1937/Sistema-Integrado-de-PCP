import os
import sys
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path to import models and services
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database.db import DBPlanProduccion, init_db
from services.file_parser import parse_produccion

# Database setup
db_path = os.path.join(os.getcwd(), 'backend', 'data', 'inventory.db')
engine = create_engine(f'sqlite:///{db_path}')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

excel_path = os.path.join(os.getcwd(), 'Planes Produccion.xlsx')

try:
    print(f"Reading file: {excel_path}")
    df, warnings = parse_produccion(excel_path)
    print(f"Parsed {len(df)} rows. Warnings: {warnings}")
    
    if not df.empty:
        # 1. Clear existing production plans
        print("Clearing old production data...")
        db.query(DBPlanProduccion).delete()
        db.commit()
        
        # 2. Insert new data
        print("Inserting corrected production data...")
        model_cols = {c.name for c in DBPlanProduccion.__table__.columns}
        insert_df = df[[c for c in df.columns if c in model_cols]].copy()
        
        # Convert df to list of dicts for bulk insert
        db.bulk_insert_mappings(DBPlanProduccion, insert_df.to_dict(orient='records'))
        db.commit()
        print(f"Successfully re-imported {len(insert_df)} records.")
        
        # Verify a sample date
        sample_date = insert_df['fecha'].iloc[0]
        print(f"Sample date from re-import: {sample_date}")
        
    else:
        print("Error: Parsed dataframe is empty.")

except Exception as e:
    print(f"An error occurred: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
