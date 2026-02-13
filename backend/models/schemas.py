"""
Pydantic models para validación de datos de los archivos Excel.
Estructura basada en los 3 archivos de entrada del sistema.
"""

from pydantic import BaseModel, Field
from datetime import date
from typing import Optional, Literal
from enum import Enum


class ClaseMovimiento(str, Enum):
    """Clases de movimiento válidas (excluye Traspaso)"""
    CONSUMO = "Consumo"
    PRODUCCION = "Producción"
    STOCK = "Stock"
    VENTA = "Venta"


# ============== MAESTRO DE ARTÍCULOS ==============

class MaestroArticulo(BaseModel):
    """Modelo para Maestro de Artículos"""
    codigo: str = Field(..., description="Código único SKU")
    descripcion: str = Field(..., description="Nombre del artículo")
    unidad_medida: str = Field(..., description="Unidad de medida base")
    nivel1_jerarquia: Optional[str] = Field(None, description="Nivel 1 Jerarquía de producto")
    nivel2_jerarquia: Optional[str] = Field(None, description="Nivel 2 Jerarquía de producto")
    nivel3_jerarquia: Optional[str] = Field(None, description="Nivel 3 Jerarquía de producto")
    grupo_articulos: Optional[str] = Field(None, description="Grupo de artículos")
    tipo_material: Optional[str] = Field(None, description="Tipo de material")
    prioridad: Optional[str] = Field(None, description="Prioridad del artículo")
    clase: Optional[str] = Field(None, description="Clase del artículo")
    agrupacion_comercial: Optional[str] = Field(None, description="Agrupación comercial")

    class Config:
        from_attributes = True


# ============== DEMANDA PROYECTADA DIARIA ==============

class DemandaProyectada(BaseModel):
    """Modelo para Demanda Proyectada Diaria"""
    fecha: date = Field(..., description="Fecha del forecast")
    codigo: str = Field(..., description="Código del artículo")
    descripcion: Optional[str] = Field(None, description="Descripción del artículo")
    cantidad_diaria: float = Field(..., description="Demanda proyectada")

    class Config:
        from_attributes = True


# ============== MOVIMIENTOS DE STOCK ==============

class MovimientoStock(BaseModel):
    """Modelo para Movimientos de Stock"""
    codigo: str = Field(..., description="Código del artículo")
    descripcion: Optional[str] = Field(None, description="Descripción del artículo")
    unidad_medida: Optional[str] = Field(None, description="Unidad de medida")
    clase_movimiento: str = Field(..., description="Clasificación del movimiento")
    fecha: date = Field(..., description="Fecha del movimiento")
    tipo_movimiento: Optional[str] = Field(None, description="Tipo de movimiento (codificación)")
    cantidad: float = Field(..., description="Cantidad movida")
    centro: Optional[str] = Field(None, description="Centro/Almacén")

    class Config:
        from_attributes = True


# ============== UPLOAD RESPONSES ==============

class UploadResponse(BaseModel):
    """Respuesta al subir un archivo"""
    success: bool
    filename: str
    records_processed: int
    records_valid: int
    records_invalid: int
    errors: list[str] = []
    warnings: list[str] = []


class ValidationError(BaseModel):
    """Error de validación individual"""
    row: int
    column: str
    value: str
    error: str
    suggestion: Optional[str] = None


class PreviewResponse(BaseModel):
    """Respuesta de previsualización de datos"""
    filename: str
    total_records: int
    warnings: list[str] = []
    headers: list[str] = []
    data: list[dict] = []
