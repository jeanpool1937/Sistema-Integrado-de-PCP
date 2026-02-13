
from backend.database.db import SessionLocal, DBProceso
from sqlalchemy import select

def check_process_master():
    db = SessionLocal()
    try:
        # Get all processes
        stm = select(DBProceso)
        results = db.execute(stm).scalars().all()
        print("Procesos Maestros encontrados:")
        count = 0
        for r in results:
            print(f"- Clase: {r.clase_proceso} -> Proceso: {r.proceso}, Area: {r.area}")
            count += 1
            if count > 50: break
            
        if count == 0:
            print("No se encontraron registros en la tabla 'procesos'.")

    finally:
        db.close()

if __name__ == "__main__":
    check_process_master()
