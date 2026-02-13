"""
Configuración de base de datos SQLite con SQLAlchemy ORM.
Tablas para almacenar datos procesados y logs de validación.
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, Date, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# Crear directorio para la base de datos
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DB_DIR, exist_ok=True)
DATABASE_URL = f"sqlite:///{os.path.join(DB_DIR, 'inventory.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ============== TABLAS DE DATOS ==============

class DBMaestroArticulo(Base):
    """Tabla Maestro de Artículos"""
    __tablename__ = "maestro_articulos"
    
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), unique=True, index=True, nullable=False)
    descripcion = Column(String(255), nullable=False)
    unidad_medida = Column(String(20))
    nivel1_jerarquia = Column(String(100))
    nivel2_jerarquia = Column(String(100))
    nivel3_jerarquia = Column(String(100))
    grupo_articulos = Column(String(100))
    tipo_material = Column(String(100))
    prioridad = Column(String(50))
    clase = Column(String(50))
    agrupacion_comercial = Column(String(100))
    lead_time = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DBCentro(Base):
    """Tabla Maestra de Centros"""
    __tablename__ = "centros"
    
    id = Column(Integer, primary_key=True, index=True)
    centro = Column(String(50), unique=True, index=True, nullable=False)
    descripcion = Column(String(255))
    pais = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class DBProceso(Base):
    """Tabla Maestra de Procesos Productivos"""
    __tablename__ = "procesos"
    
    id = Column(Integer, primary_key=True, index=True)
    clase_proceso = Column(String(50), index=True)
    proceso = Column(String(100), index=True)
    area = Column(String(100))
    centro_codigo = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBDemandaProyectada(Base):
    """Tabla Demanda Proyectada Diaria"""
    __tablename__ = "demanda_proyectada"
    
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False, index=True)
    codigo = Column(String(50), nullable=False, index=True)
    descripcion = Column(String(255))
    cantidad_diaria = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBMovimientoStock(Base):
    """Tabla Movimientos de Stock"""
    __tablename__ = "movimientos_stock"
    
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), nullable=False, index=True)
    descripcion = Column(String(255))
    unidad_medida = Column(String(20))
    clase_movimiento = Column(String(50), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)
    tipo_movimiento = Column(String(50))
    cantidad = Column(Float, nullable=False)
    centro = Column(String(50))
    almacen = Column(String(50))
    almacen_valido = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)


class DBPlanProduccion(Base):
    """Tabla Plan de Producción - Ingresos y Consumos Proyectados"""
    __tablename__ = "plan_produccion"
    
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False, index=True)
    orden_proceso = Column(String(50))
    sku = Column(String(50), nullable=False, index=True)  # Producto terminado (ingreso)
    materia_prima = Column(String(50), index=True)  # Insumo consumido
    programado = Column(Float)  # Cantidad de producto terminado a producir
    clase_proceso = Column(String(50))
    numero_semana = Column(Integer)
    consumo = Column(Float)  # Cantidad de materia prima a consumir
    created_at = Column(DateTime, default=datetime.utcnow)


# ============== TABLAS DE LOGS ==============

class DBValidationLog(Base):
    """Log de errores de validación"""
    __tablename__ = "validation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(String(50), index=True)
    file_type = Column(String(50))  # maestro, demanda, movimientos
    row_number = Column(Integer)
    column_name = Column(String(100))
    original_value = Column(Text)
    error_type = Column(String(100))
    error_message = Column(Text)
    suggestion = Column(Text)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBUploadHistory(Base):
    """Historial de uploads"""
    __tablename__ = "upload_history"
    
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(String(50), unique=True, index=True)
    filename = Column(String(255))
    file_type = Column(String(50))
    records_total = Column(Integer)
    records_valid = Column(Integer)
    records_invalid = Column(Integer)
    status = Column(String(20))  # processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


# Crear todas las tablas
def init_db():
    """Inicializa la base de datos creando todas las tablas"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency para obtener sesión de BD"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
